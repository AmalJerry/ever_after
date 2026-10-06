from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import ExperienceViewSet, LoginView, LogoutView, MediaView, RegisterView, SessionView, SharedView


router = SimpleRouter()
router.register("experiences", ExperienceViewSet, basename="experience")
urlpatterns = [
    path("session/", SessionView.as_view()),
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("shared/<str:token>/", SharedView.as_view()),
    path("media/<uuid:asset_id>/", MediaView.as_view()),
    path("media/<uuid:asset_id>/still/", MediaView.as_view(), {"still": True}),
    path("", include(router.urls)),
]