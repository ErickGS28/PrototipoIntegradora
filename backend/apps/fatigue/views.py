import os
import uuid
import logging

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import FatigueAnalysis
from .serializers import FatigueAnalysisSerializer
from .tasks import start_fatigue_analysis

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv'}
MAX_UPLOAD_SIZE = getattr(settings, 'MAX_UPLOAD_SIZE', 500 * 1024 * 1024)


class FatigueListView(generics.ListAPIView):
    serializer_class = FatigueAnalysisSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = FatigueAnalysis.objects.select_related('student', 'maestro')
        if not self.request.user.is_admin:
            qs = qs.filter(maestro=self.request.user)
        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)
        return qs.order_by('-analyzed_at')


class FatigueAnalyzeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        student_id = request.data.get('student_id')
        video_file = request.FILES.get('video')

        if not student_id:
            return Response({'error': 'Se requiere student_id.'}, status=400)
        if not video_file:
            return Response({'error': 'Se requiere el archivo de video.'}, status=400)

        from apps.classrooms.models import Student
        qs = Student.objects.filter(is_active=True)
        if not request.user.is_admin:
            qs = qs.filter(classroom__maestro=request.user)
        student = get_object_or_404(qs, pk=student_id)

        ext = os.path.splitext(video_file.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {'error': f'Formato no permitido. Use: {", ".join(ALLOWED_EXTENSIONS)}'},
                status=400,
            )

        if video_file.size > MAX_UPLOAD_SIZE:
            return Response({'error': 'El video supera el limite de 500MB.'}, status=400)

        tmp_dir = settings.MEDIA_ROOT / 'tmp'
        tmp_dir.mkdir(parents=True, exist_ok=True)
        filename = f"fatigue_{student.id}_{uuid.uuid4().hex}{ext}"
        video_path = tmp_dir / filename

        with open(video_path, 'wb') as f:
            for chunk in video_file.chunks():
                f.write(chunk)

        analysis = FatigueAnalysis.objects.create(
            student=student,
            maestro=request.user,
        )

        start_fatigue_analysis(analysis.id, str(video_path))

        return Response(FatigueAnalysisSerializer(analysis).data, status=202)


class FatigueDetailView(generics.RetrieveAPIView):
    serializer_class = FatigueAnalysisSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = FatigueAnalysis.objects.select_related('student', 'maestro')
        if not self.request.user.is_admin:
            qs = qs.filter(maestro=self.request.user)
        return qs
