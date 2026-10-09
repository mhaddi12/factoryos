import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SessionUser } from '@shared/types/auth'
import { useSession } from '../../auth/session'
import { api } from '../../lib/api'
import { Alert, Button, Field, inputClass, messageOf } from '../../components/ui'
import { AuthCard } from './auth-card'

export function LoginPage() {
  const { setUser } = useSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    try {
      const data = await api<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setUser(data.user)
      navigate('/dashboard')
    } catch (reason) {
      setError(messageOf(reason))
    }
  }

  return (
    <AuthCard title="Sign in">
      <Alert error={error} />
      <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <Field label="Email"><input className={inputClass} type="email" value={email} onChange={event => setEmail(event.target.value)} required /></Field>
        <Field label="Password"><input className={inputClass} type="password" value={password} onChange={event => setPassword(event.target.value)} required /></Field>
        <Button type="submit">Sign in</Button>
      </form>
      <p className="mt-4 text-sm text-slate-500"><Link to="/forgot-password">Forgot password</Link> · <Link to="/register">Create a company</Link></p>
    </AuthCard>
  )
}
