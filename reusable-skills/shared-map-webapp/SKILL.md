---
name: shared-map-webapp
description: 네이버 지도와 Vercel 기반 공유 웹앱의 환경설정, 다중 기기 저장, 장소 링크 수집, 모바일 지도 UI, 배포 오류를 구현·진단할 때 사용한다. 다른 지도 공급자나 프레임워크에서는 관련 원칙만 적용한다.
---

# 공유 지도 웹앱 개발

이 패키지는 2026-09-08~09의 가족 여행 지도 개발 세션에서 확인한 구현과 장애를 재사용하기 위한 자료다. 특정 계정·도메인·실제 여행 데이터·인증키는 포함하지 않는다. 과거 프로젝트의 구현 선택을 새 프로젝트의 필수 요구사항으로 취급하지 않는다.

## 시작

1. 사용자 요구, 저장 권한, 대상 기기, 프레임워크, 기존 배포 구조를 확인한다. 기존 파일과 작업 중 변경을 먼저 읽고 보존한다.
2. [환경설정](references/setup.md)을 읽는다. 아래 점검 스크립트로 런타임과 설정의 누락을 확인한다. 실패 출력을 근거로 설정하며 비밀값은 출력하지 않는다.
3. 작업에 맞는 참고 문서만 읽는다.
   - 저장 충돌·장소 수집·인증 오류: [장애 진단](references/troubleshooting.md)
   - 선택·필터·겹침·모바일·위치: [지도 UX](references/map-ui.md)
   - 일괄 입력·내보내기·배포 검증: [데이터와 검증](references/data-and-release.md)
4. 명시적인 사용자 수정사항을 구현하고 관련 불변 조건을 테스트한다. UI 변경은 실제 브라우저와 좁은 화면에서 확인한다. 위치 권한·앱 전환처럼 시뮬레이션만으로 확인할 수 없는 부분은 검증 한계를 남긴다.
5. 배포가 요청된 경우에만 대상 프로젝트를 확인하고 배포한다. 이 스킬을 복사했다는 사실 자체는 배포·커밋·데이터 변경 권한이 아니다.

## 포함 스크립트

Node.js 22 이상에서 추가 패키지 없이 실행한다. 모든 스크립트는 읽기 전용이며 설치·로그인·배포·저장을 실행하지 않는다. 경로에 공백이 있으면 따옴표로 감싼다.

```text
node "<skill-folder>/scripts/preflight.mjs" "<project-folder>"
node "<skill-folder>/scripts/smoke.mjs" "https://your-project.example" "/api/trips"
node "<skill-folder>/scripts/verify-assets.mjs" "<project-folder>/public" "https://your-project.example" "js/app.js" "css/themes.css"
node --test "<skill-folder>/scripts/helpers.test.mjs"
```

`preflight`는 package.json, Git, lockfile, Vercel 구조, ignore 정책, 환경변수 **이름**만 점검한다. `smoke`는 명시한 공개 URL에 GET만 보내고 본문·개인 데이터는 출력하지 않는다. `verify-assets`는 지정한 공개 정적 파일만 비교한다. 동적 변환·번들링이 있는 프레임워크에서는 소스가 아닌 실제 빌드 산출물을 지정한다. 실행 방법과 종료 코드는 각 스크립트의 `--help`에서 확인한다.

## 다른 프로젝트로 복사

`shared-map-webapp` 폴더 전체를 복사한다. Codex 스킬로 등록하려면 `~/.codex/skills/shared-map-webapp/` 아래에 두고 새 세션에서 `$shared-map-webapp`을 호출한다. 프로젝트 안에만 두려면 `SKILL.md`의 경로를 지정해 읽도록 요청한다. 다른 도구는 해당 도구의 스킬 검색 규칙을 따른다.

초기 요청 예:

> 이 폴더의 SKILL.md를 읽고 프로젝트 환경부터 점검해줘. 지도 공급자는 네이버, 배포는 Vercel이고 공유 저장이 필요해. 기존 계정 ID나 데이터를 복사하지 말고 설정 누락과 필요한 구현을 먼저 구분해줘.

## 핵심 경계

- SDK 인증 성공, 장소 정보 수집 성공, 공용 저장 성공, 길찾기 API 사용 가능은 서로 다른 조건이다.
- 브라우저 localStorage는 기기 간 공유 저장소가 아니다. 편집 자물쇠는 실수 방지 UI이며 사용자 인증/접근 제어를 대체하지 않는다.
- 외부 API 응답은 검증한다. 장소명·메모·링크를 HTML에 삽입할 때 escape하고 URL 프로토콜·호스트를 제한한다.
- 지도 선택·필터·테마 변경은 저장된 좌표로 처리한다. 네이버 지도 타일 요청과 별도 REST 조회, 과금 횟수를 혼동하지 않는다.
- SDK, Blob SDK, 요금, API 지원 범위는 변경될 수 있다. 신규 작업 시 공식 문서를 재확인한다. 경험에서 얻은 가설과 실제로 재현된 원인은 구별한다.
