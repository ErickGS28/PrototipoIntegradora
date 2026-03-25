import base64
import io
import os

import cv2
import numpy as np

from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Classroom, Student, FaceEncoding
from .serializers import ClassroomSerializer, StudentSerializer, FaceStatusSerializer

# Load Haarcascade once at module level
_CASCADE_PATH = cv2.data.haarcascades
_FACE_CASCADE = cv2.CascadeClassifier(
    os.path.join(_CASCADE_PATH, 'haarcascade_frontalface_default.xml')
)
FACE_SIZE = (128, 128)


def detect_and_crop_face(rgb_image):
    """
    Detect the largest face in the image and return a 128x128 grayscale crop.
    Returns None if no face is found.
    """
    gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY)
    faces = _FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(60, 60),
    )
    if len(faces) == 0:
        return None
    # Pick the largest face
    x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
    # Add padding
    pad = int(0.1 * min(w, h))
    x = max(0, x - pad)
    y = max(0, y - pad)
    w = min(gray.shape[1] - x, w + 2 * pad)
    h = min(gray.shape[0] - y, h + 2 * pad)
    face_crop = gray[y:y + h, x:x + w]
    face_crop = cv2.resize(face_crop, FACE_SIZE)
    return face_crop


class ClassroomListCreateView(generics.ListCreateAPIView):
    serializer_class = ClassroomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Classroom.objects.filter(is_active=True)
        if not self.request.user.is_admin:
            qs = qs.filter(maestro=self.request.user)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(maestro=self.request.user)


class ClassroomDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClassroomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Classroom.objects.filter(is_active=True)
        if not self.request.user.is_admin:
            qs = qs.filter(maestro=self.request.user)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


class StudentListCreateView(generics.ListCreateAPIView):
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]

    def get_classroom(self):
        qs = Classroom.objects.filter(is_active=True)
        if not self.request.user.is_admin:
            qs = qs.filter(maestro=self.request.user)
        return get_object_or_404(qs, pk=self.kwargs['classroom_id'])

    def get_queryset(self):
        classroom = self.get_classroom()
        return Student.objects.filter(
            classroom=classroom, is_active=True
        ).prefetch_related('face_encodings').order_by('name')

    def perform_create(self, serializer):
        classroom = self.get_classroom()
        serializer.save(classroom=classroom)


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        classroom_qs = Classroom.objects.filter(is_active=True)
        if not self.request.user.is_admin:
            classroom_qs = classroom_qs.filter(maestro=self.request.user)
        classroom = get_object_or_404(classroom_qs, pk=self.kwargs['classroom_id'])
        return Student.objects.filter(
            classroom=classroom, is_active=True
        ).prefetch_related('face_encodings')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


class CaptureFaceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, student_id):
        student = self._get_student(request, student_id)
        image_b64 = request.data.get('image_base64', '')
        if not image_b64:
            return Response({'error': 'Se requiere image_base64.'}, status=400)

        # Decode base64 image
        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]
        try:
            image_data = base64.b64decode(image_b64)
            nparr = np.frombuffer(image_data, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            rgb_img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        except Exception:
            return Response({'error': 'Imagen invalida o corrupta.'}, status=400)

        face_crop = detect_and_crop_face(rgb_img)
        if face_crop is None:
            return Response({'error': 'No se detecto rostro en la imagen.'}, status=400)

        buf = io.BytesIO()
        np.save(buf, face_crop)
        encoding_bytes = buf.getvalue()
        FaceEncoding.objects.create(student=student, encoding_data=encoding_bytes)

        count = student.face_encodings.count()
        return Response({
            'message': 'Muestra facial guardada correctamente.',
            'sample_count': count,
            'has_enough_samples': count >= 5,
        }, status=201)

    def _get_student(self, request, student_id):
        qs = Student.objects.filter(is_active=True)
        if not request.user.is_admin:
            qs = qs.filter(classroom__maestro=request.user)
        return get_object_or_404(qs, pk=student_id)


class FaceStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        qs = Student.objects.filter(is_active=True).prefetch_related('face_encodings')
        if not request.user.is_admin:
            qs = qs.filter(classroom__maestro=request.user)
        student = get_object_or_404(qs, pk=student_id)
        serializer = FaceStatusSerializer(student)
        return Response(serializer.data)
