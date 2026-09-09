// public/js/map.js
import { routeControls } from './route-controls.js';
import { routeSegments } from './route-lines.js';
import { placeColor } from './place-colors.js';
import { categoryIcon } from './icons.js';
import { shortName, availableLabels } from './map-labels.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

let _map = null;
let _markers = [];
let _infoWindow = null;
let _onMarkerClick = null;
let _loadPromise = null;
let _places = [];
let _signature = '';
let _positionSignature = '';
let _ready = false;
let _selection = null;
let _onDetails = null;
let _labelFrame = null;
let _userMarker = null;
let _routeIds = [];
let _routeEditing = false;
let _draftIds = [];
let _onRouteAction = null;
let _routeLines = [];

export const MapModule = {
  onRouteAction(callback) { _onRouteAction = callback; },
  setRoute(ids, editing = false, draftIds = []) {
    const changed = JSON.stringify(ids) !== JSON.stringify(_routeIds);
    _routeIds = [...ids];
    _routeEditing = editing;
    _draftIds = [...draftIds];
    if (_ready && changed) this._renderPlaces();
    else this._scheduleLabels();
  },
  setUserLocation(coords, center = false) {
    if (!_ready || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return false;
    const position = new naver.maps.LatLng(coords.latitude, coords.longitude);
    if (!_userMarker) {
      _userMarker = new naver.maps.Marker({position, map:_map, title:'내 현재 위치', zIndex:2000,
        icon:{content:'<div class="user-location-dot" role="img" aria-label="내 현재 위치"></div>', anchor:new naver.maps.Point(12,12)}});
    } else _userMarker.setPosition(position);
    if (center) {
      _selection = {type:'user'};
      this._highlightSelection();
      _map.setCenter(position);
    }
    return true;
  },
  get _map() { return _map; },
  get loaded() { return _ready; },
  async load(containerId = 'map') {
    if (_ready) return;
    if (_loadPromise) return _loadPromise;
    _loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => fail(new Error('지도를 불러오지 못했습니다. 다시 시도해주세요.')), 15000);
      const clean = () => { clearTimeout(timer); script.onerror = null; delete window.naverMapReady; };
      const fail = error => {
        clean(); script.remove();
        if (_map) _map.destroy();
        _map = null; _ready = false; _positionSignature = '';
        reject(error);
      };
      window.naverMapReady = () => queueMicrotask(() => {
        try {
          this.init(containerId, () => { clean(); resolve(); });
        }
        catch (error) {
          console.warn('Map initialization failed', error);
          fail(new Error('지도 초기화에 실패했습니다: ' + error.message));
        }
      });
      window.navermap_authFailure = () => {
        _loadPromise = null;
        window.dispatchEvent(new CustomEvent('map-error', { detail: '지도 인증에 실패했습니다.' }));
        fail(new Error('지도 인증에 실패했습니다.'));
      };
      script.onerror = () => fail(new Error('네이버지도에 연결하지 못했습니다.'));
      script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId='
        + encodeURIComponent(window.APP_CONFIG.naverMapClientId) + '&callback=naverMapReady';
      document.head.appendChild(script);
    });
    try { await _loadPromise; } catch (error) { _loadPromise = null; throw error; }
  },
  init(containerId, onReady = () => {}) {
    if (_map) return;
    _map = new naver.maps.Map(containerId, {
      center: new naver.maps.LatLng(36.5, 127.5), // 한국 중심
      zoom: 7,
      mapTypeId: naver.maps.MapTypeId.NORMAL,
    });
    _infoWindow = new naver.maps.InfoWindow({ disableAutoPan: true, borderWidth: 0, backgroundColor: 'transparent', anchorSize: new naver.maps.Size(0, 0), pixelOffset: new naver.maps.Point(22, 0) });
    for (const event of ['idle', 'bounds_changed']) naver.maps.Event.addListener(_map, event, () => this._scheduleLabels());
    document.getElementById?.('map-labels')?.addEventListener('click', event => {
      const action = event.target.closest('[data-route-action]');
      if (action) { event.stopPropagation(); _onRouteAction?.(action.dataset.routeAction, action.dataset.routePlace); return; }
      const button = event.target.closest('[data-details]');
      const place = button && _places.find(p => p.id === button.dataset.details);
      if (place) { event.stopPropagation(); _onDetails?.(place); }
    });
    naver.maps.Event.once(_map, 'init', () => {
      _ready = true;
      this._renderPlaces();
      onReady();
    });
  },

  onMarkerClick(callback) {
    _onMarkerClick = callback;
  },
  onDetails(callback) { _onDetails = callback; },

  _scheduleLabels() {
    if (typeof requestAnimationFrame !== 'function' || _labelFrame !== null) return;
    _labelFrame = requestAnimationFrame(() => { _labelFrame = null; this._renderLabels(); });
  },
  _renderLabels() {
    this._highlightSelection();
    const layer = document.getElementById('map-labels');
    const container = document.getElementById('map');
    if (!layer || !container) return;
    const bounds = container.getBoundingClientRect();
    const rows = Array.from(container.querySelectorAll('.map-pin[data-place-id]')).map(pin => {
      const place = _places.find(p => p.id === pin.dataset.placeId);
      const rect = pin.getBoundingClientRect();
      return { place, pin: rect, box: {left:rect.right + 6, right:rect.right + (_routeEditing ? 178 : 122), top:rect.top - 6, bottom:rect.top + (_routeEditing ? 102 : 50)} };
    }).filter(row => row.place && row.pin.width > 0);
    const obstacles = Array.from(document.querySelectorAll('.map-category-btn, .map-view-btn')).filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
    const selectedId = _selection?.type === 'place' ? _selection.id : null;
    layer.style.zIndex = selectedId ? '31' : '20';
    layer.innerHTML = availableLabels(rows, bounds, obstacles, selectedId).map(({place,box,selected}) => `<div class="map-place-card${_routeEditing ? ' has-route-controls' : ''}" style="left:${box.left-bounds.left}px;top:${box.top-bounds.top}px;z-index:${selected ? 2 : 1}"><span title="${escapeHtml(place.name)}">${escapeHtml(shortName(place.name))}</span><button type="button" data-details="${escapeHtml(place.id)}" aria-label="${escapeHtml(place.name)} 상세보기">상세보기</button>${routeControls(place.id, {editing:_routeEditing, ids:_draftIds})}</div>`).join('');
  },

  showPlaces(places) {
    const signature = JSON.stringify(places);
    if (signature === _signature) return;
    _signature = signature;
    _places = places;
    if (_ready) this._renderPlaces();
  },

  _renderPlaces() {
    this._clearMarkers();
    const validPlaces = _places.filter(p => p.lat !== null && p.lng !== null && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    validPlaces.forEach(place => this._addMarker(place));
    this._renderRouteLines();
    const positions = JSON.stringify(validPlaces.map(p => [p.id, p.lat, p.lng]).sort((a, b) => a[0].localeCompare(b[0])));
    if (positions !== _positionSignature) this._applySelection();
    else if (_selection?.type === 'place') this._showName(_selection.id);
    _positionSignature = positions;
    this._scheduleLabels();
  },

  clearMarkers() {
    _selection = null;
    _places = [];
    _signature = '';
    _positionSignature = '';
    this._clearMarkers();
  },

  _clearMarkers() {
    _routeLines.forEach(line => line.setMap(null));
    _routeLines = [];
    const routeStatus = document.getElementById?.('map-route-status');
    if (routeStatus) routeStatus.hidden = true;
    _markers.forEach(m => m.setMap(null));
    _markers = [];
    if (_infoWindow) _infoWindow.close();
    const layer = document.getElementById?.('map-labels');
    if (layer) layer.innerHTML = '';
  },

  _renderRouteLines() {
    const segments = routeSegments(_routeIds, _places);
    for (const { from, to } of segments) {
      // Put the direction arrow halfway along the leg so destination pins cannot hide it.
      const start = new naver.maps.LatLng(from.lat, from.lng);
      const middle = new naver.maps.LatLng((from.lat + to.lat) / 2, (from.lng + to.lng) / 2);
      const end = new naver.maps.LatLng(to.lat, to.lng);
      const style = {map: _map, strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.9, clickable: false, zIndex: 1};
      _routeLines.push(new naver.maps.Polyline({...style, path: [middle, end]}));
      _routeLines.push(new naver.maps.Polyline({...style, path: [start, middle], endIcon: naver.maps.PointingIcon.OPEN_ARROW, endIconSize: 14}));
    }
    const status = document.getElementById?.('map-route-status');
    if (status) {
      status.hidden = _routeIds.length < 2;
      status.textContent = segments.length ? '방문 순서 → 직선 연결' : '연결할 장소의 좌표가 없습니다';
      if (segments.length && segments.length < _routeIds.length - 1) status.textContent += ' · 일부 구간 생략';
      status.title = '방문 순서를 직선으로 연결합니다. 실제 도로·도보 경로가 아니며, 좌표가 없거나 필터로 숨긴 장소의 구간은 생략합니다.';
    }
  },

  fitGroup() {
    _selection = { type: 'group' };
    this._applySelection();
  },

  _highlightSelection() {
    const id = _selection?.type === 'place' ? _selection.id : null;
    document.querySelectorAll?.('.map-pin[data-place-id]').forEach(pin => {
      pin.classList.toggle('is-selected', pin.dataset.placeId === id);
    });
    _markers.forEach(marker => marker.setZIndex?.(marker.placeId === id ? 1000 : 0));
  },

  panToPlace(place, preserveZoom = false) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return false;
    _selection = { type: 'place', id: place.id, preserveZoom };
    this._applySelection();
    return true;
  },

  _applySelection() {
    if (!_ready) return;
    this._highlightSelection();
    if (_selection?.type === 'user') return;
    if (_selection?.type === 'place') {
      const place = _places.find(p => p.id === _selection.id);
      if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
        if (!_selection.preserveZoom) _map.setZoom(15, false);
        _map.setCenter(new naver.maps.LatLng(place.lat, place.lng));
        this._showName(place.id);
        return;
      }
      _selection = { type: 'group' };
    }
    _infoWindow.close();
    const valid = _places.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (valid.length) this._fitBounds(valid);
    else { _map.setZoom(7, false); _map.setCenter(new naver.maps.LatLng(36.5, 127.5)); }
    this._scheduleLabels();
  },

  _showName(id) {
    this._scheduleLabels();
  },

  resize() {
    if (_ready) { _map.autoResize(); this._applySelection(); }
  },

  _addMarker(place) {
    const color = placeColor(place);
    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(place.lat, place.lng),
      map: _map,
      title: place.name,
      icon: {
        content: `<svg class="map-pin" data-place-id="${escapeHtml(place.id)}" width="38" height="48" viewBox="0 0 38 48" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;filter:drop-shadow(0 3px 3px #0006)">
          <path d="M19 46C15 39 3 28 3 19a16 16 0 1 1 32 0c0 9-12 20-16 27Z" fill="${color}" stroke="#172033" stroke-width="3" stroke-linejoin="round"/>
          <circle cx="19" cy="19" r="11" fill="#fff"/>
          ${categoryIcon(place.category).replace('<svg ', '<svg x="10" y="10" width="18" height="18" style="width:18px;height:18px;color:#172033;--accent-secondary:#172033" ')}
          ${_routeIds.includes(place.id) ? `<g class="route-pin-number" aria-label="방문 순서 ${_routeIds.indexOf(place.id) + 1}"><circle cx="39" cy="3" r="12" fill="#172033" stroke="white" stroke-width="2"/><text x="39" y="7" text-anchor="middle" fill="white" font-size="12" font-weight="700">${_routeIds.indexOf(place.id) + 1}</text></g>` : ''}
        </svg>`,
        anchor: new naver.maps.Point(19, 46),
      },
    });

    marker.placeId = place.id;
    naver.maps.Event.addListener(marker, 'click', () => {
      this.panToPlace(place, true);
      if (_onMarkerClick) _onMarkerClick(place);
    });

    _markers.push(marker);
  },

  _fitBounds(places) {
    if (places.length === 1) {
      _map.setZoom(15, false);
      _map.setCenter(new naver.maps.LatLng(places[0].lat, places[0].lng));
      return;
    }
    const bounds = new naver.maps.LatLngBounds();
    places.forEach(p => bounds.extend(new naver.maps.LatLng(p.lat, p.lng)));
    _map.fitBounds(bounds, { top: 64, right: 48, bottom: 48, left: 48, maxZoom: 16 });
  },
};
