// backend/index.js
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";

app.use("/api/auth", authRoutes);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

app.listen(5000, () => console.log("Backend running on port 5000"));
