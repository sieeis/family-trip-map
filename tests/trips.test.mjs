import test from 'node:test';
import assert from 'node:assert/strict';
import { createTripsHandler } from '../lib/trips-handler.js';
import { validateData } from '../lib/trip-data.js';
import { BlobPreconditionFailedError } from '@vercel/blob';

const group = { id: 'group-1', name: '여행', createdAt: '2026-09-08T00:00:00.000Z' };
const place = { id: 'place-1', groupId: 'group-1', name: '마블오션', lat: 34.9479375, lng: 126.3890683 };
const data = { groups: [group], places: [place] };
function memoryStore() {
  let current = { groups: [], places: [], revision: null };
  let version = 0;
  return {
    async read() { return structuredClone(current); },
    async write(next, revision) {
      if (revision !== current.revision) {
        throw new BlobPreconditionFailedError();
      }
      current = { ...structuredClone(next), revision: `"${++version}"` };
      return this.read();
    },
  };
}
async function call(handler, method, body, headers = {}) {
  const result = {};
  const res = { setHeader() {}, status(status) { result.status = status; return this; }, json(body) { result.body = body; } };
  await handler({ method, body, headers: { host: 'trips.example', 'content-type': 'application/json', 'x-trip-edit': '1', ...headers } }, res);
  return result;
}
test('a save is visible to an independent visitor and deletion persists', async () => {
  const handler = createTripsHandler(memoryStore());
  const before = await call(handler, 'GET');
  assert.deepEqual(before.body.groups, []);
  const saved = await call(handler, 'PUT', { ...data, revision: before.body.revision });
  assert.equal(saved.status, 200);
  const other = await call(handler, 'GET');
  assert.equal(other.body.places[0].name, '마블오션');
  assert.equal((await call(handler, 'PUT', { groups: [], places: [], revision: other.body.revision })).status, 200);
  assert.deepEqual((await call(handler, 'GET')).body.places, []);
});

test('requests without explicit edit mode cannot write', async () => {
  const handler = createTripsHandler(memoryStore());
  assert.equal((await call(handler, 'PUT', { ...data, revision: null }, { 'x-trip-edit': undefined })).status, 403);
  assert.deepEqual((await call(handler, 'GET')).body.groups, []);
});
test('concurrent creates cannot overwrite the winner', async () => {
  const handler = createTripsHandler(memoryStore());
  const results = await Promise.all([
    call(handler, 'PUT', { ...data, revision: null }),
    call(handler, 'PUT', { groups: [{ ...group, name: '다른 여행' }], places: [], revision: null }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await call(handler, 'GET')).body.groups[0].name, '여행');
});
test('stale edit cannot silently overwrite changes', async () => {
  const handler = createTripsHandler(memoryStore());
  const first = await call(handler, 'PUT', { ...data, revision: null });
  await call(handler, 'PUT', { ...data, groups: [{ ...group, name: '변경됨' }], revision: first.body.revision });
  assert.equal((await call(handler, 'PUT', { ...data, revision: first.body.revision })).status, 409);
  assert.equal((await call(handler, 'GET')).body.groups[0].name, '변경됨');
});
test('invalid imports, dangling places and unsafe links are rejected', () => {
  for (const invalid of [null, { groups: {}, places: [] }, { groups: [], places: [place] },
    { groups: [group, group], places: [] }, { groups: [group], places: [place, place] },
    { groups: [{ ...group, id: '\"><img>' }], places: [] },
    { groups: [group], places: [{ ...place, naverUrl: 'javascript:alert(1)' }] },
    { groups: [group], places: [{ ...place, lat: 999 }] }]) {
    assert.throws(() => validateData(invalid));
  }
});
test('failed writes do not return success and cross-site writes are rejected', async () => {
  const handler = createTripsHandler({ read: async () => { throw new Error('offline'); }, write: async () => { throw new Error('offline'); } });
  assert.equal((await call(handler, 'GET')).status, 503);
  assert.equal((await call(handler, 'PUT', { ...data, revision: null })).status, 503);
  assert.equal((await call(handler, 'PUT', data, { origin: 'https://other.example' })).status, 403);
  assert.equal((await call(handler, 'PUT', data, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await call(handler, 'PUT', { groups: 'bad' })).status, 400);
});


test('custom pin colors persist, old data defaults safely and invalid colors are rejected', () => {
  const colored = validateData({ groups: [group], places: [{ ...place, pinColor: '#Ab12EF' }] });
  assert.equal(colored.places[0].pinColor, '#Ab12EF');
  assert.equal(validateData(data).places[0].pinColor, '');
  for (const pinColor of ['red', '#fff', '#zzzzzz', '" onload="alert(1)', 123]) {
    assert.throws(() => validateData({ groups: [group], places: [{ ...place, pinColor }] }));
  }
});
