import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAssetPoller } from './useAssetPoller'
import type { AssetSnapshot } from './useAssetPoller'

const DEFAULT_INTERVAL_MS = 3000
const STALE_THRESHOLD_MS = 10000

let fetchMock: ReturnType<typeof vi.fn>

function snapshot(overrides: Partial<AssetSnapshot> = {}): AssetSnapshot {
  return {
    assetId: 'AGV-001',
    status: 'Active',
    battery: 88,
    timestamp: 1_000,
    ...overrides,
  }
}

function okResponse(body: AssetSnapshot) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function errorResponse(status = 500) {
  return {
    ok: false,
    status,
    json: async () => {
      throw new Error('should not be called')
    },
  } as unknown as Response
}

/**
 * ok 는 false 지만 본문은 정상 스냅샷으로 파싱되는 응답.
 * `!response.ok` 가드가 사라지면 이 본문이 그대로 data 로 흘러들어간다.
 */
function errorResponseWithBody(body: AssetSnapshot, status = 500) {
  return { ok: false, status, json: async () => body } as unknown as Response
}

/** 가짜 타이머를 진행시키면서 그 사이에 생긴 프라미스 체인까지 flush 한다. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function lastFetchUrl() {
  return fetchMock.mock.calls.at(-1)?.[0] as string | undefined
}

function lastFetchSignal() {
  return (fetchMock.mock.calls.at(-1)?.[1] as { signal: AbortSignal } | undefined)?.signal
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useAssetPoller', () => {
  describe('초기 상태', () => {
    it('마운트 직후에는 data 가 null 이고 fetch 를 호출하지 않는다', () => {
      const { result } = renderHook(() => useAssetPoller())

      expect(result.current.data).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('startPolling 을 부르기 전에는 시간이 흘러도 fetch 하지 않는다', async () => {
      renderHook(() => useAssetPoller())

      await advance(60_000)

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('폴링 주기', () => {
    it('startPolling 직후에는 즉시 fetch 하지 않는다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001'))
      await advance(DEFAULT_INTERVAL_MS - 1)

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('intervalMs 를 생략하면 3000ms 주기로 폴링한다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001'))
      await advance(DEFAULT_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await advance(DEFAULT_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('intervalMs 를 넘기면 해당 주기로 폴링한다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 500))
      await advance(499)
      expect(fetchMock).not.toHaveBeenCalled()

      await advance(1)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await advance(1_500)
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    it('assetId 를 경로에 담고 AbortSignal 과 함께 요청한다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-777', 1_000))
      await advance(1_000)

      expect(lastFetchUrl()).toBe('/api/v1/assets/AGV-777')
      expect(lastFetchSignal()).toBeInstanceOf(AbortSignal)
      expect(lastFetchSignal()?.aborted).toBe(false)
    })
  })

  describe('응답 처리', () => {
    it('성공 응답을 data 로 반영한다', async () => {
      const body = snapshot({ assetId: 'AGV-777', status: 'Idle', battery: 41, timestamp: 5_000 })
      fetchMock.mockResolvedValue(okResponse(body))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-777', 1_000))
      await advance(1_000)

      expect(result.current.data).toEqual(body)
    })

    it('폴링이 이어지면 최신 스냅샷으로 갱신한다', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 80, timestamp: 1_000 })))
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 70, timestamp: 2_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(result.current.data?.battery).toBe(80)

      await advance(1_000)
      expect(result.current.data?.battery).toBe(70)
    })

    it('ok 가 false 이면 data 를 갱신하지 않는다', async () => {
      fetchMock.mockResolvedValue(errorResponse(503))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.current.data).toBeNull()
    })

    it('ok 가 false 이면 본문이 정상 스냅샷이어도 data 로 반영하지 않는다', async () => {
      // 기존 "ok 가 false" 테스트는 json() 이 throw 하는 응답을 쓰기 때문에,
      // ok 검사를 없애도 catch 로 흡수되어 결과가 같다. 본문을 파싱 가능하게 두면
      // "상태 코드로 걸러낸다"는 계약만 남아 가드 제거를 잡아낼 수 있다.
      const body = snapshot({ battery: 5, timestamp: 9_000 })
      fetchMock.mockResolvedValue(errorResponseWithBody(body, 503))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.current.data).toBeNull()
    })

    it('ok 가 false 인 응답의 timestamp 는 최신 기준값을 오염시키지 않는다', async () => {
      // 실패 응답이 latestTimestamp 를 9_000 으로 올려버리면
      // 뒤이은 정상 응답(1_000)이 "오래된 응답"으로 오인되어 버려진다.
      fetchMock
        .mockResolvedValueOnce(errorResponseWithBody(snapshot({ battery: 5, timestamp: 9_000 }), 500))
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 42, timestamp: 1_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(result.current.data).toBeNull()

      await advance(1_000)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.data?.battery).toBe(42)
      expect(result.current.data?.timestamp).toBe(1_000)
    })

    it('네트워크 오류가 나도 폴링을 멈추지 않고 이후 성공 응답을 반영한다', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 33, timestamp: 2_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(result.current.data).toBeNull()

      await advance(1_000)
      expect(result.current.data?.battery).toBe(33)
    })

    it('오래된 timestamp 응답은 무시한다', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 80, timestamp: 5_000 })))
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 10, timestamp: 4_999 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      await advance(1_000)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.data?.battery).toBe(80)
      expect(result.current.data?.timestamp).toBe(5_000)
    })

    it('timestamp 가 같은 응답은 반영한다', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 80, timestamp: 5_000 })))
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 10, timestamp: 5_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      await advance(1_000)

      expect(result.current.data?.battery).toBe(10)
    })

    it('비교 기준이 없는 첫 응답은 timestamp 가 음수여도 반영한다', async () => {
      // latestTimestamp 가 null 인 동안에는 비교 자체를 하지 않아야 한다.
      // null 검사를 빼면 `timestamp < null` 이 `timestamp < 0` 으로 평가되어
      // 음수 timestamp 를 가진 첫 응답이 조용히 버려진다.
      fetchMock
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 60, timestamp: -1_000 })))
        .mockResolvedValueOnce(okResponse(snapshot({ battery: 55, timestamp: -500 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(result.current.data?.battery).toBe(60)
      expect(result.current.data?.timestamp).toBe(-1_000)

      // 첫 응답이 기준값이 된 뒤에는 평소대로 더 최신 응답이 반영된다.
      await advance(1_000)
      expect(result.current.data?.battery).toBe(55)
    })

    it('이전 요청이 끝나기 전에는 새 요청을 보내지 않는다', async () => {
      fetchMock.mockReturnValue(new Promise<Response>(() => {}))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(5_000)

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Stale 전환', () => {
    it('마지막 갱신 후 10초가 지나면 status 를 Stale 로 바꾼다', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(snapshot({ status: 'Active', timestamp: 1_000 })))
        .mockRejectedValue(new Error('network down'))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', DEFAULT_INTERVAL_MS))
      await advance(DEFAULT_INTERVAL_MS)
      expect(result.current.data?.status).toBe('Active')

      await advance(STALE_THRESHOLD_MS - 1)
      expect(result.current.data?.status).toBe('Active')

      await advance(1)
      expect(result.current.data?.status).toBe('Stale')
      expect(result.current.data?.battery).toBe(88)
    })

    it('응답이 계속 들어오면 Stale 로 바뀌지 않는다', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(okResponse(snapshot({ status: 'Active', timestamp: Date.now() }))),
      )
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', DEFAULT_INTERVAL_MS))
      await advance(DEFAULT_INTERVAL_MS * 6)

      expect(result.current.data?.status).toBe('Active')
    })

    it('data 가 없는 상태로 10초가 지나도 null 을 유지한다', async () => {
      fetchMock.mockRejectedValue(new Error('network down'))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', DEFAULT_INTERVAL_MS))
      await advance(STALE_THRESHOLD_MS + 1)

      expect(result.current.data).toBeNull()
    })
  })

  describe('stopPolling', () => {
    it('폴링 타이머를 정리해 더 이상 fetch 하지 않는다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      act(() => result.current.stopPolling())
      await advance(10_000)

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('진행 중인 요청을 abort 하고 늦게 도착한 응답을 반영하지 않는다', async () => {
      let resolveFetch: ((response: Response) => void) | undefined
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
      )
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      const signal = lastFetchSignal()
      expect(signal?.aborted).toBe(false)

      act(() => result.current.stopPolling())
      expect(signal?.aborted).toBe(true)

      await act(async () => {
        resolveFetch?.(okResponse(snapshot({ battery: 1, timestamp: 9_999 })))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(result.current.data).toBeNull()
    })

    it('stale 타이머도 함께 정리해 Stale 로 바뀌지 않는다', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(snapshot({ status: 'Active', timestamp: 1_000 })))
        .mockRejectedValue(new Error('network down'))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      act(() => result.current.stopPolling())

      await advance(STALE_THRESHOLD_MS * 2)

      expect(result.current.data?.status).toBe('Active')
    })

    it('폴링 중이 아닐 때 호출해도 오류가 나지 않는다', () => {
      const { result } = renderHook(() => useAssetPoller())

      expect(() => act(() => result.current.stopPolling())).not.toThrow()
      expect(result.current.data).toBeNull()
    })
  })

  describe('재시작', () => {
    it('startPolling 을 다시 부르면 이전 타이머를 정리하고 새 assetId/주기로 폴링한다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(lastFetchUrl()).toBe('/api/v1/assets/AGV-001')

      act(() => result.current.startPolling('AGV-002', 5_000))
      await advance(4_999)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await advance(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(lastFetchUrl()).toBe('/api/v1/assets/AGV-002')
    })

    it('재시작 시 진행 중이던 요청을 abort 해 다음 요청이 막히지 않는다', async () => {
      fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}))
      fetchMock.mockResolvedValue(okResponse(snapshot({ assetId: 'AGV-002', timestamp: 2_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      const firstSignal = lastFetchSignal()

      act(() => result.current.startPolling('AGV-002', 1_000))
      expect(firstSignal?.aborted).toBe(true)

      await advance(1_000)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.data?.assetId).toBe('AGV-002')
    })
  })

  describe('언마운트 정리', () => {
    it('언마운트되면 폴링과 stale 타이머를 모두 멈춘다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result, unmount } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      unmount()
      await advance(30_000)

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('언마운트 시 진행 중인 요청을 abort 한다', async () => {
      fetchMock.mockReturnValue(new Promise<Response>(() => {}))
      const { result, unmount } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      const signal = lastFetchSignal()

      unmount()

      expect(signal?.aborted).toBe(true)
    })
  })
})
