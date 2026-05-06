import React, { createContext, useContext } from 'react'
import { useAuth } from './AuthContext'

type DataUser = {
  userid?: string
  id?: string
  sessionuid?: string
  name?: string
  email?: string
  role?: string
  clientId?: string
  meetingId?: string
}

type DataContextValue = {
  ws: WebSocket | null
  setWs: React.Dispatch<React.SetStateAction<WebSocket | null>>
  wsRef: React.MutableRefObject<WebSocket | null>
  authServerUrl: string
  setUserData: React.Dispatch<React.SetStateAction<DataUser | null>>
  setaccess_token: React.Dispatch<React.SetStateAction<string>>
}

const DataContext = createContext<DataContextValue | null>(null)

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within DataWrapper')
  }

  return context
}

export function DataWrapper({ children }: { children: React.ReactNode }) {
  const [ws, setWs] = React.useState<WebSocket | null>(null)
  const wsRef = React.useRef<WebSocket | null>(null)
  const authServerUrl = 'http://localhost:5000'
  const { setCurrentUser, setaccess_token } = useAuth()

  const values = {
    ws,
    setWs,
    wsRef,
    authServerUrl,
    setUserData: setCurrentUser,
    setaccess_token
  }

  return <DataContext.Provider value={values}>{children}</DataContext.Provider>
}
