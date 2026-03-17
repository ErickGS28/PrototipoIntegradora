from django.urls import path
from .views import (
    FatigueSessionListView,
    FatigueSessionCreateView,
    FatigueSessionDetailView,
    FatigueSessionStatusView,
    IndividualFatigueListView,
    IndividualFatigueCreateView,
    IndividualFatigueDetailView,
    IndividualFatigueStatusView,
)

urlpatterns = [
    # Individual fatigue analysis (new flow)
    path('individual/', IndividualFatigueListView.as_view(), name='individual-fatigue-list'),
    path('individual/create/', IndividualFatigueCreateView.as_view(), name='individual-fatigue-create'),
    path('individual/<int:pk>/', IndividualFatigueDetailView.as_view(), name='individual-fatigue-detail'),
    path('individual/<int:pk>/status/', IndividualFatigueStatusView.as_view(), name='individual-fatigue-status'),

    # Legacy session-based endpoints
    path('', FatigueSessionListView.as_view(), name='fatigue-list'),
    path('create/', FatigueSessionCreateView.as_view(), name='fatigue-create'),
    path('<int:pk>/', FatigueSessionDetailView.as_view(), name='fatigue-detail'),
    path('<int:pk>/status/', FatigueSessionStatusView.as_view(), name='fatigue-status'),
]
