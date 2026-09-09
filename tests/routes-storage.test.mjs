import test from 'node:test';
import assert from 'node:assert/strict';
import { validateData } from '../lib/trip-data.js';

test('route operations, backups, cleanup, conflicts and failures preserve shared state', async t => {
  let server = { groups: [], places: [], revision: null };
  let version = 0;
  let offline = false;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  t.after(() => { if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window; });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (offline) throw new Error('offline');
    if (options.method === 'PUT') {
      const data = JSON.parse(options.body);
      if (data.revision !== server.revision) return Response.json({ message: 'conflict' }, { status: 409 });
      try { server = { ...validateData(data), revision: String(++version) }; }
      catch { return Response.json({ message: 'invalid' }, { status: 400 }); }
    }
    return Response.json(server);
  });
  const { Storage: first } = await import('../public/js/storage.js?routes-first');
  const { Storage: second } = await import('../public/js/storage.js?routes-second');
  await first.refresh(); first.setEditing(true);
  assert.deepEqual(first.getRoutes(), []);
  const groupA = await first.addGroup({ name: 'A' });
  const groupB = await first.addGroup({ name: 'B' });
  const a = await first.addPlace({ groupId: groupA.id, name: 'a', imageUrls:['https://example.com/a.jpg'] });
  await first.updatePlace(a.id,{notes:'메모만 수정'});
  assert.deepEqual(first.getPlaces()[0].imageUrls,['https://example.com/a.jpg']);
  await assert.rejects(()=>first.updatePlace(a.id,{imageUrls:Array(4).fill('https://example.com/a.jpg')}),/최대 3개/);
  const b = await first.addPlace({ groupId: groupB.id, name: 'b' });
  const route = await first.addRoute({ name: '교차 그룹', placeIds: [b.id, a.id] });
  const other = await first.addRoute({ name: '두 번째', placeIds: [a.id] });
  await first.reorderRoutes([other.id, route.id]);
  assert.deepEqual(first.getRoutes().map(r => r.id), [other.id, route.id]);
  await first.updateRoute(route.id, { name: '수정' });
  await second.refresh(); second.setEditing(true);
  assert.deepEqual(second.getRoutes()[1].placeIds, [b.id, a.id]);
  const clone = first.getRoutes(); clone[1].placeIds.length = 0;
  assert.equal(first.getRoutes()[1].placeIds.length, 2);
  for (const data of [{ name: 'empty', placeIds: [] }, { name: 'bad', placeIds: ['missing'] }, { name: 'dup', placeIds: [a.id, a.id] }, { name: ' ', placeIds: [a.id] }]) await assert.rejects(() => first.addRoute(data));
  const editingBase = first.getRoutes().find(r => r.id === route.id);
  await second.updateRoute(route.id, {name:'다른 기기 수정'});
  await first.refresh();
  await assert.rejects(() => first.updateRoute(route.id, {name:'오래된 지도 수정'}, editingBase), /다른 기기에서 이 Route/);
  assert.equal(first.getRoutes().find(r=>r.id===route.id).name,'다른 기기 수정');
  await first.updateRoute(route.id, {name:'수정'}, first.getRoutes().find(r=>r.id===route.id));
  await second.refresh();
  const backup = first.exportData();
  assert.equal(JSON.parse(backup).version, 2);
  assert.deepEqual(JSON.parse(backup).places[0].imageUrls,['https://example.com/a.jpg']);
  offline = true;
  await assert.rejects(() => first.deleteRoute(route.id));
  assert.equal(first.getRoutes().length, 2);
  offline = false;
  await first.deletePlace(b.id);
  assert.deepEqual(first.getRoutes()[1].placeIds, [a.id]);
  await assert.rejects(() => second.updateRoute(route.id, { name: 'stale' }), /conflict/);
  assert.deepEqual(second.getRoutes()[1].placeIds, [a.id]);
  await first.deleteGroup(groupA.id);
  assert.deepEqual(first.getRoutes().map(r => r.placeIds), [[], []]);
  await first.importData(backup, 'overwrite');
  assert.deepEqual(first.getPlaces()[0].imageUrls,['https://example.com/a.jpg']);
  await first.updatePlace(a.id,{imageUrls:[]});
  assert.deepEqual(first.getPlaces()[0].imageUrls,[]);
  assert.deepEqual(first.getRoutes()[1].placeIds, [b.id, a.id]);
  await first.deleteRoute(route.id);
  await first.importData(backup, 'merge');
  await first.importData(backup, 'merge');
  assert.equal(first.getRoutes().length, 2);
  const oldBackup = JSON.stringify({ groups: [], places: [] });
  await first.importData(oldBackup, 'merge');
  assert.equal(first.getRoutes().length, 2);
  await first.importData(oldBackup, 'overwrite');
  assert.deepEqual(first.getRoutes(), []);
  await assert.rejects(() => first.importData(JSON.stringify({ ...JSON.parse(backup), routes: [{ ...route, placeIds: ['missing'] }] }), 'overwrite'), /invalid/);
  assert.deepEqual(first.getGroups(), []);
});
