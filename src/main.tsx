import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './editor/App';
import './styles.css';
import { initializePersistence } from './persistence/session';

void initializePersistence().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
