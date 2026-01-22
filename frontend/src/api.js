// frontend/src/api.js
import axios from "axios";

// Use explicit URL if provided, otherwise use proxy
// If REACT_APP_API_URL is set, use it; otherwise use proxy path
const API_URL = process.env.REACT_APP_API_URL 
  ? process.env.REACT_APP_API_URL 
  : "http://localhost:5001/api";

// Debug: Log the API URL being used
console.log("API URL:", API_URL);

export const loginUser = async (email, password) => {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  return res.data.token; // returns JWT
};

export const registerUser = async (email, password, role = "scout") => {
  try {
    const res = await axios.post(`${API_URL}/auth/register`, {
      email,
      password,
      role,
    }, {
      headers: {
        "Content-Type": "application/json"
      }
    });
    return res.data;
  } catch (error) {
    // Re-throw with more context
    if (error.response) {
      // Server responded with error status
      console.error("Server error response:", {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
      throw error;
    } else if (error.request) {
      // Request made but no response (network error)
      console.error("Network error details:", {
        url: `${API_URL}/auth/register`,
        error: error.message,
        code: error.code
      });
      throw new Error(`Cannot connect to server at ${API_URL}. Make sure the backend is running.`);
    } else {
      // Something else happened
      throw error;
    }
  }
};

// Get current user profile
export const getUserProfile = async () => {
  const token = localStorage.getItem("token");
  const res = await axios.get(`${API_URL}/auth/profile`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return res.data;
};

// Delete user account
export const deleteAccount = async () => {
  const token = localStorage.getItem("token");
  const res = await axios.delete(`${API_URL}/auth/account`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return res.data;
};

// Helper to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};
