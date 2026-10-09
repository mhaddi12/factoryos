import { useEffect, useState } from 'react'
import type { WarehouseRecord } from '@shared/types/records'
import { api } from '../../lib/api'
import { Alert, BusyForm, Button, Drawer, Field, Page, Table, inputClass, messageOf } from '../../components/ui'

export function WarehousesPage() {
  const [rows, setRows] = useState<WarehouseRecord[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  function load() {
    setLoading(true)
    api<WarehouseRecord[]>('/api/warehouses').then(setRows).catch(reason => setError(messageOf(reason))).finally(() => setLoading(false))
  }
  useEffect(load, [])
  async function save() {
    setSaving(true)
    try {
      await api('/api/warehouses', { method: 'POST', body: JSON.stringify({ name, location, isActive: true }) })
      setOpen(false)
      setName('')
      setLocation('')
      load()
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Page title="Warehouses" action={<Button onClick={() => setOpen(true)}>Add</Button>}>
      <Alert error={error} />
      <Table headers={['Name', 'Location']} loading={loading}>{rows.map(row => <tr key={row.id} className="border-t border-slate-200"><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.location}</td></tr>)}</Table>
      <Drawer title="Add warehouse" open={open} onClose={() => setOpen(false)}>
        <BusyForm busy={saving} onSubmit={save}>
          <Field label="Name"><input className={inputClass} value={name} onChange={event => setName(event.target.value)} required /></Field>
          <Field label="Location"><input className={inputClass} value={location} onChange={event => setLocation(event.target.value)} /></Field>
          <Button type="submit" busy={saving}>Save</Button>
        </BusyForm>
      </Drawer>
    </Page>
  )
}
