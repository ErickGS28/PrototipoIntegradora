from rest_framework import serializers
from .models import AttendanceSession, AttendanceRecord


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_matricula = serializers.CharField(source='student.matricula', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ('id', 'student', 'student_name', 'student_matricula',
                  'minutes_present', 'is_present')
        read_only_fields = ('id',)


class AttendanceSessionSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    records = AttendanceRecordSerializer(many=True, read_only=True)
    present_count = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = ('id', 'classroom', 'classroom_name', 'maestro', 'date',
                  'status', 'error_message', 'records', 'present_count',
                  'total_students', 'created_at')
        read_only_fields = ('id', 'maestro', 'status', 'error_message', 'created_at')

    def get_present_count(self, obj):
        return obj.records.filter(is_present=True).count()

    def get_total_students(self, obj):
        return obj.records.count()


class AttendanceSessionListSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    present_count = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = ('id', 'classroom', 'classroom_name', 'date', 'status',
                  'present_count', 'total_students', 'created_at')

    def get_present_count(self, obj):
        return obj.records.filter(is_present=True).count()

    def get_total_students(self, obj):
        return obj.records.count()
