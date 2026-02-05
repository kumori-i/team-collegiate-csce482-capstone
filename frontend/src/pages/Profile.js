import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, deleteAccount } from "../api";
import "./Profile.css";

export default function Profile({ onLogout }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await getUserProfile();
      setUser(userData);
    } catch (error) {
      console.error("Failed to load profile:", error);
      if (error.response?.status === 401) {
        onLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount();
      alert("Account deleted successfully");
      onLogout();
      navigate("/");
    } catch (error) {
      console.error("Failed to delete account:", error);
      alert(error.response?.data?.error || "Failed to delete account");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1>Profile</h1>

        {user && (
          <div className="profile-info">
            <div className="profile-field">
              <label>Name</label>
              <div className="profile-value">
                {user.name || user.email?.split("@")[0] || "Unknown"}
              </div>
            </div>
            <div className="profile-field">
              <label>Email</label>
              <div className="profile-value">{user.email}</div>
            </div>

            <div className="profile-field">
              <label>Member Since</label>
              <div className="profile-value">
                {new Date(user.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        <div className="profile-actions">
          {!showDeleteConfirm ? (
            <button
              onClick={handleDeleteAccount}
              className="delete-account-btn"
            >
              Delete Account
            </button>
          ) : (
            <div className="delete-confirm">
              <p>
                Are you sure you want to delete your account? This action cannot
                be undone.
              </p>
              <div className="delete-confirm-buttons">
                <button
                  onClick={handleDeleteAccount}
                  className="confirm-delete-btn"
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Yes, Delete Account"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="cancel-delete-btn"
                  disabled={deleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
