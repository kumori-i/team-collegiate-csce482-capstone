// backend/routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { authenticateToken } from "../middleware/auth.js";
import {
  createUser,
  deleteUserById,
  findUserByEmail,
  getUserById,
  updateUserById,
} from "../services/database.js";

const router = express.Router();
const getGoogleClient = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and account management endpoints.
 */

// Register
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error or already registered
 *       500:
 *         description: Registration failed
 */
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
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const derivedName = name || email.split("@")[0];

    await createUser({
        email,
        password_hash: hash,
        name: derivedName,
        created_at: new Date().toISOString(),
      });
    res.status(201).json({ message: "User created" });
  } catch (err) {
    console.error("Registration error:", err);
    if (err?.code === "DUPLICATE_EMAIL") {
        return res.status(400).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// Login
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login succeeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Login failed
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await findUserByEmail(email);
    if (!user) {
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
/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with Google ID token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login succeeded
 *       400:
 *         description: Missing or invalid token payload
 *       401:
 *         description: Google authentication failed
 *       500:
 *         description: Server misconfiguration or user persistence failure
 */
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
    let user = await findUserByEmail(email);

    if (!user) {
      user = await createUser({
          email,
          google_id: googleId,
          name: displayName || email.split("@")[0],
          created_at: new Date().toISOString(),
        });
    } else if (user.google_id && user.google_id !== googleId) {
      return res.status(401).json({ error: "Google account mismatch" });
    } else if (!user.google_id) {
      // Update existing user with Google ID
      const updates = { google_id: googleId };
      if (!user.name && displayName) {
        updates.name = displayName;
      }

      user = await updateUserById(user.id, updates);
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
/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 *       401:
 *         description: Access token required
 *       403:
 *         description: Invalid or expired token
 *       404:
 *         description: User not found
 */
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const { id, email, name, google_id, created_at } = user;
    res.json({ id, email, name, google_id, created_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user account
/**
 * @swagger
 * /api/auth/account:
 *   delete:
 *     tags: [Auth]
 *     summary: Delete the current user's account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 *       401:
 *         description: Access token required
 *       403:
 *         description: Invalid or expired token
 *       404:
 *         description: User not found
 */
router.delete("/account", authenticateToken, async (req, res) => {
  try {
    console.log("Delete account request for user:", req.user.id);
    const user = await getUserById(req.user.id);
    if (!user) {
      console.log("User not found for deletion:", req.user.id);
      return res.status(404).json({ error: "User not found" });
    }
    await deleteUserById(req.user.id);
    console.log("Account deleted successfully:", user.email);
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
