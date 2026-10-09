import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { OrderDetail } from '@shared/types/records'
import { api } from '../../lib/api'
import { money, qty, statusLabel, todayInput } from '../../lib/format'
import { Alert, BusyForm, Button, Field, FormSkeleton, Page, Shimmer, Table, inputClass, messageOf, panelClass } from '../../components/ui'

export function OrderDetailPage({ kind }: { kind: 'purchase' | 'sales' }) {
  const { id = '' } = useParams()
  const base = kind === 'purchase' ? '/api/purchase-orders' : '/api/sales-orders'
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState('')
  const [pay, setPay] = useState({ amount: 0, method: 'CASH', paidAt: todayInput(), reference: '' })
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState('')

  useEffect(() => {
    setLoading(true)
    api<OrderDetail>(`${base}/${id}`).then(setOrder).catch(reason => setError(messageOf(reason))).finally(() => setLoading(false))
  }, [base, id])

  async function run(action: string, body?: unknown) {
    setError('')
    setActing(action)
    try {
      setOrder(await api(`${base}/${id}/${action}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }))
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setActing('')
    }
  }

  if (loading) {
    return (
      <Page title="Order">
        <Shimmer className="mb-4 h-4 w-64" />
        <Table headers={['Product', 'Quantity', 'Moved', 'Price']} loading />
        <div className={`${panelClass} mt-6 max-w-md`}><FormSkeleton fields={4} /></div>
      </Page>
    )
  }
  if (!order) return <Page title="Order"><Alert error={error} /></Page>
  const move = kind === 'purchase' ? 'receive' : 'deliver'
  return (
    <Page title={order.orderNumber}>
      <Alert error={error} />
      <p className="mb-4 text-sm text-slate-500">{order.partyName} · {statusLabel(order.status)} · {money(order.total)}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {order.status === 'DRAFT' ? <Button busy={acting === 'confirm'} onClick={() => void run('confirm')}>Confirm</Button> : null}
        {order.status === 'DRAFT' || order.status === 'CONFIRMED' ? <Button tone="secondary" busy={acting === 'cancel'} onClick={() => void run('cancel')}>Cancel</Button> : null}
        {order.status === 'CONFIRMED' || order.status === (kind === 'purchase' ? 'PARTIALLY_RECEIVED' : 'PARTIALLY_DELIVERED')
          ? <Button busy={acting === move} onClick={() => void run(move, { items: order.items.map(item => ({ itemId: item.id, quantity: Number(item.quantity) - Number(item.movedQuantity) })) })}>{kind === 'purchase' ? 'Receive remaining' : 'Deliver remaining'}</Button>
          : null}
      </div>
      <Table headers={['Product', 'Quantity', 'Moved', 'Price']}>
        {order.items.map(item => <tr key={item.id} className="border-t border-slate-200"><td className="px-3 py-2">{item.productName}</td><td className="px-3 py-2">{qty(item.quantity)} {item.unit}</td><td className="px-3 py-2">{qty(item.movedQuantity)}</td><td className="px-3 py-2">{money(item.unitPrice)}</td></tr>)}
      </Table>
      <div className={`${panelClass} mt-6 max-w-md`}>
        <h2 className="mb-3 text-lg font-semibold">Payment</h2>
        <BusyForm busy={acting === 'payments'} onSubmit={() => run('payments', pay)}>
          <Field label="Amount"><input className={inputClass} type="number" value={pay.amount} onChange={event => setPay({ ...pay, amount: Number(event.target.value) })} /></Field>
          <Field label="Method"><select className={inputClass} value={pay.method} onChange={event => setPay({ ...pay, method: event.target.value })}><option>CASH</option><option>BANK_TRANSFER</option><option>CHEQUE</option><option>OTHER</option></select></Field>
          <Field label="Date"><input className={inputClass} type="date" value={pay.paidAt} onChange={event => setPay({ ...pay, paidAt: event.target.value })} /></Field>
          <Field label="Reference"><input className={inputClass} value={pay.reference} onChange={event => setPay({ ...pay, reference: event.target.value })} /></Field>
          <Button type="submit" busy={acting === 'payments'}>Record payment</Button>
        </BusyForm>
      </div>
    </Page>
  )
}
