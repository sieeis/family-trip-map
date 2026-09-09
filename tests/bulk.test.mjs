import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBulkLinks, resolveBulk } from '../public/js/bulk-import.js';

test('bulk validates limits and excludes repeated links', () => {
  assert.throws(() => parseBulkLinks(''));
  assert.throws(() => parseBulkLinks(Array(51).fill('https://naver.me/a').join('\n')));
  assert.deepEqual(parseBulkLinks('https://naver.me/a\nhttps://naver.me/a\nhttps://evil.test/a').map(r => r.status), ['pending', 'duplicate', 'invalid']);
});

test('bulk limits concurrency, preserves order, deduplicates aliases and retries failures only', async () => {
  const rows = parseBulkLinks('https://naver.me/a\nhttps://naver.me/b\nhttps://naver.me/c\nhttps://naver.me/d');
  let active = 0, maximum = 0;
  await resolveBulk(rows, { fetchPlace: async url => {
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, url.endsWith('a') ? 15 : 1));
    active--;
    if (url.endsWith('c')) throw new Error('temporary failure');
    return { name: url, lat: 37, lng: 127, naverPlaceId: url.endsWith('d') ? '2' : '1', naverUrl: url };
  }});
  assert.equal(maximum, 2);
  assert.deepEqual(rows.map(r => r.status), ['success', 'duplicate', 'failed', 'success']);
  const retried = [];
  await resolveBulk(rows, { fetchPlace: async url => {
    retried.push(url);
    return { name: 'retried', lat: 37, lng: 127, naverPlaceId: '3', naverUrl: url };
  }});
  assert.deepEqual(retried, ['https://naver.me/c']);
  assert.equal(rows[2].status, 'success');
});

test('existing places skip requests and cancellation prevents queued work', async () => {
  const existing = parseBulkLinks('https://map.naver.com/p/entry/place/123');
  await resolveBulk(existing, { existing: [{naverPlaceId:'123'}], fetchPlace: () => assert.fail('duplicate fetched') });
  assert.equal(existing[0].status, 'duplicate');
  const rows = parseBulkLinks('https://naver.me/a\nhttps://naver.me/b\nhttps://naver.me/c');
  const controller = new AbortController();
  let calls = 0;
  await resolveBulk(rows, { signal: controller.signal, fetchPlace: async () => {
    calls++;
    controller.abort();
    return {name:'late',lat:37,lng:127};
  }});
  assert.equal(calls, 1);
  assert.equal(rows.filter(r => r.status === 'success').length, 0);
});
