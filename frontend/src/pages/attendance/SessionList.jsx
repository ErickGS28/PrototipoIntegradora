import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ClipboardList, ArrowRight, Users, Calendar } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'

export default function SessionList() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/attendance/sessions/')
      .then(res => setSessions(res.data.results || res.data))
      .catch(err => setError(err.response?.data?.detail || 'Error al cargar sesiones.'))
      .finally(() => setLoading(false))
  }, [])

  // Group sessions by classroom
  const groupsByClassroom = sessions.reduce((acc, s) => {
    const key = s.classroom
    if (!acc[key]) {
      acc[key] = {
        classroom_id: s.classroom,
        classroom_name: s.classroom_name || `Grupo ${s.classroom}`,
        sessions: [],
      }
    }
    acc[key].sessions.push(s)
    return acc
  }, {})

  const groups = Object.values(groupsByClassroom).sort((a, b) =>
    a.classroom_name.localeCompare(b.classroom_name)
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Asistencia"
        subtitle="Sesiones por grupo"
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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-6" />
              <div className="h-8 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <ClipboardList size={40} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-600 mb-1">Sin sesiones registradas</p>
          <p className="text-sm text-gray-400 mb-6">Crea tu primera sesión de asistencia</p>
          <Link
            to="/attendance/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <Plus size={14} /> Nueva Sesión
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => {
            const total = group.sessions.length
            const completed = group.sessions.filter(s => s.status === 'completed').length
            const latest = group.sessions
              .map(s => s.date)
              .sort((a, b) => b.localeCompare(a))[0]

            return (
              <Link
                key={group.classroom_id}
                to={`/attendance/classroom/${group.classroom_id}`}
                className="bg-white rounded-xl border p-5 hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-blue-50 p-2.5 rounded-lg">
                    <Users size={18} className="text-blue-600" />
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors mt-1" />
                </div>

                <h3 className="font-semibold text-gray-900 text-base mb-1">{group.classroom_name}</h3>

                <div className="flex items-center gap-1 text-xs text-gray-400 mb-4">
                  <Calendar size={12} />
                  <span>Última sesión: {latest || '—'}</span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-800">{total}</span> sesiones
                  </span>
                  <span className="text-xs text-gray-500">
                    <span className="font-semibold text-green-600">{completed}</span> completadas
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
