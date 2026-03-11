import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Loader2, CheckCircle } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'

export default function NewSession() {
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState([])
  const [form, setForm] = useState({ classroom: '', date: new Date().toISOString().split('T')[0] })
  const [session, setSession] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pollingRef = useRef(null)

  useEffect(() => {
    api.get('/classrooms/').then(r => setClassrooms(r.data.results || r.data))
    return () => clearInterval(pollingRef.current)
  }, [])

  const createSession = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/attendance/sessions/', {
        classroom: form.classroom,
        date: form.date,
      })
      setSession(res.data)
    } catch (err) {
      setError(err.response?.data?.classroom?.[0] || err.response?.data?.detail || 'Error al crear sesión.')
    } finally {
      setLoading(false)
    }
  }

  const uploadVideo = async () => {
    if (!videoFile || !session) return
    setError('')
    setLoading(true)
    const formData = new FormData()
    formData.append('video', videoFile)
    try {
      await api.post(`/attendance/sessions/${session.id}/upload-video/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setStatus('processing')
      startPolling(session.id)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir video.')
    } finally {
      setLoading(false)
    }
  }

  const startPolling = (sessionId) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/attendance/sessions/${sessionId}/status/`)
        setStatus(res.data.status)
        if (res.data.status === 'completed') {
          clearInterval(pollingRef.current)
          navigate(`/attendance/${sessionId}`)
        } else if (res.data.status === 'error') {
          clearInterval(pollingRef.current)
          setError(res.data.error_message || 'Error en el procesamiento.')
        }
      } catch {}
    }, 3000)
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <PageHeader title="Nueva Sesión de Asistencia" />
      <div className="bg-white rounded-xl border p-6 space-y-6">
        {!session ? (
          <form onSubmit={createSession} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Grupo</label>
              <select
                value={form.classroom}
                onChange={(e) => setForm(f => ({ ...f, classroom: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                required
              >
                <option value="">Seleccionar grupo...</option>
                {classrooms.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Creando...' : 'Crear Sesión'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle size={18} className="text-green-600 shrink-0" />
              <p className="text-green-800 font-medium text-sm">Sesión creada correctamente (ID: {session.id})</p>
            </div>

            {status === 'processing' ? (
              <div className="text-center space-y-4 py-6">
                <div className="flex justify-center">
                  <Loader2 size={40} className="text-blue-500 animate-spin" />
                </div>
                <p className="font-semibold text-gray-700">Procesando asistencia...</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="h-1.5 bg-blue-500 rounded-full animate-pulse w-3/4" />
                </div>
                <p className="text-sm text-gray-500">Esto puede tardar varios minutos según la duración del video</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Video de clase</label>
                  <input
                    type="file"
                    accept=".mp4,.avi,.mov,.mkv"
                    onChange={(e) => setVideoFile(e.target.files[0])}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">Formatos: MP4, AVI, MOV, MKV — Máx 500MB</p>
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  onClick={uploadVideo}
                  disabled={!videoFile || loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Upload size={15} />
                  {loading ? 'Subiendo...' : 'Subir Video y Procesar'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
