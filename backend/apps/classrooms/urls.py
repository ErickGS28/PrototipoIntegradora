from django.urls import path
from .views import (
    ClassroomListCreateView, ClassroomDetailView,
    StudentListCreateView, StudentDetailView,
    CaptureFaceView, FaceStatusView,
)

urlpatterns = [
    path('', ClassroomListCreateView.as_view(), name='classroom-list'),
    path('<int:pk>/', ClassroomDetailView.as_view(), name='classroom-detail'),
    path('<int:classroom_id>/students/', StudentListCreateView.as_view(), name='student-list'),
    path('<int:classroom_id>/students/<int:pk>/', StudentDetailView.as_view(), name='student-detail'),
    path('students/<int:student_id>/capture-face/', CaptureFaceView.as_view(), name='capture-face'),
    path('students/<int:student_id>/face-status/', FaceStatusView.as_view(), name='face-status'),
]
