import os
import pickle
import logging
import threading

import cv2
import numpy as np

logger = logging.getLogger(__name__)

FRAMES_TO_SKIP = 5
FACE_SIZE = (128, 128)
LBPH_CONFIDENCE_THRESHOLD = 100
PRESENCE_THRESHOLD_PCT = 0.10  # ≥10% of processed frames to be "present"

EYE_CLOSED_CONSEC_SECS = 0.4   # segundos consecutivos sin ojos para contar como "cerrados"
YAWN_CONSEC_SECS = 0.3         # segundos consecutivos de boca abierta para contar como bostezo

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


def _classify(attention_score):
    if attention_score >= 70:
        return 'atento'
    elif attention_score >= 40:
        return 'distraido'
    return 'fatigado'


def process_fatigue_session(session_id: int, video_path: str) -> None:
    """
    Process a classroom video combining LBPH face recognition with per-student
    fatigue analysis (eye closure + yawn detection).
    Runs in a background thread. Deletes video when done.
    """
    from apps.fatigue.models import FatigueSession, FatigueRecord
    from apps.classrooms.models import Student, FaceEncoding

    session = None
    try:
        session = FatigueSession.objects.get(pk=session_id)
        session.status = FatigueSession.STATUS_PROCESSING
        session.save(update_fields=['status'])

        classroom = session.classroom
        students = list(Student.objects.filter(
            classroom=classroom, is_active=True
        ).prefetch_related('face_encodings'))

        # Build LBPH recognizer
        face_images, labels, label_to_student_id = [], [], {}
        for idx, student in enumerate(students):
            encodings = list(student.face_encodings.all())
            if not encodings:
                continue
            for fe in encodings:
                face_images.append(pickle.loads(bytes(fe.encoding_data)))
                labels.append(idx)
            label_to_student_id[idx] = student.id

        if not face_images:
            logger.warning(f"FatigueSession {session_id}: no face encodings, marking all absent.")
            _finalize_session(session, students, {})
            return

        recognizer = cv2.face.LBPHFaceRecognizer_create()
        recognizer.train(face_images, np.array(labels, dtype=np.int32))
        logger.info(f"FatigueSession {session_id}: LBPH trained on {len(face_images)} images.")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        processed_fps = fps / FRAMES_TO_SKIP
        eye_closed_frames = max(1, int(EYE_CLOSED_CONSEC_SECS * processed_fps))
        yawn_frames = max(1, int(YAWN_CONSEC_SECS * processed_fps))

        # Per-student tracking state
        state = {}

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

            faces = _FACE_CASCADE.detectMultiScale(
                gray_eq, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)
            )

            seen_this_frame = set()

            for (x, y, w, h) in (faces if len(faces) > 0 else []):
                pad = int(0.1 * min(w, h))
                x1, y1 = max(0, x - pad), max(0, y - pad)
                x2, y2 = min(gray.shape[1], x + w + pad), min(gray.shape[0], y + h + pad)
                face_crop = gray_eq[y1:y2, x1:x2]
                if face_crop.size == 0:
                    continue
                face_resized = cv2.resize(face_crop, FACE_SIZE)

                try:
                    label, confidence = recognizer.predict(face_resized)
                except Exception:
                    continue

                if confidence >= LBPH_CONFIDENCE_THRESHOLD:
                    continue

                sid = label_to_student_id.get(label)
                if not sid:
                    continue

                seen_this_frame.add(sid)

                if sid not in state:
                    state[sid] = {
                        'face_frames': 0,
                        'eye_detected_frames': 0,
                        'no_eye_counter': 0,
                        'eyes_closed_secs': 0.0,
                        'yawn_counter': 0,
                        'yawn_in_progress': False,
                        'yawn_count': 0,
                    }

                s = state[sid]
                s['face_frames'] += 1

                # Eye detection on top 60% of face
                top_face = face_crop[:int(face_crop.shape[0] * 0.6), :]
                if top_face.size > 0:
                    top_resized = cv2.resize(top_face, (0, 0), fx=2.0, fy=2.0)
                    eyes = _EYE_CASCADE.detectMultiScale(
                        top_resized, scaleFactor=1.1, minNeighbors=3, minSize=(15, 15)
                    )
                    if len(eyes) == 0:
                        s['no_eye_counter'] += 1
                        if s['no_eye_counter'] >= eye_closed_frames:
                            s['eyes_closed_secs'] += FRAMES_TO_SKIP / fps
                    else:
                        s['eye_detected_frames'] += 1
                        s['no_eye_counter'] = 0

                # Yawn detection on bottom 50% of face
                bottom_face = face_crop[int(face_crop.shape[0] * 0.5):, :]
                if bottom_face.size > 0:
                    bottom_resized = cv2.resize(bottom_face, (0, 0), fx=2.0, fy=2.0)
                    smiles = _SMILE_CASCADE.detectMultiScale(
                        bottom_resized, scaleFactor=1.3, minNeighbors=10, minSize=(20, 20)
                    )
                    if len(smiles) > 0:
                        s['yawn_counter'] += 1
                        if s['yawn_counter'] >= yawn_frames and not s['yawn_in_progress']:
                            s['yawn_count'] += 1
                            s['yawn_in_progress'] = True
                    else:
                        s['yawn_counter'] = 0
                        s['yawn_in_progress'] = False

            # Reset consecutive counters for students not seen this frame
            for sid, s in state.items():
                if sid not in seen_this_frame:
                    s['no_eye_counter'] = 0
                    s['yawn_counter'] = 0
                    s['yawn_in_progress'] = False

        cap.release()
        logger.info(
            f"FatigueSession {session_id}: {processed_frames} frames processed, "
            f"students seen: {list(state.keys())}"
        )

        # Build results per student
        results = {}
        for sid, s in state.items():
            face_frames = s['face_frames']
            if processed_frames > 0 and (face_frames / processed_frames) >= PRESENCE_THRESHOLD_PCT:
                effective = max(face_frames * FRAMES_TO_SKIP / fps, 1.0)
                eye_closed_ratio = s['eyes_closed_secs'] / effective
                eye_undetected_ratio = 1.0 - (s['eye_detected_frames'] / max(face_frames, 1))
                eye_fatigue = min(1.0, eye_closed_ratio * 1.5 + eye_undetected_ratio * 0.4)
                fatigue = min(100.0, eye_fatigue * 100 + s['yawn_count'] * 12)
                attention = max(0.0, 100.0 - fatigue)
                results[sid] = {
                    'is_present': True,
                    'attention_score': round(attention, 2),
                    'fatigue_score': round(fatigue, 2),
                    'yawn_count': s['yawn_count'],
                    'eyes_closed_secs': round(s['eyes_closed_secs'], 2),
                    'result_label': _classify(attention),
                }

        _finalize_session(session, students, results)

    except Exception as exc:
        logger.exception(f"Error processing fatigue session {session_id}: {exc}")
        if session:
            session.status = FatigueSession.STATUS_ERROR
            session.error_message = str(exc)
            session.save(update_fields=['status', 'error_message'])
    finally:
        if os.path.exists(video_path):
            try:
                os.remove(video_path)
                logger.info(f"Deleted video: {video_path}")
            except Exception as e:
                logger.warning(f"Could not delete video {video_path}: {e}")


def _finalize_session(session, students, results):
    from apps.fatigue.models import FatigueRecord

    records = []
    for student in students:
        r = results.get(student.id, {})
        records.append(FatigueRecord(
            session=session,
            student=student,
            is_present=r.get('is_present', False),
            attention_score=r.get('attention_score', 0.0),
            fatigue_score=r.get('fatigue_score', 0.0),
            yawn_count=r.get('yawn_count', 0),
            eyes_closed_secs=r.get('eyes_closed_secs', 0.0),
            result_label=r.get('result_label', ''),
        ))

    FatigueRecord.objects.bulk_create(records, ignore_conflicts=True)
    session.status = FatigueSession.STATUS_COMPLETED
    session.save(update_fields=['status'])


def start_fatigue_processing(session_id: int, video_path: str) -> None:
    thread = threading.Thread(
        target=process_fatigue_session,
        args=(session_id, video_path),
        daemon=True,
    )
    thread.start()


# ── Individual student fatigue processing ─────────────────────────────────

def process_individual_fatigue(analysis_id: int, video_path: str) -> None:
    """
    Process a video for a single student: uses LBPH to confirm identity,
    then measures fatigue (eye closure + yawn detection).
    Falls back to analysing the dominant face if the student has no encodings.
    Runs in a background thread. Deletes video when done.
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

        # Build LBPH recognizer for this student (label 0)
        use_recognition = bool(encodings)
        recognizer = None
        if use_recognition:
            face_images = [pickle.loads(bytes(fe.encoding_data)) for fe in encodings]
            recognizer = cv2.face.LBPHFaceRecognizer_create()
            recognizer.train(face_images, np.zeros(len(face_images), dtype=np.int32))
            logger.info(f"IndividualFatigue {analysis_id}: LBPH trained on {len(face_images)} images.")
        else:
            logger.warning(f"IndividualFatigue {analysis_id}: no encodings, analysing dominant face.")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        # Los contadores avanzan en frames PROCESADOS (1 de cada FRAMES_TO_SKIP),
        # así que los umbrales deben estar en la misma unidad.
        processed_fps = fps / FRAMES_TO_SKIP
        eye_closed_frames = max(1, int(EYE_CLOSED_CONSEC_SECS * processed_fps))
        yawn_frames_threshold = max(1, int(YAWN_CONSEC_SECS * processed_fps))

        state = {
            'face_frames': 0,
            'eye_detected_frames': 0,   # frames con ojos detectados (abiertos)
            'no_eye_counter': 0,
            'eyes_closed_secs': 0.0,
            'yawn_counter': 0,
            'yawn_in_progress': False,
            'yawn_count': 0,
        }

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

            faces = _FACE_CASCADE.detectMultiScale(
                gray_eq, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)
            )

            if len(faces) == 0:
                state['no_eye_counter'] = 0
                state['yawn_counter'] = 0
                state['yawn_in_progress'] = False
                continue

            # Pick the face belonging to the student (largest confirmed face, or largest face)
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
                # Pick the largest face
                best_face = max(faces, key=lambda f: f[2] * f[3])

            if best_face is None:
                state['no_eye_counter'] = 0
                state['yawn_counter'] = 0
                state['yawn_in_progress'] = False
                continue

            (x, y, w, h) = best_face
            pad = int(0.1 * min(w, h))
            x1, y1 = max(0, x - pad), max(0, y - pad)
            x2, y2 = min(gray.shape[1], x + w + pad), min(gray.shape[0], y + h + pad)
            face_crop = gray_eq[y1:y2, x1:x2]
            if face_crop.size == 0:
                continue

            state['face_frames'] += 1

            # Eye detection on top 60% of face
            top_face = face_crop[:int(face_crop.shape[0] * 0.6), :]
            if top_face.size > 0:
                top_resized = cv2.resize(top_face, (0, 0), fx=2.0, fy=2.0)
                eyes = _EYE_CASCADE.detectMultiScale(
                    top_resized, scaleFactor=1.1, minNeighbors=3, minSize=(15, 15)
                )
                if len(eyes) == 0:
                    state['no_eye_counter'] += 1
                    # BUG FIX: cada frame procesado representa FRAMES_TO_SKIP frames reales
                    if state['no_eye_counter'] >= eye_closed_frames:
                        state['eyes_closed_secs'] += FRAMES_TO_SKIP / fps
                else:
                    state['eye_detected_frames'] += 1
                    state['no_eye_counter'] = 0

            # Yawn detection on bottom 50% of face
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
            f"IndividualFatigue {analysis_id}: {processed_frames} frames processed, "
            f"student face detected in {face_frames} frames."
        )

        if processed_frames > 0 and (face_frames / processed_frames) >= PRESENCE_THRESHOLD_PCT:
            # BUG FIX: face_frames son frames PROCESADOS; duración real = face_frames * FRAMES_TO_SKIP / fps
            effective = max(face_frames * FRAMES_TO_SKIP / fps, 1.0)

            # Métrica 1: ratio de tiempo con ojos cerrados
            eye_closed_ratio = state['eyes_closed_secs'] / effective

            # Métrica 2: ratio de frames sin ojos detectados (somnolencia general)
            eye_undetected_ratio = 1.0 - (state['eye_detected_frames'] / max(face_frames, 1))

            # Combinar: peso mayor a cierre prolongado, peso menor a no-detección general
            eye_fatigue = min(1.0, eye_closed_ratio * 1.5 + eye_undetected_ratio * 0.4)

            fatigue = min(100.0, eye_fatigue * 100 + state['yawn_count'] * 12)
            attention = max(0.0, 100.0 - fatigue)

            logger.info(
                f"IndividualFatigue {analysis_id}: effective={effective:.1f}s "
                f"eyes_closed={state['eyes_closed_secs']:.1f}s eye_closed_ratio={eye_closed_ratio:.2f} "
                f"eye_undetected_ratio={eye_undetected_ratio:.2f} yawns={state['yawn_count']} "
                f"fatigue={fatigue:.1f}% attention={attention:.1f}%"
            )

            analysis.attention_score = round(attention, 2)
            analysis.fatigue_score = round(fatigue, 2)
            analysis.yawn_count = state['yawn_count']
            analysis.eyes_closed_secs = round(state['eyes_closed_secs'], 2)
            analysis.result_label = _classify(attention)
        else:
            # Face not detected enough — set neutral values, still mark completed
            logger.warning(
                f"IndividualFatigue {analysis_id}: face detected in only "
                f"{face_frames}/{processed_frames} processed frames — below threshold."
            )
            analysis.result_label = ''

        analysis.status = IndividualFatigueAnalysis.STATUS_COMPLETED
        analysis.save(update_fields=[
            'status', 'attention_score', 'fatigue_score',
            'yawn_count', 'eyes_closed_secs', 'result_label',
        ])

    except Exception as exc:
        logger.exception(f"Error processing individual fatigue {analysis_id}: {exc}")
        if analysis:
            analysis.status = IndividualFatigueAnalysis.STATUS_ERROR
            analysis.error_message = str(exc)
            analysis.save(update_fields=['status', 'error_message'])
    finally:
        if os.path.exists(video_path):
            try:
                os.remove(video_path)
                logger.info(f"Deleted video: {video_path}")
            except Exception as e:
                logger.warning(f"Could not delete video {video_path}: {e}")


def start_individual_fatigue_processing(analysis_id: int, video_path: str) -> None:
    thread = threading.Thread(
        target=process_individual_fatigue,
        args=(analysis_id, video_path),
        daemon=True,
    )
    thread.start()
