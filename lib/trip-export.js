import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { validateData } from './trip-data.js';
import { placeColor } from '../public/js/place-colors.js';

export const EXPORT_COLUMNS = ['그룹명', '그룹 아이콘', '지역', '목적/테마', '시작일', '종료일', '그룹 메모', '장소명', '카테고리', '주소', '연락처', '태그', '장소 메모', '방문', '네이버지도 URL', '핀 색상'];
const mime = { json: 'application/json; charset=utf-8', md: 'text/markdown; charset=utf-8', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip: 'application/zip' };

function escapeMarkdown(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\\/g, '&#92;').replace(/\|/g, '&#124;').replace(/`/g, '&#96;')
    .replace(/\*/g, '&#42;').replace(/_/g, '&#95;').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;')
    .replace(/\r/g, '&#13;').replace(/\n/g, '<br>');
}
function markdownTable(fields, rows) {
  return [`| ${fields.join(' | ')} |`, `| ${fields.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${fields.map(key => escapeMarkdown(Array.isArray(row[key]) ? JSON.stringify(row[key]) : row[key])).join(' | ')} |`)].join('\n');
}
function reportRows(state, groupId) {
  if (typeof groupId !== 'string' || !groupId.trim()) {
    const error = new Error('내보낼 그룹을 선택해주세요.'); error.status = 400; throw error;
  }
  const data = validateData(state);
  const group = data.groups.find(g => g.id === groupId);
  if (!group) { const error = new Error('선택한 그룹이 삭제되었습니다. 다시 선택해주세요.'); error.status = 404; throw error; }
  const places = data.places.filter(p => p.groupId === groupId);
  return (places.length ? places : [null]).map(place => ({
    '그룹명': group.name, '그룹 아이콘': group.coverEmoji, '지역': group.region,
    '목적/테마': group.purpose, '시작일': group.startDate, '종료일': group.endDate, '그룹 메모': group.notes,
    '장소명': place?.name ?? '', '카테고리': place?.category ?? '', '주소': place?.address ?? '',
    '연락처': place?.phone ?? '', '태그': (place?.tags ?? []).join(' '), '장소 메모': place?.notes ?? '',
    '방문': place ? (place.visited ? '방문 완료' : '방문 전') : '', '네이버지도 URL': place?.naverUrl ?? '',
    '핀 색상': place ? placeColor(place) : '',
  }));
}

export async function buildExport(state, format = 'zip', now = new Date(), groupId) {
  if (!Object.hasOwn(mime, format)) throw new RangeError('Unsupported export format');
  const rows = reportRows(state, groupId);
  const base = `navermap-${now.toISOString().replace(/[:.]/g, '-')}`;
  const contents = {};
  if (format === 'json' || format === 'zip') contents.json = JSON.stringify(rows, null, 2);
  if (format === 'md' || format === 'zip') contents.md = `# 여행지\n\n${markdownTable(EXPORT_COLUMNS, rows)}\n`;
  if (format === 'xlsx' || format === 'zip') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('여행지', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.addTable({ name: 'TripPlaces', ref: 'A1', headerRow: true,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: EXPORT_COLUMNS.map(name => ({ name, filterButton: true })),
      rows: rows.map(row => EXPORT_COLUMNS.map(key => key === '네이버지도 URL' && row[key]
        ? { text: row[key], hyperlink: row[key] } : String(row[key] ?? ''))),
    });
    sheet.columns.forEach((column, index) => {
      column.width = ['그룹 메모', '장소 메모', '주소', '네이버지도 URL'].includes(EXPORT_COLUMNS[index]) ? 40 : 22;
      column.alignment = { vertical: 'top', wrapText: true };
      column.numFmt = '@';
    });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    contents.xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
  }
  if (format === 'zip') {
    const zip = new JSZip();
    for (const [extension, content] of Object.entries(contents)) zip.file(`${base}.${extension}`, content);
    contents.zip = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
  return { filename: `${base}.${format}`, contentType: mime[format], body: contents[format] };
}

export function createExportHandler(store) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ message: 'GET 요청만 지원합니다.' });
    }
    const format = req.query?.format ?? new URL(req.url || '/', 'https://localhost').searchParams.get('format') ?? 'zip';
    if (typeof format !== 'string' || !Object.hasOwn(mime, format)) return res.status(400).json({ message: '지원하지 않는 내보내기 형식입니다.' });
    const groupId = req.query?.groupId ?? new URL(req.url || '/', 'https://localhost').searchParams.get('groupId');
    if (typeof groupId !== 'string' || !groupId.trim()) return res.status(400).json({ message: '내보낼 그룹을 선택해주세요.' });
    try {
      const result = await buildExport(await store.read(), format, new Date(), groupId);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(200).send(result.body);
    } catch (error) {
      if ([400, 404].includes(error.status)) return res.status(error.status).json({ message: error.message });
      return res.status(503).json({ message: '내보내기에 실패했습니다. 잠시 후 다시 시도해주세요.' });
    }
  };
}
