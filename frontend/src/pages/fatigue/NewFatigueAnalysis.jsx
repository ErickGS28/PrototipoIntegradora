import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Play, CheckCircle, Activity, Eye, Smile } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'

export default function NewFatigueAnalysis() {
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClassroom, setSelectedClassroom] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const pollingRef = useRef(null)

  useEffect(() => {
    api.get('/classrooms/').then(r => setClassrooms(r.data.results || r.data))
    return () => clearInterval(pollingRef.current)
  }, [])

  useEffect(() => {
    if (selectedClassroom) {
      fetchStudents(selectedClassroom)
    } else {
      setStudents([])
      setSelectedStudent('')
    }
  }, [selectedClassroom])

  const fetchStudents = async (classroomId) => {
    setStudentsLoading(true)
    setSelectedStudent('')
    try {
      const res = await api.get(`/classrooms/${classroomId}/students/`)
      setStudents(res.data.results || res.data)
    } catch {
      setStudents([])
    } finally {
      setStudentsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedStudent || !videoFile) return
    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.append('student_id', selectedStudent)
    formData.append('video', videoFile)

    try {
      const res = await api.post('/fatigue/analyze/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAnalysis(res.data)
      setStatus('processing')
      startPolling(res.data.id)
    } catch (err) {
      const data = err.response?.data
      setError(data ? Object.values(data).flat().join(' | ') : 'Error al iniciar análisis.')
    } finally {
      setLoading(false)
    }
  }

  const startPolling = (analysisId) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/fatigue/${analysisId}/`)
        setStatus(res.data.status)
        if (res.data.status === 'completed') {
          clearInterval(pollingRef.current)
          setResult(res.data)
        } else if (res.data.status === 'error') {
          clearInterval(pollingRef.current)
          setError(res.data.error_message || 'Error en el análisis.')
        }
      } catch {}
    }, 3000)
  }

  const getResultStyle = (resultLabel) => {
    const label = resultLabel?.toLowerCase()
    if (label === 'atento') return { border: 'border-green-400', bg: 'bg-green-50', text: 'text-green-800' }
    if (label === 'fatigado') return { border: 'border-red-400', bg: 'bg-red-50', text: 'text-red-800' }
    if (label?.includes('distra')) return { border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-800' }
    return { border: 'border-gray-300', bg: 'bg-gray-50', text: 'text-gray-800' }
  }

  const ScoreBar = ({ score }) => {
    if (score === null || score === undefined) return null
    const pct = Math.round(score)
    const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
    return (
      <div className="w-full bg-gray-100 rounded-full h-2 mt-1.5">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <PageHeader title="Nuevo Análisis de Fatiga" />
        <div className="bg-white rounded-xl border p-10 text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Analizando video...</h2>
            <p className="text-sm text-gray-500 mt-1">Procesando indicadores de atención y fatiga</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="h-1.5 bg-blue-500 rounded-full animate-pulse w-2/3" />
          </div>
          <p className="text-xs text-gray-400">Esto puede tardar varios minutos</p>
        </div>
      </div>
    )
  }

  if (status === 'completed' && result) {
    const style = getResultStyle(result.result_label)
    return (
      <div className="p-6 max-w-xl mx-auto">
        <PageHeader title="Resultado del Análisis" />
        <div className="space-y-4">
          <div className={`bg-white rounded-xl border-2 ${style.border} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Alumno</p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {result.student_name || `Alumno ${result.student}`}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${style.bg} ${style.text}`}>
                {result.result_label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity size={14} className="text-blue-500" />
                  <p className="text-sm text-gray-500">Puntuación de Atención</p>
                </div>
                <p className="font-bold text-xl text-blue-600">
                  {result.attention_score !== null ? `${Math.round(result.attention_score)}%` : '—'}
                </p>
                <ScoreBar score={result.attention_score} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Eye size={14} className="text-red-500" />
                  <p className="text-sm text-gray-500">Nivel de Fatiga</p>
                </div>
                <p className="font-bold text-xl text-red-600">
                  {result.fatigue_score !== null ? `${Math.round(result.fatigue_score)}%` : '—'}
                </p>
                <ScoreBar score={result.fatigue_score} />
              </div>
              {result.yawn_count !== undefined && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Smile size={14} className="text-amber-500" />
                    <p className="text-sm text-gray-500">Bostezos detectados</p>
                  </div>
                  <p className="font-bold text-xl text-gray-800">{result.yawn_count}</p>
                </div>
              )}
              {result.eyes_closed_secs !== undefined && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Eye size={14} className="text-gray-400" />
                    <p className="text-sm text-gray-500">Ojos cerrados</p>
                  </div>
                  <p className="font-bold text-xl text-gray-800">{result.eyes_closed_secs}s</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/fatigue')}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 text-sm"
            >
              Ver todos los análisis
            </button>
            <button
              onClick={() => { setStatus(''); setResult(null); setAnalysis(null); setVideoFile(null) }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Nuevo Análisis
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <PageHeader title="Nuevo Análisis de Fatiga" />
      <div className="bg-white rounded-xl border p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Grupo</label>
            <select
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Alumno</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 text-sm"
              required
              disabled={!selectedClassroom || studentsLoading}
            >
              <option value="">
                {studentsLoading ? 'Cargando alumnos...' :
                 !selectedClassroom ? 'Primero selecciona un grupo' :
                 students.length === 0 ? 'Sin alumnos en este grupo' :
                 'Seleccionar alumno...'}
              </option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.matricula}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Video para analizar</label>
            <input
              type="file"
              accept=".mp4,.avi,.mov,.mkv"
              onChange={(e) => setVideoFile(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:text-sm"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Formatos: MP4, AVI, MOV, MKV — Máx 500MB</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 border">
            <p className="font-medium text-slate-700 mb-2">Indicadores analizados</p>
            <ul className="space-y-1 text-slate-600">
              <li className="flex items-center gap-2"><Activity size={13} className="text-blue-500" /> Nivel de atención sostenida</li>
              <li className="flex items-center gap-2"><Eye size={13} className="text-indigo-500" /> Cierre de ojos y parpadeo</li>
              <li className="flex items-center gap-2"><Smile size={13} className="text-amber-500" /> Bostezos y apertura bucal</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/fatigue')}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedStudent || !videoFile}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Play size={14} />
              {loading ? 'Iniciando...' : 'Iniciar Análisis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
