const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function routeControls(placeId, { editing = false, ids = [] } = {}) {
  if (!editing) return '';
  const included = ids.includes(placeId);
  const attr = `data-route-place="${esc(placeId)}"`;
  return `<div class="route-controls" data-edit-only aria-label="Route 편집">
    <button class="route-control route-r" data-route-action="add" ${attr} aria-label="Route 시작 또는 장소 추가" title="Route 시작 또는 추가" ${included ? 'disabled' : ''}>R</button>
    <button class="route-control" data-route-action="add" ${attr} aria-label="Route에 추가" title="Route에 추가" ${included ? 'disabled' : ''}>+</button>
    <button class="route-control" data-route-action="remove" ${attr} aria-label="작성 중인 Route에서 삭제" title="Route에서 삭제" ${included ? '' : 'disabled'}>−</button>
    <button class="route-control" data-route-action="finish" ${attr} aria-label="Route 종료 및 이름 지정" title="Route 종료 및 저장" ${ids.length ? '' : 'disabled'}>e</button>
    <button class="route-control" data-route-action="cancel" ${attr} aria-label="전체 Route 작업 취소" title="전체 Route 작업 취소" ${ids.length ? '' : 'disabled'}>x</button>
  </div>`;
}

