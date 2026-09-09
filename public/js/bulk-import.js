const HOSTS = new Set(['naver.me', 'me.naver.com', 'map.naver.com', 'm.place.naver.com', 'pcmap.place.naver.com', 'place.naver.com']);
const placeId = url => String(url || '').match(/\/(?:place|restaurant|accommodation|hotel|cafe|hospital|beauty|attraction)\/(\d+)(?:[/?#]|$)/)?.[1];
export function placeKey(place) {
  const id = place.naverPlaceId || placeId(place.naverUrl);
  if (id) return `place:${id}`;
  try { const url = new URL(place.naverUrl); url.hash = ''; return `url:${url.href}`; } catch { return ''; }
}

export function parseBulkLinks(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('네이버지도 공유 링크를 입력해주세요.');
  if (lines.length > 50) throw new Error('한 번에 최대 50개까지 불러올 수 있습니다.');
  const seen = new Set();
  return lines.map(line => {
    const row = { url: line, status: 'pending', message: '', place: null };
    try {
      const url = new URL(line);
      if (line.length > 4096 || url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.username || url.password || url.port) throw new Error();
      url.hash = '';
      row.url = url.href;
      const key = placeKey({ naverUrl: row.url });
      if (seen.has(key)) { row.status = 'duplicate'; row.message = '입력한 목록의 중복 링크'; }
      seen.add(key);
    } catch { row.status = 'invalid'; row.message = '네이버지도 개별 장소 링크를 한 줄에 하나씩 입력해주세요.'; }
    return row;
  });
}

export async function resolveBulk(rows, { fetchPlace, existing = [], onUpdate = () => {}, signal }) {
  const pending = rows.filter(row => ['pending', 'failed'].includes(row.status));
  const existingKeys = new Set(existing.map(placeKey).filter(Boolean));
  let cursor = 0;
  const notify = () => { if (!signal?.aborted) onUpdate(rows); };
  async function worker() {
    while (cursor < pending.length && !signal?.aborted) {
      const row = pending[cursor++];
      if (existingKeys.has(placeKey({ naverUrl: row.url }))) {
        row.status = 'duplicate'; row.message = '이 그룹에 이미 등록된 장소'; notify(); continue;
      }
      row.status = 'loading'; row.message = ''; notify();
      try {
        const data = await fetchPlace(row.url, signal);
        if (signal?.aborted) return;
        if (!data || data.error) throw new Error(data?.message || '정보를 불러오지 못했습니다.');
        if (!data.name || !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) throw new Error('장소명 또는 위치 정보가 없습니다.');
        row.place = data; row.status = 'success';
      } catch (error) {
        if (signal?.aborted) return;
        row.status = 'failed'; row.message = error.message || '정보를 불러오지 못했습니다.';
      }
      notify();
    }
  }
  await Promise.all([worker(), worker()]);
  if (signal?.aborted) return;
  // Apply identity checks in input order, not network completion order.
  const seen = new Set(existingKeys);
  for (const row of rows) {
    if (row.status !== 'success') continue;
    const key = placeKey(row.place);
    if (key && seen.has(key)) { row.status = 'duplicate'; row.message = '이 그룹 또는 입력 목록에 같은 장소가 있습니다.'; }
    else if (key) seen.add(key);
  }
  notify();
  return rows;
}
