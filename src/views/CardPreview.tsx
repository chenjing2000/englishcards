import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Layout } from '../services/pagination';

type Props = { layout?: Layout; ready: boolean; jump: React.MouseEventHandler<HTMLDivElement>; actions: ReactNode };
type ZoomAnchor = { card: HTMLElement; y: number; clientY: number };

const PAGE_WIDTH = 1200;
const MANUAL_ZOOM_MIN = 0.2;
const MANUAL_ZOOM_MAX = 1.0;

export default function CardPreview({ layout, ready, jump, actions }: Props) {
  const scroll = useRef<HTMLDivElement>(null), preview = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const currentZoom = useRef(zoom);
  const anchor = useRef<ZoomAnchor | null>(null);

  function updateZoom(next: number, widthLimit: number) {
    const maximumAllowed = Math.min(MANUAL_ZOOM_MAX, widthLimit);
    const minimumAllowed = Math.min(MANUAL_ZOOM_MIN, maximumAllowed);
    const bounded = Math.max(minimumAllowed, Math.min(maximumAllowed, next));
    currentZoom.current = bounded;
    setZoom(bounded);
  }

  function captureViewportCenterAnchor() {
    const element = scroll.current;
    if (!element) return;
    const viewport = element.getBoundingClientRect();
    const clientY = viewport.top + element.clientTop + element.clientHeight / 2;
    const cards = [...(preview.current?.querySelectorAll<HTMLElement>('.card') ?? [])];
    const card = cards.find(node => {
      const rect = node.getBoundingClientRect();
      return rect.top <= clientY && rect.bottom >= clientY;
    }) ?? cards.find(node => node.getBoundingClientRect().bottom > viewport.top);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    anchor.current = { card, y: (clientY - rect.top) / currentZoom.current, clientY };
  }

  function availableCardWidth() {
    const element = scroll.current;
    if (!element) return 0;
    const style = getComputedStyle(element);
    const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    return Math.max(0, element.clientWidth - horizontalPadding);
  }

  // Width constraints are committed to the stored zoom. If the pane becomes
  // narrower, widening it later does not silently restore the previous scale.
  function clampZoomToAvailableWidth() {
    const available = availableCardWidth();
    if (!available) return;
    const maximumAllowed = Math.min(MANUAL_ZOOM_MAX, available / PAGE_WIDTH);
    const next = Math.min(currentZoom.current, maximumAllowed);
    if (Math.abs(next - currentZoom.current) > 0.0005) {
      captureViewportCenterAnchor();
      currentZoom.current = next;
      setZoom(next);
    }
  }

  useLayoutEffect(() => {
    if (!layout) return;
    const wrappers = layout.pages.map(card => {
      const wrapper = document.createElement('div'); wrapper.className = 'card-wrapper';
      wrapper.style.setProperty('--page-width', card.style.width); wrapper.style.setProperty('--page-height', card.style.height);
      wrapper.append(card); return wrapper;
    });
    preview.current!.replaceChildren(...wrappers);
    clampZoomToAvailableWidth();
  }, [layout]);

  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    clampZoomToAvailableWidth();
    const point = anchor.current;
    anchor.current = null;
    if (!point?.card.isConnected) return;
    const rect = point.card.getBoundingClientRect();
    element.scrollTop += rect.top + point.y * zoom - point.clientY;
  }, [zoom]);

  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const observer = new ResizeObserver(() => clampZoomToAvailableWidth());
    observer.observe(element);
    clampZoomToAvailableWidth();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();

      const card = (event.target as HTMLElement).closest<HTMLElement>('.card')
        ?? [...preview.current!.querySelectorAll<HTMLElement>('.card')].find(node => node.getBoundingClientRect().bottom > event.clientY);
      const before = currentZoom.current;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      const available = availableCardWidth();
      const widthLimit = Math.min(MANUAL_ZOOM_MAX, available / PAGE_WIDTH);
      const next = before * Math.exp(-delta * 0.001);
      if (card) {
        const rect = card.getBoundingClientRect();
        anchor.current = { card, y: (event.clientY - rect.top) / before, clientY: event.clientY };
      }
      updateZoom(next, widthLimit);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);

  return <section className="preview-panel" id="preview-panel" aria-label="分页预览">
    <div className="preview-scroll" ref={scroll} tabIndex={0} aria-label="卡片浏览区域" onPointerDown={event => { if (event.button === 0) event.currentTarget.focus({ preventScroll: true }); }}>
      <div className="preview" style={{ '--zoom': zoom } as React.CSSProperties} data-ready={ready} ref={preview} onClick={jump} />
    </div>{actions}
  </section>;
}
