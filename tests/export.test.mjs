import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildExport, createExportHandler, GROUP_FIELDS, PLACE_FIELDS } from '../lib/trip-export.js';
import { validateData } from '../lib/trip-data.js';

const fixture = validateData({ groups: [
  { id: 'g1', name: '=SUM(1,2)', purpose: '가족 "여행"', region: '목포|서울', startDate: '2026-09-08', endDate: '2026-09-10', notes: '첫째\n둘째 <script> &', coverEmoji: '🗺️', createdAt: '2026-09-08T10:00:00.123+09:00' },
  { id: 'empty', name: '빈 그룹' },
], places: [{ id: 'p1', groupId: 'g1', name: '+명소', naverUrl: 'https://naver.me/FdCxHEt4', naverPlaceId: '38314175', address: '전남 목포', phone: '010-0012-3456', category: '숙소', tags: ['a|b', '"태그"', '줄\n바꿈'], notes: '@메모\n다음', visited: true, lat: 34.9479375, lng: 126.3890683, addedAt: '2026-09-08T01:00:00.000Z' }] });
const now = new Date('2026-09-08T12:00:00.000Z');
const state = { ...fixture, revision: '"revision1"' };

test('JSON preserves every schema field, empty group and export metadata', async () => {
  const result = await buildExport(state, 'json', now);
  const parsed = JSON.parse(result.body);
  assert.deepEqual(parsed.groups, fixture.groups);
  assert.deepEqual(parsed.places, fixture.places);
  assert.equal(parsed.exportedAt, now.toISOString());
  assert.equal(parsed.revision, state.revision);
  assert.match(result.filename, /^navermap-[\w-]+\.json$/);
});

test('Markdown includes all fields and safely preserves multiline Unicode metadata', async () => {
  const { body } = await buildExport(state, 'md', now);
  for (const field of [...GROUP_FIELDS, ...PLACE_FIELDS, 'exportedAt', 'revision']) assert.ok(body.includes(field));
  assert.ok(body.includes('빈 그룹'));
  assert.ok(body.includes('목포&#124;서울'));
  assert.ok(body.includes('첫째<br>둘째 &lt;script&gt; &amp;'));
  assert.ok(body.includes('https://naver.me/FdCxHEt4'));
  assert.ok(body.includes('38314175'));
});

test('Excel roundtrip preserves all values, uses typed cells, links and tables without formulas', async () => {
  const result = await buildExport(state, 'xlsx', now);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.body);
  for (const [sheetName, fields, records] of [['Groups', GROUP_FIELDS, fixture.groups], ['Places', PLACE_FIELDS, fixture.places]]) {
    const sheet = workbook.getWorksheet(sheetName);
    assert.deepEqual(sheet.getRow(1).values.slice(1), fields);
    assert.equal(sheet.views[0].ySplit, 1);
    assert.ok(sheet.getTable(sheetName));
    records.forEach((record, index) => fields.forEach((field, column) => {
      const cell = sheet.getRow(index + 2).getCell(column + 1);
      assert.equal(cell.formula, undefined);
      let expected = record[field];
      if (Array.isArray(expected)) expected = JSON.stringify(expected);
      if (expected && ['startDate', 'endDate', 'createdAt', 'addedAt'].includes(field)) assert.equal(cell.value.getTime(), Date.parse(expected));
      else if (field === 'naverUrl' && expected) assert.deepEqual(cell.value, { text: expected, hyperlink: expected });
      else assert.equal(cell.value ?? '', expected ?? '');
    }));
  }
  const metadata = workbook.getWorksheet('Metadata');
  const rows = metadata.getSheetValues().filter(Boolean).map(row => row.slice(1));
  assert.ok(rows.some(row => row[0] === 'revision' && row[1] === state.revision));
  assert.ok(rows.some(row => row[0] === 'groups.g1.createdAt' && row[1] === fixture.groups[0].createdAt));
});

test('ZIP contains exactly three downloadable files and supports an empty store', async () => {
  const { body } = await buildExport({ revision: null, groups: [], places: [] }, 'zip', now);
  const zip = await JSZip.loadAsync(body);
  assert.deepEqual(Object.keys(zip.files).map(name => name.split('.').at(-1)).sort(), ['json', 'md', 'xlsx']);
  const json = JSON.parse(await zip.file(/\.json$/)[0].async('string'));
  assert.deepEqual(json.groups, []);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await zip.file(/\.xlsx$/)[0].async('nodebuffer'));
  assert.deepEqual(workbook.getWorksheet('Places').getRow(1).values.slice(1), PLACE_FIELDS);
});

test('HTTP downloads shared snapshot, rejects invalid formats and never caches failures', async () => {
  async function call(store, req) {
    const result = { headers: {} };
    await createExportHandler(store)(req, { setHeader(key, value) { result.headers[key] = value; }, status(code) { result.status = code; return this; }, send(body) { result.body = body; }, json(body) { result.body = body; } });
    return result;
  }
  const store = { read: async () => state };
  const result = await call(store, { method: 'GET', query: { format: 'json' } });
  assert.equal(result.status, 200);
  assert.match(result.headers['Content-Disposition'], /^attachment; filename="navermap-/);
  assert.deepEqual(JSON.parse(result.body).places, state.places);
  for (const [req, status] of [[{ method: 'POST' }, 405], [{ method: 'GET', query: { format: '../bad' } }, 400], [{ method: 'GET', query: { format: ['json'] } }, 400]]) {
    const response = await call(store, req);
    assert.equal(response.status, status);
    assert.equal(response.headers['Cache-Control'], 'no-store');
  }
  const failed = await call({ read: async () => { throw new Error('secret'); } }, { method: 'GET' });
  assert.equal(failed.status, 503);
  assert.equal(failed.headers['Cache-Control'], 'no-store');
  assert.ok(!JSON.stringify(failed.body).includes('secret'));
});
