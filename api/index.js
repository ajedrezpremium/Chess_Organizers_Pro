import app from '../server/src/index.js';

export default async function handler(req, res) {
  return app(req, res);
}
