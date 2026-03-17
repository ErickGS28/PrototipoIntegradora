import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import api, { setTokens, clearTokens, getStoredRefresh } from '../api/axios'
import axios from 'axios'

const BASE_URL = 'http://localhost:8000/api'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)  // true until session is restored

  // On mount: try to restore session from sessionStorage refresh token
  useEffect(() => {
    const refresh = getStoredRefresh()
    if (!refresh) {
      setLoading(false)
      return
    }

    axios.post(`${BASE_URL}/auth/refresh/`, { refresh })
      .then(({ data }) => {
        setTokens(data.access, refresh)
        return api.get('/auth/me/')
      })
      .then(({ data }) => setUser(data))
      .catch(() => clearTokens())
      .finally(() => setLoading(false))
  }, [])

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
