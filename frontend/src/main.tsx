import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { syncManager } from './lib/sync';
import './styles/index.css';

syncManager.init();

// The service worker is only registered for production builds so development never serves stale files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
