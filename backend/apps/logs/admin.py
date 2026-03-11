from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'mysql_user', 'description', 'created_at')
    list_filter = ('event_type',)
    readonly_fields = ('event_type', 'mysql_user', 'description', 'created_at')
