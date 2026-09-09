const normalize = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');

export function placeIdentity(place) {
  let url = '';
  let urlId = '';
  try {
    const parsed = new URL(place.naverUrl);
    if (/(^|\.)naver\.com$/.test(parsed.hostname) || parsed.hostname === 'naver.me') {
      urlId = parsed.pathname.match(/\/(?:place|restaurant|accommodation|hotel|cafe|hospital|beauty|attraction)\/(\d+)(?:\/|$)/)?.[1] || '';
      parsed.hash = '';
      if (['naver.me', 'me.naver.com'].includes(parsed.hostname)) parsed.search = '';
      url = parsed.href.replace(/\/$/, '');
    }
  } catch { /* Manual entries may have no URL. */ }
  const name = normalize(place.name);
  const address = normalize(place.address);
  return { id: String(place.naverPlaceId || urlId), url, address: name && address ? JSON.stringify([name, address]) : '' };
}

export function sameIdentity(a, b) {
  if (a.id && b.id) return a.id === b.id;
  return Boolean((a.url && a.url === b.url) || (a.address && a.address === b.address));
}

export function findDuplicate(place, places) {
  const identity = placeIdentity(place);
  return places.find(other => sameIdentity(identity, placeIdentity(other)));
}

export function duplicateError(place) {
  return new Error(`이미 등록된 동일한 장소입니다: ${place.name || '장소'}. 중복 등록을 취소했습니다.`);
}

// Preserve historical duplicates; reject only newly introduced duplicate pairs.
export function assertNoNewDuplicatePlaces(previous, next) {
  const before = new Map(previous.map(place => [place.id, placeIdentity(place)]));
  const identities = next.map(placeIdentity);
  for (let i = 0; i < next.length; i++) {
    if (JSON.stringify(before.get(next[i].id)) === JSON.stringify(identities[i])) continue;
    for (let j = 0; j < next.length; j++) {
      if (i === j || !sameIdentity(identities[i], identities[j])) continue;
      const oldA = before.get(next[i].id), oldB = before.get(next[j].id);
      if (!oldA || !oldB || !sameIdentity(oldA, oldB)) throw duplicateError(next[j]);
    }
  }
}
