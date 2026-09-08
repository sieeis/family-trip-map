// public/js/map.js
const CATEGORY_COLORS = {
  '맛집': '#FF5733',
  '관광지': '#3498DB',
  '숙소': '#9B59B6',
  '체험/액티비티': '#F39C12',
  '카페/디저트': '#E91E63',
  '쇼핑': '#2ECC71',
  '기타': '#95A5A6',
};

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

export const MapModule = {
  get _map() { return _map; },
  get loaded() { return _map !== null; },
  async load(containerId = 'map') {
    if (_map) return;
    if (_loadPromise) return _loadPromise;
    _loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => fail(new Error('지도를 불러오지 못했습니다. 다시 시도해주세요.')), 15000);
      const clean = () => { clearTimeout(timer); script.onerror = null; delete window.naverMapReady; };
      const fail = error => { clean(); script.remove(); reject(error); };
      window.naverMapReady = () => queueMicrotask(() => {
        try { this.init(containerId); clean(); resolve(); }
        catch (error) {
          console.warn('Map initialization failed', error);
          _map = null;
          fail(new Error('지도 초기화에 실패했습니다. 다시 시도해주세요.'));
        }
      });
      window.navermap_authFailure = () => {
        window.dispatchEvent(new CustomEvent('map-error', { detail: '지도 인증에 실패했습니다.' }));
      };
      script.onerror = () => fail(new Error('네이버지도에 연결하지 못했습니다.'));
      script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId='
        + encodeURIComponent(window.APP_CONFIG.naverMapClientId) + '&callback=naverMapReady';
      document.head.appendChild(script);
    });
    try { await _loadPromise; } catch (error) { _loadPromise = null; throw error; }
  },
  init(containerId) {
    if (_map) return;
    _map = new naver.maps.Map(containerId, {
      center: new naver.maps.LatLng(36.5, 127.5), // 한국 중심
      zoom: 7,
      mapTypeId: naver.maps.MapTypeId.NORMAL,
    });
    _infoWindow = new naver.maps.InfoWindow({ anchorSkew: true });
    this._renderPlaces();
  },

  onMarkerClick(callback) {
    _onMarkerClick = callback;
  },

  showPlaces(places) {
    const signature = JSON.stringify(places);
    if (signature === _signature) return;
    _signature = signature;
    _places = places;
    if (_map) this._renderPlaces();
  },

  _renderPlaces() {
    this._clearMarkers();
    const validPlaces = _places.filter(p => p.lat !== null && p.lng !== null && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    validPlaces.forEach(place => this._addMarker(place));
    const positions = JSON.stringify(validPlaces.map(p => [p.id, p.lat, p.lng]));
    if (validPlaces.length > 0 && positions !== _positionSignature) this._fitBounds(validPlaces);
    _positionSignature = positions;
  },

  clearMarkers() {
    _places = [];
    _signature = '';
    _positionSignature = '';
    this._clearMarkers();
  },

  _clearMarkers() {
    _markers.forEach(m => m.setMap(null));
    _markers = [];
    if (_infoWindow) _infoWindow.close();
  },

  panToPlace(place) {
    if (!_map || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;
    _map.panTo(new naver.maps.LatLng(place.lat, place.lng));
    _map.setZoom(15);
  },

  resize() {
    if (_map) naver.maps.Event.trigger(_map, 'resize');
  },

  _addMarker(place) {
    const color = CATEGORY_COLORS[place.category] || CATEGORY_COLORS['기타'];
    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(place.lat, place.lng),
      map: _map,
      title: place.name,
      icon: {
        content: `<div style="
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          background:${color};border:2px solid #fff;
          box-shadow:0 2px 6px rgba(0,0,0,.3);
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
        "></div>`,
        anchor: new naver.maps.Point(16, 32),
      },
    });

    naver.maps.Event.addListener(marker, 'click', () => {
      const content = `
        <div style="padding:12px 16px;min-width:200px;font-family:sans-serif;">
          <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${escapeHtml(place.name)}</div>
          ${place.address ? `<div style="color:#666;font-size:12px;margin-bottom:4px;">${escapeHtml(place.address)}</div>` : ''}
          ${place.phone ? `<div style="color:#666;font-size:12px;margin-bottom:8px;">📞 ${escapeHtml(place.phone)}</div>` : ''}
          ${place.naverUrl ? `<a href="${escapeHtml(place.naverUrl)}" target="_blank" rel="noopener"
            style="display:inline-block;padding:6px 12px;background:#03C75A;color:#fff;
            border-radius:6px;font-size:12px;text-decoration:none;">네이버지도에서 열기</a>` : ''}
        </div>`;
      _infoWindow.setContent(content);
      _infoWindow.open(_map, marker);
      if (_onMarkerClick) _onMarkerClick(place);
    });

    _markers.push(marker);
  },

  _fitBounds(places) {
    if (places.length === 1) {
      this.panToPlace(places[0]);
      return;
    }
    const bounds = new naver.maps.LatLngBounds();
    places.forEach(p => bounds.extend(new naver.maps.LatLng(p.lat, p.lng)));
    _map.fitBounds(bounds, { padding: 60 });
  },
};
