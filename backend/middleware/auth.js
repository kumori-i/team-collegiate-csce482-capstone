import jwt from "jsonwebtoken";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader && String(authHeader).split(" ")[1];

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

export const getOptionalUserId = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader && String(authHeader).split(" ")[1];
  if (!token) {
    return "";
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return typeof decoded?.id === "string" ? decoded.id : "";
  } catch {
    return "";
  }
};
