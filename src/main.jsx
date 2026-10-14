import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initTelemetry } from './lib/telemetry.js';
import { useStore } from './store/useStore.js';
import './index.css';

initTelemetry(() => useStore.getState().user?.id || null);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
