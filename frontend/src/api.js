// frontend/src/api.js
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export const loginUser = async (email, password) => {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  return res.data.token; // returns JWT
};
