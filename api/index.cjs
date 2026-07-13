async function loadApp() {
  const mod = await import('../server/src/index.js');
  return mod.default;
}

module.exports = async (req, res) => {
  try {
    const app = await loadApp();
    app(req, res);
  } catch (err) {
    console.error('Handler error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};
