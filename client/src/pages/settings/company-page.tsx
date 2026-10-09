import { useEffect, useState } from 'react'
import { PAKISTAN_CITIES } from '@shared/domain/pakistan'
import type { CompanyProfile } from '@shared/types/records'
import { useSession } from '../../auth/session'
import { api, fieldError } from '../../lib/api'
import { Alert, Button, Field, Page, inputClass, messageOf, panelClass } from '../../components/ui'

export function CompanyPage() {
  const { user, refresh } = useSession()
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '' })
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    api<CompanyProfile>('/api/company').then(company => setForm({ name: company.name, email: company.email || '', phone: company.phone || '', address: company.address || '', city: company.city || '' })).catch(reason => setError(reason))
  }, [])
  async function save() {
    setError(null)
    try {
      await api('/api/company', { method: 'PATCH', body: JSON.stringify(form) })
      await refresh()
    } catch (reason) {
      setError(reason)
    }
  }
  return (
    <Page title="Company">
      <p className="mb-4 text-sm text-slate-500">{user?.company.currency}</p>
      <form className={`${panelClass} max-w-lg`} onSubmit={(event) => { event.preventDefault(); void save() }}>
        <Alert error={error ? messageOf(error) : ''} />
        <Field label="Name" error={fieldError(error, 'name')}><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Email" error={fieldError(error, 'email')}><input className={inputClass} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Phone" error={fieldError(error, 'phone')}><input className={inputClass} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field>
        <Field label="City" error={fieldError(error, 'city')}><input className={inputClass} list="company-cities" value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /><datalist id="company-cities">{PAKISTAN_CITIES.map(city => <option key={city} value={city} />)}</datalist></Field>
        <Field label="Address" error={fieldError(error, 'address')}><input className={inputClass} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></Field>
        <Button type="submit">Save</Button>
      </form>
    </Page>
  )
}
