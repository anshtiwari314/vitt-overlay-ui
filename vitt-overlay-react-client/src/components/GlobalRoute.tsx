import type React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function GlobalRoute({ component }: { component: React.ReactNode }) {
  const { currentUser } = useAuth()

  if (currentUser === null) {
    return component
  }

  return <Navigate to="/app" replace />
}
