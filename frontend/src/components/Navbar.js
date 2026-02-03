import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

export default function Navbar({ user, onLogout }) {
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
          <button className="profile-icon-btn" onClick={handleProfileClick}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="16" cy="16" r="16" fill="#667eea" />
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
