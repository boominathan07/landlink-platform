/**
 * Compute tooltip position so it stays within the viewport.
 * Returns { top, left, placement: 'top'|'bottom'|'left'|'right' }
 */
export function getSmartTooltipPosition(triggerRect, tooltipWidth = 200, tooltipHeight = 180, padding = 8) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const centerX = triggerRect.left + triggerRect.width / 2;
  const centerY = triggerRect.top + triggerRect.height / 2;

  let placement = 'top';
  let top = triggerRect.top - tooltipHeight - padding;
  let left = centerX - tooltipWidth / 2;

  if (top < padding) {
    placement = 'bottom';
    top = triggerRect.bottom + padding;
  }

  if (left + tooltipWidth > vw - padding) {
    left = vw - tooltipWidth - padding;
  }
  if (left < padding) {
    left = padding;
  }

  if (top + tooltipHeight > vh - padding && placement === 'bottom') {
    placement = 'left';
    top = centerY - tooltipHeight / 2;
    left = triggerRect.left - tooltipWidth - padding;
  }

  if (left < padding && placement === 'left') {
    placement = 'right';
    left = triggerRect.right + padding;
  }

  if (top + tooltipHeight > vh - padding) {
    top = vh - tooltipHeight - padding;
  }
  if (top < padding) {
    top = padding;
  }

  return { top, left, placement };
}

export function getTooltipPositionFromCell(cellElement, tooltipWidth = 200, tooltipHeight = 180) {
  if (!cellElement) return { top: 0, left: 0, placement: 'top' };
  const rect = cellElement.getBoundingClientRect();
  return getSmartTooltipPosition(rect, tooltipWidth, tooltipHeight);
}
