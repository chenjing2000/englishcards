import { useLayoutEffect, useRef, useState } from 'react';
import { defaults, settingsSchema, type Styles } from '../models/settings';
import type { ReaderDocument } from '../models/reader';
import { useReaderViewModel } from '../viewmodels/useReaderViewModel';
import CardLibrary from './CardLibrary';
import settingIcon from '../assets/icons/toolbar/settings.svg';

type Pick = { word: string; left: number; top: number };
const styleFields: { key: keyof Styles; label: string; step?: string }[] = [
  { key: 'titleSize', label: '标题字号' }, { key: 'bodySize', label: '正文字号' },
  { key: 'headingSize', label: '章节标题字号' }, { key: 'vocabularySize', label: '生词字号' },
  { key: 'wordSize', label: '词汇重点字号' }, { key: 'translationSize', label: '译文字号' },
  { key: 'headerSize', label: '页眉字号' }, { key: 'footerSize', label: '页脚字号' },
  { key: 'lineHeight', label: '正文行距', step: '0.05' },
  { key: 'translationLineHeight', label: '译文行距', step: '0.05' },
  { key: 'paragraphGap', label: '段落间距' }, { key: 'marginX', label: '左右边距' },
  { key: 'marginTop', label: '上边距' }, { key: 'marginBottom', label: '下边距' },
  { key: 'pageWidth', label: '页面宽度' }, { key: 'pageHeight', label: '页面高度' },
];
const draftFrom = (styles: Styles) => Object.fromEntries(
  Object.entries(styles).map(([name, value]) => [name, String(value)])
) as Record<keyof Styles, string>;

function pickedWord(container: HTMLElement, doc: ReaderDocument): Pick | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  function lineFor(node: Node): HTMLElement | null {
    const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
    const line = element?.closest<HTMLElement>('.text-line.article');
    return line && container.contains(line) ? line : null;
  }
  const startLine = lineFor(range.startContainer), endLine = lineFor(range.endContainer);
  const source = startLine?.dataset.source;
  if (!startLine || !endLine || !source?.startsWith('script:') || endLine.dataset.source !== source) return null;
  const paragraphIndex = Number(source.slice(7));
  const paragraph = doc.script.paragraphs[paragraphIndex];
  if (!paragraph) return null;
  const text = paragraph.map(sentence => sentence.text).join(' ');
  function offset(line: HTMLElement, node: Node, position: number) {
    const prefix = document.createRange();
    prefix.selectNodeContents(line);
    prefix.setEnd(node, position);
    return Number(line.dataset.start) + prefix.toString().length;
  }
  const start = offset(startLine, range.startContainer, range.startOffset);
  const end = offset(endLine, range.endContainer, range.endOffset);
  if (start >= end || end > text.length) return null;
  let position = 0, sameSentence = false;
  paragraph.forEach((sentence, index) => {
    if (index) position++;
    if (start >= position && end <= position + sentence.text.length) sameSentence = true;
    position += sentence.text.length;
  });
  if (!sameSentence) return null;
  const word = text.slice(start, end).trim();
  if (!/^[A-Za-z][A-Za-z '\u2019-]{0,79}$/.test(word)) return null;
  const rect = range.getBoundingClientRect();
  return { word, left: Math.min(window.innerWidth - 48, Math.max(8, rect.right + 8)),
    top: Math.min(window.innerHeight - 48, Math.max(8, rect.bottom + 4)) };
}

export default function ReaderView() {
  const vm = useReaderViewModel();
  const { root, revision, activePath, document: reader, layout, messages, reportError } = vm;
  const [page, setPage] = useState(0);
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState<Record<keyof Styles, string> | null>(null);
  const [draftError, setDraftError] = useState('');
  const [selected, setSelected] = useState<Pick | null>(null);
  const [adding, setAdding] = useState(false);
  const [meaning, setMeaning] = useState('');
  const [wordError, setWordError] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [scale, setScale] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { setPage(0); setSelected(null); setAdding(false); setSettings(false); }, [activePath]);
  useLayoutEffect(() => { setPage(value => Math.min(value, Math.max(0, (layout?.pages.length ?? 1) - 1))); }, [layout]);
  useLayoutEffect(() => {
    const target = preview.current;
    if (!target) return;
    target.replaceChildren(...(layout ? [layout.pages[Math.min(page, layout.pages.length - 1)]] : []));
  }, [layout, page]);
  useLayoutEffect(() => {
    const viewport = stage.current;
    if (!viewport) return;
    const styles = reader?.styles ?? defaults;
    const fit = () => setScale(Math.min(1, Math.max(0.1, (viewport.clientWidth - 40) / styles.pageWidth),
      Math.max(0.1, (viewport.clientHeight - 40) / styles.pageHeight)));
    fit();
    const observer = new ResizeObserver(fit); observer.observe(viewport);
    return () => observer.disconnect();
  }, [reader]);

  const count = layout?.pages.length ?? 0;
  const styles = reader?.styles ?? defaults;
  function updateSelection() {
    setSelected(reader && preview.current ? pickedWord(preview.current, reader) : null);
  }
  function openSettings() {
    if (!reader || !activePath) return;
    setDraft(draftFrom(reader.styles)); setDraftError(''); setSettings(true); setSelected(null);
  }
  async function commitStyles() {
    if (!draft) return;
    const parsed = settingsSchema.safeParse(Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value.trim() === '' ? NaN : Number(value)])
    ));
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message ?? '设置值无效。');
      return;
    }
    setDraftError('');
    if (await vm.saveStyles(parsed.data)) setSettings(false);
    else setDraftError('设置未保存。请检查文件是否被外部修改，或重新打开 Script 后重试。');
  }
  async function commitWord() {
    if (!selected || !meaning.trim() || vm.saving) return;
    if (await vm.addWord(selected.word, meaning, partOfSpeech)) {
      setAdding(false); setSelected(null); setMeaning(''); setPartOfSpeech(''); setWordError('');
      window.getSelection()?.removeAllRanges();
    } else setWordError('生词未保存。请检查重复词、文件是否被外部修改，或重新打开 Script 后重试。');
  }
  const settingsButton = <button className="reader-settings-button" type="button" title="设置" aria-label="设置"
    onClick={openSettings} disabled={!reader}><img src={settingIcon} alt="" /></button>;
  return <div className="reader-shell">
    <CardLibrary root={root} rootContents={vm.rootContents} onLoaded={vm.directoryLoaded} activePath={activePath} revision={revision} onRootChange={vm.changeLibraryRoot}
      onOpen={path => { void vm.open(path); }} onError={reportError} settings={settingsButton}
      actions={<><button type="button" title="保存" disabled>PNG</button><button type="button" title="导出 MP4" disabled>MP4</button></>} />
    <main className="reader-main" aria-label="Script 阅读区">
      <div className="reader-navigation" role="group" aria-label="阅读控制">
        <button type="button" aria-label="上一页" disabled={!count || page === 0} onClick={() => { setSelected(null); setPage(value => value - 1); }}>上一页</button>
        <output aria-label="页码">{count ? page + 1 : 0} / {count}</output>
        <button type="button" aria-label="下一页" disabled={!count || page === count - 1} onClick={() => { setSelected(null); setPage(value => value + 1); }}>下一页</button>
        <button type="button" aria-label="播放" disabled>播放</button><button type="button" aria-label="停止" disabled>停止</button>
      </div>
      <div className="reader-stage" ref={stage} onMouseUp={updateSelection} onKeyUp={updateSelection}>
        {layout ? <div className="reader-page-frame" style={{ width: styles.pageWidth * scale, height: styles.pageHeight * scale }}>
          <div className="preview" data-ready="true" ref={preview}
            style={{ width: styles.pageWidth, height: styles.pageHeight, transform: 'scale(' + scale + ')', transformOrigin: 'top left' }} />
        </div> : <p>请选择卡片馆中的 Script JSON。</p>}
      </div>
      {selected && !adding && <button className="reader-add-word" type="button" aria-label="添加生词" title="添加到生词本"
        style={{ left: selected.left, top: selected.top }} onClick={() => { setAdding(true); setMeaning(''); setPartOfSpeech(''); setWordError(''); }}>+</button>}
      {Object.entries(messages).filter(([, text]) => text).map(([source, text]) => <div role="status" className="reader-message" key={source}>
        <span>{text}</span><button type="button" aria-label="关闭提示" onClick={() => reportError(source, '')}>关闭</button>
      </div>)}
    </main>
    {adding && selected && <div className="phase-e-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="添加生词" className="phase-e-modal reader-edit-modal">
      <h2>添加生词：{selected.word}</h2>
      <label>词性 <input value={partOfSpeech} maxLength={40} placeholder="如 n. / v." onChange={event => { setPartOfSpeech(event.target.value); setWordError(''); }} /></label>
      <label>释义 <input autoFocus value={meaning} maxLength={500} placeholder="输入释义" onChange={event => { setMeaning(event.target.value); setWordError(''); }}
        onKeyDown={event => { if (event.key === 'Enter') void commitWord(); }} /></label>
      {wordError && <p role="alert" className="reader-settings-error">{wordError}</p>}
      <div className="reader-modal-actions"><button disabled={vm.saving} onClick={() => { setAdding(false); setSelected(null); }}>取消</button>
        <button disabled={vm.saving || !meaning.trim()} onClick={() => void commitWord()}>保存</button></div>
    </section></div>}
    {settings && draft && <div className="phase-e-modal-backdrop"><section role="dialog" aria-modal="true"
      aria-labelledby="reader-settings-heading" className="phase-e-modal reader-edit-modal">
      <h2 id="reader-settings-heading">设置</h2>
      <div className="reader-style-fields">{styleFields.map(({ key, label, step }) => <label key={key}>{label}
        <input type="number" step={step ?? '1'} value={draft[key]}
          onChange={event => setDraft(value => ({ ...value!, [key]: event.target.value }))} /></label>)}</div>
      {draftError && <p role="alert" className="reader-settings-error">{draftError}</p>}
      {!vm.settingsValid && <p role="alert">设置文件无效，须修复源文件后重新打开。</p>}
      <div className="reader-modal-actions">
        <button disabled={vm.saving} onClick={() => { setDraft(draftFrom(defaults)); setDraftError(''); }}>恢复默认</button>
        <button disabled={vm.saving} onClick={() => setSettings(false)}>取消</button>
        <button disabled={vm.saving || !vm.settingsValid} onClick={() => void commitStyles()}>保存</button>
      </div>
    </section></div>}
  </div>;
}
