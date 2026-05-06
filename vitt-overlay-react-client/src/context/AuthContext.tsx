import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

type AuthUser = {
  userid?: string
  id?: string
  sessionuid?: string
  name?: string
  email?: string
  role?: string
  clientId?: string
  meetingId?: string
}

type AuthContextValue = {
  currentUser: AuthUser | null
  setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser | null>>
  isAuthenticated: boolean
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>
  access_token: string
  setaccess_token: React.Dispatch<React.SetStateAction<string>>
  loading: boolean
}

const AUTH_STORAGE_KEY = 'vitt-overlay-auth-user'
const TOKEN_STORAGE_KEY = 'vitt-overlay-access-token'
const LOGIN_BYPASS_ENABLED = import.meta.env.VITE_BYPASS_LOGIN === 'true'

const Auth = createContext<AuthContextValue | null>(null)

function getBypassUser() {
  if (!LOGIN_BYPASS_ENABLED) {
    return null
  }

  return {
    userid: 'dev-user',
    id: 'dev-user',
    sessionuid: uuidv4(),
    name: 'Dev User',
    email: 'dev@local.test',
    role: 'Dev Bypass'
  }
}

function readStoredUser() {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!stored) {
    return getBypassUser()
  }

  try {
    const parsed = JSON.parse(stored) as AuthUser
    return {
      ...parsed,
      sessionuid: parsed.sessionuid || parsed.meetingId || uuidv4()
    }
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return getBypassUser()
  }
}

function readStoredToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

export function useAuth() {
  const context = useContext(Auth)
  if (!context) {
    throw new Error('useAuth must be used within AuthContext')
  }

  return context
}

export default function AuthContext({ children }: { children: React.ReactNode }) {
  const initialUser = readStoredUser()
  const [currentUser, setCurrentUserState] = useState<AuthUser | null>(initialUser)
  const [access_token, setAccessTokenState] = useState(() => readStoredToken() || (LOGIN_BYPASS_ENABLED ? 'dev-bypass-token' : ''))
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(initialUser))
  const [loading] = useState(false)

  const setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser | null>> = (value) => {
    setCurrentUserState((previous) => {
      const nextValue = typeof value === 'function' ? value(previous) : value

      if (typeof window !== 'undefined') {
        if (nextValue) {
          const normalizedUser = {
            ...nextValue,
            sessionuid: nextValue.sessionuid || nextValue.meetingId || uuidv4()
          }
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedUser))
          setIsAuthenticated(true)
          return normalizedUser
        }

        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      }

      setIsAuthenticated(false)
      return null
    })
  }

  const setaccess_token: React.Dispatch<React.SetStateAction<string>> = (value) => {
    setAccessTokenState((previous) => {
      const nextValue = typeof value === 'function' ? value(previous) : value

      if (typeof window !== 'undefined') {
        if (nextValue) {
          window.localStorage.setItem(TOKEN_STORAGE_KEY, nextValue)
        } else {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY)
        }
      }

      return nextValue
    })
  }

  useEffect(() => {
    if (!currentUser) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY)
      }
      setAccessTokenState('')
      setIsAuthenticated(false)
      return
    }

    setIsAuthenticated(true)
  }, [currentUser])

  const values = useMemo(
    () => ({
      currentUser,
      setCurrentUser,
      isAuthenticated,
      setIsAuthenticated,
      access_token,
      setaccess_token,
      loading
    }),
    [access_token, currentUser, isAuthenticated, loading]
  )

  return <Auth.Provider value={values}>{children}</Auth.Provider>
}
