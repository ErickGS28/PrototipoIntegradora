from rest_framework import serializers
from .models import FatigueAnalysis


class FatigueAnalysisSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_matricula = serializers.CharField(source='student.matricula', read_only=True)

    class Meta:
        model = FatigueAnalysis
        fields = (
            'id', 'student', 'student_name', 'student_matricula', 'maestro',
            'attention_score', 'fatigue_score', 'yawn_count', 'eyes_closed_secs',
            'result_label', 'status', 'error_message', 'analyzed_at',
        )
        read_only_fields = (
            'id', 'maestro', 'attention_score', 'fatigue_score',
            'yawn_count', 'eyes_closed_secs', 'result_label',
            'status', 'error_message', 'analyzed_at',
        )
