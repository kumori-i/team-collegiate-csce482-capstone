import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getPlayer,
  generatePlayerReport,
  getSimilarPlayers,
  searchPlayers,
} from "../api";
import ReactMarkdown from "react-markdown";
import PlayerCharts from "../components/PlayerCharts";
import "./PlayerDetails.css";

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
    return { label: "Portal status unavailable", isAvailable: false };
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

export default function PlayerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReportCollapsed, setIsReportCollapsed] = useState(false);
  const [comparisonPlayer, setComparisonPlayer] = useState(null);
  const [compareQuery, setCompareQuery] = useState("");
  const [compareResults, setCompareResults] = useState([]);
  const [compareArchetypes, setCompareArchetypes] = useState({});
  const [comparePortalStatus, setComparePortalStatus] = useState({});
  const [similarPortalOnly, setSimilarPortalOnly] = useState(true);
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const archetypes = resolvePlayerArchetypes(player);
  const portalStatus = resolvePortalAvailability(player);

  useEffect(() => {
    const loadPlayer = async () => {
      try {
        const data = await getPlayer(id);
        // Backend returns { player: { ...stats } }
        setPlayer(data.player || null);
      } catch (err) {
        setError("Unable to load player details.");
      } finally {
        setIsLoading(false);
      }
    };
    loadPlayer();
  }, [id]);

  const hydrateCompareMetadata = async (candidates) => {
    const metadata = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const details = await getPlayer(candidate.unique_id);
          return [
            candidate.unique_id,
            {
              archetypes: resolvePlayerArchetypes(details.player || null),
              portalStatus: resolvePortalAvailability(details.player || null),
            },
          ];
        } catch {
          return [
            candidate.unique_id,
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

    const archetypeMap = {};
    const portalMap = {};
    for (const [candidateId, values] of metadata) {
      archetypeMap[candidateId] = values.archetypes;
      portalMap[candidateId] = values.portalStatus;
    }
    setCompareArchetypes(archetypeMap);
    setComparePortalStatus(portalMap);
  };

  const handleCompareSearch = async (event) => {
    event.preventDefault();
    const query = compareQuery.trim();
    if (!query || isCompareLoading) return;

    setIsCompareLoading(true);
    setCompareError("");
    setCompareResults([]);
    setCompareArchetypes({});
    setComparePortalStatus({});

    try {
      const data = await searchPlayers(query);
      const filteredResults = (data.players || []).filter(
        (p) => p.unique_id !== (player && player.unique_id),
      );
      setCompareResults(filteredResults);
      await hydrateCompareMetadata(filteredResults);
    } catch (err) {
      setCompareError("Comparison search failed. Please try again.");
      setCompareResults([]);
      setCompareArchetypes({});
      setComparePortalStatus({});
    } finally {
      setIsCompareLoading(false);
    }
  };

  const handleSelectComparison = async (playerId) => {
    try {
      const data = await getPlayer(playerId);
      setComparisonPlayer(data.player || null);
      setCompareError("");
    } catch (err) {
      setCompareError("Unable to load comparison player.");
      setComparisonPlayer(null);
    }
  };

  const handleFindSimilarPlayers = async () => {
    if (!player?.unique_id || isCompareLoading) return;
    setIsCompareLoading(true);
    setCompareError("");
    setCompareResults([]);
    setCompareArchetypes({});
    setComparePortalStatus({});

    try {
      const data = await getSimilarPlayers(player.unique_id, {
        limit: 5,
        portalOnly: similarPortalOnly,
      });
      const similarPlayers = Array.isArray(data?.players) ? data.players : [];
      setCompareResults(similarPlayers);
      await hydrateCompareMetadata(similarPlayers);
    } catch (err) {
      setCompareError("Failed to load similar players. Please try again.");
      setCompareResults([]);
      setCompareArchetypes({});
      setComparePortalStatus({});
    } finally {
      setIsCompareLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!player || isGenerating) return;
    setIsGenerating(true);
    setError("");
    try {
      const data = await generatePlayerReport(player);
      setReport(data.description || "");
    } catch (err) {
      console.error("Failed to generate report", err);
      setError("Failed to generate scouting report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="player-page">
      <div className="player-container">
        <button
          type="button"
          className="player-back"
          onClick={() => navigate(-1)}
        >
          Back to search
        </button>

        {isLoading ? (
          <div className="player-loading">Loading player...</div>
        ) : null}

        {error ? <div className="player-error">{error}</div> : null}

        {player ? (
          <>
            <div className="player-header">
              <h1>{player.name_split}</h1>
              <div className="player-subtitle">
                <span>{player.team || "Unknown team"}</span>
                <span>{player.position || "Unknown position"}</span>
                {player.class ? <span>{player.class}</span> : null}
              </div>
              {player.league ? (
                <div className="player-league">{player.league}</div>
              ) : null}
              <div
                className={
                  portalStatus.isAvailable
                    ? "player-portal-badge player-portal-badge--available"
                    : "player-portal-badge player-portal-badge--unavailable"
                }
              >
                {portalStatus.label}
              </div>
            </div>

            <div className="player-report-section">
              <div className="player-report-controls">
                <button
                  type="button"
                  className="player-report-button"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                >
                  {isGenerating
                    ? "Generating report..."
                    : "Generate AI Scouting Report"}
                </button>
                {report && (
                  <button
                    type="button"
                    className="player-report-toggle"
                    onClick={() => setIsReportCollapsed((prev) => !prev)}
                    aria-label={
                      isReportCollapsed ? "Expand report" : "Collapse report"
                    }
                  >
                    {isReportCollapsed ? "▼" : "▲"}
                  </button>
                )}
              </div>
              {report && !isReportCollapsed && (
                <div className="player-report">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              )}
            </div>

            <div className="player-section">
              <h4 className="player-metrics-title">Archetypes</h4>
              <div className="player-archetypes">
                {archetypes.length > 0 ? (
                  archetypes.map((archetype) => (
                    <span key={archetype} className="player-archetype-tag">
                      {archetype}
                    </span>
                  ))
                ) : (
                  <span className="player-archetype-empty">
                    No matching archetype for current thresholds.
                  </span>
                )}
              </div>
              <PlayerCharts
                player={player}
                comparisonPlayer={comparisonPlayer}
              />

              <div className="player-compare-section">
                <div className="player-compare-header">
                  <h4>Compare with another player</h4>
                  {comparisonPlayer ? (
                    <span className="player-compare-selected">
                      Comparing to {comparisonPlayer.name_split}
                      {comparisonPlayer.team
                        ? ` • ${comparisonPlayer.team}`
                        : ""}
                    </span>
                  ) : (
                    <span className="player-compare-selected player-compare-selected--muted">
                      Select a player to see side-by-side charts
                    </span>
                  )}
                </div>

                <form
                  className="player-compare-form"
                  onSubmit={handleCompareSearch}
                >
                  <input
                    type="text"
                    className="player-compare-input"
                    placeholder="Search by name (e.g., Smith, Johnson)..."
                    value={compareQuery}
                    onChange={(e) => setCompareQuery(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="player-compare-button"
                    disabled={isCompareLoading || !compareQuery.trim()}
                  >
                    {isCompareLoading ? "Searching..." : "Search"}
                  </button>
                  <button
                    type="button"
                    className="player-compare-similar-button"
                    onClick={handleFindSimilarPlayers}
                    disabled={isCompareLoading || !player?.unique_id}
                  >
                    Similar Players
                  </button>
                  <label className="player-compare-toggle">
                    <input
                      type="checkbox"
                      checked={similarPortalOnly}
                      onChange={(e) => setSimilarPortalOnly(e.target.checked)}
                    />
                    <span>Portal Only</span>
                  </label>
                </form>

                {compareError ? (
                  <div className="player-compare-error">{compareError}</div>
                ) : null}

                {compareResults.length > 0 && (
                  <div className="player-compare-results">
                    {compareResults.slice(0, 5).map((candidate) => {
                      const candidateTags =
                        compareArchetypes[candidate.unique_id] || [];
                      const visibleTags = candidateTags.slice(
                        0,
                        MAX_ARCHETYPE_TAGS,
                      );
                      const hiddenTagCount = Math.max(
                        0,
                        candidateTags.length - visibleTags.length,
                      );
                      return (
                        <button
                          key={candidate.unique_id}
                          type="button"
                          className="player-compare-result"
                          onClick={() =>
                            handleSelectComparison(candidate.unique_id)
                          }
                        >
                          <div className="player-compare-result-main">
                            <span className="player-compare-name">
                              {candidate.name_split}
                            </span>
                            <span className="player-compare-meta">
                              {candidate.team || "Unknown team"}
                              {candidate.position
                                ? ` • ${candidate.position}`
                                : ""}
                            </span>
                            {comparePortalStatus[candidate.unique_id] ? (
                              <span
                                className={
                                  comparePortalStatus[candidate.unique_id]
                                    .isAvailable
                                    ? "player-compare-portal player-compare-portal--available"
                                    : "player-compare-portal player-compare-portal--unavailable"
                                }
                              >
                                {comparePortalStatus[candidate.unique_id].label}
                              </span>
                            ) : null}
                            {compareArchetypes[candidate.unique_id]?.length >
                            0 ? (
                              <div className="player-compare-archetypes">
                                {visibleTags.map((tag) => (
                                  <span
                                    key={`${candidate.unique_id}-${tag}`}
                                    className="player-compare-archetype-tag"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {hiddenTagCount > 0 ? (
                                  <span className="player-compare-archetype-tag player-compare-archetype-tag--more">
                                    +{hiddenTagCount}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="player-section">
              <h3 className="player-section-subtitle">Key Stats</h3>
              <div className="player-stats-grid">
                <StatCard label="PSP" value={player.psp} />
                <StatCard label="3PE" value={player.c_3pe} isPercentage />
                <StatCard label="FGS" value={player.fgs} />
                <StatCard label="ATR" value={player.ram} />
                <StatCard label="DSI" value={player.dsi} />
                <StatCard label="USG%" value={player.usg} isPercentage />
                <StatCard label="PPG" value={player.pts_g} />
                <StatCard label="RPG" value={player.reb_g} />
                <StatCard label="APG" value={player.ast_g} />
                <StatCard label="TS%" value={player.ts} isPercentage />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, isPercentage = false }) {
  let displayValue = "N/A";
  if (value !== null && value !== undefined) {
    if (isPercentage) {
      const normalizedPercentage = normalizePercentLike(value);
      if (Number.isFinite(normalizedPercentage)) {
        displayValue = `${normalizedPercentage.toFixed(1)}%`;
      } else {
        displayValue = `${value}%`;
      }
    } else if (typeof value === "number") {
      displayValue = value.toFixed(1);
    } else {
      displayValue = value;
    }
  }

  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{displayValue}</span>
    </div>
  );
}
