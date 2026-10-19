import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import '@fontsource-variable/jetbrains-mono';
import './index.css';
import { installInteractionSounds } from './lib/sounds';

installInteractionSounds();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
