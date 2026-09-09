import { UI } from './ui.js';
import { icon } from './icons.js';

const THEMES = [
  { id: 'glass', name: 'Glass', detail: '코발트 블루 · 빛이 스미는 유리' },
  { id: 'bloom', name: 'Bloom', detail: '크림과 라벤더 · 포근한 여행 노트' },
  { id: 'midnight', name: 'Midnight', detail: '그라파이트 · 선명한 라임' },
];
const KEY = 'ftm_design';

export const Design = {
  current: 'glass',
  init() {
    let saved;
    try { saved = localStorage.getItem(KEY); } catch {}
    this.apply(saved, false);
    document.getElementById('btn-design').addEventListener('click', () => this.open());
  },
  apply(id, persist = true) {
    id = ({ iphone: 'glass', galaxy: 'bloom', nothing: 'midnight' })[id] || id;
    this.current = THEMES.some(theme => theme.id === id) ? id : 'glass';
    document.body.dataset.theme = this.current;
    const theme = THEMES.find(theme => theme.id === this.current);
    document.getElementById('btn-design').title = `디자인 선택 · ${theme.name}`;
    if (persist) {
      try { localStorage.setItem(KEY, this.current); } catch {}
    }
  },
  open() {
    if (UI._saving) return;
    UI._openModal(`
      <div class="modal-header"><span class="modal-title">디자인</span><button class="modal-close" id="modal-close-btn" aria-label="닫기">${icon('close')}</button></div>
      <div class="modal-body theme-options">
        ${THEMES.map(theme => `<button class="theme-choice" data-theme-choice="${theme.id}" aria-pressed="${this.current === theme.id}">
          <span class="theme-preview theme-preview-${theme.id}" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="theme-choice-copy"><strong>${theme.name}</strong><small>${theme.detail}</small></span>
          <span class="theme-check" aria-hidden="true">${this.current === theme.id ? icon('check') : ''}</span>
        </button>`).join('')}
      </div>
    `);
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.addEventListener('click', () => {
        this.apply(button.dataset.themeChoice);
        UI.closeModal();
        document.getElementById('btn-design').focus();
      });
    });
    const onKey = event => { if (event.key === 'Escape') UI.closeModal(); };
    document.addEventListener('keydown', onKey);
    UI._onModalClose = () => {
      document.removeEventListener('keydown', onKey);
      document.getElementById('btn-design').focus();
    };
    document.querySelector('[data-theme-choice][aria-pressed="true"]').focus();
  },
};
