import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { preloadSymbolImages } from './components/assets';
import '@fontsource/cinzel/700.css';
import '@fontsource/lilita-one/latin-400.css';
import './app/styles.css';

preloadSymbolImages();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
