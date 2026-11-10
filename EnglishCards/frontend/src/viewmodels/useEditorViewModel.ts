import { flushSync } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  appendParagraph, commitEntryHead, defaults, editParagraph, emptySense, parseHighlightInput,
  addVocabulary, isValidVocabularySelection, newId, removeEntrySense, removeVocabulary, renumberVocabulary, replaceArticleParagraphs, setArticleText,
  splitSenseMeaning, toggleHighlight, vocabularyId, type EntryCollection,
  projectDocument, styleSchema, type RenderProject, type Project, type Sense, type Styles,
} from '../models/project';
import { paginate, type Layout } from '../services/pagination';
import {
  cacheDraft, download, loadDesktopData, loadSettings, readSettingsFile, saveSettings,
  openProject, saveProject, requestExport, restoreDraft, sampleDraft,
  type DesktopPersistence, type DesktopSaveResult,
} from '../services/projectIO';
import { desktopRequest, isDesktop } from '../services/desktopBridge';

type ParagraphCollection = 'content' | 'translation';
const stringify = (project: Project) => JSON.stringify(projectDocument(project), null, 2);

export function useEditorViewModel() {
  const desktop = isDesktop();
  const [boot, setBoot] = useState(desktop ? sampleDraft : restoreDraft);
  const [project, setProject] = useState<RenderProject>({ ...boot.project, styles: { ...defaults } });
  const [wordDrafts, setWordDrafts] = useState<Record<string, string>>({});
  const previewProject = useMemo<RenderProject>(() => {
    let changed = false;
    const vocabulary = project.vocabulary.map(entry => {
      if (!Object.prototype.hasOwnProperty.call(wordDrafts, entry.id)) return entry;
      const word = wordDrafts[entry.id];
      if (word === entry.word) return entry;
      changed = true;
      return { ...entry, word };
    });
    return changed ? { ...project, vocabulary } : project;
  }, [project, wordDrafts]);
  const [vocabularySelection, setVocabularySelection] = useState<string | null>(null);
  const vocabularyIndex = project.vocabulary.findIndex(entry => entry.id === vocabularySelection);
  const selectedVocabularyIndex = vocabularyIndex >= 0 ? vocabularyIndex : project.vocabulary.length ? 0 : -1;
  const selectedVocabulary = project.vocabulary[selectedVocabularyIndex];
  const [errors, setErrors] = useState<Record<string, string>>({});
  const error = Object.values(errors)[0] ?? '';
  const [warning, setWarning] = useState<{ text: string } | null>(null);
  function reportError(source: string, text: string) {
    setErrors(current => {
      if ((current[source] ?? '') === text) return current;
      const next = { ...current };
      if (text) next[source] = text; else delete next[source];
      return next;
    });
  }
  function showWarning(text: string) { setWarning({ text }); }
  useEffect(() => {
    if (!warning) return;
    const timer = setTimeout(() => setWarning(current => current === warning ? null : current), 10000);
    return () => clearTimeout(timer);
  }, [warning]);
  useEffect(() => {
    if (boot.rejected && !boot.cacheBlocked) showWarning(boot.notice);
  }, []);
  const [lastFile, setLastFile] = useState('');
  const [rendered, setRendered] = useState<{ project: RenderProject; layout: Layout } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const preparingClose = useRef(false);
  const openRequest = useRef(0);
  const openedFile = useRef(0);
  const saving = useRef(false);
  const importingSettings = useRef(false);
  const desktopStore = useRef<DesktopPersistence | null>(null);
  const desktopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ project, opening });
  useLayoutEffect(() => { latest.current = { project, opening }; }, [project, opening]);
  const [settingsReady, setSettingsReady] = useState(false);
  const savedSettings = useRef('');
  const settingsQueue = useRef(Promise.resolve());
  const pendingSettingsSaves = useRef(0);
  const settingsRevision = useRef(0);
  const ready = settingsReady && !opening && rendered?.project === previewProject;
  const hasFileChanges = lastFile !== stringify(project);

  function update(next: Project | ((current: RenderProject) => Project)) {
    setProject(current => {
      const result = typeof next === 'function' ? next(current) : next;
      if (result === current) return current;
      return { ...result, styles: 'styles' in result ? (result as RenderProject).styles : current.styles };
    });
  }

  useEffect(() => {
    let cancelled = false;
    if (desktop) {
      loadDesktopData().then(result => {
        if (cancelled) return;
        desktopStore.current = result.persistence;
        setBoot(result.draft);
        setProject({ ...result.draft.project, styles: result.settings });
        savedSettings.current = JSON.stringify(result.settings);
        if (result.notice) showWarning(result.notice);
        setSettingsReady(true);
      }).catch(reason => {
        if (!cancelled) reportError('settings-load', `本机数据读取失败：${String(reason)}`);
      });
      return () => { cancelled = true; };
    }
    loadSettings().then(result => {
      if (cancelled) return;
      const styles = styleSchema.parse(result.settings);
      savedSettings.current = JSON.stringify(styles);
      setProject(current => ({ ...current, styles }));
      if (result.error) showWarning(result.error);
      setSettingsReady(true);
    }).catch(reason => {
      if (!cancelled) reportError('settings-load', `配置读取失败：${String(reason)}。请刷新重试。`);
    });
    return () => { cancelled = true; };
  }, [desktop]);

  useEffect(() => {
    if (desktop || !settingsReady) return;
    const revision = ++settingsRevision.current;
    const parsed = styleSchema.safeParse(project.styles);
    if (!parsed.success) {
      reportError('settings-validation', `配置无效，未保存：${parsed.error.issues.map(issue => issue.message).join(' ')}`);
      return;
    }
    reportError('settings-validation', '');
    const serialized = JSON.stringify(parsed.data);
    if (serialized === savedSettings.current && pendingSettingsSaves.current === 0) {
      reportError('settings-save', '');
      return;
    }
    const timer = setTimeout(() => {
      pendingSettingsSaves.current++;
      settingsQueue.current = settingsQueue.current.then(async () => {
        try {
          if (revision !== settingsRevision.current) return;
          await saveSettings(parsed.data);
          savedSettings.current = serialized;
          if (revision === settingsRevision.current) reportError('settings-save', '');
        } catch (reason) {
          if (revision === settingsRevision.current) reportError('settings-save', `配置未保存：${String(reason)}`);
        } finally { pendingSettingsSaves.current--; }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [desktop, project.styles, settingsReady]);

  useEffect(() => {
    if (desktop) return;
    if (boot.cacheBlocked) {
      reportError('draft', '自动缓存已停用，旧草稿未覆盖，请保存 JSON。');
      return;
    }
    try {
      cacheDraft(project);
      reportError('draft', '');
    } catch {
      reportError('draft', '自动草稿保存失败！请立即下载 JSON 备份。');
    }
  }, [desktop, project]);

  function reportDesktopSave(result: DesktopSaveResult) {
    reportError('settings-save', result.settingsError);
    reportError('draft', result.draftError);
  }
  useEffect(() => {
    const store = desktopStore.current;
    if (!settingsReady || !store || preparingClose.current) return;
    let current = true;
    desktopTimer.current = setTimeout(() => {
      void store.save(project).then(result => { if (current) reportDesktopSave(result); });
    }, 300);
    return () => { current = false; clearTimeout(desktopTimer.current); };
  }, [project, settingsReady]);

  useLayoutEffect(() => {
    if (!desktop) return;
    const host = window as Window & { prepareClose?: () => Promise<{ pending: boolean; errors: string[]; busy?: boolean }> };
    host.prepareClose = async () => {
      if (preparingClose.current) return { pending: true, errors: [], busy: true };
      preparingClose.current = true;
      try {
        flushSync(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          setClosing(true);
        });
        if (latest.current.opening || saving.current || importingSettings.current) {
          return { pending: true, errors: [], busy: true };
        }
        clearTimeout(desktopTimer.current);
        const result = await desktopStore.current?.save(latest.current.project);
        if (!result) return { pending: false, errors: [] };
        reportDesktopSave(result);
        return { pending: result.pending, errors: [result.settingsError, result.draftError].filter(Boolean) };
      } finally {
        preparingClose.current = false;
        setClosing(false);
      }
    };
    return () => { delete host.prepareClose; };
  }, [desktop]);

  useEffect(() => {
    if (!settingsReady) return;
    const valid = styleSchema.safeParse(project.styles);
    if (!valid.success) { setRendered(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      paginate(previewProject).then(layout => {
        if (cancelled) return;
        setRendered({ project: previewProject, layout });
        window.editor = { project: previewProject, signature: layout.signature, diagnostics: layout.diagnostics };
        reportError('pagination', '');
        if (layout.warnings.length) showWarning(layout.warnings.join(' '));
      }).catch(reason => {
        if (!cancelled) reportError('pagination', `分页失败：${String(reason)}。请检查字号、边距或恢复模板默认。`);
      });
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [previewProject, settingsReady]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasFileChanges || pendingSettingsSaves.current > 0 ||
          (settingsReady && JSON.stringify(project.styles) !== savedSettings.current)) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasFileChanges, settingsReady, project.styles]);

  async function open(file?: File) {
    if (!file && !isDesktop()) return;
    const request = ++openRequest.current;
    setOpening(true);
    try {
      const next = await openProject(file);
      if (request !== openRequest.current || next === null) return;
      openedFile.current = request;
      setWordDrafts({});
      update(next);
      setLastFile(stringify(next));
      setVocabularySelection(null);
      reportError('import', '');
    } catch (reason) {
      if (request === openRequest.current) reportError('import', `无法打开文章：${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      if (request === openRequest.current) setOpening(false);
    }
  }

  async function save() {
    if (saving.current) return;
    saving.current = true;
    const previousOpen = openedFile.current;
    try {
      const pending = saveProject(project);
      const contents = typeof pending === 'string' ? pending : await pending;
      if (contents === null || previousOpen !== openedFile.current) return;
      setLastFile(contents);
      reportError('save', '');
    } catch (reason) {
      if (previousOpen === openedFile.current) reportError('save', `文章保存失败：${String(reason)}`);
    } finally { saving.current = false; }
  }

  async function exportImages() {
    if (!ready || exporting) return;
    setExporting(true);
    try {
      const outcome = await requestExport(project, rendered!.layout.signature, rendered!.layout.pages.length);
      if (outcome === false) showWarning('导出已取消。');
      reportError('export', '');
    } catch (reason) {
      reportError('export', `导出失败：${reason instanceof Error ? reason.message : String(reason)}`);
    } finally { setExporting(false); }
  }

  function setProjectText(key: 'title' | 'identityTag', value: string) {
    update(current => setArticleText(current, key, value));
  }
  function setParagraphText(key: ParagraphCollection, id: string, text: string) {
    update(current => editParagraph(current, id, text, key));
  }
  function setContinuousParagraphText(key: ParagraphCollection, value: string): boolean {
    try {
      const next = replaceArticleParagraphs(project, key, value);
      update(next);
      reportError('paragraph', '');
      return true;
    } catch (reason) {
      reportError('paragraph', `无法更新段落：${String(reason)}`);
      return false;
    }
  }
  function addParagraph(key: ParagraphCollection) {
    try {
      update(current => appendParagraph(current, key));
      reportError('paragraph', '');
    } catch (reason) {
      reportError('paragraph', `无法添加段落：${String(reason)}`);
    }
  }
  function highlightRange(paragraphIdValue: string, start: number, end: number) {
    if (start === end) { showWarning('请先在英文段落中选择要加入词汇的文字。'); return; }
    try {
      const next = toggleHighlight(project, paragraphIdValue, start, end);
      if (next === project) { showWarning('请选择有效的完整英文词汇或词组。'); return; }
      update(next);
    } catch (reason) { reportError('vocabulary', `加入词汇失败：${String(reason)}`); }
  }
  function addVocabularyFromSelection(paragraphIdValue: string, start: number, end: number) {
    const paragraph = project.content.paragraphs.find(item => item.id === paragraphIdValue);
    if (!paragraph || !isValidVocabularySelection(paragraph.text, start, end)) {
      showWarning('请选择同一自然段内完整的英文单词或词组。');
      return;
    }
    const selected = paragraph.text.slice(start, end);
    try {
      const next = addVocabulary(project, selected);
      if (next === project) {
        showWarning('该词汇或词组已经存在于 Vocabulary 中，无需重复添加。');
        return;
      }
      update(next);
      const normalized = selected.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
      const entry = next.vocabulary.find(item =>
        item.word.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en') === normalized
        || item.highlight.some(term => term.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en') === normalized));
      if (entry) setVocabularySelection(entry.id);
      reportError('vocabulary', '');
    } catch (reason) {
      reportError('vocabulary', `加入词汇失败：${String(reason)}`);
    }
  }
  function reorder(_key: EntryCollection, index: number, direction: number) {
    update(current => {
      const list = [...current.vocabulary];
      const destination = index + direction;
      if (destination < 0 || destination >= list.length) return current;
      [list[index], list[destination]] = [list[destination], list[index]];
      return { ...current, vocabulary: renumberVocabulary(list) };
    });
    const destination = index + direction;
    if (destination >= 0 && destination < project.vocabulary.length) {
      setVocabularySelection(vocabularyId(destination + 1));
    }
  }
  function setWordPreview(id: string, value: string | null) {
    setWordDrafts(current => {
      if (value === null) {
        if (!Object.prototype.hasOwnProperty.call(current, id)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      }
      return current[id] === value ? current : { ...current, [id]: value };
    });
  }

  function setEntryField(_key: EntryCollection, id: string, property: 'word' | 'ipa', value: string) {
    update(current => ({
      ...current,
      vocabulary: current.vocabulary.map(item => item.id === id ? { ...item, [property]: value } : item),
    }));
  }

  function setEntryHighlights(id: string, value: string) {
    update(current => ({
      ...current,
      vocabulary: current.vocabulary.map(item => item.id === id
        ? { ...item, highlight: parseHighlightInput(value, item.word) }
        : item),
    }));
  }
  function commitHead(_key: EntryCollection, id: string, value: string) {
    try {
      const next = commitEntryHead(project, 'vocabulary', id, value);
      if (next !== project) update(next);
      reportError('entry', '');
    } catch (reason) { reportError('entry', `词条保存失败：${String(reason)}`); }
  }
  function setSenseField(_key: EntryCollection, id: string, index: number, field: keyof Sense, value: string) {
    update(current => ({
      ...current,
      vocabulary: current.vocabulary.map(entry => entry.id === id
        ? { ...entry, senses: entry.senses.map((sense, i) => i === index ? { ...sense, [field]: value } : sense) }
        : entry),
    }));
  }
  function setVocabularyMeaning(id: string, index: number, value: string) {
    update(current => ({
      ...current,
      vocabulary: current.vocabulary.map(entry => entry.id === id
        ? { ...entry, senses: entry.senses.map((sense, i) => i === index ? { ...sense, ...splitSenseMeaning(value, sense.pos) } : sense) }
        : entry),
    }));
  }
  function addSense(_key: EntryCollection, id: string) {
    update(current => ({
      ...current,
      vocabulary: current.vocabulary.map(entry => entry.id === id
        ? { ...entry, senses: [...entry.senses, emptySense()] }
        : entry),
    }));
  }
  function removeSense(_key: EntryCollection, id: string, index: number) {
    update(current => removeEntrySense(current, 'vocabulary', id, index));
  }
  function addEntry(_key: EntryCollection = 'vocabulary') {
    if (project.vocabulary.length >= 999) {
      reportError('vocabulary', 'Vocabulary 最多允许 999 个条目。');
      return;
    }
    const entry = { id: vocabularyId(project.vocabulary.length + 1), word: '', ipa: '', highlight: [], senses: [emptySense()] };
    update(current => ({ ...current, vocabulary: [...current.vocabulary, entry] }));
    setVocabularySelection(entry.id);
  }
  function removeEntry(_key: EntryCollection, id: string) {
    update(current => removeVocabulary(current, id));
    setVocabularySelection(null);
  }
  function selectVocabulary(id: string) { setVocabularySelection(id); }
  function moveSelectedVocabulary(direction: number) {
    if (!selectedVocabulary) return;
    reorder('vocabulary', selectedVocabularyIndex, direction);
  }
  function deleteSelectedVocabulary() {
    if (!selectedVocabulary) return;
    const nextIndex = selectedVocabularyIndex < project.vocabulary.length - 1
      ? selectedVocabularyIndex
      : selectedVocabularyIndex - 1;
    removeEntry('vocabulary', selectedVocabulary.id);
    setVocabularySelection(nextIndex >= 0 ? vocabularyId(nextIndex + 1) : null);
  }
  function insertVocabularyBelow() {
    if (project.vocabulary.length >= 999) {
      reportError('vocabulary', 'Vocabulary 最多允许 999 个条目。');
      return '';
    }
    const index = project.vocabulary.findIndex(item => item.id === selectedVocabulary?.id);
    const insertAt = index < 0 ? project.vocabulary.length : index + 1;
    const entry = { id: vocabularyId(insertAt + 1), word: '', ipa: '', highlight: [], senses: [emptySense()] };
    update(current => {
      const vocabulary = [...current.vocabulary];
      vocabulary.splice(insertAt, 0, entry);
      return { ...current, vocabulary: renumberVocabulary(vocabulary) };
    });
    setVocabularySelection(entry.id);
    return entry.id;
  }
  function setStyle<K extends keyof Styles>(key: K, value: Styles[K]) {
    update(current => ({ ...current, styles: { ...current.styles, [key]: value } } as Project));
  }
  function replaceStyles(styles: Styles) {
    desktopStore.current?.replaceSettings();
    savedSettings.current = '';
    update(current => ({ ...current, styles: { ...styles } } as Project));
  }
  function resetStyles() { replaceStyles(defaults); }
  async function importSettings(file?: File) {
    if (!desktop || !file || importingSettings.current) return;
    importingSettings.current = true;
    try {
      replaceStyles(await readSettingsFile(file));
      reportError('settings-import', '');
    } catch (reason) {
      reportError('settings-import', `配置导入失败：${String(reason)}`);
    } finally { importingSettings.current = false; }
  }
  function clearError() {
    const source = Object.keys(errors)[0];
    if (source) reportError(source, '');
  }
  async function downloadRejectedDraft() {
    if (boot.desktopRejected) {
      try {
        await desktopRequest('saveRejectedDraft');
        reportError('draft-recovery', '');
      } catch (reason) { reportError('draft-recovery', `原始草稿另存失败：${String(reason)}`); }
    } else if (boot.rejected) {
      download(new Blob([boot.rejected], { type: 'text/plain' }), 'rejected-draft.txt');
    }
  }

  return {
    project, warning, error, settingsReady, ready, exporting, opening, desktop, closing,
    layout: rendered?.layout, rejectedDraft: boot.desktopRejected || boot.rejected,
    open, save, exportImages, setProjectText, setParagraphText, setContinuousParagraphText, addParagraph,
    highlightRange, addVocabularyFromSelection, commitHead, setWordPreview, setEntryHighlights, setSenseField, setVocabularyMeaning,
    addSense, removeSense, reorder, setEntryField, addEntry, removeEntry, setStyle, resetStyles,
    selectedVocabulary, selectedVocabularyIndex, selectVocabulary, moveSelectedVocabulary,
    deleteSelectedVocabulary, insertVocabularyBelow,
    clearError, downloadRejectedDraft, importSettings,
  };
}
