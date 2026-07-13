import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests' } }));

app.get('/health', (req, res) => res.json({ status: 'ok', msg: 'full-middleware-test', hasJwt: !!process.env.JWT_SECRET }));
app.get('*', (req, res) => res.json({ path: req.path, method: req.method }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });

export default app;
