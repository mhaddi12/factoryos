import { useEffect, useState } from 'react'
import type { FormOptions, ProductRecord } from '@shared/types/records'
import { api, fieldError } from '../../lib/api'
import { qty, statusLabel } from '../../lib/format'
import { Alert, Button, Drawer, Field, Page, Table, inputClass, messageOf } from '../../components/ui'

export function ProductsPage() {
  const [rows, setRows] = useState<ProductRecord[]>([])
  const [categories, setCategories] = useState<FormOptions['categories']>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const blank = { sku: '', name: '', unit: 'PCS', type: 'RAW_MATERIAL', costPrice: 0, sellingPrice: 0, minimumStock: 0, categoryId: '', isActive: true }
  const [form, setForm] = useState(blank)

  function load() {
    api<ProductRecord[]>('/api/products').then(setRows).catch(reason => setError(reason))
    api<FormOptions>('/api/options').then(options => setCategories(options.categories)).catch(() => undefined)
  }
  useEffect(load, [])

  async function save() {
    setError(null)
    try {
      await api('/api/products', { method: 'POST', body: JSON.stringify({ ...form, categoryId: form.categoryId || undefined }) })
      setOpen(false)
      setForm(blank)
      load()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Page title="Products" action={<Button onClick={() => setOpen(true)}>Add</Button>}>
      <Alert error={error ? messageOf(error) : ''} />
      <Table headers={['SKU', 'Name', 'Type', 'On hand']}>
        {rows.map(row => <tr key={row.id} className="border-t border-slate-200"><td className="px-3 py-2">{row.sku}</td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{statusLabel(row.type)}</td><td className="px-3 py-2">{qty(row.onHand)} {row.unit}</td></tr>)}
      </Table>
      <Drawer title="Add product" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); void save() }}>
          <Field label="SKU" error={fieldError(error, 'sku')}><input className={inputClass} value={form.sku} onChange={event => setForm({ ...form, sku: event.target.value })} required /></Field>
          <Field label="Name" error={fieldError(error, 'name')}><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="Category"><select className={inputClass} value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })}><option value="">None</option>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Unit"><select className={inputClass} value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })}>{['PCS', 'KG', 'GRAM', 'LITER', 'METER', 'BOX', 'PACK'].map(unit => <option key={unit}>{unit}</option>)}</select></Field>
          <Field label="Type"><select className={inputClass} value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}><option value="RAW_MATERIAL">Raw material</option><option value="SEMI_FINISHED">Semi-finished</option><option value="FINISHED_GOOD">Finished good</option></select></Field>
          <Field label="Cost price"><input className={inputClass} type="number" value={form.costPrice} onChange={event => setForm({ ...form, costPrice: Number(event.target.value) })} /></Field>
          <Field label="Selling price"><input className={inputClass} type="number" value={form.sellingPrice} onChange={event => setForm({ ...form, sellingPrice: Number(event.target.value) })} /></Field>
          <Field label="Minimum stock"><input className={inputClass} type="number" value={form.minimumStock} onChange={event => setForm({ ...form, minimumStock: Number(event.target.value) })} /></Field>
          <Button type="submit">Save</Button>
        </form>
      </Drawer>
    </Page>
  )
}
