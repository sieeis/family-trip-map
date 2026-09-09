export function placeLink(place, mobile = false) {
  let url;
  try { url = new URL(place.naverUrl); } catch { return ''; }
  if (url.protocol !== 'https:') return '';
  const allowed = ['naver.me', 'me.naver.com', 'map.naver.com', 'm.place.naver.com', 'pcmap.place.naver.com', 'place.naver.com'];
  if (!allowed.includes(url.hostname)) return '';
  const id = /^\d+$/.test(place.naverPlaceId || '') ? place.naverPlaceId : url.pathname.match(/\/(?:place|restaurant|accommodation|hotel|cafe|hospital|beauty|attraction)\/(\d+)(?:\/|$)/)?.[1];
  return mobile && id ? `https://m.place.naver.com/place/${id}/home` : url.href;
}
