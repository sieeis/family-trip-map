// public/js/ui.js
import { Parser } from './parser.js';

const CATEGORIES = ['맛집', '관광지', '숙소', '체험/액티비티', '카페/디저트', '쇼핑', '기타'];
const CATEGORY_EMOJIS = {
  '맛집': '🍜', '관광지': '📍', '숙소': '🏨',
  '체험/액티비티': '🎯', '카페/디저트': '☕', '쇼핑': '🛍️', '기타': '📌',
};

export const UI = {
  // ── 그룹 렌더링 ─────────────────────────────────
  renderGroups(groups, currentGroupId, callbacks) {
    const list = document.getElementById('group-list');
    if (groups.length === 0) {
      list.innerHTML = `<li class="empty-state" style="height:auto;padding:24px 12px;">
        <div class="empty-state-icon">🗺️</div>
        <div class="empty-state-text">여행 그룹을 추가해보세요</div>
      </li>`;
      return;
    }
    list.innerHTML = groups.map(g => `
      <li class="group-item ${g.id === currentGroupId ? 'active' : ''}" data-id="${g.id}">
        <span class="group-emoji">${g.coverEmoji || '🗺️'}</span>
        <div class="group-info">
          <div class="group-name">${esc(g.name)}</div>
          <div class="group-meta">${esc(g.region || '')} ${g.startDate ? g.startDate.slice(0, 7) : ''}</div>
        </div>
        <div class="group-actions">
          <button class="btn-icon" data-action="edit-group" data-id="${g.id}" title="수정">✏️</button>
          <button class="btn-icon" data-action="delete-group" data-id="${g.id}" title="삭제">🗑️</button>
        </div>
      </li>
    `).join('');

    list.querySelectorAll('.group-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        callbacks.onSelect(el.dataset.id);
      });
    });
    list.querySelectorAll('[data-action="edit-group"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onEdit(el.dataset.id); }));
    list.querySelectorAll('[data-action="delete-group"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onDelete(el.dataset.id); }));
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
    if (places.length === 0) {
      list.innerHTML = `<li class="empty-state">
        <div class="empty-state-icon">📍</div>
        <div class="empty-state-text">+ 장소 버튼으로<br>장소를 추가해보세요</div>
      </li>`;
      return;
    }
    list.innerHTML = places.map(p => `
      <li class="place-item ${p.visited ? 'visited' : ''}" data-id="${p.id}">
        <div class="place-header">
          <span class="place-name">${CATEGORY_EMOJIS[p.category] || '📌'} ${esc(p.name)}</span>
          <div class="place-actions">
            <button class="btn-icon" data-action="edit-place" data-id="${p.id}" title="수정">✏️</button>
            <button class="btn-icon" data-action="delete-place" data-id="${p.id}" title="삭제">🗑️</button>
          </div>
        </div>
        <span class="place-category">${esc(p.category)}</span>
        ${p.address ? `<div class="place-address">${esc(p.address)}</div>` : ''}
        ${p.tags?.length ? `<div class="place-tags">${p.tags.map(t => `<span class="place-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${p.visited ? '<div class="place-visited-badge">✅ 방문완료</div>' : ''}
      </li>
    `).join('');

    list.querySelectorAll('.place-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
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
    const isEdit = !!group;
    const emojis = ['🗺️','🏯','🌊','🌸','🏔️','🌴','🏙️','🎡','🍁','❄️','☀️','🌿'];
    this._openModal(`
      <div class="modal-header">
        <span class="modal-title">${isEdit ? '그룹 수정' : '새 여행 그룹'}</span>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">이모지</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${emojis.map(e => `<button type="button" class="emoji-btn" data-emoji="${e}" style="
              font-size:24px;width:40px;height:40px;border-radius:8px;border:2px solid transparent;
              cursor:pointer;background:var(--color-bg);
              ${(group?.coverEmoji || '🗺️') === e ? 'border-color:var(--color-primary);' : ''}
            ">${e}</button>`).join('')}
          </div>
          <input type="hidden" id="gf-emoji" value="${group?.coverEmoji || '🗺️'}" />
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
            <input class="form-input" type="date" id="gf-start" value="${group?.startDate || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">종료일</label>
            <input class="form-input" type="date" id="gf-end" value="${group?.endDate || ''}" />
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

    document.getElementById('modal-save-btn').addEventListener('click', () => {
      const name = document.getElementById('gf-name').value.trim();
      if (!name) { this.showToast('여행 이름을 입력해주세요.', 'error'); return; }
      onSave({
        name,
        coverEmoji: document.getElementById('gf-emoji').value,
        purpose: document.getElementById('gf-purpose').value.trim(),
        region: document.getElementById('gf-region').value.trim(),
        startDate: document.getElementById('gf-start').value,
        endDate: document.getElementById('gf-end').value,
        notes: document.getElementById('gf-notes').value.trim(),
      });
      this.closeModal();
    });
  },

  // ── 장소 모달 ───────────────────────────────────
  showPlaceModal(groupId, place, onSave) {
    const isEdit = !!place;
    this._openModal(`
      <div class="modal-header">
        <span class="modal-title">${isEdit ? '장소 수정' : '장소 추가'}</span>
        <button class="modal-close" id="modal-close-btn">✕</button>
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
          <div class="form-hint">링크를 붙여넣고 "불러오기"를 누르면 정보가 자동으로 채워집니다.</div>
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
        <div class="form-group">
          <label class="form-label">태그</label>
          <input class="form-input" id="pf-tags" value="${(place?.tags || []).join(' ')}" placeholder="#바다 #아이랑 #역사" />
          <div class="form-hint">띄어쓰기로 구분, # 자동 추가</div>
        </div>
        <div class="form-group">
          <label class="form-label">메모</label>
          <textarea class="form-textarea" id="pf-notes" placeholder="방문 팁, 주의사항 등">${esc(place?.notes || '')}</textarea>
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
        <input type="hidden" id="pf-lat" value="${place?.lat || ''}" />
        <input type="hidden" id="pf-lng" value="${place?.lng || ''}" />
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-btn">취소</button>
        <button class="btn btn-primary" id="modal-save-btn">${isEdit ? '수정 완료' : '장소 저장'}</button>
      </div>
    `);

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

        if (data) {
          document.getElementById('pf-name').value = data.name || '';
          document.getElementById('pf-address').value = data.address || '';
          document.getElementById('pf-phone').value = data.phone || '';
          document.getElementById('pf-category').value = data.category || '기타';
          document.getElementById('pf-naverurl').value = data.naverUrl || url;
          document.getElementById('pf-placeid').value = data.naverPlaceId || '';
          document.getElementById('pf-lat').value = data.lat || '';
          document.getElementById('pf-lng').value = data.lng || '';
          status.className = 'parse-status success';
          status.textContent = '✅ 정보를 성공적으로 가져왔습니다. 확인 후 저장하세요.';
        } else {
          document.getElementById('pf-naverurl').value = url;
          status.className = 'parse-status error';
          status.textContent = '⚠️ 정보를 가져오지 못했습니다. 직접 입력해주세요.';
        }
      });
    }

    document.getElementById('modal-save-btn').addEventListener('click', () => {
      const name = document.getElementById('pf-name').value.trim();
      if (!name) { this.showToast('장소명을 입력해주세요.', 'error'); return; }

      const tagsRaw = document.getElementById('pf-tags').value.trim();
      const tags = tagsRaw.split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t);

      onSave({
        groupId,
        naverUrl: document.getElementById('pf-naverurl').value,
        naverPlaceId: document.getElementById('pf-placeid').value,
        name,
        address: document.getElementById('pf-address').value.trim(),
        phone: document.getElementById('pf-phone').value.trim(),
        category: document.getElementById('pf-category').value,
        tags,
        notes: document.getElementById('pf-notes').value.trim(),
        lat: parseFloat(document.getElementById('pf-lat').value) || null,
        lng: parseFloat(document.getElementById('pf-lng').value) || null,
        visited: document.getElementById('pf-visited')?.checked || false,
      });
      this.closeModal();
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
    return new Promise(resolve => {
      this._openModal(`
        <div class="modal-header">
          <span class="modal-title">가져오기 방식 선택</span>
          <button class="modal-close" id="modal-close-btn">✕</button>
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
    document.getElementById('modal-overlay').style.display = 'none';
  },

  _openModal(html) {
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
