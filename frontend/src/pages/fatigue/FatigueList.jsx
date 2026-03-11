import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, BrainCircuit, ChevronLeft } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'

export default function FatigueList() {
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const studentIdFilter = searchParams.get('student_id')

  useEffect(() => {
    fetchAnalyses()
  }, [studentIdFilter])

  const fetchAnalyses = async () => {
    setLoading(true)
    setError('')
    try {
      const params = studentIdFilter ? { student_id: studentIdFilter } : {}
      const res = await api.get('/fatigue/', { params })
      setAnalyses(res.data.results || res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar análisis.')
    } finally {
      setLoading(false)
    }
  }

  const getFatigueLabel = (result) => {
    if (!result) return null
    const map = { atento: 'atento', fatigado: 'fatigado', 'distraído': 'distraído', distraido: 'distraído' }
    return map[result?.toLowerCase()] || result
  }

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-gray-400'
    if (score >= 70) return 'text-green-600'
    if (score >= 40) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Análisis de Fatiga"
        subtitle={studentIdFilter ? 'Filtrado por alumno' : 'Historial de análisis de atención y fatiga'}
        action={
          <Link
            to="/fatigue/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <Plus size={15} /> Nuevo Análisis
          </Link>
        }
      />

      {studentIdFilter && (
        <div className="mb-4">
          <Link to="/fatigue" className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 w-fit">
            <ChevronLeft size={14} /> Ver todos los análisis
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <BrainCircuit size={32} className="mx-auto mb-3 animate-pulse opacity-40" />
            <p className="text-sm">Cargando análisis...</p>
          </div>
        ) : analyses.length === 0 ? (
          <div className="p-12 text-center">
            <BrainCircuit size={40} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-600 mb-1">Sin análisis</p>
            <p className="text-sm text-gray-400 mb-6">Realiza tu primer análisis de fatiga</p>
            <Link
              to="/fatigue/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <Plus size={14} /> Nuevo Análisis
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alumno</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matrícula</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atención</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fatiga</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resultado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analyses.map(analysis => (
                  <tr key={analysis.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {analysis.student_name || analysis.student?.name || '—'}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600 text-xs">
                      {analysis.student_matricula || analysis.student?.matricula || '—'}
                    </td>
                    <td className="px-6 py-4">
                      {analysis.attention_score !== null && analysis.attention_score !== undefined ? (
                        <span className={`font-bold ${getScoreColor(analysis.attention_score)}`}>
                          {Math.round(analysis.attention_score)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {analysis.fatigue_score !== null && analysis.fatigue_score !== undefined ? (
                        <span className={`font-bold ${getScoreColor(100 - analysis.fatigue_score)}`}>
                          {Math.round(analysis.fatigue_score)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {analysis.result_label ? (
                        <StatusBadge status={getFatigueLabel(analysis.result_label)} />
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={analysis.status} />
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {analysis.analyzed_at
                        ? new Date(analysis.analyzed_at).toLocaleDateString('es-MX', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })
                        : '—'}
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
