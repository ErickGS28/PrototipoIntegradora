import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, GraduationCap, ClipboardList, BrainCircuit, ArrowRight, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

function StatCard({ Icon, iconClass, label, value, color, to }) {
  const content = (
    <div className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconClass}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
  if (to) return <Link to={to}>{content}</Link>
  return content
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ classrooms: 0, students: 0, sessions: 0, fatigueAnalyses: 0 })
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        const [classroomsRes, sessionsRes, fatigueRes] = await Promise.allSettled([
          api.get('/classrooms/'),
          api.get('/attendance/sessions/'),
          api.get('/fatigue/'),
        ])

        let classroomCount = 0, studentCount = 0
        if (classroomsRes.status === 'fulfilled') {
          const classrooms = classroomsRes.value.data.results || classroomsRes.value.data
          classroomCount = classrooms.length
          studentCount = classrooms.reduce((sum, c) => sum + (c.student_count || 0), 0)
        }

        let sessionCount = 0, recentList = []
        if (sessionsRes.status === 'fulfilled') {
          const sessions = sessionsRes.value.data.results || sessionsRes.value.data
          sessionCount = sessions.length
          recentList = sessions.slice(0, 5)
        }

        let fatigueCount = 0
        if (fatigueRes.status === 'fulfilled') {
          const analyses = fatigueRes.value.data.results || fatigueRes.value.data
          fatigueCount = analyses.length
        }

        setStats({ classrooms: classroomCount, students: studentCount, sessions: sessionCount, fatigueAnalyses: fatigueCount })
        setRecentSessions(recentList)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const statusLabel = {
    completed: 'Completado', processing: 'Procesando',
    error: 'Error', pending: 'Pendiente',
  }
  const statusClass = {
    completed: 'bg-green-100 text-green-800',
    processing: 'bg-blue-100 text-blue-800',
    error: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Welcome */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">
          {getGreeting()}, {user?.name || user?.username}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Resumen de actividad del sistema</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <StatCard
            Icon={BookOpen}
            iconClass="bg-blue-50 text-blue-600"
            label="Grupos"
            value={stats.classrooms}
            color="text-blue-600"
            to="/classrooms"
          />
          <StatCard
            Icon={GraduationCap}
            iconClass="bg-green-50 text-green-600"
            label="Alumnos"
            value={stats.students}
            color="text-green-600"
            to="/classrooms"
          />
          <StatCard
            Icon={ClipboardList}
            iconClass="bg-purple-50 text-purple-600"
            label="Sesiones"
            value={stats.sessions}
            color="text-purple-600"
            to="/attendance"
          />
          <StatCard
            Icon={BrainCircuit}
            iconClass="bg-orange-50 text-orange-600"
            label="Análisis de Fatiga"
            value={stats.fatigueAnalyses}
            color="text-orange-600"
            to="/fatigue"
          />
        </div>
      )}

      {/* Recent Sessions */}
      <div className="bg-white rounded-xl border mb-6">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Sesiones Recientes</h2>
          <Link to="/attendance" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            Ver todas <ArrowRight size={13} />
          </Link>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No hay sesiones registradas</p>
            <p className="text-sm mt-1 mb-4">Crea tu primera sesión de asistencia</p>
            <Link
              to="/attendance/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Nueva Sesión
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presentes</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentSessions.map(session => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {session.classroom_name || session.classroom?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{session.date}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass[session.status] || 'bg-gray-100 text-gray-800'}`}>
                        {statusLabel[session.status] || session.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {session.present_count !== undefined && session.total_students !== undefined
                        ? `${session.present_count} / ${session.total_students}`
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/attendance/${session.id}`} className="text-blue-600 hover:underline text-sm flex items-center gap-1 justify-end">
                        Ver <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/classrooms" className="group bg-white hover:bg-blue-50 border hover:border-blue-200 rounded-xl p-5 transition-colors">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
            <BookOpen size={20} className="text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Gestionar Grupos</h3>
          <p className="text-sm text-gray-500 mt-1">Crea y administra tus grupos de alumnos</p>
        </Link>
        <Link to="/attendance/new" className="group bg-white hover:bg-green-50 border hover:border-green-200 rounded-xl p-5 transition-colors">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors">
            <ClipboardList size={20} className="text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Tomar Asistencia</h3>
          <p className="text-sm text-gray-500 mt-1">Inicia una nueva sesión de asistencia</p>
        </Link>
        <Link to="/fatigue/new" className="group bg-white hover:bg-orange-50 border hover:border-orange-200 rounded-xl p-5 transition-colors">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-orange-200 transition-colors">
            <BrainCircuit size={20} className="text-orange-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Analizar Fatiga</h3>
          <p className="text-sm text-gray-500 mt-1">Realiza un análisis de atención individual</p>
        </Link>
      </div>
    </div>
  )
}
