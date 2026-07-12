module.exports = function handler(req, res) {
  res.json({ pong: true, cjs: true, path: req.url });
};
