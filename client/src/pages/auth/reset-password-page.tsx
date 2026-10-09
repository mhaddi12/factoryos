import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, api, fieldError } from '../../lib/api'
import { Alert, Button, Field, inputClass } from '../../components/ui'
import { AuthCard } from './auth-card'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<unknown>(null)
  const token = params.get('token') || ''
  const alert = error instanceof ApiError && Object.keys(error.errors).length === 0 ? error.message : error instanceof Error && !(error instanceof ApiError) ? error.message : ''

  async function submit() {
    setError(null)
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password, confirmPassword }) })
      setMessage('Password updated. Sign in with the new password.')
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <AuthCard title="Choose a new password">
      <Alert error={alert} />
      {message ? <p className="text-sm text-emerald-300">{message} <Link to="/login">Sign in</Link></p> : (
        <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <Field label="New password" error={fieldError(error, 'password')}><input className={inputClass} type="password" value={password} onChange={event => setPassword(event.target.value)} required /></Field>
          <Field label="Confirm password" error={fieldError(error, 'confirmPassword')}><input className={inputClass} type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></Field>
          <Button type="submit">Update password</Button>
        </form>
      )}
    </AuthCard>
  )
}
