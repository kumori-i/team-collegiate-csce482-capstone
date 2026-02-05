import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

export default function Navbar({ user, onLogout, theme, onToggleTheme }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleViewProfile = () => {
    setShowProfileMenu(false);
    navigate("/profile");
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    onLogout();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          CerebroChat
        </Link>

        <div className="navbar-links">
          <Link to="/" className="nav-link">
            Home
          </Link>
          <Link to="/search" className="nav-link">
            Search
          </Link>
          <Link to="/chat" className="nav-link">
            Chat
          </Link>
        </div>

        <div className="navbar-profile">
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            type="button"
          >
            <span className="theme-toggle-label">
              {theme === "dark" ? "Dark" : "Light"}
            </span>
            <span className="theme-toggle-icon" aria-hidden="true">
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" role="img">
                  <path
                    d="M15.5 2.5a9.5 9.5 0 1 0 6 15.2A8.2 8.2 0 0 1 15.5 2.5z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" role="img">
                  <circle cx="12" cy="12" r="4.5" fill="currentColor" />
                  <path
                    d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2.2 2.2M17.3 17.3l2.2 2.2M4.5 19.5l2.2-2.2M17.3 6.7l2.2-2.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
          </button>
          <button className="profile-icon-btn" onClick={handleProfileClick}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="16" cy="16" r="16" fill="currentColor" />
              <circle cx="16" cy="12" r="5" fill="white" />
              <path
                d="M6 26c0-5.5 4.5-10 10-10s10 4.5 10 10"
                stroke="white"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </button>

          {showProfileMenu && (
            <div className="profile-menu">
              <button onClick={handleViewProfile} className="profile-menu-item">
                View Profile
              </button>
              <button onClick={handleLogout} className="profile-menu-item">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
