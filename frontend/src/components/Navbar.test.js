import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Navbar from "./Navbar";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

describe("Navbar", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  test("opens profile menu and navigates to cost dashboard", async () => {
    render(
      <MemoryRouter>
        <Navbar onLogout={jest.fn()} theme="light" onToggleTheme={jest.fn()} />
      </MemoryRouter>,
    );

    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[1]);
    await userEvent.click(
      screen.getByRole("button", { name: /cost dashboard/i }),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/cost-dashboard");
  });

  test("calls logout from the profile menu", async () => {
    const onLogout = jest.fn();

    render(
      <MemoryRouter>
        <Navbar onLogout={onLogout} theme="dark" onToggleTheme={jest.fn()} />
      </MemoryRouter>,
    );

    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[1]);
    await userEvent.click(screen.getByRole("button", { name: /logout/i }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
