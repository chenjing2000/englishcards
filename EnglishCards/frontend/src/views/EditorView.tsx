import { useEffect, useRef, useState } from 'react';
import type { Styles } from '../models/project';
import { useEditorViewModel } from '../viewmodels/useEditorViewModel';
import VocabularyTable, { VocabularyActions } from './VocabularyTable';
import CardPreview from './CardPreview';
import NotificationBar from './NotificationBar';
import ProjectActions from './ProjectActions';
import SplitPane from './SplitPane';
import AutoSizeTextarea from './AutoSizeTextarea';
import SettingInput from './SettingInput';

type Tab = '原文' | '词汇' | '译文' | '样式';

export default function EditorView() {
  const vm = useEditorViewModel();
  const { project, warning, error, settingsReady, ready, exporting, layout, canUndo, canRedo, rejectedDraft } = vm;
  const [tab, setTab] = useState<Tab>('原文');
  const settingsFile = useRef<HTMLInputElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>());
  function registerInput(id: string, input: HTMLInputElement | HTMLTextAreaElement | null) {
    if (input) inputs.current.set(id, input); else inputs.current.delete(id);
  }
  const [focusId, setFocusId] = useState('');
  useEffect(() => {
    if (!focusId) return;
    inputs.current.get(focusId)?.focus();
    inputs.current.get(focusId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFocusId('');
  }, [focusId, tab]);
  function jump(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    const line = target.closest<HTMLElement>('[data-source]');
    const id = target.closest<HTMLElement>('[data-edit]')?.dataset.edit ?? line?.dataset.source;
    if (!id) return;
    const kind = line!.dataset.kind;
    if (kind === 'title' || kind === 'article') {
      setTab('原文');
      setFocusId(kind === 'title' ? 'project:title' : `content:${id}`);
    } else if (kind === 'vocab') {
      vm.selectVocabulary(line!.dataset.source!);
      setTab('词汇');
      setFocusId(`vocabulary:${target.closest<HTMLElement>('[data-edit]')?.dataset.edit ?? `${line!.dataset.source}:word`}`);
    } else if (kind === 'translation') {
      setTab('译文');
      setFocusId(`translation:${id}`);
    }
  }
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
    <SplitPane right={<aside className="editor-panel" id="editor-panel"><div className="panel-heading"><h1>英语阅读卡片编辑器</h1></div>
      <nav aria-label="编辑板块">{(['原文', '词汇', '译文', '样式'] as Tab[]).map(name => <button key={name} className={name === tab ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}</nav>
      <div className="history-toolbar" inert={vm.opening}><button onClick={vm.undo} disabled={!canUndo}>Undo</button><button onClick={vm.redo} disabled={!canRedo}>Redo</button><span>支持最近 10 次修改</span>{rejectedDraft && <button onClick={vm.downloadRejectedDraft}>下载原始草稿</button>}</div>
      <div inert={!settingsReady || vm.opening} className="fields">
        {tab === '原文' && <>
          <label className="field"><span>IdentityTag</span><input type="text" aria-label="IdentityTag" value={project.identityTag} onChange={event => vm.setProjectText('identityTag', event.target.value)} /></label>
          {field('英文标题', project.title, value => vm.setProjectText('title', value), 'project:title')}
          <p className="hint">在下方英文框选择文字，再点“高亮 / 取消高亮”。高亮字号始终继承正文。</p>
          {project.content.paragraphs.map((paragraph, index) => <section className="edit-entry" key={paragraph.id}>
            {field(`英文段落 ${index + 1}`, paragraph.text, value => vm.setParagraphText('content', paragraph.id, value), `content:${paragraph.id}`)}
            <div className="entry-toolbar"><button aria-label={`高亮 / 取消高亮 ${index + 1}`} onMouseDown={event => event.preventDefault()} onClick={() => { const input = inputs.current.get(`content:${paragraph.id}`) as HTMLTextAreaElement; vm.highlightRange(paragraph.id, input.selectionStart, input.selectionEnd); }}>高亮 / 取消高亮</button></div>
          </section>)}
          <button className="add-button" onClick={() => vm.addParagraph('content')}>添加正文段落</button>
        </>}
        {tab === '词汇' && <VocabularyTable viewModel={vm} registerInput={registerInput} />}
        
        {tab === '译文' && <>
          {project.translation.paragraphs.map((paragraph, index) => <section className="edit-entry" key={paragraph.id}>
            {field(`中文段落 ${index + 1}`, paragraph.text, value => vm.setParagraphText('translation', paragraph.id, value), `translation:${paragraph.id}`)}
            {!paragraph.text && <p className="hint">空段落将保留，不影响其他段落。</p>}
          </section>)}
          <button className="add-button" onClick={() => vm.addParagraph('translation')}>添加中文段落</button>
        </>}
        {tab === '样式' && <div className="style-settings">
          {settingsTable('字号设置', fontFields)}{settingsTable('其余设置', otherFields)}
          <p className="hint style-settings-hint">字号与页面尺寸单位为 px；有效配置自动保存到 {vm.desktop ? 'userdata/settings/settings.json' : 'config/settings.json'}。</p>
          <div className="style-settings-actions">
            <button type="button" onClick={vm.resetStyles}>默认配置</button>
            {vm.desktop && <>
              <input hidden ref={settingsFile} type="file" accept=".json,application/json" aria-label="导入配置 JSON 文件" onChange={event => { void vm.importSettings(event.target.files?.[0]); event.target.value = ''; }} />
              <button type="button" onClick={() => settingsFile.current?.click()}>导入配置</button>
            </>}
          </div>
        </div>}
      </div><div className="editor-bottom">
        {tab === '词汇' && <VocabularyActions viewModel={vm} focusField={setFocusId} />}
        <NotificationBar error={error} warning={warning} closeError={vm.clearError} />
      </div>
    </aside>} left={<CardPreview layout={layout} ready={ready} jump={jump}
      actions={<ProjectActions open={vm.open} save={vm.save} exportImages={vm.exportImages} ready={ready} exporting={exporting} />} />} />
  </div>;
}
