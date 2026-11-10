import { useEffect, useState } from 'react';
import { chooseCardLibrary, listCardDirectory, type LibraryDirectory } from '../services/cardFileIO';
import plusIcon from '../assets/icons/tree/plus.svg';
import minusIcon from '../assets/icons/tree/minus.svg';

type LibraryProps = {
  root: string;
  activePath: string | null;
  revision: number;
  onRootChange: (path: string) => void;
  onOpen: (path: string) => void;
  onError: (source: string, text: string) => void;
};

function DirectoryNode({
  path, name, activePath, revision, onOpen, onError, depth = 0, root = false,
}: {
  path: string;
  name: string;
  activePath: string | null;
  revision: number;
  onOpen: (path: string) => void;
  onError: (source: string, text: string) => void;
  depth?: number;
  root?: boolean;
}) {
  const [expanded, setExpanded] = useState(root);
  const [contents, setContents] = useState<LibraryDirectory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const source = `library-directory:${path}`;
    if (!expanded) {
      // ReadArticles behavior: collapsing a folder also resets its descendants.
      setContents(null);
      onError(source, '');
      return;
    }
    let cancelled = false;
    setLoading(true);
    onError(source, '');
    void listCardDirectory(path).then(result => {
      if (!cancelled) setContents(result);
    }).catch(reason => {
      if (!cancelled) onError(source, `无法读取目录：${String(reason)}`);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, expanded, revision]);

  const children = expanded && <>
    {loading && <div className="library-muted" style={{ paddingLeft: 20 + depth * 20 }}>正在读取…</div>}
    {contents && <>
      {((root && path.replaceAll(String.fromCharCode(92), '/').toLowerCase().endsWith('/userdata'))
        ? contents.folders.filter(folder => !new Set(['cache', 'drafts', 'exports', 'temp', 'logs', 'settings'])
          .has(folder.name.toLowerCase()))
        : contents.folders).map(folder =>
        <DirectoryNode key={folder.path} path={folder.path} name={folder.name}
          depth={depth + (root ? 0 : 1)} activePath={activePath} onOpen={onOpen} onError={onError} revision={revision} />)}
      {contents.files.map(file => <button type="button" key={file.path}
        className="library-file" aria-current={activePath === file.path ? 'page' : undefined}
        title={file.path} style={{ paddingLeft: 20 + (depth + (root ? 0 : 1)) * 20 }}
        onClick={() => onOpen(file.path)}>{file.name}</button>)}
    </>}
  </>;

  if (root) return <div className="library-node library-root">{children}</div>;
  return <div className="library-node">
    <button type="button" className="library-folder" aria-expanded={expanded}
      aria-label={`目录 ${name}`} title={path}
      style={{ paddingLeft: depth * 20 }}
      onClick={() => setExpanded(value => !value)}>
      <img src={expanded ? minusIcon : plusIcon} alt="" className="library-expander" />
      <span className="library-folder-name">{name}</span>
    </button>
    {children}
  </div>;
}

export default function CardLibrary({ root, activePath, revision, onRootChange, onOpen, onError }: LibraryProps) {
  async function pick() {
    try {
      const selected = await chooseCardLibrary();
      if (selected) { onRootChange(selected); onError('library-picker', ''); }
    } catch (reason) { onError('library-picker', `选择目录失败：${String(reason)}`); }
  }

  return <aside className="card-library" aria-label="卡片馆">
    <button type="button" className="choose-library-button"
      onClick={() => void pick()} title={root || '选择卡片馆目录'}>选择卡片馆</button>
    {root
      ? <div className="library-tree" role="tree" aria-label="JSON 卡片目录树">
          <DirectoryNode key={root} path={root}
            name={root.split(/[\\/]/).filter(Boolean).at(-1) ?? root}
            root revision={revision} activePath={activePath} onOpen={onOpen} onError={onError} />
        </div>
      : <p className="library-empty">选择卡片馆后，在目录树中打开 JSON 卡片。</p>}
  </aside>;
}
