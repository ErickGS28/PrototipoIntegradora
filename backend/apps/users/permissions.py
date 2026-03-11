from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class IsMaestro(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_maestro


class IsAdminOrMaestro(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'maestro')


class IsOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.is_admin:
            return True
        if hasattr(obj, 'maestro'):
            return obj.maestro == request.user
        if hasattr(obj, 'maestro_id'):
            return obj.maestro_id == request.user.id
        return False
