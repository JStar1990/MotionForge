import React from 'react';
import ReactDOM from 'react-dom/client';
import { Workspace } from './editor/Workspace';
import './styles.css';
import { initializePersistence } from './persistence/session';

void initializePersistence().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Workspace />
    </React.StrictMode>,
  );
});
