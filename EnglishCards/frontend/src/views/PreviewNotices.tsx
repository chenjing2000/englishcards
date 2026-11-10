import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Notice = { id: number; kind: 'normal' | 'error'; text: string; source?: string };
type Props = {
  errors: Record<string, string>;
  warning: { text: string } | null;
  closeError: (source: string) => void;
};

/** Phase E notices are contained within the preview, independent of editor scrolling. */
export default function PreviewNotices({ errors, warning, closeError }: Props) {
  const [items, setItems] = useState<Notice[]>([]);
  const nextId = useRef(0);
  const seenWarning = useRef<typeof warning>(null);
  const [placement, setPlacement] = useState({ left: 0, bottom: 16, availableWidth: 360 });

  // A body-level portal stays visible above modal backdrops without losing
  // the preview pane as its visual positioning anchor.
  useLayoutEffect(() => {
    const preview = document.getElementById('preview-panel');
    if (!preview) return;
    const update = () => {
      const rect = preview.getBoundingClientRect();
      const next = {
        left: rect.left + rect.width / 2,
        bottom: Math.max(16, window.innerHeight - rect.bottom + 16),
        availableWidth: Math.max(0, rect.width - 32),
      };
      setPlacement(previous => previous.left === next.left
        && previous.bottom === next.bottom && previous.availableWidth === next.availableWidth
        ? previous : next);
    };
    const observer = new ResizeObserver(update);
    observer.observe(preview);
    window.addEventListener('resize', update);
    window.addEventListener('editor-pane-resize-end', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('editor-pane-resize-end', update);
    };
  }, []);


  useEffect(() => {
    if (!warning || seenWarning.current === warning) return;
    seenWarning.current = warning;
    setItems(current => [...current, { id: ++nextId.current, kind: 'normal', text: warning.text }]);
  }, [warning]);

  // Each active error source has one persistent notice. Clearing its source removes it.
  useEffect(() => {
    setItems(current => {
      const retained = current.filter(item =>
        item.kind === 'normal' || (item.source && errors[item.source] === item.text));
      const present = new Set(retained.filter(item => item.kind === 'error').map(item => item.source));
      const next = Object.entries(errors).reduce<Notice[]>((acc, [source, text]) => {
        if (text && !present.has(source)) acc.push({ id: ++nextId.current, kind: 'error', source, text });
        return acc;
      }, retained);
      return next.length === current.length && next.every((item, index) => item === current[index]) ? current : next;
    });
  }, [errors]);

  function remove(item: Notice) {
    setItems(current => current.filter(entry => entry.id !== item.id));
    if (item.kind === 'error' && item.source) closeError(item.source);
  }

  return createPortal(<div className="phase-e-notices" aria-label="消息通知" aria-live="polite"
    style={{ left: placement.left, bottom: placement.bottom, maxWidth: placement.availableWidth }}>

    {items.map(item => <NoticeItem key={item.id} item={item} onClose={() => remove(item)} />)}
  </div>, document.body);
}

function NoticeItem({ item, onClose }: { item: Notice; onClose: () => void }) {
  const [hover, setHover] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (item.kind === 'error' || hover) return;
    let last = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      setElapsed(current => Math.min(5000, current + delta));
    }, 50);
    return () => clearInterval(tick);
  }, [item.kind, hover]);
  useEffect(() => {
    if (item.kind === 'normal' && elapsed >= 5000) onClose();
  }, [elapsed, item.kind]);
  const ending = item.kind === 'normal' && !hover && elapsed >= 4750;
  return <div className={`phase-e-notice phase-e-notice-${item.kind}${ending ? ' phase-e-notice-ending' : ''}`}
    role={item.kind === 'error' ? 'alert' : 'status'}
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
    <span>{item.text}</span>
    <button type="button" aria-label="关闭消息" title="关闭" onClick={onClose}>×</button>
  </div>;
}
