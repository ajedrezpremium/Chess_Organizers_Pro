// Phase 6: CJS entry point (no type:module in package.json)
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', phase: '6-cjs-entry', jwt: !!process.env.JWT_SECRET });
});

app.get('*', (req, res) => res.json({ path: req.path }));

module.exports = app;
