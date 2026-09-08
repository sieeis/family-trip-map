import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/naver-place.js';
import { Parser } from '../public/js/parser.js';

const place = {
  id: '38314175', name: '마블오션',
  coordinate: { longitude: 126.3890683, latitude: 34.9479375 },
  category: { category: '펜션' },
  address: { roadAddress: '전남광주 무안군 청계면 해안로 745-34' },
};
const direct = 'https://map.naver.com/p/entry/place/38314175?placePath=%2Fhome';
const payload = (detail = place) => Response.json({ data: { placeDetail: detail } });
async function request(url, method = 'GET') {
  const result = { headers: {} };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  await handler({ method, query: { url } }, res);
  return result;
}

test('shared short link resolves and returns real nested place fields', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    if (calls.length === 1) {
      assert.equal(options.redirect, 'manual');
      return new Response(null, { status: 302, headers: { location: direct } });
    }
    assert.equal(url, 'https://map.naver.com/p/api/place/summary/38314175');
    return payload();
  });
  const result = await request('[네이버지도]\n마블오션\nhttps://naver.me/FdCxHEt4');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    naverPlaceId: '38314175', naverUrl: direct, name: '마블오션',
    address: place.address.roadAddress, phone: '', category: '숙소',
    lat: 34.9479375, lng: 126.3890683,
  });
  assert.equal(calls.length, 2);
});

test('direct mobile category link does not need to fetch the HTML page', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'https://map.naver.com/p/api/place/summary/38314175');
    return payload();
  });
  assert.equal((await request('https://m.place.naver.com/accommodation/38314175/home')).status, 200);
});

test('invalid hosts, credentials, schemes and input are rejected without fetching', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('must not fetch'));
  for (const url of [undefined, ['https://naver.me/FdCxHEt4'], 'http://naver.me/FdCxHEt4',
    'https://naver.me.evil.example/test', 'https://localhost/test',
    'https://user:password@naver.me/test', 'https://naver.me:1234/test']) {
    assert.equal((await request(url)).status, 400);
  }
  assert.equal((await request(direct, 'POST')).status, 405);
});

test('redirect to an unapproved host stops before the next fetch', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
  });
  assert.equal((await request('https://naver.me/FdCxHEt4')).status, 400);
  assert.equal(calls, 1);
});

test('redirect loops have a finite bound', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: '/loop' } });
  });
  assert.equal((await request('https://naver.me/loop')).body.error, 'place_id_not_found');
  assert.equal(calls, 6);
});

test('upstream failure is not reported as a nonexistent place', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  const result = await request(direct);
  assert.equal(result.status, 502);
  assert.equal(result.body.error, 'upstream_unavailable');
});

test('changed, mismatched and incomplete payloads cannot report success', async t => {
  let detail;
  t.mock.method(globalThis, 'fetch', async () => payload(detail));
  for (detail of [null, {}, { ...place, id: '123' }, { ...place, name: '' },
    { ...place, coordinate: {} }, { ...place, coordinate: { latitude: 100, longitude: 126 } }]) {
    assert.equal((await request(direct)).body.error, 'invalid_response');
  }
});

test('HTML upstream response and timeout have explicit failures', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('<html>error</html>'));
  assert.equal((await request(direct)).body.error, 'invalid_response');
  mock.mock.mockImplementation(async () => { throw new DOMException('Timed out', 'TimeoutError'); });
  const result = await request(direct);
  assert.equal(result.status, 504);
  assert.equal(result.body.error, 'upstream_timeout');
});

test('browser parser preserves server errors and successful data', async t => {
  const failure = { error: 'upstream_unavailable', message: '네이버 응답 지연' };
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(failure, { status: 502 }));
  assert.deepEqual(await Parser.fetchPlaceData(direct), failure);
  mock.mock.mockImplementation(async () => Response.json({ name: '마블오션', lat: 34.9479375 }));
  assert.equal((await Parser.fetchPlaceData(direct)).name, '마블오션');
  mock.mock.mockImplementation(async () => { throw new TypeError('fetch failed'); });
  assert.equal((await Parser.fetchPlaceData(direct)).error, 'network_error');
});
