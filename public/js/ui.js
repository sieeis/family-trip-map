// public/js/ui.js
import { routeControls } from './route-controls.js';
import { categoryColor, placeColor } from './place-colors.js';
import { placeLink } from './place-link.js';
import { normalizeImageUrls } from './image-links.js';
import { linkTitleFallback, loadLinkTitles } from './link-titles.js';
import { icon, categoryIcon } from './icons.js';
import { Parser } from './parser.js';
import { bindReorder } from './reorder.js';

const CATEGORIES = ['맛집', '관광지', '숙소', '체험/액티비티', '카페/디저트', '쇼핑', '기타'];
const groupSymbol = value => ({ '🗺️': 'map', '🏯': 'sight', '🌊': 'activity', '🌸': 'cafe', '🏔️': 'sight', '🌴': 'activity', '🏙️': 'hotel', '🎡': 'activity' }[value] || value || 'map');

export const UI = {
  _editing: false,
  _saving: false,
  setEditing(editing) {
    this._editing = Boolean(editing);
    document.body.dataset.editing = String(this._editing);
    const button = document.getElementById('btn-edit-mode');
    button.setAttribute('aria-pressed', String(this._editing));
    button.innerHTML = icon(this._editing ? 'unlock' : 'lock');
    button.title = this._editing ? '편집 잠금' : '편집 잠금 해제';
    button.setAttribute('aria-label', button.title);
    document.querySelectorAll('[data-action][data-edit-only]').forEach(el => { el.hidden = !this._editing; });
    if (!this._editing && document.getElementById('modal-save-btn')) this.closeModal();
  },
  // ── 그룹 렌더링 ─────────────────────────────────
  renderGroups(groups, currentGroupId, callbacks) {
    const list = document.getElementById('group-list');
    list._reorderCleanup?.();
    if (groups.length === 0) {
      list.innerHTML = `<li class="empty-state" style="height:auto;padding:24px 12px;">
        <div class="empty-state-icon">${icon('map')}</div>
        <div class="empty-state-text">그룹 없음</div>
      </li>`;
      return;
    }
    list.innerHTML = groups.map(g => `
      <li class="group-item ${g.id === currentGroupId ? 'active' : ''}" data-id="${esc(g.id)}">
        <button class="reorder-handle btn-icon" data-edit-only aria-label="그룹 순서 이동" title="드래그 또는 위아래 방향키로 순서 이동">${icon('grip')}</button>
        <span class="group-emoji">${icon(groupSymbol(g.coverEmoji))}</span>
        <div class="group-info">
          <div class="group-name">${esc(g.name)}</div>
          <div class="group-meta">${esc(g.region || '')} ${esc(g.startDate ? String(g.startDate).slice(0, 7) : '')}</div>
        </div>
        <button class="btn-icon group-details" data-action="view-group" data-id="${esc(g.id)}" aria-label="그룹 정보" title="그룹 정보">${icon('info')}</button>
        <div class="group-actions">
          <button class="btn-icon" data-edit-only ${this._editing ? '' : 'hidden'} data-action="edit-group" data-id="${esc(g.id)}" title="수정">${icon('edit')}</button>
          <button class="btn-icon" data-edit-only ${this._editing ? '' : 'hidden'} data-action="delete-group" data-id="${esc(g.id)}" title="삭제">${icon('delete')}</button>
        </div>
      </li>
    `).join('');

    this._bindReorder(list, callbacks);
    list.querySelectorAll('.group-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action], [data-route-action], .reorder-handle')) return;
        callbacks.onSelect(el.dataset.id);
      });
    });
    list.querySelectorAll('[data-action="view-group"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onDetails?.(el.dataset.id); }));
    list.querySelectorAll('[data-action="edit-group"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onEdit(el.dataset.id); }));
    list.querySelectorAll('[data-action="delete-group"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onDelete(el.dataset.id); }));
  },

  _bindReorder(list, callbacks) {
    bindReorder(list, ids => callbacks.onReorder?.(ids));
    list.onreordererror = null;
    if (list._reorderErrorListener) list.removeEventListener('reordererror', list._reorderErrorListener);
    list._reorderErrorListener = event => this.showToast(event.detail?.message || '순서를 저장하지 못했습니다.', 'error');
    list.addEventListener('reordererror', list._reorderErrorListener);
  },

  setCurrentGroupName(name) {
    document.getElementById('current-group-name').textContent = name || '그룹을 선택하세요';
    const btn = document.getElementById('btn-add-place');
    const filter = document.getElementById('filter-bar');
    if (name) {
      btn.style.display = 'inline-block';
      filter.style.display = 'flex';
    } else {
      btn.style.display = 'none';
      filter.style.display = 'none';
    }
  },

  // ── 장소 렌더링 ─────────────────────────────────
  renderPlaces(places, callbacks) {
    const list = document.getElementById('place-list');
    list._reorderCleanup?.();
    if (places.length === 0) {
      list.innerHTML = `<li class="empty-state">
        <div class="empty-state-icon">${icon('pin')}</div>
        <div class="empty-state-text">장소 없음</div>
      </li>`;
      return;
    }
    list.innerHTML = places.map(p => `
      <li class="place-item ${p.visited ? 'visited' : ''}" data-id="${esc(p.id)}" style="--place-category-color:${categoryColor(p)}">
        <div class="place-header">
          <button class="reorder-handle btn-icon" data-edit-only aria-label="장소 순서 이동" title="드래그 또는 위아래 방향키로 순서 이동">${icon('grip')}</button>
          <span class="place-name" style="--place-color:${placeColor(p)}">${categoryIcon(p.category)} ${esc(p.name)}</span>
          <div class="place-actions">
            <button class="btn-icon" data-edit-only ${this._editing ? '' : 'hidden'} data-action="edit-place" data-id="${esc(p.id)}" title="수정">${icon('edit')}</button>
            <button class="btn-icon" data-edit-only ${this._editing ? '' : 'hidden'} data-action="delete-place" data-id="${esc(p.id)}" title="삭제">${icon('delete')}</button>
          </div>
        </div>
        <span class="place-category">${esc(p.category)}</span>
        ${callbacks.routeIds?.includes(p.id) ? `<span class="route-order-badge">${callbacks.routeIds.indexOf(p.id) + 1}번</span>` : ''}
        ${routeControls(p.id, {editing: callbacks.routeEditing, ids: callbacks.draftIds || []})}
        ${p.address ? `<div class="place-address">${esc(p.address)}</div>` : ''}
        ${p.tags?.length ? `<div class="place-tags">${p.tags.map(t => `<span class="place-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${p.visited ? `<div class="place-visited-badge">${icon('check')} 방문완료</div>` : ''}
      </li>
    `).join('');

    this._bindReorder(list, callbacks);
    list.querySelectorAll('.place-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action], [data-route-action], .reorder-handle')) return;
        callbacks.onSelect(el.dataset.id);
      });
    });
    list.querySelectorAll('[data-action="edit-place"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onEdit(el.dataset.id); }));
    list.querySelectorAll('[data-action="delete-place"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onDelete(el.dataset.id); }));
  },

  // ── 그룹 모달 ───────────────────────────────────
  showGroupModal(group, onSave) {
    if (!this._editing || this._saving) return;
    const isEdit = !!group;
    const emojis = ['map', 'sight', 'hotel', 'activity', 'cafe', 'shopping'];
    this._openModal(`
      <div class="modal-header">
        <span class="modal-title">${isEdit ? '그룹 수정' : '새 여행 그룹'}</span>
        <button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">그룹 아이콘</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${emojis.map(e => `<button type="button" class="emoji-btn" data-emoji="${e}" style="
              font-size:24px;width:40px;height:40px;border-radius:8px;border:2px solid transparent;
              cursor:pointer;background:var(--color-bg);
              ${groupSymbol(group?.coverEmoji) === e ? 'border-color:var(--color-primary);' : ''}
            " aria-label="그룹 아이콘 ${e}">${icon(e)}</button>`).join('')}
          </div>
          <input type="hidden" id="gf-emoji" value="${esc(group?.coverEmoji || '🗺️')}" />
        </div>
        <div class="form-group">
          <label class="form-label">여행 이름 *</label>
          <input class="form-input" id="gf-name" value="${esc(group?.name || '')}" placeholder="예: 2026 가을 경주 여행" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">목적/테마</label>
            <input class="form-input" id="gf-purpose" value="${esc(group?.purpose || '')}" placeholder="관광, 스키, 맛집투어..." />
          </div>
          <div class="form-group">
            <label class="form-label">지역</label>
            <input class="form-input" id="gf-region" value="${esc(group?.region || '')}" placeholder="경상북도 경주" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">시작일</label>
            <input class="form-input" type="date" id="gf-start" value="${esc(group?.startDate || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">종료일</label>
            <input class="form-input" type="date" id="gf-end" value="${esc(group?.endDate || '')}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">메모</label>
          <textarea class="form-textarea" id="gf-notes" placeholder="특이사항, 준비물 등">${esc(group?.notes || '')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-btn">취소</button>
        <button class="btn btn-primary" id="modal-save-btn">${isEdit ? '수정 완료' : '그룹 만들기'}</button>
      </div>
    `);

    // 이모지 선택
    document.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emoji-btn').forEach(b => b.style.borderColor = 'transparent');
        btn.style.borderColor = 'var(--color-primary)';
        document.getElementById('gf-emoji').value = btn.dataset.emoji;
      });
    });

    document.getElementById('modal-save-btn').addEventListener('click', async (event) => {
      const saveBtn = event.currentTarget;
      if (saveBtn.disabled || !this._editing) return;
      const name = document.getElementById('gf-name').value.trim();
      if (!name) { this.showToast('여행 이름을 입력해주세요.', 'error'); return; }
      saveBtn.disabled = true;
      this._saving = true;
      try {
        await onSave({
          name,
          coverEmoji: document.getElementById('gf-emoji').value,
          purpose: document.getElementById('gf-purpose').value.trim(),
          region: document.getElementById('gf-region').value.trim(),
          startDate: document.getElementById('gf-start').value,
          endDate: document.getElementById('gf-end').value,
          notes: document.getElementById('gf-notes').value.trim(),
        });
        this._saving = false;
        this.closeModal();
      } catch (error) {
        this.showToast(error.message || '저장하지 못했습니다. 다시 시도해주세요.', 'error');
      } finally {
        this._saving = false;
        saveBtn.disabled = false;
      }
    });
  },

  // ── 장소 모달 ───────────────────────────────────
  showPlaceModal(groupId, place, onSave) {
    if (!this._editing || this._saving) return;
    const isEdit = !!place;
    this._openModal(`
      <div class="modal-header">
        <span class="modal-title">${isEdit ? '장소 수정' : '장소 추가'}</span>
        <button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button>
      </div>
      <div class="modal-body">
        ${!isEdit ? `
        <div class="form-group">
          <label class="form-label">네이버지도 공유 링크</label>
          <div style="display:flex;gap:8px;">
            <input class="form-input" id="pf-url" value="${esc(place?.naverUrl || '')}" placeholder="https://naver.me/... 또는 https://map.naver.com/..." />
            <button class="btn btn-primary" id="btn-parse" style="flex-shrink:0;">불러오기</button>
          </div>
          <div id="parse-status" class="parse-status" style="display:none;"></div>
        </div>
        <hr style="border:none;border-top:1px solid var(--color-border);margin:16px 0;" />
        ` : ''}
        <div class="form-group">
          <label class="form-label">장소명 *</label>
          <input class="form-input" id="pf-name" value="${esc(place?.name || '')}" placeholder="장소 이름" />
        </div>
        <div class="form-group">
          <label class="form-label">주소</label>
          <input class="form-input" id="pf-address" value="${esc(place?.address || '')}" placeholder="주소" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">연락처</label>
            <input class="form-input" id="pf-phone" value="${esc(place?.phone || '')}" placeholder="전화번호" />
          </div>
          <div class="form-group">
            <label class="form-label">카테고리</label>
            <select class="form-select" id="pf-category">
              ${CATEGORIES.map(c => `<option ${(place?.category || '기타') === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group pin-color-editor">
          <label class="form-label" for="pf-pin-color">핀 색상</label>
          <div style="display:flex;align-items:center;gap:12px;">
            <input type="color" id="pf-pin-color" aria-label="핀 색상" value="${placeColor(place)}" style="width:48px;height:40px;border:0;background:none;cursor:pointer;" />
            <label><input type="checkbox" id="pf-color-auto" ${place?.pinColor ? '' : 'checked'} /> 카테고리 기본색</label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">태그</label>
          <input class="form-input" id="pf-tags" value="${esc((place?.tags || []).join(' '))}" placeholder="#바다 #아이랑 #역사" />
        </div>
        <div class="form-group">
          <label class="form-label">메모</label>
          <textarea class="form-textarea" id="pf-notes" placeholder="방문 팁, 주의사항 등">${esc(place?.notes || '')}</textarea>
        </div>
        <div class="form-group">
          <p class="form-hint" id="pf-image-url-hint">이미지 주소를 최대 3개까지 입력하세요.</p>
          ${[1, 2, 3].map(number => `
          <div class="form-group">
          <label class="form-label" for="pf-image-url-${number}">이미지 URL ${number}</label>
          <input class="form-input" type="url" id="pf-image-url-${number}" maxlength="4096" aria-describedby="pf-image-url-hint" value="${esc(place?.imageUrls?.[number - 1] || '')}" placeholder="https://example.com/image.jpg" />
          </div>
          `).join('')}
        </div>
        ${isEdit ? `
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="pf-visited" ${place?.visited ? 'checked' : ''} />
            <span class="form-label" style="margin:0;">방문 완료</span>
          </label>
        </div>
        ` : ''}
        <input type="hidden" id="pf-naverurl" value="${esc(place?.naverUrl || '')}" />
        <input type="hidden" id="pf-placeid" value="${esc(place?.naverPlaceId || '')}" />
        <input type="hidden" id="pf-lat" value="${esc(place?.lat ?? '')}" />
        <input type="hidden" id="pf-lng" value="${esc(place?.lng ?? '')}" />
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-btn">취소</button>
        <button class="btn btn-primary" id="modal-save-btn">${isEdit ? '수정 완료' : '장소 저장'}</button>
      </div>
    `);

    const colorInput = document.getElementById('pf-pin-color');
    const autoColor = document.getElementById('pf-color-auto');
    const categoryInput = document.getElementById('pf-category');
    const syncColor = () => { if (autoColor.checked) colorInput.value = placeColor({ category: categoryInput.value }); };
    colorInput.addEventListener('input', () => { autoColor.checked = false; });
    autoColor.addEventListener('change', syncColor);
    categoryInput.addEventListener('change', syncColor);

    // 링크 파싱 버튼
    const parseBtn = document.getElementById('btn-parse');
    if (parseBtn) {
      parseBtn.addEventListener('click', async () => {
        const url = document.getElementById('pf-url').value.trim();
        if (!url) { this.showToast('링크를 입력해주세요.'); return; }
        const status = document.getElementById('parse-status');
        status.style.display = 'block';
        status.className = 'parse-status loading';
        status.textContent = '⏳ 장소 정보를 가져오는 중...';
        parseBtn.disabled = true;

        const data = await Parser.fetchPlaceData(url);
        parseBtn.disabled = false;

        if (data && !data.error) {
          document.getElementById('pf-name').value = data.name || '';
          document.getElementById('pf-address').value = data.address || '';
          document.getElementById('pf-phone').value = data.phone || '';
          document.getElementById('pf-category').value = data.category || '기타';
          syncColor();
          document.getElementById('pf-naverurl').value = data.naverUrl || url;
          document.getElementById('pf-placeid').value = data.naverPlaceId || '';
          document.getElementById('pf-lat').value = data.lat || '';
          document.getElementById('pf-lng').value = data.lng || '';
          status.className = 'parse-status success';
          status.textContent = '✅ 정보를 성공적으로 가져왔습니다. 확인 후 저장하세요.';
        } else {
          document.getElementById('pf-naverurl').value = url;
          status.className = 'parse-status error';
          status.textContent = `⚠️ ${data?.message || '장소 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}`;
        }
      });
    }

    document.getElementById('modal-save-btn').addEventListener('click', async (event) => {
      const saveBtn = event.currentTarget;
      if (saveBtn.disabled || !this._editing) return;
      const name = document.getElementById('pf-name').value.trim();
      if (!name) { this.showToast('장소명을 입력해주세요.', 'error'); return; }

      const tagsRaw = document.getElementById('pf-tags').value.trim();
      const tags = tagsRaw.split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t);

      saveBtn.disabled = true;
      this._saving = true;
      try {
        await onSave({
          groupId,
          naverUrl: document.getElementById('pf-naverurl').value,
          naverPlaceId: document.getElementById('pf-placeid').value,
          name,
          address: document.getElementById('pf-address').value.trim(),
          phone: document.getElementById('pf-phone').value.trim(),
          category: document.getElementById('pf-category').value,
          pinColor: autoColor.checked ? '' : colorInput.value,
          tags,
          notes: document.getElementById('pf-notes').value.trim(),
          imageUrls: normalizeImageUrls([1, 2, 3].map(number => document.getElementById(`pf-image-url-${number}`).value)),
          lat: parseFloat(document.getElementById('pf-lat').value) || null,
          lng: parseFloat(document.getElementById('pf-lng').value) || null,
          visited: document.getElementById('pf-visited')?.checked || false,
        });
        this._saving = false;
        this.closeModal();
      } catch (error) {
        this.showToast(error.message || '저장하지 못했습니다. 다시 시도해주세요.', 'error');
      } finally {
        this._saving = false;
        saveBtn.disabled = false;
      }
    });
  },

  // ── 확인 다이얼로그 ────────────────────────────
  showConfirm(message) {
    return new Promise(resolve => {
      this._openModal(`
        <div class="modal-body" style="padding:24px;">
          <p style="font-size:15px;line-height:1.6;">${esc(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="confirm-no">취소</button>
          <button class="btn btn-danger" id="confirm-yes">삭제</button>
        </div>
      `);
      document.getElementById('confirm-yes').addEventListener('click', () => { this.closeModal(); resolve(true); });
      document.getElementById('confirm-no').addEventListener('click', () => { this.closeModal(); resolve(false); });
      // Fix: resolve false when user clicks backdrop
      document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) resolve(false);
      }, { once: true });
    });
  },

  showImportOptions() {
    if (!this._editing) return Promise.resolve(null);
    return new Promise(resolve => {
      this._openModal(`
        <div class="modal-header">
          <span class="modal-title">가져오기 방식 선택</span>
          <button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button>
        </div>
        <div class="modal-body">
          <p style="font-size:14px;line-height:1.7;margin-bottom:16px;">
            가져올 데이터를 어떻게 처리할까요?
          </p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-ghost" id="import-merge" style="text-align:left;padding:12px 16px;">
              <strong>📥 병합 추가</strong><br>
              <span style="font-size:12px;color:var(--color-text-secondary);">기존 데이터는 유지하고 새 항목만 추가합니다</span>
            </button>
            <button class="btn btn-danger" id="import-overwrite" style="text-align:left;padding:12px 16px;">
              <strong>🔄 전체 덮어쓰기</strong><br>
              <span style="font-size:12px;opacity:.85;">기존 데이터를 모두 삭제하고 가져온 데이터로 교체합니다</span>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="modal-cancel-btn">취소</button>
        </div>
      `);
      document.getElementById('import-merge').addEventListener('click', () => { this.closeModal(); resolve('merge'); });
      document.getElementById('import-overwrite').addEventListener('click', () => { this.closeModal(); resolve('overwrite'); });
      document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) resolve(null);
      }, { once: true });
    });
  },

  showGroupDetails(group) {
    this._showDetails(group.name, [
      ['지역', group.region], ['목적/테마', group.purpose],
      ['시작일', group.startDate], ['종료일', group.endDate], ['메모', group.notes],
    ]);
  },

  showPlaceDetails(place) {
    const mobile = window.matchMedia('(max-width: 1023px), (pointer: coarse)').matches;
    this._showDetails(place.name, [
      ['카테고리', place.category], ['핀 색상', placeColor(place)], ['주소', place.address], ['연락처', place.phone],
      ['태그', (place.tags || []).join(' ')], ['메모', place.notes],
      ['방문', place.visited ? '방문 완료' : '방문 전'],
    ], placeLink(place, mobile), mobile, place.imageUrls);
  },

  _showDetails(title, fields, url, sameTab = false, imageUrls = []) {
    const rows = fields.filter(([, value]) => value != null && value !== '');
    let link = '';
    try {
      const parsed = new URL(url);
      if (['https:', 'http:'].includes(parsed.protocol)) link = parsed.href;
    } catch {}
    const imageLinks = (Array.isArray(imageUrls) ? imageUrls.slice(0, 3) : []).flatMap(value => {
      try { return normalizeImageUrls([value]); } catch { return []; }
    });
    this._openModal(`
      <div class="modal-header"><span class="modal-title">${esc(title)}</span>
        <button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button></div>
      <div class="modal-body"><dl class="detail-list">${rows.map(([label, value], index) => {
        if (!['주소', '연락처'].includes(label)) return `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;
        const attrs = `class="detail-copy" data-copy-index="${index}" title="${esc(label)} 복사" aria-label="${esc(label)} 복사: ${esc(value)}"`;
        return `<dt><button ${attrs}>${esc(label)}</button></dt><dd><button ${attrs}>${esc(value)} ${icon('copy')}</button></dd>`;
      }).join('')}</dl>
      ${imageLinks.length ? `<div aria-label="사용자 이미지 링크" style="display:flex;flex-wrap:wrap;gap:8px 20px;">${imageLinks.map(imageUrl => `<a class="detail-link" data-image-link href="${esc(imageUrl)}" title="${esc(linkTitleFallback(imageUrl))}" target="_blank" rel="noopener noreferrer" style="max-width:100%;min-width:0;white-space:normal;overflow-wrap:anywhere;">${esc(linkTitleFallback(imageUrl))} ↗</a>`).join('')}</div>` : ''}
      ${link ? `<a class="detail-link" href="${esc(link)}" target="${sameTab ? '_self' : '_blank'}" rel="noopener noreferrer">네이버지도에서 보기 ↗</a>` : ''}</div>
      <div class="modal-footer"><button class="btn btn-ghost" id="modal-cancel-btn">닫기</button></div>
    `);
    loadLinkTitles(document.getElementById('modal-overlay'));
    document.querySelectorAll('[data-copy-index]').forEach(button => {
      button.addEventListener('click', async () => {
        const [label, value] = rows[Number(button.dataset.copyIndex)];
        try {
          await navigator.clipboard.writeText(String(value));
          this.showToast(`${label}가 복사되었습니다.`);
        } catch {
          this.showToast('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해주세요.', 'error');
        }
      });
    });
  },

  showExportOptions() {
    if (this._saving) return Promise.resolve(null);
    return new Promise(resolve => {
      this._openModal(`
        <div class="modal-header"><span class="modal-title">내보내기</span><button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button></div>
        <div class="modal-body export-options">
          <button class="btn btn-primary" data-export="zip">모든 형식 (ZIP)</button>
          <button class="btn btn-ghost" data-export="json">JSON</button>
          <button class="btn btn-ghost" data-export="md">Markdown (.md)</button>
          <button class="btn btn-ghost" data-export="xlsx">Excel (.xlsx)</button>
        </div>
      `);
      this._onModalClose = () => resolve(null);
      document.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => {
        this._onModalClose = null;
        resolve(button.dataset.export);
        this.closeModal();
      }));
    });
  },

  // ── 토스트 ──────────────────────────────────────
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#E53E3E' : '#333';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  },

  // ── 모달 헬퍼 ──────────────────────────────────
  closeModal() {
    if (this._saving) return;
    const onClose = this._onModalClose;
    this._onModalClose = null;
    if (onClose) onClose();
    document.getElementById('modal-overlay').style.display = 'none';
  },

  _openModal(html) {
    if (this._saving) return;
    this.closeModal();
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) this.closeModal();
    }, { once: true });
  },
};

// XSS 방지용 이스케이프
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
