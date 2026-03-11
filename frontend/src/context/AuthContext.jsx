import { createContext, useContext, useState, useCallback } from 'react'
import api, { setTokens, clearTokens } from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (username, password) => {
    const response = await api.post('/auth/login/', { username, password })
    const { access, refresh, user: userData } = response.data
    setTokens(access, refresh)
    setUser(userData)
    return userData
  }, [])

  const register = useCallback(async (data) => {
    const response = await api.post('/auth/register/', data)
    const { access, refresh, user: userData } = response.data
    setTokens(access, refresh)
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
