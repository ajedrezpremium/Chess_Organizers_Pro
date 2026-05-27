import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { I18nProvider } from './i18n/context.jsx';
import App from './App.jsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        let reloadDialogShown = false;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            if (!reloadDialogShown) {
              reloadDialogShown = true;
              // Dispatch event for UI to show update prompt
              window.dispatchEvent(new CustomEvent('sw-update', { detail: { registration: reg } }));
            }
          }
        });
      });
    } catch (err) {
      console.warn('SW registration failed:', err);
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
