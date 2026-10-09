import { useEffect, useState } from 'react'
import type { FormOptions, StockBalanceRow, StockMovementRow } from '@shared/types/records'
import { useCan } from '../../auth/session'
import { api } from '../../lib/api'
import { money, qty, statusLabel } from '../../lib/format'
import { Alert, Bars, Button, Drawer, Field, Page, Table, inputClass, messageOf, panelClass } from '../../components/ui'

export function StockPage() {
  const [balances, setBalances] = useState<StockBalanceRow[]>([])
  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'adjust' | 'transfer' | ''>('')
  const [form, setForm] = useState({ productId: '', warehouseId: '', fromWarehouseId: '', toWarehouseId: '', direction: 'IN', quantity: 1, unitCost: 0 })
  const can = useCan()

  function load() {
    api<StockBalanceRow[]>('/api/stock/balances').then(setBalances).catch(reason => setError(messageOf(reason)))
    api<{ items: StockMovementRow[] }>('/api/stock/movements').then(page => setMovements(page.items)).catch(() => undefined)
    if (can('inventory.write')) api<FormOptions>('/api/options').then(setOptions).catch(() => undefined)
  }
  useEffect(load, [])

  async function save() {
    setError('')
    try {
      if (mode === 'adjust') {
        await api('/api/stock/adjustments', { method: 'POST', body: JSON.stringify({ productId: form.productId, warehouseId: form.warehouseId, direction: form.direction, quantity: form.quantity, unitCost: form.direction === 'IN' ? form.unitCost : undefined }) })
      } else {
        await api('/api/stock/transfers', { method: 'POST', body: JSON.stringify({ productId: form.productId, fromWarehouseId: form.fromWarehouseId, toWarehouseId: form.toWarehouseId, quantity: form.quantity }) })
      }
      setMode('')
      load()
    } catch (reason) {
      setError(messageOf(reason))
    }
  }

  return (
    <Page title="Stock movements" action={can('inventory.write') ? <div className="flex flex-wrap gap-2"><Button onClick={() => setMode('adjust')}>Adjustment</Button><Button tone="secondary" onClick={() => setMode('transfer')}>Transfer</Button></div> : undefined}>
      <Alert error={error} />
      <section className={`${panelClass} mb-5`}>
        <h2 className="mb-4 text-base font-semibold">Balances</h2>
        <Bars items={[...balances].sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 8).map(row => ({ label: row.sku, value: Number(row.value), display: money(row.value) }))} />
      </section>
      <div className="mt-4"><Table headers={['SKU', 'Warehouse', 'Quantity', 'Value']}>{balances.map(row => <tr key={row.id}><td className="px-3 py-2">{row.sku}</td><td className="px-3 py-2">{row.warehouseName}</td><td className="px-3 py-2">{qty(row.quantity)} {row.unit}</td><td className="px-3 py-2">{money(row.value)}</td></tr>)}</Table></div>
      <h2 className="mt-8 mb-3 text-base font-semibold">Movements</h2>
      <Table headers={['When', 'Type', 'Product', 'Quantity']}>{movements.map(row => <tr key={row.id} className="border-t border-slate-200"><td className="px-3 py-2">{row.createdAt.slice(0, 16).replace('T', ' ')}</td><td className="px-3 py-2">{statusLabel(row.type)}</td><td className="px-3 py-2">{row.productName}</td><td className="px-3 py-2">{qty(row.quantity)} {row.unit}</td></tr>)}</Table>
      <Drawer title={mode === 'transfer' ? 'Transfer' : 'Adjustment'} open={Boolean(mode)} onClose={() => setMode('')}>
        <form onSubmit={(event) => { event.preventDefault(); void save() }}>
          <Field label="Product"><select className={inputClass} value={form.productId} onChange={event => setForm({ ...form, productId: event.target.value })}>{options?.products.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          {mode === 'adjust' ? (
            <>
              <Field label="Warehouse"><select className={inputClass} value={form.warehouseId} onChange={event => setForm({ ...form, warehouseId: event.target.value })}>{options?.warehouses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
              <Field label="Direction"><select className={inputClass} value={form.direction} onChange={event => setForm({ ...form, direction: event.target.value })}><option value="IN">In</option><option value="OUT">Out</option></select></Field>
              {form.direction === 'IN' ? <Field label="Unit cost"><input className={inputClass} type="number" value={form.unitCost} onChange={event => setForm({ ...form, unitCost: Number(event.target.value) })} /></Field> : null}
            </>
          ) : (
            <>
              <Field label="From"><select className={inputClass} value={form.fromWarehouseId} onChange={event => setForm({ ...form, fromWarehouseId: event.target.value })}>{options?.warehouses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
              <Field label="To"><select className={inputClass} value={form.toWarehouseId} onChange={event => setForm({ ...form, toWarehouseId: event.target.value })}>{options?.warehouses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            </>
          )}
          <Field label="Quantity"><input className={inputClass} type="number" value={form.quantity} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })} /></Field>
          <Button type="submit">Save</Button>
        </form>
      </Drawer>
    </Page>
  )
}
