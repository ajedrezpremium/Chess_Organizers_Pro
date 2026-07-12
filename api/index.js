import express from 'express';
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'none' });
});

app.get('*', (req, res) => {
  res.json({ path: req.path, method: req.method, url: req.url });
});

export default app;
