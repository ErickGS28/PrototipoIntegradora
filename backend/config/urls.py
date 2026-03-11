from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/admin/', include('apps.users.admin_urls')),
    path('api/classrooms/', include('apps.classrooms.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/fatigue/', include('apps.fatigue.urls')),
    path('api/reports/', include('apps.reports.urls')),
]
