# JIPEM — Guía de instalación y pruebas

**Universidad Tecnológica Emiliano Zapata del Estado de Morelos**
**Equipo:** JIPEM Software and Solutions — 8vo B

> Esta guía está pensada para quien clona el repositorio por primera vez y quiere levantar el sistema completo desde cero.

---

## Prerrequisitos

| Requisito | Versión mínima | Verificar con |
|-----------|---------------|---------------|
| Python | 3.11 – 3.13 | `python --version` |
| Node.js | 18+ | `node --version` |
| MySQL | 8.0+ | `mysql --version` |

> **No se requiere** CMake, dlib, Visual Studio Build Tools ni mediapipe.
> El sistema usa únicamente **OpenCV** para reconocimiento facial y análisis de fatiga.

---

## PASO 0 — Crear la base de datos en MySQL

Conéctate a MySQL con tu usuario root y ejecuta:

```sql
CREATE DATABASE IF NOT EXISTS jipem_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

SHOW DATABASES LIKE 'jipem_db';
```

> El `.env` del backend ya viene configurado con `DB_USER=root` y `DB_PASSWORD=root`.
> Si tus credenciales son distintas, edita `backend/.env` antes de continuar.

---

## PASO 1 — Configurar el Backend

Abre una terminal en la raíz del proyecto:

```bash
cd backend
```

### 1.1 Crear entorno virtual e instalar dependencias

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

> `requirements.txt` incluye: Django 5.1, DRF, JWT, CORS, mysqlclient, python-dotenv, Pillow, numpy, opencv-python.

### 1.2 Verificar el archivo .env

El archivo `backend/.env` debe existir con este contenido (ya está en el repo):

```
SECRET_KEY=django-insecure-jipem-utemz-8vo-2026-xk4$p!n#q@wz
DEBUG=True
DB_NAME=jipem_db
DB_USER=root
DB_PASSWORD=root
DB_HOST=localhost
DB_PORT=3306
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
```

### 1.3 Crear tablas (migraciones)

```bash
python manage.py makemigrations users classrooms attendance fatigue logs
python manage.py migrate
```

Deberías ver una lista de migraciones aplicadas sin errores.

### 1.4 Crear usuario admin

```bash
python manage.py createsuperuser
# Introduce: username=admin, email=(vacío), password=admin123
```

Luego asigna el rol admin (solo una vez):

```sql
-- En MySQL:
USE jipem_db;
UPDATE users_user SET role = 'admin' WHERE username = 'admin';
```

O desde Django Admin después de levantar el servidor:
1. Ve a http://127.0.0.1:8000/admin/
2. Users → admin → cambia el campo `Role` a `admin` → Guardar

### 1.5 Levantar el servidor

```bash
python manage.py runserver
```

Deberías ver:
```
Starting development server at http://127.0.0.1:8000/
```

**Verificar:** http://127.0.0.1:8000/admin/ → Panel de Django Admin

---

## PASO 2 — Configurar el Frontend

Abre **otra terminal**:

```bash
cd frontend
npm install
npm run dev
```

Deberías ver:
```
VITE v6.x.x  ready in X ms
➜  Local:   http://localhost:5173/
```

Abre **http://localhost:5173** en el navegador.

---

## PASO 3 — Primera sesión: Login

Credenciales de prueba disponibles:

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `admin123` | Administrador |
| `maestro1` | `Test1234!` | Maestro (registrar en paso 4) |

Ir a **http://localhost:5173/login** y entrar con `admin` / `admin123`.

Si ves el Dashboard, el sistema funciona correctamente.

---

## PASO 4 — Registrar un Maestro

### Opción A — Desde el frontend:
1. Ve a http://localhost:5173/register
2. Llena: Username `maestro1`, Nombre `Juan Pérez`, Password `Test1234!`, confirmar password
3. Se redirige al Dashboard automáticamente (el usuario queda como `maestro`)

### Opción B — Desde curl:
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"maestro1","name":"Juan Pérez","password":"Test1234!","password2":"Test1234!"}'
```

---

## PASO 5 — Crear Grupos y Alumnos

1. Inicia sesión como `maestro1`
2. Ve a **Grupos → Nuevo grupo**
3. Crea: Nombre `8vo B`, Materia `Seguridad en Aplicaciones`
4. Entra al grupo → **Agregar alumno** (mínimo 1 para probar)

Datos de ejemplo:

| Nombre | Matrícula | Edad | Sexo | Lentes |
|--------|-----------|------|------|--------|
| Alumno Uno | 20230001 | 22 | M | No |
| Alumno Dos | 20230002 | 21 | F | No |
| Alumno Tres | 20230003 | 23 | M | Sí |

### Verificar vía API:
```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"maestro1","password":"Test1234!"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access'])")

# Listar grupos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/classrooms/

# Listar alumnos del grupo 1
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/classrooms/1/students/
```

---

## PASO 6 — Captura Facial (requiere webcam)

1. En el detalle del grupo, cada alumno tiene botón **Capturar Rostro**
2. Permite el acceso a la cámara en el navegador
3. Haz clic en **Capturar Muestra** al menos **5 veces** cambiando ligeramente el ángulo
4. Cuando el contador llega a 5 aparece "✓ Listo para reconocimiento"

> La captura usa OpenCV Haarcascade para detectar el rostro y LBPH para generar el encoding.
> Funciona sin instalar ninguna librería adicional.

---

## PASO 7 — Crear Sesión y Subir Video de Clase

### Desde el frontend:
1. Ve a **Asistencia → Nueva Sesión**
2. Selecciona el grupo `8vo B` y la fecha de hoy
3. Clic en **Crear Sesión**
4. Sube un video de clase (.mp4, .avi, .mov o .mkv — máx 500 MB)
5. Observa la barra de progreso mientras procesa (el backend analiza 1 de cada 30 frames)
6. Al terminar redirige automáticamente al detalle de la sesión con la lista de asistencia

### Desde API:
```bash
# 1. Crear sesión
curl -X POST http://localhost:8000/api/attendance/sessions/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"classroom": 1, "date": "2026-03-10"}'
# → { "id": 1, "status": "pending", ... }

# 2. Subir video
curl -X POST http://localhost:8000/api/attendance/sessions/1/upload-video/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "video=@/ruta/al/video.mp4"

# 3. Polling de estado (repetir hasta "completed")
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/attendance/sessions/1/status/
```

> **Nota:** Para pruebas rápidas usa un video corto (30 segundos). El procesamiento depende de la velocidad del CPU.

---

## PASO 8 — Ver Reporte de Asistencia

El reporte se abre directamente en el navegador sin necesidad de token:

```
http://localhost:8000/api/reports/attendance/?session_id=1
```

O desde el frontend: **Reportes → Asistencia → seleccionar sesión → Ver Reporte**

El reporte HTML muestra:
- Encabezado con logo UTEMZ
- Tabla: nombre, matrícula, minutos presentes, estado (✓ / ✗)
- Resumen: X de Y alumnos presentes
- Botón Imprimir

---

## PASO 9 — Análisis de Fatiga

### Desde el frontend:
1. Ve a **Análisis de Fatiga → Nuevo Análisis**
2. Selecciona grupo y alumno
3. Sube un video corto (~1-2 min) del alumno
4. Espera el análisis (polling automático cada 3 segundos)
5. Ver resultado: puntuación atención, puntuación fatiga, bostezos detectados, ojos cerrados, clasificación

Clasificaciones posibles:
- **Atento** — attention_score ≥ 70
- **Fatigado** — fatigue_score ≥ 50
- **Distraído** — en otro caso

### Desde API:
```bash
curl -X POST http://localhost:8000/api/fatigue/analyze/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "student_id=1" \
  -F "video=@/ruta/video_alumno.mp4"

# Polling
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/fatigue/1/
```

---

## PASO 10 — Ver Reporte de Fatiga

```
http://localhost:8000/api/reports/fatigue/?student_id=1
```

O desde el frontend: **Reportes → Fatiga → seleccionar alumno → Ver Reporte**

---

## PASO 11 — Panel de Administración (solo rol admin)

1. Inicia sesión como `admin`
2. Ve a **Administración → Maestros** (solo visible para admin)
3. Puedes crear, editar y desactivar cuentas de maestros

---

## Consultas SQL útiles

```sql
USE jipem_db;

-- Ver usuarios registrados y sus roles
SELECT id, username, name, role, is_active FROM users_user;

-- Asignar rol admin a un usuario
UPDATE users_user SET role = 'admin' WHERE username = 'admin';

-- Ver grupos con número de alumnos
SELECT c.id, c.name, c.subject, u.username AS maestro,
       COUNT(s.id) AS num_alumnos
FROM classrooms_classroom c
JOIN users_user u ON c.maestro_id = u.id
LEFT JOIN classrooms_student s ON s.classroom_id = c.id AND s.is_active = 1
GROUP BY c.id;

-- Ver encodings faciales por alumno
SELECT s.name, s.matricula, COUNT(fe.id) AS num_muestras
FROM classrooms_student s
LEFT JOIN classrooms_faceencoding fe ON fe.student_id = s.id
GROUP BY s.id;

-- Ver sesiones y asistencia
SELECT ss.id, c.name AS grupo, ss.date, ss.status,
       SUM(CASE WHEN ar.is_present THEN 1 ELSE 0 END) AS presentes,
       COUNT(ar.id) AS total
FROM attendance_session ss
JOIN classrooms_classroom c ON ss.classroom_id = c.id
LEFT JOIN attendance_record ar ON ar.session_id = ss.id
GROUP BY ss.id;

-- Ver análisis de fatiga
SELECT fa.id, s.name AS alumno,
       fa.attention_score, fa.fatigue_score,
       fa.yawn_count, fa.eyes_closed_secs,
       fa.result_label, fa.status, fa.analyzed_at
FROM fatigue_analysis fa
JOIN classrooms_student s ON fa.student_id = s.id;

-- Resetear una sesión para reprocesar
UPDATE attendance_session SET status = 'pending', error_message = '' WHERE id = 1;
DELETE FROM attendance_record WHERE session_id = 1;
```

---

## Solución de errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `No module named 'cv2'` | opencv-python no instalado | `pip install opencv-python` |
| `No module named 'mysqlclient'` | mysqlclient no instalado | `pip install mysqlclient` |
| `django.db.OperationalError` al migrar | MySQL no corre o credenciales incorrectas | Verificar MySQL activo y `backend/.env` |
| `Table 'jipem_db.xxx' doesn't exist` | Migraciones no aplicadas | `python manage.py makemigrations users classrooms attendance fatigue logs && python manage.py migrate` |
| `Credenciales incorrectas` en frontend | Token caducado o usuario incorrecto | Verificar usuario/contraseña, cerrar sesión y volver a entrar |
| Error CORS en consola del navegador | Backend no iniciado o frontend en puerto distinto | Verificar que runserver corre en 8000; `.env` ya incluye puertos 5173 y 5174 |
| Webcam no funciona | Permisos del navegador bloqueados | Clic en ícono de cámara en la barra de URL → Permitir |
| Video tarda mucho | Video largo + CPU lenta | Normal; usa video corto para pruebas (30 seg – 2 min) |
| Frontend en blanco | Error de JS o build | Revisar consola del navegador (F12 → Console) |
| `401 Unauthorized` en todas las peticiones | Token expirado | Cerrar sesión y volver a iniciar |
| `403 Forbidden` | Rol sin permisos para esa acción | Verificar que el usuario tiene el rol correcto |

---

## URLs de referencia rápida

| Recurso | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Django Admin | http://localhost:8000/admin/ |
| API Auth | http://localhost:8000/api/auth/ |
| API Grupos | http://localhost:8000/api/classrooms/ |
| API Asistencia | http://localhost:8000/api/attendance/ |
| API Fatiga | http://localhost:8000/api/fatigue/ |
| Reporte asistencia | http://localhost:8000/api/reports/attendance/?session_id=1 |
| Reporte fatiga | http://localhost:8000/api/reports/fatigue/?student_id=1 |

---

## Comandos de arranque rápido (sesiones posteriores)

Una vez instalado todo, para levantar el sistema:

**Terminal 1 — Backend:**
```bash
cd backend
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux
python manage.py runserver
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Abrir: **http://localhost:5173**
