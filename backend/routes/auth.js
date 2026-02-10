// backend/routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "../supabase.js";

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
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const derivedName = name || email.split("@")[0];

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        email,
        password_hash: hash,
        name: derivedName,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Registration error:", error);
      // Handle unique constraint violations
      if (error.code === "23505") {
        return res.status(400).json({ error: "Email already registered" });
      }
      return res.status(500).json({ error: error.message || "Registration failed" });
    }

    res.status(201).json({ message: "User created" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.password_hash) {
      return res
        .status(401)
        .json({ error: "Use Google sign-in for this account" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
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

    // Check if user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    let user = existingUser;

    if (!user) {
      // Create new user
      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          email,
          google_id: googleId,
          name: displayName || email.split("@")[0],
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("User creation error:", error);
        return res.status(500).json({ error: "Failed to create user" });
      }
      user = newUser;
    } else if (user.google_id && user.google_id !== googleId) {
      return res.status(401).json({ error: "Google account mismatch" });
    } else if (!user.google_id) {
      // Update existing user with Google ID
      const updates = { google_id: googleId };
      if (!user.name && displayName) {
        updates.name = displayName;
      }

      const { data: updatedUser, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

      if (error) {
        console.error("User update error:", error);
        return res.status(500).json({ error: "Failed to update user" });
      }
      user = updatedUser;
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
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
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, name, google_id, created_at")
      .eq("id", req.user.id)
      .single();

    if (error || !user) {
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

    const { data: user, error } = await supabase
      .from("users")
      .delete()
      .eq("id", req.user.id)
      .select()
      .single();

    if (error || !user) {
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
