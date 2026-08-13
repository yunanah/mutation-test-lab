# 살아남은 뮤턴트 정리 (Survived Mutants)

- 리포트: `reports/mutation/mutation.json` (Stryker schema v1.0)
- 전체 뮤턴트 117개 중 killed 96개 / **survived 21개**
  - `src/hooks/useAssetPoller.ts` — survived 21개

`번호` 컬럼의 괄호 안 값은 Stryker 리포트의 mutant id 입니다.

| # | 파일:라인 | 뮤테이터 | 원본 코드 | 변형된 코드 | 분류 | 근거 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (#44) | `src/hooks/useAssetPoller.ts:23` | ConditionalExpression | `!response.ok` | `false` | 실질적 구멍 | 에러 응답의 바디를 정상 데이터로 반영. 테스트 픽스처의 json()이 파싱 단계에서 throw해 분기 자체가 검증되지 않음 |
| 2 (#45) | `src/hooks/useAssetPoller.ts:23` | BlockStatement | `` { throw new Error(`Failed to fetch asset ${assetId}: ${response.status}`) } `` | `{}` | 실질적 구멍 | 에러 응답의 바디를 정상 데이터로 반영. 테스트 픽스처의 json()이 파싱 단계에서 throw해 분기 자체가 검증되지 않음 |
| 3 (#46) | `src/hooks/useAssetPoller.ts:24` | StringLiteral | `` `Failed to fetch asset ${assetId}: ${response.status}` `` | ``` `` ``` | 저가치 | 훅이 catch로 에러를 삼켜 메시지를 외부에서 관측할 수 없음 |
| 4 (#48) | `src/hooks/useAssetPoller.ts:36` | BooleanLiteral | `false` | `true` | equivalent | startPolling이 항상 stopPolling()을 먼저 호출해 isFetchingRef를 false로 리셋하므로 초기값이 관측되지 않음 |
| 5 (#50) | `src/hooks/useAssetPoller.ts:40` | ConditionalExpression | `staleTimerRef.current !== null` | `true` | equivalent | clearTimeout/clearInterval에 null을 넘겨도 no-op이라 가드 유무가 결과에 영향 없음 |
| 6 (#61) | `src/hooks/useAssetPoller.ts:45` | ConditionalExpression | `prev.status === 'Stale'` | `false` | 저가치 | prev.status === 'Stale' 피연산자만 변형되어 스프레드는 prev !== null일 때만 실행됨. 효과는 이미 Stale인 상태에서 동일 내용의 새 객체를 만드는 불필요한 리렌더뿐 |
| 7 (#63) | `src/hooks/useAssetPoller.ts:45` | StringLiteral | `'Stale'` | `""` | 저가치 | 이미 Stale인 상태에서 새 객체를 만들어 불필요한 리렌더가 발생하나 화면 값은 동일해 관측이 어려움 |
| 8 (#66) | `src/hooks/useAssetPoller.ts:47` | ArrayDeclaration | `[]` | `["Stryker was here"]` | equivalent | 의존성이 모두 안정 참조라 배열이 바뀌어도 동작이 동일 |
| 9 (#71) | `src/hooks/useAssetPoller.ts:51` | ConditionalExpression | `assetId === null` | `false` | equivalent | assetId === null은 도달 불가능한 방어 가드. runFetch는 startPolling이 생성한 interval에서만 호출되고 startPolling이 assetIdRef를 먼저 설정하므로 null이 될 수 없음 |
| 10 (#82) | `src/hooks/useAssetPoller.ts:65` | ConditionalExpression | `latestTimestamp !== null` | `true` | 실질적 구멍 | 첫 응답 이후 모든 갱신이 폐기됨. 오래된 응답을 버리는 테스트는 있으나 정상 순서의 새 응답이 반영되는지 확인하는 대칭 케이스가 없음 |
| 11 (#88) | `src/hooks/useAssetPoller.ts:71` | BlockStatement | `{ return }` | `{}` | equivalent | catch의 return 유무와 무관하게 finally가 실행되고 이후 코드가 없어 결과가 동일 |
| 12 (#91) | `src/hooks/useAssetPoller.ts:75` | ConditionalExpression | `controllerRef.current === controller` | `true` | equivalent | 어느 분기로 가든 controllerRef.current가 null로 정리되어 결과 동일 |
| 13 (#92) | `src/hooks/useAssetPoller.ts:75` | ConditionalExpression | `controllerRef.current === controller` | `false` | equivalent | 어느 분기로 가든 controllerRef.current가 null로 정리되어 결과 동일 |
| 14 (#93) | `src/hooks/useAssetPoller.ts:75` | EqualityOperator | `controllerRef.current === controller` | `controllerRef.current !== controller` | equivalent | 어느 분기로 가든 controllerRef.current가 null로 정리되어 결과 동일 |
| 15 (#94) | `src/hooks/useAssetPoller.ts:75` | BlockStatement | `{ controllerRef.current = null }` | `{}` | equivalent | 어느 분기로 가든 controllerRef.current가 null로 정리되어 결과 동일 |
| 16 (#95) | `src/hooks/useAssetPoller.ts:79` | ArrayDeclaration | `[scheduleStaleTimer]` | `[]` | equivalent | 의존성이 모두 안정 참조라 배열이 바뀌어도 동작이 동일 |
| 17 (#97) | `src/hooks/useAssetPoller.ts:82` | ConditionalExpression | `pollTimerRef.current !== null` | `true` | equivalent | clearTimeout/clearInterval에 null을 넘겨도 no-op이라 가드 유무가 결과에 영향 없음 |
| 18 (#101) | `src/hooks/useAssetPoller.ts:86` | ConditionalExpression | `staleTimerRef.current !== null` | `true` | equivalent | clearTimeout/clearInterval에 null을 넘겨도 no-op이라 가드 유무가 결과에 영향 없음 |
| 19 (#110) | `src/hooks/useAssetPoller.ts:95` | ArrayDeclaration | `[]` | `["Stryker was here"]` | equivalent | 의존성이 모두 안정 참조라 배열이 바뀌어도 동작이 동일 |
| 20 (#113) | `src/hooks/useAssetPoller.ts:106` | ArrayDeclaration | `[runFetch, scheduleStaleTimer, stopPolling]` | `[]` | equivalent | 의존성이 모두 안정 참조라 배열이 바뀌어도 동작이 동일 |
| 21 (#115) | `src/hooks/useAssetPoller.ts:109` | ArrayDeclaration | `[stopPolling]` | `[]` | equivalent | 의존성이 모두 안정 참조라 배열이 바뀌어도 동작이 동일 |

## 요약

- equivalent 15 / 저가치 3 / 실질적 3
- 유효 뮤턴트 63개(78 − equivalent 15) 중 생존 6개, 유효 점수 90.5%
- 실질적 구멍은 #44·#45가 같은 줄(L23)이라 실제로는 2개 지점

---

# 2회차 결과

## 조건

- **A**: 1회차 생존 뮤턴트 중 실질적으로 판단한 3개(#44, #45, #82) 목록을 제공하고 보강 요청
- **B**: 목록 없이 "테스트를 더 강화해달라"만 요청
- 두 조건 모두 1회차 상태(`4eee703`)에서 분기, 소스 파일 무수정
  (변경 파일은 양쪽 모두 `src/hooks/useAssetPoller.test.ts` 하나뿐 — A +61줄, B +414줄)
- RESULTS.md / NOTES.md / reports 는 읽지 않도록 지시

## 점수

`src/hooks/useAssetPoller.ts` 기준 (전체 뮤턴트 78개)

| 회차 | 점수 | killed | survived | 테스트 개수 | 추가된 테스트 |
| --- | --- | --- | --- | --- | --- |
| 1회차 | 73.08% | 57 | 21 | 24 | — |
| 2회차 A | 76.92% | 60 | 18 | 27 | +3 |
| 2회차 B | 78.21% | 61 | 17 | 46 | +22 |

`src/components/AssetStatusCard.tsx`는 세 시점 모두 39/39 killed(100%)이며 테스트 파일도
1회차 그대로(15개)라 비교에서 제외한다. 프로젝트 전체 점수는 1회차 82.05%(96/117),
A 84.62%(99/117), B 85.47%(100/117).

> 1회차 수치 출처: `reports/`가 gitignore 대상이라 `reports/mutation/mutation.json`은
> 2회차 A 실행 결과로 덮어써졌다. 위 1회차 값은 이 문서 상단에 기록된 실측 카운트
> (전체 117 / killed 96 / survived 21, 전부 useAssetPoller)와 A·B 리포트의 파일별
> 뮤턴트 수(AssetStatusCard 39 / useAssetPoller 78)에서 산출했다.
> A·B 수치는 `/tmp/round2-a.json`, `/tmp/round2-b.json`에서 직접 읽었다.

## 뮤턴트 단위 비교

두 리포트는 동일한 117개 뮤턴트(id·위치·뮤테이터·치환값 모두 일치)를 대상으로 해
id 기준 1:1 비교가 가능하다. 차이가 난 7개는 전부 `src/hooks/useAssetPoller.ts`에 있다.

### A에서만 죽은 것 (3개)

| id | 파일:라인 | 뮤테이터 | 원본 코드 | 변형된 코드 |
| --- | --- | --- | --- | --- |
| #44 | `src/hooks/useAssetPoller.ts:23` | ConditionalExpression | `!response.ok` | `false` |
| #45 | `src/hooks/useAssetPoller.ts:23` | BlockStatement | `` { throw new Error(`Failed to fetch asset ${assetId}: ${response.status}`) } `` | `{}` |
| #82 | `src/hooks/useAssetPoller.ts:65` | ConditionalExpression | `latestTimestamp !== null` | `true` |

1회차에서 "실질적 구멍"으로 분류해 A에 제시한 3개와 정확히 일치한다. A는 제시된 목록을
전부 잡았고, 목록 밖에서는 추가로 잡은 것이 없다.

### B에서만 죽은 것 (4개)

| id | 파일:라인 | 뮤테이터 | 원본 코드 | 변형된 코드 |
| --- | --- | --- | --- | --- |
| #61 | `src/hooks/useAssetPoller.ts:45` | ConditionalExpression | `prev.status === 'Stale'` | `false` |
| #63 | `src/hooks/useAssetPoller.ts:45` | StringLiteral | `'Stale'` | `""` |
| #91 | `src/hooks/useAssetPoller.ts:75` | ConditionalExpression | `controllerRef.current === controller` | `true` |
| #93 | `src/hooks/useAssetPoller.ts:75` | EqualityOperator | `controllerRef.current === controller` | `controllerRef.current !== controller` |

1회차에서 #61·#63은 "저가치", #91·#93은 "equivalent"로 분류했던 것들이다.
즉 B는 A에 제시한 실질적 구멍 3개는 하나도 건드리지 못했고, 대신 사람이
가치 없다고 판단해 목록에서 제외한 영역을 잡았다.

### 둘 다 죽인 것

96개. (AssetStatusCard 39개 + useAssetPoller 57개 — 1회차에서 이미 죽은 것들)

### 둘 다 생존한 것 (14개)

| id | 파일:라인 | 뮤테이터 |
| --- | --- | --- |
| #46 | `src/hooks/useAssetPoller.ts:24` | StringLiteral |
| #48 | `src/hooks/useAssetPoller.ts:36` | BooleanLiteral |
| #50 | `src/hooks/useAssetPoller.ts:40` | ConditionalExpression |
| #66 | `src/hooks/useAssetPoller.ts:47` | ArrayDeclaration |
| #71 | `src/hooks/useAssetPoller.ts:51` | ConditionalExpression |
| #88 | `src/hooks/useAssetPoller.ts:71` | BlockStatement |
| #92 | `src/hooks/useAssetPoller.ts:75` | ConditionalExpression |
| #94 | `src/hooks/useAssetPoller.ts:75` | BlockStatement |
| #95 | `src/hooks/useAssetPoller.ts:79` | ArrayDeclaration |
| #97 | `src/hooks/useAssetPoller.ts:82` | ConditionalExpression |
| #101 | `src/hooks/useAssetPoller.ts:86` | ConditionalExpression |
| #110 | `src/hooks/useAssetPoller.ts:95` | ArrayDeclaration |
| #113 | `src/hooks/useAssetPoller.ts:106` | ArrayDeclaration |
| #115 | `src/hooks/useAssetPoller.ts:109` | ArrayDeclaration |

1회차 분류 기준으로 equivalent 13 / 저가치 1(#46) / 실질적 0이다.

### 교집합

**A가 새로 죽인 3개와 B가 새로 죽인 4개의 교집합은 0이다.** 두 조건이 잡은 뮤턴트는
단 하나도 겹치지 않았다. 테스트를 22개 추가한 B와 3개만 추가한 A가 점수상으로는
1.29%p 차이(78.21% vs 76.92%)지만, 실제로 커버한 영역은 완전히 분리되어 있다.
두 테스트 세트를 합치면 생존 뮤턴트는 14개(82.05%)까지 내려간다.

## B가 부수적으로 발견한 소스 결함

B는 뮤턴트 목록 없이 훅의 동작을 직접 파고들다가 `runFetch`의 `finally` 블록에서
결함을 발견했다.

```ts
// src/hooks/useAssetPoller.ts:73-78
} finally {
  isFetchingRef.current = false
  if (controllerRef.current === controller) {
    controllerRef.current = null
  }
}
```

`controllerRef.current`는 자기 자신일 때만 정리하도록 가드가 걸려 있는데,
`isFetchingRef.current = false`에는 같은 가드가 없어 **무조건** 실행된다.
따라서 abort된 이전 요청이 뒤늦게 settle하면, 더 새로운 요청이 진행 중인데도
in-flight 플래그가 풀려 중첩 요청이 발생한다. 이는 요구사항 2("동시 요청은 항상
최대 1개")의 위반이다.

이 결함은 1회차 생존 뮤턴트 목록에는 드러나지 않았던 것이며, 목록을 제공받은 A는
발견하지 못했다.

**실험 기준점 유지를 위해 소스는 수정하지 않았다.** 2·3회차의 모든 회차가 동일한
`src/hooks/useAssetPoller.ts`를 대상으로 해야 뮤턴트 id와 점수를 비교할 수 있기 때문이다.
수정은 실험 종료 후 별도 커밋으로 다룬다.
