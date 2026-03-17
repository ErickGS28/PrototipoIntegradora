import axios from 'axios'

const BASE_URL = 'http://localhost:8000/api'

// Access token stays in memory (XSS protection).
// Refresh token goes to sessionStorage so page reloads don't kill the session.
let accessToken = null
let isRefreshing = false
let failedQueue = []

export function setTokens(access, refresh) {
  accessToken = access
  if (refresh) sessionStorage.setItem('rt', refresh)
}

export function clearTokens() {
  accessToken = null
  sessionStorage.removeItem('rt')
}

export function getAccessToken() {
  return accessToken
}

export function getStoredRefresh() {
  return sessionStorage.getItem('rt')
}

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: attach access token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Response interceptor: auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const storedRefresh = getStoredRefresh()

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (!storedRefresh) {
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh/`, {
          refresh: storedRefresh,
        })
        const newAccess = response.data.access
        accessToken = newAccess
        processQueue(null, newAccess)
        originalRequest.headers['Authorization'] = `Bearer ${newAccess}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default api
