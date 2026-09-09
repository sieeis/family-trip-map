import { routeControls } from './route-controls.js';
export { routeControls } from './route-controls.js';
import { UI } from './ui.js';
import { icon } from './icons.js';
import { bindReorder } from './reorder.js';

const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const byId = (ids, places) => ids.map(id => places.find(place => place.id === id)).filter(Boolean);
const orderedList = places => `<ol class="route-ordered-list">${places.map(place => `<li>${esc(place.name)}</li>`).join('')}</ol>`;

export const RouteUI = {
  _callbacks: {},
  init(callbacks) {
    this._callbacks = callbacks;
    document.getElementById('btn-view-groups').addEventListener('click', () => callbacks.onView?.('groups'));
    document.getElementById('btn-view-routes').addEventListener('click', () => callbacks.onView?.('routes'));
    document.getElementById('sort-routes').addEventListener('change', event => callbacks.onSort?.(event.target.value));
    document.getElementById('btn-new-route').addEventListener('click', () => callbacks.onNew?.());
    document.getElementById('route-draft-bar').addEventListener('click', event => {
      const button = event.target.closest('[data-draft-action]');
      if (!button || button.disabled) return;
      if (button.dataset.draftAction === 'finish') callbacks.onFinish?.();
      if (button.dataset.draftAction === 'cancel') callbacks.onCancel?.();
      if (button.dataset.draftAction === 'remove') callbacks.onRemove?.(button.dataset.id);
    });
  },
  setView(view) {
    document.getElementById('group-content').hidden = view !== 'groups';
    document.getElementById('routes-content').hidden = view !== 'routes';
    document.getElementById('btn-view-groups').setAttribute('aria-pressed', String(view === 'groups'));
    document.getElementById('btn-view-routes').setAttribute('aria-pressed', String(view === 'routes'));
  },
  render(routes, currentId, places, editing, sortMode = 'manual') {
    const list = document.getElementById('route-list');
    list._reorderCleanup?.();
    document.getElementById('sort-routes').value = sortMode;
    list.innerHTML = routes.length ? routes.map(route => `<li class="group-item route-item ${route.id === currentId ? 'active' : ''}" data-id="${esc(route.id)}">
      ${editing && sortMode === 'manual' ? `<button class="reorder-handle btn-icon" data-edit-only aria-label="Route 순서 이동" title="드래그 또는 위아래 방향키로 순서 이동">${icon('grip')}</button>` : ''}
      <span class="route-symbol" aria-hidden="true">R</span>
      <button class="route-select group-info" data-route-list-action="select"><span class="group-name">${esc(route.name)}</span><span class="group-meta">${route.placeIds.length}개 장소 · 방문 순서</span></button>
      <button class="btn-icon" data-route-list-action="details" aria-label="Route 정보" title="Route 정보">${icon('info')}</button>
      <div class="group-actions">${editing ? `<button class="btn-icon" data-edit-only data-route-list-action="edit" aria-label="Route 수정" title="Route 수정">${icon('edit')}</button><button class="btn-icon" data-edit-only data-route-list-action="delete" aria-label="Route 삭제" title="Route 삭제">${icon('delete')}</button>` : ''}</div>
    </li>`).join('') : `<li class="empty-state route-empty"><div class="route-symbol" aria-hidden="true">R</div><div class="empty-state-text">저장된 Route가 없습니다</div><p>장소의 R 버튼을 눌러<br>방문할 순서대로 추가하세요.</p></li>`;
    list.onclick = event => {
      const row = event.target.closest('.route-item');
      if (!row || event.target.closest('.reorder-handle')) return;
      const action = event.target.closest('[data-route-list-action]')?.dataset.routeListAction || 'select';
      const route = routes.find(item => item.id === row.dataset.id);
      if (action === 'select') this._callbacks.onSelect?.(route.id);
      if (action === 'edit' && editing) this._callbacks.onEdit?.(route.id);
      if (action === 'delete' && editing) this._callbacks.onDelete?.(route.id);
      if (action === 'details') this._callbacks.onDetails ? this._callbacks.onDetails(route.id) : this.showDetails(route, places, id => this._callbacks.onSelect?.(route.id, id));
    };
    if (editing && sortMode === 'manual') bindReorder(list, ids => this._callbacks.onReorder?.(ids));
    if (list._routeReorderError) list.removeEventListener('reordererror', list._routeReorderError);
    list._routeReorderError = event => UI.showToast(event.detail?.message || 'Route 순서를 저장하지 못했습니다.', 'error');
    list.addEventListener('reordererror', list._routeReorderError);
  },
  renderDraft(ids, places, editing, active = false) {
    const bar = document.getElementById('route-draft-bar');
    bar.hidden = !editing || (!active && ids.length === 0);
    if (bar.hidden) { bar.innerHTML = ''; return; }
    bar.innerHTML = `<div class="route-draft-heading"><span class="route-symbol" aria-hidden="true">R</span><strong role="status" aria-live="polite">${ids.length}개 장소 선택</strong><button class="btn btn-sm btn-primary" data-draft-action="finish" aria-label="Route 종료 및 이름 지정" ${ids.length ? '' : 'disabled'}>e 완료</button><button class="btn btn-sm btn-ghost" data-draft-action="cancel" aria-label="전체 Route 작업 취소">x 취소</button></div>
      ${ids.length ? `<ol class="route-draft-list">${byId(ids, places).map(place => `<li><span>${esc(place.name)}</span><button class="btn-icon" data-draft-action="remove" data-id="${esc(place.id)}" aria-label="${esc(place.name)} Route에서 삭제">−</button></li>`).join('')}</ol>` : '<p class="route-modal-help">그룹에서 장소를 골라 R 또는 +를 누르세요.</p>'}`;
  },
  showNameModal(route, orderedPlaces, onSave) {
    if (!UI._editing || UI._saving) return;
    UI._openModal(`<div class="modal-header"><span class="modal-title">${route ? 'Route 수정' : 'Route 만들기'}</span><button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button></div>
      <div class="modal-body"><div class="form-group"><label for="rf-name" class="form-label">Route 이름 *</label><input id="rf-name" class="form-input" maxlength="200" value="${esc(route?.name || '')}" placeholder="예: 주말 맛집 산책" required /></div><p class="route-modal-help">${orderedPlaces.length}개 장소를 아래 순서대로 방문합니다. 그룹과 관계없이 저장됩니다.</p>${orderedList(orderedPlaces)}</div>
      <div class="modal-footer"><button class="btn btn-ghost" id="modal-cancel-btn">취소</button><button class="btn btn-primary" id="modal-save-btn">${route ? '수정 완료' : 'Route 만들기'}</button></div>`);
    const input = document.getElementById('rf-name');
    const save = document.getElementById('modal-save-btn');
    input.focus();
    input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); save.click(); } });
    save.addEventListener('click', async () => {
      if (save.disabled || !UI._editing) return;
      const name = input.value.trim();
      if (!name) { UI.showToast('Route 이름을 입력해주세요.', 'error'); input.focus(); return; }
      save.disabled = true;
      UI._saving = true;
      try {
        await onSave({ name, placeIds: orderedPlaces.map(place => place.id) });
        UI._saving = false;
        UI.closeModal();
      } catch (error) { UI.showToast(error.message || 'Route를 저장하지 못했습니다. 다시 시도해주세요.', 'error'); }
      finally { UI._saving = false; save.disabled = false; }
    });
  },
  showDetails(route, places, onSelect) {
    if (UI._saving) return;
    const ordered = byId(route.placeIds, places);
    UI._openModal(`<div class="modal-header"><span class="modal-title">${esc(route.name)}</span><button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button></div><div class="modal-body"><p class="route-modal-help">${ordered.length}개 장소 · 방문 순서</p><ol class="route-ordered-list">${ordered.map(place => `<li><button class="route-detail-place" data-route-detail-place="${esc(place.id)}">${esc(place.name)}</button>${place.address ? `<p class="route-modal-help">${esc(place.address)}</p>` : ''}</li>`).join('')}</ol></div><div class="modal-footer"><button id="modal-cancel-btn" class="btn btn-ghost">닫기</button></div>`);
    document.querySelectorAll('[data-route-detail-place]').forEach(button => button.addEventListener('click', () => { UI.closeModal(); onSelect?.(button.dataset.routeDetailPlace); }));
  },
  routeControls,
};
