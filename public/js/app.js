// public/js/app.js
import { BulkUI } from './bulk-ui.js';
import { startLocation, locationError } from './location.js';
import { Storage } from './storage.js';
import { MapModule } from './map.js';
import { UI } from './ui.js';
import { icon, Icons, categoryIcon } from './icons.js';
import { CATEGORY_COLORS } from './place-colors.js';
import { Design } from './design.js';

const state = {
  currentGroupId: null,
  filterCategory: '',
  filterTag: '',
  editing: false,
  groupSort: 'manual',
  placeSort: 'manual',
  selectedPlaceId: null,
  mapView: 'group',
};

const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
function sorted(rows, mode) {
  return mode === 'manual' ? rows : rows.toSorted((a, b) => (mode === 'asc' ? 1 : -1) * collator.compare(a.name, b.name));
}

export const App = {
  async init() {
    Design.init();
    Icons.render();
    this.setEditing(false);
    MapModule.onMarkerClick((place) => {
      state.selectedPlaceId = place.id;
      state.mapView = 'place';
      this._updateMapControls();
      document.querySelectorAll('.place-item').forEach(el =>
        el.classList.toggle('active', el.dataset.id === place.id));
    });

    this._bindHeader();
    this._bindMobileTabs();
    this._bindFilters();
    this._bindPanels();
    document.getElementById('btn-retry-map').addEventListener('click', () => this.showMap());
    window.addEventListener('map-error', event => {
      document.getElementById('map-placeholder').hidden = false;
      document.getElementById('map-loading-status').textContent = event.detail;
      document.getElementById('btn-retry-map').hidden = false;
      UI.showToast(event.detail, 'error');
    });

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
    const mapLoading = this.showMap();
    await this.sync();
    await mapLoading;
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
    button.dataset.icon = value ? 'unlock' : 'lock';
    button.innerHTML = icon(button.dataset.icon);
    button.setAttribute('aria-pressed', String(value));
    button.setAttribute('aria-label', value ? '편집 잠그기' : '편집 잠금 해제');
    button.title = value ? '편집 잠그기' : '편집 잠금 해제';
  },

  async showMap() {
    const button = document.getElementById('btn-retry-map');
    const placeholder = document.getElementById('map-placeholder');
    const map = document.getElementById('map');
    button.hidden = true;
    document.getElementById('map-loading-status').textContent = '지도를 불러오는 중…';
    map.hidden = false;
    try {
      await MapModule.load('map');
      placeholder.hidden = true;
      MapModule.resize();
      if (!this._locationStarted) {
        this._locationStarted = true;
        this._stopLocation = startLocation(position => MapModule.setUserLocation(position.coords), message => {
          document.getElementById('btn-map-location').title = message;
        });
        window.addEventListener('pagehide', () => {
          this._stopLocation?.();
          this._locationStarted = false;
        });
        window.addEventListener('pageshow', event => { if (event.persisted) this.showMap(); });
      }
    } catch (error) {
      document.getElementById('map-loading-status').textContent = error.message;
      button.hidden = false;
      UI.showToast(error.message, 'error');
    }
  },

  _showMapTab() {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      this._setPanel('groups', true);
      this._setPanel('places', true);
    }
    this._updateMapControls();
    requestAnimationFrame(() => MapModule.resize());
  },

  _setPanel(name, collapsed) {
    document.querySelector('.app-layout').dataset[`${name}Collapsed`] = String(collapsed);
    const button = document.getElementById(`btn-toggle-${name}`);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', `${name === 'groups' ? '그룹' : '장소'} 목록 ${collapsed ? '펼치기' : '접기'}`);
    button.title = button.getAttribute('aria-label');
    button.innerHTML = icon('chevron');
    button.style.transform = collapsed ? '' : 'rotate(180deg)';
  },

  _bindPanels() {
    const mobile = window.matchMedia('(max-width: 1023px)');
    document.querySelectorAll('.btn-list-options').forEach(button => {
      button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(expanded));
        document.querySelector('.app-layout').dataset[`${button.dataset.options}Options`] = String(expanded);
        if (expanded) {
          this._setPanel(button.dataset.options, false);
          if (mobile.matches) this._setPanel(button.dataset.options === 'groups' ? 'places' : 'groups', true);
        }
      });
    });
    for (const name of ['groups', 'places']) {
      this._setPanel(name, mobile.matches);
      const button = document.getElementById(`btn-toggle-${name}`);
      const toggle = () => {
        const collapsed = document.querySelector('.app-layout').dataset[`${name}Collapsed`] !== 'true';
        this._setPanel(name, collapsed);
        if (mobile.matches && !collapsed) this._setPanel(name === 'groups' ? 'places' : 'groups', true);
        requestAnimationFrame(() => MapModule.resize());
      };
      button.addEventListener('click', toggle);
      button.closest('.panel-header').addEventListener('click', event => {
        if (mobile.matches && !event.target.closest('button, input, select, a')) toggle();
      });
    }
    mobile.addEventListener('change', () => {
      for (const name of ['groups', 'places']) this._setPanel(name, mobile.matches);
      requestAnimationFrame(() => MapModule.resize());
    });
    this._mapResizeObserver = new ResizeObserver(() => requestAnimationFrame(() => MapModule.resize()));
    this._mapResizeObserver.observe(document.getElementById('map-container'));
  },

  _updateMapControls() {
    const place = Storage.getPlacesByGroup(state.currentGroupId).find(p => p.id === state.selectedPlaceId);
    const valid = place && Number.isFinite(place.lat) && Number.isFinite(place.lng);
    if (!valid) { state.selectedPlaceId = null; if (state.mapView !== 'user') state.mapView = 'group'; }
    const groupButton = document.getElementById('btn-map-group');
    const placeButton = document.getElementById('btn-map-place');
    groupButton.disabled = !state.currentGroupId;
    placeButton.disabled = !valid;
    groupButton.setAttribute('aria-pressed', String(state.mapView === 'group'));
    placeButton.setAttribute('aria-pressed', String(state.mapView === 'place'));
    placeButton.title = valid ? place.name : '목록에서 장소를 선택하세요';
    const selectedName = document.getElementById('mobile-selected-place');
    if (selectedName) selectedName.textContent = place?.name || '장소 선택';
  },

  renderShared() {
    const groups = sorted(Storage.getGroups(), state.groupSort);
    if (!groups.some(g => g.id === state.currentGroupId)) {
      state.currentGroupId = null;
      if (groups.length) { this.selectGroup(groups[0].id); return; }
      UI.setCurrentGroupName('');
      UI.renderPlaces([], {});
      MapModule.clearMarkers();
      document.getElementById('map-category-filters').hidden = true;
    } else {
      UI.setCurrentGroupName(groups.find(g => g.id === state.currentGroupId).name);
      this.renderPlaces();
    }
    this.renderGroups();
    this._updateMapControls();
  },

  // ── 그룹 ────────────────────────────────────────
  renderGroups() {
    const groups = sorted(Storage.getGroups(), state.groupSort);
    UI.renderGroups(groups, state.currentGroupId, {
      onSelect: (id) => this.selectGroup(id),
      onReorder: async ids => {
        if (!state.editing) return;
        try {
          await Storage.reorderGroups(ids);
          state.groupSort = 'manual';
          document.getElementById('sort-groups').value = 'manual';
        } catch (error) { UI.showToast(error.message, 'error'); }
        this.renderGroups();
      },
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
        this.renderShared();
        UI.showToast('그룹이 삭제되었습니다.');
      },
    });
  },

  selectGroup(id) {
    state.currentGroupId = id;
    state.selectedPlaceId = null;
    state.mapView = 'group';
    state.filterCategory = '';
    state.filterTag = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-tag').value = '';

    const group = Storage.getGroups().find(g => g.id === id);
    UI.setCurrentGroupName(group?.name || '');
    this.renderGroups();
    this.renderPlaces();
    MapModule.fitGroup();
    this._showMapTab();
  },

  // ── 장소 ────────────────────────────────────────
  setCategory(category) {
    state.filterCategory = category;
    state.selectedPlaceId = null;
    state.mapView = 'group';
    document.getElementById('filter-category').value = category;
    this.renderPlaces();
    MapModule.fitGroup();
  },

  renderCategoryFilters(places) {
    const nav = document.getElementById('map-category-filters');
    const categories = Object.keys(CATEGORY_COLORS).filter(category => places.some(p => p.category === category));
    if (state.filterCategory && !categories.includes(state.filterCategory)) {
      state.filterCategory = '';
      document.getElementById('filter-category').value = '';
    }
    nav.hidden = !places.length;
    nav.innerHTML = ['', ...categories].map(category => {
      const label = category ? category.split('/')[0] : '전체';
      return `<button type="button" class="map-category-btn" data-category="${category}" style="--category-color:${CATEGORY_COLORS[category] || '#343A40'}" aria-label="${category || '전체'} 장소 표시" aria-pressed="${state.filterCategory === category}">${category ? categoryIcon(category) : icon('layers')}<span>${label}</span></button>`;
    }).join('');
  },

  renderPlaces() {
    if (!state.currentGroupId) return;
    let places = Storage.getPlacesByGroup(state.currentGroupId);
    this.renderCategoryFilters(places);

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

    places = sorted(places, state.placeSort);
    UI.renderPlaces(places, {
      onSelect: (id) => {
        if (state.selectedPlaceId === id) {
          this.selectGroup(state.currentGroupId);
          return;
        }
        const place = Storage.getPlaces().find(p => p.id === id);
        if (place) {
          if (!MapModule.panToPlace(place)) { UI.showToast('저장된 위치 좌표가 없습니다.'); return; }
          state.selectedPlaceId = id;
          state.mapView = 'place';
          this._showMapTab();
          document.querySelectorAll('.place-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
        }
      },
      onReorder: async ids => {
        if (!state.editing) return;
        const groupId = state.currentGroupId;
        try {
          await Storage.reorderPlaces(groupId, ids);
          state.placeSort = 'manual';
          document.getElementById('sort-places').value = 'manual';
        } catch (error) { UI.showToast(error.message, 'error'); }
        this.renderPlaces();
      },
      onEdit: (id) => {
        if (!state.editing) return;
        const place = Storage.getPlaces().find(p => p.id === id);
        UI.showPlaceModal(state.currentGroupId, place, async (data) => {
          await Storage.updatePlace(id, data);
          this.renderPlaces();
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
        UI.showToast('장소가 삭제되었습니다.');
      },
    });

    document.querySelectorAll('.place-item').forEach(el => el.classList.toggle('active', el.dataset.id === state.selectedPlaceId));

    // 지도 마커 업데이트
    if (!places.some(p => p.id === state.selectedPlaceId)) {
      state.selectedPlaceId = null;
      state.mapView = 'group';
    }
    MapModule.showPlaces(places);
    this._updateMapControls();
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

    document.getElementById('btn-add-bulk').addEventListener('click', () => {
      if (!state.editing || !state.currentGroupId) return;
      const group = Storage.getGroups().find(g => g.id === state.currentGroupId);
      if (!group) return;
      BulkUI.open(group, async records => {
        const result = await Storage.addPlaces(group.id, records);
        this.renderShared();
        if (state.currentGroupId === group.id) MapModule.fitGroup();
        UI.showToast(`${result.added}개 장소 추가${result.skipped ? ` · 중복 ${result.skipped}개 제외` : ''}`);
        return result;
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
      const groupId = state.currentGroupId;
      if (!groupId) { UI.showToast('내보낼 그룹을 선택해주세요.'); return; }
      const format = await UI.showExportOptions();
      if (!format) return;
      const button = document.getElementById('btn-export');
      button.disabled = true;
      try {
        const response = await fetch(`/api/export?format=${encodeURIComponent(format)}&groupId=${encodeURIComponent(groupId)}`, { signal: AbortSignal.timeout(45000) });
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
    document.getElementById('sort-groups').addEventListener('change', e => {
      state.groupSort = e.target.value;
      this.renderGroups();
    });
    document.getElementById('sort-places').addEventListener('change', e => {
      state.placeSort = e.target.value;
      this.renderPlaces();
    });
    document.getElementById('filter-category').addEventListener('change', (e) => {
      this.setCategory(e.target.value);
    });
    MapModule.onDetails(place => UI.showPlaceDetails(place));
    document.getElementById('map-category-filters').addEventListener('click', event => {
      const button = event.target.closest('button[data-category]');
      if (button) this.setCategory(button.dataset.category);
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

  // Persistent map actions do not depend on opening a list panel.
  _bindMobileTabs() {
    document.getElementById('btn-map-location').addEventListener('click', () => {
      const button = document.getElementById('btn-map-location');
      if (!navigator.geolocation) { UI.showToast('현재 브라우저는 위치 정보를 지원하지 않습니다.', 'error'); return; }
      if (!MapModule.loaded) { UI.showToast('지도를 불러온 후 다시 눌러주세요.'); return; }
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const finish = () => { button.disabled = false; button.removeAttribute('aria-busy'); };
      navigator.geolocation.getCurrentPosition(position => {
        finish();
        if (MapModule.setUserLocation(position.coords, true)) {
          state.selectedPlaceId = null;
          state.mapView = 'user';
          document.querySelectorAll('.place-item.active').forEach(el => el.classList.remove('active'));
          button.title = '내 현재 위치로 이동';
          this._updateMapControls();
        }
      }, error => { finish(); UI.showToast(locationError(error), 'error'); }, {enableHighAccuracy:true,maximumAge:5000,timeout:15000});
    });
    document.getElementById('btn-map-group').addEventListener('click', () => {
      if (!state.currentGroupId) return;
      state.mapView = 'group';
      this.setCategory('');
      MapModule.fitGroup();
      this._updateMapControls();
    });
    document.getElementById('btn-map-place').addEventListener('click', () => {
      const place = Storage.getPlacesByGroup(state.currentGroupId).find(p => p.id === state.selectedPlaceId);
      if (!place || !MapModule.panToPlace(place)) return;
      state.mapView = 'place';
      this._updateMapControls();
    });
  },
};
