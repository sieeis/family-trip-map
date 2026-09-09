import { UI } from './ui.js';
import { icon } from './icons.js';
import { Parser } from './parser.js';
import { Storage } from './storage.js';
import { parseBulkLinks, resolveBulk } from './bulk-import.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const STATUS = { pending: '대기', loading: '불러오는 중', success: '성공', failed: '실패', duplicate: '중복', invalid: '잘못된 링크' };

export const BulkUI = {
  open(group, onSave) {
    if (!UI._editing || UI._saving || !group) return;
    let rows = [];
    let busy = false;
    let closed = false;
    let controller = null;
    UI._openModal(`
      <div class="modal-header"><span class="modal-title">장소 일괄 추가</span><button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button></div>
      <div class="modal-body bulk-body">
        <p class="bulk-group">${esc(group.name)}</p>
        <label class="form-label" for="bulk-links">네이버 공유 링크 · 한 줄에 하나, 최대 50개</label>
        <textarea class="form-textarea bulk-input" id="bulk-links" placeholder="https://naver.me/…&#10;https://naver.me/…" spellcheck="false"></textarea>
        <div class="bulk-actions"><button class="btn btn-primary" id="bulk-load">불러오기</button><button class="btn btn-ghost" id="bulk-retry" hidden>실패한 링크 재시도</button></div>
        <p id="bulk-progress" class="bulk-progress" role="status" aria-live="polite"></p>
        <ul id="bulk-results" class="bulk-results"></ul>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" id="modal-cancel-btn">취소</button><button class="btn btn-primary" id="bulk-save" disabled>성공 0개 추가</button></div>
    `);
    const input = document.getElementById('bulk-links');
    const load = document.getElementById('bulk-load');
    const retry = document.getElementById('bulk-retry');
    const save = document.getElementById('bulk-save');
    const progress = document.getElementById('bulk-progress');
    const results = document.getElementById('bulk-results');
    const render = () => {
      if (closed) return;
      const count = status => rows.filter(row => row.status === status).length;
      const done = rows.length - count('pending') - count('loading');
      progress.textContent = rows.length ? `${done}/${rows.length} 확인 · 성공 ${count('success')} · 실패 ${count('failed') + count('invalid')} · 중복 ${count('duplicate')}` : '';
      input.disabled = load.disabled = busy;
      retry.hidden = !count('failed');
      retry.disabled = busy;
      save.disabled = busy || !count('success') || !UI._editing;
      save.textContent = `성공 ${count('success')}개 추가`;
      results.innerHTML = rows.map(row => `<li class="bulk-result" data-status="${esc(row.status)}">
        <div class="bulk-result-heading"><strong>${esc(row.place?.name || row.url)}</strong><span class="bulk-badge">${esc(STATUS[row.status] || row.status)}</span></div>
        ${row.status === 'success' && row.place ? `<dl class="bulk-place-info"><dt>주소</dt><dd>${esc(row.place.address || '—')}</dd><dt>연락처</dt><dd>${esc(row.place.phone || '—')}</dd><dt>분류</dt><dd>${esc(row.place.category || '기타')}</dd></dl>` : ''}
        ${row.message ? `<p class="bulk-message">${esc(row.message)}</p>` : ''}
        ${row.place?.name ? `<p class="bulk-url">${esc(row.url)}</p>` : ''}
      </li>`).join('');
    };
    const run = async () => {
      if (busy || closed || !UI._editing) return;
      busy = true;
      controller = new AbortController();
      render();
      try {
        await resolveBulk(rows, {
          fetchPlace: (url, signal) => Parser.fetchPlaceData(url, { signal }),
          existing: Storage.getPlaces(),
          onUpdate: render,
          signal: controller.signal,
        });
      } catch (error) {
        if (!closed && error.name !== 'AbortError') UI.showToast(error.message || '불러오기에 실패했습니다.', 'error');
      } finally {
        busy = false;
        if (!closed) render();
      }
    };
    load.addEventListener('click', () => {
      if (busy || !UI._editing) return;
      try {
        const parsed = parseBulkLinks(input.value);
        if (!parsed.length) { UI.showToast('링크를 입력해주세요.', 'error'); return; }
        if (parsed.length > 50) { UI.showToast('한 번에 최대 50개까지 불러올 수 있습니다.', 'error'); return; }
        rows = parsed;
        void run();
      } catch (error) { UI.showToast(error.message || '링크를 확인해주세요.', 'error'); }
    });
    retry.addEventListener('click', () => { void run(); });
    save.addEventListener('click', async () => {
      if (busy || closed || !UI._editing) return;
      const places = rows.filter(row => row.status === 'success' && row.place).map(row => ({ ...row.place, groupId: group.id }));
      if (!places.length) return;
      busy = true;
      UI._saving = true;
      render();
      try {
        await onSave(places);
        UI._saving = false;
        UI.closeModal();
      } catch (error) {
        UI.showToast(error.message || '저장하지 못했습니다. 다시 시도해주세요.', 'error');
      } finally {
        busy = false;
        UI._saving = false;
        if (!closed) render();
      }
    });
    const onKey = event => { if (event.key === 'Escape') UI.closeModal(); };
    document.addEventListener('keydown', onKey);
    UI._onModalClose = () => {
      closed = true;
      controller?.abort();
      document.removeEventListener('keydown', onKey);
    };
    input.focus();
  },
};
