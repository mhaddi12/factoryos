import { useEffect, useState } from 'react'
import type { DashboardData } from '@shared/types/dashboard'
import { api } from '../../lib/api'
import { money, qty } from '../../lib/format'
import { ColumnChart, CompareBars } from '../../components/charts'
import { Alert, Bars, CardsSkeleton, ChartSkeleton, Page, Shimmer, messageOf, panelClass } from '../../components/ui'

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { api<DashboardData>('/api/dashboard').then(setData).catch(reason => setError(messageOf(reason))).finally(() => setLoading(false)) }, [])
  if (loading) {
    return (
      <Page title="Dashboard">
        <CardsSkeleton />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <section className={panelClass}><Shimmer className="mb-4 h-5 w-24" /><ChartSkeleton /></section>
          <section className={panelClass}><Shimmer className="mb-4 h-5 w-24" /><ChartSkeleton /></section>
        </div>
      </Page>
    )
  }
  if (!data) return <Page title="Dashboard"><Alert error={error} /></Page>
  const cards = [
    ['Products', String(data.counts.products)],
    ['Low stock', String(data.counts.lowStock)],
    ['Pending purchases', String(data.counts.pendingPurchases)],
    ['Pending sales', String(data.counts.pendingSales)],
    ['In progress', String(data.counts.productionInProgress)],
    ['Today production', qty(data.today.productionQuantity)],
    ['Today sales', money(data.today.salesTotal)],
    ['Inventory value', money(data.inventoryValue)],
  ]
  return (
    <Page title="Dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className={panelClass}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-semibold break-words sm:text-2xl">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <section className={panelClass}>
          <h2 className="mb-4 text-base font-semibold">Activity</h2>
          <ColumnChart items={[
            { label: 'Products', value: data.counts.products, display: String(data.counts.products) },
            { label: 'Low stock', value: data.counts.lowStock, display: String(data.counts.lowStock) },
            { label: 'Purchases', value: data.counts.pendingPurchases, display: String(data.counts.pendingPurchases) },
            { label: 'Sales', value: data.counts.pendingSales, display: String(data.counts.pendingSales) },
            { label: 'In progress', value: data.counts.productionInProgress, display: String(data.counts.productionInProgress) },
          ]} />
        </section>
        {data.lowStock.length > 0 ? (
          <section className={panelClass}>
            <h2 className="mb-4 text-base font-semibold">Low stock</h2>
            <CompareBars items={data.lowStock.map(item => ({
              label: item.sku,
              current: Number(item.current),
              currentDisplay: `${qty(item.current)} ${item.unit}`,
              minimum: Number(item.minimum),
              minimumDisplay: `${qty(item.minimum)} ${item.unit}`,
            }))} />
          </section>
        ) : null}
        {data.recentSales.length > 0 ? (
          <section className={panelClass}>
            <h2 className="mb-4 text-base font-semibold">Recent sales</h2>
            <Bars items={data.recentSales.map(order => ({ label: order.orderNumber, value: Number(order.total), display: money(order.total) }))} />
          </section>
        ) : null}
        {data.recentPurchases.length > 0 ? (
          <section className={panelClass}>
            <h2 className="mb-4 text-base font-semibold">Recent purchases</h2>
            <Bars items={data.recentPurchases.map(order => ({ label: order.orderNumber, value: Number(order.total), display: money(order.total) }))} />
          </section>
        ) : null}
      </div>
    </Page>
  )
}
