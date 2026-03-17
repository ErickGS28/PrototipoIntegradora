import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, BrainCircuit, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'

const LABEL_STYLE = {
  atento:    { bg: 'bg-green-100',  text: 'text-green-800'  },
  fatigado:  { bg: 'bg-red-100',    text: 'text-red-800'    },
  distraido: { bg: 'bg-amber-100',  text: 'text-amber-800'  },
}

function ScoreBar({ score, color }) {
  const pct = Math.min(100, Math.max(0, Math.round(score)))
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-semibold w-10 text-right ${color}`}>{pct}%</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color === 'text-green-600' ? 'bg-green-500' : color === 'text-red-600' ? 'bg-red-500' : 'bg-amber-500'} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function FatigueSessionDetail() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/fatigue/${id}/`)
      .then(res => {
        setSession(res.data)
        setRecords(res.data.records || [])
      })
      .catch(err => setError(err.response?.data?.detail || 'Error al cargar la sesión.'))
      .finally(() => setLoading(false))
  }, [id])

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
        <Link to="/fatigue" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
          <ChevronLeft size={14} /> Volver
        </Link>
      </div>
    )
  }

  const presentRecords = records.filter(r => r.is_present)
  const presentCount = presentRecords.length
  const totalCount = records.length
  const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

  const avgAttention = presentRecords.length > 0
    ? Math.round(presentRecords.reduce((sum, r) => sum + r.attention_score, 0) / presentRecords.length)
    : null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-3 flex items-center gap-1 text-sm text-gray-400">
        <Link to="/fatigue" className="hover:text-blue-600 transition-colors">Fatiga y Atención</Link>
        <ChevronLeft size={12} className="rotate-180" />
        {session?.classroom && (
          <>
            <Link to={`/fatigue/classroom/${session.classroom}`} className="hover:text-blue-600 transition-colors">
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
              href={`http://localhost:8000/api/reports/fatigue/?session_id=${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <ExternalLink size={15} /> Ver Reporte
            </a>
          )
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
          <div className="mt-2"><StatusBadge status={session?.status} /></div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Detectados</p>
          <p className="text-base font-bold mt-1">
            <span className="text-green-600">{presentCount}</span>
            <span className="text-gray-400"> / {totalCount}</span>
          </p>
        </div>
      </div>

      {/* Summary bars */}
      {totalCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Presencia en video</p>
              <p className="text-sm text-gray-500">{presentCount} de {totalCount}</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div className="h-2.5 bg-green-500 rounded-full" style={{ width: `${attendancePct}%` }} />
            </div>
            <p className="text-xs text-green-600 font-medium mt-1.5">{attendancePct}% detectados</p>
          </div>
          {avgAttention !== null && (
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Atención promedio</p>
                <p className="text-sm text-gray-500">{avgAttention}%</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${avgAttention >= 70 ? 'bg-green-500' : avgAttention >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${avgAttention}%` }}
                />
              </div>
              <p className={`text-xs font-medium mt-1.5 ${avgAttention >= 70 ? 'text-green-600' : avgAttention >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {avgAttention >= 70 ? 'Grupo atento' : avgAttention >= 40 ? 'Atención moderada' : 'Grupo con fatiga'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Records table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Resultados por alumno</h2>
        </div>
        {records.length === 0 ? (
          <div className="p-10 text-center">
            <BrainCircuit size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">Sin registros</p>
            {session?.status === 'pending' && (
              <p className="text-sm mt-2 text-gray-400">La sesión está pendiente de procesamiento</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alumno</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matrícula</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presencia</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atención</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fatiga</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(record => {
                  const labelStyle = LABEL_STYLE[record.result_label] || {}
                  const attColor = record.attention_score >= 70 ? 'text-green-600' : record.attention_score >= 40 ? 'text-amber-600' : 'text-red-600'
                  const fatColor = record.fatigue_score >= 50 ? 'text-red-600' : record.fatigue_score >= 30 ? 'text-amber-600' : 'text-green-600'
                  return (
                    <tr key={record.id} className={`hover:bg-gray-50 ${!record.is_present ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {record.student_name || '—'}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-600 text-xs">
                        {record.student_matricula || '—'}
                      </td>
                      <td className="px-6 py-4">
                        {record.is_present ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle size={12} /> Detectado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <XCircle size={12} /> No detectado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 min-w-32">
                        {record.is_present
                          ? <ScoreBar score={record.attention_score} color={attColor} />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4 min-w-32">
                        {record.is_present
                          ? <ScoreBar score={record.fatigue_score} color={fatColor} />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        {record.is_present && record.result_label ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${labelStyle.bg} ${labelStyle.text}`}>
                            {record.result_label}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
