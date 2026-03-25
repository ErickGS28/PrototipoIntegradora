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

import os
import pickle
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

        # ── Reconocedor LBPH ──────────────────────────────────────────────
        use_recognition = bool(encodings)
        recognizer = None
        if use_recognition:
            face_images = [pickle.loads(bytes(fe.encoding_data)) for fe in encodings]
            recognizer = cv2.face.LBPHFaceRecognizer_create()
            # Todas las muestras del alumno reciben label 0
            recognizer.train(face_images, np.zeros(len(face_images), dtype=np.int32))
            logger.info(f"IndividualFatigue {analysis_id}: LBPH entrenado con {len(face_images)} imágenes.")
        else:
            logger.warning(f"IndividualFatigue {analysis_id}: sin encodings — se analizará el rostro dominante.")

        # ── Apertura del video ────────────────────────────────────────────
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"No se puede abrir el video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0

        # Los contadores avanzan en frames PROCESADOS, no en frames reales.
        # processed_fps = cuántos frames procesados hay por segundo real.
        processed_fps = fps / FRAMES_TO_SKIP
        eye_closed_frames = max(1, int(EYE_CLOSED_CONSEC_SECS * processed_fps))
        yawn_frames_threshold = max(1, int(YAWN_CONSEC_SECS * processed_fps))

        state = {
            'face_frames': 0,           # Frames procesados donde se detectó al alumno
            'eye_detected_frames': 0,   # Frames con ojos detectados (abiertos)
            'no_eye_counter': 0,        # Contador consecutivo sin ojos
            'eyes_closed_secs': 0.0,    # Segundos acumulados con ojos cerrados
            'yawn_counter': 0,          # Contador consecutivo de boca abierta
            'yawn_in_progress': False,  # Flag para no contar el mismo bostezo dos veces
            'yawn_count': 0,            # Total de bostezos detectados
        }

        total_frames = 0
        processed_frames = 0

        # ── Bucle principal de procesamiento ─────────────────────────────
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            total_frames += 1
            if total_frames % FRAMES_TO_SKIP != 0:
                continue  # Saltar frames intermedios

            processed_frames += 1

            # Reducir resolución y convertir a gris ecualizado
            small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            gray_eq = cv2.equalizeHist(gray)

            faces = _FACE_CASCADE.detectMultiScale(
                gray_eq, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)
            )

            if len(faces) == 0:
                # Sin rostro → reiniciar contadores consecutivos
                state['no_eye_counter'] = 0
                state['yawn_counter'] = 0
                state['yawn_in_progress'] = False
                continue

            # ── Seleccionar el rostro del alumno ─────────────────────────
            best_face = None
            if use_recognition:
                best_conf = float('inf')
                for (x, y, w, h) in faces:
                    pad = int(0.1 * min(w, h))
                    x1, y1 = max(0, x - pad), max(0, y - pad)
                    x2, y2 = min(gray.shape[1], x + w + pad), min(gray.shape[0], y + h + pad)
                    face_crop = gray_eq[y1:y2, x1:x2]
                    if face_crop.size == 0:
                        continue
                    face_resized = cv2.resize(face_crop, FACE_SIZE)
                    try:
                        label, confidence = recognizer.predict(face_resized)
                        if confidence < LBPH_CONFIDENCE_THRESHOLD and confidence < best_conf:
                            best_conf = confidence
                            best_face = (x, y, w, h)
                    except Exception:
                        continue
            else:
                # Sin encodings → tomar el rostro más grande del frame
                best_face = max(faces, key=lambda f: f[2] * f[3])

            if best_face is None:
                state['no_eye_counter'] = 0
                state['yawn_counter'] = 0
                state['yawn_in_progress'] = False
                continue

            # ── Recorte del rostro ────────────────────────────────────────
            (x, y, w, h) = best_face
            pad = int(0.1 * min(w, h))
            x1, y1 = max(0, x - pad), max(0, y - pad)
            x2, y2 = min(gray.shape[1], x + w + pad), min(gray.shape[0], y + h + pad)
            face_crop = gray_eq[y1:y2, x1:x2]
            if face_crop.size == 0:
                continue

            state['face_frames'] += 1

            # ── Detección de ojos (zona superior 60% del rostro) ──────────
            top_face = face_crop[:int(face_crop.shape[0] * 0.6), :]
            if top_face.size > 0:
                top_resized = cv2.resize(top_face, (0, 0), fx=2.0, fy=2.0)
                eyes = _EYE_CASCADE.detectMultiScale(
                    top_resized, scaleFactor=1.1, minNeighbors=3, minSize=(15, 15)
                )
                if len(eyes) == 0:
                    state['no_eye_counter'] += 1
                    # Cada frame procesado representa FRAMES_TO_SKIP frames reales
                    if state['no_eye_counter'] >= eye_closed_frames:
                        state['eyes_closed_secs'] += FRAMES_TO_SKIP / fps
                else:
                    state['eye_detected_frames'] += 1
                    state['no_eye_counter'] = 0

            # ── Detección de bostezo (zona inferior 50% del rostro) ───────
            bottom_face = face_crop[int(face_crop.shape[0] * 0.5):, :]
            if bottom_face.size > 0:
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

        cap.release()

        face_frames = state['face_frames']
        logger.info(
            f"IndividualFatigue {analysis_id}: {processed_frames} frames procesados, "
            f"rostro detectado en {face_frames} frames."
        )

        # ── Calcular y guardar resultado ──────────────────────────────────
        if processed_frames > 0 and (face_frames / processed_frames) >= PRESENCE_THRESHOLD_PCT:
            # Duración real en segundos donde se vio al alumno
            effective = max(face_frames * FRAMES_TO_SKIP / fps, 1.0)

            eye_closed_ratio = state['eyes_closed_secs'] / effective
            eye_undetected_ratio = 1.0 - (state['eye_detected_frames'] / max(face_frames, 1))

            eye_fatigue = min(1.0, eye_closed_ratio * 1.5 + eye_undetected_ratio * 0.4)
            fatigue = min(100.0, eye_fatigue * 100 + state['yawn_count'] * 12)
            attention = max(0.0, 100.0 - fatigue)

            logger.info(
                f"IndividualFatigue {analysis_id}: effective={effective:.1f}s "
                f"eyes_closed={state['eyes_closed_secs']:.1f}s "
                f"eye_closed_ratio={eye_closed_ratio:.2f} "
                f"eye_undetected_ratio={eye_undetected_ratio:.2f} "
                f"yawns={state['yawn_count']} "
                f"fatigue={fatigue:.1f}% attention={attention:.1f}%"
            )

            analysis.attention_score = round(attention, 2)
            analysis.fatigue_score = round(fatigue, 2)
            analysis.yawn_count = state['yawn_count']
            analysis.eyes_closed_secs = round(state['eyes_closed_secs'], 2)
            analysis.result_label = _classify(attention)
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
