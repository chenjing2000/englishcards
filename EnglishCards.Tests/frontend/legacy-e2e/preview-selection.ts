import type { Page } from '@playwright/test';

export type PreviewEndpoint = { paragraphId: string; offset: number };

/** Create a real DOM Selection in the paginated left preview and dispatch its mouse-up. */
export async function selectPreviewRange(
  page: Page,
  start: PreviewEndpoint,
  end: PreviewEndpoint,
  requireSameCard = true,
) {
  return page.locator('.preview-scroll').evaluate((scroll, args) => {
    const cards = Array.from(scroll.querySelectorAll<HTMLElement>('.card'));
    function pointInCard(card: HTMLElement, endpoint: PreviewEndpoint) {
      const lines = Array.from(card.querySelectorAll<HTMLElement>('.text-line.article'))
        .filter(line => line.dataset.source === endpoint.paragraphId);
      for (const line of lines) {
        const lineStart = Number(line.dataset.start);
        const lineEnd = Number(line.dataset.end);
        if (endpoint.offset < lineStart || endpoint.offset > lineEnd) continue;
        let remaining = endpoint.offset - lineStart;
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        let node: Node | null, last: Text | null = null;
        while ((node = walker.nextNode())) {
          const text = node as Text;
          last = text;
          if (remaining <= text.data.length) return { node: text, offset: remaining };
          remaining -= text.data.length;
        }
        if (last && remaining === 0) return { node: last, offset: last.data.length };
      }
      return null;
    }

    let startPoint: { node: Node; offset: number } | null = null;
    let endPoint: { node: Node; offset: number } | null = null;
    if (args.requireSameCard) {
      for (const card of cards) {
        const first = pointInCard(card, args.start);
        const last = pointInCard(card, args.end);
        if (first && last) { startPoint = first; endPoint = last; break; }
      }
    } else {
      for (const card of cards) {
        startPoint ??= pointInCard(card, args.start);
        endPoint ??= pointInCard(card, args.end);
      }
    }
    if (!startPoint || !endPoint) return false;
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    scroll.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  }, { start, end, requireSameCard });
}

export async function selectPreviewText(
  page: Page,
  paragraphId: string,
  paragraphText: string,
  selectedText: string,
  occurrence = 0,
) {
  let start = -1;
  let from = 0;
  for (let index = 0; index <= occurrence; index++) {
    start = paragraphText.indexOf(selectedText, from);
    if (start < 0) return false;
    from = start + selectedText.length;
  }
  return selectPreviewRange(
    page,
    { paragraphId, offset: start },
    { paragraphId, offset: start + selectedText.length },
    true,
  );
}
