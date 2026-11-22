import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/nunito-sans/latin-400.css';
import '@fontsource/nunito-sans/latin-800.css';
import '@fontsource/nunito-sans/latin-ext-400.css';
import '@fontsource/nunito-sans/latin-ext-800.css';
import './views/editor.css';
import ReaderView from './views/ReaderView';
import { paginate } from './services/pagination';
import { parseReaderDocument, type ReaderDocument } from './models/reader';
import type { LayoutDiagnostics } from './services/layoutVerification';

function installGlobalInputPolicy() {
  document.addEventListener('contextmenu', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  const blockRightButton = (event: PointerEvent | MouseEvent) => {
    if (event.button !== 2) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  document.addEventListener('pointerdown', blockRightButton, true);
  document.addEventListener('pointerup', blockRightButton, true);
  document.addEventListener('mousedown', blockRightButton, true);
  document.addEventListener('mouseup', blockRightButton, true);
  document.addEventListener('auxclick', blockRightButton, true);

  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

installGlobalInputPolicy();

declare global {
  interface Window {
    renderProject: (project: unknown) => Promise<string>;
    reader: { document: ReaderDocument; signature: string; diagnostics: LayoutDiagnostics };
    renderDiagnostics?: LayoutDiagnostics;
  }
}
if (['/render', '/render.html'].includes(location.pathname)) {
  document.body.className = 'export-mode';
  window.renderProject = async input => {
    const result = await paginate(parseReaderDocument(input));
    document.getElementById('root')!.replaceChildren(...result.pages);
    window.renderDiagnostics = result.diagnostics;
    return result.signature;
  };
} else createRoot(document.getElementById('root')!).render(<React.StrictMode><ReaderView /></React.StrictMode>);
