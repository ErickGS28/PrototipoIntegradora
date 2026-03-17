from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .permissions import IsAdmin
from .serializers import RegisterSerializer, UserSerializer, AdminMaestroSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            from rest_framework_simplejwt.tokens import AccessToken
            access = response.data.get('access')
            token = AccessToken(access)
            user_id = token['user_id']
            user = User.objects.get(id=user_id)
            response.data['user'] = UserSerializer(user).data
        return response


class MeView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class MaestroListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminMaestroSerializer

    def get_queryset(self):
        return User.objects.filter(role=User.ROLE_MAESTRO).order_by('username')


class MaestroDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminMaestroSerializer

    def get_queryset(self):
        return User.objects.filter(role=User.ROLE_MAESTRO)

    def perform_destroy(self, instance):
        # Borrado logico
        instance.is_active = False
        instance.save()
