// backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, ".env");
const envLocalPath = path.resolve(__dirname, ".env.local");
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath, override: true });

const app = express();

// CORS configuration - allow requests from React dev server
// In development, allow all origins for easier debugging
const corsOptions =
  process.env.NODE_ENV === "production"
    ? {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      }
    : {
        origin: true, // Allow all origins in development
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      };

app.use(cors(corsOptions));

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

app.use(express.json());

const { default: authRoutes } = await import("./routes/auth.js");
const { default: chatRoutes } = await import("./routes/chat.js");
const { default: playerRoutes } = await import("./routes/players.js");

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/players", playerRoutes);

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API endpoint: http://localhost:${PORT}/api/auth`);
  });
});
