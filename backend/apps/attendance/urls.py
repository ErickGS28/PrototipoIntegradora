from django.urls import path
from .views import SessionListCreateView, SessionDetailView, UploadVideoView, SessionStatusView

urlpatterns = [
    path('sessions/', SessionListCreateView.as_view(), name='session-list'),
    path('sessions/<int:pk>/', SessionDetailView.as_view(), name='session-detail'),
    path('sessions/<int:session_id>/upload-video/', UploadVideoView.as_view(), name='upload-video'),
    path('sessions/<int:session_id>/status/', SessionStatusView.as_view(), name='session-status'),
]
