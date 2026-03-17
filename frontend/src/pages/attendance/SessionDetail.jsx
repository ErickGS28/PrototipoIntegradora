import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, CheckCircle, XCircle, ClipboardList, ExternalLink } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'

export default function SessionDetail() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/attendance/sessions/${id}/`)
      setSession(res.data)
      setRecords(res.data.records || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar la sesión.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        <Link to="/attendance" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
          <ChevronLeft size={14} /> Volver a sesiones
        </Link>
      </div>
    )
  }

  const presentCount = records.filter(r => r.is_present).length
  const totalCount = records.length
  const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-3 flex items-center gap-1 text-sm text-gray-400">
        <Link to="/attendance" className="hover:text-blue-600 transition-colors">Asistencia</Link>
        <ChevronLeft size={12} className="rotate-180" />
        {session?.classroom && (
          <>
            <Link to={`/attendance/classroom/${session.classroom}`} className="hover:text-blue-600 transition-colors">
              {session.classroom_name || `Grupo ${session.classroom}`}
            </Link>
            <ChevronLeft size={12} className="rotate-180" />
          </>
        )}
        <span className="text-gray-600">Sesión</span>
      </div>

      <PageHeader
        title={`Sesión del ${session?.date}`}
        subtitle={session?.classroom_name || `Grupo ${session?.classroom}`}
        action={
          session?.status === 'completed' && (
            <a
              href={`http://localhost:8000/api/reports/attendance/?session_id=${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <ExternalLink size={15} /> Ver Reporte
            </a>
          )
        }
      />

      {/* Session Info */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Grupo</p>
          <p className="text-base font-bold text-gray-900 mt-1">
            {session?.classroom_name || `Grupo ${session?.classroom}`}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</p>
          <p className="text-base font-bold text-gray-900 mt-1">{session?.date}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</p>
          <div className="mt-2">
            <StatusBadge status={session?.status} />
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Presentes</p>
          <p className="text-base font-bold mt-1">
            <span className="text-green-600">{presentCount}</span>
            <span className="text-gray-400"> / {totalCount}</span>
          </p>
        </div>
      </div>

      {/* Attendance Bar */}
      {totalCount > 0 && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Resumen de asistencia</p>
            <p className="text-sm text-gray-500">
              {presentCount} presentes — {totalCount - presentCount} ausentes
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="h-2.5 bg-green-500 rounded-full transition-all"
              style={{ width: `${attendancePct}%` }}
            />
          </div>
          <p className="text-xs text-green-600 font-medium mt-1.5">{attendancePct}% de asistencia</p>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Registro de Asistencia</h2>
        </div>
        {records.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">Sin registros de asistencia</p>
            {session?.status === 'pending' && (
              <p className="text-sm mt-2 text-gray-400">Sube un video para procesar la asistencia automáticamente</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alumno</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matrícula</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asistencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(record => (
                  <tr key={record.id} className={`hover:bg-gray-50 ${!record.is_present ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {record.student_name || record.student?.name || '—'}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600 text-xs">
                      {record.student_matricula || record.student?.matricula || '—'}
                    </td>
                    <td className="px-6 py-4">
                      {record.is_present ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle size={12} /> Presente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle size={12} /> Ausente
                        </span>
                      )}
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
