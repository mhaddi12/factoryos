import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { OrderDetail } from '@shared/types/records'
import { api } from '../../lib/api'
import { money, qty, statusLabel, todayInput } from '../../lib/format'
import { Alert, Button, Field, Page, Table, inputClass, messageOf, panelClass } from '../../components/ui'

export function OrderDetailPage({ kind }: { kind: 'purchase' | 'sales' }) {
  const { id = '' } = useParams()
  const base = kind === 'purchase' ? '/api/purchase-orders' : '/api/sales-orders'
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState('')
  const [pay, setPay] = useState({ amount: 0, method: 'CASH', paidAt: todayInput(), reference: '' })

  function load() {
    api<OrderDetail>(`${base}/${id}`).then(setOrder).catch(reason => setError(messageOf(reason)))
  }
  useEffect(load, [id])

  async function run(action: string, body?: unknown) {
    setError('')
    try {
      setOrder(await api(`${base}/${id}/${action}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }))
    } catch (reason) {
      setError(messageOf(reason))
    }
  }

  if (!order) return <Page title="Order"><Alert error={error} /></Page>
  const move = kind === 'purchase' ? 'receive' : 'deliver'
  return (
    <Page title={order.orderNumber}>
      <Alert error={error} />
      <p className="mb-4 text-sm text-slate-500">{order.partyName} · {statusLabel(order.status)} · {money(order.total)}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {order.status === 'DRAFT' ? <Button onClick={() => void run('confirm')}>Confirm</Button> : null}
        {order.status === 'DRAFT' || order.status === 'CONFIRMED' ? <Button tone="secondary" onClick={() => void run('cancel')}>Cancel</Button> : null}
        {order.status === 'CONFIRMED' || order.status === (kind === 'purchase' ? 'PARTIALLY_RECEIVED' : 'PARTIALLY_DELIVERED')
          ? <Button onClick={() => void run(move, { items: order.items.map(item => ({ itemId: item.id, quantity: Number(item.quantity) - Number(item.movedQuantity) })) })}>{kind === 'purchase' ? 'Receive remaining' : 'Deliver remaining'}</Button>
          : null}
      </div>
      <Table headers={['Product', 'Quantity', 'Moved', 'Price']}>
        {order.items.map(item => <tr key={item.id} className="border-t border-slate-200"><td className="px-3 py-2">{item.productName}</td><td className="px-3 py-2">{qty(item.quantity)} {item.unit}</td><td className="px-3 py-2">{qty(item.movedQuantity)}</td><td className="px-3 py-2">{money(item.unitPrice)}</td></tr>)}
      </Table>
      <form className={`${panelClass} mt-6 max-w-md`} onSubmit={(event) => { event.preventDefault(); void run('payments', pay) }}>
        <h2 className="mb-3 text-lg font-semibold">Payment</h2>
        <Field label="Amount"><input className={inputClass} type="number" value={pay.amount} onChange={event => setPay({ ...pay, amount: Number(event.target.value) })} /></Field>
        <Field label="Method"><select className={inputClass} value={pay.method} onChange={event => setPay({ ...pay, method: event.target.value })}><option>CASH</option><option>BANK_TRANSFER</option><option>CHEQUE</option><option>OTHER</option></select></Field>
        <Field label="Date"><input className={inputClass} type="date" value={pay.paidAt} onChange={event => setPay({ ...pay, paidAt: event.target.value })} /></Field>
        <Field label="Reference"><input className={inputClass} value={pay.reference} onChange={event => setPay({ ...pay, reference: event.target.value })} /></Field>
        <Button type="submit">Record payment</Button>
      </form>
    </Page>
  )
}
