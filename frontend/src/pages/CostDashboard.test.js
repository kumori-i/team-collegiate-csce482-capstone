import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CostDashboard from "./CostDashboard";

jest.mock("../api", () => ({
  getUsageDashboard: jest.fn(),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  Line: () => <div />,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => <div />,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

const { getUsageDashboard } = require("../api");

describe("CostDashboard", () => {
  beforeEach(() => {
    getUsageDashboard.mockReset();
  });

  test("loads and renders usage summary data", async () => {
    getUsageDashboard.mockResolvedValue({
      totals: {
        requests: 4,
        totalTokens: 1200,
        inputTokens: 700,
        costUsd: 0.1234,
      },
      dailyUsage: [],
      geminiModels: [],
      tamuModels: [],
    });

    render(<CostDashboard onLogout={jest.fn()} />);

    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("$0.1234")).toBeInTheDocument();
    expect(
      screen.getByText(/no gemini usage recorded in this period/i),
    ).toBeInTheDocument();
  });

  test("reloads when the range changes", async () => {
    getUsageDashboard.mockResolvedValue({
      totals: {
        requests: 1,
        totalTokens: 10,
        inputTokens: 5,
        costUsd: 0.01,
      },
      dailyUsage: [],
      geminiModels: [],
      tamuModels: [],
    });

    render(<CostDashboard onLogout={jest.fn()} />);

    expect(getUsageDashboard).toHaveBeenCalledWith(14);

    await userEvent.selectOptions(screen.getByRole("combobox"), "30");

    await waitFor(() => expect(getUsageDashboard).toHaveBeenCalledWith(30));
  });
});
