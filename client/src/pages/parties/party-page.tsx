import { useEffect, useState } from 'react'
import { PAKISTAN_CITIES } from '@shared/domain/pakistan'
import type { PartyRecord } from '@shared/types/records'
import { api, fieldError } from '../../lib/api'
import { Alert, BusyForm, Button, Drawer, Field, Page, Table, inputClass, messageOf } from '../../components/ui'

export function PartyPage({ kind }: { kind: 'customer' | 'supplier' }) {
  const title = kind === 'customer' ? 'Customers' : 'Suppliers'
  const path = kind === 'customer' ? '/api/customers' : '/api/suppliers'
  const [rows, setRows] = useState<PartyRecord[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', city: '', taxNumber: '', address: '', isActive: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    api<PartyRecord[]>(path).then(setRows).catch(reason => setError(reason)).finally(() => setLoading(false))
  }
  useEffect(load, [path])

  async function save() {
    setError(null)
    setSaving(true)
    try {
      await api(path, { method: 'POST', body: JSON.stringify(form) })
      setOpen(false)
      load()
    } catch (reason) {
      setError(reason)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page title={title} action={<Button onClick={() => setOpen(true)}>Add</Button>}>
      <Alert error={error ? messageOf(error) : ''} />
      <Table headers={['Name', 'City', 'Phone']} loading={loading}>
        {rows.map(row => <tr key={row.id} className="border-t border-slate-200"><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.city}</td><td className="px-3 py-2">{row.phone}</td></tr>)}
      </Table>
      <Drawer title={`Add ${kind}`} open={open} onClose={() => setOpen(false)}>
        <BusyForm busy={saving} onSubmit={save}>
          <Field label="Name" error={fieldError(error, 'name')}><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="Contact person" error={fieldError(error, 'contactPerson')}><input className={inputClass} value={form.contactPerson} onChange={event => setForm({ ...form, contactPerson: event.target.value })} /></Field>
          <Field label="Phone" error={fieldError(error, 'phone')}><input className={inputClass} placeholder="0300-1234567" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="Email" error={fieldError(error, 'email')}><input className={inputClass} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="City" error={fieldError(error, 'city')}>
            <input className={inputClass} list="party-cities" value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} />
            <datalist id="party-cities">{PAKISTAN_CITIES.map(city => <option key={city} value={city} />)}</datalist>
          </Field>
          <Field label="Tax number" error={fieldError(error, 'taxNumber')}><input className={inputClass} placeholder="1234567-8" value={form.taxNumber} onChange={event => setForm({ ...form, taxNumber: event.target.value })} /></Field>
          <Field label="Address" error={fieldError(error, 'address')}><input className={inputClass} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></Field>
          <Button type="submit" busy={saving}>Save</Button>
        </BusyForm>
      </Drawer>
    </Page>
  )
}
