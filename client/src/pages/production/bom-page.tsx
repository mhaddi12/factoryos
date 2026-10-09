import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BomRecord, FormOptions } from '@shared/types/records'
import { api } from '../../lib/api'
import { Alert, Button, Drawer, Field, Page, Table, inputClass, messageOf } from '../../components/ui'

export function BomPage() {
  const [rows, setRows] = useState<BomRecord[]>([])
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ productId: '', name: '', materialProductId: '', quantity: 1, wastagePercentage: 0 })
  function load() { api<BomRecord[]>('/api/boms').then(setRows).catch(reason => setError(messageOf(reason))) }
  useEffect(load, [])
  async function save() {
    setError('')
    try {
      await api('/api/boms', { method: 'POST', body: JSON.stringify({ productId: form.productId, name: form.name, items: [{ materialProductId: form.materialProductId, quantity: form.quantity, wastagePercentage: form.wastagePercentage }] }) })
      setOpen(false)
      load()
    } catch (reason) {
      setError(messageOf(reason))
    }
  }
  return (
    <Page title="Bill of materials" action={<Button onClick={() => { setOpen(true); api<FormOptions>('/api/options').then(setOptions).catch(reason => setError(messageOf(reason))) }}>New</Button>}>
      <Alert error={error} />
      <Table headers={['Product', 'Name', 'Version', 'Active']}>
        {rows.map(row => <tr key={row.id} className="border-t border-slate-200"><td className="px-3 py-2"><Link to={`/bom/${row.id}`}>{row.sku}</Link></td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.version}</td><td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td></tr>)}
      </Table>
      <Drawer title="New BOM" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); void save() }}>
          <Field label="Finished product"><select className={inputClass} value={form.productId} onChange={event => setForm({ ...form, productId: event.target.value })}>{options?.products.filter(item => item.productType !== 'RAW_MATERIAL').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Name"><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Material"><select className={inputClass} value={form.materialProductId} onChange={event => setForm({ ...form, materialProductId: event.target.value })}>{options?.products.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Quantity"><input className={inputClass} type="number" value={form.quantity} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })} /></Field>
          <Field label="Wastage %"><input className={inputClass} type="number" value={form.wastagePercentage} onChange={event => setForm({ ...form, wastagePercentage: Number(event.target.value) })} /></Field>
          <Button type="submit">Save</Button>
        </form>
      </Drawer>
    </Page>
  )
}
