import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import "./App.css";
import Login from "./components/Login";
import Register from "./components/Register";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";

function App() {
  const [currentView, setCurrentView] = useState("login");

  const isAuthenticated = !!localStorage.getItem("token");

  const handleLoginSuccess = () => {
    // Navigation handled by window.location in Login component
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <BrowserRouter>
      <div className="App">
        {isAuthenticated && <Navbar onLogout={handleLogout} />}
        
        <Routes>
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <div className="auth-container">
                  <div className="container">
                    <h1>Authentication</h1>
                    <div className="view-toggle">
                      <button
                        onClick={() => setCurrentView("login")}
                        className={currentView === "login" ? "active" : ""}
                      >
                        Login
                      </button>
                      <button
                        onClick={() => setCurrentView("register")}
                        className={currentView === "register" ? "active" : ""}
                      >
                        Register
                      </button>
                    </div>
                    {currentView === "login" ? (
                      <Login onSuccess={handleLoginSuccess} />
                    ) : (
                      <Register onSuccess={() => setCurrentView("login")} />
                    )}
                  </div>
                </div>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          
          <Route
            path="/register"
            element={<Navigate to="/login" replace />}
          />

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
