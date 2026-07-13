# 단꿈 AI 문구 도구 (dgm-ai-tool)

배민 사장님용 AI 문구 생성 도구 7종. **순수 무로그인** — 로그인·매장·히스토리 없이
입력 → 생성 → 복사. 아임웹(단꿈넷)에 **iframe**으로 임베드하는 것을 전제로 만들었다.

## 도구 7종
가게소개 · 사장님공지 · 메뉴명 SEO · 메뉴설명 후킹 · 리뷰답변 · 주문안내 · 메뉴 옵션 설계

## 구조
```
api/generate.js        Vercel 서버 함수 (프롬프트 7종 + Origin 가드 + IP 레이트리밋)
src/
  App.jsx              도구 그리드 런처 + iframe 높이 postMessage
  components/AiForm.jsx 순수 폼 (Firebase/캐시/히스토리 전부 없음)
  data/presets.js      업종 프리셋 15종 + 옵션 가이드 6종 + 폼 기본값
  data/styles.js       스타일
```

## 로컬 실행
```
npm install
npm run dev        # http://localhost:5173
```
> 로컬에서 `/api/generate`를 실제로 호출하려면 `vercel dev`(Vercel CLI)를 쓴다.
> `vite dev`만으로는 서버 함수가 안 뜬다.

## Vercel 배포
1. 이 폴더를 새 GitHub 리포로 push.
2. Vercel에서 New Project → 해당 리포 임포트 (프레임워크 자동 감지: Vite).
3. 환경변수 설정:
   - `ANTHROPIC_API_KEY` — 필수.
   - `ALLOWED_ORIGINS` — `https://danggum.net,https://www.danggum.net` (아임웹 도메인).
   - `RATE_MAX`(기본 15), `RATE_WINDOW_MS`(기본 3600000) — 선택.
4. Deploy → `dgm-ai-tool.vercel.app` 확인.

## 아임웹 임베드 (핵심)
아임웹 페이지에 HTML 블록 하나를 넣고 `EMBED_IMWEB.html`의 코드를 붙인다.
`src`의 도메인을 배포된 Vercel URL로 바꾸면 된다.
- iframe 높이는 도구 앱이 `postMessage`로 자기 높이를 쏘고, 임베드 스크립트가
  받아서 iframe `height`를 맞춘다 → 스크롤 이중 없이 네이티브처럼 보인다.
- 특정 도구로 바로 진입: `src="...vercel.app/?type=reply"` 처럼 `?type=` 붙이기.
  (type: intro / notice / menuname / menudesc / reply / orderguide / menuoption)

## 보안 참고 — 레이트리밋
현재 방어는 **Origin 허용목록 + IP 인메모리 스로틀**이다. 빠르게 런칭 가능하지만:
- Origin/Referer 헤더는 브라우저 밖(curl 등)에서 위조 가능 → 결정적 공격은 못 막는다.
- 인메모리 카운터는 서버리스 인스턴스별·콜드스타트 시 리셋된다(정확한 전역 제한 아님).

트래픽이 늘면 **Upstash Redis 등 공유 저장소 기반 IP 레이트리밋**으로 승격한다.
`rateLimited()` 함수만 Redis 버전으로 교체하면 되도록 격리해 두었다.

## 원본 앱과의 관계
`baemin-optimizer`(체크리스트 앱)의 AI는 **건드리지 않았다**. 이 도구는 공개 유입용으로
추가된 것. 검증 후 체크리스트 앱의 카드 ✨/FAB를 이 도구로 딥링크하거나 제거하는
통합은 별도 작업으로 진행한다.
