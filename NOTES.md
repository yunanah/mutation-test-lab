# 실험 조건 기록

## 대상 코드

- `src/components/AssetStatusCard.tsx`
- `src/hooks/useAssetPoller.ts`
- 두 대상은 독립적으로 테스트하며 서로 연결하지 않는다.
  (AssetStatusCard는 `lastUpdated`, useAssetPoller는 `timestamp`를 쓰지만
  실험에서 연동하지 않으므로 통일하지 않음)

## 요구사항 명세

### 공통 작성 규칙

- 주석을 달지 않는다. 요구사항 항목 번호나 설명 주석 모두 제외.
- 요구사항에 없는 기능을 임의로 추가하지 않는다.
- 서드파티 라이브러리 최소화. React Hook과 표준 브라우저 API
  (AbortController, setTimeout/clearTimeout)만 사용.
- 타입 안정성이 보장된 TypeScript로 작성한다.

### 대상 1: AssetStatusCard.tsx

props로 asset(`{ assetId, status, battery, lastUpdated }`)과
`onSelect`, `onStop` 콜백을 받는 함수형 컴포넌트.
status는 `'Active' | 'Idle' | 'Warning' | 'Error' | 'Stale'`.

1. assetId, status, battery(0~100), lastUpdated를 화면에 표시한다.
2. battery가 20 미만이면 'Low Battery' 경고 배지를 표시하고
   카드 테두리를 경고 스타일로 변경한다.
3. '긴급 정지' 버튼은 status가 'Active' 또는 'Idle'일 때만 활성화되고,
   'Stale' 또는 'Error'일 때는 비활성화된다.
4. status가 'Stale'이면 수치 데이터 대신
   "연결 끊김 (데이터 미수신)" 텍스트를 표시한다.
5. 카드 클릭 시 `onSelect(assetId)`를, 정지 버튼 클릭 시 `onStop(assetId)`를
   각각 정확히 1회 호출한다.
6. React.memo를 적용해 asset props가 변경되지 않으면 리렌더링하지 않는다.

### 대상 2: useAssetPoller.ts

`startPolling(assetId, intervalMs)`와 `stopPolling()`을 노출하는 커스텀 훅.
fetcher는 `GET /api/v1/assets/{id}`를 호출한다.

1. startPolling 호출 시 설정된 주기(기본 3000ms)마다 fetcher를 호출해
   최신 상태를 갱신한다.
2. 이전 요청이 아직 완료되지 않았으면 다음 주기 타이머가 발동해도
   새 요청을 보내지 않는다. 동시 요청은 항상 최대 1개다.
3. 수신한 응답의 timestamp가 현재 저장된 상태의 timestamp보다 과거이면
   해당 응답을 폐기하고 상태를 덮어쓰지 않는다.
4. 마지막 성공 수신 시점으로부터 10000ms 동안 새 데이터가 수신되지 않으면
   status를 'Stale'로 전환한다.
5. `stopPolling()` 호출 또는 언마운트 시 예약된 모든 타이머를 해제하고
   진행 중인 요청을 AbortController로 취소한다.

## 명세가 모호해 판단한 지점

1. `startPolling`은 즉시 1회 호출 없이 `intervalMs` 경과 후부터 호출한다
   ("주기마다"의 문자적 해석). Stale 타이머는 `startPolling` 시점부터 기산하고,
   채택된 응답마다 리셋한다.
2. 요구 2(Low Battery 배지/테두리)는 status와 독립 조건으로 두었다.
   즉 `Stale`이면서 battery < 20이면 수치는 숨기되 배지는 표시된다.
3. `React.memo` 비교자는 요구 6대로 `asset`의 4개 필드만 비교한다 —
   `onSelect`/`onStop` 참조가 매 렌더 새로 만들어져도 리렌더링하지 않는다.
4. 요구 3의 "과거이면"은 엄격 부등호로 구현했다.
   timestamp가 같은 응답은 폐기하지 않고 반영한다.
5. 정지 버튼은 `stopPropagation`으로 카드 `onSelect`가 함께 호출되지 않도록 했다
   (요구 5의 "각각 정확히 1회").

## 구현상 뮤테이션에 영향을 줄 지점

- timestamp 비교는 엄격 부등호(`<`)로 구현. 동일 timestamp 응답은 폐기하지 않고 반영됨
- fetch를 주입하지 않고 모듈 내부에서 전역 fetch를 호출.
  테스트에서 stubGlobal 또는 MSW로 모킹해야 함
- React.memo 비교자는 asset의 4개 필드만 비교

## 실험 절차

1. 이 시점의 코드를 커밋해 기준점으로 고정. 이후 대상 코드는 수정하지 않는다.
2. 새 세션에서 구현 코드만 제공하고 테스트 생성을 요청 (1회차).
3. Stryker 실행 → 점수와 생존 뮤턴트 기록.
4. 생존 뮤턴트를 의미 있음/없음으로 분류.
5. 2·3회차를 두 조건으로 분기.
   - A: 생존 뮤턴트 목록을 제공하고 보강 요청
   - B: 목록 없이 "테스트를 더 강화해달라"만 요청
6. 회차별 점수 비교.
