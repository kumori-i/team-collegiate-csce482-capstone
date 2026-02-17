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

export const chatWithAgent = async (message) => {
  const res = await axios.post(`${API_URL}/agent/chat`, { message });
  return res.data;
};

// Backward-compatible alias for older imports.
export const chatWithDataset = chatWithAgent;

export const searchPlayers = async (query) => {
  const res = await axios.get(`${API_URL}/players/search`, {
    params: { query },
  });
  return res.data;
};

export const getPlayer = async (id) => {
  const res = await axios.get(`${API_URL}/players/${encodeURIComponent(id)}`);
  return res.data;
};

export const generatePlayerReport = async (player) => {
  const prompt = `Generate a scouting report for ${player.name_split} (${player.position}) on ${player.team}. Focus on role, strengths, weaknesses, and projection.`;
  const res = await axios.post(`${API_URL}/agent/report`, {
    message: prompt,
    player,
  });
  return {
    description: res.data?.report || "",
  };
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
