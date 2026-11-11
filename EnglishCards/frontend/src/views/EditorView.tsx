import { useEffect, useRef, useState } from 'react';
import type { Styles } from '../models/project';
import { useEditorViewModel } from '../viewmodels/useEditorViewModel';
import VocabularyTable, { VocabularyActions } from './VocabularyTable';
import CardPreview from './CardPreview';
import NotificationBar from './NotificationBar';
import PreviewNotices from './PreviewNotices';
import CardLibrary from './CardLibrary';
import ProjectActions from './ProjectActions';
import SplitPane from './SplitPane';
import AutoSizeTextarea from './AutoSizeTextarea';
import ContinuousParagraphEditor from './ContinuousParagraphEditor';
import SettingInput from './SettingInput';
import type { ArticlePairTarget } from '../services/cardFileIO';

/**
 * Match Transcript Studio's native React toolbar drawing:
 * 24-unit viewBox, 20-DIP vector, 1.8-DIP round line strokes.
 */
function ToolbarIcon({ name }: { name: 'design' | 'clear' | 'save' }) {
  const paths = {
    design: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fff"/><circle cx="16" cy="12" r="2" fill="#fff"/><circle cx="10" cy="18" r="2" fill="#fff"/></>,
    clear: <><path d="m4 16 10-11 7 7-8 9H7z"/><path d="M13 21h8"/></>,
    save: <><path d="M4 4h14l3 3v13H4z"/><path d="M8 4v7h9V4"/><path d="M8 20v-7h9v7"/></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">{paths[name]}</svg>;
}

export default function EditorView() {
  const vm = useEditorViewModel();
  const { project, warning, error, settingsReady, ready, exporting, layout, rejectedDraft } = vm;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [overwriteTarget, setOverwriteTarget] = useState<ArticlePairTarget | null>(null);
  const overwriteResolver = useRef<((approved: boolean) => void) | null>(null);
  function confirmOverwrite(target: ArticlePairTarget): Promise<boolean> {
    setOverwriteTarget(target);
    return new Promise(resolve => { overwriteResolver.current = resolve; });
  }
  function resolveOverwrite(approved: boolean) {
    setOverwriteTarget(null);
    const resolve = overwriteResolver.current;
    overwriteResolver.current = null;
    resolve?.(approved);
  }

  const inputs = useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>());
  function registerInput(id: string, input: HTMLInputElement | HTMLTextAreaElement | null) {
    if (input) inputs.current.set(id, input); else inputs.current.delete(id);
  }
  const [focusId, setFocusId] = useState('');
  useEffect(() => {
    if (!focusId) return;
    const input = inputs.current.get(focusId);
    input?.focus();
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFocusId('');
  }, [focusId, settingsOpen]);

  function field(label: string, value: string, onChange: (value: string) => void, id?: string) {
    return <label className="field" key={label}><span>{label}</span><AutoSizeTextarea label={label} value={value} inputRef={element => { if (id) registerInput(id, element); }} onChange={onChange} /></label>;
  }
  const fontFields: [keyof Styles, string][] = [
    ['titleSize', '标题字号'], ['bodySize', '英文正文字号'], ['translationSize', '中文译文字号'],
    ['headerSize', '页眉字号'], ['footerSize', '页脚字号'], ['wordSize', '词汇单词字号'], ['vocabularySize', '词汇其余内容字号'],
    ['headingSize', '栏目标题字号'],
  ];
  const otherFields: typeof fontFields = [
    ['pageWidth', '页面宽度'], ['pageHeight', '页面高度'],
    ['lineHeight', '英文行距'], ['translationLineHeight', '中文行距'], ['paragraphGap', '段距'],
    ['marginX', '左右边距'], ['marginTop', '上边距'], ['marginBottom', '底部预留'],
  ];
  function settingsTable(name: string, fields: typeof fontFields) {
    return <><h2 className="settings-heading">{name}</h2><table className="settings-table" aria-label={name}><thead><tr><th>参数</th><th>数值</th></tr></thead><tbody>
      {fields.map(([key, label]) => <tr key={key}><th scope="row"><label htmlFor={`setting-${key}`}>{label}</label></th><td>
        <SettingInput id={`setting-${key}`} value={project.styles[key]} decimal={key === 'lineHeight' || key === 'translationLineHeight'} onChange={value => vm.setStyle(key, value)} />
      </td></tr>)}
    </tbody></table></>;
  }

  const settingsContents = (<div className="style-settings" aria-label="设置面板">
          <div className="settings-columns">
            <section className="settings-column" aria-label="字号设置区域">{settingsTable('字号设置', fontFields)}</section>
            <section className="settings-column" aria-label="其余设置区域">{settingsTable('其余设置', otherFields)}</section>
          </div>
          <p className="hint style-settings-hint">字号与页面尺寸单位为 px；有效配置自动保存到 {vm.desktop ? 'userdata/settings/settings.json' : 'config/settings.json'}。</p>
          <div className="style-settings-actions">
            <button type="button" onClick={vm.resetStyles}>默认配置</button>

          </div>
        </div>);
  const cardActions = <div className="phase-e-actions" role="group" aria-label="卡片操作">
    <button type="button" aria-label={settingsOpen ? '关闭设置' : '设置'} title="设置"
      onClick={() => setSettingsOpen(value => !value)}><ToolbarIcon name="design" /></button>
    <button type="button" aria-label="清空" title="清空"
      disabled={vm.opening || exporting || clearBusy} onClick={() => {
        if (vm.needsClearConfirmation) setClearOpen(true);
        else void vm.clearArticle();
      }}><ToolbarIcon name="clear" /></button>
    <button type="button" aria-label="保存" title="保存 JSON 与 ZIP"
      disabled={!ready || exporting || vm.opening || clearBusy}
      onClick={() => { void vm.savePair(confirmOverwrite); }}><ToolbarIcon name="save" /></button>
  </div>;

  return <div className="app-shell" inert={vm.desktop && (!settingsReady || vm.closing)}>
    <div className="phase-e-layout">
      {vm.desktop && <CardLibrary root={vm.libraryRoot} activePath={vm.activeCardPath}
        revision={vm.libraryRevision} onRootChange={vm.changeLibraryRoot} onError={vm.reportError}
        onOpen={path => { void vm.openCardPath(path); }} />}
    <SplitPane right={<aside className="editor-panel" id="editor-panel">
      <div className="panel-heading phase-c-heading">
        <h1>英语阅读卡片编辑器</h1>
        {!vm.desktop && <button type="button" aria-label={settingsOpen ? '返回文章编辑' : '打开设置'} onClick={() => setSettingsOpen(value => !value)}>
          {settingsOpen ? '返回编辑' : '设置'}
        </button>}
        {vm.desktop && cardActions}
      </div>
      {rejectedDraft && <div className="draft-recovery"><button type="button" onClick={vm.downloadRejectedDraft}>下载原始草稿</button></div>}
      <div inert={!settingsReady || vm.opening} className="fields phase-c-fields">
        {settingsOpen && !vm.desktop ? settingsContents : <div className="article-editor" aria-label="文章编辑">
          <section className="editor-section" aria-label="Vocabulary 编辑区">
            <h2>Vocabulary</h2>
            <VocabularyTable viewModel={vm} registerInput={registerInput} />
          </section>
          <section className="editor-section" aria-label="Content 编辑区">
            <h2>Content</h2>
            <label className="field"><span>IdentityTag</span><input type="text" aria-label="IdentityTag" value={project.identityTag} onChange={event => vm.setProjectText('identityTag', event.target.value)} /></label>
            {field('英文标题', project.title, value => vm.setProjectText('title', value), 'project:title')}
            <label className="field"><span>英文正文</span>
              <ContinuousParagraphEditor label="英文正文" paragraphs={project.content.paragraphs}
                inputRef={input => registerInput('content:all', input)}
                onChange={value => vm.setContinuousParagraphText('content', value)} />
            </label>
            <p className="hint">自然段之间用空行分隔；段内单次换行会合并为空格。最多 999 段。</p>
          </section>
          <section className="editor-section" aria-label="Translation 编辑区">
            <h2>Translation</h2>
            <label className="field"><span>中文译文</span>
              <ContinuousParagraphEditor label="中文译文" paragraphs={project.translation.paragraphs}
                inputRef={input => registerInput('translation:all', input)}
                onChange={value => vm.setContinuousParagraphText('translation', value)} />
            </label>
            <p className="hint">自然段之间用空行分隔；最多 999 段。</p>
          </section>
        </div>}
      </div>
      <div className="editor-bottom">
        {vm.cardSaveStatus === 'error' && <button type="button" className="retry-card-save" onClick={() => void vm.retryCardSave()}>重试保存当前卡片</button>}
        {!settingsOpen && <VocabularyActions viewModel={vm} focusField={setFocusId} />}
        {!vm.desktop && <NotificationBar error={error} warning={warning} closeError={vm.clearError} />}
      </div>
    </aside>} left={<CardPreview layout={vm.desktop && vm.emptyArticle ? undefined : layout}
      ready={ready && (!vm.desktop || !vm.emptyArticle)} content={project.content.paragraphs} onAddSelection={vm.addVocabularyFromSelection}
      actions={vm.desktop ? null : <ProjectActions open={vm.open} save={vm.save} exportImages={vm.exportImages} ready={ready} exporting={exporting} />}
      notices={vm.desktop ? <PreviewNotices errors={vm.errors} warning={warning} closeError={vm.clearError} /> : null} />} />
    </div>
    {vm.desktop && clearOpen && <div className="phase-e-modal-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="清空当前文章" className="phase-e-modal phase-e-clear-dialog">
        <div className="phase-e-modal-heading"><h2>清空当前文章？</h2></div>
        <p className="phase-e-clear-description">当前文章存在尚未完成的联合保存。请选择保存、放弃或取消。</p>
        <div className="phase-e-clear-actions">
          <button type="button" disabled={clearBusy} onClick={() => {
            setClearBusy(true);
            void vm.savePair(confirmOverwrite).then(async saved => {
              if (saved && await vm.clearArticle()) setClearOpen(false);
            }).finally(() => setClearBusy(false));
          }}>保存</button>
          <button type="button" disabled={clearBusy} onClick={() => {
            setClearBusy(true);
            void vm.clearArticle().then(cleared => {
              if (cleared) setClearOpen(false);
            }).finally(() => setClearBusy(false));
          }}>放弃</button>
          <button type="button" disabled={clearBusy} onClick={() => setClearOpen(false)}>取消</button>
        </div>
      </section>
    </div>}
    {vm.desktop && overwriteTarget && <div className="phase-e-modal-backdrop" role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) resolveOverwrite(false); }}>
      <section role="dialog" aria-modal="true" aria-label="确认覆盖" className="phase-e-modal phase-e-overwrite-dialog">
        <div className="phase-e-modal-heading"><h2>确认覆盖</h2>
          <button type="button" aria-label="关闭确认覆盖" onClick={() => resolveOverwrite(false)}>×</button></div>
        <div className="phase-e-overwrite-content">
          <p>以下位置已存在同名文件：</p>
          <ul>{overwriteTarget.existingFiles.map(file => <li key={file}>{file}</li>)}</ul>
          <p>是否覆盖这一组文件？</p>
        </div>
        <div className="phase-e-clear-actions phase-e-overwrite-actions">
          <button type="button" onClick={() => resolveOverwrite(false)}>取消</button>
          <button type="button" onClick={() => resolveOverwrite(true)}>覆盖</button>
        </div>
      </section>
    </div>}
    {vm.desktop && settingsOpen && <div className="phase-e-modal-backdrop" role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="设计设置" className="phase-e-modal phase-e-settings-dialog">
        <div className="phase-e-modal-heading"><h2>设置</h2>
          <button type="button" aria-label="关闭设置" onClick={() => setSettingsOpen(false)}>关闭</button></div>
        <div className="phase-e-modal-scroll">{settingsContents}</div>
      </section>
    </div>}
  </div>;
}
