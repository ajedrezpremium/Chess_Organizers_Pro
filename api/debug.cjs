module.exports = function handler(req, res) {
  res.json({ env: process.env.NODE_ENV || 'not-set', cwd: process.cwd() });
};
