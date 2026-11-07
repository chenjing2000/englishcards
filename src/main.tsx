import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/nunito-sans/latin-400.css';
import '@fontsource/nunito-sans/latin-800.css';
import '@fontsource/nunito-sans/latin-ext-400.css';
import '@fontsource/nunito-sans/latin-ext-800.css';
import './views/editor.css';
import EditorView from './views/EditorView';
import { paginate } from './services/pagination';
import { parseRenderProject, type RenderProject } from './models/project';
import type { LayoutDiagnostics } from './services/layoutVerification';

declare global {
  interface Window {
    renderProject: (project: unknown) => Promise<string>;
    editor: { project: RenderProject; signature: string; diagnostics: LayoutDiagnostics };
    renderDiagnostics?: LayoutDiagnostics;
  }
}
if (['/render', '/render.html'].includes(location.pathname)) {
  document.body.className = 'export-mode';
  window.renderProject = async input => {
    const result = await paginate(parseRenderProject(input));
    document.getElementById('root')!.replaceChildren(...result.pages);
    window.renderDiagnostics = result.diagnostics;
    return result.signature;
  };
} else createRoot(document.getElementById('root')!).render(<React.StrictMode><EditorView /></React.StrictMode>);
