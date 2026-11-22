import { useLayoutEffect, useRef, useState } from 'react';
import { defaults } from '../models/settings';
import { useReaderViewModel } from '../viewmodels/useReaderViewModel';
import CardLibrary from './CardLibrary';
import settingIcon from '../assets/icons/toolbar/settings.svg';

export default function ReaderView() {
  const vm = useReaderViewModel();
  const { root, revision, activePath, document, layout, messages, reportError } = vm;
  const [page, setPage] = useState(0);
  const [settings, setSettings] = useState(false);
  const [scale, setScale] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { setPage(0); }, [layout]);
  useLayoutEffect(() => {
    const target = preview.current;
    if (!target) return;
    target.replaceChildren(...(layout ? [layout.pages[Math.min(page, layout.pages.length - 1)]] : []));
  }, [layout, page]);
  useLayoutEffect(() => {
    const viewport = stage.current;
    if (!viewport) return;
    const styles = document?.styles ?? defaults;
    const fit = () => setScale(Math.min(1, Math.max(0.1, (viewport.clientWidth - 40) / styles.pageWidth), Math.max(0.1, (viewport.clientHeight - 40) / styles.pageHeight)));
    fit();
    const observer = new ResizeObserver(fit); observer.observe(viewport);
    return () => observer.disconnect();
  }, [document]);
  const count = layout?.pages.length ?? 0;
  const styles = document?.styles ?? defaults;
  const settingsButton = <button className="reader-settings-button" type="button" title="设置" aria-label="设置" onClick={() => setSettings(true)}><img src={settingIcon} alt="" /></button>;
  return <div className="reader-shell">
    <CardLibrary root={root} activePath={activePath} revision={revision} onRootChange={vm.changeLibraryRoot}
      onOpen={path => { void vm.open(path); }} onError={reportError} settings={settingsButton}
      actions={<><button type="button" title="保存" disabled>PNG</button><button type="button" title="导出 MP4" disabled>MP4</button></>} />
    <main className="reader-main" aria-label="Script 阅读区">
      <div className="reader-navigation" role="group" aria-label="阅读控制">
        <button type="button" aria-label="上一页" disabled={!count || page === 0} onClick={() => setPage(value => value - 1)}>上一页</button>
        <output aria-label="页码">{count ? page + 1 : 0} / {count}</output>
        <button type="button" aria-label="下一页" disabled={!count || page === count - 1} onClick={() => setPage(value => value + 1)}>下一页</button>
        <button type="button" aria-label="播放" disabled>播放</button><button type="button" aria-label="停止" disabled>停止</button>
      </div>
      <div className="reader-stage" ref={stage}>
        {layout ? <div className="reader-page-frame" style={{ width: styles.pageWidth * scale, height: styles.pageHeight * scale }}>
          <div className="preview" data-ready="true" ref={preview} style={{ width: styles.pageWidth, height: styles.pageHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }} />
        </div> : <p>请选择卡片馆中的 Script JSON。</p>}
      </div>
      {Object.entries(messages).filter(([, text]) => text).map(([source, text]) => <div role="status" className="reader-message" key={source}>
        <span>{text}</span><button type="button" aria-label="关闭提示" onClick={() => reportError(source, '')}>关闭</button>
      </div>)}
    </main>
    {settings && <div className="phase-e-modal-backdrop" onClick={() => setSettings(false)}><section role="dialog" aria-modal="true" aria-labelledby="reader-settings-heading" className="phase-e-modal" onClick={event => event.stopPropagation()}>
      <h2 id="reader-settings-heading">设置</h2><p>当前使用默认阅读布局。文章独立设置将在 A3 实现。</p><button type="button" onClick={() => setSettings(false)}>关闭</button>
    </section></div>}
  </div>;
}
