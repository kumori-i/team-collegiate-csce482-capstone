import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPlayer, searchPlayers } from "../api";
import "./Search.css";

const ARCHETYPES = [
  {
    name: "The Connector",
    ranges: {
      psp: { min: 60, max: 80 },
      c_3pe: { min: 50, max: 90 },
      fgs: { min: 60, max: 80 },
      atr: { min: 55, max: 80 },
      dsi: { min: 50, max: null },
      usg: { min: 0, max: 25 },
    },
  },
  {
    name: "Modern Big",
    ranges: {
      psp: { min: 70, max: null },
      c_3pe: { min: 40, max: null },
      fgs: { min: 50, max: null },
      atr: { min: 70, max: null },
      dsi: { min: 70, max: null },
      usg: { min: 23, max: null },
    },
  },
  {
    name: "Point Forward",
    ranges: {
      psp: { min: 65, max: null },
      c_3pe: { min: null, max: null },
      fgs: { min: 65, max: null },
      atr: { min: 65, max: null },
      dsi: { min: 65, max: null },
      usg: { min: 20, max: null },
    },
  },
  {
    name: "2 Way Guard",
    ranges: {
      psp: { min: null, max: null },
      c_3pe: { min: null, max: null },
      fgs: { min: 70, max: null },
      atr: { min: null, max: 85 },
      dsi: { min: 65, max: null },
      usg: { min: 0, max: 25 },
    },
  },
  {
    name: "Modern Guard",
    ranges: {
      psp: { min: 70, max: null },
      c_3pe: { min: 70, max: null },
      fgs: { min: 70, max: null },
      atr: { min: null, max: null },
      dsi: { min: null, max: null },
      usg: { min: 25, max: null },
    },
  },
  {
    name: "Rim Runner",
    ranges: {
      psp: { min: 55, max: null },
      c_3pe: { min: null, max: 55 },
      fgs: { min: null, max: 55 },
      atr: { min: 70, max: null },
      dsi: { min: 70, max: null },
      usg: { min: null, max: null },
    },
  },
  {
    name: "3 and D",
    ranges: {
      psp: { min: null, max: null },
      c_3pe: { min: 65, max: null },
      fgs: { min: null, max: 65 },
      atr: { min: 55, max: null },
      dsi: { min: 80, max: null },
      usg: { min: 0, max: 25 },
    },
  },
];

const normalizePercentLike = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return numericValue <= 1 ? numericValue * 100 : numericValue;
};

const matchesArchetypeRange = (value, range) => {
  if (!range || (range.min === null && range.max === null)) return true;
  if (!Number.isFinite(value)) return false;
  if (range.min !== null && value < range.min) return false;
  if (range.max !== null && value > range.max) return false;
  return true;
};

const resolvePlayerArchetypes = (player) => {
  if (!player) return [];
  const values = {
    psp: Number(player.psp),
    c_3pe: normalizePercentLike(player.c_3pe),
    fgs: Number(player.fgs),
    atr: Number(player.ram),
    dsi: Number(player.dsi),
    usg: normalizePercentLike(player.usg),
  };

  return ARCHETYPES.filter((archetype) =>
    Object.entries(archetype.ranges).every(([metric, range]) =>
      matchesArchetypeRange(values[metric], range),
    ),
  ).map((archetype) => archetype.name);
};

const resolvePortalAvailability = (player) => {
  if (!player) {
    return { label: "Portal: Not Available", isAvailable: false };
  }

  if (typeof player.portal_available === "boolean") {
    return player.portal_available
      ? { label: "Portal: Available", isAvailable: true }
      : { label: "Portal: Not Available", isAvailable: false };
  }
  if (typeof player.in_portal === "boolean") {
    return player.in_portal
      ? { label: "Portal: Available", isAvailable: true }
      : { label: "Portal: Not Available", isAvailable: false };
  }
  if (typeof player.transfer_portal === "boolean") {
    return player.transfer_portal
      ? { label: "Portal: Available", isAvailable: true }
      : { label: "Portal: Not Available", isAvailable: false };
  }

  const portalLikeEntries = Object.entries(player).filter(([key]) =>
    /portal|transfer/i.test(String(key)),
  );
  for (const [, rawValue] of portalLikeEntries) {
    if (typeof rawValue === "boolean") {
      return rawValue
        ? { label: "Portal: Available", isAvailable: true }
        : { label: "Portal: Not Available", isAvailable: false };
    }
    if (typeof rawValue === "number") {
      return rawValue > 0
        ? { label: "Portal: Available", isAvailable: true }
        : { label: "Portal: Not Available", isAvailable: false };
    }
    if (typeof rawValue === "string") {
      const text = rawValue.toLowerCase().trim();
      if (
        /\byes\b|\btrue\b|\bavailable\b|\bin portal\b|\btransfer portal\b|\bactive\b/.test(
          text,
        )
      ) {
        return { label: "Portal: Available", isAvailable: true };
      }
      if (
        /\bno\b|\bfalse\b|\bnot available\b|\bnot in portal\b|\binactive\b/.test(
          text,
        )
      ) {
        return { label: "Portal: Not Available", isAvailable: false };
      }
    }
  }

  const combinedText = [
    player.team,
    player.league,
    player.class,
    player.status,
    player.roster_status,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  const inPortalByText =
    /\btransfer portal\b/.test(combinedText) ||
    /\bin portal\b/.test(combinedText) ||
    /\bportal\b/.test(combinedText);

  return inPortalByText
    ? { label: "Portal: Available", isAvailable: true }
    : { label: "Portal: Not Available", isAvailable: false };
};

const MAX_ARCHETYPE_TAGS = 2;

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [resultMetaById, setResultMetaById] = useState({});
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
      setResultMetaById({});
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
          setResultMetaById({});
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
      setResultMetaById({});
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

  const visibleResults = searchResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    let cancelled = false;

    const enrichVisibleResults = async () => {
      const missing = visibleResults.filter(
        (result) => !resultMetaById[result.unique_id],
      );
      if (missing.length === 0) return;

      const entries = await Promise.all(
        missing.map(async (result) => {
          try {
            const data = await getPlayer(result.unique_id);
            const detailedPlayer = data.player || null;
            return [
              result.unique_id,
              {
                archetypes: resolvePlayerArchetypes(detailedPlayer),
                portalStatus: resolvePortalAvailability(detailedPlayer),
              },
            ];
          } catch {
            return [
              result.unique_id,
              {
                archetypes: [],
                portalStatus: {
                  label: "Portal: Not Available",
                  isAvailable: false,
                },
              },
            ];
          }
        }),
      );

      if (cancelled) return;
      setResultMetaById((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }));
    };

    enrichVisibleResults();
    return () => {
      cancelled = true;
    };
  }, [visibleResults, resultMetaById]);

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
              {visibleResults.map((result) =>
                (() => {
                  const playerMeta = resultMetaById[result.unique_id];
                  const archetypes = playerMeta?.archetypes || [];
                  const visibleTags = archetypes.slice(0, MAX_ARCHETYPE_TAGS);
                  const hiddenTagCount = Math.max(
                    0,
                    archetypes.length - visibleTags.length,
                  );
                  return (
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
                        {result.position ? (
                          <p className="result-submeta">{result.position}</p>
                        ) : null}
                        {playerMeta?.portalStatus ? (
                          <span
                            className={
                              playerMeta.portalStatus.isAvailable
                                ? "result-portal result-portal--available"
                                : "result-portal result-portal--unavailable"
                            }
                          >
                            {playerMeta.portalStatus.label}
                          </span>
                        ) : null}
                        {archetypes.length > 0 ? (
                          <div className="result-archetypes">
                            {visibleTags.map((tag) => (
                              <span
                                key={`${result.unique_id}-${tag}`}
                                className="result-archetype-tag"
                              >
                                {tag}
                              </span>
                            ))}
                            {hiddenTagCount > 0 ? (
                              <span className="result-archetype-tag result-archetype-tag--more">
                                +{hiddenTagCount}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })(),
              )}
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
                        prev + 1,
                      ),
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
