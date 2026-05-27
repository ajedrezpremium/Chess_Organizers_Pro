export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'danger', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white dark:bg-fide-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-2 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-fide-300 mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="border dark:border-fide-600 px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700">{cancelLabel}</button>
          <button onClick={() => { onConfirm(); onCancel(); }} className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
            variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-fide-700 hover:bg-fide-800'
          }`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
