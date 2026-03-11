import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'

const EMPTY_FORM = {
  name: '',
  matricula: '',
  age: '',
  sex: '',
  wears_glasses: false,
}

export default function StudentForm() {
  const { classroomId, studentId } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(studentId)

  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(isEdit)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEdit) {
      fetchStudent()
    }
  }, [studentId])

  const fetchStudent = async () => {
    setFetchLoading(true)
    try {
      const res = await api.get(`/classrooms/${classroomId}/students/${studentId}/`)
      const s = res.data
      setForm({
        name: s.name || '',
        matricula: s.matricula || '',
        age: s.age || '',
        sex: s.sex || '',
        wears_glasses: s.wears_glasses || false,
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar alumno.')
    } finally {
      setFetchLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = {
      ...form,
      age: form.age ? parseInt(form.age) : null,
    }

    try {
      if (isEdit) {
        await api.put(`/classrooms/${classroomId}/students/${studentId}/`, payload)
      } else {
        await api.post(`/classrooms/${classroomId}/students/`, payload)
      }
      navigate(`/classrooms/${classroomId}`)
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const messages = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ')
        setError(messages)
      } else {
        setError('Error al guardar alumno.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (classroomId) {
      navigate(`/classrooms/${classroomId}`)
    } else {
      navigate(-1)
    }
  }

  if (fetchLoading) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-64 bg-gray-100 rounded-xl"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-2">
        <button onClick={handleBack} className="text-sm text-blue-600 hover:underline">
          ← Volver al grupo
        </button>
      </div>
      <PageHeader
        title={isEdit ? 'Editar Alumno' : 'Nuevo Alumno'}
        subtitle={isEdit ? 'Modifica los datos del alumno' : 'Agrega un nuevo alumno al grupo'}
      />

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej. María González"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Matrícula <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.matricula}
              onChange={(e) => setForm(f => ({ ...f, matricula: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej. 220001"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => setForm(f => ({ ...f, age: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej. 20"
                min="1"
                max="99"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
              <select
                value={form.sex}
                onChange={(e) => setForm(f => ({ ...f, sex: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar...</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
            <input
              type="checkbox"
              id="wears_glasses"
              checked={form.wears_glasses}
              onChange={(e) => setForm(f => ({ ...f, wears_glasses: e.target.checked }))}
              className="w-5 h-5 text-blue-600 rounded"
            />
            <label htmlFor="wears_glasses" className="text-sm font-medium text-gray-700 cursor-pointer">
              Usa lentes
              <span className="text-gray-400 font-normal ml-1">(importante para el reconocimiento facial)</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Guardando...' : isEdit ? 'Actualizar Alumno' : 'Crear Alumno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
