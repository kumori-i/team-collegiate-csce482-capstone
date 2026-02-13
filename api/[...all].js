module.exports = async (req, res) => {
  const { default: app } = await import("../backend/index.js");
  return app(req, res);
};
