// api/naver-place.js
export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'url 파라미터가 필요합니다.' });
  }

  try {
    // Step 1: naver.me 단축 URL 해소
    let fullUrl = url;
    if (url.includes('naver.me') || url.includes('me.naver.com')) {
      const redirectRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FamilyTripMap/1.0)' },
      });
      fullUrl = redirectRes.url;
    }

    // Step 2: URL에서 place ID 추출
    const placeIdMatch = fullUrl.match(/\/entry\/place\/(\d+)|\/place\/(\d+)/);
    if (!placeIdMatch) {
      return res.status(422).json({
        error: 'place_id_not_found',
        message: '네이버지도 장소 링크를 확인해주세요. (map.naver.com/... 또는 naver.me/... 형식)',
      });
    }
    const placeId = placeIdMatch[1] || placeIdMatch[2];

    // Step 3: 네이버 내부 API 호출
    const apiUrl = `https://map.naver.com/v5/api/sites/summary/${placeId}?lang=ko`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://map.naver.com/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    });

    if (!apiRes.ok) {
      return res.status(404).json({
        error: 'place_not_found',
        message: '장소 정보를 가져오지 못했습니다. 직접 입력해주세요.',
      });
    }

    const data = await apiRes.json();

    // Step 4: 응답 파싱 (네이버 API 구조 대응)
    const p = data.result?.place || data.place || data;

    // 카테고리 매핑
    const rawCategory = (p.category?.[0] || p.categories?.[0] || p.categoryName || '');
    const category = mapNaverCategory(rawCategory);

    return res.status(200).json({
      naverPlaceId: placeId,
      naverUrl: fullUrl,
      name: p.name || p.placeName || '',
      address: p.roadAddress || p.address || p.jibunAddress || '',
      phone: p.phone || p.tel || '',
      category,
      lat: parseFloat(p.y || p.lat || 0) || null,
      lng: parseFloat(p.x || p.lng || 0) || null,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'fetch_failed',
      message: '서버 오류가 발생했습니다. 잠시 후 다시 시도하거나 직접 입력해주세요.',
    });
  }
}

function mapNaverCategory(raw) {
  if (!raw) return '기타';
  if (/음식|식당|맛집|레스토랑|분식|한식|중식|일식|양식/.test(raw)) return '맛집';
  if (/카페|커피|디저트|베이커리|빵|케이크/.test(raw)) return '카페/디저트';
  if (/관광|명소|공원|박물관|미술관|사찰|궁/.test(raw)) return '관광지';
  if (/숙소|호텔|펜션|게스트하우스|리조트|모텔/.test(raw)) return '숙소';
  if (/체험|액티비티|스키|서핑|캠핑|놀이/.test(raw)) return '체험/액티비티';
  if (/쇼핑|마트|백화점|시장|아울렛/.test(raw)) return '쇼핑';
  return '기타';
}
