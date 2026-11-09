import { useEffect, useRef, useState, type ReactNode } from 'react';

type DragState = {
  pointerId: number;
  startX: number;
  startWidth: number;
  currentWidth: number;
  frame: number | null;
};

export default function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  const workspace = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const [width, setWidth] = useState(() => window.innerWidth);
  const [ratio, setRatio] = useState(0.55);
  const available = Math.max(1, width - 8);
  const minimum = Math.min(280, Math.floor(available / 2));
  const maximum = available - minimum;
  const leftWidth = Math.round(Math.min(maximum, Math.max(minimum, available * ratio)));

  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(workspace.current!);
    return () => observer.disconnect();
  }, []);

  function clamp(next: number) {
    return Math.min(maximum, Math.max(minimum, next));
  }

  function resize(next: number) {
    setRatio(clamp(next) / available);
  }

  function finish() {
    const current = drag.current;
    if (!current) return;
    if (current.frame !== null) cancelAnimationFrame(current.frame);
    drag.current = null;
    const element = workspace.current;
    if (element) element.dataset.resizing = 'false';
    setRatio(clamp(current.currentWidth) / available);
    window.dispatchEvent(new Event('editor-pane-resize-end'));
  }

  return <div className="workspace" ref={workspace} style={{ gridTemplateColumns: `${leftWidth}px 8px minmax(0, 1fr)` }}>
    {left}
    <div className="pane-splitter" role="separator" aria-label="调整编辑与预览宽度" aria-orientation="vertical"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: leftWidth,
          currentWidth: leftWidth,
          frame: null,
        };
        if (workspace.current) workspace.current.dataset.resizing = 'true';
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        current.currentWidth = clamp(current.startWidth + event.clientX - current.startX);
        if (current.frame !== null) return;
        current.frame = requestAnimationFrame(() => {
          const active = drag.current;
          if (!active) return;
          active.frame = null;
          if (workspace.current) {
            workspace.current.style.gridTemplateColumns = `${active.currentWidth}px 8px minmax(0, 1fr)`;
          }
        });
      }}
      onPointerUp={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        finish();
      }}
      onPointerCancel={finish}
      onLostPointerCapture={finish} />
    {right}
  </div>;
}
