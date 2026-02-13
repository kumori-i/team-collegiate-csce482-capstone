// backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

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

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Team Collegiate API",
      version: "1.0.0",
      description: "Backend API documentation for Team Collegiate.",
    },
    tags: [
      { name: "Auth", description: "Authentication and account management." },
      { name: "Chat", description: "Direct chat completion endpoint." },
      { name: "Players", description: "Player data and report generation." },
      { name: "Scouting", description: "Scouting report generation." },
      { name: "Agent", description: "Agent orchestration endpoints." },
      { name: "System", description: "Service health and diagnostics." },
    ],
    servers: [
      {
        url:
          process.env.BACKEND_URL ||
          `http://localhost:${process.env.PORT || 5001}`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
            },
          },
          required: ["error"],
        },
      },
    },
  },
  apis: [path.join(__dirname, "routes/*.js"), path.join(__dirname, "index.js")],
});

app.use("/api/docs", swaggerUi.serve);
app.get("/api/docs", swaggerUi.setup(swaggerSpec));
app.get("/api/docs/", swaggerUi.setup(swaggerSpec));

const { default: authRoutes } = await import("./routes/auth.js");
const { default: chatRoutes } = await import("./routes/chat.js");
const { default: playerRoutes } = await import("./routes/players.js");
const { default: scoutingRoutes } = await import("./routes/scouting.js");
const { default: agentRoutes } = await import("./routes/agent.js");

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/scouting", scoutingRoutes);
app.use("/api/agent", agentRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 5001;

if (process.env.VERCEL !== "1") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API endpoint: http://localhost:${PORT}/api/auth`);
    console.log(`Swagger docs: http://localhost:${PORT}/api/docs`);
    console.log("Using Supabase for database");
  });
}

export default app;
