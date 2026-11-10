import { useEffect, useState } from 'react';
import { chooseCardLibrary, listCardDirectory, type LibraryDirectory } from '../services/cardFileIO';

type LibraryProps = {
  root: string;
  activePath: string | null;
  revision: number;
  onRootChange: (path: string) => void;
  onOpen: (path: string) => void;
};

function DirectoryNode({
  path, name, activePath, revision, onOpen, depth = 0, root = false,
}: {
  path: string;
  name: string;
  activePath: string | null;
  revision: number;
  onOpen: (path: string) => void;
  depth?: number;
  root?: boolean;
}) {
  const [expanded, setExpanded] = useState(root);
  const [contents, setContents] = useState<LibraryDirectory | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void listCardDirectory(path).then(result => {
      if (!cancelled) setContents(result);
    }).catch(reason => {
      if (!cancelled) setError(`无法读取目录：${String(reason)}`);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, expanded, revision]);

  return <div className="library-node">
    <button type="button" className="library-folder" aria-expanded={expanded}
      aria-label={`目录 ${name}`} style={{ paddingLeft: 10 + depth * 14 }}
      onClick={() => setExpanded(value => !value)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span><span title={path}>{name}</span>
    </button>
    {expanded && <>
      {loading && <div className="library-muted" style={{ paddingLeft: 24 + depth * 14 }}>正在读取…</div>}
      {error && <div className="library-error" role="alert">{error}</div>}
      {contents && <>
        {contents.folders.map(folder =>
          <DirectoryNode key={folder.path} path={folder.path} name={folder.name}
            depth={depth + 1} activePath={activePath} onOpen={onOpen} revision={revision} />)}
        {contents.files.map(file => <button type="button" key={file.path}
          className="library-file" aria-current={activePath === file.path ? 'page' : undefined}
          title={file.path} style={{ paddingLeft: 26 + depth * 14 }}
          onClick={() => onOpen(file.path)}>{file.name}</button>)}
        {!loading && contents.folders.length === 0 && contents.files.length === 0 &&
          <div className="library-muted" style={{ paddingLeft: 26 + depth * 14 }}>空目录</div>}
      </>}
    </>}
  </div>;
}

export default function CardLibrary({ root, activePath, revision, onRootChange, onOpen }: LibraryProps) {
  const [pickerError, setPickerError] = useState('');
  const [refresh, setRefresh] = useState(0);
  async function pick() {
    try {
      const selected = await chooseCardLibrary();
      if (selected) { onRootChange(selected); setPickerError(''); }
    } catch (reason) { setPickerError(`选择目录失败：${String(reason)}`); }
  }
  return <aside className="card-library" aria-label="卡片馆">
    <header className="library-heading">
      <h2>卡片馆</h2>
      <div className="library-controls">
        <button type="button" onClick={() => void pick()} aria-label="选择卡片馆目录" title="选择目录">选择目录</button>
        <button type="button" onClick={() => setRefresh(value => value + 1)}
          aria-label="刷新卡片馆" title="刷新" disabled={!root}>刷新</button>
      </div>
    </header>
    {pickerError && <p className="library-error" role="alert">{pickerError}</p>}
    {root
      ? <div className="library-tree" role="tree" aria-label="JSON 卡片目录树">
          <DirectoryNode key={root} path={root} name={root.split(/[\\/]/).filter(Boolean).at(-1) ?? root}
            root revision={revision + refresh} activePath={activePath} onOpen={onOpen} />
        </div>
      : <p className="library-empty">选择一个文件夹，即可浏览其中的 JSON 卡片。</p>}
  </aside>;
}
