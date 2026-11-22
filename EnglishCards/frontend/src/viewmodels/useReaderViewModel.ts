import { useEffect, useRef, useState } from 'react';
import type { ReaderDocument } from '../models/reader';
import { paginate, type Layout } from '../services/pagination';
import { isDesktop } from '../services/desktopBridge';
import { lastCardLibrary, sameLibraryPath, type LibraryDirectory } from '../services/cardLibraryIO';
import { openScriptFile } from '../services/readerIO';

/** Owns the read-only document session; page navigation and DOM remain in the view. */
export function useReaderViewModel() {
  const [root, setRoot] = useState('');
  const [rootContents, setRootContents] = useState<LibraryDirectory>();
  const [revision, setRevision] = useState(0);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [document, setDocument] = useState<ReaderDocument>();
  const [layout, setLayout] = useState<Layout>();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const libraryGeneration = useRef(0);
  const renderedLibrary = libraryGeneration.current;
  const opening = useRef(0);
  const currentPath = useRef<string | null>(null);
  const pending = useRef(false);
  const reportError = (source: string, text: string) => {
    if (renderedLibrary === libraryGeneration.current) setMessages(previous => ({ ...previous, [source]: text }));
  };
  useEffect(() => {
    let current = true;
    const generation = libraryGeneration.current;
    if (isDesktop()) void lastCardLibrary().then(path => { if (current && generation === libraryGeneration.current) setRoot(path); }).catch(reason => { if (current && generation === libraryGeneration.current) reportError('library', String(reason)); });
    return () => { current = false; opening.current++; };
  }, []);
  async function open(path: string) {
    const generation = ++opening.current;
    if (sameLibraryPath(path, currentPath.current)) { pending.current = false; return; }
    pending.current = true;
    try {
      const loaded = await openScriptFile(path);
      if (generation !== opening.current) return;
      const nextLayout = await paginate(loaded.document);
      if (generation !== opening.current) return;
      currentPath.current = loaded.path;
      setDocument(loaded.document); setLayout(nextLayout); setActivePath(loaded.path);
      setMessages({ companions: loaded.notices.join('\n') });
      window.reader = { document: loaded.document, signature: nextLayout.signature, diagnostics: nextLayout.diagnostics };
    } catch (reason) { if (generation === opening.current) reportError('open', `无法打开 Script：${String(reason)}`); }
    finally { if (generation === opening.current) pending.current = false; }
  }
  function directoryLoaded(contents: LibraryDirectory) {
    if (renderedLibrary === libraryGeneration.current && !currentPath.current && !pending.current && contents.files.length === 1) void open(contents.files[0].path);
  }
  function changeLibraryRoot(path: string, contents: LibraryDirectory) {
    if (!sameLibraryPath(root, path)) {
      libraryGeneration.current++;
      opening.current++;
      pending.current = false;
      currentPath.current = null;
      setActivePath(null); setDocument(undefined); setLayout(undefined); setMessages({});
      Reflect.deleteProperty(window, 'reader');
      setRoot(path);
    }
    setRootContents(contents);
    setRevision(value => value + 1);
  }
  return { root, rootContents, revision, directoryLoaded, activePath, document, layout, messages, reportError, open, changeLibraryRoot };
}
