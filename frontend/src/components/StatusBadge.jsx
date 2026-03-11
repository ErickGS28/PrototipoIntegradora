const statusConfig = {
  pending: { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Procesando', class: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completado', class: 'bg-green-100 text-green-800' },
  error: { label: 'Error', class: 'bg-red-100 text-red-800' },
  atento: { label: 'Atento', class: 'bg-green-100 text-green-800' },
  fatigado: { label: 'Fatigado', class: 'bg-red-100 text-red-800' },
  'distraído': { label: 'Distraído', class: 'bg-yellow-100 text-yellow-800' },
}

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, class: 'bg-gray-100 text-gray-800' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.class}`}>
      {config.label}
    </span>
  )
}
