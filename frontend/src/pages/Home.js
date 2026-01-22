import "./Home.css";

export default function Home() {
  return (
    <div className="home-page">
      <div className="home-hero">
        <h1>Welcome to Basketball App</h1>
        <p>Your hub for basketball scouting and coaching</p>
      </div>

      <div className="home-content">
        <div className="feature-cards">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Search</h3>
            <p>Find players, coaches, and teams</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Chat</h3>
            <p>Connect with other users</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Analytics</h3>
            <p>Track performance and stats</p>
          </div>
        </div>
      </div>
    </div>
  );
}
