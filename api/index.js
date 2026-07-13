// Step 1: just test basic Express
import express from 'express';
const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok', test: 'basic-express' }));
app.get('*', (req, res) => res.json({ path: req.path }));
export default app;
