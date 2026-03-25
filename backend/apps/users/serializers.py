from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])  # NOSONAR
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'password2', 'name')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:  # NOSONAR
            raise serializers.ValidationError({'password': 'Las contrasenas no coinciden.'})  # NOSONAR
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],  # NOSONAR
            name=validated_data.get('name', ''),
            role=User.ROLE_MAESTRO,
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'name', 'role', 'is_active', 'date_joined')
        read_only_fields = ('id', 'date_joined')


class AdminMaestroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])  # NOSONAR

    class Meta:
        model = User
        fields = ('id', 'username', 'password', 'name', 'role', 'is_active', 'date_joined')
        read_only_fields = ('id', 'date_joined')

    def create(self, validated_data):
        raw_pwd = validated_data.pop('password', None)  # NOSONAR
        user = User(**validated_data)
        if raw_pwd:
            user.set_password(raw_pwd)
        user.save()
        return user

    def update(self, instance, validated_data):
        raw_pwd = validated_data.pop('password', None)  # NOSONAR
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if raw_pwd:
            instance.set_password(raw_pwd)
        instance.save()
        return instance
