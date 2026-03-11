import { useState, useEffect, useMemo } from 'react'
import { ClipboardList, BrainCircuit, ExternalLink, FileText } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'

const REPORT_BASE = 'http://localhost:8000/api/reports'

export default function ReportViewer() {
  const [reportType, setReportType] = useState('attendance')
  const [classrooms, setClassrooms] = useState([])
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClassroom, setSelectedClassroom] = useState('')
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [attendanceMode, setAttendanceMode] = useState('session')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/classrooms/').then(r => setClassrooms(r.data.results || r.data)),
      api.get('/attendance/sessions/').then(r => setSessions(r.data.results || r.data)),
    ]).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedClassroom) {
      api.get(`/classrooms/${selectedClassroom}/students/`)
        .then(r => setStudents(r.data.results || r.data))
        .catch(() => setStudents([]))
    } else {
      setStudents([])
      setSelectedStudent('')
    }
  }, [selectedClassroom])

  const reportUrl = useMemo(() => {
    if (reportType === 'attendance') {
      if (attendanceMode === 'session' && selectedSession) {
        return `${REPORT_BASE}/attendance/?session_id=${selectedSession}`
      } else if (attendanceMode === 'classroom' && selectedClassroom) {
        let url = `${REPORT_BASE}/attendance/?classroom_id=${selectedClassroom}`
        if (dateFrom) url += `&date_from=${dateFrom}`
        if (dateTo) url += `&date_to=${dateTo}`
        return url
      }
    } else if (reportType === 'fatigue') {
      if (selectedStudent) return `${REPORT_BASE}/fatigue/?student_id=${selectedStudent}`
      if (selectedClassroom) return `${REPORT_BASE}/fatigue/?classroom_id=${selectedClassroom}`
    }
    return null
  }, [reportType, attendanceMode, selectedSession, selectedClassroom, selectedStudent, dateFrom, dateTo])

  const isReady = Boolean(reportUrl)

  const handleViewReport = () => {
    setError('')
    if (!reportUrl) {
      setError('Selecciona los parámetros necesarios para generar el reporte.')
      return
    }
    window.open(reportUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Reportes"
        subtitle="Genera y visualiza reportes del sistema"
      />

      <div className="bg-white rounded-xl border p-6 space-y-6">
        {/* Report Type */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Tipo de reporte</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setReportType('attendance')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                reportType === 'attendance'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <ClipboardList size={22} className={`mb-2 ${reportType === 'attendance' ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className="font-semibold text-gray-900 text-sm">Asistencia</p>
              <p className="text-xs text-gray-500 mt-0.5">Registro de asistencia por sesión</p>
            </button>
            <button
              onClick={() => setReportType('fatigue')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                reportType === 'fatigue'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <BrainCircuit size={22} className={`mb-2 ${reportType === 'fatigue' ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className="font-semibold text-gray-900 text-sm">Fatiga y Atención</p>
              <p className="text-xs text-gray-500 mt-0.5">Análisis de fatiga por alumno</p>
            </button>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Attendance Options */}
        {reportType === 'attendance' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">Modo del reporte</p>
            <div className="flex gap-3">
              <button
                onClick={() => setAttendanceMode('session')}
                className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                  attendanceMode === 'session'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Por sesión
              </button>
              <button
                onClick={() => setAttendanceMode('classroom')}
                className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                  attendanceMode === 'classroom'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Por grupo y fecha
              </button>
            </div>

            {attendanceMode === 'session' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sesión</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Seleccionar sesión...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.classroom_name || `Grupo ${s.classroom}`} — {s.date}
                      {s.status === 'completed' ? ' (completada)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Grupo</label>
                  <select
                    value={selectedClassroom}
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    <option value="">Seleccionar grupo...</option>
                    {classrooms.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha desde</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha hasta</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fatigue Options */}
        {reportType === 'fatigue' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Grupo (opcional)</label>
              <select
                value={selectedClassroom}
                onChange={(e) => setSelectedClassroom(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="">Todos los grupos</option>
                {classrooms.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Alumno específico
                {selectedClassroom && <span className="text-gray-400 font-normal ml-1">(filtrado por grupo)</span>}
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="">Todos los alumnos</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.matricula}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Action */}
        <div className="bg-gray-50 rounded-xl p-4 border flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700">El reporte se abrirá en una nueva pestaña</p>
            {reportUrl && (
              <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{reportUrl}</p>
            )}
          </div>
          <button
            onClick={handleViewReport}
            disabled={!isReady}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm shrink-0"
          >
            <ExternalLink size={14} /> Ver Reporte
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={16} className="text-blue-600" />
            <h3 className="font-semibold text-blue-900 text-sm">Reporte de Asistencia</h3>
          </div>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>Lista de alumnos con asistencia</li>
            <li>Minutos de presencia en aula</li>
            <li>Porcentaje de asistencia</li>
            <li>Resumen estadístico del grupo</li>
          </ul>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit size={16} className="text-orange-600" />
            <h3 className="font-semibold text-orange-900 text-sm">Reporte de Fatiga y Atención</h3>
          </div>
          <ul className="text-sm text-orange-700 space-y-1">
            <li>Nivel de atención detectado</li>
            <li>Indicadores de fatiga visual</li>
            <li>Clasificación del estado del alumno</li>
            <li>Historial de análisis</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
