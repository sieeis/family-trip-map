export const shortName = name => {
  const letters = Array.from(name || '');
  return letters.slice(0, 6).join('') + (letters.length > 6 ? '…' : '');
};
export const overlaps = (a, b, gap = 6) => a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;
export function availableLabels(rows, bounds, obstacles = [], selectedId = null) {
  const selected = rows.find(row => selectedId && row.place?.id === selectedId);
  const visible = rows.filter(row => row !== selected && row.box.left >= bounds.left && row.box.right <= bounds.right && row.box.top >= bounds.top && row.box.bottom <= bounds.bottom &&
    !obstacles.some(box => overlaps(row.box, box)) &&
    !rows.some(other => other !== row && (overlaps(row.box, other.box) || overlaps(row.box, other.pin) || overlaps(row.pin, other.pin))));
  if (selected) {
    const width = selected.box.right - selected.box.left;
    const height = selected.box.bottom - selected.box.top;
    const left = Math.max(bounds.left + 4, Math.min(selected.box.left, bounds.right - width - 4));
    const top = Math.max(bounds.top + 4, Math.min(selected.box.top, bounds.bottom - height - 4));
    const box = {left,top,right:left+width,bottom:top+height};
    return [...visible.filter(row => !overlaps(row.box, box)), {...selected, box, selected:true}];
  }
  return visible;
}
