import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Chat from "./Chat";

jest.mock("../api", () => ({
  chatWithAgent: jest.fn(),
  resetAgentSession: jest.fn(),
}));

jest.mock("../components/ChatMetricChart", () => (props) => (
  <div data-testid="chat-metric-chart">{props.chartSpec?.title || "Chart"}</div>
));

jest.mock("react-markdown", () => (props) => <>{props.children}</>);

const { chatWithAgent } = require("../api");

describe("Chat", () => {
  beforeEach(() => {
    localStorage.clear();
    chatWithAgent.mockReset();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  test("sends a message and renders assistant text", async () => {
    chatWithAgent.mockResolvedValue({
      reply: "Cameron Boozer matches these archetypes: Modern Big.",
      chartSpec: null,
    });

    render(<Chat onLogout={jest.fn()} />);

    await userEvent.type(
      screen.getByPlaceholderText(/type a message/i),
      "tell me cameron boozer's archetypes",
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/modern big/i)).toBeInTheDocument();
    expect(chatWithAgent).toHaveBeenCalledTimes(1);
  });

  test("renders a chart only when chartSpec is returned", async () => {
    chatWithAgent.mockResolvedValue({
      reply: "Here is a chart for Cameron Boozer using APG, PPG, RPG.",
      chartSpec: {
        title: "Cameron Boozer Metric Chart",
        player: { unique_id: "1", name_split: "Cameron Boozer" },
        metrics: [],
      },
    });

    render(<Chat onLogout={jest.fn()} />);

    await userEvent.type(
      screen.getByPlaceholderText(/type a message/i),
      "generate a chart for cameron boozer",
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByTestId("chat-metric-chart")).toBeInTheDocument();
  });

  test("logs out on auth failure", async () => {
    const onLogout = jest.fn();
    chatWithAgent.mockRejectedValue({
      response: { status: 403 },
    });

    render(<Chat onLogout={onLogout} />);

    await userEvent.type(
      screen.getByPlaceholderText(/type a message/i),
      "test message",
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
  });
});
