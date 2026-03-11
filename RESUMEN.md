# JIPEM — Resumen de desarrollo

**Universidad Tecnológica Emiliano Zapata del Estado de Morelos**
**Equipo:** JIPEM Software and Solutions — 8vo B
**Fecha:** Marzo 2026

---

## ¿Qué es JIPEM?

Sistema web full-stack para automatizar el pase de lista en clases presenciales mediante reconocimiento facial en video, y analizar el nivel de atención/fatiga de alumnos individuales.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Django 5.1 + Django REST Framework |
| Autenticación | JWT con `djangorestframework-simplejwt` |
| Base de datos | MySQL 8.0 via `mysqlclient` |
| Reconocimiento facial | OpenCV Haarcascade + LBPH |
| Análisis de fatiga | OpenCV Haarcascade (eye/smile detection) |
| Frontend | React 19 + Vite 6 |
| Estilos | Tailwind CSS v4 (plugin Vite) |
| Routing frontend | React Router DOM v7 |
| HTTP client | Axios con interceptores JWT |

---

## Estructura del proyecto

```
Prototipo1/
├── backend/                    # Django project
│   ├── config/                 # settings, urls, wsgi
│   ├── apps/
│   │   ├── users/              # Auth, roles, permisos
│   │   ├── classrooms/         # Grupos, alumnos, encodings faciales
│   │   ├── attendance/         # Sesiones, procesamiento de video
│   │   ├── fatigue/            # Análisis de fatiga por video
│   │   ├── reports/            # Reportes HTML
│   │   └── logs/               # Audit log
│   ├── manage.py
│   ├── requirements.txt
│   └── .env
└── frontend/                   # React + Vite
    ├── src/
    │   ├── api/                # Axios + JWT interceptors
    │   ├── context/            # AuthContext (tokens en memoria)
    │   ├── components/         # Layout, PageHeader, StatusBadge
    │   └── pages/              # Todas las vistas
    ├── vite.config.js
    └── package.json
```

---

## Base de datos — Tablas generadas por Django ORM

| Tabla | Descripción |
|-------|-------------|
| `users_user` | Extiende AbstractUser con `name` y `role` (admin/maestro) |
| `classrooms_classroom` | Grupos del maestro (nombre, materia) |
| `classrooms_student` | Alumnos con datos personales y `matricula` único |
| `classrooms_faceencoding` | Encodings faciales en BLOB (pickle de numpy array 128D) |
| `attendance_session` | Sesión de clase: grupo + fecha + estado |
| `attendance_record` | Registro individual: alumno + minutos presentes + is_present |
| `fatigue_analysis` | Análisis de fatiga: scores, conteo bostezos, ojos cerrados |
| `logs_auditlog` | Registro de eventos del sistema |

**Índices creados:**
- `attendance_record(session_id, student_id)` — compuesto
- `attendance_session(classroom_id, date)` — consultas por grupo/fecha
- `classrooms_student(matricula)` — búsqueda rápida por matrícula

---

## Apps del backend

### `apps/users`
- Modelo `User` extendiendo `AbstractUser` con campos `name` y `role`
- Propiedades `is_admin` / `is_maestro` para lógica de permisos
- Permisos personalizados: `IsAdmin`, `IsMaestro`, `IsAdminOrMaestro`, `IsOwnerOrAdmin`
- Registro público de maestros vía `/api/auth/register/`
- Login devuelve tokens JWT + datos del usuario
- CRUD de maestros (solo admin) con borrado lógico (`is_active=False`)

### `apps/classrooms`
- CRUD de grupos filtrado por maestro propietario
- CRUD de alumnos dentro de cada grupo
- **Captura facial**: recibe imagen `base64` desde webcam → detecta rostro con OpenCV Haarcascade → genera encoding con LBPH → guarda en `FaceEncoding` (BLOB)
- Mínimo 5 muestras por alumno para habilitar reconocimiento
- Endpoint `/face-status/` indica si el alumno está listo

### `apps/attendance`
- Creación de sesión (grupo + fecha)
- Upload de video (.mp4, .avi, .mov, .mkv, máx 500MB)
- **Procesamiento asíncrono** en `threading.Thread` daemon:
  1. Carga todos los encodings del grupo desde BD
  2. Abre video con OpenCV, procesa **1 de cada 30 frames** (eficiencia)
  3. Resize al 50% antes de procesar (más rápido en CPU)
  4. Compara faces detectadas contra encodings conocidos (tolerancia 0.5)
  5. Calcula minutos: `(frames_detectados × 30) / FPS / 60`
  6. Marca `is_present = True` si minutos ≥ 40
  7. **Elimina el video** en bloque `finally` (nunca queda almacenado)
- Endpoint `/status/` para polling cada 3s desde frontend

### `apps/fatigue`
- Upload de video individual (~2 min) de un alumno
- **Análisis con OpenCV Haarcascade**:
  - **Eye cascade**: detecta ojos cerrados acumulando segundos sin ojos abiertos
  - **Smile cascade**: detecta bostezos contando detecciones de boca abierta
  - `fatigue_score = min(100, (ojos_cerrados/duración × 100) + (bostezos × 10))`
  - `attention_score = max(0, 100 - fatigue_score)`
- Clasificación: `atento` (≥70 atención) / `fatigado` (≥50 fatiga) / `distraído`
- Video eliminado automáticamente tras análisis

### `apps/reports`
- Reportes HTML renderizados con Django Templates
- **Reporte de asistencia**: tabla con alumno, matrícula, minutos, estado (✓/✗), resumen
- **Reporte de fatiga**: barras de progreso para scores, indicadores de bostezos/ojos, badge clasificación
- Se sirven como `text/html`, abribles en navegador o imprimibles

### `apps/logs`
- Modelo `AuditLog` para registrar eventos del sistema

---

## Frontend — Páginas implementadas

| Página | Ruta | Descripción |
|--------|------|-------------|
| Login | `/login` | Autenticación JWT |
| Register | `/register` | Auto-registro maestro |
| Dashboard | `/dashboard` | Stats y accesos rápidos |
| Maestros (admin) | `/admin/maestros` | CRUD maestros — solo admin |
| Lista grupos | `/classrooms` | Cards con grupos del maestro |
| Detalle grupo | `/classrooms/:id` | Info + tabla de alumnos |
| Formulario alumno | `/classrooms/:id/students/new` | Crear/editar alumno |
| Captura facial | `/classrooms/students/:id/face-capture` | Webcam + muestras |
| Lista sesiones | `/attendance` | Tabla de sesiones |
| Nueva sesión | `/attendance/new` | Crear sesión + subir video |
| Detalle sesión | `/attendance/:id` | Records de asistencia |
| Lista fatiga | `/fatigue` | Historial análisis |
| Nueva fatiga | `/fatigue/new` | Subir video + polling |
| Reportes | `/reports` | Selector y apertura de reportes HTML |

### Decisiones de arquitectura frontend
- **Tokens JWT en memoria** (NO `localStorage`) — más seguro contra XSS
- **Axios interceptor de request**: adjunta `Authorization: Bearer {token}`
- **Axios interceptor de response**: detecta 401 → intenta refresh → retry automático → logout si falla
- **Cola de peticiones fallidas**: si múltiples requests fallan simultáneamente mientras se refresca, se encolan y reintentan con el nuevo token
- **Polling con `setInterval`**: el frontend consulta `/status/` cada 3 segundos hasta que el procesamiento termina, luego navega automáticamente

---

## Seguridad implementada

- Todas las rutas excepto `/login/` y `/register/` requieren JWT válido
- Maestros solo ven **sus propios** grupos, alumnos, sesiones y análisis (filtrado por `maestro=request.user`)
- Admin tiene acceso a todos los recursos
- Encodings faciales **nunca expuestos** en ningún endpoint público
- Borrado lógico en usuarios, grupos y alumnos (`is_active=False`)
- Validación de extensión y tamaño en uploads de video
- Videos eliminados **siempre** en bloque `finally` (incluso si hay error)
- Passwords hasheados con PBKDF2 (Django built-in)

---

## Lo que NO se implementó (fuera de alcance académico)

- Celery + Redis (se usa threading — suficiente para demo)
- Docker / docker-compose
- Tests unitarios (estructura lista, tests pendientes)
- Producción HTTPS / nginx / gunicorn
- Rate limiting en endpoints de upload
- Notificaciones en tiempo real (WebSockets)
