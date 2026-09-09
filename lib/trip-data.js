const MAX_ITEMS = 2000;
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
function fail() { throw new Error('올바른 여행 데이터가 아닙니다. 백업 파일의 형식을 확인해주세요.'); }
function text(value, max = 2000) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) fail();
  return value;
}
function id(value) {
  if (typeof value !== 'string' || !idPattern.test(value)) fail();
  return value;
}
function coordinate(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail();
  return value;
}
function date(value) {
  const result = text(value, 40);
  if (result && !/^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(result)) fail();
  return result;
}
function pinColor(value) {
  const result = text(value, 7);
  if (result && !/^#[0-9a-f]{6}$/i.test(result)) fail();
  return result;
}
function placeUrl(value) {
  const result = text(value, 4096);
  if (!result) return '';
  let url;
  try { url = new URL(result); } catch { fail(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !(url.hostname === 'naver.me' || url.hostname === 'naver.com' || url.hostname.endsWith('.naver.com'))) fail();
  return url.href;
}

export function validateData(data) {
  if (!data || !Array.isArray(data.groups) || !Array.isArray(data.places)
      || data.groups.length > MAX_ITEMS || data.places.length > MAX_ITEMS) fail();
  const groups = data.groups.map(group => {
    if (!group || !text(group.name, 200).trim()) fail();
    return {
      id: id(group.id), name: text(group.name, 200), purpose: text(group.purpose),
      region: text(group.region, 200), startDate: date(group.startDate), endDate: date(group.endDate),
      notes: text(group.notes, 10000), coverEmoji: text(group.coverEmoji, 40) || '🗺️',
      createdAt: date(group.createdAt),
    };
  });
  const groupIds = new Set(groups.map(g => g.id));
  if (groupIds.size !== groups.length) fail();
  const places = data.places.map(place => {
    if (!place || !text(place.name, 200).trim() || !groupIds.has(place.groupId)) fail();
    const tags = place.tags ?? [];
    if (!Array.isArray(tags) || tags.length > 50) fail();
    return {
      id: id(place.id), groupId: id(place.groupId), name: text(place.name, 200),
      naverUrl: placeUrl(place.naverUrl), naverPlaceId: text(place.naverPlaceId, 100),
      address: text(place.address), phone: text(place.phone, 100), category: text(place.category, 100) || '기타',
      pinColor: pinColor(place.pinColor),
      tags: tags.map(tag => text(tag, 100)), notes: text(place.notes, 10000),
      visited: place.visited === true, lat: coordinate(place.lat, -90, 90),
      lng: coordinate(place.lng, -180, 180), addedAt: date(place.addedAt),
    };
  });
  if (new Set(places.map(p => p.id)).size !== places.length) fail();
  const sourceRoutes = data.routes === undefined ? [] : data.routes;
  if (!Array.isArray(sourceRoutes) || sourceRoutes.length > MAX_ITEMS) fail();
  const placeIds = new Set(places.map(place => place.id));
  const routes = sourceRoutes.map(route => {
    if (!route || !text(route.name, 200).trim() || !Array.isArray(route.placeIds)
        || route.placeIds.length > MAX_ITEMS || new Set(route.placeIds).size !== route.placeIds.length) fail();
    return {
      id: id(route.id), name: text(route.name, 200), createdAt: date(route.createdAt),
      placeIds: route.placeIds.map(value => { if (!placeIds.has(id(value))) fail(); return value; }),
    };
  });
  if (new Set(routes.map(route => route.id)).size !== routes.length) fail();
  return { groups, places, routes };
}
