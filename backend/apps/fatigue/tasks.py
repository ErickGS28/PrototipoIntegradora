import os
import logging
import threading

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Load cascades once at module level
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

# Thresholds
EYE_CLOSED_CONSEC_SECS = 2.0   # seconds with no eyes = "eyes closed" event
YAWN_CONSEC_SECS = 1.0          # seconds with smile = "open mouth / yawn"


def analyze_fatigue_video(analysis_id: int, video_path: str) -> None:
    """
    Analyze fatigue using OpenCV Haarcascade eye and smile detection.
    - Eyes closed: face detected but no eyes found for >= 2 seconds
    - Yawn:       face detected with wide-open mouth (smile cascade) >= 1 second
    Runs in a background thread. Deletes video when done.
    """
    from apps.fatigue.models import FatigueAnalysis

    analysis = None
    try:
        analysis = FatigueAnalysis.objects.get(pk=analysis_id)
        analysis.status = FatigueAnalysis.STATUS_PROCESSING
        analysis.save(update_fields=['status'])

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = 0
        face_frames = 0

        # Eye closure tracking
        no_eye_counter = 0       # consecutive frames with face but no eyes
        eyes_closed_secs = 0.0

        # Yawn tracking
        yawn_counter = 0         # consecutive frames with smile/open mouth
        yawn_in_progress = False
        yawn_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            total_frames += 1
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # Equalize for better detection in varying light
            gray = cv2.equalizeHist(gray)

            faces = _FACE_CASCADE.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
            )

            if len(faces) == 0:
                # No face detected — reset counters, don't penalize
                no_eye_counter = 0
                yawn_counter = 0
                yawn_in_progress = False
                continue

            face_frames += 1
            # Use the largest face
            x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
            face_roi = gray[y:y + h, x:x + w]

            # ---- Eye detection ----
            # Only look in the top 60% of the face (avoid nose/mouth region)
            top_face = face_roi[:int(h * 0.6), :]
            eyes = _EYE_CASCADE.detectMultiScale(
                top_face, scaleFactor=1.1, minNeighbors=3, minSize=(15, 15)
            )

            if len(eyes) == 0:
                no_eye_counter += 1
                # If eyes have been closed for EYE_CLOSED_CONSEC_SECS, count it
                if no_eye_counter >= int(EYE_CLOSED_CONSEC_SECS * fps):
                    eyes_closed_secs += 1.0 / fps
            else:
                # Eyes opened — reset
                if no_eye_counter >= int(EYE_CLOSED_CONSEC_SECS * fps):
                    # We were in a closed-eye event; tally the accumulated time
                    eyes_closed_secs += (no_eye_counter - int(EYE_CLOSED_CONSEC_SECS * fps)) / fps
                no_eye_counter = 0

            # ---- Yawn / open mouth detection ----
            # Look at bottom 50% of the face
            bottom_face = face_roi[int(h * 0.5):, :]
            smiles = _SMILE_CASCADE.detectMultiScale(
                bottom_face, scaleFactor=1.7, minNeighbors=20, minSize=(25, 25)
            )

            if len(smiles) > 0:
                yawn_counter += 1
                if yawn_counter >= int(YAWN_CONSEC_SECS * fps) and not yawn_in_progress:
                    yawn_count += 1
                    yawn_in_progress = True
            else:
                yawn_counter = 0
                yawn_in_progress = False

        cap.release()

        # Handle leftover no_eye_counter
        if no_eye_counter >= int(EYE_CLOSED_CONSEC_SECS * fps):
            eyes_closed_secs += no_eye_counter / fps

        # Use face_frames as reference (only frames where a person was visible)
        effective_duration = max(face_frames / fps, 1.0)

        fatigue_score = min(100.0, (eyes_closed_secs / effective_duration * 100) + (yawn_count * 10))
        attention_score = max(0.0, 100.0 - fatigue_score)

        if attention_score >= 70:
            label = FatigueAnalysis.LABEL_ATENTO
        elif fatigue_score >= 50:
            label = FatigueAnalysis.LABEL_FATIGADO
        else:
            label = FatigueAnalysis.LABEL_DISTRAIDO

        analysis.attention_score = round(attention_score, 2)
        analysis.fatigue_score = round(fatigue_score, 2)
        analysis.yawn_count = yawn_count
        analysis.eyes_closed_secs = round(eyes_closed_secs, 2)
        analysis.result_label = label
        analysis.status = FatigueAnalysis.STATUS_COMPLETED
        analysis.save()

        logger.info(
            f"Fatigue {analysis_id}: attention={attention_score:.1f} "
            f"fatigue={fatigue_score:.1f} yawns={yawn_count} "
            f"eyes_closed={eyes_closed_secs:.1f}s label={label}"
        )

    except Exception as exc:
        logger.exception(f"Error analyzing fatigue {analysis_id}: {exc}")
        if analysis:
            analysis.status = FatigueAnalysis.STATUS_ERROR
            analysis.error_message = str(exc)
            analysis.save(update_fields=['status', 'error_message'])
    finally:
        if os.path.exists(video_path):
            try:
                os.remove(video_path)
            except Exception as e:
                logger.warning(f"Could not delete video {video_path}: {e}")


def start_fatigue_analysis(analysis_id: int, video_path: str) -> None:
    thread = threading.Thread(
        target=analyze_fatigue_video,
        args=(analysis_id, video_path),
        daemon=True,
    )
    thread.start()
