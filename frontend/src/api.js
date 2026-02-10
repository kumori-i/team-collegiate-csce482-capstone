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
  const res = await axios.post(`${API_URL}/players/report`, {
    name: player.name_split,
    team: player.team,
    position: player.position,
    class: player.class,
    pts_g: player.pts_g,
    reb_g: player.reb_g,
    ast_g: player.ast_g,
    fg: player.fg,
    c_3pt: player.c_3pt,
    ft: player.ft,
    stl_g: player.stl_g,
    blk_g: player.blk_g,
    to_g: player.to_g,
    min_g: player.min_g,
    efg: player.efg,
    ts: player.ts,
    usg: player.usg,
    a_to: player.a_to,
    orb_g: player.orb_g,
    ram: player.ram,
    c_ram: player.c_ram,
    psp: player.psp,
    c_3pe: player.c_3pe,
    dsi: player.dsi,
    fgs: player.fgs,
    bms: player.bms,
    orb_40: player.orb_40,
  });
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
