import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Navbar from "./Navbar";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe("Navbar", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  test("opens profile menu and navigates to cost dashboard", async () => {
    render(
      <MemoryRouter future={routerFuture}>
        <Navbar
          isAuthenticated
          onLogout={jest.fn()}
          theme="light"
          onToggleTheme={jest.fn()}
        />
      </MemoryRouter>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /open profile menu/i }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: /cost dashboard/i }),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/cost-dashboard");
  });

  test("calls logout from the profile menu", async () => {
    const onLogout = jest.fn();

    render(
      <MemoryRouter future={routerFuture}>
        <Navbar
          isAuthenticated
          onLogout={onLogout}
          theme="dark"
          onToggleTheme={jest.fn()}
        />
      </MemoryRouter>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /open profile menu/i }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /logout/i }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
