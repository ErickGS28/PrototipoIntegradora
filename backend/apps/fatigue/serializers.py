from rest_framework import serializers
from .models import FatigueSession, FatigueRecord, IndividualFatigueAnalysis


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


class FatigueRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_matricula = serializers.CharField(source='student.matricula', read_only=True)

    class Meta:
        model = FatigueRecord
        fields = (
            'id', 'student', 'student_name', 'student_matricula',
            'is_present', 'attention_score', 'fatigue_score',
            'yawn_count', 'eyes_closed_secs', 'result_label',
        )
        read_only_fields = fields


class FatigueSessionSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    records = FatigueRecordSerializer(many=True, read_only=True)
    present_count = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = FatigueSession
        fields = (
            'id', 'classroom', 'classroom_name', 'maestro', 'date',
            'status', 'error_message', 'records',
            'present_count', 'total_students', 'created_at',
        )
        read_only_fields = ('id', 'maestro', 'status', 'error_message', 'created_at')

    def get_present_count(self, obj):
        return obj.records.filter(is_present=True).count()

    def get_total_students(self, obj):
        return obj.records.count()


class FatigueSessionListSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    present_count = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = FatigueSession
        fields = (
            'id', 'classroom', 'classroom_name', 'date',
            'status', 'present_count', 'total_students', 'created_at',
        )

    def get_present_count(self, obj):
        return obj.records.filter(is_present=True).count()

    def get_total_students(self, obj):
        return obj.records.count()
