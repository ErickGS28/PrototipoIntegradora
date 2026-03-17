import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Plus, ClipboardList, Upload, ArrowRight } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'

export default function ClassroomSessions() {
  const { classroomId } = useParams()
  const [sessions, setSessions] = useState([])
  const [classroomName, setClassroomName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadingId, setUploadingId] = useState(null)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    fetchSessions()
  }, [classroomId])

  const fetchSessions = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/attendance/sessions/')
      const all = res.data.results || res.data
      const filtered = all
        .filter(s => String(s.classroom) === String(classroomId))
        .sort((a, b) => b.date.localeCompare(a.date))
      setSessions(filtered)
      if (filtered.length > 0) {
        setClassroomName(filtered[0].classroom_name || `Grupo ${classroomId}`)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar sesiones.')
    } finally {
      setLoading(false)
    }
  }

  const handleVideoUpload = async (sessionId, file) => {
    if (!file) return
    setUploadError('')
    setUploadingId(sessionId)
    const formData = new FormData()
    formData.append('video', file)
    try {
      await api.post(`/attendance/sessions/${sessionId}/upload-video/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      fetchSessions()
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Error al subir video.')
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-3">
        <Link to="/attendance" className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 w-fit">
          <ChevronLeft size={14} /> Asistencia
        </Link>
      </div>

      <PageHeader
        title={classroomName || `Grupo ${classroomId}`}
        subtitle="Sesiones de asistencia ordenadas por fecha"
        action={
          <Link
            to="/attendance/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <Plus size={15} /> Nueva Sesión
          </Link>
        }
      />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {uploadError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {uploadError}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <ClipboardList size={32} className="mx-auto mb-3 animate-pulse opacity-40" />
            <p className="text-sm">Cargando sesiones...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList size={40} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-600 mb-1">Sin sesiones para este grupo</p>
            <p className="text-sm text-gray-400 mb-6">Crea una nueva sesión de asistencia</p>
            <Link
              to="/attendance/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <Plus size={14} /> Nueva Sesión
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asistencia</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map(session => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{session.date}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {session.status === 'completed' && session.present_count !== undefined ? (
                        <span className="font-medium">
                          {session.present_count}
                          <span className="text-gray-400 font-normal"> / {session.total_students} presentes</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/attendance/${session.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium px-2.5 py-1.5 rounded hover:bg-blue-50 transition-colors"
                        >
                          Ver <ArrowRight size={12} />
                        </Link>
                        {session.status === 'pending' && (
                          <label className="inline-flex items-center gap-1 cursor-pointer text-green-600 hover:text-green-800 text-xs font-medium px-2.5 py-1.5 rounded hover:bg-green-50 transition-colors border border-green-200">
                            <Upload size={12} />
                            {uploadingId === session.id ? 'Subiendo...' : 'Video'}
                            <input
                              type="file"
                              accept=".mp4,.avi,.mov,.mkv"
                              className="hidden"
                              disabled={uploadingId === session.id}
                              onChange={e => {
                                if (e.target.files[0]) handleVideoUpload(session.id, e.target.files[0])
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
