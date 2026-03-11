from rest_framework import serializers
from .models import Classroom, Student, FaceEncoding


class StudentSerializer(serializers.ModelSerializer):
    has_enough_face_samples = serializers.BooleanField(read_only=True)
    face_sample_count = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = (
            'id', 'name', 'matricula', 'age', 'sex',
            'wears_glasses', 'classroom', 'is_active',
            'has_enough_face_samples', 'face_sample_count', 'created_at',
        )
        read_only_fields = ('id', 'created_at', 'classroom')

    def get_face_sample_count(self, obj):
        return obj.face_encodings.count()


class ClassroomSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    maestro_name = serializers.CharField(source='maestro.name', read_only=True)

    class Meta:
        model = Classroom
        fields = ('id', 'name', 'subject', 'maestro', 'maestro_name',
                  'is_active', 'student_count', 'created_at')
        read_only_fields = ('id', 'maestro', 'created_at')

    def get_student_count(self, obj):
        return obj.students.filter(is_active=True).count()


class FaceStatusSerializer(serializers.ModelSerializer):
    has_enough_samples = serializers.BooleanField(source='has_enough_face_samples')
    sample_count = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = ('id', 'name', 'has_enough_samples', 'sample_count')

    def get_sample_count(self, obj):
        return obj.face_encodings.count()
