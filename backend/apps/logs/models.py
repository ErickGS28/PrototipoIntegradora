from django.db import models


class AuditLog(models.Model):
    EVENT_INSERT = 'insert'
    EVENT_UPDATE = 'update'
    EVENT_DELETE = 'delete'
    EVENT_LOGIN = 'login'
    EVENT_CHOICES = [
        (EVENT_INSERT, 'Insert'),
        (EVENT_UPDATE, 'Update'),
        (EVENT_DELETE, 'Delete'),
        (EVENT_LOGIN, 'Login'),
    ]

    mysql_user = models.CharField(max_length=100, blank=True)
    event_type = models.CharField(max_length=50, choices=EVENT_CHOICES)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'logs_auditlog'
        verbose_name = 'Log de Auditoria'
        verbose_name_plural = 'Logs de Auditoria'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.event_type}] {self.description[:50]} ({self.created_at:%Y-%m-%d %H:%M})"
