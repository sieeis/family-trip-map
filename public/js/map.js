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

let _map = null;
let _markers = [];
let _infoWindow = null;
let _onMarkerClick = null;

export const MapModule = {
  init(containerId) {
    _map = new naver.maps.Map(containerId, {
      center: new naver.maps.LatLng(36.5, 127.5), // 한국 중심
      zoom: 7,
      mapTypeId: naver.maps.MapTypeId.NORMAL,
    });
    _infoWindow = new naver.maps.InfoWindow({ anchorSkew: true });
  },

  onMarkerClick(callback) {
    _onMarkerClick = callback;
  },

  showPlaces(places) {
    this.clearMarkers();
    const validPlaces = places.filter(p => p.lat && p.lng);
    validPlaces.forEach(place => this._addMarker(place));
    if (validPlaces.length > 0) this._fitBounds(validPlaces);
  },

  clearMarkers() {
    _markers.forEach(m => m.setMap(null));
    _markers = [];
    if (_infoWindow) _infoWindow.close();
  },

  panToPlace(place) {
    if (!place.lat || !place.lng) return;
    _map.panTo(new naver.maps.LatLng(place.lat, place.lng));
    _map.setZoom(15);
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
          <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${place.name}</div>
          ${place.address ? `<div style="color:#666;font-size:12px;margin-bottom:4px;">${place.address}</div>` : ''}
          ${place.phone ? `<div style="color:#666;font-size:12px;margin-bottom:8px;">📞 ${place.phone}</div>` : ''}
          ${place.naverUrl ? `<a href="${place.naverUrl}" target="_blank" rel="noopener"
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
