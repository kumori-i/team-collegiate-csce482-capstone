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
        setPlayer(data);
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
              <h1>{player.name}</h1>
              <div className="player-subtitle">
                <span>{player.team || "Unknown team"}</span>
                <span>{player.position || "Unknown position"}</span>
              </div>
            </div>

            <div className="player-stats">
              {Object.entries(player.stats || {}).map(([key, value]) => (
                <div key={key} className="stat-card">
                  <span className="stat-label">{key}</span>
                  <span className="stat-value">{value}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
