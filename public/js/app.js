// public/js/app.js
import { Storage } from './storage.js';
import { MapModule } from './map.js';
import { UI } from './ui.js';

const state = {
  currentGroupId: null,
  filterCategory: '',
  filterTag: '',
};

export const App = {
  init() {
    MapModule.init('map');
    MapModule.onMarkerClick((place) => {
      // 지도 마커 클릭 시 장소 목록에서 해당 아이템 하이라이트
      document.querySelectorAll('.place-item').forEach(el =>
        el.classList.toggle('active', el.dataset.id === place.id));
    });

    this._bindHeader();
    this._bindMobileTabs();
    this._bindFilters();

    // 저장된 그룹이 있으면 첫 번째 선택
    const groups = Storage.getGroups();
    this.renderGroups();
    if (groups.length > 0) this.selectGroup(groups[0].id);
  },

  // ── 그룹 ────────────────────────────────────────
  renderGroups() {
    const groups = Storage.getGroups();
    UI.renderGroups(groups, state.currentGroupId, {
      onSelect: (id) => this.selectGroup(id),
      onEdit: (id) => {
        const group = Storage.getGroups().find(g => g.id === id);
        UI.showGroupModal(group, (data) => {
          Storage.updateGroup(id, data);
          this.renderGroups();
          if (id === state.currentGroupId) UI.setCurrentGroupName(data.name);
          UI.showToast('그룹이 수정되었습니다.');
        });
      },
      onDelete: async (id) => {
        const group = Storage.getGroups().find(g => g.id === id);
        const ok = await UI.showConfirm(`"${group?.name}" 그룹과 모든 장소를 삭제할까요?`);
        if (!ok) return;
        Storage.deleteGroup(id);
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
        if (place) MapModule.panToPlace(place);
      },
      onEdit: (id) => {
        const place = Storage.getPlaces().find(p => p.id === id);
        UI.showPlaceModal(state.currentGroupId, place, (data) => {
          Storage.updatePlace(id, data);
          this.renderPlaces();
          const places = Storage.getPlacesByGroup(state.currentGroupId);
          MapModule.showPlaces(places);
          UI.showToast('장소가 수정되었습니다.');
        });
      },
      onDelete: async (id) => {
        const place = Storage.getPlaces().find(p => p.id === id);
        const ok = await UI.showConfirm(`"${place?.name}" 장소를 삭제할까요?`);
        if (!ok) return;
        Storage.deletePlace(id);
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
    document.getElementById('btn-add-group').addEventListener('click', () => {
      UI.showGroupModal(null, (data) => {
        const group = Storage.addGroup(data);
        this.renderGroups();
        this.selectGroup(group.id);
        UI.showToast('새 여행 그룹이 만들어졌습니다! 🎉');
      });
    });

    document.getElementById('btn-add-place').addEventListener('click', () => {
      if (!state.currentGroupId) return;
      UI.showPlaceModal(state.currentGroupId, null, (data) => {
        Storage.addPlace(data);
        this.renderPlaces();
        UI.showToast('장소가 추가되었습니다! 📍');
      });
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const json = Storage.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `여행지_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      UI.showToast('데이터를 내보냈습니다.');
    });

    document.getElementById('btn-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const mode = await UI.showImportOptions();
      if (!mode) { e.target.value = ''; return; }
      try {
        Storage.importData(text, mode);
        this.renderGroups();
        const groups = Storage.getGroups();
        if (groups.length > 0) this.selectGroup(groups[0].id);
        UI.showToast('데이터를 가져왔습니다. ✅');
      } catch {
        UI.showToast('올바른 백업 파일이 아닙니다.', 'error');
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
        // 지도 탭 전환 시 지도 리사이즈
        if (btn.dataset.tab === 'map') {
          setTimeout(() => {
            if (window.naver?.maps) naver.maps.Event.trigger(MapModule._map || {}, 'resize');
          }, 50);
        }
      });
    });
    layout.dataset.tab = 'map';
  },
};
