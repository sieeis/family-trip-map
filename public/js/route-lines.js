// Keep consecutive legs only: missing/filtered locations must not invent a shortcut.
export function routeSegments(ids, places) {
  const byId = new Map(places.map(place => [place.id, place]));
  const located = place => place && Number.isFinite(place.lat) && Number.isFinite(place.lng);
  const segments = [];
  for (let index = 1; index < ids.length; index++) {
    const from = byId.get(ids[index - 1]);
    const to = byId.get(ids[index]);
    if (!located(from) || !located(to) || (from.lat === to.lat && from.lng === to.lng)) continue;
    segments.push({ from, to });
  }
  return segments;
}
