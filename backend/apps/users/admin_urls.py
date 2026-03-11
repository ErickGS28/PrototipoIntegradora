from django.urls import path
from .views import MaestroListCreateView, MaestroDetailView

urlpatterns = [
    path('maestros/', MaestroListCreateView.as_view(), name='admin-maestros-list'),
    path('maestros/<int:pk>/', MaestroDetailView.as_view(), name='admin-maestros-detail'),
]
