import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { Alert, Button, Field, inputClass, messageOf } from '../../components/ui'
import { AuthCard } from './auth-card'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const token = params.get('token') || ''

  async function submit() {
    setError('')
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) })
      setMessage('Password updated. Sign in with the new password.')
    } catch (reason) {
      setError(messageOf(reason))
    }
  }

  return (
    <AuthCard title="Choose a new password">
      <Alert error={error} />
      {message ? <p className="text-sm text-emerald-300">{message} <Link to="/login">Sign in</Link></p> : (
        <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <Field label="New password"><input className={inputClass} type="password" value={password} onChange={event => setPassword(event.target.value)} required /></Field>
          <Button type="submit">Update password</Button>
        </form>
      )}
    </AuthCard>
  )
}
