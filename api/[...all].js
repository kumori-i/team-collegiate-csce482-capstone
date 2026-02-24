module.exports = async (req, res) => {
  // Ensure Express sees the same `/api/...` paths in Vercel as local dev.
  if (typeof req.url === "string" && !req.url.startsWith("/api/")) {
    req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
  }
  const { default: app } = await import("../backend/index.js");
  return app(req, res);
};
