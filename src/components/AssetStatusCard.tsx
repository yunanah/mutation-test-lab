import { memo } from 'react'
import type { MouseEvent } from 'react'

export type AssetStatus = 'Active' | 'Idle' | 'Warning' | 'Error' | 'Stale'

export interface Asset {
  assetId: string
  status: AssetStatus
  battery: number
  lastUpdated: string
}

export interface AssetStatusCardProps {
  asset: Asset
  onSelect: (assetId: string) => void
  onStop: (assetId: string) => void
}

const LOW_BATTERY_THRESHOLD = 20

function AssetStatusCard({ asset, onSelect, onStop }: AssetStatusCardProps) {
  const { assetId, status, battery, lastUpdated } = asset

  const isLowBattery = battery < LOW_BATTERY_THRESHOLD
  const isStale = status === 'Stale'
  const isStoppable = status === 'Active' || status === 'Idle'

  const handleCardClick = () => {
    onSelect(assetId)
  }

  const handleStopClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onStop(assetId)
  }

  return (
    <article
      className={isLowBattery ? 'asset-status-card asset-status-card--warning' : 'asset-status-card'}
      onClick={handleCardClick}
    >
      <h3 className="asset-status-card__id">{assetId}</h3>
      <p className="asset-status-card__status">{status}</p>

      {isStale ? (
        <p className="asset-status-card__disconnected">연결 끊김 (데이터 미수신)</p>
      ) : (
        <>
          <p className="asset-status-card__battery">{battery}%</p>
          <p className="asset-status-card__last-updated">{lastUpdated}</p>
        </>
      )}

      {isLowBattery ? <span className="asset-status-card__badge">Low Battery</span> : null}

      <button type="button" disabled={!isStoppable} onClick={handleStopClick}>
        긴급 정지
      </button>
    </article>
  )
}

export default memo(
  AssetStatusCard,
  (prev, next) =>
    prev.asset.assetId === next.asset.assetId &&
    prev.asset.status === next.asset.status &&
    prev.asset.battery === next.asset.battery &&
    prev.asset.lastUpdated === next.asset.lastUpdated,
)
