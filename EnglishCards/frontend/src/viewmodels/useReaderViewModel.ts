import { useEffect, useRef, useState } from 'react';
import type { ReaderDocument } from '../models/reader';
import { parseVocabulary } from '../models/reader';
import { settingsSchema, type Styles } from '../models/settings';
import { paginate, type Layout } from '../services/pagination';
import { isDesktop } from '../services/desktopBridge';
import { lastCardLibrary, sameLibraryPath, type LibraryDirectory } from '../services/cardLibraryIO';
import { addVocabularyWord, openScriptFile, saveScriptSettings, type LoadedScript } from '../services/readerIO';

/** Owns one Script session and its active companion file identity. */
export function useReaderViewModel() {
  const [root, setRoot] = useState('');
  const [rootContents, setRootContents] = useState<LibraryDirectory>();
  const [revision, setRevision] = useState(0);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [document, setDocument] = useState<ReaderDocument>();
  const [layout, setLayout] = useState<Layout>();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const libraryGeneration = useRef(0);
  const renderedLibrary = libraryGeneration.current;
  const opening = useRef(0);
  const currentPath = useRef<string | null>(null);
  const currentFiles = useRef<LoadedScript | null>(null);
  const pending = useRef(false);
  const savingRef = useRef(false);
  const reportError = (source: string, text: string) => {
    if (renderedLibrary === libraryGeneration.current) setMessages(previous => ({ ...previous, [source]: text }));
  };
  useEffect(() => {
    let current = true;
    const generation = libraryGeneration.current;
    if (isDesktop()) void lastCardLibrary().then(path => {
      if (current && generation === libraryGeneration.current) setRoot(path);
    }).catch(reason => { if (current && generation === libraryGeneration.current) reportError('library', String(reason)); });
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
      currentPath.current = loaded.path; currentFiles.current = loaded;
      setDocument(loaded.document); setLayout(nextLayout); setActivePath(loaded.path);
      setMessages({ companions: loaded.notices.join('\n') });
      window.reader = { document: loaded.document, signature: nextLayout.signature, diagnostics: nextLayout.diagnostics };
    } catch (reason) { if (generation === opening.current) reportError('open', '无法打开 Script：' + String(reason)); }
    finally { if (generation === opening.current) pending.current = false; }
  }
  async function addWord(word: string, meaning: string, partOfSpeech: string): Promise<boolean> {
    if (savingRef.current || !currentFiles.current) return false;
    const source = currentFiles.current, generation = opening.current;
    savingRef.current = true; setSaving(true);
    try {
      const saved = await addVocabularyWord({
        scriptPath: source.path, vocabularyPath: source.vocabularyPath, expectedText: source.vocabularyText,
        word, meaning, partOfSpeech,
      });
      if (generation !== opening.current || currentFiles.current !== source) return false;
      const vocabulary = parseVocabulary(JSON.parse(saved.text));
      const nextDocument = { ...source.document, vocabulary };
      const nextLayout = await paginate(nextDocument);
      if (generation !== opening.current || currentFiles.current !== source) return false;
      const nextFiles = { ...source, document: nextDocument, vocabularyPath: saved.path, vocabularyText: saved.text };
      currentFiles.current = nextFiles;
      setDocument(nextDocument); setLayout(nextLayout);
      setMessages(previous => ({ ...previous, vocabulary: '生词已保存到 ' + saved.path }));
      window.reader = { document: nextDocument, signature: nextLayout.signature, diagnostics: nextLayout.diagnostics };
      return true;
    } catch (reason) {
      if (generation === opening.current) reportError('vocabulary', '保存生词失败：' + String(reason));
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  }
  async function saveStyles(styles: Styles): Promise<boolean> {
    if (savingRef.current || !currentFiles.current || !currentFiles.current.settingsValid) {
      reportError('settings', '当前正在保存，或设置文件无效；请修复并重新打开 Script。');
      return false;
    }
    const source = currentFiles.current, generation = opening.current;
    savingRef.current = true; setSaving(true);
    try {
      const checked = settingsSchema.parse(styles);
      // Prepare pagination first; never commit an impossible page geometry.
      const nextDocument = { ...source.document, styles: checked };
      const nextLayout = await paginate(nextDocument);
      if (generation !== opening.current || currentFiles.current !== source) return false;
      const saved = await saveScriptSettings({
        scriptPath: source.path, expectedText: source.settingsText,
        text: JSON.stringify(checked, null, 2) + '\n',
      });
      if (generation !== opening.current || currentFiles.current !== source) return false;
      currentFiles.current = { ...source, document: nextDocument, settingsText: saved.text };
      setDocument(nextDocument); setLayout(nextLayout);
      setMessages(previous => ({ ...previous, settings: '设置已保存。' }));
      window.reader = { document: nextDocument, signature: nextLayout.signature, diagnostics: nextLayout.diagnostics };
      return true;
    } catch (reason) {
      if (generation === opening.current) reportError('settings', '保存设置失败：' + String(reason));
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  }
  function directoryLoaded(contents: LibraryDirectory) {
    if (renderedLibrary === libraryGeneration.current && !currentPath.current && !pending.current && contents.files.length === 1)
      void open(contents.files[0].path);
  }
  function changeLibraryRoot(path: string, contents: LibraryDirectory) {
    if (!sameLibraryPath(root, path)) {
      libraryGeneration.current++; opening.current++; pending.current = false;
      currentPath.current = null; currentFiles.current = null;
      setActivePath(null); setDocument(undefined); setLayout(undefined); setMessages({});
      Reflect.deleteProperty(window, 'reader'); setRoot(path);
    }
    setRootContents(contents); setRevision(value => value + 1);
  }
  return { root, rootContents, revision, directoryLoaded, activePath, document, layout, messages,
    reportError, open, changeLibraryRoot, addWord, saveStyles, saving, settingsValid: currentFiles.current?.settingsValid ?? true };
}
