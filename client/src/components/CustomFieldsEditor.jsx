import { useState } from 'react';

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Teléfono' },
  { value: 'date', label: 'Fecha' },
  { value: 'select', label: 'Selección' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'checkbox', label: 'Casilla' },
];

export default function CustomFieldsEditor({ fields = [], onChange }) {
  const [local, setLocal] = useState(() => fields.length > 0 ? fields : []);

  const update = (newFields) => {
    setLocal(newFields);
    onChange(newFields);
  };

  const add = () => {
    const newField = { key: `field_${Date.now()}`, label: '', type: 'text', required: false, placeholder: '', options: [] };
    update([...local, newField]);
  };

  const remove = (idx) => {
    update(local.filter((_, i) => i !== idx));
  };

  const move = (idx, dir) => {
    const newArr = [...local];
    const target = idx + dir;
    if (target < 0 || target >= newArr.length) return;
    [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
    update(newArr);
  };

  const setField = (idx, key, value) => {
    const newArr = local.map((f, i) => i === idx ? { ...f, [key]: value } : f);
    update(newArr);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-fide-400">Campos personalizados del formulario de inscripción</p>
        <button onClick={add} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1 rounded text-xs font-medium transition">
          + Añadir campo
        </button>
      </div>

      {local.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-fide-500 italic">Sin campos personalizados. Los jugadores verán el formulario estándar.</p>
      )}

      {local.map((field, idx) => (
        <div key={field.key} className="bg-gray-50 dark:bg-fide-900 border dark:border-fide-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-white disabled:opacity-30 text-xs p-0.5">▲</button>
              <button onClick={() => move(idx, 1)} disabled={idx === local.length - 1} className="text-gray-400 hover:text-white disabled:opacity-30 text-xs p-0.5">▼</button>
              <span className="text-xs font-medium text-gray-500 dark:text-fide-400 ml-1">#{idx + 1}</span>
            </div>
            <button onClick={() => remove(idx)} className="text-red-500 hover:text-red-400 text-xs">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Clave</label>
              <input value={field.key} onChange={(e) => setField(idx, 'key', e.target.value)}
                placeholder="mi_campo"
                className="w-full border dark:border-fide-600 rounded px-2 py-1 text-xs bg-white dark:bg-fide-700 dark:text-white outline-none font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Etiqueta</label>
              <input value={field.label} onChange={(e) => setField(idx, 'label', e.target.value)}
                placeholder="Mi campo"
                className="w-full border dark:border-fide-600 rounded px-2 py-1 text-xs bg-white dark:bg-fide-700 dark:text-white outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Tipo</label>
              <select value={field.type} onChange={(e) => setField(idx, 'type', e.target.value)}
                className="w-full border dark:border-fide-600 rounded px-2 py-1 text-xs bg-white dark:bg-fide-700 dark:text-white outline-none">
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Placeholder</label>
              <input value={field.placeholder || ''} onChange={(e) => setField(idx, 'placeholder', e.target.value)}
                className="w-full border dark:border-fide-600 rounded px-2 py-1 text-xs bg-white dark:bg-fide-700 dark:text-white outline-none" />
            </div>
          </div>
          {field.type === 'select' && (
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Opciones (separadas por coma)</label>
              <input value={(field.options || []).join(', ')} onChange={(e) => setField(idx, 'options', e.target.value.split(',').map((o) => o.trim()).filter(Boolean))}
                placeholder="Opción 1, Opción 2, Opción 3"
                className="w-full border dark:border-fide-600 rounded px-2 py-1 text-xs bg-white dark:bg-fide-700 dark:text-white outline-none" />
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-fide-400">
            <input type="checkbox" checked={field.required || false} onChange={(e) => setField(idx, 'required', e.target.checked)}
              className="rounded border-gray-300 dark:border-fide-600" />
            Obligatorio
          </label>
        </div>
      ))}
    </div>
  );
}
