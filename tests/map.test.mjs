import test from 'node:test';
import assert from 'node:assert/strict';

test('list-only view needs no SDK; map loads once and unchanged data keeps its viewport', async t => {
  const originals = Object.fromEntries(['window', 'document', 'naver'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const counters = { scripts: 0, maps: 0, markers: 0, fit: 0, pan: 0 };
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
    Map: class { constructor() { counters.maps++; } fitBounds() { counters.fit++; } panTo() { counters.pan++; } setZoom() {} },
    InfoWindow: class { close() {} },
    Marker: class { constructor() { counters.markers++; } setMap() {} },
    LatLng: class {}, LatLngBounds: class { extend() {} }, Point: class {},
    MapTypeId: { NORMAL: 'normal' }, Event: { addListener() {}, trigger() {} },
  } } });
  const { MapModule } = await import('../public/js/map.js?lazy-test');
  const places = [{ id: 'a', name: 'A', lat: 34, lng: 126 }, { id: 'b', name: 'B', lat: 35, lng: 127 }];
  MapModule.showPlaces(places);
  MapModule.panToPlace(places[0]);
  assert.equal(counters.scripts, 0);
  assert.equal(counters.maps, 0);
  await Promise.all([MapModule.load(), MapModule.load()]);
  assert.equal(counters.scripts, 1);
  assert.equal(counters.maps, 1);
  assert.equal(counters.markers, 2);
  assert.equal(counters.fit, 1);
  MapModule.showPlaces(structuredClone(places));
  assert.equal(counters.markers, 2);
  assert.equal(counters.fit, 1);
  MapModule.showPlaces(places.map(p => ({ ...p, notes: '메모만 변경' })));
  assert.equal(counters.fit, 1);
  await MapModule.load();
  assert.equal(counters.scripts, 1);
});
