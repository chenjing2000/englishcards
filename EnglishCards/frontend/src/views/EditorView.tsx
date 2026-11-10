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
import { cardFileName } from '../services/cardFileIO';

/**
 * Match Transcript Studio's native React toolbar drawing:
 * 24-unit viewBox, 20-DIP vector, 1.8-DIP round line strokes.
 */
function ToolbarIcon({ name }: { name: 'design' | 'new-card' | 'export-zip' }) {
  const paths = {
    design: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fff"/><circle cx="16" cy="12" r="2" fill="#fff"/><circle cx="10" cy="18" r="2" fill="#fff"/></>,
    'new-card': <><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5"/><path d="M12 12v7M8.5 15.5h7"/></>,
    'export-zip': <><path d="M12 20V7m-4 4 4-4 4 4"/><path d="M4 15v5h16v-5"/></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">{paths[name]}</svg>;
}

export default function EditorView() {
  const vm = useEditorViewModel();
  const { project, warning, error, settingsReady, ready, exporting, layout, rejectedDraft } = vm;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [creatingCard, setCreatingCard] = useState(false);

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
          {settingsTable('字号设置', fontFields)}{settingsTable('其余设置', otherFields)}
          <p className="hint style-settings-hint">字号与页面尺寸单位为 px；有效配置自动保存到 {vm.desktop ? 'userdata/settings/settings.json' : 'config/settings.json'}。</p>
          <div className="style-settings-actions">
            <button type="button" onClick={vm.resetStyles}>默认配置</button>

          </div>
        </div>);
  const cardActions = <div className="phase-e-actions" role="group" aria-label="卡片操作">
    <button type="button" aria-label={settingsOpen ? '关闭设置' : '设计'} title="设计"
      onClick={() => setSettingsOpen(value => !value)}><ToolbarIcon name="design" /></button>
    <button type="button" aria-label="新建卡片" title="新建卡片"
      disabled={!vm.libraryRoot || vm.opening} onClick={() => { setNewCardTitle(''); setNewCardOpen(true); }}>
      <ToolbarIcon name="new-card" />
    </button>
    <button type="button" aria-label="导出 ZIP" title="导出 ZIP"
      disabled={!ready || exporting || !vm.activeCardPath || vm.cardSaveStatus !== 'clean'}
      onClick={() => { void vm.exportImages(); }}><ToolbarIcon name="export-zip" />
    </button>
  </div>;

  return <div className="app-shell" inert={vm.desktop && (!settingsReady || vm.closing)}>
    <div className="phase-e-layout">
      {vm.desktop && <CardLibrary root={vm.libraryRoot} activePath={vm.activeCardPath}
        revision={vm.libraryRevision} onRootChange={vm.changeLibraryRoot}
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
      {vm.desktop && !vm.activeCardPath
        ? <div className="phase-e-empty-editor" role="status">请选择卡片馆中的 JSON 文件，或点击上方「新建卡片」开始编辑。</div>
        : <div inert={!settingsReady || vm.opening} className="fields phase-c-fields">
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
      </div>}
      <div className="editor-bottom">
        {vm.cardSaveStatus === 'error' && <button type="button" className="retry-card-save" onClick={() => void vm.retryCardSave()}>重试保存当前卡片</button>}
        {!settingsOpen && <VocabularyActions viewModel={vm} focusField={setFocusId} />}
        {!vm.desktop && <NotificationBar error={error} warning={warning} closeError={vm.clearError} />}
      </div>
    </aside>} left={<CardPreview layout={vm.desktop && !vm.activeCardPath ? undefined : layout}
      ready={ready && (!vm.desktop || !!vm.activeCardPath)} content={project.content.paragraphs} onAddSelection={vm.addVocabularyFromSelection}
      actions={vm.desktop ? null : <ProjectActions open={vm.open} save={vm.save} exportImages={vm.exportImages} ready={ready} exporting={exporting} />}
      notices={vm.desktop ? <PreviewNotices errors={vm.errors} warning={warning} closeError={vm.clearError} /> : null} />} />
    </div>
    {vm.desktop && newCardOpen && <div className="phase-e-modal-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="新建卡片" className="phase-e-modal phase-e-create-dialog">
        <div className="phase-e-modal-heading"><h2>新建卡片</h2>
          <button type="button" aria-label="取消新建" disabled={creatingCard}
            onClick={() => setNewCardOpen(false)}>取消</button></div>
        <form className="phase-e-create-form" onSubmit={event => {
          event.preventDefault();
          if (!newCardTitle.trim() || creatingCard) return;
          setCreatingCard(true);

          void vm.newCard(vm.libraryRoot, newCardTitle).then(created => {
            if (created) setNewCardOpen(false);

          }).finally(() => setCreatingCard(false));
        }}>
          <label htmlFor="phase-e-new-card-title">英文标题</label>
          <input id="phase-e-new-card-title" type="text" autoFocus
            value={newCardTitle} onChange={event => setNewCardTitle(event.target.value)}
            placeholder="输入新卡片的英文标题" maxLength={150} />
          <p className="hint">默认文件名：{cardFileName(newCardTitle)}</p>
          <p className="hint">保存目录：{vm.libraryRoot}</p>

          <div className="phase-e-create-actions">
            <button type="button" disabled={creatingCard} onClick={() => setNewCardOpen(false)}>取消</button>
            <button type="submit" disabled={!newCardTitle.trim() || creatingCard}>创建卡片</button>
          </div>
        </form>
      </section>
    </div>}
    {vm.desktop && settingsOpen && <div className="phase-e-modal-backdrop" role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="设计设置" className="phase-e-modal phase-e-settings-dialog">
        <div className="phase-e-modal-heading"><h2>设计设置</h2>
          <button type="button" aria-label="关闭设置" onClick={() => setSettingsOpen(false)}>关闭</button></div>
        <div className="phase-e-modal-scroll">{settingsContents}</div>
      </section>
    </div>}
  </div>;
}
