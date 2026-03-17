import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Loader2, Play, Activity, Eye, Smile, User, Users } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'

export default function NewFatigueAnalysis() {
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClassroom, setSelectedClassroom] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [videoFile, setVideoFile] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [processingStatus, setProcessingStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const pollingRef = useRef(null)

  useEffect(() => {
    api.get('/classrooms/').then(r => setClassrooms(r.data.results || r.data))
    return () => clearInterval(pollingRef.current)
  }, [])

  const handleClassroomChange = (e) => {
    const id = e.target.value
    setSelectedClassroom(id)
    setSelectedStudent('')
    setStudents([])
    if (!id) return
    setLoadingStudents(true)
    api.get(`/classrooms/${id}/students/`)
      .then(r => setStudents(r.data.results || r.data))
      .finally(() => setLoadingStudents(false))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedStudent || !date || !videoFile) return
    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.append('student_id', selectedStudent)
    formData.append('date', date)
    formData.append('video', videoFile)

    try {
      const res = await api.post('/fatigue/individual/create/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAnalysis(res.data)
      setProcessingStatus('processing')
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
        const res = await api.get(`/fatigue/individual/${analysisId}/status/`)
        setProcessingStatus(res.data.status)
        if (res.data.status === 'completed') {
          clearInterval(pollingRef.current)
          navigate(`/fatigue/individual/${analysisId}`)
        } else if (res.data.status === 'error') {
          clearInterval(pollingRef.current)
          setError(res.data.error_message || 'Error en el análisis.')
          setProcessingStatus('')
        }
      } catch {}
    }, 3000)
  }

  if (processingStatus === 'processing') {
    const studentObj = students.find(s => String(s.id) === String(selectedStudent))
    return (
      <div className="p-6 max-w-xl mx-auto">
        <PageHeader title="Analizando video..." />
        <div className="bg-white rounded-xl border p-10 text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center">
              <Loader2 size={32} className="text-purple-500 animate-spin" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Procesando...</h2>
            {studentObj && (
              <p className="text-sm font-medium text-purple-600 mt-1">{studentObj.name}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Detectando rostro y analizando niveles de atención y fatiga
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="h-1.5 bg-purple-500 rounded-full animate-pulse w-2/3" />
          </div>
          <p className="text-xs text-gray-400">Esto puede tardar varios minutos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-3">
        <Link to="/fatigue" className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 w-fit">
          <ChevronLeft size={14} /> Fatiga y Atención
        </Link>
      </div>

      <PageHeader title="Nuevo Análisis Individual" subtitle="Selecciona un alumno y sube su video" />

      <div className="bg-white rounded-xl border p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Grupo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Users size={14} className="text-gray-400" /> Grupo
            </label>
            <select
              value={selectedClassroom}
              onChange={handleClassroomChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              required
            >
              <option value="">Seleccionar grupo...</option>
              {classrooms.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>
              ))}
            </select>
          </div>

          {/* Alumno */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <User size={14} className="text-gray-400" /> Alumno
            </label>
            <select
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm disabled:bg-gray-50 disabled:text-gray-400"
              required
              disabled={!selectedClassroom || loadingStudents}
            >
              <option value="">
                {loadingStudents ? 'Cargando alumnos...' : selectedClassroom ? 'Seleccionar alumno...' : 'Primero selecciona un grupo'}
              </option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.matricula}</option>
              ))}
            </select>
            {selectedClassroom && !loadingStudents && students.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Este grupo no tiene alumnos registrados.</p>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              required
            />
          </div>

          {/* Video */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Video del alumno</label>
            <input
              type="file"
              accept=".mp4,.avi,.mov,.mkv"
              onChange={e => setVideoFile(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 file:text-sm"
              required
            />
            <p className="text-xs text-gray-400 mt-1">MP4, AVI, MOV, MKV — Máx 500MB</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 text-sm border">
            <p className="font-medium text-slate-700 mb-2">Qué analiza este módulo</p>
            <ul className="space-y-1 text-slate-600">
              <li className="flex items-center gap-2"><Activity size={13} className="text-purple-500" /> Confirma la identidad del alumno (LBPH)</li>
              <li className="flex items-center gap-2"><Eye size={13} className="text-indigo-500" /> Detecta cierre de ojos y microsueños</li>
              <li className="flex items-center gap-2"><Smile size={13} className="text-amber-500" /> Detecta bostezos y apertura bucal</li>
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
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Play size={14} />
              {loading ? 'Subiendo...' : 'Iniciar Análisis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
