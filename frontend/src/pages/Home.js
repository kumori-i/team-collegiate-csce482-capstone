import { Link } from "react-router-dom";
import "./Home.css";

export default function Home() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-content">
          <div className="hero-kicker">CerebroChat</div>
          <h1>Scout sharper. Coach smarter. Win the details.</h1>
          <p>
            A basketball-focused research cockpit built for recruiting,
            scouting, and performance planning.
          </p>
          <div className="hero-actions">
            <Link to="/search" className="hero-button primary">
              Search Players
            </Link>
            <Link to="/chat" className="hero-button ghost">
              Ask the Dataset
            </Link>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">RAG</span>
              <span className="stat-label">Context-grounded answers</span>
            </div>
            <div className="stat">
              <span className="stat-value">CSV+</span>
              <span className="stat-label">Custom data pipeline</span>
            </div>
            <div className="stat">
              <span className="stat-value">Live</span>
              <span className="stat-label">Search + scouting workflow</span>
            </div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title">Scouting Board</span>
              <span className="panel-tag">Playbook Ready</span>
            </div>
            <div className="panel-list">
              <div>
                <h4>Recruiting Intel</h4>
                <p>Quickly surface depth charts and roster gaps.</p>
              </div>
              <div>
                <h4>Opponent Prep</h4>
                <p>Summarize data trends with instant context.</p>
              </div>
              <div>
                <h4>Player Notes</h4>
                <p>Keep a clean, sharp narrative for each athlete.</p>
              </div>
            </div>
          </div>
          <div className="panel-banner">
            Built for coaches who want answers at the speed of practice.
          </div>
        </div>
      </section>

      <section className="home-grid">
        <Link to="/search" className="grid-card grid-link">
          <h3>Search the Roster</h3>
          <p>Filter by role, position, and performance signals in seconds.</p>
          <span className="grid-cta">Open Search</span>
        </Link>
        <Link to="/chat" className="grid-card grid-link">
          <h3>Talk to the Data</h3>
          <p>Ask direct questions and stay grounded in your dataset.</p>
          <span className="grid-cta">Open Chat</span>
        </Link>
        <div className="grid-card">
          <h3>Analytics Hub</h3>
          <p>Track season-long trends with clean, readable context.</p>
          <span className="grid-cta">Coming Soon</span>
        </div>
      </section>

      <footer className="home-footer">
        © {new Date().getFullYear()} CerebroChat. All rights reserved.
      </footer>
    </div>
  );
}
