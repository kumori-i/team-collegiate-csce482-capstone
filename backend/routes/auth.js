// backend/routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";

const router = express.Router();
const getGoogleClient = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Register
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const derivedName = name || email.split("@")[0];
    const user = await User.create({
      email,
      passwordHash: hash,
      name: derivedName,
    });
    res.status(201).json({ message: "User created" });
  } catch (err) {
    console.error("Registration error:", err);

    // Handle duplicate key error (MongoDB)
    if (err.code === 11000) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Handle validation errors
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors)
        .map((e) => e.message)
        .join(", ");
      return res.status(400).json({ error: errors });
    }

    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.passwordHash) {
      return res
        .status(401)
        .json({ error: "Use Google sign-in for this account" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Google login
router.post("/google", async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: "Google ID token required" });
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "Google client ID not configured" });
  }

  try {
    const googleClient = getGoogleClient();
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const googleId = payload?.sub;
    const displayName =
      payload?.name ||
      [payload?.given_name, payload?.family_name].filter(Boolean).join(" ");

    if (!email || !googleId) {
      return res.status(400).json({ error: "Invalid Google token payload" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        googleId,
        name: displayName || email.split("@")[0],
      });
    } else if (user.googleId && user.googleId !== googleId) {
      return res.status(401).json({ error: "Google account mismatch" });
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (!user.name && displayName) {
        user.name = displayName;
      }
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(401).json({ error: "Google authentication failed" });
  }
});

// Get user profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user account
router.delete("/account", authenticateToken, async (req, res) => {
  try {
    console.log("Delete account request for user:", req.user.id);
    const user = await User.findByIdAndDelete(req.user.id);
    if (!user) {
      console.log("User not found for deletion:", req.user.id);
      return res.status(404).json({ error: "User not found" });
    }
    console.log("Account deleted successfully:", user.email);
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
