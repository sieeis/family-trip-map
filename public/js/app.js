// public/js/app.js
import { Storage } from './storage.js';
import { MapModule } from './map.js';
import { UI } from './ui.js';

const state = {
  currentGroupId: null,
  filterCategory: '',
  filterTag: '',
  editing: false,
};

export const App = {
  async init() {
    this.setEditing(false);
    MapModule.onMarkerClick((place) => {
      // 지도 마커 클릭 시 장소 목록에서 해당 아이템 하이라이트
      document.querySelectorAll('.place-item').forEach(el =>
        el.classList.toggle('active', el.dataset.id === place.id));
    });

    this._bindHeader();
    this._bindMobileTabs();
    this._bindFilters();
    this._bindPanels();
    document.getElementById('btn-load-map').addEventListener('click', () => this.showMap());
    window.addEventListener('map-error', event => UI.showToast(event.detail, 'error'));

    document.getElementById('btn-migrate').hidden = !Storage.hasLegacyData();
    document.getElementById('btn-sync').addEventListener('click', () => this.sync());
    document.getElementById('btn-migrate').addEventListener('click', async () => {
      if (!state.editing) return;
      const button = document.getElementById('btn-migrate');
      button.disabled = true;
      try {
        await Storage.migrateLegacyData();
        button.hidden = true;
        this.renderShared();
        UI.showToast('기존 그룹과 장소를 모두에게 공유했습니다.');
      } catch (error) { UI.showToast(error.message, 'error'); }
      finally { button.disabled = false; }
    });
    window.addEventListener('trips-updated', () => this.renderShared());
    await this.sync();
    setInterval(() => {
      if (!document.hidden && document.getElementById('modal-overlay').style.display === 'none') this.sync();
    }, 15000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && document.getElementById('modal-overlay').style.display === 'none') this.sync();
    });
  },

  async sync() {
    const status = document.getElementById('sync-status');
    try {
      if (await Storage.refresh()) this.renderShared();
      status.textContent = '';
      status.hidden = true;
    } catch (error) { status.textContent = error.message; status.hidden = false; }
  },

  setEditing(value) {
    if (Storage.isSaving) { UI.showToast('저장이 끝난 후 전환해주세요.'); return; }
    state.editing = value;
    Storage.setEditing(value);
    UI.setEditing(value);
    document.body.dataset.editing = String(value);
    const button = document.getElementById('btn-edit-mode');
    button.textContent = value ? '🔓' : '🔒';
    button.setAttribute('aria-pressed', String(value));
    button.setAttribute('aria-label', value ? '편집 잠그기' : '편집 잠금 해제');
    button.title = value ? '편집 잠그기' : '편집 잠금 해제';
  },

  async showMap() {
    const button = document.getElementById('btn-load-map');
    const placeholder = document.getElementById('map-placeholder');
    const map = document.getElementById('map');
    button.disabled = true;
    button.textContent = '불러오는 중…';
    map.hidden = false;
    try {
      await MapModule.load('map');
      placeholder.hidden = true;
      MapModule.resize();
    } catch (error) {
      map.hidden = true;
      UI.showToast(error.message, 'error');
    } finally { button.disabled = false; button.textContent = '지도 보기'; }
  },

  _bindPanels() {
    const layout = document.querySelector('.app-layout');
    for (const name of ['groups', 'places']) {
      const button = document.getElementById(`btn-toggle-${name}`);
      layout.dataset[`${name}Collapsed`] = 'false';
      button.addEventListener('click', () => {
        const collapsed = layout.dataset[`${name}Collapsed`] !== 'true';
        layout.dataset[`${name}Collapsed`] = String(collapsed);
        button.setAttribute('aria-expanded', String(!collapsed));
        button.setAttribute('aria-label', `${name === 'groups' ? '그룹' : '장소'} 목록 ${collapsed ? '펼치기' : '접기'}`);
        button.title = button.getAttribute('aria-label');
        button.textContent = collapsed ? '›' : '‹';
        requestAnimationFrame(() => MapModule.resize());
      });
    }
  },

  renderShared() {
    const groups = Storage.getGroups();
    if (!groups.some(g => g.id === state.currentGroupId)) {
      state.currentGroupId = null;
      if (groups.length) { this.selectGroup(groups[0].id); return; }
      UI.setCurrentGroupName('');
      UI.renderPlaces([], {});
      MapModule.clearMarkers();
    } else {
      UI.setCurrentGroupName(groups.find(g => g.id === state.currentGroupId).name);
      this.renderPlaces();
    }
    this.renderGroups();
  },

  // ── 그룹 ────────────────────────────────────────
  renderGroups() {
    const groups = Storage.getGroups();
    UI.renderGroups(groups, state.currentGroupId, {
      onSelect: (id) => this.selectGroup(id),
      onDetails: (id) => {
        const group = Storage.getGroups().find(g => g.id === id);
        if (group) UI.showGroupDetails(group);
      },
      onEdit: (id) => {
        if (!state.editing) return;
        const group = Storage.getGroups().find(g => g.id === id);
        UI.showGroupModal(group, async (data) => {
          await Storage.updateGroup(id, data);
          this.renderGroups();
          if (id === state.currentGroupId) UI.setCurrentGroupName(data.name);
          UI.showToast('그룹이 수정되었습니다.');
        });
      },
      onDelete: async (id) => {
        if (!state.editing) return;
        const group = Storage.getGroups().find(g => g.id === id);
        const ok = await UI.showConfirm(`"${group?.name}" 그룹과 모든 장소를 삭제할까요?`);
        if (!ok) return;
        try { await Storage.deleteGroup(id); }
        catch (error) { UI.showToast(error.message, 'error'); return; }
        if (state.currentGroupId === id) {
          state.currentGroupId = null;
          UI.setCurrentGroupName('');
          UI.renderPlaces([], {});
          MapModule.clearMarkers();
        }
        this.renderGroups();
        UI.showToast('그룹이 삭제되었습니다.');
      },
    });
  },

  selectGroup(id) {
    state.currentGroupId = id;
    state.filterCategory = '';
    state.filterTag = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-tag').value = '';

    const group = Storage.getGroups().find(g => g.id === id);
    UI.setCurrentGroupName(group?.name || '');
    this.renderGroups(); // active 상태 업데이트
    this.renderPlaces();
  },

  // ── 장소 ────────────────────────────────────────
  renderPlaces() {
    if (!state.currentGroupId) return;
    let places = Storage.getPlacesByGroup(state.currentGroupId);

    if (state.filterCategory) {
      places = places.filter(p => p.category === state.filterCategory);
    }
    if (state.filterTag) {
      const tag = state.filterTag.toLowerCase();
      places = places.filter(p =>
        p.tags?.some(t => t.toLowerCase().includes(tag)) ||
        p.name.toLowerCase().includes(tag)
      );
    }

    UI.renderPlaces(places, {
      onSelect: (id) => {
        const place = Storage.getPlaces().find(p => p.id === id);
        if (place) { UI.showPlaceDetails(place); MapModule.panToPlace(place); }
      },
      onEdit: (id) => {
        if (!state.editing) return;
        const place = Storage.getPlaces().find(p => p.id === id);
        UI.showPlaceModal(state.currentGroupId, place, async (data) => {
          await Storage.updatePlace(id, data);
          this.renderPlaces();
          const places = Storage.getPlacesByGroup(state.currentGroupId);
          MapModule.showPlaces(places);
          UI.showToast('장소가 수정되었습니다.');
        });
      },
      onDelete: async (id) => {
        if (!state.editing) return;
        const place = Storage.getPlaces().find(p => p.id === id);
        const ok = await UI.showConfirm(`"${place?.name}" 장소를 삭제할까요?`);
        if (!ok) return;
        try { await Storage.deletePlace(id); }
        catch (error) { UI.showToast(error.message, 'error'); return; }
        this.renderPlaces();
        const places = Storage.getPlacesByGroup(state.currentGroupId);
        MapModule.showPlaces(places);
        UI.showToast('장소가 삭제되었습니다.');
      },
    });

    // 지도 마커 업데이트
    const allPlaces = Storage.getPlacesByGroup(state.currentGroupId);
    MapModule.showPlaces(allPlaces);
  },

  // ── 헤더 버튼 ───────────────────────────────────
  _bindHeader() {
    document.getElementById('btn-edit-mode').addEventListener('click', () => {
      if (Storage.isSaving) { UI.showToast('저장이 끝난 후 전환해주세요.'); return; }
      UI.closeModal();
      this.setEditing(!state.editing);
      this.renderGroups();
      this.renderPlaces();
    });
    document.getElementById('btn-add-group').addEventListener('click', () => {
      if (!state.editing) return;
      UI.showGroupModal(null, async (data) => {
        const group = await Storage.addGroup(data);
        this.renderGroups();
        this.selectGroup(group.id);
        UI.showToast('새 여행 그룹이 만들어졌습니다! 🎉');
      });
    });

    document.getElementById('btn-add-place').addEventListener('click', () => {
      if (!state.editing || !state.currentGroupId) return;
      UI.showPlaceModal(state.currentGroupId, null, async (data) => {
        await Storage.addPlace(data);
        this.renderPlaces();
        UI.showToast('장소가 추가되었습니다! 📍');
      });
    });

    document.getElementById('btn-export').addEventListener('click', async () => {
      const format = await UI.showExportOptions();
      if (!format) return;
      const button = document.getElementById('btn-export');
      button.disabled = true;
      try {
        const response = await fetch(`/api/export?format=${encodeURIComponent(format)}`, { signal: AbortSignal.timeout(45000) });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '내보내기에 실패했습니다.');
        }
        const url = URL.createObjectURL(await response.blob());
        const a = document.createElement('a');
        a.href = url;
        a.download = `여행지_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        UI.showToast('내보내기 완료');
      } catch (error) { UI.showToast(error.message || '내보내기에 실패했습니다.', 'error'); }
      finally { button.disabled = false; }
    });

    document.getElementById('btn-import-file').addEventListener('change', async (e) => {
      if (!state.editing) { e.target.value = ''; return; }
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const mode = await UI.showImportOptions();
      if (!mode) { e.target.value = ''; return; }
      try {
        await Storage.importData(text, mode);
        this.renderShared();
        UI.showToast('데이터를 가져왔습니다. ✅');
      } catch (error) {
        UI.showToast(error.message || '올바른 백업 파일이 아닙니다.', 'error');
      }
      e.target.value = '';
    });
  },

  // ── 필터 ────────────────────────────────────────
  _bindFilters() {
    document.getElementById('filter-category').addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      this.renderPlaces();
    });

    let filterTimer;
    document.getElementById('filter-tag').addEventListener('input', (e) => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => {
        state.filterTag = e.target.value.trim();
        this.renderPlaces();
      }, 300);
    });
  },

  // ── 모바일 탭 ───────────────────────────────────
  _bindMobileTabs() {
    const layout = document.querySelector('.app-layout');
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        layout.dataset.tab = btn.dataset.tab;
        if (btn.dataset.tab === 'map') {
          if (MapModule.loaded) requestAnimationFrame(() => MapModule.resize());
        }
      });
    });
    layout.dataset.tab = 'list';
    document.querySelectorAll('.tab-btn').forEach(button => button.classList.toggle('active', button.dataset.tab === 'list'));
  },
};
