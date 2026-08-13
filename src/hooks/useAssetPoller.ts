import { useCallback, useEffect, useRef, useState } from 'react'

export type AssetStatus = 'Active' | 'Idle' | 'Warning' | 'Error' | 'Stale'

export interface AssetSnapshot {
  assetId: string
  status: AssetStatus
  battery: number
  timestamp: number
}

export interface UseAssetPollerResult {
  data: AssetSnapshot | null
  startPolling: (assetId: string, intervalMs?: number) => void
  stopPolling: () => void
}

const DEFAULT_INTERVAL_MS = 3000
const STALE_THRESHOLD_MS = 10000

async function fetchAsset(assetId: string, signal: AbortSignal): Promise<AssetSnapshot> {
  const response = await fetch(`/api/v1/assets/${assetId}`, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch asset ${assetId}: ${response.status}`)
  }
  return (await response.json()) as AssetSnapshot
}

export function useAssetPoller(): UseAssetPollerResult {
  const [data, setData] = useState<AssetSnapshot | null>(null)

  const assetIdRef = useRef<string | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const isFetchingRef = useRef(false)
  const latestTimestampRef = useRef<number | null>(null)

  const scheduleStaleTimer = useCallback(() => {
    if (staleTimerRef.current !== null) {
      clearTimeout(staleTimerRef.current)
    }
    staleTimerRef.current = setTimeout(() => {
      staleTimerRef.current = null
      setData((prev) => (prev === null || prev.status === 'Stale' ? prev : { ...prev, status: 'Stale' }))
    }, STALE_THRESHOLD_MS)
  }, [])

  const runFetch = useCallback(async () => {
    const assetId = assetIdRef.current
    if (assetId === null || isFetchingRef.current) {
      return
    }

    isFetchingRef.current = true
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const snapshot = await fetchAsset(assetId, controller.signal)
      if (controller.signal.aborted) {
        return
      }
      const latestTimestamp = latestTimestampRef.current
      if (latestTimestamp !== null && snapshot.timestamp < latestTimestamp) {
        return
      }
      latestTimestampRef.current = snapshot.timestamp
      setData(snapshot)
      scheduleStaleTimer()
    } catch {
      return
    } finally {
      isFetchingRef.current = false
      if (controllerRef.current === controller) {
        controllerRef.current = null
      }
    }
  }, [scheduleStaleTimer])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (staleTimerRef.current !== null) {
      clearTimeout(staleTimerRef.current)
      staleTimerRef.current = null
    }
    if (controllerRef.current !== null) {
      controllerRef.current.abort()
      controllerRef.current = null
    }
    isFetchingRef.current = false
  }, [])

  const startPolling = useCallback(
    (assetId: string, intervalMs: number = DEFAULT_INTERVAL_MS) => {
      stopPolling()
      assetIdRef.current = assetId
      pollTimerRef.current = setInterval(() => {
        void runFetch()
      }, intervalMs)
      scheduleStaleTimer()
    },
    [runFetch, scheduleStaleTimer, stopPolling],
  )

  useEffect(() => stopPolling, [stopPolling])

  return { data, startPolling, stopPolling }
}
