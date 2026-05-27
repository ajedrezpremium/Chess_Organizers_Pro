import { useState } from 'react';

export default function QRCode({ url, size = 128 }) {
  const [show, setShow] = useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  return (
    <div className="relative">
      <button onClick={() => setShow(!show)}
        className="border dark:border-fide-600 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 transition flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
        QR
      </button>
      {show && (
        <div className="absolute right-0 mt-2 bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl shadow-xl z-50 p-3 animate-fadeIn"
          onClick={() => setShow(false)}>
          <img src={qrUrl} alt="QR Code" width={size} height={size} className="rounded-lg" />
        </div>
      )}
    </div>
  );
}
