from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.http import HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.attendance.models import AttendanceSession
from apps.fatigue.models import FatigueSession, IndividualFatigueAnalysis


class AttendanceReportView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        session_id = request.query_params.get('session_id')
        classroom_id = request.query_params.get('classroom_id')
        date = request.query_params.get('date')

        if session_id:
            session = get_object_or_404(
                AttendanceSession.objects.select_related('classroom', 'maestro')
                .prefetch_related('records__student'),
                pk=session_id,
            )
        elif classroom_id and date:
            session = get_object_or_404(
                AttendanceSession.objects.select_related('classroom', 'maestro')
                .prefetch_related('records__student'),
                classroom_id=classroom_id, date=date,
            )
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
        session_id = request.query_params.get('session_id')
        if not session_id:
            return HttpResponse('Se requiere session_id', status=400)

        session = get_object_or_404(
            FatigueSession.objects.select_related('classroom', 'maestro')
            .prefetch_related('records__student'),
            pk=session_id,
            status=FatigueSession.STATUS_COMPLETED,
        )

        records = session.records.select_related('student').order_by('student__name')
        present_count = records.filter(is_present=True).count()

        html = render_to_string('reports/fatigue_report.html', {
            'session': session,
            'records': records,
            'present_count': present_count,
            'total_count': records.count(),
        })
        return HttpResponse(html, content_type='text/html; charset=utf-8')


class IndividualFatigueReportView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        analysis_id = request.query_params.get('analysis_id')
        if not analysis_id:
            return HttpResponse('Se requiere analysis_id', status=400)

        analysis = get_object_or_404(
            IndividualFatigueAnalysis.objects.select_related('student__classroom', 'maestro'),
            pk=analysis_id,
            status=IndividualFatigueAnalysis.STATUS_COMPLETED,
        )

        html = render_to_string('reports/individual_fatigue_report.html', {
            'analysis': analysis,
            'student': analysis.student,
        })
        return HttpResponse(html, content_type='text/html; charset=utf-8')
