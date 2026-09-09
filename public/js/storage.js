import { placeKey } from './bulk-import.js';
// Local keys are retained as a backup of the old, device-only app.
const GROUPS_KEY = 'ftm_groups';
const PLACES_KEY = 'ftm_places';
const MIGRATED_KEY = 'ftm_shared_migrated_v1';
let state = { groups: [], places: [], routes: [], revision: null };
let ready = false;
let busy = false;
let loading = null;
let editing = false;

// Reorder only the supplied slots so filtered-out rows retain their positions.
export function reorderRows(rows, ids) {
  const selected = new Set(ids);
  if (!Array.isArray(ids) || selected.size !== ids.length ||
      ids.some(id => !rows.some(row => row.id === id))) throw new Error('목록이 변경되었습니다. 새로고침 후 다시 이동해주세요.');
  const byId = new Map(rows.map(row => [row.id, row]));
  let index = 0;
  return rows.map(row => selected.has(row.id) ? byId.get(ids[index++]) : row);
}

function newPlace(data) {
  return {
        id: crypto.randomUUID(), groupId: data.groupId, naverUrl: data.naverUrl || '',
        naverPlaceId: data.naverPlaceId || '', name: data.name || '장소명 없음', address: data.address || '',
        phone: data.phone || '', category: data.category || '기타', tags: data.tags || [], notes: data.notes || '',
        pinColor: data.pinColor || '', visited: false, lat: data.lat ?? null, lng: data.lng ?? null, addedAt: new Date().toISOString(),
  };
}

async function api(options = {}) {
  let response;
  try {
    response = await fetch('/api/trips', { cache: 'no-store', signal: AbortSignal.timeout(20000), ...options });
  } catch {
    throw new Error('공유 저장소에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('공유 저장소 응답을 읽지 못했습니다. 다시 시도해주세요.'); }
  if (!response.ok) {
    const error = new Error(data.message || '공유 데이터 저장에 실패했습니다.');
    error.status = response.status;
    throw error;
  }
  if (!Array.isArray(data.groups) || !Array.isArray(data.places) || !('revision' in data)) {
    throw new Error('올바르지 않은 공유 데이터 응답입니다.');
  }
  if (data.routes !== undefined && !Array.isArray(data.routes)) throw new Error('올바르지 않은 Route 데이터 응답입니다.');
  return { ...data, routes: data.routes ?? [] };
}

function routeData(data, next) {
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 200
      || !Array.isArray(data.placeIds) || data.placeIds.length > 2000
      || new Set(data.placeIds).size !== data.placeIds.length
      || data.placeIds.some(id => !next.places.some(place => place.id === id))) {
    throw new Error('Route 이름과 장소 목록을 확인해주세요. 삭제된 장소는 추가할 수 없습니다.');
  }
  return { name: data.name.trim(), placeIds: [...data.placeIds] };
}

function pruneRoutes(next) {
  const ids = new Set(next.places.map(place => place.id));
  next.routes.forEach(route => { route.placeIds = route.placeIds.filter(id => ids.has(id)); });
}

async function mutate(update) {
  if (!editing) throw new Error('자물쇠를 눌러 편집 모드를 켜주세요.');
  if (!ready) throw new Error('공유 데이터를 먼저 불러와주세요. 상단 새로고침 버튼을 눌러주세요.');
  if (busy) throw new Error('다른 저장 작업을 처리 중입니다. 잠시 후 다시 시도해주세요.');
  busy = true;
  try {
    if (loading) await loading;
    const next = structuredClone(state);
    const result = update(next);
    if (!editing) throw new Error('편집 모드가 잠겨 있습니다.');
    state = await api({ method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Trip-Edit': '1' }, body: JSON.stringify(next) });
    return result;
  } catch (error) {
    if (error.status === 409) {
      state = await api();
      window.dispatchEvent(new Event('trips-updated'));
    }
    throw error;
  } finally { busy = false; }
}

export const Storage = {
  setEditing(value) { editing = value === true; },
  get isSaving() { return busy; },
  async refresh() {
    if (busy) return false;
    if (loading) return loading;
    loading = (async () => {
      const next = await api();
      const changed = !ready || next.revision !== state.revision;
      state = next;
      ready = true;
      return changed;
    })();
    try { return await loading; } finally { loading = null; }
  },
  getGroups() { return structuredClone(state.groups); },
  getRoutes() { return structuredClone(state.routes); },
  addRoute(data) {
    return mutate(next => {
      const fields = routeData(data, next);
      if (!fields.placeIds.length) throw new Error('Route에 장소를 하나 이상 추가해주세요.');
      if (next.routes.length >= 2000) throw new Error('Route는 최대 2,000개까지 저장할 수 있습니다.');
      const route = { id: crypto.randomUUID(), ...fields, createdAt: new Date().toISOString() };
      next.routes.push(route);
      return route;
    });
  },
  updateRoute(id, data, expected = null) {
    return mutate(next => {
      const route = next.routes.find(route => route.id === id);
        if (!route) throw new Error('이 Route는 다른 기기에서 삭제되었습니다.');
        if (expected && (route.name !== expected.name || JSON.stringify(route.placeIds) !== JSON.stringify(expected.placeIds))) {
          throw new Error('다른 기기에서 이 Route가 수정되었습니다. 현재 작업을 취소하고 최신 Route에서 다시 수정해주세요.');
        }
      Object.assign(route, routeData({ ...route, ...data }, next));
    });
  },
  deleteRoute(id) {
    return mutate(next => { next.routes = next.routes.filter(route => route.id !== id); });
  },
  reorderRoutes(ids) {
    return mutate(next => { next.routes = reorderRows(next.routes, ids); });
  },
  getPlaces() { return structuredClone(state.places); },
  getPlacesByGroup(groupId) { return this.getPlaces().filter(p => p.groupId === groupId); },
  reorderGroups(ids) {
    return mutate(next => { next.groups = reorderRows(next.groups, ids); });
  },
  reorderPlaces(groupId, ids) {
    return mutate(next => {
      const groupPlaces = next.places.filter(p => p.groupId === groupId);
      reorderRows(groupPlaces, ids); // Reject rows moved/deleted by another device.
      next.places = reorderRows(next.places, ids);
    });
  },
  addGroup(data) {
    return mutate(next => {
      const group = {
        id: crypto.randomUUID(), name: data.name || '새 여행', purpose: data.purpose || '',
        region: data.region || '', startDate: data.startDate || '', endDate: data.endDate || '',
        notes: data.notes || '', coverEmoji: data.coverEmoji || '🗺️', createdAt: new Date().toISOString(),
      };
      next.groups.push(group);
      return group;
    });
  },
  updateGroup(id, data) {
    return mutate(next => {
      const index = next.groups.findIndex(g => g.id === id);
      if (index === -1) throw new Error('이 그룹은 다른 기기에서 삭제되었습니다.');
      next.groups[index] = { ...next.groups[index], ...data, id };
    });
  },
  deleteGroup(id) {
    return mutate(next => {
      next.groups = next.groups.filter(g => g.id !== id);
      next.places = next.places.filter(p => p.groupId !== id);
      pruneRoutes(next);
    });
  },
  addPlace(data) {
    return mutate(next => {
      if (!next.groups.some(g => g.id === data.groupId)) throw new Error('선택한 그룹이 삭제되었습니다.');
      const place = newPlace(data);
      next.places.push(place);
      return place;
    });
  },
  addPlaces(groupId, records) {
    if (!Array.isArray(records) || !records.length || records.length > 50) throw new Error('1개부터 50개까지 추가할 수 있습니다.');
    return mutate(next => {
      if (!next.groups.some(g => g.id === groupId)) throw new Error('선택한 그룹이 삭제되었습니다.');
      const keys = new Set(next.places.filter(p => p.groupId === groupId).map(placeKey).filter(Boolean));
      const added = [];
      for (const record of records) {
        const key = placeKey(record);
        if (key && keys.has(key)) continue;
        const place = newPlace({ ...record, groupId });
        next.places.push(place); added.push(place);
        if (key) keys.add(key);
      }
      if (next.places.length > 2000) throw new Error('전체 장소는 최대 2,000개까지 저장할 수 있습니다.');
      return { added: added.length, skipped: records.length - added.length };
    });
  },
  updatePlace(id, data) {
    return mutate(next => {
      const index = next.places.findIndex(p => p.id === id);
      if (index === -1) throw new Error('이 장소는 다른 기기에서 삭제되었습니다.');
      next.places[index] = { ...next.places[index], ...data, id };
    });
  },
  deletePlace(id) {
    return mutate(next => { next.places = next.places.filter(p => p.id !== id); pruneRoutes(next); });
  },
  exportData() {
    if (!ready) throw new Error('공유 데이터를 먼저 불러와주세요.');
    return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), groups: state.groups, places: state.places, routes: state.routes }, null, 2);
  },
  importData(jsonString, mode = 'merge') {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data?.groups) || !Array.isArray(data?.places)) throw new Error('올바른 백업 파일이 아닙니다.');
    if (data.routes !== undefined && !Array.isArray(data.routes)) throw new Error('올바른 Route 백업 파일이 아닙니다.');
    const routes = data.routes ?? [];
    return mutate(next => {
      if (mode === 'overwrite') {
        next.groups = data.groups;
        next.places = data.places;
        next.routes = routes;
        return;
      }
      const groupIds = new Set(next.groups.map(g => g.id));
      const placeIds = new Set(next.places.map(p => p.id));
      next.groups.push(...data.groups.filter(g => !groupIds.has(g.id)));
      next.places.push(...data.places.filter(p => !placeIds.has(p.id)));
      const routeIds = new Set(next.routes.map(route => route.id));
      next.routes.push(...routes.filter(route => !routeIds.has(route.id)));
    });
  },
  hasLegacyData() {
    try {
      return !localStorage.getItem(MIGRATED_KEY) && JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]').length > 0;
    } catch { return false; }
  },
  async migrateLegacyData() {
    const groups = JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]');
    const places = JSON.parse(localStorage.getItem(PLACES_KEY) || '[]');
    await this.importData(JSON.stringify({ groups, places }), 'merge');
    localStorage.setItem(MIGRATED_KEY, 'true');
  },
};
