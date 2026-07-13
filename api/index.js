// Phase 1: only test config import
import express from 'express';
const app = express();

app.get('/health', async (req, res) => {
  try {
    const config = await import('./src/config.js');
    res.json({ status: 'ok', nodeEnv: config.default.nodeEnv, hasJwt: !!config.default.jwt.secret });
  } catch (e) {
    res.json({ status: 'error', phase: 'config', msg: e.message });
  }
});

app.get('*', (req, res) => res.json({ path: req.path }));
export default app;
