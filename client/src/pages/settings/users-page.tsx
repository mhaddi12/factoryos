import { useEffect, useState } from 'react'
import { USER_ROLES } from '@shared/auth/permissions'
import { ROLE_LABELS } from '@shared/navigation'
import type { UserRecord } from '@shared/types/records'
import { api, fieldError } from '../../lib/api'
import { Alert, BusyForm, Button, Drawer, Field, Page, Table, inputClass, messageOf } from '../../components/ui'

export function UsersPage() {
  const [rows, setRows] = useState<UserRecord[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'STORE_KEEPER', password: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  function load() {
    setLoading(true)
    api<UserRecord[]>('/api/users').then(setRows).catch(reason => setError(reason)).finally(() => setLoading(false))
  }
  useEffect(load, [])
  async function save() {
    setError(null)
    setSaving(true)
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(form) })
      setOpen(false)
      load()
    } catch (reason) {
      setError(reason)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Page title="Users" action={<Button onClick={() => setOpen(true)}>Add</Button>}>
      <Alert error={error ? messageOf(error) : ''} />
      <Table headers={['Name', 'Email', 'Role', 'Active']} loading={loading}>{rows.map(row => <tr key={row.id} className="border-t border-slate-200"><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{ROLE_LABELS[row.role as keyof typeof ROLE_LABELS]}</td><td className="px-3 py-2">{row.isActive ? 'Yes' : 'No'}</td></tr>)}</Table>
      <Drawer title="Add user" open={open} onClose={() => setOpen(false)}>
        <BusyForm busy={saving} onSubmit={save}>
          <Field label="Name" error={fieldError(error, 'name')}><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Email" error={fieldError(error, 'email')}><input className={inputClass} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Phone" error={fieldError(error, 'phone')}><input className={inputClass} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="Role"><select className={inputClass} value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{USER_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></Field>
          <Field label="Password" error={fieldError(error, 'password')}><input className={inputClass} type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></Field>
          <Button type="submit" busy={saving}>Save</Button>
        </BusyForm>
      </Drawer>
    </Page>
  )
}
