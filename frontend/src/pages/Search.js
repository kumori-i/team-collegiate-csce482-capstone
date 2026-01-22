import { useState } from "react";
import "./Search.css";

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = (e) => {
    e.preventDefault();
    // TODO: Implement actual search functionality
    console.log("Searching for:", searchQuery);
    // Placeholder results
    setSearchResults([
      { id: 1, name: "Player 1", type: "Player" },
      { id: 2, name: "Coach 1", type: "Coach" },
    ]);
  };

  return (
    <div className="search-page">
      <div className="search-container">
        <h1>Search</h1>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search for players, coaches, or teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">
            Search
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="search-results">
            <h2>Results</h2>
            <div className="results-list">
              {searchResults.map((result) => (
                <div key={result.id} className="result-item">
                  <h3>{result.name}</h3>
                  <span className="result-type">{result.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchQuery && searchResults.length === 0 && (
          <div className="no-results">
            <p>No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
