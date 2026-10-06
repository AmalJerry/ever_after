import copy
import math
from datetime import date
from urllib.parse import urlsplit
from uuid import UUID

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Experience, MediaAsset


STOCK_IMAGES = {
    "/images/celebration.jpg", "/images/hero.jpg", "/images/flowers.jpg",
    "/images/coast.jpg", "/images/mountains.jpg",
}

STOCK_ANIMATIONS = {
    "/animations/flowers-for-you.gif": "/animations/flowers-for-you-still.webp",
    "/animations/forever-hug.gif": "/animations/forever-hug-still.webp",
}

COPY_DEFAULTS = {
    "brandName": "ever, after.",
    "wishEyebrow": "A LITTLE BIRTHDAY MAGIC",
    "wishHeading": "Happy birthday,",
    "wishButton": "Blow Candles",
    "wishSuccess": "A wish, sent to the universe.",
    "wishSent": "Something lovely is on its way.",
    "celebrationEyebrow": "YOUR WISH IS ON ITS WAY",
    "celebrationHeading": "All this love.\nJust for you.",
    "celebrationMessage": "The world is a little sweeter with you in it.",
    "celebrationButton": "There's more in my heart",
    "celebrationNote": "and it has your name all over it.",
    "heartEyebrow": "OF ALL THE THINGS IN THIS UNIVERSE",
    "heartHeading": "My favorite thing\nis us.",
    "heartMessage": "A few little moments. A whole lot of forever.",
    "heartButton": "Open my heart",
    "heartNote": "a little universe, made of you and me.",
    "memoryEyebrow": "A MOMENT I'D KEEP FOREVER",
    "memoryFallbackTitle": "A little piece of us.",
    "memoryContinue": "A letter for you",
    "letterEyebrow": "THE WORDS I ALWAYS MEAN",
    "letterHeading": "Some things are\nbetter in a letter.",
    "letterButton": "Open your letter",
    "letterNote": "a little piece of my heart.",
    "letterSignOff": "Always,",
    "finaleEyebrow": "IN THIS LIFETIME. AND EVERY OTHER.",
    "finaleHeading": "I'd still\nchoose you.",
    "finaleButton": "One more little thing",
    "surpriseHeading": "One more little thing.",
    "surpriseButton": "Send",
    "signOff": "All my love,",
    "replayButton": "One more wish",
    "senderPrefix": "WITH LOVE,",
}


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({field: "Unknown setting." for field in sorted(unknown)})
        return super().to_internal_value(data)


class JourneyCopySerializer(StrictSerializer):
    def get_fields(self):
        fields = {}
        for name, default in COPY_DEFAULTS.items():
            limit = 200 if name.endswith(("Message", "Note")) else 100
            if name.endswith("Button"):
                limit = 40
            fields[name] = serializers.CharField(
                max_length=limit, allow_blank=not name.endswith(("Heading", "Button")),
                trim_whitespace=False, default=default,
            )
        return fields

    def validate(self, attrs):
        for name, value in attrs.items():
            if name.endswith(("Heading", "Button")) and not value.strip():
                raise serializers.ValidationError({name: "This text cannot be blank."})
        return attrs


class ChapterSettingsSerializer(StrictSerializer):
    celebration = serializers.BooleanField(default=True)
    heart = serializers.BooleanField(default=True)
    memories = serializers.BooleanField(default=True)
    letter = serializers.BooleanField(default=True)


class JourneyMediaSerializer(StrictSerializer):
    url = serializers.CharField(max_length=200)
    stillUrl = serializers.CharField(max_length=200, allow_blank=True)
    alt = serializers.CharField(max_length=200, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["url"] in STOCK_ANIMATIONS and attrs["stillUrl"] != STOCK_ANIMATIONS[attrs["url"]]:
            raise serializers.ValidationError({"stillUrl": "Use the matching reduced-motion still."})
        if attrs["stillUrl"] in STOCK_ANIMATIONS:
            raise serializers.ValidationError({"stillUrl": "A reduced-motion image cannot be animated."})
        return attrs


def default_celebration_media():
    return {
        "url": "/animations/flowers-for-you.gif",
        "stillUrl": "/animations/flowers-for-you-still.webp",
        "alt": "A bear giving a bouquet of red roses to their delighted partner",
    }


def default_finale_media():
    return {
        "url": "/animations/forever-hug.gif",
        "stillUrl": "/animations/forever-hug-still.webp",
        "alt": "Two bears sharing a loving hug beneath four red hearts",
    }


class PresentationSerializer(StrictSerializer):
    accentColor = serializers.RegexField(r"^#[0-9a-fA-F]{6}$", default="#F97BA3")
    animationsEnabled = serializers.BooleanField(default=True)
    showBirthday = serializers.BooleanField(default=False)
    showCover = serializers.BooleanField(default=False)
    musicEnabled = serializers.BooleanField(default=True)
    musicAutoplay = serializers.BooleanField(default=True)
    musicVolume = serializers.FloatField(min_value=0, max_value=1, default=0.8)
    chapters = ChapterSettingsSerializer(default=lambda: {name: True for name in ("celebration", "heart", "memories", "letter")})
    chapterOrder = serializers.ListField(
        child=serializers.ChoiceField(choices=["celebration", "heart", "memories", "letter"]),
        min_length=4, max_length=4, default=lambda: ["celebration", "heart", "memories", "letter"],
    )
    copy = JourneyCopySerializer(default=lambda: copy.deepcopy(COPY_DEFAULTS))
    celebrationMedia = JourneyMediaSerializer(default=default_celebration_media)
    finaleMedia = JourneyMediaSerializer(default=default_finale_media)

    def validate_musicVolume(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError("Choose a finite volume from 0 to 1.")
        return value

    def validate_chapterOrder(self, value):
        if len(set(value)) != 4:
            raise serializers.ValidationError("Include each optional chapter exactly once.")
        return value


def presentation_defaults():
    serializer = PresentationSerializer(data={})
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def content_with_defaults(content):
    normalized = copy.deepcopy(content)
    settings = PresentationSerializer(data=normalized.get("presentation", {}))
    settings.is_valid(raise_exception=True)
    normalized["presentation"] = dict(settings.validated_data)
    return normalized


class CalendarDateField(serializers.CharField):
    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if value == "" and self.allow_blank:
            return value
        try:
            if len(value) != 10 or date.fromisoformat(value).isoformat() != value:
                raise ValueError
        except ValueError:
            self.fail("invalid")
        return value


class MemorySerializer(serializers.Serializer):
    id = serializers.CharField(max_length=80)
    title = serializers.CharField(max_length=100, allow_blank=True, trim_whitespace=False)
    caption = serializers.CharField(max_length=2000, allow_blank=True, trim_whitespace=False)
    date = CalendarDateField(allow_blank=True)
    kind = serializers.ChoiceField(choices=["image", "video"])
    url = serializers.CharField(max_length=200, allow_blank=True)
    stillUrl = serializers.CharField(max_length=200, allow_blank=True, default="")


class SurpriseSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    question = serializers.CharField(max_length=300, allow_blank=True, trim_whitespace=False)
    answer = serializers.CharField(max_length=2000, allow_blank=True, trim_whitespace=False)


def media_references(content):
    references = [(content.get("heroImage", ""), "image"), (content.get("audioUrl", ""), "audio")]
    references.extend((memory.get("url", ""), memory.get("kind", "image")) for memory in content.get("memories", []))
    references.extend((memory.get("stillUrl", ""), "image") for memory in content.get("memories", []))
    for name in ("celebrationMedia", "finaleMedia"):
        media = content.get("presentation", {}).get(name, {})
        references.extend([(media.get("url", ""), "image"), (media.get("stillUrl", ""), "image")])
    return [(url, kind) for url, kind in references if url]


class ExperienceContentSerializer(StrictSerializer):
    recipientName = serializers.CharField(max_length=50, allow_blank=True)
    senderName = serializers.CharField(max_length=50, allow_blank=True)
    birthday = CalendarDateField()
    subtitle = serializers.CharField(max_length=200, allow_blank=True, trim_whitespace=False)
    heroImage = serializers.CharField(max_length=200)
    theme = serializers.ChoiceField(choices=["garden", "rose", "midnight"])
    memories = MemorySerializer(many=True, max_length=20)
    letterTitle = serializers.CharField(max_length=100, allow_blank=True, trim_whitespace=False)
    letterBody = serializers.CharField(max_length=12000, allow_blank=True, trim_whitespace=False)
    closingMessage = serializers.CharField(max_length=300, allow_blank=True, trim_whitespace=False)
    cakeColor = serializers.ChoiceField(choices=["rose", "vanilla", "sage"])
    candleCount = serializers.ChoiceField(choices=[1, 3, 5])
    microphoneSensitivity = serializers.FloatField(min_value=0.02, max_value=0.2)
    audioUrl = serializers.CharField(max_length=200, allow_blank=True)
    surprise = SurpriseSerializer()
    presentation = PresentationSerializer(default=presentation_defaults)

    def validate_microphoneSensitivity(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError("Choose a finite microphone threshold.")
        return value

    def validate(self, attrs):
        memory_ids = [memory["id"] for memory in attrs["memories"]]
        if len(set(memory_ids)) != len(memory_ids):
            raise serializers.ValidationError({"memories": "Every memory must have a unique ID."})
        assets = {}
        for url, kind in media_references(attrs):
            if kind == "image" and url in STOCK_IMAGES:
                continue
            if kind == "image" and (url in STOCK_ANIMATIONS or url in STOCK_ANIMATIONS.values()):
                continue
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
                raise serializers.ValidationError("Use uploaded media or one of the included photographs.")
            segments = parsed.path.strip("/").split("/")
            if len(segments) not in {3, 4} or segments[:2] != ["api", "media"] or len(segments) == 4 and segments[3] != "still":
                raise serializers.ValidationError("Invalid media reference.")
            try:
                asset_id = UUID(segments[2])
            except ValueError as error:
                raise serializers.ValidationError("Invalid media reference.") from error
            experience = self.context.get("experience")
            request = self.context["request"]
            asset = MediaAsset.objects.filter(
                id=asset_id, owner=request.user, experience=experience, kind=kind
            ).first() if experience else None
            if not asset or url not in {asset.private_url, asset.still_url}:
                raise serializers.ValidationError("This media is not available to this experience.")
            assets[url] = asset
        media_blocks = [(name, attrs["presentation"][name]) for name in ("celebrationMedia", "finaleMedia")]
        media_blocks.extend(("memories", memory) for memory in attrs["memories"] if memory["kind"] == "image")
        for name, media in media_blocks:
            original = assets.get(media["url"])
            static = assets.get(media.get("stillUrl", ""))
            if original and original.still_file and media.get("stillUrl") != original.still_url:
                raise serializers.ValidationError({name: "Use the uploaded animation's reduced-motion still."})
            if static and static.still_file and media["stillUrl"] != static.still_url:
                raise serializers.ValidationError({name: "The reduced-motion image must be static."})
        return attrs


class ExperienceSerializer(serializers.ModelSerializer):
    draft = serializers.JSONField()
    publishedAt = serializers.DateTimeField(source="published_at", read_only=True)
    shareToken = serializers.CharField(source="share_token", read_only=True)
    expiresAt = serializers.DateTimeField(source="expires_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Experience
        fields = ["id", "draft", "publishedAt", "shareToken", "expiresAt", "updatedAt"]
        read_only_fields = ["id"]

    def validate_draft(self, value):
        serializer = ExperienceContentSerializer(
            data=value, context={**self.context, "experience": self.instance}
        )
        serializer.is_valid(raise_exception=True)
        return dict(serializer.validated_data)

    def to_representation(self, instance):
        result = super().to_representation(instance)
        result["draft"] = content_with_defaults(result["draft"])
        return result


class RegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150, validators=[UnicodeUsernameValidator()])
    password = serializers.CharField(min_length=10, max_length=128, trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        user_class = get_user_model()
        if user_class.objects.filter(username__iexact=attrs["username"]).exists():
            raise serializers.ValidationError({"username": "That username is already taken."})
        try:
            validate_password(attrs["password"], user_class(username=attrs["username"]))
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages}) from error
        return attrs


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class PublishSerializer(serializers.Serializer):
    expiresInDays = serializers.ChoiceField(choices=[7, 30, 90], default=30)