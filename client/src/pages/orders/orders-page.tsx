import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormOptions, OrderPage } from '@shared/types/records'
import { api } from '../../lib/api'
import { money, statusLabel, todayInput } from '../../lib/format'
import { Alert, Button, Drawer, Field, Page, Table, inputClass, messageOf } from '../../components/ui'

export function OrdersPage({ kind }: { kind: 'purchase' | 'sales' }) {
  const base = kind === 'purchase' ? '/api/purchase-orders' : '/api/sales-orders'
  const title = kind === 'purchase' ? 'Purchase orders' : 'Sales orders'
  const [page, setPage] = useState<OrderPage | null>(null)
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ partyId: '', warehouseId: '', orderDate: todayInput(), productId: '', quantity: 1, unitPrice: 0 })

  function load() {
    api<OrderPage>(base).then(setPage).catch(reason => setError(messageOf(reason)))
  }
  useEffect(load, [base])

  async function save() {
    setError('')
    try {
      await api(base, { method: 'POST', body: JSON.stringify({ partyId: form.partyId, warehouseId: form.warehouseId, orderDate: form.orderDate, items: [{ productId: form.productId, quantity: form.quantity, unitPrice: form.unitPrice }] }) })
      setOpen(false)
      load()
    } catch (reason) {
      setError(messageOf(reason))
    }
  }

  const parties = kind === 'purchase' ? options?.suppliers : options?.customers
  return (
    <Page title={title} action={<Button onClick={() => { setOpen(true); api<FormOptions>('/api/options').then(setOptions).catch(reason => setError(messageOf(reason))) }}>New</Button>}>
      <Alert error={error} />
      <Table headers={['Number', 'Party', 'Status', 'Total']}>
        {page?.items.map(order => (
          <tr key={order.id} className="border-t border-slate-200">
            <td className="px-3 py-2"><Link to={`${kind === 'purchase' ? '/purchase-orders' : '/sales-orders'}/${order.id}`}>{order.orderNumber}</Link></td>
            <td className="px-3 py-2">{order.partyName}</td>
            <td className="px-3 py-2">{statusLabel(order.status)}</td>
            <td className="px-3 py-2">{money(order.total)}</td>
          </tr>
        ))}
      </Table>
      <Drawer title={`New ${title.toLowerCase().slice(0, -1)}`} open={open} onClose={() => setOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); void save() }}>
          <Field label={kind === 'purchase' ? 'Supplier' : 'Customer'}><select className={inputClass} value={form.partyId} onChange={event => setForm({ ...form, partyId: event.target.value })}><option value="">Choose</option>{parties?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Warehouse"><select className={inputClass} value={form.warehouseId} onChange={event => setForm({ ...form, warehouseId: event.target.value })}><option value="">Choose</option>{options?.warehouses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Date"><input className={inputClass} type="date" value={form.orderDate} onChange={event => setForm({ ...form, orderDate: event.target.value })} /></Field>
          <Field label="Product"><select className={inputClass} value={form.productId} onChange={event => setForm({ ...form, productId: event.target.value })}><option value="">Choose</option>{options?.products.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Quantity"><input className={inputClass} type="number" value={form.quantity} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })} /></Field>
          <Field label="Unit price"><input className={inputClass} type="number" value={form.unitPrice} onChange={event => setForm({ ...form, unitPrice: Number(event.target.value) })} /></Field>
          <Button type="submit">Save</Button>
        </form>
      </Drawer>
    </Page>
  )
}
