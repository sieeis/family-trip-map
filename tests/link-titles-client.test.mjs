import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchLinkTitle, linkTitleFallback, loadLinkTitles } from '../public/js/link-titles.js';

test('link title fallback decodes filenames and omits signed query credentials', () => {
  assert.equal(linkTitleFallback('https://example.com/%EC%97%AC%ED%96%89.jpg?token=secret'), '여행.jpg');
  assert.equal(linkTitleFallback('https://example.com/?token=secret'), 'example.com');
  assert.equal(linkTitleFallback('https://example.com/%XX'), '%XX');
});

test('link metadata shares pending requests and retains fallback when unavailable', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.ok(url.startsWith('/api/link-title?url='));
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ title: '  여행 안내  ' }) };
  });
  const url = 'https://example.com/cache-test';
  assert.deepEqual(await Promise.all([fetchLinkTitle(url), fetchLinkTitle(url)]), ['여행 안내', '여행 안내']);
  assert.equal(calls, 1);
  globalThis.fetch.mock.mockImplementation(async () => { throw new Error('unavailable'); });
  assert.equal(await fetchLinkTitle('https://example.com/unavailable.jpg'), 'unavailable.jpg');
});

test('popup metadata uses text and does not update closed or replaced links', async t => {
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  t.mock.method(globalThis, 'fetch', () => response);
  const link = { href: 'https://example.com/safe-title', isConnected: true, textContent: 'fallback', title: '' };
  const root = { style: { display: 'flex' }, querySelectorAll: () => [link] };
  loadLinkTitles(root);
  finish({ ok: true, json: async () => ({ title: '<img src=x onerror=alert(1)>' }) });
  await fetchLinkTitle(link.href);
  await Promise.resolve();
  assert.equal(link.textContent, '<img src=x onerror=alert(1)> ↗');
  assert.equal(link.title, '<img src=x onerror=alert(1)>');
  link.textContent = 'closed';
  root.style.display = 'none';
  loadLinkTitles(root);
  await Promise.resolve();
  assert.equal(link.textContent, 'closed');
  root.style.display = 'flex';
  link.isConnected = false;
  loadLinkTitles(root);
  await Promise.resolve();
  assert.equal(link.textContent, 'closed');
});
