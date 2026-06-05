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

function getInitialUser() {
  return getBypassUser()
}

function getInitialToken() {
  return LOGIN_BYPASS_ENABLED ? 'dev-bypass-token' : ''
}

export function useAuth() {
  const context = useContext(Auth)
  if (!context) {
    throw new Error('useAuth must be used within AuthContext')
  }

  return context
}

export default function AuthContext({ children }: { children: React.ReactNode }) {
  const initialUser = getInitialUser()
  const [currentUser, setCurrentUserState] = useState<AuthUser | null>(initialUser)
  const [access_token, setAccessTokenState] = useState(getInitialToken)
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(initialUser))
  const [loading] = useState(false)

  const setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser | null>> = (value) => {
    setCurrentUserState((previous) => {
      const nextValue = typeof value === 'function' ? value(previous) : value

      if (nextValue) {
        const normalizedUser = {
          ...nextValue,
          sessionuid: nextValue.sessionuid || uuidv4()
        }
        setIsAuthenticated(true)
        return normalizedUser
      }

      setIsAuthenticated(false)
      return null
    })
  }

  const setaccess_token: React.Dispatch<React.SetStateAction<string>> = (value) => {
    setAccessTokenState((previous) => (typeof value === 'function' ? value(previous) : value))
  }

  useEffect(() => {
    if (!currentUser) {
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
