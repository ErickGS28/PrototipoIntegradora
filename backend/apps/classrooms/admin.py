from django.contrib import admin
from .models import Classroom, Student, FaceEncoding


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ('name', 'subject', 'maestro', 'is_active', 'created_at')
    list_filter = ('is_active',)


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('name', 'matricula', 'classroom', 'is_active')
    list_filter = ('is_active', 'sex')
    search_fields = ('name', 'matricula')


@admin.register(FaceEncoding)
class FaceEncodingAdmin(admin.ModelAdmin):
    list_display = ('student', 'created_at')
