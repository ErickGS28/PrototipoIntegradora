"""
Fatigue analysis processing — individual student video.

Pipeline:
  1. Cargar encodings faciales del alumno y entrenar reconocedor LBPH.
  2. Leer el video frame a frame (se procesa 1 de cada FRAMES_TO_SKIP).
  3. Detectar el rostro del alumno con Haarcascade frontal + LBPH matching.
  4. Sobre cada rostro detectado:
       - Analizar zona superior (60%) → detectar ojos abiertos con haarcascade_eye.
       - Analizar zona inferior (50%) → detectar boca abierta con haarcascade_smile.
  5. Calcular métricas acumuladas:
       - eyes_closed_secs: segundos con ojos cerrados de forma consecutiva.
       - yawn_count: número de bostezos (apertura mantenida ≥ YAWN_CONSEC_SECS).
       - eye_undetected_ratio: fracción de frames de cara sin ojos detectados.
  6. Fórmula de fatiga:
       eye_fatigue = eye_closed_ratio*1.5 + eye_undetected_ratio*0.4  (clamped 0–1)
       fatigue_score = eye_fatigue*100 + yawn_count*12  (clamped 0–100)
       attention_score = 100 - fatigue_score
  7. Clasificación: atento (≥70), distraido (40–69), fatigado (<40).
  8. Guardar resultado en IndividualFatigueAnalysis y eliminar el video.
"""

import io
import os
import logging
import threading

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Constantes de procesamiento ────────────────────────────────────────────
FRAMES_TO_SKIP = 5              # Se procesa 1 de cada N frames (rendimiento)
FACE_SIZE = (128, 128)          # Tamaño normalizado para el reconocedor LBPH
LBPH_CONFIDENCE_THRESHOLD = 100 # Confianza máxima aceptable (menor = más parecido)
PRESENCE_THRESHOLD_PCT = 0.10   # El alumno debe aparecer en ≥10% de frames procesados

EYE_CLOSED_CONSEC_SECS = 0.4   # Segundos consecutivos sin ojos para acumular cierre
YAWN_CONSEC_SECS = 0.3          # Segundos consecutivos de boca abierta para contar bostezo

# ── Clasificadores Haarcascade (se cargan una sola vez al importar el módulo) ──
_CASCADE_PATH = cv2.data.haarcascades
_FACE_CASCADE = cv2.CascadeClassifier(
    os.path.join(_CASCADE_PATH, 'haarcascade_frontalface_default.xml')
)
_EYE_CASCADE = cv2.CascadeClassifier(
    os.path.join(_CASCADE_PATH, 'haarcascade_eye.xml')
)
_SMILE_CASCADE = cv2.CascadeClassifier(
    os.path.join(_CASCADE_PATH, 'haarcascade_smile.xml')
)


def _classify(attention_score: float) -> str:
    """Devuelve la etiqueta de clasificación según el score de atención."""
    if attention_score >= 70:
        return 'atento'
    elif attention_score >= 40:
        return 'distraido'
    return 'fatigado'


def _build_student_recognizer(encodings):
    """Entrena un reconocedor LBPH con las muestras del alumno. Retorna recognizer o None."""
    if not encodings:
        return None
    face_images = [np.load(io.BytesIO(bytes(fe.encoding_data))) for fe in encodings]
    recognizer = cv2.face.LBPHFaceRecognizer_create()
    recognizer.train(face_images, np.zeros(len(face_images), dtype=np.int32))
    return recognizer


def _select_best_face(faces, gray_eq, recognizer):
    """Selecciona el rostro del alumno entre los detectados.

    Con reconocedor: elige el de menor confianza LBPH dentro del umbral.
    Sin reconocedor: elige el rostro más grande.
    Retorna (x, y, w, h) o None.
    """
    if recognizer is None:
        return max(faces, key=lambda f: f[2] * f[3])

    best_face = None
    best_conf = float('inf')
    for (x, y, w, h) in faces:
        pad = int(0.1 * min(w, h))
        x1, y1 = max(0, x - pad), max(0, y - pad)
        x2, y2 = min(gray_eq.shape[1], x + w + pad), min(gray_eq.shape[0], y + h + pad)
        face_crop = gray_eq[y1:y2, x1:x2]
        if face_crop.size == 0:
            continue
        face_resized = cv2.resize(face_crop, FACE_SIZE)
        try:
            _, confidence = recognizer.predict(face_resized)
            if confidence < LBPH_CONFIDENCE_THRESHOLD and confidence < best_conf:
                best_conf = confidence
                best_face = (x, y, w, h)
        except Exception:
            continue
    return best_face


def _reset_consecutive_counters(state):
    """Reinicia contadores consecutivos de ojos/bostezo cuando no hay rostro."""
    state['no_eye_counter'] = 0
    state['yawn_counter'] = 0
    state['yawn_in_progress'] = False


def _analyze_eyes(face_crop, state, eye_closed_frames, fps):
    """Detecta ojos en la zona superior (60%) del rostro y actualiza el estado."""
    top_face = face_crop[:int(face_crop.shape[0] * 0.6), :]
    if top_face.size == 0:
        return
    top_resized = cv2.resize(top_face, (0, 0), fx=2.0, fy=2.0)
    eyes = _EYE_CASCADE.detectMultiScale(
        top_resized, scaleFactor=1.1, minNeighbors=3, minSize=(15, 15)
    )
    if len(eyes) == 0:
        state['no_eye_counter'] += 1
        if state['no_eye_counter'] >= eye_closed_frames:
            state['eyes_closed_secs'] += FRAMES_TO_SKIP / fps
    else:
        state['eye_detected_frames'] += 1
        state['no_eye_counter'] = 0


def _analyze_yawn(face_crop, state, yawn_frames_threshold):
    """Detecta boca abierta en la zona inferior (50%) del rostro y actualiza el estado."""
    bottom_face = face_crop[int(face_crop.shape[0] * 0.5):, :]
    if bottom_face.size == 0:
        return
    bottom_resized = cv2.resize(bottom_face, (0, 0), fx=2.0, fy=2.0)
    smiles = _SMILE_CASCADE.detectMultiScale(
        bottom_resized, scaleFactor=1.3, minNeighbors=10, minSize=(20, 20)
    )
    if len(smiles) > 0:
        state['yawn_counter'] += 1
        if state['yawn_counter'] >= yawn_frames_threshold and not state['yawn_in_progress']:
            state['yawn_count'] += 1
            state['yawn_in_progress'] = True
    else:
        state['yawn_counter'] = 0
        state['yawn_in_progress'] = False


def _process_single_frame(gray_eq, state, recognizer, use_recognition, eye_closed_frames, yawn_frames_threshold, fps):
    """Detecta y analiza el rostro del alumno en un frame preprocesado."""
    faces = _FACE_CASCADE.detectMultiScale(
        gray_eq, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)
    )
    if len(faces) == 0:
        _reset_consecutive_counters(state)
        return

    best_face = _select_best_face(faces, gray_eq, recognizer if use_recognition else None)
    if best_face is None:
        _reset_consecutive_counters(state)
        return

    (x, y, w, h) = best_face
    pad = int(0.1 * min(w, h))
    x1, y1 = max(0, x - pad), max(0, y - pad)
    x2, y2 = min(gray_eq.shape[1], x + w + pad), min(gray_eq.shape[0], y + h + pad)
    face_crop = gray_eq[y1:y2, x1:x2]
    if face_crop.size == 0:
        return

    state['face_frames'] += 1
    _analyze_eyes(face_crop, state, eye_closed_frames, fps)
    _analyze_yawn(face_crop, state, yawn_frames_threshold)


def _run_video_loop(cap, fps, recognizer, use_recognition, state, eye_closed_frames, yawn_frames_threshold):
    """Lee el video frame a frame y procesa cada uno. Retorna el número de frames procesados."""
    total_frames = 0
    processed_frames = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        total_frames += 1
        if total_frames % FRAMES_TO_SKIP != 0:
            continue
        processed_frames += 1
        small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        gray_eq = cv2.equalizeHist(gray)
        _process_single_frame(
            gray_eq, state, recognizer, use_recognition,
            eye_closed_frames, yawn_frames_threshold, fps,
        )

    return processed_frames


def _compute_fatigue_scores(state, face_frames, fps):
    """Calcula attention/fatigue scores a partir del estado acumulado. Retorna dict de scores."""
    effective = max(face_frames * FRAMES_TO_SKIP / fps, 1.0)
    eye_closed_ratio = state['eyes_closed_secs'] / effective
    eye_undetected_ratio = 1.0 - (state['eye_detected_frames'] / max(face_frames, 1))
    eye_fatigue = min(1.0, eye_closed_ratio * 1.5 + eye_undetected_ratio * 0.4)
    fatigue = min(100.0, eye_fatigue * 100 + state['yawn_count'] * 12)
    attention = max(0.0, 100.0 - fatigue)
    return {
        'attention': attention,
        'fatigue': fatigue,
        'yawn_count': state['yawn_count'],
        'eyes_closed_secs': state['eyes_closed_secs'],
        'eye_closed_ratio': eye_closed_ratio,
        'eye_undetected_ratio': eye_undetected_ratio,
        'effective': effective,
    }


def process_individual_fatigue(analysis_id: int, video_path: str) -> None:
    """
    Procesa un video individual de un alumno y guarda el resultado
    en IndividualFatigueAnalysis. Corre en un hilo daemon; el video
    se elimina siempre en el bloque finally.
    """
    from apps.fatigue.models import IndividualFatigueAnalysis
    from apps.classrooms.models import FaceEncoding

    analysis = None
    try:
        analysis = IndividualFatigueAnalysis.objects.select_related('student').get(pk=analysis_id)
        analysis.status = IndividualFatigueAnalysis.STATUS_PROCESSING
        analysis.save(update_fields=['status'])

        student = analysis.student
        encodings = list(FaceEncoding.objects.filter(student=student))
        recognizer = _build_student_recognizer(encodings)
        use_recognition = recognizer is not None

        if use_recognition:
            logger.info(f"IndividualFatigue {analysis_id}: LBPH entrenado con {len(encodings)} imágenes.")
        else:
            logger.warning(f"IndividualFatigue {analysis_id}: sin encodings — se analizará el rostro dominante.")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"No se puede abrir el video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        eye_closed_frames = max(1, int(EYE_CLOSED_CONSEC_SECS * fps / FRAMES_TO_SKIP))
        yawn_frames_threshold = max(1, int(YAWN_CONSEC_SECS * fps / FRAMES_TO_SKIP))

        state = {
            'face_frames': 0, 'eye_detected_frames': 0, 'no_eye_counter': 0,
            'eyes_closed_secs': 0.0, 'yawn_counter': 0,
            'yawn_in_progress': False, 'yawn_count': 0,
        }

        processed_frames = _run_video_loop(
            cap, fps, recognizer, use_recognition, state,
            eye_closed_frames, yawn_frames_threshold,
        )
        cap.release()

        face_frames = state['face_frames']
        logger.info(
            f"IndividualFatigue {analysis_id}: {processed_frames} frames procesados, "
            f"rostro detectado en {face_frames} frames."
        )

        if processed_frames > 0 and (face_frames / processed_frames) >= PRESENCE_THRESHOLD_PCT:
            scores = _compute_fatigue_scores(state, face_frames, fps)
            logger.info(
                f"IndividualFatigue {analysis_id}: effective={scores['effective']:.1f}s "
                f"eye_closed_ratio={scores['eye_closed_ratio']:.2f} "
                f"eye_undetected_ratio={scores['eye_undetected_ratio']:.2f} "
                f"yawns={scores['yawn_count']} "
                f"fatigue={scores['fatigue']:.1f}% attention={scores['attention']:.1f}%"
            )
            analysis.attention_score = round(scores['attention'], 2)
            analysis.fatigue_score = round(scores['fatigue'], 2)
            analysis.yawn_count = scores['yawn_count']
            analysis.eyes_closed_secs = round(scores['eyes_closed_secs'], 2)
            analysis.result_label = _classify(scores['attention'])
        else:
            logger.warning(
                f"IndividualFatigue {analysis_id}: rostro detectado en solo "
                f"{face_frames}/{processed_frames} frames — por debajo del umbral."
            )
            analysis.result_label = ''

        analysis.status = IndividualFatigueAnalysis.STATUS_COMPLETED
        analysis.save(update_fields=[
            'status', 'attention_score', 'fatigue_score',
            'yawn_count', 'eyes_closed_secs', 'result_label',
        ])

    except Exception as exc:
        logger.exception(f"Error procesando fatiga individual {analysis_id}: {exc}")
        if analysis:
            analysis.status = IndividualFatigueAnalysis.STATUS_ERROR
            analysis.error_message = str(exc)
            analysis.save(update_fields=['status', 'error_message'])
    finally:
        if os.path.exists(video_path):
            try:
                os.remove(video_path)
                logger.info(f"Video eliminado: {video_path}")
            except Exception as e:
                logger.warning(f"No se pudo eliminar el video {video_path}: {e}")


def start_individual_fatigue_processing(analysis_id: int, video_path: str) -> None:
    """Lanza process_individual_fatigue en un hilo daemon."""
    thread = threading.Thread(
        target=process_individual_fatigue,
        args=(analysis_id, video_path),
        daemon=True,
    )
    thread.start()
