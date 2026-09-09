import test from 'node:test';
import assert from 'node:assert/strict';

test('queued first selection centers after SDK init; groups refit and unchanged data preserves viewport', async t => {
  const originals = Object.fromEntries(['window', 'document', 'naver'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const counters = { scripts: 0, maps: 0, markers: 0, fit: 0, pan: 0, zoom: 0 };
  const lines = [];
  let markerClick;
  let details = 0;
  let center;
  let label;
  let initCallback;
  const fakeWindow = { APP_CONFIG: { naverMapClientId: 'test-key' } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ remove() {} }),
    head: { appendChild(script) {
      counters.scripts++;
      assert.match(script.src, /ncpKeyId=test-key/);
      queueMicrotask(() => {
        // The SDK invokes its callback before completing constructor setup.
        // Initialization must wait until the current script finishes.
        const Constructor = naver.maps.Map;
        naver.maps.Map = undefined;
        fakeWindow.naverMapReady();
        naver.maps.Map = Constructor;
      });
    } },
  } });
  Object.defineProperty(globalThis, 'naver', { configurable: true, value: { maps: {
    Map: class { constructor() { counters.maps++; } fitBounds(bounds, options) { counters.fit++; assert.equal(options.top, 64); } setCenter(point) { center = point; counters.pan++; } setZoom() { counters.zoom++; } autoResize() {} },
    Polyline: class { constructor(options) { this.options=options;this.map=options.map;lines.push(this); } setMap(map) {this.map=map;} },
    PointingIcon: {OPEN_ARROW:'open-arrow'},
    InfoWindow: class { constructor(options) { assert.equal(options.disableAutoPan, true); } close() {} setContent(value) { label = value; } open() {} },
    Marker: class { constructor(options) { counters.markers++; if (options.title === '내 현재 위치') return; assert.match(options.icon.content, /stroke="#172033"/); assert.match(options.icon.content, /<svg/); } setMap() {} setPosition() {} },
    LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } }, Size: class {}, LatLngBounds: class { extend() {} }, Point: class {},
    MapTypeId: { NORMAL: 'normal' }, Event: { addListener(marker, event, cb) { markerClick = cb; }, once(map, event, cb) { assert.equal(event, 'init'); initCallback = cb; }, trigger() {} },
  } } });
  const { MapModule } = await import('../public/js/map.js?lazy-test');
  const places = [{ id: 'a', name: 'A', lat: 34, lng: 126 }, { id: 'b', name: 'B', lat: 35, lng: 127 }];
  MapModule.showPlaces(places);
  MapModule.panToPlace(places[0]);
  assert.equal(counters.scripts, 0);
  assert.equal(counters.maps, 0);
  const loading = Promise.all([MapModule.load(), MapModule.load()]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(counters.pan, 0);
  initCallback();
  await loading;
  assert.equal(center.lat, 34);
  assert.equal(counters.fit, 0);
  MapModule.fitGroup();
  assert.equal(counters.scripts, 1);
  assert.equal(counters.maps, 1);
  assert.equal(counters.markers, 2);
  assert.equal(counters.fit, 1);
  MapModule.showPlaces(structuredClone(places));
  assert.equal(counters.markers, 2);
  assert.equal(counters.fit, 1);
  MapModule.showPlaces(places.map(p => ({ ...p, notes: '메모만 변경' })));
  assert.equal(counters.fit, 1);
  MapModule.fitGroup();
  assert.equal(counters.fit, 2, 'same group click must refit');
  MapModule.onMarkerClick(() => details++);
  MapModule.panToPlace(places[1]);
  assert.equal(center.lat, 35);
  assert.equal(details, 0, 'list selection must not open details');
  markerClick();
  assert.equal(details, 1);
  MapModule.resize();
  assert.equal(center.lat, 35);
  assert.equal(MapModule.panToPlace({ id: 'missing', lat: null, lng: null }), false);
  const previousZoom = counters.zoom;
  MapModule.setUserLocation({latitude:37.5,longitude:127.1}, true);
  assert.equal(center.lat, 37.5);
  assert.equal(counters.zoom, previousZoom, 'locate must preserve zoom');
  MapModule.setUserLocation({latitude:37.6,longitude:127.2});
  assert.equal(center.lat, 37.5, 'live updates must not move the camera');
  MapModule.resize();
  assert.equal(counters.zoom, previousZoom, 'resize after locate must preserve zoom');
  await MapModule.load();
  assert.equal(counters.scripts, 1);
  const beforeRoute = counters.pan;
  MapModule.setRoute(['a','b']);
  assert.equal(lines.filter(line=>line.map).length,4);
  let arrow=lines.find(line=>line.map && line.options.endIcon);
  assert.equal(arrow.options.endIcon,'open-arrow');
  assert.equal(arrow.options.strokeStyle,'shortdash');
  assert.ok(arrow.options.strokeOpacity > 0 && arrow.options.strokeOpacity < 1);
  assert.ok(lines.some(line=>line.map && line.options.strokeColor==='#ffffff' && line.options.strokeWeight > arrow.options.strokeWeight));
  assert.equal(arrow.options.path[0].lat,34);
  assert.equal(arrow.options.path[1].lat,34.5);
  assert.equal(counters.pan,beforeRoute,'route overlay must preserve camera');
  MapModule.setRoute(['a','b']);
  assert.equal(lines.length,4,'same route should reuse overlays');
  MapModule.setRoute(['b','a']);
  assert.equal(lines.filter(line=>line.map).length,4,'reordering removes previous overlays');
  arrow=lines.find(line=>line.map && line.options.endIcon);
  assert.equal(arrow.options.path[0].lat,35);
  MapModule.showPlaces([places[0]]);
  assert.equal(lines.filter(line=>line.map).length,0,'filtered place breaks leg');
  MapModule.showPlaces(places);
  assert.equal(lines.filter(line=>line.map).length,4);
  MapModule.setRoute([]);
  assert.equal(lines.filter(line=>line.map).length,0,'cancel clears path');
  MapModule.setRoute(['a','b']);
  MapModule.fitGroup();
  const camera = {fit:counters.fit,pan:counters.pan,zoom:counters.zoom};
  const distant = {id:'far',name:'먼 장소',lat:38,lng:129};
  MapModule.preserveViewport();
  MapModule.showPlaces([...places, distant]);
  MapModule.setRoute(['b','a']);
  MapModule.resize();
  assert.deepEqual({fit:counters.fit,pan:counters.pan,zoom:counters.zoom},camera,'map editing adds candidate pins without moving or zooming, including panel resize');
  MapModule.showPlaces(places);
  MapModule.resize();
  assert.deepEqual({fit:counters.fit,pan:counters.pan,zoom:counters.zoom},camera,'filter updates must also preserve viewport');
  MapModule.fitGroup();
  assert.equal(counters.fit,camera.fit+1,'explicit ALL action must still fit the map');
  MapModule.clearMarkers();
  assert.equal(lines.filter(line=>line.map).length,0,'group deletion clears path');
});
