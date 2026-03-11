import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import MaestrosAdmin from './pages/admin/MaestrosAdmin'
import ClassroomList from './pages/classrooms/ClassroomList'
import ClassroomDetail from './pages/classrooms/ClassroomDetail'
import StudentForm from './pages/classrooms/StudentForm'
import FaceCapture from './pages/classrooms/FaceCapture'
import SessionList from './pages/attendance/SessionList'
import NewSession from './pages/attendance/NewSession'
import SessionDetail from './pages/attendance/SessionDetail'
import FatigueList from './pages/fatigue/FatigueList'
import NewFatigueAnalysis from './pages/fatigue/NewFatigueAnalysis'
import ReportViewer from './pages/reports/ReportViewer'
import Layout from './components/Layout'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Cargando...</div>
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="admin/maestros" element={<AdminRoute><MaestrosAdmin /></AdminRoute>} />
            <Route path="classrooms" element={<ClassroomList />} />
            <Route path="classrooms/:id" element={<ClassroomDetail />} />
            <Route path="classrooms/:classroomId/students/new" element={<StudentForm />} />
            <Route path="classrooms/:classroomId/students/:studentId/edit" element={<StudentForm />} />
            <Route path="classrooms/students/:studentId/face-capture" element={<FaceCapture />} />
            <Route path="attendance" element={<SessionList />} />
            <Route path="attendance/new" element={<NewSession />} />
            <Route path="attendance/:id" element={<SessionDetail />} />
            <Route path="fatigue" element={<FatigueList />} />
            <Route path="fatigue/new" element={<NewFatigueAnalysis />} />
            <Route path="reports" element={<ReportViewer />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
