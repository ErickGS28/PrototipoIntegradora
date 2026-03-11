import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Camera, CheckCircle } from 'lucide-react'
import api from '../../api/axios'
import PageHeader from '../../components/PageHeader'

export default function FaceCapture() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [sampleCount, setSampleCount] = useState(0)
  const [student, setStudent] = useState(null)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const MIN_SAMPLES = 5

  useEffect(() => {
    startCamera()
    fetchStatus()
    return () => stopCamera()
  }, [studentId])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setError('No se pudo acceder a la cámara.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
  }

  const fetchStatus = async () => {
    try {
      const res = await api.get(`/classrooms/students/${studentId}/face-status/`)
      setStudent(res.data)
      setSampleCount(res.data.sample_count)
    } catch {}
  }

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    setCapturing(true)
    setError('')
    setMessage('')

    const canvas = canvasRef.current
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8)

    try {
      const res = await api.post(`/classrooms/students/${studentId}/capture-face/`, {
        image_base64: imageBase64,
      })
      setSampleCount(res.data.sample_count)
      setMessage(`Muestra ${res.data.sample_count} capturada correctamente`)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al capturar.')
    } finally {
      setCapturing(false)
    }
  }, [studentId])

  const hasEnough = sampleCount >= MIN_SAMPLES

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Captura Facial"
        subtitle={student ? `Alumno: ${student.name}` : 'Cargando...'}
      />
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Muestras capturadas: <span className="font-bold text-blue-600">{sampleCount}</span> / {MIN_SAMPLES} mínimo
            </p>
            <div className="w-48 bg-gray-200 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full transition-all ${hasEnough ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, (sampleCount / MIN_SAMPLES) * 100)}%` }}
              />
            </div>
          </div>
          {hasEnough && (
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full">
              <CheckCircle size={12} /> Listo para reconocimiento
            </span>
          )}
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
        {message && <p className="text-green-600 text-sm bg-green-50 px-4 py-2 rounded-lg">{message}</p>}

        <div className="flex gap-3">
          <button
            onClick={capture}
            disabled={capturing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {capturing ? (
            'Capturando...'
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Camera size={16} /> Capturar Muestra
            </span>
          )}
          </button>
          <button
            onClick={() => { stopCamera(); navigate(-1) }}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
          >
            Volver
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Captura al menos 5 muestras desde diferentes ángulos para mejor reconocimiento
        </p>
      </div>
    </div>
  )
}
