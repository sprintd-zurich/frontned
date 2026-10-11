import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight, LockKeyhole } from 'lucide-react'
import { useAuth } from '../auth'
import { Button } from '../components/ui'

function AuthCard({ title, intro, error, children, onSubmit }: { title: string; intro: string; error: string; children: ReactNode; onSubmit: (e: FormEvent) => void }) {
  return (
    <div className="auth-page">
      <div className="auth-brand">FAVON</div>
      <form className="card auth-card meta-form" onSubmit={onSubmit}>
        <div className="section-heading">
          <h2>{title}</h2>
          <LockKeyhole size={20} color="#607398" />
        </div>
        <p className="muted">{intro}</p>
        {error && (
          <div className="notice" role="alert">
            <AlertTriangle size={15} /> {error}
          </div>
        )}
        {children}
      </form>
      <p className="auth-foot muted">From tender to a first price you can defend</p>
    </div>
  )
}

/** Shown to everyone who isn't signed in; accounts are created by an administrator on the Users page. */
export function SignIn() {
  const { login, offline } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <AuthCard
      title="Sign in"
      intro="Use the account your administrator set up for you."
      error={error || (offline ? `Cannot reach the pricing API: ${offline}` : '')}
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          await login(email, password)
        } catch (err) {
          setError((err as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        <span>Email</span>
        <input type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        <span>Password</span>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <Button primary type="submit" disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
      </Button>
    </AuthCard>
  )
}

/** The new password form: forced after a temporary password, or opened from the account menu. */
export function PasswordForm({ forced = false, onDone }: { forced?: boolean; onDone?: () => void }) {
  const { changePassword, logout } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== repeat) return setError('The two new passwords are not the same')
    setBusy(true)
    setError('')
    try {
      await changePassword(current, next)
      onDone?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const fields = (
    <>
      <label>
        <span>{forced ? 'Temporary password' : 'Current password'}</span>
        <input type="password" autoComplete="current-password" autoFocus required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label>
        <span>New password (at least 8 characters)</span>
        <input type="password" autoComplete="new-password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label>
        <span>New password again</span>
        <input type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </label>
    </>
  )
  if (forced)
    return (
      <AuthCard title="Choose your password" intro="You signed in with a temporary password. Pick your own to continue." error={error} onSubmit={submit}>
        {fields}
        <Button primary type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save and continue'} <ArrowRight size={16} />
        </Button>
        <Button onClick={logout}>Sign out</Button>
      </AuthCard>
    )
  return (
    <form className="meta-form" onSubmit={submit}>
      {error && (
        <div className="notice" role="alert">
          <AlertTriangle size={15} /> {error}
        </div>
      )}
      {fields}
      <div className="modal-actions">
        <Button onClick={() => onDone?.()}>Cancel</Button>
        <Button primary type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
