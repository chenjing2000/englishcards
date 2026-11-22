import { useEffect, useRef, useState } from 'react';
import type { ReaderDocument } from '../models/reader';
import { paginate, type Layout } from '../services/pagination';
import { isDesktop } from '../services/desktopBridge';
import { lastCardLibrary } from '../services/cardLibraryIO';
import { openScriptFile } from '../services/readerIO';

/** Owns the read-only document session; page navigation and DOM remain in the view. */
export function useReaderViewModel() {
  const [root, setRoot] = useState('');
  const [revision, setRevision] = useState(0);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [document, setDocument] = useState<ReaderDocument>();
  const [layout, setLayout] = useState<Layout>();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const opening = useRef(0);
  const reportError = (source: string, text: string) => setMessages(previous => ({ ...previous, [source]: text }));
  useEffect(() => {
    let current = true;
    if (isDesktop()) void lastCardLibrary().then(path => { if (current) setRoot(path); }).catch(reason => { if (current) reportError('library', String(reason)); });
    return () => { current = false; opening.current++; };
  }, []);
  async function open(path: string) {
    const generation = ++opening.current;
    try {
      const loaded = await openScriptFile(path);
      const nextLayout = await paginate(loaded.document);
      if (generation !== opening.current) return;
      setDocument(loaded.document); setLayout(nextLayout); setActivePath(loaded.path);
      setMessages({ companions: loaded.notices.join('\n') });
      window.reader = { document: loaded.document, signature: nextLayout.signature, diagnostics: nextLayout.diagnostics };
    } catch (reason) { if (generation === opening.current) reportError('open', `无法打开 Script：${String(reason)}`); }
  }
  function changeLibraryRoot(path: string) { setRoot(path); setRevision(value => value + 1); }
  return { root, revision, activePath, document, layout, messages, reportError, open, changeLibraryRoot };
}
