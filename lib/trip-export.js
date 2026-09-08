import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { validateData } from './trip-data.js';

export const GROUP_FIELDS = ['id', 'name', 'purpose', 'region', 'startDate', 'endDate', 'notes', 'coverEmoji', 'createdAt'];
export const PLACE_FIELDS = ['id', 'groupId', 'name', 'naverUrl', 'naverPlaceId', 'address', 'phone', 'category', 'tags', 'notes', 'visited', 'lat', 'lng', 'addedAt'];
const dateFields = new Set(['startDate', 'endDate', 'createdAt', 'addedAt']);
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
function addTable(workbook, name, fields, records) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  const values = records.map(record => fields.map(field => {
    const value = record[field];
    if (Array.isArray(value)) return JSON.stringify(value);
    if (dateFields.has(field) && value && Number.isFinite(Date.parse(value))) return new Date(value);
    if (field === 'naverUrl' && value) return { text: value, hyperlink: value };
    return value ?? null;
  }));
  sheet.addTable({ name, ref: 'A1', headerRow: true, style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: fields.map(name => ({ name, filterButton: true })), rows: values });
  sheet.columns.forEach((column, index) => {
    const field = fields[index];
    column.width = field === 'notes' || field === 'naverUrl' || field === 'address' ? 48 : 24;
    column.alignment = { vertical: 'top', wrapText: true };
    if (dateFields.has(field)) column.numFmt = field.endsWith('Date') ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm:ss.000';
    if (field === 'lat' || field === 'lng') column.numFmt = '0.0000000';
    // Explicit strings remain text, including formula-like names and phone numbers.
    if (!dateFields.has(field) && !['lat', 'lng', 'visited'].includes(field)) column.numFmt = '@';
  });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  return sheet;
}

export async function buildExport(state, format = 'zip', now = new Date()) {
  if (!Object.hasOwn(mime, format)) throw new RangeError('Unsupported export format');
  const data = { version: 1, exportedAt: now.toISOString(), revision: state.revision ?? null, ...validateData(state) };
  const base = `navermap-${data.exportedAt.replace(/[:.]/g, '-')}`;
  const metadata = [{ field: 'version', value: data.version }, { field: 'exportedAt', value: data.exportedAt },
    { field: 'revision', value: data.revision }, { field: 'groupCount', value: data.groups.length },
    { field: 'placeCount', value: data.places.length }, { field: 'dateTimezone', value: 'UTC' }];
  const contents = {};
  if (format === 'json' || format === 'zip') contents.json = JSON.stringify(data, null, 2);
  if (format === 'md' || format === 'zip') contents.md = `# 여행 지도\n\n${markdownTable(['field', 'value'], metadata)}\n\n## 그룹\n\n${markdownTable(GROUP_FIELDS, data.groups)}\n\n## 장소\n\n${markdownTable(PLACE_FIELDS, data.places)}\n`;
  if (format === 'xlsx' || format === 'zip') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '여행 지도';
    workbook.created = now;
    addTable(workbook, 'Groups', GROUP_FIELDS, data.groups);
    addTable(workbook, 'Places', PLACE_FIELDS, data.places);
    // Original date text is retained alongside native Excel dates to preserve offsets and precision.
    const rawDates = [...data.groups.flatMap(g => [...dateFields].filter(f => f in g).map(f => ({ field: `groups.${g.id}.${f}`, value: g[f] }))),
      ...data.places.map(p => ({ field: `places.${p.id}.addedAt`, value: p.addedAt }))];
    addTable(workbook, 'Metadata', ['field', 'value'], [...metadata, ...rawDates]);
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
    try {
      const result = await buildExport(await store.read(), format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(200).send(result.body);
    } catch {
      return res.status(503).json({ message: '내보내기에 실패했습니다. 잠시 후 다시 시도해주세요.' });
    }
  };
}
