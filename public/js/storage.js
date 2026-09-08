// public/js/storage.js
const GROUPS_KEY = 'ftm_groups';
const PLACES_KEY = 'ftm_places';

function uuid() {
  return crypto.randomUUID();
}

export const Storage = {
  // ── Groups ──────────────────────────────────────────────────
  getGroups() {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]');
  },

  saveGroups(groups) {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  },

  addGroup(data) {
    const groups = this.getGroups();
    const group = {
      id: uuid(),
      name: data.name || '새 여행',
      purpose: data.purpose || '',
      region: data.region || '',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      notes: data.notes || '',
      coverEmoji: data.coverEmoji || '🗺️',
      createdAt: new Date().toISOString(),
    };
    groups.push(group);
    this.saveGroups(groups);
    return group;
  },

  updateGroup(id, data) {
    const groups = this.getGroups();
    const idx = groups.findIndex(g => g.id === id);
    if (idx === -1) throw new Error(`Group ${id} not found`);
    groups[idx] = { ...groups[idx], ...data };
    this.saveGroups(groups);
    return groups[idx];
  },

  deleteGroup(id) {
    const groups = this.getGroups().filter(g => g.id !== id);
    this.saveGroups(groups);
    // 하위 장소도 삭제
    const places = this.getPlaces().filter(p => p.groupId !== id);
    this.savePlaces(places);
  },

  // ── Places ──────────────────────────────────────────────────
  getPlaces() {
    return JSON.parse(localStorage.getItem(PLACES_KEY) || '[]');
  },

  savePlaces(places) {
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
  },

  getPlacesByGroup(groupId) {
    return this.getPlaces().filter(p => p.groupId === groupId);
  },

  addPlace(data) {
    const places = this.getPlaces();
    const place = {
      id: uuid(),
      groupId: data.groupId,
      naverUrl: data.naverUrl || '',
      naverPlaceId: data.naverPlaceId || '',
      name: data.name || '장소명 없음',
      address: data.address || '',
      phone: data.phone || '',
      category: data.category || '기타',
      tags: data.tags || [],
      notes: data.notes || '',
      visited: false,
      lat: data.lat || null,
      lng: data.lng || null,
      addedAt: new Date().toISOString(),
    };
    places.push(place);
    this.savePlaces(places);
    return place;
  },

  updatePlace(id, data) {
    const places = this.getPlaces();
    const idx = places.findIndex(p => p.id === id);
    if (idx === -1) throw new Error(`Place ${id} not found`);
    places[idx] = { ...places[idx], ...data };
    this.savePlaces(places);
    return places[idx];
  },

  deletePlace(id) {
    const places = this.getPlaces().filter(p => p.id !== id);
    this.savePlaces(places);
  },

  // ── Import / Export ─────────────────────────────────────────
  exportData() {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      groups: this.getGroups(),
      places: this.getPlaces(),
    }, null, 2);
  },

  importData(jsonString, mode = 'merge') {
    const data = JSON.parse(jsonString);
    if (!data.groups || !data.places) throw new Error('올바른 백업 파일이 아닙니다.');

    if (mode === 'overwrite') {
      this.saveGroups(data.groups);
      this.savePlaces(data.places);
      return;
    }

    // merge: 기존 ID와 겹치지 않는 항목만 추가
    const existingGroupIds = new Set(this.getGroups().map(g => g.id));
    const existingPlaceIds = new Set(this.getPlaces().map(p => p.id));

    const newGroups = data.groups.filter(g => !existingGroupIds.has(g.id));
    const newPlaces = data.places.filter(p => !existingPlaceIds.has(p.id));

    this.saveGroups([...this.getGroups(), ...newGroups]);
    this.savePlaces([...this.getPlaces(), ...newPlaces]);
  },
};
