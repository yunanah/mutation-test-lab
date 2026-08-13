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

function fetchSignalAt(index: number) {
  return (fetchMock.mock.calls[index]?.[1] as { signal: AbortSignal } | undefined)?.signal
}

/** 테스트가 원하는 시점에 resolve/reject 할 수 있는 fetch 응답. */
function deferredResponse() {
  let resolve!: (response: Response) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<Response>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 마이크로태스크 체인만 flush 한다(타이머는 진행시키지 않는다). */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
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

  describe('요청 인자', () => {
    it('URL 과 { signal } 두 인자만 넘겨 호출한다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-042', 1_000))
      await advance(1_000)

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/assets/AGV-042', {
        signal: expect.any(AbortSignal),
      })
    })

    it('요청마다 새 AbortController 를 만들고 이전 signal 은 abort 하지 않는다', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse(snapshot({ timestamp: 1_000 })))
        .mockResolvedValueOnce(okResponse(snapshot({ timestamp: 2_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      await advance(1_000)

      const first = fetchSignalAt(0)
      const second = fetchSignalAt(1)
      expect(first).toBeInstanceOf(AbortSignal)
      expect(second).toBeInstanceOf(AbortSignal)
      expect(second).not.toBe(first)
      expect(first?.aborted).toBe(false)
      expect(second?.aborted).toBe(false)
    })
  })

  describe('동시 요청 억제 해제', () => {
    it('느린 요청이 끝나면 응답을 반영하고 다음 주기부터 다시 fetch 한다', async () => {
      const slow = deferredResponse()
      fetchMock.mockReturnValueOnce(slow.promise)
      fetchMock.mockResolvedValue(okResponse(snapshot({ battery: 50, timestamp: 8_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      await advance(3_000)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.current.data).toBeNull()

      slow.resolve(okResponse(snapshot({ battery: 77, timestamp: 4_000 })))
      await flush()
      expect(result.current.data?.battery).toBe(77)

      await advance(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.data?.battery).toBe(50)
    })

    it('진행 중이던 요청이 실패로 끝나도 다음 주기에 다시 fetch 한다', async () => {
      const slow = deferredResponse()
      fetchMock.mockReturnValueOnce(slow.promise)
      fetchMock.mockResolvedValue(okResponse(snapshot({ battery: 21, timestamp: 6_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(3_000)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      slow.reject(new Error('network down'))
      await flush()

      await advance(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.data?.battery).toBe(21)
    })
  })

  describe('응답 처리 - 실패 경로', () => {
    it('본문 파싱에 실패하면 data 를 갱신하지 않고 폴링을 이어간다', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('unexpected token')
        },
      } as unknown as Response)
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(result.current.data).toBeNull()

      await advance(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.data).toBeNull()
    })

    it('ok 가 false 여도 직전 성공 응답은 그대로 유지한다', async () => {
      fetchMock.mockResolvedValueOnce(okResponse(snapshot({ battery: 64, timestamp: 3_000 })))
      fetchMock.mockResolvedValue(errorResponse(500))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(result.current.data?.battery).toBe(64)

      await advance(2_000)
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(result.current.data?.battery).toBe(64)
      expect(result.current.data?.timestamp).toBe(3_000)
    })

    it('ok 가 false 인 응답은 stale 타이머를 연장하지 않는다', async () => {
      fetchMock.mockResolvedValueOnce(okResponse(snapshot({ status: 'Active', timestamp: 3_000 })))
      fetchMock.mockResolvedValue(errorResponse(500))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)

      await advance(STALE_THRESHOLD_MS - 1)
      expect(result.current.data?.status).toBe('Active')

      await advance(1)
      expect(result.current.data?.status).toBe('Stale')
    })
  })

  describe('Stale 전환 - 추가', () => {
    it('갱신이 이어지는 동안에는 최초 stale 기한(startPolling + 10초)에도 Stale 이 아니다', async () => {
      for (let i = 1; i <= 9; i += 1) {
        fetchMock.mockResolvedValueOnce(
          okResponse(snapshot({ status: 'Active', battery: 90 - i, timestamp: i * 1_000 })),
        )
      }
      fetchMock.mockRejectedValue(new Error('network down'))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(9_000)
      expect(result.current.data?.battery).toBe(81)

      // startPolling 시점에 걸린 stale 타이머가 정리되지 않았다면 여기서 Stale 이 된다.
      await advance(1_000)
      expect(result.current.data?.status).toBe('Active')

      // 마지막 성공(t=9000) 기준으로 10초 뒤에 Stale 이 되어야 한다.
      await advance(STALE_THRESHOLD_MS - 1_000 - 1)
      expect(result.current.data?.status).toBe('Active')

      await advance(1)
      expect(result.current.data?.status).toBe('Stale')
    })

    it('Stale 전환은 status 만 바꾸고 나머지 필드는 그대로 둔다', async () => {
      fetchMock.mockResolvedValueOnce(
        okResponse(
          snapshot({ assetId: 'AGV-042', status: 'Warning', battery: 37, timestamp: 4_242 }),
        ),
      )
      fetchMock.mockRejectedValue(new Error('network down'))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-042', 1_000))
      await advance(1_000)
      await advance(STALE_THRESHOLD_MS)

      expect(result.current.data).toEqual({
        assetId: 'AGV-042',
        status: 'Stale',
        battery: 37,
        timestamp: 4_242,
      })
    })

    it('Stale 이 된 뒤 성공 응답이 오면 응답의 status 로 되돌아온다', async () => {
      let respond: () => Promise<Response> = () => Promise.reject(new Error('network down'))
      fetchMock.mockImplementation(() => respond())
      const { result } = renderHook(() => useAssetPoller())

      respond = async () => okResponse(snapshot({ status: 'Active', timestamp: 1_000 }))
      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(result.current.data?.status).toBe('Active')

      respond = () => Promise.reject(new Error('network down'))
      await advance(STALE_THRESHOLD_MS)
      expect(result.current.data?.status).toBe('Stale')

      respond = async () => okResponse(snapshot({ status: 'Warning', battery: 12, timestamp: 20_000 }))
      await advance(1_000)
      expect(result.current.data?.status).toBe('Warning')
      expect(result.current.data?.battery).toBe(12)
    })

    it('이미 Stale 인 상태에서 stale 타이머가 다시 만료되면 data 객체를 교체하지 않는다', async () => {
      fetchMock.mockResolvedValueOnce(okResponse(snapshot({ status: 'Active', timestamp: 1_000 })))
      fetchMock.mockRejectedValue(new Error('network down'))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      await advance(STALE_THRESHOLD_MS)
      expect(result.current.data?.status).toBe('Stale')

      const staleData = result.current.data
      // 재시작하면 stale 타이머가 다시 걸리고, 만료 시 이미 Stale 이므로 이전 객체를 그대로 둔다.
      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(STALE_THRESHOLD_MS)

      expect(result.current.data).toBe(staleData)
    })

    it('startPolling 은 호출 시점 기준으로 stale 타이머를 다시 건다', async () => {
      fetchMock.mockResolvedValueOnce(okResponse(snapshot({ status: 'Active', timestamp: 1_000 })))
      fetchMock.mockRejectedValue(new Error('network down'))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      act(() => result.current.stopPolling())

      // 타이머가 없는 구간을 5초 흘려보낸 뒤 재시작한다.
      await advance(5_000)
      expect(result.current.data?.status).toBe('Active')

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(STALE_THRESHOLD_MS - 1)
      expect(result.current.data?.status).toBe('Active')

      await advance(1)
      expect(result.current.data?.status).toBe('Stale')
    })
  })

  describe('타이머 정리', () => {
    it('startPolling 은 폴링 타이머와 stale 타이머를 하나씩만 유지한다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      expect(vi.getTimerCount()).toBe(2)

      act(() => result.current.startPolling('AGV-002', 1_000))
      expect(vi.getTimerCount()).toBe(2)
    })

    it('stopPolling 후에는 남은 타이머가 없다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(vi.getTimerCount()).toBeGreaterThan(0)

      act(() => result.current.stopPolling())
      expect(vi.getTimerCount()).toBe(0)
    })

    it('언마운트 후에는 남은 타이머가 없다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result, unmount } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)

      unmount()
      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('stopPolling / 재시작 - 추가', () => {
    it('연속으로 두 번 호출해도 오류 없이 정지 상태를 유지한다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot()))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)

      act(() => result.current.stopPolling())
      expect(() => act(() => result.current.stopPolling())).not.toThrow()

      await advance(10_000)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('stopPolling 후 startPolling 하면 다시 폴링을 시작한다', async () => {
      fetchMock.mockResolvedValue(okResponse(snapshot({ timestamp: 1_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      act(() => result.current.stopPolling())
      await advance(5_000)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('abort 된 요청이 뒤늦게 응답해도 최신 timestamp 기준을 밀어올리지 않는다', async () => {
      const stale = deferredResponse()
      fetchMock.mockReturnValueOnce(stale.promise)
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      act(() => result.current.stopPolling())

      stale.resolve(okResponse(snapshot({ battery: 1, timestamp: 9_999 })))
      await flush()
      expect(result.current.data).toBeNull()

      fetchMock.mockResolvedValue(okResponse(snapshot({ battery: 55, timestamp: 5_000 })))
      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)

      expect(result.current.data?.battery).toBe(55)
      expect(result.current.data?.timestamp).toBe(5_000)
    })

    it('abort 된 요청이 뒤늦게 끝나도 현재 진행 중인 요청의 controller 를 지우지 않는다', async () => {
      const first = deferredResponse()
      const second = deferredResponse()
      fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)

      act(() => result.current.startPolling('AGV-002', 1_000))
      await advance(1_000)
      const secondSignal = fetchSignalAt(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(secondSignal?.aborted).toBe(false)

      // 이미 abort 된 첫 요청이 이제야 응답한다.
      first.resolve(okResponse(snapshot({ battery: 1, timestamp: 9_999 })))
      await flush()

      act(() => result.current.stopPolling())
      expect(secondSignal?.aborted).toBe(true)
    })

    it('재시작해도 최신 timestamp 기준은 유지되어 더 오래된 응답은 무시한다', async () => {
      fetchMock.mockResolvedValueOnce(okResponse(snapshot({ battery: 90, timestamp: 5_000 })))
      const { result } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(result.current.data?.timestamp).toBe(5_000)

      fetchMock.mockResolvedValue(okResponse(snapshot({ battery: 10, timestamp: 4_000 })))
      act(() => result.current.startPolling('AGV-002', 1_000))
      await advance(1_000)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.current.data?.battery).toBe(90)
      expect(result.current.data?.timestamp).toBe(5_000)
    })
  })

  describe('언마운트 정리 - 추가', () => {
    it('언마운트 뒤 응답이 도착해도 오류를 던지지 않는다', async () => {
      const pending = deferredResponse()
      fetchMock.mockReturnValue(pending.promise)
      const { result, unmount } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)

      unmount()
      pending.resolve(okResponse(snapshot({ battery: 5, timestamp: 7_000 })))

      await expect(flush()).resolves.not.toThrow()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('언마운트 시점에 stale 예약이 남아 있어도 Stale 로 바뀌지 않는다', async () => {
      fetchMock.mockResolvedValueOnce(okResponse(snapshot({ status: 'Active', timestamp: 1_000 })))
      fetchMock.mockRejectedValue(new Error('network down'))
      const { result, unmount } = renderHook(() => useAssetPoller())

      act(() => result.current.startPolling('AGV-001', 1_000))
      await advance(1_000)
      expect(result.current.data?.status).toBe('Active')

      unmount()
      await advance(STALE_THRESHOLD_MS * 2)

      expect(result.current.data?.status).toBe('Active')
    })
  })
})
