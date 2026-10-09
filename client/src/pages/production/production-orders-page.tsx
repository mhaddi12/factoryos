import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormOptions, ProductionRecord } from '@shared/types/records'
import { api } from '../../lib/api'
import { qty, statusLabel, todayInput } from '../../lib/format'
import { Alert, Button, Drawer, Field, Page, Table, inputClass, messageOf } from '../../components/ui'

export function ProductionOrdersPage() {
  const [rows, setRows] = useState<ProductionRecord[]>([])
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ productId: '', bomId: '', materialWarehouseId: '', outputWarehouseId: '', plannedQuantity: 1, plannedStartDate: todayInput() })
  function load() { api<ProductionRecord[]>('/api/production-orders').then(setRows).catch(reason => setError(messageOf(reason))) }
  useEffect(load, [])
  async function save() {
    setError('')
    try {
      await api('/api/production-orders', { method: 'POST', body: JSON.stringify(form) })
      setOpen(false)
      load()
    } catch (reason) {
      setError(messageOf(reason))
    }
  }
  return (
    <Page title="Production orders" action={<Button onClick={() => { setOpen(true); api<FormOptions>('/api/options').then(setOptions).catch(reason => setError(messageOf(reason))) }}>New</Button>}>
      <Alert error={error} />
      <Table headers={['Order', 'Product', 'Status', 'Planned']}>
        {rows.map(row => <tr key={row.id} className="border-t border-slate-200"><td className="px-3 py-2"><Link to={`/production-orders/${row.id}`}>{row.orderNumber}</Link></td><td className="px-3 py-2">{row.productName}</td><td className="px-3 py-2">{statusLabel(row.status)}</td><td className="px-3 py-2">{qty(row.plannedQuantity)} {row.unit}</td></tr>)}
      </Table>
      <Drawer title="New production order" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); void save() }}>
          <Field label="Product"><select className={inputClass} value={form.productId} onChange={event => setForm({ ...form, productId: event.target.value })}>{options?.products.filter(item => item.productType !== 'RAW_MATERIAL').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="BOM"><select className={inputClass} value={form.bomId} onChange={event => setForm({ ...form, bomId: event.target.value })}>{options?.boms.filter(item => !form.productId || item.productId === form.productId).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Material warehouse"><select className={inputClass} value={form.materialWarehouseId} onChange={event => setForm({ ...form, materialWarehouseId: event.target.value })}>{options?.warehouses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Output warehouse"><select className={inputClass} value={form.outputWarehouseId} onChange={event => setForm({ ...form, outputWarehouseId: event.target.value })}>{options?.warehouses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Planned quantity"><input className={inputClass} type="number" value={form.plannedQuantity} onChange={event => setForm({ ...form, plannedQuantity: Number(event.target.value) })} /></Field>
          <Field label="Start date"><input className={inputClass} type="date" value={form.plannedStartDate} onChange={event => setForm({ ...form, plannedStartDate: event.target.value })} /></Field>
          <Button type="submit">Save</Button>
        </form>
      </Drawer>
    </Page>
  )
}
