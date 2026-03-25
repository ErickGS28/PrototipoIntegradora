from django.urls import path
from .views import (
    IndividualFatigueListView,
    IndividualFatigueCreateView,
    IndividualFatigueDetailView,
    IndividualFatigueStatusView,
)

urlpatterns = [
    path('individual/', IndividualFatigueListView.as_view(), name='individual-fatigue-list'),
    path('individual/create/', IndividualFatigueCreateView.as_view(), name='individual-fatigue-create'),
    path('individual/<int:pk>/', IndividualFatigueDetailView.as_view(), name='individual-fatigue-detail'),
    path('individual/<int:pk>/status/', IndividualFatigueStatusView.as_view(), name='individual-fatigue-status'),
]
