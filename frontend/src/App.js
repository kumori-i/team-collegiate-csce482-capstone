import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import PlayerDetails from "./pages/PlayerDetails";

function App() {
  const isAuthenticated = !!localStorage.getItem("token");
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("theme");
    return stored || "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleLoginSuccess = () => {
    // Navigation handled by window.location in Login component
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <BrowserRouter>
      <div className="App">
        {isAuthenticated && (
          <Navbar
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}

        <Routes>
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <div className="auth-container">
                  <div className="container">
                    <div className="auth-kicker">CerebroChat</div>
                    <h1>Sign in</h1>
                    <p className="auth-subtitle">
                      Basketball intelligence built for fast decisions.
                    </p>
                    <Login onSuccess={handleLoginSuccess} />
                  </div>
                </div>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route path="/register" element={<Navigate to="/login" replace />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            }
          />

          <Route
            path="/players/:id"
            element={
              <ProtectedRoute>
                <PlayerDetails />
              </ProtectedRoute>
            }
          />

          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
