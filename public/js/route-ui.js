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
      if (button.dataset.draftAction === 'edit') callbacks.onEditDraft?.();
      if (button.dataset.draftAction === 'up') callbacks.onMove?.(button.dataset.id, -1);
      if (button.dataset.draftAction === 'down') callbacks.onMove?.(button.dataset.id, 1);
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
  renderDraft(ids, places, editing, active = false, editingRoute = null) {
    const bar = document.getElementById('route-draft-bar');
    bar.hidden = !editing || (!active && !editingRoute && ids.length === 0);
    if (bar.hidden) { bar.innerHTML = ''; return; }
    const ordered = byId(ids, places);
    bar.innerHTML = `<div class="route-draft-heading"><span class="route-symbol" aria-hidden="true">R</span><strong role="status" aria-live="polite">${editingRoute ? `<span class="route-draft-name">${esc(editingRoute.name)}</span><span class="route-draft-state">수정 중 · ${ids.length}개 장소</span>` : `${ids.length}개 장소 선택`}</strong><button class="btn btn-sm btn-primary" data-draft-action="finish" aria-label="${editingRoute ? 'Route 수정 저장' : 'Route 종료 및 이름 지정'}" ${ids.length || editingRoute ? '' : 'disabled'}>e ${editingRoute ? '저장' : '완료'}</button><button class="btn btn-sm btn-ghost" data-draft-action="cancel" aria-label="전체 Route 작업 취소">x 취소</button></div>
      ${editingRoute ? `<div class="route-draft-tools"><p class="route-modal-help">R/+ 추가 · − 제거 · ↑↓ 순서 · e 저장 · x 취소</p><button class="btn btn-sm btn-ghost" data-draft-action="edit">${icon('edit')} 목록에서 수정</button></div>` : ''}
      ${ordered.length ? `<ol class="route-draft-list" aria-label="Route 방문 순서">${ordered.map((place, index) => `<li><div class="route-draft-place"><span class="route-draft-place-name">${esc(place.name)}</span><div class="route-draft-actions"><button class="btn-icon" data-draft-action="up" data-id="${esc(place.id)}" aria-label="${esc(place.name)} 위로" ${index === 0 ? 'disabled' : ''}>↑</button><button class="btn-icon" data-draft-action="down" data-id="${esc(place.id)}" aria-label="${esc(place.name)} 아래로" ${index === ordered.length - 1 ? 'disabled' : ''}>↓</button><button class="btn-icon" data-draft-action="remove" data-id="${esc(place.id)}" aria-label="${esc(place.name)} Route에서 삭제">−</button></div></div></li>`).join('')}</ol>` : '<p class="route-modal-help">그룹에서 장소를 골라 R 또는 +를 누르세요.</p>'}`;
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
  showEditModal(route, allPlaces, groups, onSave, onMapEdit) {
    if (!UI._editing || UI._saving) return;
    const places = new Map(allPlaces.map(place => [place.id, place]));
    const groupNames = new Map(groups.map(group => [group.id, group.name]));
    let selected = [...new Set(route.placeIds)].filter(id => places.has(id));
    let saving = false;
    UI._openModal(`<div class="modal-header"><span class="modal-title" id="route-edit-title">Route 수정</span><button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button></div>
      <div class="modal-body route-editor"><div class="form-group"><label for="rf-name" class="form-label">Route 이름 *</label><input id="rf-name" class="form-input" maxlength="200" value="${esc(route.name)}" required /></div>
      ${onMapEdit ? `<div class="route-editor-map-entry"><button id="btn-route-edit-map" class="btn btn-primary">${icon('map')} 지도에서 수정</button><p class="route-modal-help">현재 변경 내용을 이어서 지도 핀으로 장소를 추가하거나 뺄 수 있습니다.</p></div>` : ''}
      <section aria-labelledby="route-edit-order-title"><h3 id="route-edit-order-title" class="route-editor-heading">방문 순서 <span id="route-edit-count"></span></h3><p class="route-modal-help">위아래 버튼이나 손잡이를 드래그해 순서를 바꾸세요. 손잡이에 초점을 두고 방향키로도 이동할 수 있습니다.</p><ol id="route-edit-list" class="route-edit-list" aria-label="방문할 장소 순서"></ol></section>
      <section class="route-editor-add" aria-labelledby="route-edit-add-title"><h3 id="route-edit-add-title" class="route-editor-heading">장소 추가</h3><p class="route-modal-help">모든 그룹에서 장소를 찾아 추가할 수 있습니다. 선택한 장소는 마지막 순서에 추가됩니다.</p><div class="route-editor-filters"><div><label for="route-place-search" class="form-label">장소 검색</label><input id="route-place-search" class="form-input" type="search" placeholder="장소 이름 또는 주소" /></div><div><label for="route-place-group" class="form-label">그룹</label><select id="route-place-group" class="form-select"><option value="">모든 그룹</option>${groups.map(group => `<option value="${esc(group.id)}">${esc(group.name)}</option>`).join('')}</select></div></div><p id="route-place-result-count" class="route-modal-help" role="status" aria-live="polite"></p><ul id="route-place-results" class="route-place-results" aria-label="추가할 수 있는 장소"></ul></section>
      <p id="route-edit-status" class="route-modal-help" role="status" aria-live="polite"></p></div><div class="modal-footer"><button class="btn btn-ghost" id="modal-cancel-btn">취소</button><button class="btn btn-primary" id="modal-save-btn">수정 완료</button></div>`);
    const modal = document.getElementById('modal-content');
    const list = document.getElementById('route-edit-list');
    const results = document.getElementById('route-place-results');
    const search = document.getElementById('route-place-search');
    const group = document.getElementById('route-place-group');
    const nameInput = document.getElementById('rf-name');
    const save = document.getElementById('modal-save-btn');
    const status = document.getElementById('route-edit-status');
    const placeText = place => `<span class="route-editor-place-name">${esc(place.name)}</span><span class="route-editor-place-meta">${esc(groupNames.get(place.groupId) || '그룹 없음')}${place.address ? ` · ${esc(place.address)}` : ''}</span>`;
    const focusAction = (id, action) => [...list.querySelectorAll('button')].find(button => (button.dataset.id || button.closest('li')?.dataset.id) === id && (action === 'handle' ? button.classList.contains('reorder-handle') : button.dataset.routeEditAction === action))?.focus();
    const renderSelected = () => {
      list._reorderCleanup?.();
      document.getElementById('route-edit-count').textContent = `${selected.length}개 장소`;
      list.innerHTML = selected.length ? selected.map((id, index) => {
        const place = places.get(id);
        return `<li class="route-edit-row" data-id="${esc(id)}"><button class="reorder-handle btn-icon" aria-label="${esc(place.name)} 순서 이동" title="드래그 또는 위아래 방향키로 이동">${icon('grip')}</button><span class="route-editor-number" aria-label="${index + 1}번째">${index + 1}</span><div class="route-editor-place">${placeText(place)}</div><div class="route-editor-actions"><button class="btn-icon" data-route-edit-action="up" data-id="${esc(id)}" aria-label="${esc(place.name)} 위로" ${index === 0 ? 'disabled' : ''}>↑</button><button class="btn-icon" data-route-edit-action="down" data-id="${esc(id)}" aria-label="${esc(place.name)} 아래로" ${index === selected.length - 1 ? 'disabled' : ''}>↓</button><button class="btn-icon" data-route-edit-action="remove" data-id="${esc(id)}" aria-label="${esc(place.name)} Route에서 삭제">−</button></div></li>`;
      }).join('') : '<li class="route-editor-empty">방문할 장소가 없습니다. 아래에서 장소를 추가하세요.</li>';
      bindReorder(list, ids => {
        if (saving || !UI._editing) return;
        const focusedId = document.activeElement?.closest('li')?.dataset.id;
        selected = ids;
        renderSelected();
        if (focusedId) focusAction(focusedId, 'handle');
        status.textContent = '방문 순서를 변경했습니다. 수정 완료를 눌러 저장하세요.';
      });
    };
    const renderResults = () => {
      const query = search.value.trim().toLocaleLowerCase();
      const chosen = new Set(selected);
      const matches = allPlaces.filter(place => !chosen.has(place.id) && (!group.value || place.groupId === group.value) && (!query || `${place.name} ${place.address || ''}`.toLocaleLowerCase().includes(query)));
      document.getElementById('route-place-result-count').textContent = matches.length > 100 ? `${matches.length}개 중 100개 표시 · 검색이나 그룹으로 범위를 좁혀주세요.` : `추가 가능한 장소 ${matches.length}개`;
      results.innerHTML = matches.length ? matches.slice(0, 100).map(place => `<li class="route-place-result"><div class="route-editor-place">${placeText(place)}</div><button class="btn btn-sm btn-ghost" data-route-edit-action="add" data-id="${esc(place.id)}" aria-label="${esc(place.name)} Route에 추가">+ 추가</button></li>`).join('') : '<li class="route-editor-empty">추가할 장소가 없습니다.</li>';
    };
    const controller = new AbortController();
    modal.addEventListener('click', event => {
      const button = event.target.closest('[data-route-edit-action]');
      if (!button || button.disabled || saving || !UI._editing) return;
      const { id, routeEditAction: action } = button.dataset;
      const index = selected.indexOf(id);
      if (action === 'add' && index === -1 && places.has(id)) selected.push(id);
      else if (action === 'remove' && index >= 0) selected.splice(index, 1);
      else if (action === 'up' && index > 0) [selected[index - 1], selected[index]] = [selected[index], selected[index - 1]];
      else if (action === 'down' && index >= 0 && index < selected.length - 1) [selected[index + 1], selected[index]] = [selected[index], selected[index + 1]];
      else return;
      renderSelected();
      renderResults();
      if (action === 'add') { focusAction(id, 'handle'); status.textContent = `${places.get(id).name}을(를) ${selected.length}번째 장소로 추가했습니다.`; }
      else if (action === 'remove') { const nextId = selected[Math.min(index, selected.length - 1)]; if (nextId) focusAction(nextId, 'handle'); else search.focus(); status.textContent = `${places.get(id).name}을(를) Route에서 삭제했습니다.`; }
      else { focusAction(id, 'handle'); status.textContent = `${places.get(id).name}의 방문 순서를 ${selected.indexOf(id) + 1}번째로 변경했습니다.`; }
    }, { signal: controller.signal });
    UI._onModalClose = () => { list._reorderCleanup?.(); controller.abort(); };
    search.addEventListener('input', renderResults);
    group.addEventListener('change', renderResults);
    document.getElementById('btn-route-edit-map')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      if (saving || UI._saving || !UI._editing || button.disabled) return;
      const name = nameInput.value.trim();
      if (!name) { UI.showToast('Route 이름을 입력해주세요.', 'error'); nameInput.focus(); return; }
      saving = true;
      const controls = [...modal.querySelectorAll('button, input, select')].map(control => [control, control.disabled]);
      controls.forEach(([control]) => { control.disabled = true; });
      try {
        // The callback owns confirmation and modal closure; declining keeps this editor intact.
        await onMapEdit({ name, placeIds: [...selected] });
      } catch (error) {
        UI.showToast(error.message || '지도 수정을 시작하지 못했습니다.', 'error');
      } finally {
        saving = false;
        controls.forEach(([control, disabled]) => { control.disabled = disabled; });
      }
    });
    nameInput.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); save.click(); } });
    save.addEventListener('click', async () => {
      if (saving || !UI._editing) return;
      const name = nameInput.value.trim();
      if (!name) { UI.showToast('Route 이름을 입력해주세요.', 'error'); nameInput.focus(); return; }
      saving = true;
      UI._saving = true;
      list._reorderCleanup?.();
      const controls = [...modal.querySelectorAll('button, input, select')].map(control => [control, control.disabled]);
      controls.forEach(([control]) => { control.disabled = true; });
      save.textContent = '저장 중…';
      try {
        await onSave({ name, placeIds: [...selected] });
        UI._saving = false;
        UI.closeModal();
      } catch (error) {
        UI.showToast(error.message || 'Route를 저장하지 못했습니다. 다시 시도해주세요.', 'error');
        status.textContent = '저장하지 못했습니다. 변경 내용은 유지됩니다. 다시 시도해주세요.';
        renderSelected();
      } finally {
        saving = false;
        UI._saving = false;
        controls.forEach(([control, disabled]) => { control.disabled = disabled; });
        save.textContent = '수정 완료';
      }
    });
    renderSelected();
    renderResults();
    nameInput.focus();
  },
  showDetails(route, places, onSelect) {
    if (UI._saving) return;
    const ordered = byId(route.placeIds, places);
    UI._openModal(`<div class="modal-header"><span class="modal-title">${esc(route.name)}</span><button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button></div><div class="modal-body"><p class="route-modal-help">${ordered.length}개 장소 · 방문 순서</p><ol class="route-ordered-list">${ordered.map(place => `<li><button class="route-detail-place" data-route-detail-place="${esc(place.id)}">${esc(place.name)}</button>${place.address ? `<p class="route-modal-help">${esc(place.address)}</p>` : ''}</li>`).join('')}</ol></div><div class="modal-footer"><button id="modal-cancel-btn" class="btn btn-ghost">닫기</button></div>`);
    document.querySelectorAll('[data-route-detail-place]').forEach(button => button.addEventListener('click', () => { UI.closeModal(); onSelect?.(button.dataset.routeDetailPlace); }));
  },
  routeControls,
};
