import { useCallback, useEffect, useState } from 'react'
import { Copy, KeyRound, UserCheck, UserPlus, UserX } from 'lucide-react'
import { api } from '../api'
import { ROLE_HELP, ROLE_LABEL, useUser } from '../auth'
import { initials } from '../derive'
import { fmtWhen } from '../format'
import { useStore } from '../store'
import type { User, UserRole } from '../types'
import { Badge, Button, Modal } from '../components/ui'

const ROLES: UserRole[] = ['admin', 'estimator', 'viewer']

/** Admin only: who can sign in to Favon and what they may do. */
export function Users() {
  const me = useUser()
  const notify = useStore((s) => s.notify)
  const [list, setList] = useState<User[] | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [secret, setSecret] = useState<{ user: User; password: string; reset: boolean } | null>(null)

  const load = useCallback(() => {
    api.users().then(setList).catch((err) => setError((err as Error).message))
  }, [])
  useEffect(load, [load])

  const change = async (u: User, body: Partial<Pick<User, 'name' | 'email' | 'role' | 'active'>>, done: string) => {
    setError('')
    try {
      await api.updateUser(u.id, body)
      notify(done)
      load()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    }
  }
  const reset = async (u: User) => {
    if (!confirm(`Reset the password of ${u.name}? They are signed out and get a temporary password.`)) return
    try {
      const r = await api.resetPassword(u.id)
      setSecret({ user: r.user, password: r.temporary_password, reset: true })
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const active = list?.filter((u) => u.active).length ?? 0
  return (
    <div className="users-page">
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Users</h2>
            <p className="muted">
              {list ? `${active} active of ${list.length}` : 'Loading…'} · everyone signs notes, approvals and the activity with their own name
            </p>
          </div>
          <Button primary onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Add user
          </Button>
        </div>
        {error && (
          <div className="notice" role="alert">
            {error}
          </div>
        )}
        <div className="table-scroll">
          <table className="position-table users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list?.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'inactive'} onClick={() => setEditing(u)}>
                  <td>
                    <span className="inline">
                      <span className="avatar tiny">{initials(u.name)}</span>
                      <strong>{u.name}</strong>
                      {u.id === me.id && <span className="muted">(you)</span>}
                    </span>
                  </td>
                  <td>{u.email}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className="role-select"
                      aria-label={`Role of ${u.name}`}
                      value={u.role}
                      title={ROLE_HELP[u.role]}
                      onChange={(e) => change(u, { role: e.target.value as UserRole }, `${u.name} is now ${ROLE_LABEL[e.target.value as UserRole]}.`)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {!u.active ? (
                      <Badge tone="neutral">Deactivated</Badge>
                    ) : u.must_change_password ? (
                      <Badge tone="warning" title="Signs in with a temporary password and picks their own">
                        Invited
                      </Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </td>
                  <td>{u.last_login_at ? fmtWhen(u.last_login_at) : 'Never'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <span className="inline users-actions">
                      <Button className="small" title="New temporary password" onClick={() => reset(u)}>
                        <KeyRound size={14} /> Reset password
                      </Button>
                      {u.active ? (
                        <Button
                          className="small"
                          disabled={u.id === me.id}
                          title={u.id === me.id ? "You can't deactivate yourself" : 'Signs them out; they can no longer sign in'}
                          onClick={() => change(u, { active: false }, `${u.name} deactivated.`)}
                        >
                          <UserX size={14} /> Deactivate
                        </Button>
                      ) : (
                        <Button className="small" onClick={() => change(u, { active: true }, `${u.name} can sign in again.`)}>
                          <UserCheck size={14} /> Activate
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="role-legend">
          {ROLES.map((r) => (
            <div key={r}>
              <dt>{ROLE_LABEL[r]}</dt>
              <dd className="muted">{ROLE_HELP[r]}</dd>
            </div>
          ))}
        </dl>
      </section>
      {adding && (
        <Modal title="Add user" close={() => setAdding(false)}>
          <UserForm
            onCancel={() => setAdding(false)}
            onSave={async (body) => {
              const r = await api.addUser(body)
              setAdding(false)
              load()
              if (r.temporary_password) setSecret({ user: r.user, password: r.temporary_password, reset: false })
              else notify(`${r.user.name} added. They choose a new password at the first sign-in.`)
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit user" close={() => setEditing(null)}>
          <UserForm
            user={editing}
            onCancel={() => setEditing(null)}
            onSave={async (body) => {
              await api.updateUser(editing.id, { name: body.name, email: body.email, role: body.role })
              setEditing(null)
              notify('User saved.')
              load()
            }}
          />
        </Modal>
      )}
      {secret && (
        <Modal title={secret.reset ? 'Password reset' : 'User added'} close={() => setSecret(null)}>
          <p>
            Give {secret.user.name} this temporary password. It is shown only now; at the first sign-in with{' '}
            <strong>{secret.user.email}</strong> they choose their own.
          </p>
          <div className="temp-password">
            <code>{secret.password}</code>
            <Button
              className="small"
              onClick={() => {
                navigator.clipboard?.writeText(secret.password).then(() => notify('Password copied.'), () => {})
              }}
            >
              <Copy size={14} /> Copy
            </Button>
          </div>
          <div className="modal-actions">
            <Button primary onClick={() => setSecret(null)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function UserForm({
  user,
  onSave,
  onCancel,
}: {
  user?: User
  onSave: (body: { name: string; email: string; role: UserRole; password?: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'estimator')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="meta-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          await onSave({ name, email, role, password: password || undefined })
        } catch (err) {
          setError((err as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      <label>
        <span>Name (signs notes, approvals and the activity)</span>
        <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        <span>Email (used to sign in)</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        <span>Role</span>
        <select className="role-select" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}: {ROLE_HELP[r].toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      {!user && (
        <label>
          <span>Password (optional; leave empty for a temporary one)</span>
          <input type="text" autoComplete="off" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      )}
      <div className="modal-actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button primary type="submit" disabled={busy || !name || !email}>
          {busy ? 'Saving…' : user ? 'Save user' : 'Add user'}
        </Button>
      </div>
    </form>
  )
}
