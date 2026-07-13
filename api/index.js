let app;
try {
  const mod = await import('./src/index.js');
  app = mod.default;
} catch (e) {
  console.error('MODULE LOAD ERROR:', e.message);
  console.error(e.stack?.split('\n').slice(0,6).join('\n'));
  const express = (await import('express')).default;
  app = express();
  app.get('/health', (req, res) => res.json({ status: 'error', msg: e.message }));
  app.get('*', (req, res) => res.status(500).json({ error: 'Module load failed', detail: e.message }));
}
export default app;
