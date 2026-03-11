import os
import pickle
import logging
import threading

import cv2
import numpy as np

logger = logging.getLogger(__name__)

PRESENCE_THRESHOLD_MINUTES = 40
FRAMES_TO_SKIP = 15  # Process 1 of every 15 frames for better detection
FACE_SIZE = (128, 128)
LBPH_CONFIDENCE_THRESHOLD = 90  # Lower = more strict match

# Load cascade once at module level
_CASCADE_PATH = cv2.data.haarcascades
_FACE_CASCADE = cv2.CascadeClassifier(
    os.path.join(_CASCADE_PATH, 'haarcascade_frontalface_default.xml')
)


def _detect_faces_gray(gray_frame):
    """Detect faces in a grayscale frame. Returns list of (x,y,w,h)."""
    faces = _FACE_CASCADE.detectMultiScale(
        gray_frame,
        scaleFactor=1.1,
        minNeighbors=4,
        minSize=(40, 40),
    )
    return faces if len(faces) > 0 else []


def process_attendance_video(session_id: int, video_path: str) -> None:
    """
    Process a classroom video to determine attendance using OpenCV LBPH.
    Runs in a background thread. Deletes video when done.
    """
    from apps.attendance.models import AttendanceSession, AttendanceRecord
    from apps.classrooms.models import Student, FaceEncoding

    session = None
    try:
        session = AttendanceSession.objects.get(pk=session_id)
        session.status = AttendanceSession.STATUS_PROCESSING
        session.save(update_fields=['status'])

        classroom = session.classroom
        students = list(Student.objects.filter(
            classroom=classroom, is_active=True
        ).prefetch_related('face_encodings'))

        # Build LBPH recognizer from stored face images
        face_images = []
        labels = []
        label_to_student_id = {}

        for idx, student in enumerate(students):
            encodings = list(student.face_encodings.all())
            if not encodings:
                continue
            for fe in encodings:
                face_img = pickle.loads(bytes(fe.encoding_data))
                face_images.append(face_img)
                labels.append(idx)
            label_to_student_id[idx] = student.id

        if not face_images:
            logger.warning(f"Session {session_id}: No face encodings found — marking all absent.")
            _finalize_session(session, students, {})
            return

        recognizer = cv2.face.LBPHFaceRecognizer_create()
        recognizer.train(face_images, np.array(labels, dtype=np.int32))
        logger.info(f"Session {session_id}: Trained LBPH on {len(face_images)} images for {len(label_to_student_id)} students.")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        frame_count_map = {}  # student_id -> detected frame count
        total_frames = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if total_frames % FRAMES_TO_SKIP != 0:
                total_frames += 1
                continue

            # Resize for performance
            small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

            detected_faces = _detect_faces_gray(gray)
            for (x, y, w, h) in detected_faces:
                pad = int(0.1 * min(w, h))
                x1 = max(0, x - pad)
                y1 = max(0, y - pad)
                x2 = min(gray.shape[1], x + w + pad)
                y2 = min(gray.shape[0], y + h + pad)
                face_crop = gray[y1:y2, x1:x2]
                if face_crop.size == 0:
                    continue
                face_crop = cv2.resize(face_crop, FACE_SIZE)

                try:
                    label, confidence = recognizer.predict(face_crop)
                    if confidence < LBPH_CONFIDENCE_THRESHOLD:
                        sid = label_to_student_id.get(label)
                        if sid:
                            frame_count_map[sid] = frame_count_map.get(sid, 0) + 1
                except Exception:
                    pass

            total_frames += 1

        cap.release()

        # Convert frame counts to minutes
        # Each detected frame represents FRAMES_TO_SKIP real frames at FPS
        minutes_map = {}
        for sid, count in frame_count_map.items():
            actual_frames = count * FRAMES_TO_SKIP
            minutes_map[sid] = int(actual_frames / fps / 60)

        _finalize_session(session, students, minutes_map)

    except Exception as exc:
        logger.exception(f"Error processing session {session_id}: {exc}")
        if session:
            session.status = AttendanceSession.STATUS_ERROR
            session.error_message = str(exc)
            session.save(update_fields=['status', 'error_message'])
    finally:
        if os.path.exists(video_path):
            try:
                os.remove(video_path)
                logger.info(f"Deleted video: {video_path}")
            except Exception as e:
                logger.warning(f"Could not delete video {video_path}: {e}")


def _finalize_session(session, students, minutes_map):
    from apps.attendance.models import AttendanceRecord

    records = []
    for student in students:
        minutes = minutes_map.get(student.id, 0)
        records.append(AttendanceRecord(
            session=session,
            student=student,
            minutes_present=minutes,
            is_present=minutes >= PRESENCE_THRESHOLD_MINUTES,
        ))

    AttendanceRecord.objects.bulk_create(records, ignore_conflicts=True)
    session.status = session.STATUS_COMPLETED
    session.save(update_fields=['status'])


def start_attendance_processing(session_id: int, video_path: str) -> None:
    thread = threading.Thread(
        target=process_attendance_video,
        args=(session_id, video_path),
        daemon=True,
    )
    thread.start()
