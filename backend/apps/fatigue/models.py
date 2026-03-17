from django.db import models
from django.conf import settings


class IndividualFatigueAnalysis(models.Model):
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
    LABEL_ATENTO = 'atento'
    LABEL_FATIGADO = 'fatigado'
    LABEL_DISTRAIDO = 'distraido'
    LABEL_CHOICES = [
        (LABEL_ATENTO, 'Atento'),
        (LABEL_FATIGADO, 'Fatigado'),
        (LABEL_DISTRAIDO, 'Distraido'),
    ]

    student = models.ForeignKey(
        'classrooms.Student',
        on_delete=models.CASCADE,
        related_name='fatigue_analyses',
    )
    maestro = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='individual_fatigue_analyses',
    )
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    attention_score = models.FloatField(default=0.0)
    fatigue_score = models.FloatField(default=0.0)
    yawn_count = models.PositiveIntegerField(default=0)
    eyes_closed_secs = models.FloatField(default=0.0)
    result_label = models.CharField(max_length=30, choices=LABEL_CHOICES, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fatigue_individual_analysis'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', 'date']),
            models.Index(fields=['maestro', 'status']),
        ]

    def __str__(self):
        return f"{self.student} — {self.date} ({self.get_status_display()})"


class FatigueSession(models.Model):
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
        related_name='fatigue_sessions',
    )
    maestro = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='fatigue_sessions',
    )
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fatigue_session'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['classroom', 'date']),
            models.Index(fields=['maestro', 'status']),
        ]

    def __str__(self):
        return f"{self.classroom} — {self.date} ({self.get_status_display()})"


class FatigueRecord(models.Model):
    LABEL_ATENTO = 'atento'
    LABEL_FATIGADO = 'fatigado'
    LABEL_DISTRAIDO = 'distraido'
    LABEL_CHOICES = [
        (LABEL_ATENTO, 'Atento'),
        (LABEL_FATIGADO, 'Fatigado'),
        (LABEL_DISTRAIDO, 'Distraido'),
    ]

    session = models.ForeignKey(
        FatigueSession,
        on_delete=models.CASCADE,
        related_name='records',
    )
    student = models.ForeignKey(
        'classrooms.Student',
        on_delete=models.CASCADE,
        related_name='fatigue_records',
    )
    is_present = models.BooleanField(default=False)
    attention_score = models.FloatField(default=0.0)
    fatigue_score = models.FloatField(default=0.0)
    yawn_count = models.PositiveIntegerField(default=0)
    eyes_closed_secs = models.FloatField(default=0.0)
    result_label = models.CharField(max_length=30, choices=LABEL_CHOICES, blank=True)

    class Meta:
        db_table = 'fatigue_record'
        unique_together = ('session', 'student')

    def __str__(self):
        status = 'Presente' if self.is_present else 'Ausente'
        return f"{self.student} — {status} {self.result_label}"
