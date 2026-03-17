import os
import uuid
import logging

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AttendanceSession, AttendanceRecord
from .serializers import (
    AttendanceSessionSerializer,
    AttendanceSessionListSerializer,
)
from .tasks import start_attendance_processing

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv'}
MAX_UPLOAD_SIZE = getattr(settings, 'MAX_UPLOAD_SIZE', 500 * 1024 * 1024)


class SessionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return AttendanceSessionListSerializer
        return AttendanceSessionSerializer

    def get_queryset(self):
        qs = AttendanceSession.objects.select_related(
            'classroom', 'maestro'
        ).prefetch_related('records')
        if not self.request.user.is_admin:
            qs = qs.filter(maestro=self.request.user)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        # Validate classroom belongs to maestro
        classroom = serializer.validated_data['classroom']
        if not self.request.user.is_admin and classroom.maestro != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No tienes acceso a este grupo.")
        serializer.save(maestro=self.request.user)


class SessionDetailView(generics.RetrieveAPIView):
    serializer_class = AttendanceSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = AttendanceSession.objects.select_related(
            'classroom', 'maestro'
        ).prefetch_related('records__student')
        if not self.request.user.is_admin:
            qs = qs.filter(maestro=self.request.user)
        return qs


class UploadVideoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = self._get_session(request, session_id)

        if session.status in (
            AttendanceSession.STATUS_PROCESSING,
            AttendanceSession.STATUS_COMPLETED,
        ):
            return Response(
                {'error': f'La sesion ya esta en estado: {session.status}'},
                status=400,
            )

        video_file = request.FILES.get('video')
        if not video_file:
            return Response({'error': 'Se requiere el archivo de video.'}, status=400)

        # Validate extension
        ext = os.path.splitext(video_file.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {'error': f'Formato no permitido. Use: {", ".join(ALLOWED_EXTENSIONS)}'},
                status=400,
            )

        # Validate size
        if video_file.size > MAX_UPLOAD_SIZE:
            return Response({'error': 'El video supera el limite de 500MB.'}, status=400)

        # Save to tmp
        tmp_dir = settings.MEDIA_ROOT / 'tmp'
        tmp_dir.mkdir(parents=True, exist_ok=True)
        filename = f"session_{session.id}_{uuid.uuid4().hex}{ext}"
        video_path = tmp_dir / filename

        with open(video_path, 'wb') as f:
            for chunk in video_file.chunks():
                f.write(chunk)

        # Start background processing
        start_attendance_processing(session.id, str(video_path))

        return Response({
            'message': 'Video recibido. Procesando asistencia en segundo plano.',
            'session_id': session.id,
            'status': AttendanceSession.STATUS_PROCESSING,
        }, status=202)

    def _get_session(self, request, session_id):
        qs = AttendanceSession.objects.all()
        if not request.user.is_admin:
            qs = qs.filter(maestro=request.user)
        return get_object_or_404(qs, pk=session_id)


class SessionStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        qs = AttendanceSession.objects.all()
        if not request.user.is_admin:
            qs = qs.filter(maestro=request.user)
        session = get_object_or_404(qs, pk=session_id)
        return Response({
            'session_id': session.id,
            'status': session.status,
            'error_message': session.error_message,
        })


class AttendanceRecordToggleView(APIView):
    """Toggle is_present for a single attendance record (manual correction)."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, record_id):
        qs = AttendanceRecord.objects.select_related('session__classroom')
        if not request.user.is_admin:
            qs = qs.filter(session__maestro=request.user)
        record = get_object_or_404(qs, pk=record_id)

        record.is_present = not record.is_present
        record.save(update_fields=['is_present'])

        return Response({
            'id': record.id,
            'is_present': record.is_present,
        })
