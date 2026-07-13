import express from 'express';

const app = express();

app.get('*', (req, res) => {
  res.json({
    ok: true,
    path: req.path,
    env: process.env.NODE_ENV,
    hasDbUrl: !!process.env.DATABASE_URL,
  });
});

export default app;
