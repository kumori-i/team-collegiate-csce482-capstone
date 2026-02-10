import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPlayer } from "../api";
import "./PlayerDetails.css";

export default function PlayerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

            <div className="player-section">
              <h2 className="player-section-title">Season Overview</h2>
              <div className="player-primary-stats">
                <StatCard label="Points Per Game" value={player.pts_g} />
                <StatCard label="Rebounds Per Game" value={player.reb_g} />
                <StatCard label="Assists Per Game" value={player.ast_g} />
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
