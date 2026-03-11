from django.db import models
from django.conf import settings


class FatigueAnalysis(models.Model):
    LABEL_ATENTO = 'atento'
    LABEL_FATIGADO = 'fatigado'
    LABEL_DISTRAIDO = 'distraido'
    LABEL_CHOICES = [
        (LABEL_ATENTO, 'Atento'),
        (LABEL_FATIGADO, 'Fatigado'),
        (LABEL_DISTRAIDO, 'Distraido'),
    ]
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

    student = models.ForeignKey(
        'classrooms.Student',
        on_delete=models.CASCADE,
        related_name='fatigue_analyses',
    )
    maestro = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='fatigue_analyses',
    )
    attention_score = models.FloatField(default=0.0)
    fatigue_score = models.FloatField(default=0.0)
    yawn_count = models.PositiveIntegerField(default=0)
    eyes_closed_secs = models.FloatField(default=0.0)
    result_label = models.CharField(
        max_length=30, choices=LABEL_CHOICES, blank=True
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    error_message = models.TextField(blank=True)
    analyzed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fatigue_analysis'
        verbose_name = 'Analisis de Fatiga'
        verbose_name_plural = 'Analisis de Fatiga'
        ordering = ['-analyzed_at']

    def __str__(self):
        return f"{self.student} — {self.result_label} ({self.analyzed_at:%Y-%m-%d})"
