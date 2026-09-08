import test from 'node:test';
import assert from 'node:assert/strict';

test('independent devices share writes, keep failed drafts off server and preserve legacy backup', async t => {
  let server = { groups: [], places: [], revision: null };
  let revision = 0;
  let offline = false;
  const local = new Map();
  const descriptors = Object.fromEntries(['window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => local.get(key) ?? null,
    setItem: (key, value) => local.set(key, value),
  } });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/trips');
    if (offline) throw new Error('offline');
    if (options.method === 'PUT') {
      const next = JSON.parse(options.body);
      if (next.revision !== server.revision) return Response.json({ message: 'conflict' }, { status: 409 });
      server = { ...next, revision: String(++revision) };
    }
    return Response.json(server);
  });
  const { Storage: first } = await import('../public/js/storage.js?first');
  const { Storage: second } = await import('../public/js/storage.js?second');
  await first.refresh();
  await second.refresh();
  const group = await first.addGroup({ name: '함께 여행' });
  await assert.rejects(() => second.addGroup({ name: 'stale draft' }), /conflict/);
  assert.equal(second.getGroups()[0].name, '함께 여행');
  await second.addPlace({ groupId: group.id, name: '새 장소' });
  await first.refresh();
  assert.equal(first.getPlaces()[0].name, '새 장소');
  offline = true;
  await assert.rejects(() => first.updateGroup(group.id, { name: '실패한 변경' }));
  assert.equal(first.getGroups()[0].name, '함께 여행');
  offline = false;
  const backup = JSON.stringify([{ id: 'legacy', name: '예전 여행' }]);
  local.set('ftm_groups', backup);
  local.set('ftm_places', '[]');
  assert.equal(first.hasLegacyData(), true);
  await first.migrateLegacyData();
  assert.equal(first.hasLegacyData(), false);
  assert.equal(local.get('ftm_groups'), backup);
  await second.refresh();
  assert.equal(second.getGroups().length, 2);
  await first.migrateLegacyData();
  assert.equal(first.getGroups().length, 2);
  await first.deleteGroup(group.id);
  await second.refresh();
  assert.equal(second.getPlaces().length, 0);
  assert.equal(second.getGroups()[0].id, 'legacy');
});
