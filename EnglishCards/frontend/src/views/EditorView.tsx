import { useEffect, useRef, useState } from 'react';
import type { Styles } from '../models/project';
import { useEditorViewModel } from '../viewmodels/useEditorViewModel';
import VocabularyTable, { VocabularyActions } from './VocabularyTable';
import CardPreview from './CardPreview';
import NotificationBar from './NotificationBar';
import CardLibrary from './CardLibrary';
import SplitPane from './SplitPane';
import AutoSizeTextarea from './AutoSizeTextarea';
import ContinuousParagraphEditor from './ContinuousParagraphEditor';
import SettingInput from './SettingInput';

export default function EditorView() {
  const vm = useEditorViewModel();
  const { project, warning, error, settingsReady, ready, exporting, layout, rejectedDraft } = vm;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsFile = useRef<HTMLInputElement>(null);
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

  return <div className="app-shell" inert={vm.desktop && (!settingsReady || vm.closing)}>
    <div className="phase-e-layout">
      {vm.desktop && <CardLibrary root={vm.libraryRoot} activePath={vm.activeCardPath}
        revision={vm.libraryRevision} onRootChange={vm.changeLibraryRoot}
        onOpen={path => { void vm.openCardPath(path); }} />}
    <SplitPane right={<aside className="editor-panel" id="editor-panel">
      <div className="panel-heading phase-c-heading">
        <h1>英语阅读卡片编辑器</h1>
        <button type="button" aria-label={settingsOpen ? '返回文章编辑' : '打开设置'} onClick={() => setSettingsOpen(value => !value)}>
          {settingsOpen ? '返回编辑' : '设置'}
        </button>
      </div>
      {rejectedDraft && <div className="draft-recovery"><button type="button" onClick={vm.downloadRejectedDraft}>下载原始草稿</button></div>}
      <div inert={!settingsReady || vm.opening} className="fields phase-c-fields">
        {settingsOpen ? <div className="style-settings" aria-label="设置面板">
          {settingsTable('字号设置', fontFields)}{settingsTable('其余设置', otherFields)}
          <p className="hint style-settings-hint">字号与页面尺寸单位为 px；有效配置自动保存到 {vm.desktop ? 'userdata/settings/settings.json' : 'config/settings.json'}。</p>
          <div className="style-settings-actions">
            <button type="button" onClick={vm.resetStyles}>默认配置</button>
            {vm.desktop && <>
              <input hidden ref={settingsFile} type="file" accept=".json,application/json" aria-label="导入配置 JSON 文件" onChange={event => { void vm.importSettings(event.target.files?.[0]); event.target.value = ''; }} />
              <button type="button" onClick={() => settingsFile.current?.click()}>导入配置</button>
            </>}
          </div>
        </div> : <div className="article-editor" aria-label="文章编辑">
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
        <NotificationBar error={error} warning={warning} closeError={vm.clearError} />
      </div>
    </aside>} left={<CardPreview layout={layout} ready={ready} content={project.content.paragraphs} onAddSelection={vm.addVocabularyFromSelection}
      actions={<div className="phase-e-actions" role="group" aria-label="卡片操作">
        <button type="button" aria-label="设置" title="设置" onClick={() => setSettingsOpen(value => !value)}>⚙</button>
        <button type="button" aria-label="新建卡片" title="新建卡片"
          disabled={!vm.desktop || !vm.libraryRoot || vm.opening}
          onClick={() => { void vm.newCard(vm.libraryRoot); }}>＋</button>
        <button type="button" aria-label="导出 ZIP" title="导出 ZIP"
          disabled={!ready || exporting || vm.cardSaveStatus !== 'clean'}
          onClick={() => { void vm.exportImages(); }}>⇩</button>
      </div>} />} />
    </div>
  </div>;
}
