// public/js/map.js
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

export const MapModule = {
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
      return { place, pin: rect, box: {left:rect.right + 6, right:rect.right + 122, top:rect.top - 6, bottom:rect.top + 50} };
    }).filter(row => row.place && row.pin.width > 0);
    const obstacles = Array.from(document.querySelectorAll('.map-category-btn, .map-view-btn')).filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
    const selectedId = _selection?.type === 'place' ? _selection.id : null;
    layer.style.zIndex = selectedId ? '31' : '20';
    layer.innerHTML = availableLabels(rows, bounds, obstacles, selectedId).map(({place,box,selected}) => `<div class="map-place-card" style="left:${box.left-bounds.left}px;top:${box.top-bounds.top}px;z-index:${selected ? 2 : 1}"><span title="${escapeHtml(place.name)}">${escapeHtml(shortName(place.name))}</span><button type="button" data-details="${escapeHtml(place.id)}" aria-label="${escapeHtml(place.name)} 상세보기">상세보기</button></div>`).join('');
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
    _markers.forEach(m => m.setMap(null));
    _markers = [];
    if (_infoWindow) _infoWindow.close();
    const layer = document.getElementById?.('map-labels');
    if (layer) layer.innerHTML = '';
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
