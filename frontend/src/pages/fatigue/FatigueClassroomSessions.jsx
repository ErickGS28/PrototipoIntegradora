import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Plus, BrainCircuit, ArrowRight } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'

export default function FatigueClassroomSessions() {
  const { classroomId } = useParams()
  const [sessions, setSessions] = useState([])
  const [classroomName, setClassroomName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/fatigue/', { params: { classroom_id: classroomId } })
      .then(res => {
        const data = (res.data.results || res.data).sort((a, b) => b.date.localeCompare(a.date))
        setSessions(data)
        if (data.length > 0) setClassroomName(data[0].classroom_name || `Grupo ${classroomId}`)
      })
      .catch(err => setError(err.response?.data?.detail || 'Error al cargar sesiones.'))
      .finally(() => setLoading(false))
  }, [classroomId])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-3">
        <Link to="/fatigue" className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 w-fit">
          <ChevronLeft size={14} /> Fatiga y Atención
        </Link>
      </div>

      <PageHeader
        title={classroomName || `Grupo ${classroomId}`}
        subtitle="Sesiones de análisis ordenadas por fecha"
        action={
          <Link
            to="/fatigue/new"
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

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <BrainCircuit size={32} className="mx-auto mb-3 animate-pulse opacity-40" />
            <p className="text-sm">Cargando sesiones...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <BrainCircuit size={40} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-600 mb-1">Sin sesiones para este grupo</p>
            <Link
              to="/fatigue/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm mt-4"
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alumnos detectados</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{s.date}</td>
                    <td className="px-6 py-4"><StatusBadge status={s.status} /></td>
                    <td className="px-6 py-4 text-gray-600">
                      {s.status === 'completed' && s.present_count !== undefined ? (
                        <span className="font-medium">
                          {s.present_count}
                          <span className="text-gray-400 font-normal"> / {s.total_students}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/fatigue/${s.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium px-2.5 py-1.5 rounded hover:bg-blue-50 transition-colors"
                      >
                        Ver <ArrowRight size={12} />
                      </Link>
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
