// A draft stays local until its name is confirmed and the server accepts it.
export class RouteDraft {
  constructor() { this.ids = []; this.active = false; }
  start() { this.ids = []; this.active = true; }
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
  cancel() { this.ids = []; this.active = false; }
}
