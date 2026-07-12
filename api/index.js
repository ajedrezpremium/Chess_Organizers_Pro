export default function handler(req, res) {
  res.json({ status: 'ok', path: req.url, method: req.method });
}
