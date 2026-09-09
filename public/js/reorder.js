// Pointer and keyboard ordering, scoped to an explicit edit handle.
export function bindReorder(list, onReorder) {
  list._reorderCleanup?.();
  const controller = new AbortController();
  const options = { signal: controller.signal };
  let drag = null;
  let frame = 0;
  let suppressUntil = 0;
  const rows = () => [...list.children].filter(el => el.dataset.id);
  const order = () => rows().map(el => el.dataset.id);
  const restore = ids => ids.forEach(id => {
    const row = rows().find(el => el.dataset.id === id);
    if (row) list.append(row);
  });
  const report = async (before) => {
    const after = order();
    if (after.join('\0') === before.join('\0')) return;
    try { await onReorder(after); }
    catch (error) {
      restore(before);
      list.dispatchEvent(new CustomEvent('reordererror', { detail: error }));
    }
  };
  const position = () => {
    if (!drag) return;
    if (document.body.dataset.editing !== 'true') { finish(true); return; }
    const bounds = list.getBoundingClientRect();
    const edge = 36;
    if (drag.y < bounds.top + edge) list.scrollTop -= 9;
    else if (drag.y > bounds.bottom - edge) list.scrollTop += 9;
    const others = rows().filter(row => row !== drag.row);
    const next = others.find(row => { const rect = row.getBoundingClientRect(); return drag.y < rect.top + rect.height / 2; });
    if (next) list.insertBefore(drag.row, next);
    else list.append(drag.row);
    frame = requestAnimationFrame(position);
  };
  const finish = (cancelled = false) => {
    if (!drag) return;
    const active = drag;
    drag = null;
    cancelAnimationFrame(frame);
    active.row.classList.remove('is-dragging');
    active.handle.setAttribute('aria-grabbed', 'false');
    if (list.hasPointerCapture(active.pointerId)) list.releasePointerCapture(active.pointerId);
    suppressUntil = Date.now() + 400;
    if (cancelled) restore(active.before);
    else void report(active.before);
  };
  list.addEventListener('click', event => {
    if (Date.now() < suppressUntil || event.target.closest('.reorder-handle')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, { ...options, capture: true });
  list.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.reorder-handle');
    if (!handle || document.body.dataset.editing !== 'true' || event.button !== 0 || drag) return;
    event.preventDefault();
    const row = handle.closest('[data-id]');
    drag = { row, handle, pointerId: event.pointerId, before: order(), y: event.clientY };
    list.setPointerCapture(event.pointerId);
    handle.setAttribute('aria-grabbed', 'true');
    row.classList.add('is-dragging');
    frame = requestAnimationFrame(position);
  }, options);
  list.addEventListener('pointermove', event => { if (drag && event.pointerId === drag.pointerId) drag.y = event.clientY; }, options);
  list.addEventListener('pointerup', event => { if (drag && event.pointerId === drag.pointerId) finish(); }, options);
  list.addEventListener('pointercancel', () => finish(true), options);
  list.addEventListener('lostpointercapture', () => finish(true), options);
  list.addEventListener('keydown', event => {
    if (event.key === 'Escape') { finish(true); return; }
    const handle = event.target.closest('.reorder-handle');
    if (!handle || document.body.dataset.editing !== 'true' || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const before = order();
    const row = handle.closest('[data-id]');
    const sibling = event.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling?.dataset.id) return;
    if (event.key === 'ArrowUp') list.insertBefore(row, sibling);
    else list.insertBefore(sibling, row);
    handle.focus();
    void report(before);
  }, options);
  list._reorderCleanup = () => { finish(true); controller.abort(); };
}
