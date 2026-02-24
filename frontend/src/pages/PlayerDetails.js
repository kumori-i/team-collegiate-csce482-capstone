import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPlayer, generatePlayerReport, searchPlayers } from "../api";
import ReactMarkdown from "react-markdown";
import PlayerCharts from "../components/PlayerCharts";
import "./PlayerDetails.css";

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
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

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

  const handleCompareSearch = async (event) => {
    event.preventDefault();
    const query = compareQuery.trim();
    if (!query || isCompareLoading) return;

    setIsCompareLoading(true);
    setCompareError("");
    setCompareResults([]);

    try {
      const data = await searchPlayers(query);
      setCompareResults(
        (data.players || []).filter(
          (p) => p.unique_id !== (player && player.unique_id),
        ),
      );
    } catch (err) {
      setCompareError("Comparison search failed. Please try again.");
      setCompareResults([]);
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
        <button type="button" className="player-back" onClick={() => navigate(-1)}>
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
            </div>

            <div className="player-report-section">
              <div className="player-report-controls">
                <button
                  type="button"
                  className="player-report-button"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating report..." : "Generate AI Scouting Report"}
                </button>
                {report && (
                  <button
                    type="button"
                    className="player-report-toggle"
                    onClick={() => setIsReportCollapsed((prev) => !prev)}
                    aria-label={isReportCollapsed ? "Expand report" : "Collapse report"}
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
              <h2 className="player-section-title">Season Overview</h2>
              <div className="player-primary-stats">
                <StatCard label="Points Per Game" value={player.pts_g} />
                <StatCard label="Rebounds Per Game" value={player.reb_g} />
                <StatCard label="Assists Per Game" value={player.ast_g} />
              </div>
            </div>

            <div className="player-section">
              <h3 className="player-section-subtitle">Visual Profile</h3>
              <PlayerCharts player={player} comparisonPlayer={comparisonPlayer} />

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
                </form>

                {compareError ? (
                  <div className="player-compare-error">{compareError}</div>
                ) : null}

                {compareResults.length > 0 && (
                  <div className="player-compare-results">
                    {compareResults.slice(0, 5).map((candidate) => (
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
                        </div>
                        <span className="player-compare-action">
                          Use for comparison
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="player-section">
              <h3 className="player-section-subtitle">Scoring</h3>
              <div className="player-stats-grid">
                <StatCard label="PPG" value={player.pts_g} />
                <StatCard label="FG%" value={player.fg} isPercentage />
                <StatCard label="3PT%" value={player.c_3pt} isPercentage />
                <StatCard label="2PT%" value={player.c_2pt} isPercentage />
                <StatCard label="FT%" value={player.ft} isPercentage />
                <StatCard label="eFG%" value={player.efg} isPercentage />
                <StatCard label="TS%" value={player.ts} isPercentage />
                <StatCard label="PPP" value={player.ppp} />
              </div>
            </div>

            <div className="player-section">
              <h3 className="player-section-subtitle">Playmaking</h3>
              <div className="player-stats-grid">
                <StatCard label="APG" value={player.ast_g} />
                <StatCard label="TPG" value={player.to_g} />
                <StatCard label="A/TO" value={player.a_to} />
                <StatCard label="USG%" value={player.usg} isPercentage />
              </div>
            </div>

            <div className="player-section">
              <h3 className="player-section-subtitle">Rebounding</h3>
              <div className="player-stats-grid">
                <StatCard label="RPG" value={player.reb_g} />
                <StatCard label="ORPG" value={player.orb_g} />
                <StatCard label="DRPG" value={player.drb_g} />
              </div>
            </div>

            <div className="player-section">
              <h3 className="player-section-subtitle">Defense & Usage</h3>
              <div className="player-stats-grid">
                <StatCard label="SPG" value={player.stl_g} />
                <StatCard label="BPG" value={player.blk_g} />
                <StatCard label="FPG" value={player.pf_g} />
                <StatCard label="MPG" value={player.min_g} />
                <StatCard label="Games" value={player.g} />
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
      displayValue = `${(value * 100).toFixed(1)}%`;
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
