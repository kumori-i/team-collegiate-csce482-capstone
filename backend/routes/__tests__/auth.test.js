import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const mockSupabaseFrom = jest.fn();
const mockBcryptCompare = jest.fn();
const mockBcryptHash = jest.fn();
const mockJwtSign = jest.fn();
const mockVerifyIdToken = jest.fn();

// Mock Supabase
jest.unstable_mockModule("../../supabase.js", () => ({
  supabase: {
    from: mockSupabaseFrom,
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
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "test-key";
  mockSupabaseFrom.mockReset();
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
    
    // Mock checking for existing user
    mockSupabaseFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
        }),
      }),
    });
    
    // Mock creating new user
    mockSupabaseFrom.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: "u1", email: "a@b.com" }, error: null }),
        }),
      }),
    });
    
    mockBcryptHash.mockResolvedValue("hashed");

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(mockBcryptHash).toHaveBeenCalled();
  });

  test("login rejects google-only users", async () => {
    const app = buildApp();
    
    // Mock finding user with no password_hash
    mockSupabaseFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: "u1", email: "a@b.com", password_hash: null },
            error: null,
          }),
        }),
      }),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(401);
  });

  test("login returns jwt for valid credentials", async () => {
    const app = buildApp();
    
    // Mock finding user with password_hash
    mockSupabaseFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: "u1", email: "a@b.com", password_hash: "hashed" },
            error: null,
          }),
        }),
      }),
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
    
    // Mock finding no existing user
    mockSupabaseFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
        }),
      }),
    });
    
    // Mock creating new user
    mockSupabaseFrom.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: "u2", email: "g@b.com", google_id: "google-id-1" },
            error: null,
          }),
        }),
      }),
    });
    
    mockJwtSign.mockReturnValue("google-jwt");

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "id-token" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("google-jwt");
  });
});
