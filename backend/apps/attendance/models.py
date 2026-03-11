from django.db import models
from django.conf import settings


class AttendanceSession(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_ERROR = 'error'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pendiente'),
        (STATUS_PROCESSING, 'Procesando'),
        (STATUS_COMPLETED, 'Completado'),
        (STATUS_ERROR, 'Error'),
    ]

    classroom = models.ForeignKey(
        'classrooms.Classroom',
        on_delete=models.PROTECT,
        related_name='sessions',
    )
    maestro = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='attendance_sessions',
    )
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_session'
        verbose_name = 'Sesion de Asistencia'
        verbose_name_plural = 'Sesiones de Asistencia'
        indexes = [
            models.Index(fields=['classroom', 'date']),
            models.Index(fields=['maestro', 'status']),
        ]

    def __str__(self):
        return f"{self.classroom} — {self.date} ({self.get_status_display()})"


class AttendanceRecord(models.Model):
    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.CASCADE,
        related_name='records',
    )
    student = models.ForeignKey(
        'classrooms.Student',
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    minutes_present = models.PositiveIntegerField(default=0)
    is_present = models.BooleanField(default=False)

    class Meta:
        db_table = 'attendance_record'
        verbose_name = 'Registro de Asistencia'
        verbose_name_plural = 'Registros de Asistencia'
        unique_together = ('session', 'student')
        indexes = [
            models.Index(fields=['session', 'student']),
        ]

    def __str__(self):
        status = 'Presente' if self.is_present else 'Ausente'
        return f"{self.student} — {status} ({self.minutes_present} min)"
