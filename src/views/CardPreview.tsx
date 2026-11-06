import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Layout } from '../services/pagination';

type Props = { layout?: Layout; ready: boolean; jump: React.MouseEventHandler<HTMLDivElement>; actions: ReactNode };
export default function CardPreview({ layout, ready, jump, actions }: Props) {
  const scroll = useRef<HTMLDivElement>(null), preview = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.46), [zoomVisible, setZoomVisible] = useState(false);
  const currentZoom = useRef(zoom), hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const anchor = useRef<{ card: HTMLElement; x: number; y: number; clientX: number; clientY: number } | null>(null);
  useLayoutEffect(() => {
    if (!layout) return;
    const wrappers = layout.pages.map(card => {
      const wrapper = document.createElement('div'); wrapper.className = 'card-wrapper';
      wrapper.style.setProperty('--page-width', card.style.width); wrapper.style.setProperty('--page-height', card.style.height);
      wrapper.append(card); return wrapper;
    });
    preview.current!.replaceChildren(...wrappers);
  }, [layout]);
  useLayoutEffect(() => {
    const point = anchor.current; anchor.current = null;
    if (!point?.card.isConnected) return;
    const rect = point.card.getBoundingClientRect();
    scroll.current!.scrollLeft += rect.left + point.x * zoom - point.clientX;
    scroll.current!.scrollTop += rect.top + point.y * zoom - point.clientY;
  }, [zoom]);
  useEffect(() => {
    const element = scroll.current!;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (!element.contains(document.activeElement)) return;
      const card = (event.target as HTMLElement).closest<HTMLElement>('.card')
        ?? [...preview.current!.querySelectorAll<HTMLElement>('.card')].find(node => node.getBoundingClientRect().bottom > event.clientY);
      const before = currentZoom.current;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      const next = Math.max(0.2, Math.min(2, before * Math.exp(-delta * 0.001)));
      if (card) {
        const rect = card.getBoundingClientRect();
        anchor.current = { card, x: (event.clientX - rect.left) / before, y: (event.clientY - rect.top) / before, clientX: event.clientX, clientY: event.clientY };
      }
      currentZoom.current = next; setZoom(next); setZoomVisible(true);
      clearTimeout(hide.current); hide.current = setTimeout(() => setZoomVisible(false), 1500);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { element.removeEventListener('wheel', wheel); clearTimeout(hide.current); };
  }, []);
  return <section className="preview-panel" id="preview-panel" aria-label="分页预览">
    <div className="zoom-indicator" aria-label="预览缩放比例" aria-hidden={!zoomVisible} data-visible={zoomVisible}>{Math.round(zoom * 100)}%</div>
    <div className="preview-scroll" ref={scroll} tabIndex={0} aria-label="卡片浏览区域" onPointerDown={event => { if (event.button === 0) event.currentTarget.focus({ preventScroll: true }); }}>
      <div className="preview" style={{ '--zoom': zoom } as React.CSSProperties} data-ready={ready} ref={preview} onClick={jump} />
    </div>{actions}
  </section>;
}
