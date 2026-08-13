import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import AssetStatusCard from './AssetStatusCard'
import type { Asset, AssetStatus } from './AssetStatusCard'

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    assetId: 'AGV-001',
    status: 'Active',
    battery: 88,
    lastUpdated: '2026-08-13 10:00:00',
    ...overrides,
  }
}

function renderCard(overrides: Partial<Asset> = {}) {
  const onSelect = vi.fn()
  const onStop = vi.fn()
  const asset = makeAsset(overrides)
  const view = render(<AssetStatusCard asset={asset} onSelect={onSelect} onStop={onStop} />)

  return { ...view, asset, onSelect, onStop }
}

describe('AssetStatusCard', () => {
  describe('기본 렌더링', () => {
    it('assetId, status, battery, lastUpdated 를 모두 표시한다', () => {
      renderCard({
        assetId: 'AGV-042',
        status: 'Warning',
        battery: 55,
        lastUpdated: '2026-08-13 09:30:00',
      })

      expect(screen.getByRole('heading', { name: 'AGV-042' })).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('55%')).toBeInTheDocument()
      expect(screen.getByText('2026-08-13 09:30:00')).toBeInTheDocument()
    })

    it('배터리 값을 % 접미사와 함께 렌더링한다', () => {
      renderCard({ battery: 0 })

      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  describe('저배터리 처리 (임계값 20)', () => {
    it('배터리가 20 미만이면 warning 클래스와 Low Battery 배지를 붙인다', () => {
      renderCard({ battery: 19 })

      expect(screen.getByRole('article')).toHaveClass('asset-status-card', 'asset-status-card--warning')
      expect(screen.getByText('Low Battery')).toBeInTheDocument()
    })

    it('배터리가 정확히 20이면 저배터리로 보지 않는다', () => {
      renderCard({ battery: 20 })

      const card = screen.getByRole('article')
      expect(card).toHaveClass('asset-status-card')
      expect(card).not.toHaveClass('asset-status-card--warning')
      expect(screen.queryByText('Low Battery')).not.toBeInTheDocument()
    })

    it('배터리가 21이면 저배터리로 보지 않는다', () => {
      renderCard({ battery: 21 })

      expect(screen.getByRole('article')).not.toHaveClass('asset-status-card--warning')
      expect(screen.queryByText('Low Battery')).not.toBeInTheDocument()
    })
  })

  describe('Stale 상태', () => {
    it('Stale 이면 연결 끊김 문구를 보여주고 배터리/최근 갱신 시각은 감춘다', () => {
      renderCard({ status: 'Stale', battery: 77, lastUpdated: '2026-08-13 08:00:00' })

      expect(screen.getByText('연결 끊김 (데이터 미수신)')).toBeInTheDocument()
      expect(screen.queryByText('77%')).not.toBeInTheDocument()
      expect(screen.queryByText('2026-08-13 08:00:00')).not.toBeInTheDocument()
    })

    it('Stale 이 아니면 연결 끊김 문구를 보여주지 않는다', () => {
      renderCard({ status: 'Error' })

      expect(screen.queryByText('연결 끊김 (데이터 미수신)')).not.toBeInTheDocument()
      expect(screen.getByText('88%')).toBeInTheDocument()
    })

    it('Stale 이면서 저배터리이면 연결 끊김 문구와 배지를 함께 보여준다', () => {
      renderCard({ status: 'Stale', battery: 5 })

      expect(screen.getByText('연결 끊김 (데이터 미수신)')).toBeInTheDocument()
      expect(screen.getByText('Low Battery')).toBeInTheDocument()
      expect(screen.queryByText('5%')).not.toBeInTheDocument()
    })
  })

  describe('긴급 정지 버튼 활성화 조건', () => {
    it.each<AssetStatus>(['Active', 'Idle'])('%s 상태에서는 활성화된다', (status) => {
      renderCard({ status })

      expect(screen.getByRole('button', { name: '긴급 정지' })).toBeEnabled()
    })

    it.each<AssetStatus>(['Warning', 'Error', 'Stale'])('%s 상태에서는 비활성화된다', (status) => {
      renderCard({ status })

      expect(screen.getByRole('button', { name: '긴급 정지' })).toBeDisabled()
    })

    it('버튼 type 은 submit 이 아닌 button 이다', () => {
      renderCard()

      expect(screen.getByRole('button', { name: '긴급 정지' })).toHaveAttribute('type', 'button')
    })
  })

  describe('상호작용', () => {
    it('카드를 클릭하면 assetId 와 함께 onSelect 를 호출한다', async () => {
      const user = userEvent.setup()
      const { onSelect, onStop } = renderCard({ assetId: 'AGV-777' })

      await user.click(screen.getByRole('article'))

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith('AGV-777')
      expect(onStop).not.toHaveBeenCalled()
    })

    it('긴급 정지 버튼 클릭은 onStop 만 호출하고 카드 클릭으로 전파되지 않는다', async () => {
      const user = userEvent.setup()
      const { onSelect, onStop } = renderCard({ assetId: 'AGV-777', status: 'Idle' })

      await user.click(screen.getByRole('button', { name: '긴급 정지' }))

      expect(onStop).toHaveBeenCalledTimes(1)
      expect(onStop).toHaveBeenCalledWith('AGV-777')
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('비활성화된 버튼을 클릭해도 onStop 과 onSelect 모두 호출되지 않는다', async () => {
      const user = userEvent.setup()
      const { onSelect, onStop } = renderCard({ status: 'Error' })

      await user.click(screen.getByRole('button', { name: '긴급 정지' }))

      expect(onStop).not.toHaveBeenCalled()
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('카드를 여러 번 클릭하면 클릭 횟수만큼 onSelect 를 호출한다', async () => {
      const user = userEvent.setup()
      const { onSelect } = renderCard()

      await user.click(screen.getByRole('article'))
      await user.click(screen.getByRole('article'))

      expect(onSelect).toHaveBeenCalledTimes(2)
    })
  })

  describe('memo 비교 함수', () => {
    it.each<[string, Partial<Asset>, string]>([
      ['assetId', { assetId: 'AGV-999' }, 'AGV-999'],
      ['status', { status: 'Error' }, 'Error'],
      ['battery', { battery: 12 }, '12%'],
      ['lastUpdated', { lastUpdated: '2026-08-13 23:59:59' }, '2026-08-13 23:59:59'],
    ])('%s 가 바뀌면 다시 렌더링한다', (_field, patch, expectedText) => {
      const onSelect = vi.fn()
      const onStop = vi.fn()
      const { rerender } = render(
        <AssetStatusCard asset={makeAsset()} onSelect={onSelect} onStop={onStop} />,
      )

      rerender(<AssetStatusCard asset={makeAsset(patch)} onSelect={onSelect} onStop={onStop} />)

      expect(screen.getByText(expectedText)).toBeInTheDocument()
    })

    it('asset 필드가 모두 같으면 새 asset 객체로 리렌더해도 화면이 유지된다', () => {
      const onSelect = vi.fn()
      const onStop = vi.fn()
      const { rerender } = render(
        <AssetStatusCard asset={makeAsset()} onSelect={onSelect} onStop={onStop} />,
      )

      rerender(<AssetStatusCard asset={makeAsset()} onSelect={onSelect} onStop={onStop} />)

      expect(screen.getByRole('heading', { name: 'AGV-001' })).toBeInTheDocument()
      expect(screen.getByText('88%')).toBeInTheDocument()
    })

    // 현재 동작 고정용: 비교 함수가 asset 필드만 보기 때문에 asset 이 그대로면
    // 새로 넘긴 콜백은 반영되지 않고 첫 렌더의 콜백이 계속 호출된다.
    it('asset 이 동일하면 콜백 prop 이 바뀌어도 이전 콜백이 호출된다', async () => {
      const user = userEvent.setup()
      const asset = makeAsset({ status: 'Active' })
      const firstOnStop = vi.fn()
      const secondOnStop = vi.fn()
      const { rerender } = render(
        <AssetStatusCard asset={asset} onSelect={vi.fn()} onStop={firstOnStop} />,
      )

      rerender(<AssetStatusCard asset={makeAsset({ status: 'Active' })} onSelect={vi.fn()} onStop={secondOnStop} />)
      await user.click(screen.getByRole('button', { name: '긴급 정지' }))

      expect(firstOnStop).toHaveBeenCalledWith('AGV-001')
      expect(secondOnStop).not.toHaveBeenCalled()
    })
  })
})
