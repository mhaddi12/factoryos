import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PAKISTAN_CITIES } from '@shared/domain/pakistan'
import type { SessionUser } from '@shared/types/auth'
import { useSession } from '../../auth/session'
import { ApiError, api, fieldError } from '../../lib/api'
import { Alert, BusyForm, Button, Field, inputClass } from '../../components/ui'
import { AuthCard } from './auth-card'

export function RegisterPage() {
  const { setUser } = useSession()
  const navigate = useNavigate()
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '', confirmPassword: '', phone: '', city: '' })
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      const data = await api<{ user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(form) })
      setUser(data.user)
      navigate('/dashboard')
    } catch (reason) {
      setError(reason)
    } finally {
      setSaving(false)
    }
  }

  const message = error instanceof ApiError && Object.keys(error.errors).length === 0 ? error.message : error instanceof Error && !(error instanceof ApiError) ? error.message : ''

  return (
    <AuthCard title="Create a company">
      <Alert error={message} />
      <BusyForm busy={saving} onSubmit={submit}>
        <Field label="Company" error={fieldError(error, 'companyName')}><input className={inputClass} value={form.companyName} onChange={event => setForm({ ...form, companyName: event.target.value })} required /></Field>
        <Field label="Your name" error={fieldError(error, 'name')}><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></Field>
        <Field label="Email" error={fieldError(error, 'email')}><input className={inputClass} type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /></Field>
        <Field label="Password" error={fieldError(error, 'password')}><input className={inputClass} type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required /></Field>
        <Field label="Confirm password" error={fieldError(error, 'confirmPassword')}><input className={inputClass} type="password" value={form.confirmPassword} onChange={event => setForm({ ...form, confirmPassword: event.target.value })} required /></Field>
        <Field label="Phone" error={fieldError(error, 'phone')}><input className={inputClass} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="0300-1234567" /></Field>
        <Field label="City" error={fieldError(error, 'city')}>
          <input className={inputClass} list="cities" value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} />
          <datalist id="cities">{PAKISTAN_CITIES.map(city => <option key={city} value={city} />)}</datalist>
        </Field>
        <Button type="submit" busy={saving}>Create company</Button>
      </BusyForm>
      <p className="mt-4 text-sm"><Link to="/login">Back to sign in</Link></p>
    </AuthCard>
  )
}
