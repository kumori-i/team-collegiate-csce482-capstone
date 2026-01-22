// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["scout", "coach"], default: "scout" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
