from rest_framework import serializers
from .models import IndividualFatigueAnalysis


class IndividualFatigueAnalysisSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_matricula = serializers.CharField(source='student.matricula', read_only=True)
    classroom_id = serializers.IntegerField(source='student.classroom_id', read_only=True)
    classroom_name = serializers.CharField(source='student.classroom.name', read_only=True)

    class Meta:
        model = IndividualFatigueAnalysis
        fields = (
            'id', 'student', 'student_name', 'student_matricula',
            'classroom_id', 'classroom_name',
            'maestro', 'date', 'status',
            'attention_score', 'fatigue_score', 'yawn_count',
            'eyes_closed_secs', 'result_label', 'error_message', 'created_at',
        )
        read_only_fields = ('id', 'maestro', 'status', 'error_message', 'created_at')
