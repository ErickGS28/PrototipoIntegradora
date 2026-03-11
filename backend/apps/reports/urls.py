from django.urls import path
from .views import AttendanceReportView, FatigueReportView

urlpatterns = [
    path('attendance/', AttendanceReportView.as_view(), name='report-attendance'),
    path('fatigue/', FatigueReportView.as_view(), name='report-fatigue'),
]
