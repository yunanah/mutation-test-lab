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
