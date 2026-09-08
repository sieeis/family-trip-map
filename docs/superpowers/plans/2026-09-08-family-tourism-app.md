# 가족 여행지 지도 웹앱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네이버지도 공유링크로 장소를 추가하고, 여행 그룹별로 관리하며 지도에 표시하는 가족 여행지 관리 웹앱 구축

**Architecture:** Vanilla HTML/CSS/JS (빌드 도구 없음, ES 모듈 사용), Vercel에 정적 파일 + 서버리스 함수로 배포. 데이터는 localStorage에 저장하고 JSON 파일로 가져오기/내보내기 지원.

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES Modules), Naver Maps JavaScript API, Vercel Serverless Functions (Node.js 18)

## Global Constraints

- 모든 서비스 무료 사용 (Vercel 무료 티어, GitHub 무료, Naver Maps 무료 티어)
- 외부 npm 패키지 없음 — api/ 함수도 Node.js 내장 fetch 사용 (Node 18+)
- ES 모듈 사용 (`type="module"`) — import/export 문법
- localStorage 키: `ftm_groups`, `ftm_places`
- UUID 생성: `crypto.randomUUID()`
- 고정 카테고리: `['맛집', '관광지', '숙소', '체험/액티비티', '카페/디저트', '쇼핑', '기타']`
- 포인트 컬러: `#03C75A` (네이버 그린)
- Naver Maps API 클라이언트 ID: `window.APP_CONFIG.naverMapClientId`

---

## 파일 구조

```
naver_map/
├── .gitignore
├── vercel.json
├── CLAUDE.md                    (기존)
├── PLAN.md                      → docs/superpowers/plans/ 링크
├── docs/
│   └── superpowers/
│       ├── plans/
│       │   └── 2026-09-08-family-tourism-app.md   (이 파일)
│       └── specs/
│           └── 2026-09-08-family-tourism-map-design.md
├── public/
│   ├── index.html               ← 앱 전체 HTML 구조
│   ├── js/
│   │   ├── config.js            ← window.APP_CONFIG (global, non-module)
│   │   ├── storage.js           ← localStorage CRUD + JSON import/export
│   │   ├── parser.js            ← /api/naver-place 호출
│   │   ├── map.js               ← Naver Maps 초기화, 마커 관리
│   │   ├── ui.js                ← DOM 렌더링, 모달, 토스트
│   │   └── app.js               ← 앱 상태, 모든 모듈 연결 (entry point)
│   └── css/
│       └── style.css            ← 전체 스타일 (반응형 포함)
└── api/
    └── naver-place.js           ← Vercel 서버리스 함수 (네이버 링크 파싱)
```

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `.gitignore`
- Create: `vercel.json`
- Create: `public/js/config.js`
- Create: `PLAN.md` (링크 파일)

**Interfaces:**
- Produces: `window.APP_CONFIG.naverMapClientId` — 모든 JS 모듈에서 사용

- [ ] **Step 1: .gitignore 생성**

```
node_modules/
.env
.vercel
.DS_Store
Thumbs.db
*.log
```

파일 경로: `G:\Claude Code\naver_map\.gitignore`

- [ ] **Step 2: vercel.json 생성**

Vercel이 `public/` 폴더를 루트로 서빙하도록 설정.

```json
{
  "version": 2,
  "outputDirectory": "public",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

파일 경로: `G:\Claude Code\naver_map\vercel.json`

- [ ] **Step 3: config.js 생성 (클라이언트 ID 플레이스홀더)**

```javascript
// public/js/config.js
// 네이버 클라우드 플랫폼(https://console.ncloud.com)에서 발급받은 Maps API 클라이언트 ID를 입력하세요.
window.APP_CONFIG = {
  naverMapClientId: 'YOUR_NCP_CLIENT_ID_HERE'
};
```

파일 경로: `G:\Claude Code\naver_map\public\js\config.js`

- [ ] **Step 4: PLAN.md 생성**

```markdown
# 구현 계획

상세 구현 계획은 아래 파일을 참조하세요:
`docs/superpowers/plans/2026-09-08-family-tourism-app.md`
```

파일 경로: `G:\Claude Code\naver_map\PLAN.md`

- [ ] **Step 5: Git 초기화 및 첫 커밋**

```bash
cd "G:/Claude Code/naver_map"
git init
git add .gitignore vercel.json public/js/config.js PLAN.md CLAUDE.md
git commit -m "chore: project scaffold — vercel config, gitignore, app config"
```

---

## Task 2: 데이터 레이어 (storage.js)

**Files:**
- Create: `public/js/storage.js`

**Interfaces:**
- Produces:
  - `Storage.getGroups()` → `TravelGroup[]`
  - `Storage.addGroup(data)` → `TravelGroup`
  - `Storage.updateGroup(id, data)` → `TravelGroup`
  - `Storage.deleteGroup(id)` → `void`
  - `Storage.getPlaces()` → `Place[]`
  - `Storage.getPlacesByGroup(groupId)` → `Place[]`
  - `Storage.addPlace(data)` → `Place`
  - `Storage.updatePlace(id, data)` → `Place`
  - `Storage.deletePlace(id)` → `void`
  - `Storage.exportData()` → `string` (JSON)
  - `Storage.importData(jsonString, mode)` → `void` (mode: `'merge'` | `'overwrite'`)

- [ ] **Step 1: storage.js 생성**

```javascript
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
```

- [ ] **Step 2: 브라우저 콘솔에서 수동 검증**

브라우저 개발자도구 콘솔에서:
```javascript
import { Storage } from '/js/storage.js';
const g = Storage.addGroup({ name: '테스트 여행', coverEmoji: '🏖️' });
console.assert(g.id, 'group has id');
const p = Storage.addPlace({ groupId: g.id, name: '테스트 장소' });
console.assert(p.groupId === g.id, 'place linked to group');
Storage.deleteGroup(g.id);
console.assert(Storage.getPlacesByGroup(g.id).length === 0, 'places deleted with group');
console.log('✅ Storage tests passed');
```

- [ ] **Step 3: 커밋**

```bash
git add public/js/storage.js
git commit -m "feat: localStorage data layer — Group and Place CRUD + JSON import/export"
```

---

## Task 3: Vercel 서버리스 함수 (Naver 링크 파싱)

**Files:**
- Create: `api/naver-place.js`

**Interfaces:**
- Produces: `GET /api/naver-place?url=<naverUrl>` → `{ name, address, phone, category, lat, lng, naverPlaceId, naverUrl }` or `{ error }`

- [ ] **Step 1: api 디렉토리 생성 및 함수 작성**

```javascript
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
```

- [ ] **Step 2: Vercel CLI로 로컬 테스트 (선택사항)**

Vercel CLI가 있으면:
```bash
npx vercel dev
# 브라우저에서: http://localhost:3000/api/naver-place?url=https://naver.me/테스트링크
```

없으면 배포 후 테스트.

- [ ] **Step 3: 커밋**

```bash
git add api/naver-place.js
git commit -m "feat: Vercel serverless proxy — resolve Naver Maps share links to place data"
```

---

## Task 4: Naver Maps 모듈 (map.js)

**Files:**
- Create: `public/js/map.js`

**Interfaces:**
- Consumes: `naver` (global from Naver Maps JS API)
- Produces:
  - `MapModule.init(containerId)` → `void`
  - `MapModule.showPlaces(places)` → `void`
  - `MapModule.clearMarkers()` → `void`
  - `MapModule.panToPlace(place)` → `void`

```javascript
// public/js/map.js
const CATEGORY_COLORS = {
  '맛집': '#FF5733',
  '관광지': '#3498DB',
  '숙소': '#9B59B6',
  '체험/액티비티': '#F39C12',
  '카페/디저트': '#E91E63',
  '쇼핑': '#2ECC71',
  '기타': '#95A5A6',
};

let _map = null;
let _markers = [];
let _infoWindow = null;
let _onMarkerClick = null;

export const MapModule = {
  init(containerId) {
    _map = new naver.maps.Map(containerId, {
      center: new naver.maps.LatLng(36.5, 127.5), // 한국 중심
      zoom: 7,
      mapTypeId: naver.maps.MapTypeId.NORMAL,
    });
    _infoWindow = new naver.maps.InfoWindow({ anchorSkew: true });
  },

  onMarkerClick(callback) {
    _onMarkerClick = callback;
  },

  showPlaces(places) {
    this.clearMarkers();
    const validPlaces = places.filter(p => p.lat && p.lng);
    validPlaces.forEach(place => this._addMarker(place));
    if (validPlaces.length > 0) this._fitBounds(validPlaces);
  },

  clearMarkers() {
    _markers.forEach(m => m.setMap(null));
    _markers = [];
    if (_infoWindow) _infoWindow.close();
  },

  panToPlace(place) {
    if (!place.lat || !place.lng) return;
    _map.panTo(new naver.maps.LatLng(place.lat, place.lng));
    _map.setZoom(15);
  },

  _addMarker(place) {
    const color = CATEGORY_COLORS[place.category] || CATEGORY_COLORS['기타'];
    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(place.lat, place.lng),
      map: _map,
      title: place.name,
      icon: {
        content: `<div style="
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          background:${color};border:2px solid #fff;
          box-shadow:0 2px 6px rgba(0,0,0,.3);
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
        "></div>`,
        anchor: new naver.maps.Point(16, 32),
      },
    });

    naver.maps.Event.addListener(marker, 'click', () => {
      const content = `
        <div style="padding:12px 16px;min-width:200px;font-family:sans-serif;">
          <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${place.name}</div>
          ${place.address ? `<div style="color:#666;font-size:12px;margin-bottom:4px;">${place.address}</div>` : ''}
          ${place.phone ? `<div style="color:#666;font-size:12px;margin-bottom:8px;">📞 ${place.phone}</div>` : ''}
          ${place.naverUrl ? `<a href="${place.naverUrl}" target="_blank" rel="noopener"
            style="display:inline-block;padding:6px 12px;background:#03C75A;color:#fff;
            border-radius:6px;font-size:12px;text-decoration:none;">네이버지도에서 열기</a>` : ''}
        </div>`;
      _infoWindow.setContent(content);
      _infoWindow.open(_map, marker);
      if (_onMarkerClick) _onMarkerClick(place);
    });

    _markers.push(marker);
  },

  _fitBounds(places) {
    if (places.length === 1) {
      this.panToPlace(places[0]);
      return;
    }
    const bounds = new naver.maps.LatLngBounds();
    places.forEach(p => bounds.extend(new naver.maps.LatLng(p.lat, p.lng)));
    _map.fitBounds(bounds, { padding: 60 });
  },
};
```

- [ ] **Step 1: map.js 파일 생성 (위 코드 그대로)**

파일 경로: `G:\Claude Code\naver_map\public\js\map.js`

- [ ] **Step 2: 커밋**

```bash
git add public/js/map.js
git commit -m "feat: Naver Maps module — markers with category colors, info window, bounds fitting"
```

---

## Task 5: HTML 구조 + 기본 CSS

**Files:**
- Create: `public/index.html`
- Create: `public/css/style.css`

**Interfaces:**
- Consumes: `window.APP_CONFIG.naverMapClientId`
- Produces: DOM 구조 — 모든 JS 모듈이 참조하는 ID들
  - `#map` — 지도 컨테이너
  - `#group-list` — 여행 그룹 목록
  - `#place-list` — 장소 목록
  - `#modal-overlay` — 모달 오버레이
  - `#modal-content` — 모달 내용
  - `#toast` — 알림 토스트
  - `#btn-add-group` — 그룹 추가 버튼
  - `#btn-add-place` — 장소 추가 버튼
  - `#btn-export` — 내보내기 버튼
  - `#btn-import-file` — 가져오기 파일 입력
  - `#mobile-tab-map`, `#mobile-tab-list`, `#mobile-tab-groups` — 모바일 탭

- [ ] **Step 1: index.html 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>가족 여행지 지도</title>
  <link rel="stylesheet" href="/css/style.css" />
  <!-- Pretendard 폰트 -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" />
</head>
<body>

  <!-- 헤더 -->
  <header class="app-header">
    <div class="header-left">
      <span class="app-logo">🗺️</span>
      <h1 class="app-title">가족 여행지 지도</h1>
    </div>
    <div class="header-right">
      <button id="btn-add-group" class="btn btn-primary">+ 그룹 추가</button>
      <button id="btn-export" class="btn btn-ghost">📤 내보내기</button>
      <label class="btn btn-ghost" style="cursor:pointer;">
        📥 가져오기
        <input type="file" id="btn-import-file" accept=".json" style="display:none;" />
      </label>
    </div>
  </header>

  <!-- 메인 레이아웃 -->
  <main class="app-layout">

    <!-- 좌측: 여행 그룹 목록 -->
    <aside class="panel panel-groups" id="panel-groups">
      <div class="panel-header">
        <span class="panel-title">여행 그룹</span>
      </div>
      <ul class="group-list" id="group-list">
        <!-- JS로 렌더링 -->
      </ul>
    </aside>

    <!-- 중앙: 장소 목록 -->
    <aside class="panel panel-places" id="panel-places">
      <div class="panel-header">
        <span class="panel-title" id="current-group-name">그룹을 선택하세요</span>
        <button id="btn-add-place" class="btn btn-sm btn-primary" style="display:none;">+ 장소</button>
      </div>
      <!-- 필터 -->
      <div class="filter-bar" id="filter-bar" style="display:none;">
        <select id="filter-category" class="filter-select">
          <option value="">전체 카테고리</option>
          <option>맛집</option>
          <option>관광지</option>
          <option>숙소</option>
          <option>체험/액티비티</option>
          <option>카페/디저트</option>
          <option>쇼핑</option>
          <option>기타</option>
        </select>
        <input type="text" id="filter-tag" class="filter-input" placeholder="태그 검색 (#바다)" />
      </div>
      <ul class="place-list" id="place-list">
        <!-- JS로 렌더링 -->
      </ul>
    </aside>

    <!-- 우측: 지도 -->
    <section class="map-container" id="map-container">
      <div id="map"></div>
    </section>

  </main>

  <!-- 모바일 하단 탭 -->
  <nav class="mobile-tab-bar">
    <button class="tab-btn active" id="mobile-tab-map" data-tab="map">🗺️ 지도</button>
    <button class="tab-btn" id="mobile-tab-list" data-tab="list">📍 목록</button>
    <button class="tab-btn" id="mobile-tab-groups" data-tab="groups">🗂️ 그룹</button>
  </nav>

  <!-- 모달 -->
  <div class="modal-overlay" id="modal-overlay" style="display:none;">
    <div class="modal-box" id="modal-content">
      <!-- JS로 동적 삽입 -->
    </div>
  </div>

  <!-- 토스트 알림 -->
  <div class="toast" id="toast"></div>

  <!-- config.js: APP_CONFIG 설정 (non-module, 먼저 로드) -->
  <script src="/js/config.js"></script>

  <!-- Naver Maps API 동적 로드 -->
  <script>
    window.naverMapInit = function () {
      import('/js/app.js').then(m => m.App.init());
    };
    const s = document.createElement('script');
    s.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId='
      + window.APP_CONFIG.naverMapClientId
      + '&callback=naverMapInit';
    document.head.appendChild(s);
  </script>

</body>
</html>
```

파일 경로: `G:\Claude Code\naver_map\public\index.html`

- [ ] **Step 2: style.css 생성**

```css
/* public/css/style.css */

/* ── CSS 변수 ──────────────────────────────────── */
:root {
  --color-primary: #03C75A;
  --color-primary-dark: #02a44c;
  --color-bg: #F5F5F5;
  --color-surface: #FFFFFF;
  --color-text: #1a1a1a;
  --color-text-secondary: #666;
  --color-border: #E5E5E5;
  --color-danger: #E53E3E;
  --shadow-sm: 0 1px 3px rgba(0,0,0,.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,.12);
  --radius: 8px;
  --header-h: 56px;
  --tab-h: 56px;
  --panel-groups-w: 220px;
  --panel-places-w: 280px;
}

/* ── 리셋 ──────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── 헤더 ──────────────────────────────────────── */
.app-header {
  height: var(--header-h);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
  z-index: 100;
}
.header-left { display: flex; align-items: center; gap: 8px; }
.app-logo { font-size: 22px; }
.app-title { font-size: 16px; font-weight: 700; white-space: nowrap; }
.header-right { display: flex; align-items: center; gap: 8px; }

/* ── 버튼 ──────────────────────────────────────── */
.btn {
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  font-weight: 600;
  transition: all .15s;
  white-space: nowrap;
}
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-primary:hover { background: var(--color-primary-dark); }
.btn-ghost { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
.btn-ghost:hover { background: var(--color-bg); }
.btn-danger { background: var(--color-danger); color: #fff; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px; border-radius: 4px; }
.btn-icon:hover { background: var(--color-bg); }

/* ── 레이아웃 (PC) ─────────────────────────────── */
.app-layout {
  flex: 1;
  display: grid;
  grid-template-columns: var(--panel-groups-w) var(--panel-places-w) 1fr;
  overflow: hidden;
}

/* ── 패널 ──────────────────────────────────────── */
.panel {
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.panel-title { font-size: 13px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: .5px; }

/* ── 그룹 목록 ─────────────────────────────────── */
.group-list { list-style: none; overflow-y: auto; flex: 1; padding: 8px; }
.group-item {
  padding: 10px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background .12s;
  position: relative;
}
.group-item:hover { background: var(--color-bg); }
.group-item.active { background: #e8f9f0; }
.group-emoji { font-size: 20px; flex-shrink: 0; }
.group-info { flex: 1; min-width: 0; }
.group-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.group-meta { font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; }
.group-actions { display: none; gap: 2px; }
.group-item:hover .group-actions { display: flex; }

/* ── 필터 바 ───────────────────────────────────── */
.filter-bar { padding: 8px 12px; display: flex; gap: 8px; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
.filter-select, .filter-input {
  flex: 1; padding: 6px 10px; border: 1px solid var(--color-border);
  border-radius: 6px; font-size: 12px; font-family: inherit; background: var(--color-bg); outline: none;
}
.filter-select:focus, .filter-input:focus { border-color: var(--color-primary); }

/* ── 장소 목록 ─────────────────────────────────── */
.place-list { list-style: none; overflow-y: auto; flex: 1; padding: 8px; }
.place-item {
  padding: 12px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background .12s;
  border: 1px solid transparent;
  margin-bottom: 4px;
}
.place-item:hover { background: var(--color-bg); border-color: var(--color-border); }
.place-item.visited { opacity: .6; }
.place-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.place-name { font-size: 14px; font-weight: 600; }
.place-actions { display: none; gap: 2px; flex-shrink: 0; }
.place-item:hover .place-actions { display: flex; }
.place-category {
  display: inline-block; font-size: 11px; padding: 2px 8px;
  border-radius: 20px; background: var(--color-bg); color: var(--color-text-secondary);
  margin-top: 4px; font-weight: 600;
}
.place-address { font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; }
.place-tags { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
.place-tag { font-size: 11px; color: var(--color-primary); background: #e8f9f0; padding: 2px 8px; border-radius: 20px; }
.place-visited-badge { font-size: 11px; color: #999; }

/* ── 지도 ──────────────────────────────────────── */
.map-container { position: relative; }
#map { width: 100%; height: 100%; }

/* ── 모달 ──────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.5); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 16px;
}
.modal-box {
  background: var(--color-surface);
  border-radius: 16px;
  width: 100%; max-width: 480px;
  max-height: 90dvh;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
}
.modal-header {
  padding: 20px 24px 0;
  display: flex; justify-content: space-between; align-items: center;
}
.modal-title { font-size: 18px; font-weight: 700; }
.modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-secondary); }
.modal-body { padding: 20px 24px; }
.modal-footer { padding: 0 24px 20px; display: flex; gap: 8px; justify-content: flex-end; }

/* ── 폼 ────────────────────────────────────────── */
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--color-text-secondary); }
.form-input, .form-select, .form-textarea {
  width: 100%; padding: 10px 12px;
  border: 1px solid var(--color-border); border-radius: var(--radius);
  font-size: 14px; font-family: inherit; outline: none;
  transition: border-color .15s;
}
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--color-primary); }
.form-textarea { resize: vertical; min-height: 80px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-hint { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; }
.parse-status { font-size: 12px; margin-top: 6px; padding: 6px 10px; border-radius: 6px; }
.parse-status.loading { background: #FFF3CD; color: #856404; }
.parse-status.success { background: #D4EDDA; color: #155724; }
.parse-status.error { background: #F8D7DA; color: #721C24; }

/* ── 토스트 ────────────────────────────────────── */
.toast {
  position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
  background: #333; color: #fff;
  padding: 10px 20px; border-radius: 20px;
  font-size: 14px; z-index: 2000;
  opacity: 0; pointer-events: none;
  transition: opacity .2s;
}
.toast.show { opacity: 1; }

/* ── 빈 상태 ───────────────────────────────────── */
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 40px 20px; color: var(--color-text-secondary);
  text-align: center; height: 100%;
}
.empty-state-icon { font-size: 40px; margin-bottom: 12px; }
.empty-state-text { font-size: 14px; line-height: 1.6; }

/* ── 모바일 하단 탭 ────────────────────────────── */
.mobile-tab-bar {
  display: none;
  height: var(--tab-h);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}
.tab-btn {
  flex: 1; background: none; border: none; cursor: pointer;
  font-family: inherit; font-size: 12px; color: var(--color-text-secondary);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  padding: 8px 0; transition: color .15s;
}
.tab-btn.active { color: var(--color-primary); font-weight: 700; }

/* ── 반응형 (모바일) ───────────────────────────── */
@media (max-width: 1023px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    position: relative;
  }
  .panel-groups, .panel-places { display: none; position: absolute; inset: 0; z-index: 10; }
  .map-container { grid-row: 1; grid-column: 1; display: block; }
  .mobile-tab-bar { display: flex; }
  .app-header .header-right .btn { display: none; }
  .app-layout[data-tab="groups"] .panel-groups { display: flex; }
  .app-layout[data-tab="list"] .panel-places { display: flex; }
  .app-layout[data-tab="map"] .map-container { display: block; }
  .toast { bottom: calc(var(--tab-h) + 12px); }
}

/* ── 반응형 (태블릿) ───────────────────────────── */
@media (min-width: 640px) and (max-width: 1023px) {
  .app-header .header-right .btn { display: inline-flex; }
}

/* ── 스크롤바 스타일 ───────────────────────────── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }
```

파일 경로: `G:\Claude Code\naver_map\public\css\style.css`

- [ ] **Step 3: 커밋**

```bash
git add public/index.html public/css/style.css
git commit -m "feat: HTML structure and responsive CSS design system"
```

---

## Task 6: UI 모듈 (ui.js)

**Files:**
- Create: `public/js/ui.js`

**Interfaces:**
- Consumes: DOM IDs from index.html
- Produces:
  - `UI.renderGroups(groups, currentGroupId)` → `void`
  - `UI.renderPlaces(places)` → `void`
  - `UI.showGroupModal(group?, onSave)` → `void`
  - `UI.showPlaceModal(groupId, place?, onSave)` → `void`
  - `UI.showConfirm(message)` → `Promise<boolean>`
  - `UI.showToast(message, type?)` → `void`
  - `UI.closeModal()` → `void`
  - `UI.setCurrentGroupName(name)` → `void`

- [ ] **Step 1: ui.js 생성**

```javascript
// public/js/ui.js
import { Parser } from './parser.js';

const CATEGORIES = ['맛집', '관광지', '숙소', '체험/액티비티', '카페/디저트', '쇼핑', '기타'];
const CATEGORY_EMOJIS = {
  '맛집': '🍜', '관광지': '📍', '숙소': '🏨',
  '체험/액티비티': '🎯', '카페/디저트': '☕', '쇼핑': '🛍️', '기타': '📌',
};

export const UI = {
  // ── 그룹 렌더링 ─────────────────────────────────
  renderGroups(groups, currentGroupId, callbacks) {
    const list = document.getElementById('group-list');
    if (groups.length === 0) {
      list.innerHTML = `<li class="empty-state" style="height:auto;padding:24px 12px;">
        <div class="empty-state-icon">🗺️</div>
        <div class="empty-state-text">여행 그룹을 추가해보세요</div>
      </li>`;
      return;
    }
    list.innerHTML = groups.map(g => `
      <li class="group-item ${g.id === currentGroupId ? 'active' : ''}" data-id="${g.id}">
        <span class="group-emoji">${g.coverEmoji || '🗺️'}</span>
        <div class="group-info">
          <div class="group-name">${esc(g.name)}</div>
          <div class="group-meta">${esc(g.region || '')} ${g.startDate ? g.startDate.slice(0, 7) : ''}</div>
        </div>
        <div class="group-actions">
          <button class="btn-icon" data-action="edit-group" data-id="${g.id}" title="수정">✏️</button>
          <button class="btn-icon" data-action="delete-group" data-id="${g.id}" title="삭제">🗑️</button>
        </div>
      </li>
    `).join('');

    list.querySelectorAll('.group-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        callbacks.onSelect(el.dataset.id);
      });
    });
    list.querySelectorAll('[data-action="edit-group"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onEdit(el.dataset.id); }));
    list.querySelectorAll('[data-action="delete-group"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onDelete(el.dataset.id); }));
  },

  setCurrentGroupName(name) {
    document.getElementById('current-group-name').textContent = name || '그룹을 선택하세요';
    const btn = document.getElementById('btn-add-place');
    const filter = document.getElementById('filter-bar');
    if (name) {
      btn.style.display = 'inline-block';
      filter.style.display = 'flex';
    } else {
      btn.style.display = 'none';
      filter.style.display = 'none';
    }
  },

  // ── 장소 렌더링 ─────────────────────────────────
  renderPlaces(places, callbacks) {
    const list = document.getElementById('place-list');
    if (places.length === 0) {
      list.innerHTML = `<li class="empty-state">
        <div class="empty-state-icon">📍</div>
        <div class="empty-state-text">+ 장소 버튼으로<br>장소를 추가해보세요</div>
      </li>`;
      return;
    }
    list.innerHTML = places.map(p => `
      <li class="place-item ${p.visited ? 'visited' : ''}" data-id="${p.id}">
        <div class="place-header">
          <span class="place-name">${CATEGORY_EMOJIS[p.category] || '📌'} ${esc(p.name)}</span>
          <div class="place-actions">
            <button class="btn-icon" data-action="edit-place" data-id="${p.id}" title="수정">✏️</button>
            <button class="btn-icon" data-action="delete-place" data-id="${p.id}" title="삭제">🗑️</button>
          </div>
        </div>
        <span class="place-category">${esc(p.category)}</span>
        ${p.address ? `<div class="place-address">${esc(p.address)}</div>` : ''}
        ${p.tags?.length ? `<div class="place-tags">${p.tags.map(t => `<span class="place-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${p.visited ? '<div class="place-visited-badge">✅ 방문완료</div>' : ''}
      </li>
    `).join('');

    list.querySelectorAll('.place-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        callbacks.onSelect(el.dataset.id);
      });
    });
    list.querySelectorAll('[data-action="edit-place"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onEdit(el.dataset.id); }));
    list.querySelectorAll('[data-action="delete-place"]').forEach(el =>
      el.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onDelete(el.dataset.id); }));
  },

  // ── 그룹 모달 ───────────────────────────────────
  showGroupModal(group, onSave) {
    const isEdit = !!group;
    const emojis = ['🗺️','🏯','🌊','🌸','🏔️','🌴','🏙️','🎡','🍁','❄️','☀️','🌿'];
    this._openModal(`
      <div class="modal-header">
        <span class="modal-title">${isEdit ? '그룹 수정' : '새 여행 그룹'}</span>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">이모지</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${emojis.map(e => `<button type="button" class="emoji-btn" data-emoji="${e}" style="
              font-size:24px;width:40px;height:40px;border-radius:8px;border:2px solid transparent;
              cursor:pointer;background:var(--color-bg);
              ${(group?.coverEmoji || '🗺️') === e ? 'border-color:var(--color-primary);' : ''}
            ">${e}</button>`).join('')}
          </div>
          <input type="hidden" id="gf-emoji" value="${group?.coverEmoji || '🗺️'}" />
        </div>
        <div class="form-group">
          <label class="form-label">여행 이름 *</label>
          <input class="form-input" id="gf-name" value="${esc(group?.name || '')}" placeholder="예: 2026 가을 경주 여행" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">목적/테마</label>
            <input class="form-input" id="gf-purpose" value="${esc(group?.purpose || '')}" placeholder="관광, 스키, 맛집투어..." />
          </div>
          <div class="form-group">
            <label class="form-label">지역</label>
            <input class="form-input" id="gf-region" value="${esc(group?.region || '')}" placeholder="경상북도 경주" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">시작일</label>
            <input class="form-input" type="date" id="gf-start" value="${group?.startDate || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">종료일</label>
            <input class="form-input" type="date" id="gf-end" value="${group?.endDate || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">메모</label>
          <textarea class="form-textarea" id="gf-notes" placeholder="특이사항, 준비물 등">${esc(group?.notes || '')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-btn">취소</button>
        <button class="btn btn-primary" id="modal-save-btn">${isEdit ? '수정 완료' : '그룹 만들기'}</button>
      </div>
    `);

    // 이모지 선택
    document.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emoji-btn').forEach(b => b.style.borderColor = 'transparent');
        btn.style.borderColor = 'var(--color-primary)';
        document.getElementById('gf-emoji').value = btn.dataset.emoji;
      });
    });

    document.getElementById('modal-save-btn').addEventListener('click', () => {
      const name = document.getElementById('gf-name').value.trim();
      if (!name) { this.showToast('여행 이름을 입력해주세요.', 'error'); return; }
      onSave({
        name,
        coverEmoji: document.getElementById('gf-emoji').value,
        purpose: document.getElementById('gf-purpose').value.trim(),
        region: document.getElementById('gf-region').value.trim(),
        startDate: document.getElementById('gf-start').value,
        endDate: document.getElementById('gf-end').value,
        notes: document.getElementById('gf-notes').value.trim(),
      });
      this.closeModal();
    });
  },

  // ── 장소 모달 ───────────────────────────────────
  showPlaceModal(groupId, place, onSave) {
    const isEdit = !!place;
    this._openModal(`
      <div class="modal-header">
        <span class="modal-title">${isEdit ? '장소 수정' : '장소 추가'}</span>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">
        ${!isEdit ? `
        <div class="form-group">
          <label class="form-label">네이버지도 공유 링크</label>
          <div style="display:flex;gap:8px;">
            <input class="form-input" id="pf-url" value="${esc(place?.naverUrl || '')}" placeholder="https://naver.me/... 또는 https://map.naver.com/..." />
            <button class="btn btn-primary" id="btn-parse" style="flex-shrink:0;">불러오기</button>
          </div>
          <div id="parse-status" class="parse-status" style="display:none;"></div>
          <div class="form-hint">링크를 붙여넣고 "불러오기"를 누르면 정보가 자동으로 채워집니다.</div>
        </div>
        <hr style="border:none;border-top:1px solid var(--color-border);margin:16px 0;" />
        ` : ''}
        <div class="form-group">
          <label class="form-label">장소명 *</label>
          <input class="form-input" id="pf-name" value="${esc(place?.name || '')}" placeholder="장소 이름" />
        </div>
        <div class="form-group">
          <label class="form-label">주소</label>
          <input class="form-input" id="pf-address" value="${esc(place?.address || '')}" placeholder="주소" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">연락처</label>
            <input class="form-input" id="pf-phone" value="${esc(place?.phone || '')}" placeholder="전화번호" />
          </div>
          <div class="form-group">
            <label class="form-label">카테고리</label>
            <select class="form-select" id="pf-category">
              ${CATEGORIES.map(c => `<option ${(place?.category || '기타') === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">태그</label>
          <input class="form-input" id="pf-tags" value="${(place?.tags || []).join(' ')}" placeholder="#바다 #아이랑 #역사" />
          <div class="form-hint">띄어쓰기로 구분, # 자동 추가</div>
        </div>
        <div class="form-group">
          <label class="form-label">메모</label>
          <textarea class="form-textarea" id="pf-notes" placeholder="방문 팁, 주의사항 등">${esc(place?.notes || '')}</textarea>
        </div>
        ${isEdit ? `
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="pf-visited" ${place?.visited ? 'checked' : ''} />
            <span class="form-label" style="margin:0;">방문 완료</span>
          </label>
        </div>
        ` : ''}
        <input type="hidden" id="pf-naverurl" value="${esc(place?.naverUrl || '')}" />
        <input type="hidden" id="pf-placeid" value="${esc(place?.naverPlaceId || '')}" />
        <input type="hidden" id="pf-lat" value="${place?.lat || ''}" />
        <input type="hidden" id="pf-lng" value="${place?.lng || ''}" />
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-btn">취소</button>
        <button class="btn btn-primary" id="modal-save-btn">${isEdit ? '수정 완료' : '장소 저장'}</button>
      </div>
    `);

    // 링크 파싱 버튼
    const parseBtn = document.getElementById('btn-parse');
    if (parseBtn) {
      parseBtn.addEventListener('click', async () => {
        const url = document.getElementById('pf-url').value.trim();
        if (!url) { this.showToast('링크를 입력해주세요.'); return; }
        const status = document.getElementById('parse-status');
        status.style.display = 'block';
        status.className = 'parse-status loading';
        status.textContent = '⏳ 장소 정보를 가져오는 중...';
        parseBtn.disabled = true;

        const data = await Parser.fetchPlaceData(url);
        parseBtn.disabled = false;

        if (data) {
          document.getElementById('pf-name').value = data.name || '';
          document.getElementById('pf-address').value = data.address || '';
          document.getElementById('pf-phone').value = data.phone || '';
          document.getElementById('pf-category').value = data.category || '기타';
          document.getElementById('pf-naverurl').value = data.naverUrl || url;
          document.getElementById('pf-placeid').value = data.naverPlaceId || '';
          document.getElementById('pf-lat').value = data.lat || '';
          document.getElementById('pf-lng').value = data.lng || '';
          status.className = 'parse-status success';
          status.textContent = '✅ 정보를 성공적으로 가져왔습니다. 확인 후 저장하세요.';
        } else {
          document.getElementById('pf-naverurl').value = url;
          status.className = 'parse-status error';
          status.textContent = '⚠️ 정보를 가져오지 못했습니다. 직접 입력해주세요.';
        }
      });
    }

    document.getElementById('modal-save-btn').addEventListener('click', () => {
      const name = document.getElementById('pf-name').value.trim();
      if (!name) { this.showToast('장소명을 입력해주세요.', 'error'); return; }

      const tagsRaw = document.getElementById('pf-tags').value.trim();
      const tags = tagsRaw.split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t);

      onSave({
        groupId,
        naverUrl: document.getElementById('pf-naverurl').value,
        naverPlaceId: document.getElementById('pf-placeid').value,
        name,
        address: document.getElementById('pf-address').value.trim(),
        phone: document.getElementById('pf-phone').value.trim(),
        category: document.getElementById('pf-category').value,
        tags,
        notes: document.getElementById('pf-notes').value.trim(),
        lat: parseFloat(document.getElementById('pf-lat').value) || null,
        lng: parseFloat(document.getElementById('pf-lng').value) || null,
        visited: document.getElementById('pf-visited')?.checked || false,
      });
      this.closeModal();
    });
  },

  // ── 확인 다이얼로그 ────────────────────────────
  showConfirm(message) {
    return new Promise(resolve => {
      this._openModal(`
        <div class="modal-body" style="padding:24px;">
          <p style="font-size:15px;line-height:1.6;">${esc(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="confirm-no">취소</button>
          <button class="btn btn-danger" id="confirm-yes">삭제</button>
        </div>
      `);
      document.getElementById('confirm-yes').addEventListener('click', () => { this.closeModal(); resolve(true); });
      document.getElementById('confirm-no').addEventListener('click', () => { this.closeModal(); resolve(false); });
    });
  },

  // ── 토스트 ──────────────────────────────────────
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#E53E3E' : '#333';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  },

  // ── 모달 헬퍼 ──────────────────────────────────
  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  },

  _openModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) this.closeModal();
    }, { once: true });
  },
};

// XSS 방지용 이스케이프
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

파일 경로: `G:\Claude Code\naver_map\public\js\ui.js`

- [ ] **Step 2: parser.js 생성**

```javascript
// public/js/parser.js
export const Parser = {
  async fetchPlaceData(url) {
    try {
      const encoded = encodeURIComponent(url);
      const res = await fetch(`/api/naver-place?url=${encoded}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error) return null;
      return data;
    } catch {
      return null;
    }
  },
};
```

파일 경로: `G:\Claude Code\naver_map\public\js\parser.js`

- [ ] **Step 3: 커밋**

```bash
git add public/js/ui.js public/js/parser.js
git commit -m "feat: UI module — group/place modals, list rendering, toast, and Naver link parser client"
```

---

## Task 7: 앱 진입점 및 전체 연결 (app.js)

**Files:**
- Create: `public/js/app.js`

**Interfaces:**
- Consumes: `Storage`, `MapModule`, `UI` — 모든 모듈 연결
- Produces: `App.init()` (window.naverMapInit 콜백에서 호출)

- [ ] **Step 1: app.js 생성**

```javascript
// public/js/app.js
import { Storage } from './storage.js';
import { MapModule } from './map.js';
import { UI } from './ui.js';

const state = {
  currentGroupId: null,
  filterCategory: '',
  filterTag: '',
};

export const App = {
  init() {
    MapModule.init('map');
    MapModule.onMarkerClick((place) => {
      // 지도 마커 클릭 시 장소 목록에서 해당 아이템 하이라이트
      document.querySelectorAll('.place-item').forEach(el =>
        el.classList.toggle('active', el.dataset.id === place.id));
    });

    this._bindHeader();
    this._bindMobileTabs();
    this._bindFilters();

    // 저장된 그룹이 있으면 첫 번째 선택
    const groups = Storage.getGroups();
    this.renderGroups();
    if (groups.length > 0) this.selectGroup(groups[0].id);
  },

  // ── 그룹 ────────────────────────────────────────
  renderGroups() {
    const groups = Storage.getGroups();
    UI.renderGroups(groups, state.currentGroupId, {
      onSelect: (id) => this.selectGroup(id),
      onEdit: (id) => {
        const group = Storage.getGroups().find(g => g.id === id);
        UI.showGroupModal(group, (data) => {
          Storage.updateGroup(id, data);
          this.renderGroups();
          if (id === state.currentGroupId) UI.setCurrentGroupName(data.name);
          UI.showToast('그룹이 수정되었습니다.');
        });
      },
      onDelete: async (id) => {
        const group = Storage.getGroups().find(g => g.id === id);
        const ok = await UI.showConfirm(`"${group?.name}" 그룹과 모든 장소를 삭제할까요?`);
        if (!ok) return;
        Storage.deleteGroup(id);
        if (state.currentGroupId === id) {
          state.currentGroupId = null;
          UI.setCurrentGroupName('');
          UI.renderPlaces([], {});
          MapModule.clearMarkers();
        }
        this.renderGroups();
        UI.showToast('그룹이 삭제되었습니다.');
      },
    });
  },

  selectGroup(id) {
    state.currentGroupId = id;
    state.filterCategory = '';
    state.filterTag = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-tag').value = '';

    const group = Storage.getGroups().find(g => g.id === id);
    UI.setCurrentGroupName(group?.name || '');
    this.renderGroups(); // active 상태 업데이트
    this.renderPlaces();
  },

  // ── 장소 ────────────────────────────────────────
  renderPlaces() {
    if (!state.currentGroupId) return;
    let places = Storage.getPlacesByGroup(state.currentGroupId);

    if (state.filterCategory) {
      places = places.filter(p => p.category === state.filterCategory);
    }
    if (state.filterTag) {
      const tag = state.filterTag.toLowerCase();
      places = places.filter(p =>
        p.tags?.some(t => t.toLowerCase().includes(tag)) ||
        p.name.toLowerCase().includes(tag)
      );
    }

    UI.renderPlaces(places, {
      onSelect: (id) => {
        const place = Storage.getPlaces().find(p => p.id === id);
        if (place) MapModule.panToPlace(place);
      },
      onEdit: (id) => {
        const place = Storage.getPlaces().find(p => p.id === id);
        UI.showPlaceModal(state.currentGroupId, place, (data) => {
          Storage.updatePlace(id, data);
          this.renderPlaces();
          const places = Storage.getPlacesByGroup(state.currentGroupId);
          MapModule.showPlaces(places);
          UI.showToast('장소가 수정되었습니다.');
        });
      },
      onDelete: async (id) => {
        const place = Storage.getPlaces().find(p => p.id === id);
        const ok = await UI.showConfirm(`"${place?.name}" 장소를 삭제할까요?`);
        if (!ok) return;
        Storage.deletePlace(id);
        this.renderPlaces();
        const places = Storage.getPlacesByGroup(state.currentGroupId);
        MapModule.showPlaces(places);
        UI.showToast('장소가 삭제되었습니다.');
      },
    });

    // 지도 마커 업데이트
    const allPlaces = Storage.getPlacesByGroup(state.currentGroupId);
    MapModule.showPlaces(allPlaces);
  },

  // ── 헤더 버튼 ───────────────────────────────────
  _bindHeader() {
    document.getElementById('btn-add-group').addEventListener('click', () => {
      UI.showGroupModal(null, (data) => {
        const group = Storage.addGroup(data);
        this.renderGroups();
        this.selectGroup(group.id);
        UI.showToast('새 여행 그룹이 만들어졌습니다! 🎉');
      });
    });

    document.getElementById('btn-add-place').addEventListener('click', () => {
      if (!state.currentGroupId) return;
      UI.showPlaceModal(state.currentGroupId, null, (data) => {
        Storage.addPlace(data);
        this.renderPlaces();
        UI.showToast('장소가 추가되었습니다! 📍');
      });
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const json = Storage.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `여행지_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      UI.showToast('데이터를 내보냈습니다.');
    });

    document.getElementById('btn-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        // 병합/덮어쓰기 선택
        const isOverwrite = await UI.showConfirm(
          '가져오기 방식을 선택해주세요.\n\n[삭제 버튼 = 전체 덮어쓰기]\n[취소 = 기존 데이터 유지하며 추가 병합]'
        );
        Storage.importData(text, isOverwrite ? 'overwrite' : 'merge');
        this.renderGroups();
        const groups = Storage.getGroups();
        if (groups.length > 0) this.selectGroup(groups[0].id);
        UI.showToast('데이터를 가져왔습니다. ✅');
      } catch {
        UI.showToast('올바른 백업 파일이 아닙니다.', 'error');
      }
      e.target.value = '';
    });
  },

  // ── 필터 ────────────────────────────────────────
  _bindFilters() {
    document.getElementById('filter-category').addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      this.renderPlaces();
    });

    let filterTimer;
    document.getElementById('filter-tag').addEventListener('input', (e) => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => {
        state.filterTag = e.target.value.trim();
        this.renderPlaces();
      }, 300);
    });
  },

  // ── 모바일 탭 ───────────────────────────────────
  _bindMobileTabs() {
    const layout = document.querySelector('.app-layout');
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        layout.dataset.tab = btn.dataset.tab;
        // 지도 탭 전환 시 지도 리사이즈
        if (btn.dataset.tab === 'map') {
          setTimeout(() => {
            if (window.naver?.maps) naver.maps.Event.trigger(MapModule._map || {}, 'resize');
          }, 50);
        }
      });
    });
    layout.dataset.tab = 'map';
  },
};
```

파일 경로: `G:\Claude Code\naver_map\public\js\app.js`

- [ ] **Step 2: 커밋**

```bash
git add public/js/app.js
git commit -m "feat: app.js — main orchestrator connecting storage, map, and UI modules"
```

---

## Task 8: 배포 및 환경 설정

**Files:**
- Modify: `CLAUDE.md` — 배포 절차 추가
- Create: `public/js/config.js` — 이미 Task 1에서 생성됨 (이 태스크에서 검증)

**Goal:** GitHub → Vercel 배포 완성, NCP 클라이언트 ID 설정

- [ ] **Step 1: GitHub 저장소 생성 및 push**

GitHub.com 로그인 → New Repository → 이름: `family-trip-map` → Public → Create

```bash
cd "G:/Claude Code/naver_map"
git remote add origin https://github.com/<YOUR_USERNAME>/family-trip-map.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Vercel 배포 연결**

1. https://vercel.com 접속 → GitHub으로 로그인
2. "Add New Project" → GitHub 저장소 선택 (`family-trip-map`)
3. Framework Preset: **Other**
4. Root Directory: `.` (변경 없음)
5. Build & Output Settings:
   - Output Directory: `public`
   - Build Command: (비워두기)
6. "Deploy" 클릭

- [ ] **Step 3: NCP 클라이언트 ID 발급**

1. https://console.ncloud.com 접속 → 회원가입/로그인
2. "AI·Application Service" → "AI·NAVER API" → "Maps" → "Application 등록"
3. 서비스 환경: **Web Dynamic Map** 선택
4. 서비스 URL: `https://<your-project>.vercel.app` 입력
5. 클라이언트 ID 복사

- [ ] **Step 4: config.js에 클라이언트 ID 입력**

`G:\Claude Code\naver_map\public\js\config.js` 파일의 `YOUR_NCP_CLIENT_ID_HERE` 부분을 실제 클라이언트 ID로 교체:

```javascript
window.APP_CONFIG = {
  naverMapClientId: '실제클라이언트ID여기에입력'
};
```

- [ ] **Step 5: 변경사항 push → 자동 재배포**

```bash
git add public/js/config.js
git commit -m "config: add Naver Maps NCP client ID"
git push
```

Vercel이 자동으로 재배포함 (약 30초).

- [ ] **Step 6: 동작 확인 체크리스트**

브라우저에서 배포된 URL 접속 후 확인:
- [ ] 지도가 한국 중심으로 표시됨
- [ ] "+ 그룹 추가" → 그룹 생성 → 목록에 표시
- [ ] "+ 장소" → 네이버 링크 붙여넣기 → "불러오기" → 정보 자동 입력
- [ ] 장소 저장 → 지도 마커 표시
- [ ] 마커 클릭 → 팝업 → "네이버지도에서 열기" 작동
- [ ] 장소 수정/삭제 작동
- [ ] 그룹 삭제 시 하위 장소도 삭제됨
- [ ] JSON 내보내기 → 파일 다운로드
- [ ] JSON 가져오기 → 데이터 복원
- [ ] 모바일에서 하단 탭 탐색 작동
- [ ] 카테고리/태그 필터 작동

---

## 자체 검토 (Spec Coverage)

| 스펙 요구사항 | 구현 태스크 |
|---|---|
| 네이버 공유링크 → 장소 추가 | Task 3 (api), Task 6 (parser+modal) |
| CRUD (그룹) | Task 2 (storage), Task 6 (ui modal), Task 7 (app) |
| CRUD (장소) | Task 2 (storage), Task 6 (ui modal), Task 7 (app) |
| 지도 마커 + 마커 클릭 팝업 | Task 4 (map.js) |
| 네이버지도에서 열기 버튼 | Task 4 (InfoWindow) |
| 여행 그룹 계층 구조 | Task 2 (groupId FK), Task 7 (selectGroup) |
| JSON 내보내기/가져오기 | Task 2 (storage), Task 7 (bindHeader) |
| 카테고리 + 자유 태그 필터 | Task 7 (bindFilters) |
| PC 3단 레이아웃 | Task 5 (CSS grid) |
| 모바일 탭 반응형 | Task 5 (CSS media), Task 7 (bindMobileTabs) |
| 무료 스택 | Vercel + GitHub + Naver Maps 무료 티어 |
| 방문 완료 체크 | Task 6 (pf-visited), Task 2 (updatePlace) |
