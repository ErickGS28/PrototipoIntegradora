from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.http import HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.attendance.models import AttendanceSession
from apps.fatigue.models import FatigueAnalysis
from apps.classrooms.models import Student


class AttendanceReportView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        session_id = request.query_params.get('session_id')
        classroom_id = request.query_params.get('classroom_id')
        date = request.query_params.get('date')

        if session_id:
            qs = AttendanceSession.objects.select_related(
                'classroom', 'maestro'
            ).prefetch_related('records__student')
            session = get_object_or_404(qs, pk=session_id)
        elif classroom_id and date:
            qs = AttendanceSession.objects.select_related(
                'classroom', 'maestro'
            ).prefetch_related('records__student')
            session = get_object_or_404(qs, classroom_id=classroom_id, date=date)
        else:
            return HttpResponse('Se requiere session_id o classroom_id + date', status=400)

        records = session.records.select_related('student').order_by('student__name')
        present_count = records.filter(is_present=True).count()

        html = render_to_string('reports/attendance_report.html', {
            'session': session,
            'records': records,
            'present_count': present_count,
            'total_count': records.count(),
        })
        return HttpResponse(html, content_type='text/html; charset=utf-8')


class FatigueReportView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        student_id = request.query_params.get('student_id')
        if not student_id:
            return HttpResponse('Se requiere student_id', status=400)

        qs_student = Student.objects.filter(is_active=True)
        student = get_object_or_404(qs_student, pk=student_id)

        analyses = FatigueAnalysis.objects.filter(
            student=student, status=FatigueAnalysis.STATUS_COMPLETED
        ).order_by('-analyzed_at')

        html = render_to_string('reports/fatigue_report.html', {
            'student': student,
            'analyses': analyses,
        })
        return HttpResponse(html, content_type='text/html; charset=utf-8')
