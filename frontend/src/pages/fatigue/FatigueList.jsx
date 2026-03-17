import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, BrainCircuit, ArrowRight, User, Calendar, Filter } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'

const LABEL_STYLE = {
  atento:    { bg: 'bg-green-100',  text: 'text-green-700'  },
  fatigado:  { bg: 'bg-red-100',    text: 'text-red-700'    },
  distraido: { bg: 'bg-amber-100',  text: 'text-amber-700'  },
}

export default function FatigueList() {
  const [analyses, setAnalyses] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [filterClassroom, setFilterClassroom] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/fatigue/individual/'),
      api.get('/classrooms/'),
    ])
      .then(([aRes, cRes]) => {
        setAnalyses(aRes.data.results || aRes.data)
        setClassrooms(cRes.data.results || cRes.data)
      })
      .catch(err => setError(err.response?.data?.detail || 'Error al cargar análisis.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filterClassroom
    ? analyses.filter(a => String(a.classroom_id) === filterClassroom)
    : analyses

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Fatiga y Atención"
        subtitle="Análisis individuales por alumno"
        action={
          <Link
            to="/fatigue/new"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <Plus size={15} /> Nuevo Análisis
          </Link>
        }
      />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filter */}
      {!loading && classrooms.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filterClassroom}
            onChange={e => setFilterClassroom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Todos los grupos</option>
            {classrooms.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {filterClassroom && (
            <button
              onClick={() => setFilterClassroom('')}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="divide-y">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-48" />
                  <div className="h-2.5 bg-gray-100 rounded w-32" />
                </div>
                <div className="h-6 w-20 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <BrainCircuit size={40} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-600 mb-1">
            {filterClassroom ? 'Sin análisis para este grupo' : 'Sin análisis registrados'}
          </p>
          <p className="text-sm text-gray-400 mb-6">Crea el primer análisis individual de un alumno</p>
          <Link
            to="/fatigue/new"
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
          >
            <Plus size={14} /> Nuevo Análisis
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alumno</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atención</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resultado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(a => {
                  const labelStyle = LABEL_STYLE[a.result_label] || {}
                  const attPct = Math.round(a.attention_score)
                  const attColor = attPct >= 70 ? 'bg-green-500' : attPct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <User size={13} className="text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{a.student_name}</p>
                            <p className="text-xs text-gray-400 font-mono">{a.student_matricula}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">{a.classroom_name || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-gray-600 text-xs">
                          <Calendar size={11} />
                          {a.date}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-6 py-4 min-w-28">
                        {a.status === 'completed' && a.result_label ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold w-8 text-right ${attPct >= 70 ? 'text-green-600' : attPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                              {attPct}%
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${attColor}`} style={{ width: `${attPct}%` }} />
                            </div>
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        {a.result_label ? (
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${labelStyle.bg} ${labelStyle.text}`}>
                            {a.result_label}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/fatigue/individual/${a.id}`}
                          className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 text-xs font-medium px-2.5 py-1.5 rounded hover:bg-purple-50 transition-colors"
                        >
                          Ver <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
