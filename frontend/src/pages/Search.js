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
          setSearchResults(data.results || []);
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
      setSearchResults(data.results || []);
      setHasSearched(true);
    } catch (err) {
      setError("Search failed. Please try again.");
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlayer = (playerId) => {
    navigate(`/players/${encodeURIComponent(playerId)}`);
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
            <div className="results-list">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="result-item"
                  onClick={() => handleSelectPlayer(result.id)}
                >
                  <div>
                    <h3>{result.name}</h3>
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
