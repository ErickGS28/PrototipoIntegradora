from django.contrib import admin
from .models import IndividualFatigueAnalysis, FatigueSession, FatigueRecord


@admin.register(IndividualFatigueAnalysis)
class IndividualFatigueAnalysisAdmin(admin.ModelAdmin):
    list_display = ('student', 'maestro', 'date', 'status', 'result_label', 'attention_score', 'fatigue_score')
    list_filter = ('status', 'result_label')
    search_fields = ('student__name', 'student__matricula')
    readonly_fields = ('created_at',)


# Los modelos legacy se mantienen para preservar los datos históricos en la BD.
# No tienen endpoints activos; solo son visibles aquí para inspección.
@admin.register(FatigueSession)
class FatigueSessionAdmin(admin.ModelAdmin):
    list_display = ('classroom', 'maestro', 'date', 'status', 'created_at')
    list_filter = ('status',)


@admin.register(FatigueRecord)
class FatigueRecordAdmin(admin.ModelAdmin):
    list_display = ('student', 'session', 'is_present', 'result_label', 'attention_score', 'fatigue_score')
    list_filter = ('is_present', 'result_label')
