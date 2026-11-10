import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Layout } from '../services/pagination';
import { isValidVocabularySelection, type Paragraph } from '../models/project';

type Props = { layout?: Layout; ready: boolean; content: Paragraph[]; onAddSelection: (paragraphId: string, start: number, end: number) => void; actions: ReactNode; notices?: ReactNode };
type ActiveSelection = { paragraphId: string; start: number; end: number; left: number; top: number };
type ZoomAnchor = { card: HTMLElement; y: number; clientY: number };

const PAGE_WIDTH = 1200;
const MANUAL_ZOOM_MIN = 0.2;
const MANUAL_ZOOM_MAX = 1.0;

function elementFor(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
}

function offsetWithinLine(line: HTMLElement, node: Node, offset: number): number {
  const prefix = document.createRange();
  prefix.selectNodeContents(line);
  prefix.setEnd(node, offset);
  return prefix.toString().length;
}

function selectionCandidate(selection: Selection | null, content: Paragraph[]): ActiveSelection | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  const startLine = elementFor(range.startContainer)?.closest<HTMLElement>('.text-line');
  const endLine = elementFor(range.endContainer)?.closest<HTMLElement>('.text-line');
  if (!startLine || !endLine || startLine.dataset.kind !== 'article' || endLine.dataset.kind !== 'article') return null;
  const paragraphId = startLine.dataset.source;
  if (!paragraphId || endLine.dataset.source !== paragraphId) return null;
  const card = startLine.closest('.card');
  if (!card || endLine.closest('.card') !== card) return null;
  const paragraph = content.find(item => item.id === paragraphId);
  if (!paragraph) return null;
  const start = Number(startLine.dataset.start) + offsetWithinLine(startLine, range.startContainer, range.startOffset);
  const end = Number(endLine.dataset.start) + offsetWithinLine(endLine, range.endContainer, range.endOffset);
  if (range.toString() !== paragraph.text.slice(start, end) || !isValidVocabularySelection(paragraph.text, start, end)) return null;
  const rects = Array.from(range.getClientRects());
  const rect = rects.at(-1) ?? range.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    paragraphId, start, end,
    left: Math.max(8, Math.min(window.innerWidth - 14, rect.right)),
    top: Math.max(8, Math.min(window.innerHeight - 14, rect.bottom)),
  };
}

export default function CardPreview({ layout, ready, content, onAddSelection, actions, notices }: Props) {
  const scroll = useRef<HTMLDivElement>(null), preview = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [activeSelection, setActiveSelection] = useState<ActiveSelection | null>(null);
  const currentZoom = useRef(zoom);
  const anchor = useRef<ZoomAnchor | null>(null);

  function updateSelection() {
    setActiveSelection(selectionCandidate(window.getSelection(), content));
  }

  useEffect(() => { setActiveSelection(null); }, [layout?.signature]);

  useEffect(() => {
    const hide = () => setActiveSelection(null);
    window.addEventListener('resize', hide);
    return () => window.removeEventListener('resize', hide);
  }, []);

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
    const updateWidth = () => {
      if (element.closest<HTMLElement>('.workspace')?.dataset.resizing === 'true') return;
      clampZoomToAvailableWidth();
    };
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    window.addEventListener('editor-pane-resize-end', updateWidth);
    updateWidth();
    return () => {
      observer.disconnect();
      window.removeEventListener('editor-pane-resize-end', updateWidth);
    };
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
    <div className="preview-scroll" ref={scroll} tabIndex={0} aria-label="卡片浏览区域"
      onPointerDown={event => { if (event.button === 0) event.currentTarget.focus({ preventScroll: true }); }}
      onPointerUp={() => requestAnimationFrame(updateSelection)}
      onMouseUp={() => requestAnimationFrame(updateSelection)}
      onKeyUp={() => requestAnimationFrame(updateSelection)}
      onScroll={() => setActiveSelection(null)}>
      <div className="preview" style={{ '--zoom': zoom } as React.CSSProperties} data-ready={ready} ref={preview} />
    </div>
    {activeSelection && <button type="button" className="selection-add-button" aria-label="将选中文字加入词汇" title="将选中文字加入词汇"
      style={{ left: activeSelection.left, top: activeSelection.top }}
      onMouseDown={event => event.preventDefault()}
      onClick={event => {
        event.stopPropagation();
        onAddSelection(activeSelection.paragraphId, activeSelection.start, activeSelection.end);
        setActiveSelection(null);
        window.getSelection()?.removeAllRanges();
      }}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6" fill="#fff" stroke="#1e90ff" strokeWidth="1.3" />
        <path d="M4 7h6M7 4v6" fill="none" stroke="#1e90ff" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </button>}
    {actions}
    {notices}
  </section>;
}
