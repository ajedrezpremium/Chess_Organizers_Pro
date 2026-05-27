/**
 * Middleware de validación simple.
 * Uso: validate({ name: 'string', email: 'email', age: 'number' })
 */

const VALIDATORS = {
  string: (v) => typeof v === 'string' && v.trim().length > 0,
  email:  (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  number: (v) => typeof v === 'number' || (!isNaN(v) && !isNaN(parseFloat(v))),
  integer:(v) => Number.isInteger(v) || (typeof v === 'string' && /^\d+$/.test(v)),
  boolean:(v) => typeof v === 'boolean' || v === 'true' || v === 'false',
  date:   (v) => !isNaN(Date.parse(v)),
  array:  (v) => Array.isArray(v),
  object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
  any:    () => true,
};

export function validate(rules) {
  return (req, res, next) => {
    const errors = [];
    const data = req.method === 'GET' ? req.query : req.body;

    for (const [field, rule] of Object.entries(rules)) {
      let type, required = false, min, max;

      if (typeof rule === 'string') {
        type = rule;
      } else {
        type = rule.type ?? 'any';
        required = rule.required ?? false;
        min = rule.min;
        max = rule.max;
      }

      const value = data[field];
      const hasValue = value !== undefined && value !== null && value !== '';

      if (required && !hasValue) {
        errors.push(`${field}: obligatorio`);
        continue;
      }

      if (!hasValue) continue;

      const validator = VALIDATORS[type];
      if (!validator || !validator(value)) {
        errors.push(`${field}: debe ser tipo ${type}`);
        continue;
      }

      if (type === 'string') {
        const str = String(value);
        if (min != null && str.length < min) errors.push(`${field}: mínimo ${min} caracteres`);
        if (max != null && str.length > max) errors.push(`${field}: máximo ${max} caracteres`);
      }

      if ((type === 'number' || type === 'integer') && min != null && Number(value) < min) {
        errors.push(`${field}: mínimo ${min}`);
      }
      if ((type === 'number' || type === 'integer') && max != null && Number(value) > max) {
        errors.push(`${field}: máximo ${max}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', details: errors });
    }
    next();
  };
}

/**
 * Valida que existan en la BD (para IDs de referencia).
 */
export function exists(db, table, idField = 'id') {
  return (req, res, next) => {
    const id = parseInt(req.params[idField], 10);
    if (!id) return res.status(400).json({ error: `${idField} inválido` });

    const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: `${table.slice(0,-1)} no encontrado` });

    req.entity = row;
    next();
  };
}
