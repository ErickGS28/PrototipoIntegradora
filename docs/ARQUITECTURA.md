# Presentia — Documentación Técnica

> Sistema de control de asistencia y análisis de fatiga/atención para entornos académicos.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura de directorios](#3-estructura-de-directorios)
4. [Base de datos y modelos](#4-base-de-datos-y-modelos)
5. [Autenticación y sesión](#5-autenticación-y-sesión)
6. [Módulo de grupos y alumnos](#6-módulo-de-grupos-y-alumnos)
7. [Captura facial y encodings](#7-captura-facial-y-encodings)
8. [Medición de asistencia](#8-medición-de-asistencia)
9. [Análisis de fatiga y atención](#9-análisis-de-fatiga-y-atención)
10. [Reportes](#10-reportes)
11. [API — mapa de endpoints](#11-api--mapa-de-endpoints)
12. [Frontend — estructura de páginas](#12-frontend--estructura-de-páginas)
13. [Variables de configuración clave](#13-variables-de-configuración-clave)

---

## 1. Visión general

Presentia permite a un maestro:

1. **Gestionar grupos y alumnos** — alta, edición, captura de fotos de referencia.
2. **Registrar asistencia automáticamente** — subir un video de la sesión y obtener, por alumno, si estuvo presente o ausente.
3. **Analizar fatiga y atención individuales** — subir un video corto de un alumno específico y obtener su nivel de atención, fatiga, bostezos y segundos con ojos cerrados.
4. **Corregir resultados manualmente** — cualquier registro de asistencia puede togglearse (presente ↔ ausente) en caso de error (p. ej. gemelos).
5. **Ver reportes imprimibles** — cada análisis de fatiga genera un reporte HTML listo para impresión.

Todo el procesamiento de video ocurre en **hilos daemon de fondo** (`threading.Thread(daemon=True)`). El video se sube una vez, se procesa de forma asíncrona y el frontend hace polling al endpoint de estado hasta que el procesamiento termina.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Django 5.1 + Django REST Framework |
| Autenticación | `djangorestframework-simplejwt` (JWT) |
| Base de datos | MySQL 8 (`jipem_db`, usuario `root`) |
| Visión por computadora | OpenCV 4 — Haarcascade + LBPH |
| Frontend | React 19 + Vite + Tailwind CSS v4 |
| Routing frontend | React Router DOM v7 |
| Iconos | lucide-react |

---

## 3. Estructura de directorios

```
Prototipo1/
├── backend/
│   ├── apps/
│   │   ├── users/          # Modelo User, auth endpoints (login/register/refresh/me)
│   │   ├── classrooms/     # Classroom, Student, FaceEncoding + capture-face endpoint
│   │   ├── attendance/     # AttendanceSession, AttendanceRecord + procesamiento de video
│   │   ├── fatigue/        # IndividualFatigueAnalysis + procesamiento de video
│   │   ├── reports/        # Vistas HTML imprimibles
│   │   └── logs/           # AuditLog (registro de acciones)
│   ├── config/             # settings.py, urls.py, wsgi.py
│   ├── requirements.txt
│   └── .env                # DB credentials, SECRET_KEY, etc.
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── axios.js    # Cliente HTTP + manejo de tokens JWT
    │   ├── context/
    │   │   └── AuthContext.jsx  # Estado global de autenticación
    │   ├── components/
    │   │   └── Layout.jsx  # Shell de navegación (sidebar/navbar)
    │   └── pages/
    │       ├── Login.jsx / Register.jsx
    │       ├── admin/MaestrosAdmin.jsx
    │       ├── classrooms/   # ClassroomList, ClassroomDetail, StudentForm, FaceCapture
    │       ├── attendance/   # SessionList, NewSession, SessionDetail, ClassroomSessions
    │       └── fatigue/      # FatigueList, NewFatigueAnalysis, FatigueAnalysisDetail
    └── vite.config.js
```

---

## 4. Base de datos y modelos

### users_user
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | int PK | |
| `username` | varchar | único, usado para login |
| `password` | varchar | hash bcrypt |
| `name` | varchar | nombre visible |
| `role` | varchar | `'admin'` \| `'maestro'` |
| `is_active` | bool | soft-delete |

### classrooms_classroom
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | int PK | |
| `name` | varchar | nombre del grupo |
| `maestro_id` | FK→User | propietario del grupo |
| `is_active` | bool | soft-delete |
| `created_at` | datetime | |

### classrooms_student
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | int PK | |
| `classroom_id` | FK→Classroom | |
| `name` | varchar | |
| `matricula` | varchar | único |
| `is_active` | bool | soft-delete |

### classrooms_faceencoding
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | int PK | |
| `student_id` | FK→Student | |
| `encoding_data` | longblob | imagen 128×128 px serializada con `pickle` |
| `created_at` | datetime | |

> Se recomienda mínimo **5 muestras** por alumno para un reconocimiento confiable.

### attendance_attendancesession
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | int PK | |
| `classroom_id` | FK→Classroom | |
| `maestro_id` | FK→User | |
| `date` | date | |
| `status` | varchar | `pending` \| `processing` \| `completed` \| `error` |
| `error_message` | text | vacío en caso de éxito |
| `created_at` | datetime | |

### attendance_attendancerecord
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | int PK | |
| `session_id` | FK→Session | |
| `student_id` | FK→Student | |
| `is_present` | bool | resultado final (togglable manualmente) |
| `minutes_present` | int | % de frames detectado (guardado como entero) |

### fatigue_individual_analysis
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | int PK | |
| `student_id` | FK→Student | |
| `maestro_id` | FK→User | |
| `date` | date | |
| `status` | varchar | `pending` \| `processing` \| `completed` \| `error` |
| `attention_score` | float | 0–100 |
| `fatigue_score` | float | 0–100 |
| `yawn_count` | int | bostezos detectados |
| `eyes_closed_secs` | float | segundos acumulados con ojos cerrados |
| `result_label` | varchar | `atento` \| `distraido` \| `fatigado` |
| `error_message` | text | |
| `created_at` | datetime | |

> **Nota**: Los modelos `FatigueSession` y `FatigueRecord` existen en la BD por compatibilidad histórica pero no tienen endpoints activos. Son visibles solo en el panel de administración de Django.

---

## 5. Autenticación y sesión

### Flujo de login

```
Browser          Frontend          Backend
  │──── POST /api/auth/login/ ─────►│
  │                                  │  Verifica credenciales
  │◄── { access, refresh } ─────────│
  │
  Frontend guarda:
    access  → variable JS en memoria (no localStorage → XSS-safe)
    refresh → sessionStorage["rt"]  (sobrevive F5, se borra al cerrar pestaña)
```

### Restauración de sesión al recargar página

```
AuthContext (useEffect on mount)
  1. Lee sessionStorage["rt"]
  2. POST /api/auth/refresh/  { refresh }  → nuevo access token
  3. GET  /api/auth/me/                    → datos del usuario
  4. Actualiza estado user, loading=false
  Si cualquier paso falla → user=null, redirect a /login
```

### Renovación automática de tokens

`frontend/src/api/axios.js` incluye un interceptor de respuesta que:
1. Si recibe `401 Unauthorized`, intenta obtener un nuevo access token usando el refresh token en `sessionStorage`.
2. Reintenta la petición original con el nuevo token.
3. Si el refresh también falla, llama a `clearTokens()` y redirige a `/login`.

### Roles

| Rol | Acceso |
|-----|--------|
| `admin` | Ve todos los grupos, sesiones y análisis del sistema |
| `maestro` | Solo ve sus propios grupos, sesiones y análisis |

---

## 6. Módulo de grupos y alumnos

Un **Classroom** (grupo) pertenece a un maestro. Cada grupo puede tener N **Students**.

### Endpoints
```
GET/POST   /api/classrooms/
GET/PUT/DELETE /api/classrooms/:id/
GET/POST   /api/classrooms/:classroomId/students/
GET/PUT/DELETE /api/classrooms/:classroomId/students/:studentId/
POST       /api/classrooms/students/:studentId/capture-face/
GET        /api/classrooms/students/:studentId/face-status/
```

La eliminación de grupos y alumnos es un **soft-delete** (`is_active = False`). Los datos históricos (asistencias, análisis) se preservan.

---

## 7. Captura facial y encodings

Antes de poder usar reconocimiento facial, cada alumno necesita al menos **5 muestras** de su rostro.

### Proceso de captura (`POST /api/classrooms/students/:id/capture-face/`)

```
Frontend (FaceCapture.jsx)
  → Accede a la cámara del navegador (MediaDevices API)
  → Captura un frame como canvas
  → Convierte a base64 (JPEG)
  → POST { image_base64: "data:image/jpeg;base64,..." }

Backend (classrooms/views.py — CaptureFaceView)
  1. Decodifica base64 → array NumPy BGR
  2. Convierte BGR → RGB
  3. Haarcascade detectMultiScale (minSize=60×60, minNeighbors=5)
  4. Selecciona el rostro más grande
  5. Añade padding 10% alrededor
  6. Recorta y redimensiona a 128×128 px (escala de grises)
  7. Serializa con pickle.dumps()
  8. Guarda en FaceEncoding.encoding_data (LONGBLOB)

Response: { sample_count, has_enough_samples (True si count >= 5) }
```

El almacenamiento como `pickle` de una imagen NumPy (no un vector de embeddings) permite rehidratar exactamente la misma imagen para entrenar el clasificador LBPH en tiempo de procesamiento.

---

## 8. Medición de asistencia

### Flujo completo

```
Maestro crea sesión  →  sube video  →  backend procesa  →  frontend hace polling
```

1. **Crear sesión** (`POST /api/attendance/`) — solo requiere `classroom` y `date`.
2. **Subir video** (`POST /api/attendance/:id/upload/`) — el video se guarda en `MEDIA_ROOT/tmp/`.
3. **Procesamiento asíncrono** — `start_attendance_processing(session_id, video_path)` lanza un `threading.Thread(daemon=True)`.
4. **Polling de estado** (`GET /api/attendance/:id/status/`) — el frontend pregunta cada ~2 s.
5. **Al completar** — el frontend carga el detalle completo de la sesión.

### Algoritmo de reconocimiento facial (attendance/tasks.py)

```python
FRAMES_TO_SKIP = 5          # Se procesa 1 de cada 5 frames
FACE_SIZE = (128, 128)
LBPH_CONFIDENCE_THRESHOLD = 100   # Confianza LBPH (menor = más parecido)
PRESENCE_THRESHOLD_PCT = 0.10     # El alumno debe aparecer en ≥10% de frames
```

#### Paso 1 — Entrenar reconocedor LBPH

```
Para cada alumno del grupo con encodings:
  Carga sus imágenes pickle → lista de arrays NumPy 128×128
  Asigna label numérico único (idx del alumno)

cv2.face.LBPHFaceRecognizer_create().train(face_images, labels)
```

LBPH (Local Binary Patterns Histograms) describe la textura local de la imagen facial. No requiere GPU ni embeddings profundos — es rápido y funciona sin conexión.

#### Paso 2 — Procesar video frame a frame

```
Para cada frame (procesando 1 de cada FRAMES_TO_SKIP):
  1. Reducir resolución al 50% (rendimiento)
  2. Convertir a escala de grises
  3. Haarcascade detectMultiScale → lista de rostros (x, y, w, h)
  4. Para cada rostro detectado:
       a. Añadir padding 10%
       b. Recortar y redimensionar a 128×128
       c. recognizer.predict(face_crop) → (label, confidence)
       d. Si confidence < LBPH_CONFIDENCE_THRESHOLD:
            frame_count_map[student_id] += 1
```

#### Paso 3 — Determinar presencia

```
Para cada alumno:
  presencia_pct = frame_count_map[student_id] / total_processed_frames
  is_present = presencia_pct >= PRESENCE_THRESHOLD_PCT   (≥ 10%)
```

Si un alumno aparece en al menos el 10% de los frames analizados, se considera **presente**. Esto tolera que el alumno se mueva, salga del encuadre momentáneamente o sea tapado brevemente por otro.

#### Corrección manual

Cualquier registro puede invertirse vía `PATCH /api/attendance/records/:id/toggle/`. El frontend muestra un badge clickeable en la vista de detalle de sesión con indicador de carga. Útil para casos de gemelos o errores del reconocedor.

---

## 9. Análisis de fatiga y atención

### Flujo completo

```
Maestro selecciona grupo → selecciona alumno → selecciona fecha → sube video
  → backend crea IndividualFatigueAnalysis (status=pending)
  → inicia hilo daemon con el video
  → frontend hace polling a /fatigue/individual/:id/status/
  → al completar, navega a /fatigue/individual/:id (detalle)
```

### Algoritmo (fatigue/tasks.py)

#### Constantes

```python
FRAMES_TO_SKIP = 5              # 1 de cada 5 frames procesados
FACE_SIZE = (128, 128)
LBPH_CONFIDENCE_THRESHOLD = 100
PRESENCE_THRESHOLD_PCT = 0.10   # ≥10% de frames para considerar al alumno presente

EYE_CLOSED_CONSEC_SECS = 0.4   # Segundos consecutivos sin ojos para acumular cierre
YAWN_CONSEC_SECS = 0.3          # Segundos consecutivos de boca abierta para contar bostezo
```

#### Paso 1 — Cargar reconocedor LBPH del alumno

Si el alumno tiene encodings registrados, se entrena un reconocedor LBPH con **solo sus imágenes** (todas con label `0`). Durante el procesamiento, solo se analiza el rostro del alumno; si hay más personas en el encuadre, se descartan.

Si el alumno no tiene encodings, se analiza el **rostro más grande** del frame (fallback).

#### Paso 2 — Calcular FPS procesados

```python
fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
processed_fps = fps / FRAMES_TO_SKIP          # FPS "efectivos" tras el skip

eye_closed_frames  = max(1, int(EYE_CLOSED_CONSEC_SECS * processed_fps))
yawn_frames_threshold = max(1, int(YAWN_CONSEC_SECS * processed_fps))
```

> **Punto crítico**: todos los umbrales deben expresarse en **frames procesados**, no en frames reales. Si el video es 25 fps y se salta 1 de cada 5, los frames procesados son 5 fps. Un umbral de 0.4 s = `0.4 × 5 = 2 frames procesados`.

#### Paso 3 — Bucle principal

```python
Para cada frame procesado (1 de cada FRAMES_TO_SKIP):
  1. Reducir resolución 50% + convertir a gris ecualizado (equalizeHist)
  2. Haarcascade detectMultiScale → rostros detectados
  3. LBPH.predict() sobre cada rostro → seleccionar el del alumno (menor confidence)
  4. Si no se encuentra el alumno → reiniciar contadores consecutivos y continuar
  5. Recortar rostro con padding 10%
  6. state['face_frames'] += 1

  ── Detección de ojos (zona superior 60% del rostro) ──────────────────────
  7. Recortar top_face = face_crop[:60%]
  8. Ampliar ×2 (para que el cascade trabaje mejor en zonas pequeñas)
  9. _EYE_CASCADE.detectMultiScale(top_resized, minNeighbors=3, minSize=15×15)
  10. Si len(eyes) == 0:
        no_eye_counter += 1
        Si no_eye_counter >= eye_closed_frames:
          eyes_closed_secs += FRAMES_TO_SKIP / fps   ← segundos reales acumulados
      Sino:
        eye_detected_frames += 1
        no_eye_counter = 0

  ── Detección de bostezo (zona inferior 50% del rostro) ───────────────────
  11. Recortar bottom_face = face_crop[50%:]
  12. Ampliar ×2
  13. _SMILE_CASCADE.detectMultiScale(bottom_resized, scaleFactor=1.3, minNeighbors=10)
      (minNeighbors=10 es alto deliberadamente para reducir falsos positivos)
  14. Si len(smiles) > 0:
        yawn_counter += 1
        Si yawn_counter >= yawn_frames_threshold y no yawn_in_progress:
          yawn_count += 1
          yawn_in_progress = True   ← evita contar el mismo bostezo dos veces
      Sino:
        yawn_counter = 0
        yawn_in_progress = False
```

#### Paso 4 — Cálculo de métricas

```python
effective = max(face_frames * FRAMES_TO_SKIP / fps, 1.0)
# "effective" = duración real en segundos en que se vio al alumno

eye_closed_ratio    = eyes_closed_secs / effective
eye_undetected_ratio = 1.0 - (eye_detected_frames / max(face_frames, 1))
# eye_undetected_ratio: fracción de frames de cara donde el cascade no encontró ojos
# (incluso con ojos abiertos, el cascade puede fallar → peso menor en la fórmula)
```

#### Paso 5 — Fórmula de fatiga

```python
eye_fatigue    = min(1.0,   eye_closed_ratio * 1.5  +  eye_undetected_ratio * 0.4)
fatigue_score  = min(100.0, eye_fatigue * 100        +  yawn_count * 12)
attention_score = max(0.0,  100.0 - fatigue_score)
```

| Componente | Peso | Justificación |
|------------|------|---------------|
| `eye_closed_ratio × 1.5` | Alto | Cerrar ojos es la señal más directa de somnolencia |
| `eye_undetected_ratio × 0.4` | Bajo | El cascade puede fallar incluso con ojos abiertos |
| `yawn_count × 12` | Fijo por bostezo | Cada bostezo penaliza ≈12 puntos (max efectivo ~8 bostezos) |

#### Paso 6 — Clasificación

```python
def _classify(attention_score):
    if attention_score >= 70:  return 'atento'
    if attention_score >= 40:  return 'distraido'
    return 'fatigado'
```

| Etiqueta | Rango de atención |
|----------|-------------------|
| `atento` | 70 – 100 |
| `distraido` | 40 – 69 |
| `fatigado` | 0 – 39 |

Si el alumno aparece en menos del 10% de los frames (`face_frames / processed_frames < PRESENCE_THRESHOLD_PCT`), `result_label` queda vacío — el video no tenía suficiente presencia del alumno para analizar.

#### Paso 7 — Guardado y limpieza

```python
analysis.status = 'completed'
analysis.save(update_fields=['status', 'attention_score', 'fatigue_score',
                              'yawn_count', 'eyes_closed_secs', 'result_label'])
# El video se elimina siempre en el bloque finally, incluso si ocurre un error.
os.remove(video_path)
```

---

## 10. Reportes

Los reportes son **vistas HTML server-side** generadas con Django Templates, pensadas para impresión directa desde el navegador (`window.print()`).

```
GET /api/reports/fatigue/individual/?analysis_id=X
```

El reporte incluye:
- Datos del alumno (nombre, matrícula, grupo)
- Fecha del análisis
- Barras visuales de attention_score y fatigue_score
- Etiqueta de resultado con color semántico
- Estadísticas detalladas (yawn_count, eyes_closed_secs)

Los reportes usan `AllowAny` como permiso para poder abrirse directamente desde el navegador sin necesidad de pasar el JWT (es un enlace `<a href>` sin AJAX).

---

## 11. API — mapa de endpoints

Todos los endpoints son `http://localhost:8000/api/`.

### Auth (`/auth/`)
```
POST   login/             Obtener tokens JWT
POST   register/          Crear cuenta (rol maestro por defecto)
POST   refresh/           Renovar access token
GET    me/                Datos del usuario autenticado
```

### Classrooms (`/classrooms/`)
```
GET/POST   classrooms/
GET/PUT/DELETE classrooms/:id/
GET/POST   classrooms/:classroomId/students/
GET/PUT/DELETE classrooms/:classroomId/students/:studentId/
POST       students/:studentId/capture-face/
GET        students/:studentId/face-status/
```

### Attendance (`/attendance/`)
```
GET/POST   attendance/                     Listar / crear sesión
GET        attendance/:id/                 Detalle con records
POST       attendance/:id/upload/          Subir video
GET        attendance/:id/status/          Polling de estado
PATCH      attendance/records/:id/toggle/  Corregir presencia manualmente
GET        attendance/classroom/:classroomId/  Sesiones de un grupo
```

### Fatigue (`/fatigue/`)
```
GET    fatigue/individual/           Listar análisis (filtros: student_id, classroom_id)
POST   fatigue/individual/create/    Crear análisis + subir video
GET    fatigue/individual/:id/       Detalle completo
GET    fatigue/individual/:id/status/ Polling de estado
```

### Reports (`/reports/`)
```
GET    reports/fatigue/individual/?analysis_id=X   Reporte HTML imprimible
```

### Admin (`/admin/`)
```
GET    admin/maestros/   Listar maestros (solo admin)
PATCH  admin/maestros/:id/toggle/  Activar / desactivar maestro
```

---

## 12. Frontend — estructura de páginas

```
/login                         Login.jsx
/register                      Register.jsx
/                              → redirige a /classrooms
/admin/maestros                MaestrosAdmin.jsx       (solo admin)
/classrooms                    ClassroomList.jsx
/classrooms/:id                ClassroomDetail.jsx      (alumnos + face status)
/classrooms/:classroomId/students/new          StudentForm.jsx
/classrooms/:classroomId/students/:id/edit     StudentForm.jsx
/classrooms/students/:studentId/face-capture   FaceCapture.jsx
/attendance                    SessionList.jsx
/attendance/new                NewSession.jsx
/attendance/classroom/:id      ClassroomSessions.jsx
/attendance/:id                SessionDetail.jsx        (toggle de presencia)
/fatigue                       FatigueList.jsx          (filtro por grupo)
/fatigue/new                   NewFatigueAnalysis.jsx   (cascada grupo→alumno→video)
/fatigue/individual/:id        FatigueAnalysisDetail.jsx + link a reporte
```

### Protección de rutas

- `PrivateRoute` — redirige a `/login` si no hay sesión activa.
- `AdminRoute` — redirige a `/classrooms` si el rol no es `admin`.
- Durante la restauración de sesión (`loading=true`), muestra un spinner en lugar de redirigir.

---

## 13. Variables de configuración clave

### Backend (`backend/.env`)
```
SECRET_KEY=...
DEBUG=True
DB_NAME=jipem_db
DB_USER=root
DB_PASSWORD=root
DB_HOST=127.0.0.1
DB_PORT=3306
ALLOWED_HOSTS=localhost,127.0.0.1
MAX_UPLOAD_SIZE=524288000   # 500 MB en bytes
```

### Constantes de procesamiento de video

Definidas en los archivos `tasks.py` de cada app. Se pueden ajustar sin migraciones:

| Constante | Valor actual | Descripción |
|-----------|-------------|-------------|
| `FRAMES_TO_SKIP` | 5 | Procesar 1 de cada N frames (rendimiento) |
| `FACE_SIZE` | (128, 128) | Tamaño normalizado para LBPH |
| `LBPH_CONFIDENCE_THRESHOLD` | 100 | Máxima confianza aceptable (0=idéntico, 150=muy diferente) |
| `PRESENCE_THRESHOLD_PCT` | 0.10 | Fracción mínima de frames para considerar alumno presente |
| `EYE_CLOSED_CONSEC_SECS` | 0.4 | Segundos consecutivos sin ojos para acumular cierre |
| `YAWN_CONSEC_SECS` | 0.3 | Segundos consecutivos de boca abierta para registrar bostezo |

### Cascades de OpenCV utilizados

| Cascade | Uso |
|---------|-----|
| `haarcascade_frontalface_default.xml` | Detección de rostros (asistencia y fatiga) |
| `haarcascade_eye.xml` | Detección de ojos abiertos (fatiga) |
| `haarcascade_smile.xml` | Detección de boca abierta / bostezos (fatiga) |

Los tres cascades se cargan **una sola vez al importar el módulo** (nivel de módulo, fuera de funciones) para evitar el costo de lectura de disco en cada procesamiento.
