// Local keys are retained as a backup of the old, device-only app.
const GROUPS_KEY = 'ftm_groups';
const PLACES_KEY = 'ftm_places';
const MIGRATED_KEY = 'ftm_shared_migrated_v1';
let state = { groups: [], places: [], revision: null };
let ready = false;
let busy = false;
let loading = null;
let editing = false;

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
  return data;
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
  getPlaces() { return structuredClone(state.places); },
  getPlacesByGroup(groupId) { return this.getPlaces().filter(p => p.groupId === groupId); },
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
    });
  },
  addPlace(data) {
    return mutate(next => {
      if (!next.groups.some(g => g.id === data.groupId)) throw new Error('선택한 그룹이 삭제되었습니다.');
      const place = {
        id: crypto.randomUUID(), groupId: data.groupId, naverUrl: data.naverUrl || '',
        naverPlaceId: data.naverPlaceId || '', name: data.name || '장소명 없음', address: data.address || '',
        phone: data.phone || '', category: data.category || '기타', tags: data.tags || [], notes: data.notes || '',
        visited: false, lat: data.lat ?? null, lng: data.lng ?? null, addedAt: new Date().toISOString(),
      };
      next.places.push(place);
      return place;
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
    return mutate(next => { next.places = next.places.filter(p => p.id !== id); });
  },
  exportData() {
    if (!ready) throw new Error('공유 데이터를 먼저 불러와주세요.');
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), groups: state.groups, places: state.places }, null, 2);
  },
  importData(jsonString, mode = 'merge') {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data?.groups) || !Array.isArray(data?.places)) throw new Error('올바른 백업 파일이 아닙니다.');
    return mutate(next => {
      if (mode === 'overwrite') {
        next.groups = data.groups;
        next.places = data.places;
        return;
      }
      const groupIds = new Set(next.groups.map(g => g.id));
      const placeIds = new Set(next.places.map(p => p.id));
      next.groups.push(...data.groups.filter(g => !groupIds.has(g.id)));
      next.places.push(...data.places.filter(p => !placeIds.has(p.id)));
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
