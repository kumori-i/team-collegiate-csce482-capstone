import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Chat from "./Chat";

jest.mock("../api", () => ({
  chatWithAgentStream: jest.fn(),
  getChatSuggestions: jest.fn(),
  resetAgentSession: jest.fn(),
}));

jest.mock("../components/ChatMetricChart", () => (props) => (
  <div data-testid="chat-metric-chart">{props.chartSpec?.title || "Chart"}</div>
));

jest.mock("react-markdown", () => (props) => <>{props.children}</>);

const { chatWithAgentStream, getChatSuggestions } = require("../api");

describe("Chat", () => {
  beforeEach(() => {
    localStorage.clear();
    chatWithAgentStream.mockReset();
    getChatSuggestions.mockReset();
    getChatSuggestions.mockResolvedValue({
      suggestions: [
        "Who are the top 10 scorers in the database right now?",
        "Show me the most effective point guards with at least 5 games played.",
        "Find 5 similar players to Cameron Boozer.",
      ],
    });
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  test("sends a message and renders assistant text", async () => {
    chatWithAgentStream.mockImplementation(async (_message, _history, cbs) => {
      const reply = "Cameron Boozer matches these archetypes: Modern Big.";
      cbs.onToken({ text: reply });
      cbs.onDone({
        reply,
        chartSpec: null,
        toolUsed: "none",
      });
    });

    render(<Chat onLogout={jest.fn()} />);

    await userEvent.type(
      screen.getByPlaceholderText(/type a message/i),
      "tell me cameron boozer's archetypes",
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/modern big/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled(),
    );
    expect(chatWithAgentStream).toHaveBeenCalledTimes(1);
  });

  test("renders a chart only when chartSpec is returned", async () => {
    chatWithAgentStream.mockImplementation(async (_message, _history, cbs) => {
      const reply = "Here is a chart for Cameron Boozer using APG, PPG, RPG.";
      cbs.onToken({ text: reply });
      cbs.onDone({
        reply,
        chartSpec: {
          title: "Cameron Boozer Metric Chart",
          player: { unique_id: "1", name_split: "Cameron Boozer" },
          metrics: [],
        },
        toolUsed: "search_players+get_player_by_id+chart",
      });
    });

    render(<Chat onLogout={jest.fn()} />);

    await userEvent.type(
      screen.getByPlaceholderText(/type a message/i),
      "generate a chart for cameron boozer",
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByTestId("chat-metric-chart")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled(),
    );
  });

  test("logs out on auth failure", async () => {
    const onLogout = jest.fn();
    chatWithAgentStream.mockRejectedValue({
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

  test("loads startup suggestions and populates the input when clicked", async () => {
    render(<Chat onLogout={jest.fn()} />);

    const suggestion = await screen.findByRole("button", {
      name: /top 10 scorers in the database/i,
    });
    await userEvent.click(suggestion);

    expect(screen.getByPlaceholderText(/type a message/i)).toHaveValue(
      "Who are the top 10 scorers in the database right now?",
    );
  });

  test("replaces suggestions with follow-up suggestions from the backend", async () => {
    chatWithAgentStream.mockImplementation(async (_message, _history, cbs) => {
      const reply = "Here is a chart for Cameron Boozer using APG, PPG, RPG.";
      cbs.onToken({ text: reply });
      cbs.onDone({
        reply,
        chartSpec: {
          title: "Cameron Boozer Metric Chart",
          player: { unique_id: "1", name_split: "Cameron Boozer" },
          metrics: [],
        },
        toolUsed: "search_players+get_player_by_id+chart",
        suggestions: [
          "What do these metrics suggest about Cameron Boozer's role?",
          "Find 5 similar players to Cameron Boozer.",
          "Give me a scouting report on Cameron Boozer.",
        ],
      });
    });

    render(<Chat onLogout={jest.fn()} />);

    await userEvent.type(
      screen.getByPlaceholderText(/type a message/i),
      "generate a chart for cameron boozer",
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled(),
    );
    expect(
      screen.getByRole("button", {
        name: /what do these metrics suggest about cameron boozer's role/i,
      }),
    ).toBeInTheDocument();
  });
});
