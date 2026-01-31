// frontend/src/api.js
import axios from "axios";

// Use explicit URL if provided, otherwise use proxy
// If REACT_APP_API_URL is set, use it; otherwise use proxy path
const API_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL
  : "http://localhost:5001/api";

// Debug: Log the API URL being used
console.log("API URL:", API_URL);

export const loginWithGoogle = async (idToken) => {
  const res = await axios.post(`${API_URL}/auth/google`, { idToken });
  return res.data.token;
};

// Get current user profile
export const getUserProfile = async () => {
  const token = localStorage.getItem("token");
  const res = await axios.get(`${API_URL}/auth/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// Delete user account
export const deleteAccount = async () => {
  const token = localStorage.getItem("token");
  const res = await axios.delete(`${API_URL}/auth/account`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

export const chatWithDataset = async (message) => {
  const res = await axios.post(`${API_URL}/chat`, { message });
  return res.data;
};

// Helper to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};
