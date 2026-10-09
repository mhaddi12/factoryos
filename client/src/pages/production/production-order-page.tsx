import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { ProductionRecord } from '@shared/types/records'
import { api } from '../../lib/api'
import { money, qty, statusLabel } from '../../lib/format'
import { SplitBar } from '../../components/charts'
import { Alert, BusyForm, Button, ChartSkeleton, Field, Page, Shimmer, inputClass, messageOf, panelClass } from '../../components/ui'

export function ProductionOrderPage() {
  const { id = '' } = useParams()
  const [order, setOrder] = useState<ProductionRecord | null>(null)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState({ producedQuantity: 0, labourCost: 0, otherCost: 0 })
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState('')
  useEffect(() => {
    setLoading(true)
    api<ProductionRecord>(`/api/production-orders/${id}`).then(setOrder).catch(reason => setError(messageOf(reason))).finally(() => setLoading(false))
  }, [id])
  async function run(action: string, body?: unknown) {
    setError('')
    setActing(action)
    try { setOrder(await api(`/api/production-orders/${id}/${action}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined })) } catch (reason) { setError(messageOf(reason)) } finally { setActing('') }
  }
  if (loading) {
    return (
      <Page title="Production">
        <Shimmer className="mb-4 h-4 w-64" />
        <div className={`${panelClass} max-w-xl`}><ChartSkeleton /></div>
      </Page>
    )
  }
  if (!order) return <Page title="Production"><Alert error={error} /></Page>
  return (
    <Page title={order.orderNumber}>
      <Alert error={error} />
      <p className="mb-4 text-sm text-slate-500">{order.productName} · {statusLabel(order.status)} · planned {qty(order.plannedQuantity)} {order.unit}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {order.status === 'PLANNED' ? <Button busy={acting === 'start'} onClick={() => void run('start')}>Start</Button> : null}
        {order.status === 'PLANNED' || order.status === 'IN_PROGRESS' ? <Button tone="secondary" busy={acting === 'cancel'} onClick={() => void run('cancel')}>Cancel</Button> : null}
      </div>
      {order.status === 'IN_PROGRESS' ? (
        <div className={`${panelClass} mb-6 max-w-md`}>
          <BusyForm busy={acting === 'complete'} onSubmit={() => run('complete', complete)}>
            <Field label="Produced quantity"><input className={inputClass} type="number" value={complete.producedQuantity} onChange={event => setComplete({ ...complete, producedQuantity: Number(event.target.value) })} /></Field>
            <Field label="Labour cost"><input className={inputClass} type="number" value={complete.labourCost} onChange={event => setComplete({ ...complete, labourCost: Number(event.target.value) })} /></Field>
            <Field label="Other cost"><input className={inputClass} type="number" value={complete.otherCost} onChange={event => setComplete({ ...complete, otherCost: Number(event.target.value) })} /></Field>
            <Button type="submit" busy={acting === 'complete'}>Complete and post stock</Button>
          </BusyForm>
        </div>
      ) : null}
      {order.status === 'COMPLETED' ? (
        <div className={`${panelClass} max-w-xl`}>
          <h2 className="mb-3 text-base font-semibold">Cost</h2>
          <SplitBar
            total={money(order.totalCost)}
            parts={[
              { label: 'Material', value: Number(order.materialCost), display: money(order.materialCost) },
              { label: 'Labour', value: Number(order.labourCost), display: money(order.labourCost) },
              { label: 'Other', value: Number(order.otherCost), display: money(order.otherCost) },
            ]}
          />
        </div>
      ) : null}
    </Page>
  )
}
