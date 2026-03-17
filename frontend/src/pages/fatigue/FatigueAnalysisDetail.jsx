import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, BrainCircuit, ExternalLink, User, Calendar, BookOpen } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'

const LABEL_CONFIG = {
  atento:    { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Atento'    },
  fatigado:  { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Fatigado'  },
  distraido: { bg: 'bg-amber-100',  text: 'text-amber-800',  label: 'Distraído' },
}

function ScoreBar({ score, colorClass, bgClass }) {
  const pct = Math.min(100, Math.max(0, Math.round(score)))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${colorClass}`}>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3">
        <div
          className={`h-3 rounded-full ${bgClass} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function FatigueAnalysisDetail() {
  const { id } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/fatigue/individual/${id}/`)
      .then(res => setAnalysis(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Error al cargar el análisis.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        <Link to="/fatigue" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
          <ChevronLeft size={14} /> Volver
        </Link>
      </div>
    )
  }

  const labelConf = LABEL_CONFIG[analysis.result_label]
  const hasResults = analysis.status === 'completed' && analysis.result_label
  const attPct = Math.round(analysis.attention_score)
  const fatPct = Math.round(analysis.fatigue_score)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-3 flex items-center gap-1 text-sm text-gray-400">
        <Link to="/fatigue" className="hover:text-purple-600 transition-colors">Fatiga y Atención</Link>
        <ChevronLeft size={12} className="rotate-180" />
        <span className="text-gray-600">Análisis individual</span>
      </div>

      <PageHeader
        title={analysis.student_name || 'Análisis'}
        subtitle={`${analysis.classroom_name || ''} — ${analysis.date}`}
        action={
          hasResults && (
            <a
              href={`http://localhost:8000/api/reports/fatigue/individual/?analysis_id=${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <ExternalLink size={15} /> Ver Reporte
            </a>
          )
        }
      />

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            <User size={12} /> Alumno
          </div>
          <p className="text-sm font-bold text-gray-900">{analysis.student_name}</p>
          <p className="text-xs text-gray-400 font-mono">{analysis.student_matricula}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            <BookOpen size={12} /> Grupo
          </div>
          <p className="text-sm font-bold text-gray-900">{analysis.classroom_name || '—'}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            <Calendar size={12} /> Fecha
          </div>
          <p className="text-sm font-bold text-gray-900">{analysis.date}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Estado</p>
          <StatusBadge status={analysis.status} />
        </div>
      </div>

      {/* Results */}
      {analysis.status === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
          <p className="font-medium">Error en el procesamiento</p>
          <p className="mt-1 text-red-600">{analysis.error_message || 'Ocurrió un error al procesar el video.'}</p>
        </div>
      )}

      {analysis.status === 'completed' && !analysis.result_label && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-4 rounded-xl text-sm mb-6">
          <p className="font-medium">Rostro no detectado</p>
          <p className="mt-1">El alumno no fue detectado con suficiente frecuencia en el video. Verifica que el video sea correcto y que el alumno tenga muestras faciales registradas.</p>
        </div>
      )}

      {hasResults && (
        <div className="space-y-4">
          {/* Classification badge */}
          <div className="bg-white rounded-xl border p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Clasificación</p>
              <span className={`inline-flex px-4 py-1.5 rounded-full text-sm font-bold capitalize ${labelConf.bg} ${labelConf.text}`}>
                {labelConf?.label || analysis.result_label}
              </span>
            </div>
            <BrainCircuit size={32} className={`${labelConf.text} opacity-30`} />
          </div>

          {/* Score bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Puntuación de Atención</p>
              <ScoreBar
                score={analysis.attention_score}
                colorClass={attPct >= 70 ? 'text-green-600' : attPct >= 40 ? 'text-amber-600' : 'text-red-600'}
                bgClass={attPct >= 70 ? 'bg-green-500' : attPct >= 40 ? 'bg-amber-500' : 'bg-red-500'}
              />
              <p className={`text-xs font-medium mt-2 ${attPct >= 70 ? 'text-green-600' : attPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {attPct >= 70 ? 'Nivel alto de atención' : attPct >= 40 ? 'Atención moderada' : 'Nivel bajo de atención'}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Puntuación de Fatiga</p>
              <ScoreBar
                score={analysis.fatigue_score}
                colorClass={fatPct >= 50 ? 'text-red-600' : fatPct >= 30 ? 'text-amber-600' : 'text-green-600'}
                bgClass={fatPct >= 50 ? 'bg-red-500' : fatPct >= 30 ? 'bg-amber-500' : 'bg-green-500'}
              />
              <p className={`text-xs font-medium mt-2 ${fatPct >= 50 ? 'text-red-600' : fatPct >= 30 ? 'text-amber-600' : 'text-green-600'}`}>
                {fatPct >= 50 ? 'Fatiga elevada' : fatPct >= 30 ? 'Fatiga moderada' : 'Fatiga baja'}
              </p>
            </div>
          </div>

          {/* Detail stats */}
          <div className="bg-white rounded-xl border p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Detalles del análisis</p>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-800">{analysis.yawn_count}</p>
                <p className="text-xs text-gray-500 mt-1">Bostezos detectados</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-800">{analysis.eyes_closed_secs}s</p>
                <p className="text-xs text-gray-500 mt-1">Ojos cerrados (acumulado)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {(analysis.status === 'pending' || analysis.status === 'processing') && (
        <div className="bg-white rounded-xl border p-10 text-center">
          <BrainCircuit size={36} className="mx-auto mb-3 text-gray-300 animate-pulse" />
          <p className="font-medium text-gray-500">
            {analysis.status === 'pending' ? 'Análisis en cola' : 'Procesando video...'}
          </p>
          <p className="text-sm text-gray-400 mt-1">Los resultados aparecerán aquí cuando el procesamiento termine</p>
        </div>
      )}
    </div>
  )
}
