import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildExport, createExportHandler, EXPORT_COLUMNS } from '../lib/trip-export.js';
import { placeColor } from '../public/js/place-colors.js';
import { validateData } from '../lib/trip-data.js';

const columns = ['그룹명', '그룹 아이콘', '지역', '목적/테마', '시작일', '종료일', '그룹 메모', '장소명', '카테고리', '주소', '연락처', '태그', '장소 메모', '방문', '네이버지도 URL', '핀 색상'];
const fixture = validateData({ groups: [
  { id: 'g1', name: '=SUM(1,2)', purpose: '가족 "여행"', region: '목포|서울', startDate: '2026-09-08', endDate: '2026-09-10', notes: '첫째\n둘째 <script> &', coverEmoji: '🗺️', createdAt: '2026-09-08T10:00:00.123+09:00' },
  { id: 'g2', name: '다른 그룹 노출 금지' }, { id: 'empty', name: '빈 그룹' },
], places: [
  { id: 'p1', groupId: 'g1', name: '+명소', naverUrl: 'https://naver.me/FdCxHEt4', naverPlaceId: '38314175', address: '전남 목포', phone: '010-0012-3456', category: '숙소', tags: ['a|b', '"태그"', '줄\n바꿈'], notes: '@메모\n다음', visited: true, lat: 34.9479375, lng: 126.3890683, addedAt: '2026-09-08T01:00:00.000Z' },
  { id: 'p2', groupId: 'g1', name: '두번째 장소', visited: false },
  { id: 'p3', groupId: 'g2', name: '다른 그룹 장소 노출 금지' },
] });
const now = new Date('2026-09-08T12:00:00.000Z');
const state = { ...fixture, revision: '"revision1"' };
const expected = fixture.places.filter(p => p.groupId === 'g1').map(p => ({
  '그룹명': '=SUM(1,2)', '그룹 아이콘': '🗺️', '지역': '목포|서울', '목적/테마': '가족 "여행"',
  '시작일': '2026-09-08', '종료일': '2026-09-10', '그룹 메모': '첫째\n둘째 <script> &',
  '장소명': p.name, '카테고리': p.category, '주소': p.address, '연락처': p.phone,
  '태그': p.tags.join(' '), '장소 메모': p.notes, '방문': p.visited ? '방문 완료' : '방문 전', '네이버지도 URL': p.naverUrl, '핀 색상': placeColor(p),
}));

test('JSON exports selected group as Korean flat rows with no internal fields', async () => {
  assert.deepEqual(EXPORT_COLUMNS, columns);
  const result = await buildExport(state, 'json', now, 'g1');
  const parsed = JSON.parse(result.body);
  assert.deepEqual(parsed, expected);
  assert.deepEqual(Object.keys(parsed[0]), columns);
  for (const key of ['id', 'groupId', 'naverPlaceId', 'lat', 'lng', 'createdAt', 'addedAt', 'revision', 'exportedAt', 'version']) assert.ok(!Object.hasOwn(parsed[0], key));
  assert.ok(!result.body.includes('다른 그룹'));
  assert.ok(!result.body.includes('빈 그룹'));
  assert.ok(!/[\r\n]/.test(result.filename));
});

test('Markdown contains one selected-group table and escapes Unicode multiline values', async () => {
  const { body } = await buildExport(state, 'md', now, 'g1');
  const tableLines = body.trim().split('\n').filter(line => line.startsWith('|'));
  assert.equal(tableLines.length, 4);
  assert.equal(tableLines[0], `| ${columns.join(' | ')} |`);
  for (const text of ['목포&#124;서울', '첫째<br>둘째 &lt;script&gt; &amp;', 'https://naver.me/FdCxHEt4', '방문 완료', '방문 전']) assert.ok(body.includes(text), text);
  assert.ok(!body.includes('다른 그룹'));
  assert.ok(!body.includes('38314175'));
});

async function readWorkbook(body) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(body);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['여행지']);
  const sheet = workbook.getWorksheet('여행지');
  assert.deepEqual(sheet.getRow(1).values.slice(1), columns);
  assert.equal(sheet.views[0].ySplit, 1);
  assert.ok(sheet.getTable('TripPlaces'));
  const rows = [];
  for (let index = 2; index <= sheet.rowCount; index++) {
    rows.push(Object.fromEntries(columns.map((key, column) => {
      const cell = sheet.getRow(index).getCell(column + 1);
      assert.equal(cell.formula, undefined);
      const value = cell.value;
      if (value && typeof value === 'object' && value.hyperlink) {
        assert.equal(value.text, value.hyperlink);
        return [key, value.text];
      }
      return [key, value ?? ''];
    })));
  }
  return rows;
}

test('Excel roundtrip has one table, full URLs, phone zeros and literal formula-like strings', async () => {
  assert.deepEqual(await readWorkbook((await buildExport(state, 'xlsx', now, 'g1')).body), expected);
});

test('ZIP contains three formats with matching selected-group rows', async () => {
  const zip = await JSZip.loadAsync((await buildExport(state, 'zip', now, 'g1')).body);
  assert.deepEqual(Object.keys(zip.files).map(name => name.split('.').at(-1)).sort(), ['json', 'md', 'xlsx']);
  assert.deepEqual(JSON.parse(await zip.file(/\.json$/)[0].async('string')), expected);
  assert.deepEqual(await readWorkbook(await zip.file(/\.xlsx$/)[0].async('nodebuffer')), expected);
  assert.equal(await zip.file(/\.md$/)[0].async('string'), (await buildExport(state, 'md', now, 'g1')).body);
});

test('empty group exports one row retaining group information with blank place fields', async () => {
  const rows = JSON.parse((await buildExport(state, 'json', now, 'empty')).body);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['그룹명'], '빈 그룹');
  assert.deepEqual(Object.keys(rows[0]), columns);
  for (const key of columns.slice(7)) assert.equal(rows[0][key], '');
  assert.deepEqual(await readWorkbook((await buildExport(state, 'xlsx', now, 'empty')).body), rows);
});

test('HTTP requires group selection, rejects invalid input and never caches failures', async () => {
  async function call(store, req) {
    const result = { headers: {} };
    await createExportHandler(store)(req, { setHeader(key, value) { result.headers[key] = value; }, status(code) { result.status = code; return this; }, send(body) { result.body = body; }, json(body) { result.body = body; } });
    return result;
  }
  const store = { read: async () => state };
  const result = await call(store, { method: 'GET', query: { format: 'json', groupId: 'g1' } });
  assert.equal(result.status, 200);
  assert.match(result.headers['Content-Disposition'], /^attachment;/);
  assert.deepEqual(JSON.parse(result.body), expected);
  for (const [req, status] of [
    [{ method: 'POST' }, 405],
    [{ method: 'GET', query: { format: '../bad', groupId: 'g1' } }, 400],
    [{ method: 'GET', query: { format: ['json'], groupId: 'g1' } }, 400],
    [{ method: 'GET', query: { format: 'json' } }, 400],
    [{ method: 'GET', query: { groupId: ['g1'] } }, 400],
    [{ method: 'GET', query: { groupId: 'missing' } }, 404],
  ]) {
    const response = await call(store, req);
    assert.equal(response.status, status);
    assert.equal(response.headers['Cache-Control'], 'no-store');
  }
  const failed = await call({ read: async () => { throw new Error('secret'); } }, { method: 'GET', query: { groupId: 'g1' } });
  assert.equal(failed.status, 503);
  assert.equal(failed.headers['Cache-Control'], 'no-store');
  assert.ok(!JSON.stringify(failed.body).includes('secret'));
  const zip = await call(store, { method: 'GET', query: { groupId: 'g1' } });
  assert.equal(zip.headers['Content-Type'], 'application/zip');
});
