import { useEffect } from 'react'
import App from './App'
import { useAuth } from './auth'
import { PasswordForm, SignIn } from './pages/SignIn'

/** The app only opens for a signed-in user who has their own password. */
export function Gate() {
  const { user, checked, check } = useAuth()
  useEffect(() => {
    check()
  }, [check])
  if (!checked)
    return (
      <div className="loading-state">
        <span className="spinner" /> Connecting to the pricing API…
      </div>
    )
  if (!user) return <SignIn />
  if (user.must_change_password) return <PasswordForm forced />
  // keyed by user: signing in as someone else starts from a fresh app
  return <App key={user.id} />
}
