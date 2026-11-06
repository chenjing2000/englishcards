import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export default function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  const workspace = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [width, setWidth] = useState(() => window.innerWidth);
  const [ratio, setRatio] = useState(0.70);
  const [dragging, setDragging] = useState(false);
  const available = Math.max(0, width - 8);
  const minimum = Math.min(320, Math.floor(available / 2));
  const maximum = available - minimum;
  const leftWidth = Math.round(Math.min(maximum, Math.max(minimum, available * ratio)));
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(workspace.current!);
    return () => observer.disconnect();
  }, []);
  function resize(next: number) {
    setRatio(Math.min(maximum, Math.max(minimum, next)) / available);
  }
  function finish() { drag.current = null; setDragging(false); }
  function keyResize(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case 'ArrowLeft': resize(leftWidth - 24); break;
      case 'ArrowRight': resize(leftWidth + 24); break;
      case 'Home': resize(minimum); break;
      case 'End': resize(maximum); break;
      default: return;
    }
    event.preventDefault();
  }
  return <div className="workspace" ref={workspace} data-resizing={dragging} style={{ gridTemplateColumns: `${leftWidth}px 8px minmax(0, 1fr)` }}>
    {left}
    <div className="pane-splitter" role="separator" aria-label="调整编辑与预览宽度" aria-orientation="vertical" tabIndex={0}
      aria-controls="editor-panel preview-panel" aria-valuemin={Math.round(minimum)} aria-valuemax={Math.round(maximum)} aria-valuenow={Math.round(leftWidth)}
      onKeyDown={keyResize}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.currentTarget.focus();
        drag.current = { x: event.clientX, width: leftWidth }; setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => { if (drag.current) resize(drag.current.width + event.clientX - drag.current.x); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); finish(); }}
      onPointerCancel={finish} onLostPointerCapture={finish} />
    {right}
  </div>;
}
