// This public map endpoint is not a supported Open API contract. Keep the
// response adapter here and report upstream failures when Naver changes it.
const ALLOWED_HOSTS = new Set([
  'naver.me', 'me.naver.com', 'map.naver.com',
  'm.place.naver.com', 'pcmap.place.naver.com', 'place.naver.com',
]);
const HEADERS = { Accept: 'application/json, text/html', Referer: 'https://map.naver.com/' };

class PlaceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function validateUrl(value) {
  let url;
  try { url = new URL(value); } catch { /* handled below */ }
  if (!url || url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)
      || url.username || url.password || url.port) {
    throw new PlaceError(400, 'invalid_url', 'https://naver.me/ 또는 네이버지도 장소 링크를 입력해주세요.');
  }
  return url;
}

function placeIdFrom(url) {
  return url.pathname.match(/\/(?:place|restaurant|accommodation|hotel|cafe|hospital|beauty|attraction)\/(\d+)(?:\/|$)/)?.[1] || null;
}

async function resolvePlace(url, signal) {
  // Validate every redirect before fetching, including the destination host.
  for (let hop = 0; hop < 6; hop++) {
    const placeId = placeIdFrom(url);
    if (placeId && !['naver.me', 'me.naver.com'].includes(url.hostname)) {
      return { placeId, url: url.href };
    }
    const response = await fetch(url.href, { headers: HEADERS, redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) break;
      url = validateUrl(new URL(location, url).href);
      continue;
    }
    await response.body?.cancel();
    if (!response.ok) {
      throw new PlaceError(502, 'link_unavailable', '네이버 공유 링크를 열지 못했습니다. 링크를 확인하거나 잠시 후 다시 시도해주세요.');
    }
    break;
  }
  throw new PlaceError(422, 'place_id_not_found', '장소를 찾을 수 없는 링크입니다. 네이버지도에서 개별 장소의 공유 링크를 복사해주세요.');
}

const stringValue = value => typeof value === 'string' ? value.trim() : '';
function coordinate(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed', message: 'GET 요청만 지원합니다.' });
  }
  try {
    const input = req.query.url;
    if (typeof input !== 'string' || !input.trim() || input.length > 4096) {
      throw new PlaceError(400, 'invalid_url', '네이버지도 공유 링크를 입력해주세요.');
    }
    // Accept the name/address text that may be copied with a share URL.
    const link = input.match(/https:\/\/[^\s<>\[\]()]+/)?.[0] || input.trim();
    const signal = AbortSignal.timeout(12000);
    const { placeId, url } = await resolvePlace(validateUrl(link), signal);
    const response = await fetch(`https://map.naver.com/p/api/place/summary/${placeId}`, {
      headers: HEADERS, signal, redirect: 'error',
    });
    if (!response.ok) {
      console.warn('naver-place upstream failure', { status: response.status, placeId });
      throw new PlaceError(502, 'upstream_unavailable', '네이버에서 장소 정보를 제공하지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
    let data;
    try { data = await response.json(); } catch {
      throw new PlaceError(502, 'invalid_response', '네이버 장소 응답을 읽지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
    const place = data?.data?.placeDetail;
    const name = stringValue(place?.name);
    const lat = coordinate(place?.coordinate?.latitude, -90, 90);
    const lng = coordinate(place?.coordinate?.longitude, -180, 180);
    if (!place || String(place.id) !== placeId || !name || lat === null || lng === null) {
      throw new PlaceError(502, 'invalid_response', '네이버 응답에 장소명 또는 위치 정보가 없습니다. 다른 장소 링크를 확인하거나 직접 입력해주세요.');
    }
    return res.status(200).json({
      naverPlaceId: placeId,
      naverUrl: url,
      name,
      address: stringValue(place.address?.roadAddress) || stringValue(place.address?.address),
      phone: stringValue(place.phone) || stringValue(place.tel),
      category: mapNaverCategory(stringValue(place.category?.category)),
      lat, lng,
    });
  } catch (error) {
    if (error instanceof PlaceError) {
      return res.status(error.status).json({ error: error.code, message: error.message });
    }
    const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    console.warn('naver-place request failure', { type: error.name });
    return res.status(timeout ? 504 : 502).json({
      error: timeout ? 'upstream_timeout' : 'fetch_failed',
      message: timeout ? '네이버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'
        : '네이버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
}

function mapNaverCategory(raw) {
  if (/카페|커피|디저트|베이커리|빵|케이크/.test(raw)) return '카페/디저트';
  if (/음식|식당|맛집|레스토랑|분식|한식|중식|일식|양식/.test(raw)) return '맛집';
  if (/관광|명소|공원|박물관|미술관|사찰|궁/.test(raw)) return '관광지';
  if (/숙소|호텔|펜션|게스트하우스|리조트|모텔/.test(raw)) return '숙소';
  if (/체험|액티비티|스키|서핑|캠핑|놀이/.test(raw)) return '체험/액티비티';
  if (/쇼핑|마트|백화점|시장|아울렛/.test(raw)) return '쇼핑';
  return '기타';
}
