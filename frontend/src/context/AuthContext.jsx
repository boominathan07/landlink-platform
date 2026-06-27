import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authApi } from '../services/api'
import { auth } from '../firebase/config'
import { signOut } from 'firebase/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('landlink_user'))
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  const login = useCallback((token, userData) => {
    localStorage.setItem('landlink_token', token)
    localStorage.setItem('landlink_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('landlink_token')
    localStorage.removeItem('landlink_user')
    setUser(null)
    signOut(auth).catch(console.error)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.me()
      setUser(data.user)
      localStorage.setItem('landlink_user', JSON.stringify(data.user))
    } catch {
      logout()
    }
  }, [logout])

  useEffect(() => {
    const token = localStorage.getItem('landlink_token')
    if (!token) {
      setLoading(false)
      return
    }
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
