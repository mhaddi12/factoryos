import { useEffect, useState } from 'react'
import type { ReportData } from '@shared/types/records'
import { api } from '../../lib/api'
import { money, qty } from '../../lib/format'
import { CompareBars } from '../../components/charts'
import { Alert, Bars, ChartSkeleton, Page, Shimmer, messageOf, panelClass } from '../../components/ui'

export function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { api<ReportData>('/api/reports').then(setReport).catch(reason => setError(messageOf(reason))).finally(() => setLoading(false)) }, [])
  if (loading) {
    return (
      <Page title="Reports">
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <section key={index} className={panelClass}><Shimmer className="mb-4 h-5 w-28" /><ChartSkeleton /></section>
          ))}
        </div>
      </Page>
    )
  }
  if (!report) return <Page title="Reports"><Alert error={error} /></Page>
  return (
    <Page title="Reports">
      <div className="grid gap-4 xl:grid-cols-2">
        {report.inventory ? (
          <section className={panelClass}>
            <h2 className="text-base font-semibold">Inventory</h2>
            <p className="mt-1 mb-4 text-sm text-slate-500">Value {money(report.inventory.value)}</p>
            <Bars items={[...report.inventory.rows].sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 8).map(row => ({ label: row.sku, value: Number(row.value), display: money(row.value) }))} />
          </section>
        ) : null}
        {report.inventory && report.inventory.lowStock.length > 0 ? (
          <section className={panelClass}>
            <h2 className="mb-4 text-base font-semibold">Low stock</h2>
            <CompareBars items={report.inventory.lowStock.map(item => ({
              label: item.sku,
              current: Number(item.onHand),
              currentDisplay: `${qty(item.onHand)} ${item.unit}`,
              minimum: Number(item.minimum),
              minimumDisplay: `${qty(item.minimum)} ${item.unit}`,
            }))} />
          </section>
        ) : null}
        {report.financial ? (
          <section className={panelClass}>
            <h2 className="mb-4 text-base font-semibold">Financial</h2>
            <Bars items={[
              { label: 'Receivables', value: Number(report.financial.receivables), display: money(report.financial.receivables) },
              { label: 'Payables', value: Number(report.financial.payables), display: money(report.financial.payables) },
              { label: 'Inventory', value: Number(report.financial.inventoryValue), display: money(report.financial.inventoryValue) },
              { label: 'Incoming', value: Number(report.financial.incomingPayments), display: money(report.financial.incomingPayments) },
              { label: 'Outgoing', value: Number(report.financial.outgoingPayments), display: money(report.financial.outgoingPayments) },
            ]} />
          </section>
        ) : null}
        {report.production && report.production.orders.length > 0 ? (
          <section className={panelClass}>
            <h2 className="mb-4 text-base font-semibold">Production cost</h2>
            <Bars items={report.production.orders.slice(0, 6).map(order => ({ label: order.orderNumber, value: Number(order.totalCost), display: money(order.totalCost) }))} />
          </section>
        ) : null}
        {report.sales || report.purchases ? (
          <section className={panelClass}>
            <h2 className="mb-4 text-base font-semibold">Orders</h2>
            <Bars items={[
              ...(report.sales ? [
                { label: 'Sales', value: Number(report.sales.orderTotal), display: money(report.sales.orderTotal) },
                { label: 'Sales due', value: Number(report.sales.outstanding), display: money(report.sales.outstanding) },
              ] : []),
              ...(report.purchases ? [
                { label: 'Purchases', value: Number(report.purchases.orderTotal), display: money(report.purchases.orderTotal) },
                { label: 'Purchases due', value: Number(report.purchases.outstanding), display: money(report.purchases.outstanding) },
              ] : []),
            ]} />
          </section>
        ) : null}
      </div>
    </Page>
  )
}
