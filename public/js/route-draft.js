// A draft stays local until its name is confirmed and the server accepts it.
export class RouteDraft {
  constructor() { this.cancel(); }
  start() { this.cancel(); this.active = true; }
  edit(route, changes = route) {
    if (this.active && this.routeId !== route.id) throw new Error('작성 중인 Route를 먼저 저장하거나 취소해주세요.');
    if (!this.active) this.base = structuredClone(route);
    this.routeId = route.id;
    this.name = changes.name;
    this.ids = [...changes.placeIds];
    this.active = true;
  }
  reorder(ids) {
    if (ids.length !== this.ids.length || new Set(ids).size !== ids.length || ids.some(id => !this.ids.includes(id))) throw new Error('Route 장소 목록이 변경되었습니다.');
    this.ids = [...ids];
  }
  move(id, direction) {
    const index = this.ids.indexOf(id);
    const target = index + direction;
    if (![-1, 1].includes(direction) || index < 0 || target < 0 || target >= this.ids.length) return;
    [this.ids[index], this.ids[target]] = [this.ids[target], this.ids[index]];
  }
  add(id, places) {
    if (!places.some(place => place.id === id)) throw new Error('이 장소는 삭제되었습니다.');
    this.active = true;
    if (!this.ids.includes(id)) this.ids.push(id);
  }
  remove(id) { this.ids = this.ids.filter(value => value !== id); }
  reconcile(places) {
    const available = new Set(places.map(place => place.id));
    const previous = this.ids.length;
    this.ids = this.ids.filter(id => available.has(id));
    return previous !== this.ids.length;
  }
  cancel() { this.ids = []; this.active = false; this.routeId = null; this.name = ''; this.base = null; }
}
