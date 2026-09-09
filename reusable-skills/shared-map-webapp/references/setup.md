# 환경설정과 이식

## 이 사례의 기준 구조

정적 HTML/CSS/ES modules의 `public/`, Vercel 서버 함수 `api/`, 서버 로직 `lib/`, Node 내장 테스트 `tests/` 구조다. React가 아니므로 React 전용 빌드/훅 규칙을 강제하지 않는다. 당시 Node 24 환경에서 @vercel/blob 2.8.0, exceljs 4.4.0, jszip 3.10.1을 사용했다. 이는 재현 정보이며 신규 프로젝트의 권장 최신 버전이라는 뜻은 아니다.

## 설정 순서

1. `node --version`, `npm --version`, `git status --short`, `git remote -v`로 런타임·작업트리·저장소를 확인한다. 원격 URL에 토큰이 있다면 공유하지 않는다.
2. lockfile이 있으면 `npm ci`, 없으면 의존성 선택 후 `npm install`을 실행한다. 필요한 스크립트만 package.json에 둔다. 해당 사례는 빌드 단계 없이 `node --test tests/*.test.mjs`로 검증했다.
3. 프로젝트의 배포 설정을 읽는다. 이 사례의 `vercel.json`은 `outputDirectory: public`, `/api/(.*)`를 `/api/$1`로 연결한다. Next.js 등에는 이 설정을 덮어쓰지 않는다.
4. 네이버 콘솔에서 프로젝트용 Maps 애플리케이션과 필요한 서비스를 생성/확인한다. 운영 도메인·개발 주소·스킴을 등록하고 SDK URL에 맞는 인증 매개변수를 사용한다. 이 사례의 v3 SDK는 `ncpKeyId`였다. 이전 서비스의 `ncpClientId` 예제를 무조건 섞지 않는다.
5. 공개 지도 키 ID와 비밀 서버 API Key를 구별한다. 서버 비밀키는 `public/`이나 브라우저 번들에 넣지 않는다. Directions 등 별도 서비스는 지도 표시 인증만으로 사용할 수 있다고 가정하지 않는다.
6. 공유 저장이 필요하면 새 프로젝트에 private Vercel Blob store를 연결하고 서버의 `BLOB_READ_WRITE_TOKEN`을 설정한다. 운영/Preview/개발 환경을 구분하고 테스트용 저장소·객체 경로를 분리한다. 이전 프로젝트의 저장 경로를 그대로 공유하면 데이터가 섞일 수 있다.
7. `.env*`, `.vercel/`, `node_modules/`를 ignore하고 비밀값 없는 `.env.example`만 추적한다. 이미 추적된 파일은 ignore만으로 제거되지 않는다. 비밀값 노출이 있었다면 해당 키 교체가 필요하다.
8. `vercel login`, `vercel link`는 사용자의 대상 프로젝트에 연결한다. 복사한 `.vercel/project.json`을 그대로 사용하지 않는다. `vercel deploy --prod --yes`는 대상과 배포 권한을 확인한 후 실행한다. 환경변수 수정 후에는 새 배포에 반영됐는지 확인한다.

## Windows 운영 팁

- 프로젝트 경로에 공백이 흔하다. 작업 디렉터리를 명시하고 경로를 인자로 전달한다. JSON 문자열화는 셸 escaping이 아니다.
- `.ps1`에 한글을 쓴다면 UTF-8 BOM, try/catch를 사용한다. `.bat/.cmd`는 `@echo off`, `chcp 65001 > nul`, 영문 본문, 오류 체크를 사용한다. `.sh`는 bash shebang, LF, 인자 quoting을 사용한다.
- 긴 설치·테스트·배포는 세션 ID를 보존하고 종료 코드까지 확인한다. 출력에 배포 URL이 나왔다는 이유만으로 READY로 판단하지 않는다.
- 토큰과 환경파일 전체를 콘솔에 출력하지 않는다. CLI가 환경변수 값을 일부라도 출력할 수 있으므로 공유용 결과는 변수 이름만 남긴다.
- UTF-8 한글 문서를 Python의 기본 read_text()로 읽을 때 Windows cp949 오류가 날 수 있다. 가능하면 encoding='utf-8'을 명시하고, 외부 검증 스크립트라면 `python -X utf8 <script> <path>`로 실행한다. 문서를 cp949로 변환해 이식성을 낮추지 않는다.

## 로컬·공유 상태 설계

공용 저장: 그룹/장소/수동 순서/카테고리/핀 사용자 색상. 로컬 상태: 현재 선택, 접기 상태, 정렬 모드, 테마, 편집 잠금. 기존 localStorage 데이터 이전은 명시적인 migration으로 구현하고 원본 백업을 보존한다.

출처: [네이버 Maps 가이드](https://guide.ncloud-docs.com/docs/application-maps-overview), [Vercel Blob](https://vercel.com/docs/vercel-blob), [Vercel CLI](https://vercel.com/docs/cli).
