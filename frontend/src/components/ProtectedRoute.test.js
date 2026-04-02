import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

const createToken = (expOffsetSeconds = 3600) => {
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expOffsetSeconds,
    }),
  );
  return `header.${payload}.signature`;
};

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("redirects to login when token is missing", () => {
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/login"
            element={<div>Login Screen</div>}
          />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login Screen")).toBeInTheDocument();
  });

  test("renders children when token is valid", () => {
    localStorage.setItem("token", createToken());

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/login"
            element={<div>Login Screen</div>}
          />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
