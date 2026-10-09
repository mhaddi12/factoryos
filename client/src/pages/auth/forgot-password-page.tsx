import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Alert, Button, Field, inputClass, messageOf } from '../../components/ui'
import { AuthCard } from './auth-card'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [resetUrl, setResetUrl] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    try {
      const data = await api<{ devResetUrl?: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
      setMessage('If that email has an account, you can reset the password.')
      setResetUrl(data.devResetUrl || '')
    } catch (reason) {
      setError(messageOf(reason))
    }
  }

  return (
    <AuthCard title="Reset password">
      <Alert error={error} />
      {message ? <p className="mb-4 text-sm text-emerald-300">{message}</p> : null}
      <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <Field label="Email"><input className={inputClass} type="email" value={email} onChange={event => setEmail(event.target.value)} required /></Field>
        <Button type="submit">Continue</Button>
      </form>
      {resetUrl ? <p className="mt-4 text-sm"><Link to={resetUrl}>Open the reset link</Link></p> : null}
    </AuthCard>
  )
}
