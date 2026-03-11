from django.urls import path
from .views import FatigueListView, FatigueAnalyzeView, FatigueDetailView

urlpatterns = [
    path('', FatigueListView.as_view(), name='fatigue-list'),
    path('analyze/', FatigueAnalyzeView.as_view(), name='fatigue-analyze'),
    path('<int:pk>/', FatigueDetailView.as_view(), name='fatigue-detail'),
]
