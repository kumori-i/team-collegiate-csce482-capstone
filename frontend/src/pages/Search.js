import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchPlayers } from "../api";
import "./Search.css";

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setError("");
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError("");

    const timer = setTimeout(async () => {
      try {
        const data = await searchPlayers(query);
        if (!cancelled) {
          // Backend returns { players: [...] }
          setSearchResults(data.players || []);
          setCurrentPage(1);
          setHasSearched(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Search failed. Please try again.");
          setSearchResults([]);
          setHasSearched(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const data = await searchPlayers(query);
      setSearchResults(data.players || []);
      setCurrentPage(1);
      setHasSearched(true);
    } catch (err) {
      setError("Search failed. Please try again.");
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlayer = (playerUniqueId) => {
    navigate(`/players/${encodeURIComponent(playerUniqueId)}`);
  };

  return (
    <div className="search-page">
      <div className="search-container">
        <h1>Search</h1>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search for players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">
            {isLoading ? "Searching..." : "Search"}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="search-results">
            <h2>Results</h2>
            <p className="results-count">
              {searchResults.length} player
              {searchResults.length !== 1 ? "s" : ""} found
            </p>
            <div className="results-list">
              {searchResults
                .slice(
                  (currentPage - 1) * itemsPerPage,
                  currentPage * itemsPerPage
                )
                .map((result) => (
                <button
                  key={result.unique_id}
                  type="button"
                  className="result-item"
                  onClick={() => handleSelectPlayer(result.unique_id)}
                >
                  <div>
                    <h3>{result.name_split}</h3>
                    {result.team ? (
                      <p className="result-meta">{result.team}</p>
                    ) : null}
                  </div>
                  <span className="result-type">
                    {result.position || "Player"}
                  </span>
                </button>
              ))}
            </div>

            {searchResults.length > itemsPerPage && (
              <div className="pagination">
                <button
                  type="button"
                  className="page-button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                >
                  Prev
                </button>

                <span className="page-info">
                  Page {currentPage} of{" "}
                  {Math.ceil(searchResults.length / itemsPerPage)}
                </span>

                <button
                  type="button"
                  className="page-button"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(
                        Math.ceil(searchResults.length / itemsPerPage),
                        prev + 1
                      )
                    )
                  }
                  disabled={
                    currentPage ===
                    Math.ceil(searchResults.length / itemsPerPage)
                  }
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {searchQuery &&
          hasSearched &&
          searchResults.length === 0 &&
          !isLoading &&
          !error && (
            <div className="no-results">
              <p>No results found for "{searchQuery}"</p>
            </div>
          )}

        {error ? <div className="search-error">{error}</div> : null}
      </div>
    </div>
  );
}
