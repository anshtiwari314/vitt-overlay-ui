import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Lock, Mail, MonitorSmartphone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useAuth } from '../context/AuthContext'
import './Login2.css'

type LoginResponse = {
  success: boolean
  message: string
  clientId?: string
  name?: string
  email?: string
  meetingId?: string
}

export default function LoginDemo() {
  const navigate = useNavigate()
  const { setCurrentUser, setaccess_token } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('http://https://16b5-2401-4900-8828-9ca4-20b1-5cc2-2aad-9c01.ngrok-free.app/login-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      })

      const data = (await response.json()) as LoginResponse

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Login failed')
      }

      const sessionuid = uuidv4()

      const normalizedUser = {
        userid: data.clientId || email.trim(),
        id: data.clientId || email.trim(),
        sessionuid,
        name: data.name || 'Demo User',
        email: data.email || email.trim(),
        role: 'Demo Login',
        clientId: data.clientId || '',
        meetingId: data.meetingId || ''
      }

      setCurrentUser(normalizedUser)
      setaccess_token(`demo-session-${data.clientId || 'active'}`)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-demo-shell">
      <div className="login-demo-layout">
        <section className="login-demo-copy">
          <div className="login-demo-chip">
            <MonitorSmartphone className="login-demo-chip-icon" />
            Demo login flow
          </div>

          <div className="login-demo-copy-block">
            <h1>Sign in with the local Flask demo endpoint.</h1>
            <p>
              This page posts directly to <code>http://localhost:5000/login-post</code> and opens the same overlay
              app after a successful response.
            </p>
          </div>

          <div className="login-demo-info-grid">
            <div className="login-demo-info-card">
              <p className="login-demo-info-title">Endpoint</p>
              <p className="login-demo-info-text">
                <code>POST /login-post</code> on localhost:5000
              </p>
            </div>
            <div className="login-demo-info-card">
              <p className="login-demo-info-title">Session behavior</p>
              <p className="login-demo-info-text">Stores the login locally so the protected overlay route keeps working.</p>
            </div>
          </div>
        </section>

        <section className="login-demo-form-wrap">
          <div className="login-demo-card">
            <div className="login-demo-card-head">
              <p className="login-demo-eyebrow">Portal Access</p>
              <h2>Demo Sign In</h2>
              <p className="login-demo-subtitle">Use the email and password configured in your backend snippet.</p>
            </div>

            <form onSubmit={handleSubmit} className="login-demo-form">
              <label className="login-demo-field">
                <span>Email</span>
                <div className="login-demo-input-wrap">
                  <Mail className="login-demo-input-icon" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="demo@company.com"
                    required
                  />
                </div>
              </label>

              <label className="login-demo-field">
                <span>Password</span>
                <div className="login-demo-input-wrap">
                  <Lock className="login-demo-input-icon" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </label>

              {error ? <div className="login-demo-error">{error}</div> : null}

              <button type="submit" disabled={isLoading} className="login-demo-submit">
                <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
                {!isLoading ? <ArrowRight className="login-demo-submit-icon" /> : null}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
