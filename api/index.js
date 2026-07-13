export default function handler(req, res) {
  const body = JSON.stringify({
    status: 'ok',
    phase: '3-raw-handler',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not-set',
      hasJwtSecret: !!process.env.JWT_SECRET,
      jwtPreview: process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 8) + '...' : 'missing',
      hasDbUrl: !!process.env.DATABASE_URL,
      nodeVersion: process.version,
    },
  });
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(body);
}
