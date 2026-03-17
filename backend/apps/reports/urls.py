from django.urls import path
from .views import AttendanceReportView, FatigueReportView, IndividualFatigueReportView

urlpatterns = [
    path('attendance/', AttendanceReportView.as_view(), name='report-attendance'),
    path('fatigue/', FatigueReportView.as_view(), name='report-fatigue'),
    path('fatigue/individual/', IndividualFatigueReportView.as_view(), name='report-individual-fatigue'),
]
