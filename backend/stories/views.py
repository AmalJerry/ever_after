import copy
import secrets
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.http import Http404
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .media import private_file_response, validate_upload
from .models import Experience, MediaAsset
from .serializers import (
    ExperienceContentSerializer, ExperienceSerializer, LoginSerializer,
    PublishSerializer, RegistrationSerializer, content_with_defaults, media_references,
)


def user_payload(user):
    return {"id": user.id, "username": user.username} if user.is_authenticated else None


class SessionView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def get(self, request):
        response = Response({"user": user_payload(request.user), "csrfToken": get_token(request)})
        response["Cache-Control"] = "no-store"
        return response


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = get_user_model().objects.create_user(**serializer.validated_data)
        except IntegrityError as error:
            raise ValidationError({"username": "That username is already taken."}) from error
        login(request, user)
        return Response({"user": user_payload(user), "csrfToken": get_token(request)}, status=201)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if not user:
            return Response({"detail": "The username or password is incorrect."}, status=403)
        login(request, user)
        return Response({"user": user_payload(user), "csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        logout(request)
        return Response(status=204)


class ExperienceViewSet(mixins.ListModelMixin, mixins.CreateModelMixin,
                        mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                        mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = ExperienceSerializer
    throttle_scope = "creator"
    lookup_value_regex = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Experience.objects.filter(owner=self.request.user)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "private, no-store"
        return response

    def perform_create(self, serializer):
        if self.get_queryset().count() >= 25:
            raise ValidationError("You can keep up to 25 experiences. Delete an old draft to make room.")
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        settings = PublishSerializer(data=request.data)
        settings.is_valid(raise_exception=True)
        with transaction.atomic():
            experience = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
            content = ExperienceContentSerializer(data=experience.draft, context={"request": request, "experience": experience})
            content.is_valid(raise_exception=True)
            if not experience.draft["recipientName"] or not experience.draft["senderName"]:
                raise ValidationError("Add both names before publishing.")
            if experience.draft["surprise"]["enabled"] and (
                not experience.draft["surprise"]["question"].strip() or not experience.draft["surprise"]["answer"].strip()
            ):
                raise ValidationError("Add a question and answer, or turn off the surprise.")
            if content.validated_data["presentation"]["chapters"]["memories"] and any(not memory["url"] for memory in experience.draft["memories"]):
                raise ValidationError("Add a photo or video to every memory before publishing.")
            experience.published_data = copy.deepcopy(dict(content.validated_data))
            experience.share_token = experience.share_token or secrets.token_urlsafe(32)
            experience.published_at = timezone.now()
            experience.expires_at = timezone.now() + timedelta(days=settings.validated_data["expiresInDays"])
            experience.save()
        return Response(self.get_serializer(experience).data)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        experience = self.get_object()
        experience.published_data = None
        experience.share_token = None
        experience.published_at = None
        experience.expires_at = None
        experience.save()
        return Response(self.get_serializer(experience).data)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser], throttle_scope="upload")
    def media(self, request, pk=None):
        experience = self.get_object()
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "Choose a file to upload."})
        kind = request.data.get("kind")
        original_name = upload.name[:200]
        file, mime_type, still_file = validate_upload(upload, kind)
        upload_size = file.size + (still_file.size if still_file else 0)
        with transaction.atomic():
            Experience.objects.select_for_update().get(pk=experience.pk)
            total_size = experience.assets.aggregate(total=Sum("size"))["total"] or 0
            if experience.assets.count() >= 40 or total_size + upload_size > 500 * 1024 * 1024:
                raise ValidationError("This experience has reached its private media limit.")
            asset = MediaAsset.objects.create(
                experience=experience, owner=request.user, file=file, still_file=still_file,
                kind=kind, mime_type=mime_type, original_name=original_name, size=upload_size,
            )
        return Response({"id": str(asset.id), "url": asset.private_url, "stillUrl": asset.still_url, "kind": asset.kind, "name": asset.original_name}, status=status.HTTP_201_CREATED)


class SharedView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "shared"

    def get(self, request, token):
        experience = get_object_or_404(Experience, share_token=token, published_at__isnull=False, expires_at__gt=timezone.now())
        content = content_with_defaults(experience.published_data)

        def shared_url(url):
            return f"{url}?share={token}" if url.startswith("/api/media/") else url

        content["heroImage"] = shared_url(content["heroImage"])
        content["audioUrl"] = shared_url(content["audioUrl"])
        for memory in content["memories"]:
            memory["url"] = shared_url(memory["url"])
            if memory.get("stillUrl"):
                memory["stillUrl"] = shared_url(memory["stillUrl"])
        for name in ("celebrationMedia", "finaleMedia"):
            media = content["presentation"][name]
            media["url"] = shared_url(media["url"])
            media["stillUrl"] = shared_url(media["stillUrl"])
        response = Response(content)
        response["Cache-Control"] = "private, no-store"
        response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        return response


class MediaView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "shared"

    def get(self, request, asset_id, still=False):
        asset = get_object_or_404(MediaAsset.objects.select_related("experience"), id=asset_id)
        if still and not asset.still_file:
            raise Http404
        if not request.user.is_authenticated or asset.owner_id != request.user.id:
            token = request.query_params.get("share", "")
            experience = asset.experience
            if not token or not token.isascii() or not experience.share_token or not secrets.compare_digest(token, experience.share_token):
                raise Http404
            if not experience.published_at or not experience.expires_at or experience.expires_at <= timezone.now():
                raise Http404
            requested_url = asset.still_url if still else asset.private_url
            if requested_url not in {url for url, _ in media_references(experience.published_data)}:
                raise Http404
        try:
            return private_file_response(request, asset, still=still)
        except FileNotFoundError as error:
            raise Http404 from error