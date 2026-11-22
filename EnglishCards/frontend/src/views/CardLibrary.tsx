import { useEffect, useRef, useState, type ReactNode } from 'react';
import { chooseCardLibrary, listCardDirectory, saveLastCardLibrary, type LibraryDirectory } from '../services/cardLibraryIO';
import plusIcon from '../assets/icons/tree/plus.svg';
import minusIcon from '../assets/icons/tree/minus.svg';

type LibraryProps = {
  settings: ReactNode;
  actions: ReactNode;
  root: string;
  rootContents?: LibraryDirectory;
  onLoaded: (contents: LibraryDirectory) => void;
  activePath: string | null;
  revision: number;
  onRootChange: (path: string, contents: LibraryDirectory) => void;
  onOpen: (path: string) => void;
  onError: (source: string, text: string) => void;
};

function DirectoryNode({
  path, name, activePath, revision, onOpen, onError, onLoaded, initialContents, depth = 0, root = false,
}: {
  path: string;
  name: string;
  activePath: string | null;
  revision: number;
  onOpen: (path: string) => void;
  onError: (source: string, text: string) => void;
  onLoaded: (contents: LibraryDirectory) => void;
  initialContents?: LibraryDirectory;
  depth?: number;
  root?: boolean;
}) {
  const [expanded, setExpanded] = useState(root);
  const [contents, setContents] = useState<LibraryDirectory | null>(null);
  const [loading, setLoading] = useState(false);

  const loaded = useRef(onLoaded);
  loaded.current = onLoaded;
  useEffect(() => {
    const source = `library-directory:${path}`;
    if (!expanded) {
      // ReadArticles behavior: collapsing a folder also resets its descendants.
      setContents(null);
      return;
    }
    if (initialContents) {
      setContents(initialContents);
      setLoading(false);
      loaded.current(initialContents);
      return;
    }
    let cancelled = false;
    setLoading(true);

    void listCardDirectory(path).then(result => {
      if (!cancelled) { setContents(result); loaded.current(result); }
    }).catch(reason => {
      if (!cancelled) onError(source, `无法读取目录：${String(reason)}`);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, expanded, revision, initialContents]);

  const children = expanded && <>
    {loading && <div className="library-muted" style={{ paddingLeft: 20 + depth * 20 }}>正在读取…</div>}
    {contents && <>
      {contents.folders.map(folder =>
        <DirectoryNode key={folder.path} path={folder.path} name={folder.name}
          depth={depth + (root ? 0 : 1)} activePath={activePath} onOpen={onOpen} onError={onError} onLoaded={onLoaded} revision={0} />)}
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

export default function CardLibrary({ root, rootContents, onLoaded, activePath, revision, onRootChange, onOpen, onError, settings, actions }: LibraryProps) {
  const picking = useRef(0);
  useEffect(() => () => { picking.current++; }, []);
  async function pick() {
    const generation = ++picking.current;
    try {
      const selected = await chooseCardLibrary();
      if (generation !== picking.current) return;
      if (selected) {
        // Remember the library only after its directory can actually be opened.
        const contents = await listCardDirectory(selected);
        if (generation !== picking.current) return;
        await saveLastCardLibrary(selected);
        if (generation === picking.current) onRootChange(selected, contents);
      }
    } catch (reason) { if (generation === picking.current) onError('library-picker', `选择目录失败：${String(reason)}`); }
  }

  return <aside className="card-library" aria-label="卡片馆">
    <div className="reader-library-heading"><button type="button" className="choose-library-button"
      onClick={() => void pick()} title={root || '选择卡片馆目录'}>选择卡片馆</button>{settings}</div>
    {root
      ? <div className="library-tree" role="tree" aria-label="JSON 卡片目录树">
          <DirectoryNode key={root} path={root}
            name={root.split(/[\\/]/).filter(Boolean).at(-1) ?? root}
            root initialContents={rootContents} onLoaded={onLoaded} revision={revision} activePath={activePath} onOpen={onOpen} onError={onError} />
        </div>
      : <p className="library-empty">选择卡片馆后，在目录树中打开 JSON 卡片。</p>}
    <div className="reader-library-actions">{actions}</div>
  </aside>;
}
