from django.contrib import admin
from .models import FatigueAnalysis


@admin.register(FatigueAnalysis)
class FatigueAnalysisAdmin(admin.ModelAdmin):
    list_display = ('student', 'maestro', 'result_label', 'attention_score', 'fatigue_score', 'analyzed_at')
    list_filter = ('result_label', 'status')
