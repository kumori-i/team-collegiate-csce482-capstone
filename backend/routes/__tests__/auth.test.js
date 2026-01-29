import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const mockUserFindOne = jest.fn();
const mockUserCreate = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFindByIdAndDelete = jest.fn();
const mockBcryptCompare = jest.fn();
const mockBcryptHash = jest.fn();
const mockJwtSign = jest.fn();
const mockVerifyIdToken = jest.fn();

jest.unstable_mockModule("../../models/User.js", () => ({
  default: {
    findOne: mockUserFindOne,
    create: mockUserCreate,
    findById: mockUserFindById,
    findByIdAndDelete: mockUserFindByIdAndDelete,
  },
}));

jest.unstable_mockModule("bcrypt", () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
  },
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: mockJwtSign,
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken(...args) {
      return mockVerifyIdToken(...args);
    }
  },
}));

const { default: authRoutes } = await import("../../routes/auth.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  return app;
};

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  mockUserFindOne.mockReset();
  mockUserCreate.mockReset();
  mockUserFindById.mockReset();
  mockUserFindByIdAndDelete.mockReset();
  mockBcryptCompare.mockReset();
  mockBcryptHash.mockReset();
  mockJwtSign.mockReset();
  mockVerifyIdToken.mockReset();
});

describe("auth routes", () => {
  test("register requires email and password", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/auth/register").send({});
    expect(res.status).toBe(400);
  });

  test("register creates user and hashes password", async () => {
    const app = buildApp();
    mockUserFindOne.mockResolvedValue(null);
    mockBcryptHash.mockResolvedValue("hashed");
    mockUserCreate.mockResolvedValue({ _id: "u1", email: "a@b.com" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(mockBcryptHash).toHaveBeenCalled();
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@b.com",
        passwordHash: "hashed",
      }),
    );
  });

  test("login rejects google-only users", async () => {
    const app = buildApp();
    mockUserFindOne.mockResolvedValue({
      _id: "u1",
      email: "a@b.com",
      passwordHash: null,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(401);
  });

  test("login returns jwt for valid credentials", async () => {
    const app = buildApp();
    mockUserFindOne.mockResolvedValue({
      _id: "u1",
      email: "a@b.com",
      passwordHash: "hashed",
    });
    mockBcryptCompare.mockResolvedValue(true);
    mockJwtSign.mockReturnValue("jwt-token");

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("jwt-token");
  });

  test("google login creates user and returns jwt", async () => {
    const app = buildApp();
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: "g@b.com", sub: "google-id-1" }),
    });
    mockUserFindOne.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({
      _id: "u2",
      email: "g@b.com",
    });
    mockJwtSign.mockReturnValue("google-jwt");

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "id-token" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("google-jwt");
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "g@b.com",
        googleId: "google-id-1",
      }),
    );
  });
});
