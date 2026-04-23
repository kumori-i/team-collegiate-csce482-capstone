import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Search from "./Search";

const mockNavigate = jest.fn();

jest.mock("../api", () => ({
  searchPlayers: jest.fn(),
  getPlayer: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const { searchPlayers, getPlayer } = require("../api");

describe("Search", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    searchPlayers.mockReset();
    getPlayer.mockReset();
  });

  test("filters out null search results before rendering", async () => {
    searchPlayers.mockResolvedValue({
      players: [
        null,
        {
          unique_id: "player-1",
          name_split: "Cameron Boozer",
          team: "Duke",
          position: "F",
        },
      ],
    });
    getPlayer.mockResolvedValue({
      player: {
        unique_id: "player-1",
        name_split: "Cameron Boozer",
        team: "Duke",
        position: "F",
      },
    });

    render(<Search />);

    const searchInput = screen.getByPlaceholderText(/search for players/i);
    fireEvent.change(searchInput, { target: { value: "Cameron" } });

    expect(await screen.findByText(/cameron boozer/i)).toBeInTheDocument();
    expect(screen.getByText(/1 player found/i)).toBeInTheDocument();

    await waitFor(() => expect(getPlayer).toHaveBeenCalledWith("player-1"));
  });
});
