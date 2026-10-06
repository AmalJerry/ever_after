import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import OperationalError
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from .models import Experience


class DeploymentSettingsTests(SimpleTestCase):
    def load_settings(self, **overrides):
        environment = {key: value for key, value in os.environ.items() if not key.startswith(("DJANGO_", "RENDER", "DATABASE_", "PUBLIC_SITE_"))}
        environment.update({
            "RENDER": "true",
            "DJANGO_LOAD_DOTENV": "false",
            "DJANGO_SECRET_KEY": "test-only-deployment-secret-with-at-least-fifty-characters-1234",
            "DATABASE_URL": "postgresql://test:test@localhost:5432/ever_after",
            "DJANGO_MEDIA_ROOT": str(Path(tempfile.gettempdir()) / "ever-after-deployment-test"),
            "DJANGO_INTERNAL_HOST": "ever-after-api.internal",
            "PUBLIC_SITE_URL": "https://ever-after-test.onrender.com",
        })
        for key, value in overrides.items():
            if value is None:
                environment.pop(key, None)
            else:
                environment[key] = value
        return subprocess.run(
            [sys.executable, "-c", "import json; from config import settings; print(json.dumps({'debug': settings.DEBUG, 'engine': settings.DATABASES['default']['ENGINE'], 'database': str(settings.DATABASES['default']['NAME']), 'media': str(settings.MEDIA_ROOT), 'hosts': settings.ALLOWED_HOSTS, 'origins': settings.CSRF_TRUSTED_ORIGINS, 'secure': settings.SESSION_COOKIE_SECURE}))"],
            cwd=Path(__file__).resolve().parents[1], env=environment, text=True, capture_output=True, check=False,
        )

    def test_render_uses_postgres_persistent_media_and_secure_cookies(self):
        result = self.load_settings()
        self.assertEqual(result.returncode, 0, result.stderr)
        settings = json.loads(result.stdout)
        self.assertFalse(settings["debug"])
        self.assertTrue(settings["secure"])
        self.assertEqual(settings["engine"], "django.db.backends.postgresql")
        self.assertIn("ever-after-api.internal", settings["hosts"])
        self.assertIn("https://ever-after-test.onrender.com", settings["origins"])
        self.assertTrue(settings["media"].endswith("ever-after-deployment-test"))

    def test_render_allows_explicit_disposable_sqlite(self):
        database_path = str(Path(tempfile.gettempdir()) / "ever-after-deployment-test" / "db.sqlite3")
        for database_url in (None, ""):
            with self.subTest(database_url=database_url):
                result = self.load_settings(
                    DATABASE_URL=database_url,
                    DJANGO_ALLOW_EPHEMERAL_SQLITE="true",
                    DJANGO_SQLITE_PATH=database_path,
                    DJANGO_INTERNAL_HOST=None,
                    RENDER_EXTERNAL_HOSTNAME="ever-after-api-test.onrender.com",
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                settings = json.loads(result.stdout)
                self.assertEqual(settings["engine"], "django.db.backends.sqlite3")
                self.assertEqual(settings["database"], database_path)
                self.assertFalse(settings["debug"])
                self.assertTrue(settings["secure"])
                self.assertIn("ever-after-api-test.onrender.com", settings["hosts"])

    def test_render_sqlite_requires_opt_in_and_absolute_path(self):
        for overrides in (
            {"DJANGO_SQLITE_PATH": str(Path(tempfile.gettempdir()) / "db.sqlite3")},
            {"DJANGO_ALLOW_EPHEMERAL_SQLITE": "true"},
            {"DJANGO_ALLOW_EPHEMERAL_SQLITE": "true", "DJANGO_SQLITE_PATH": "relative/db.sqlite3"},
            {"DATABASE_URL": "sqlite:///db.sqlite3"},
        ):
            with self.subTest(overrides=overrides):
                result = self.load_settings(**{"DATABASE_URL": None, **overrides})
                self.assertNotEqual(result.returncode, 0)

    def test_render_rejects_unsafe_or_missing_configuration(self):
        for setting, value in [
            ("DJANGO_DEBUG", "true"), ("DJANGO_SECRET_KEY", None),
            ("DJANGO_SECRET_KEY", "too-short"), ("PUBLIC_SITE_URL", None),
            ("DATABASE_URL", None), ("DJANGO_MEDIA_ROOT", None),
            ("DJANGO_MEDIA_ROOT", "relative/uploads"),
            ("PUBLIC_SITE_URL", "http://insecure.example"),
            ("PUBLIC_SITE_URL", "https://example.com/path"),
        ]:
            with self.subTest(setting=setting, value=value):
                self.assertNotEqual(self.load_settings(**{setting: value}).returncode, 0)


class HealthTests(TestCase):
    def test_health_is_public_and_uncached(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(self.client.post("/api/health/").status_code, 405)

    def test_health_reports_database_failure_without_details(self):
        with patch("config.views.connection.cursor", side_effect=OperationalError("private connection information")):
            response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable"})

    @override_settings(SECURE_SSL_REDIRECT=True)
    def test_internal_health_check_does_not_redirect(self):
        self.assertEqual(self.client.get("/api/health/").status_code, 200)


def story_content():
    return {
        "recipientName": "Sophie", "senderName": "Alex", "birthday": "2026-09-21",
        "subtitle": "Our next chapter", "heroImage": "/images/celebration.jpg", "theme": "garden",
        "memories": [{"id": "first", "title": "Our first day", "caption": "Just us", "date": "2024-04-03", "kind": "image", "url": "/images/flowers.jpg"}],
        "letterTitle": "My love", "letterBody": "Happy birthday", "closingMessage": "Always yours",
        "cakeColor": "rose", "candleCount": 3, "microphoneSensitivity": 0.06, "audioUrl": "",
        "surprise": {"enabled": True, "question": "A date?", "answer": "Saturday!"},
    }


class ExperienceTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.media_root = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root)
        self.settings_override.enable()
        self.owner = get_user_model().objects.create_user("creator", password="birthday-testing-pass-42")
        self.other = get_user_model().objects.create_user("other", password="birthday-testing-pass-43")
        self.client.force_authenticate(self.owner)
        response = self.client.post("/api/experiences/", {"draft": story_content()}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.experience_id = response.data["id"]
        self.url = f"/api/experiences/{self.experience_id}/"

    def tearDown(self):
        self.settings_override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def publish(self):
        response = self.client.post(f"{self.url}publish/", {"expiresInDays": 30}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["shareToken"]

    def image_upload(self):
        output = io.BytesIO()
        Image.new("RGB", (48, 32), "green").save(output, "PNG")
        response = self.client.post(f"{self.url}media/", {"kind": "image", "file": SimpleUploadedFile("photo.png", output.getvalue(), content_type="image/png")}, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_owner_isolation_and_anonymous_draft_access(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.client.patch(self.url, {"draft": story_content()}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(self.url).status_code, 404)
        self.assertEqual(self.client.get("/api/experiences/").data, [])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_malformed_experience_ids_return_not_found(self):
        self.assertEqual(self.client.get("/api/experiences/not-a-uuid/").status_code, 404)
        self.assertEqual(self.client.post("/api/experiences/not-a-uuid/publish/", {}, format="json").status_code, 404)

    def test_non_ascii_media_tokens_return_not_found(self):
        asset = self.image_upload()
        self.publish()
        response = APIClient().get(asset["url"], {"share": "\u00e9"})
        self.assertEqual(response.status_code, 404)

    def test_published_snapshot_does_not_expose_draft_changes(self):
        token = self.publish()
        self.assertGreaterEqual(len(token), 43)
        edited = story_content()
        edited["letterBody"] = "This is still a private draft."
        self.client.patch(self.url, {"draft": edited}, format="json")
        public = APIClient().get(f"/api/shared/{token}/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data["letterBody"], "Happy birthday")
        self.assertNotIn("owner", public.data)
        self.assertIn("no-store", public["Cache-Control"])
        self.publish()
        self.assertEqual(APIClient().get(f"/api/shared/{token}/").data["letterBody"], edited["letterBody"])

    def test_unpublish_revokes_and_republish_rotates_the_link(self):
        token = self.publish()
        self.assertEqual(self.client.post(f"{self.url}unpublish/", {}, format="json").status_code, 200)
        self.assertEqual(APIClient().get(f"/api/shared/{token}/").status_code, 404)
        self.assertNotEqual(self.publish(), token)

    def test_expired_and_unknown_links_are_not_accessible(self):
        token = self.publish()
        Experience.objects.filter(pk=self.experience_id).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(APIClient().get(f"/api/shared/{token}/").status_code, 404)
        self.assertEqual(APIClient().get("/api/shared/not-a-real-token/").status_code, 404)

    def test_validate_choices_dates_lengths_and_duplicate_memories(self):
        for field, value in [("theme", "unknown"), ("birthday", "2026-02-30"), ("recipientName", "x" * 51), ("candleCount", 99), ("microphoneSensitivity", 0.001), ("microphoneSensitivity", "NaN"), ("microphoneSensitivity", "Infinity")]:
            invalid = story_content()
            invalid[field] = value
            self.assertEqual(self.client.patch(self.url, {"draft": invalid}, format="json").status_code, 400, field)
        invalid = story_content()
        invalid["memories"] *= 2
        self.assertEqual(self.client.patch(self.url, {"draft": invalid}, format="json").status_code, 400)

    def test_publish_requires_names_and_complete_optional_surprise(self):
        draft = story_content()
        draft["recipientName"] = ""
        self.assertEqual(self.client.patch(self.url, {"draft": draft}, format="json").status_code, 200)
        self.assertEqual(self.client.post(f"{self.url}publish/", {}, format="json").status_code, 400)
        draft["recipientName"] = "Sophie"
        draft["surprise"]["answer"] = ""
        self.client.patch(self.url, {"draft": draft}, format="json")
        self.assertEqual(self.client.post(f"{self.url}publish/", {}, format="json").status_code, 400)

    def test_personal_text_preserves_line_breaks_and_spacing(self):
        draft = story_content()
        draft["letterBody"] = "  My love,\n\n  Every little moment.\n\nAlways yours.  \n"
        draft["memories"][0]["caption"] = "  A little caption.  "
        draft["surprise"]["answer"] = "\nA date!\n"
        saved = self.client.patch(self.url, {"draft": draft}, format="json")
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.data["draft"]["letterBody"], draft["letterBody"])
        token = self.publish()
        shared = APIClient().get(f"/api/shared/{token}/").data
        self.assertEqual(shared["letterBody"], draft["letterBody"])
        self.assertEqual(shared["memories"][0]["caption"], draft["memories"][0]["caption"])
        self.assertEqual(shared["surprise"]["answer"], draft["surprise"]["answer"])

    def test_presentation_settings_round_trip_and_publish_separately(self):
        draft = story_content()
        draft["presentation"] = {
            "accentColor": "#57B8A8", "musicVolume": 0.45, "musicAutoplay": False,
            "chapters": {"heart": False},
            "chapterOrder": ["letter", "celebration", "heart", "memories"],
            "copy": {"celebrationHeading": "A day for you.\nOnly you.", "signOff": "Forever yours,"},
            "showBirthday": True, "showCover": True,
        }
        saved = self.client.patch(self.url, {"draft": draft}, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        settings = saved.data["draft"]["presentation"]
        self.assertEqual(settings["accentColor"], "#57B8A8")
        self.assertFalse(settings["chapters"]["heart"])
        self.assertTrue(settings["chapters"]["letter"])
        self.assertEqual(settings["copy"]["celebrationHeading"], "A day for you.\nOnly you.")
        token = self.publish()
        draft["presentation"]["copy"]["celebrationHeading"] = "Private draft change"
        self.client.patch(self.url, {"draft": draft}, format="json")
        public = APIClient().get(f"/api/shared/{token}/").data
        self.assertEqual(public["presentation"]["copy"]["celebrationHeading"], "A day for you.\nOnly you.")
        self.assertEqual(public["presentation"]["musicVolume"], 0.45)
        self.assertEqual(public["presentation"]["chapterOrder"][0], "letter")

    def test_presentation_rejects_invalid_and_unknown_settings(self):
        for presentation in [
            {"accentColor": "red; display:none"}, {"musicVolume": "NaN"},
            {"musicVolume": 1.1}, {"copy": {"wishButton": "x" * 41}},
            {"chapters": {"notAChapter": True}}, {"ignoredSetting": "lost"},
            {"chapterOrder": ["heart", "heart", "letter", "memories"]},
            {"copy": {"wishButton": "   "}},
        ]:
            draft = story_content()
            draft["presentation"] = presentation
            response = self.client.patch(self.url, {"draft": draft}, format="json")
            self.assertEqual(response.status_code, 400, presentation)

    def test_legacy_drafts_and_snapshots_receive_compatible_defaults(self):
        Experience.objects.filter(pk=self.experience_id).update(draft=story_content())
        response = self.client.get(self.url)
        self.assertEqual(response.data["draft"]["presentation"]["musicVolume"], 0.8)
        token = self.publish()
        Experience.objects.filter(pk=self.experience_id).update(published_data=story_content())
        public = APIClient().get(f"/api/shared/{token}/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data["presentation"]["copy"]["wishButton"], "Blow Candles")

    def test_hidden_incomplete_memories_do_not_block_publication(self):
        draft = story_content()
        draft["memories"][0]["url"] = ""
        draft["presentation"] = {"chapters": {"memories": False}}
        saved = self.client.patch(self.url, {"draft": draft}, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.publish()

    def test_configured_images_remain_private_until_referenced_in_publication(self):
        asset = self.image_upload()
        token = self.publish()
        draft = story_content()
        draft["presentation"] = {"celebrationMedia": {"url": asset["url"], "stillUrl": asset["url"], "alt": "Our photograph"}}
        response = self.client.patch(self.url, {"draft": draft}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(APIClient().get(f"{asset['url']}?share={token}").status_code, 404)
        self.publish()
        public = APIClient().get(f"/api/shared/{token}/").data
        self.assertEqual(public["presentation"]["celebrationMedia"]["url"], f"{asset['url']}?share={token}")
        media = APIClient().get(public["presentation"]["celebrationMedia"]["url"])
        self.assertEqual(media.status_code, 200)
        self.assertTrue(b"".join(media.streaming_content))

    def test_uploaded_images_are_normalized_and_private(self):
        asset = self.image_upload()
        self.assertEqual(APIClient().get(asset["url"]).status_code, 404)
        response = self.client.get(asset["url"])
        self.assertEqual(response["Content-Type"], "image/webp")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertTrue(b"".join(response.streaming_content))

    def test_gif_upload_keeps_animation_and_protects_its_still(self):
        output = io.BytesIO()
        frames = [Image.new("RGB", (32, 32), color) for color in ("red", "blue", "green")]
        frames[0].save(output, "GIF", save_all=True, append_images=frames[1:], duration=100, loop=0)
        response = self.client.post(f"{self.url}media/", {"kind": "image", "file": SimpleUploadedFile("hug.gif", output.getvalue(), content_type="image/gif")}, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        asset = response.data
        animation = self.client.get(asset["url"])
        with Image.open(io.BytesIO(b"".join(animation.streaming_content))) as image:
            self.assertEqual(image.n_frames, 3)
        still = self.client.get(asset["stillUrl"])
        with Image.open(io.BytesIO(b"".join(still.streaming_content))) as image:
            self.assertEqual(getattr(image, "n_frames", 1), 1)
        self.assertEqual(APIClient().get(asset["stillUrl"]).status_code, 404)
        draft = story_content()
        draft["presentation"] = {"finaleMedia": {"url": asset["url"], "stillUrl": asset["stillUrl"], "alt": "A personal animation"}}
        draft["memories"][0].update(url=asset["url"], stillUrl=asset["stillUrl"])
        saved = self.client.patch(self.url, {"draft": draft}, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        token = self.publish()
        shared_still = APIClient().get(f"{asset['stillUrl']}?share={token}")
        self.assertEqual(shared_still.status_code, 200)
        self.assertTrue(b"".join(shared_still.streaming_content))
        self.client.post(f"{self.url}unpublish/", {}, format="json")
        self.assertEqual(APIClient().get(f"{asset['stillUrl']}?share={token}").status_code, 404)
        draft["presentation"]["finaleMedia"] = {"url": "/images/flowers.jpg", "stillUrl": asset["url"], "alt": "Invalid animated still"}
        self.assertEqual(self.client.patch(self.url, {"draft": draft}, format="json").status_code, 400)

    def test_animation_requires_matching_static_image(self):
        draft = story_content()
        draft["presentation"] = {"finaleMedia": {"url": "/animations/forever-hug.gif", "stillUrl": "/animations/flowers-for-you.gif", "alt": "Our animation"}}
        self.assertEqual(self.client.patch(self.url, {"draft": draft}, format="json").status_code, 400)

    def test_shared_media_only_exposes_published_references(self):
        first = self.image_upload()
        unused = self.image_upload()
        draft = story_content()
        draft["heroImage"] = first["url"]
        self.client.patch(self.url, {"draft": draft}, format="json")
        token = self.publish()
        shared = APIClient()
        response = shared.get(f"{first['url']}?share={token}")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(b"".join(response.streaming_content))
        self.assertEqual(shared.get(f"{unused['url']}?share={token}").status_code, 404)
        self.client.post(f"{self.url}unpublish/", {}, format="json")
        self.assertEqual(shared.get(f"{first['url']}?share={token}").status_code, 404)

    def test_media_reference_cannot_cross_ownership_or_experience(self):
        asset = self.image_upload()
        self.client.force_authenticate(self.other)
        draft = story_content()
        draft["heroImage"] = asset["url"]
        self.assertEqual(self.client.post("/api/experiences/", {"draft": draft}, format="json").status_code, 400)
        self.assertEqual(self.client.get(asset["url"]).status_code, 404)

    def test_remote_and_active_content_uploads_are_rejected(self):
        draft = story_content()
        draft["heroImage"] = "https://example.com/private.jpg"
        self.assertEqual(self.client.patch(self.url, {"draft": draft}, format="json").status_code, 400)
        for name, content, content_type in [("bad.jpg", b"<script>alert(1)</script>", "image/jpeg"), ("bad.svg", b"<svg/>", "image/svg+xml")]:
            response = self.client.post(f"{self.url}media/", {"kind": "image", "file": SimpleUploadedFile(name, content, content_type=content_type)}, format="multipart")
            self.assertEqual(response.status_code, 400)

    def test_fake_video_and_oversized_image_are_rejected(self):
        response = self.client.post(f"{self.url}media/", {"kind": "video", "file": SimpleUploadedFile("bad.mp4", b"not a video" * 20, content_type="video/mp4")}, format="multipart")
        self.assertEqual(response.status_code, 400)
        response = self.client.post(f"{self.url}media/", {"kind": "image", "file": SimpleUploadedFile("huge.jpg", b"x" * (10 * 1024 * 1024 + 1), content_type="image/jpeg")}, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_private_media_supports_ranges_and_rejects_invalid_ranges(self):
        asset = self.image_upload()
        response = self.client.get(asset["url"], HTTP_RANGE="bytes=0-9")
        self.assertEqual(response.status_code, 206)
        self.assertEqual(len(b"".join(response.streaming_content)), 10)
        self.assertEqual(response["Content-Length"], "10")
        self.assertEqual(self.client.get(asset["url"], HTTP_RANGE="bytes=999999-").status_code, 416)
        self.assertEqual(self.client.get(asset["url"], HTTP_RANGE="bytes=-0").status_code, 416)

    def test_non_owner_cannot_publish_or_upload(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(f"{self.url}publish/", {}, format="json").status_code, 404)
        self.assertEqual(self.client.post(f"{self.url}media/", {}, format="multipart").status_code, 404)


class AuthenticationTests(APITestCase):
    def setUp(self):
        cache.clear()

    @override_settings(
        DEBUG=False,
        SECURE_SSL_REDIRECT=True,
        SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
        SESSION_COOKIE_SECURE=True,
        CSRF_COOKIE_SECURE=True,
        CSRF_TRUSTED_ORIGINS=["https://ever-after-test.onrender.com"],
    )
    def test_https_proxy_session_and_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        headers = {"HTTP_X_FORWARDED_PROTO": "https", "HTTP_ORIGIN": "https://ever-after-test.onrender.com"}
        response = client.get("/api/session/", **headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.cookies["csrftoken"]["secure"])
        account = {"username": "proxy-creator", "password": "proxy-test-only-strong-password-42"}
        registered = client.post("/api/register/", account, format="json", HTTP_X_CSRFTOKEN=response.data["csrfToken"], **headers)
        self.assertEqual(registered.status_code, 201, registered.data)
        self.assertTrue(registered.cookies["sessionid"]["secure"])
        rejected = client.post("/api/experiences/", {"draft": story_content()}, format="json", HTTP_X_CSRFTOKEN=registered.data["csrfToken"], HTTP_X_FORWARDED_PROTO="https", HTTP_ORIGIN="https://untrusted.example")
        self.assertEqual(rejected.status_code, 403)
        saved = client.post("/api/experiences/", {"draft": story_content()}, format="json", HTTP_X_CSRFTOKEN=registered.data["csrfToken"], **headers)
        self.assertEqual(saved.status_code, 201, saved.data)

    def test_registration_requires_csrf_even_when_anonymous(self):
        client = APIClient(enforce_csrf_checks=True)
        data = {"username": "new-person", "password": "unique-test-password-52"}
        self.assertEqual(client.post("/api/register/", data, format="json").status_code, 403)
        session = client.get("/api/session/").data
        response = client.post("/api/register/", data, format="json", HTTP_X_CSRFTOKEN=session["csrfToken"])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(client.get("/api/session/").data["user"]["username"], "new-person")
        self.assertEqual(client.post("/api/logout/", {}, format="json", HTTP_X_CSRFTOKEN=response.data["csrfToken"]).status_code, 204)
        self.assertIsNone(client.get("/api/session/").data["user"])

    def test_weak_passwords_and_bad_credentials_are_rejected(self):
        self.assertEqual(self.client.post("/api/register/", {"username": "person", "password": "1234567890"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/login/", {"username": "person", "password": "wrong"}, format="json").status_code, 403)

    def test_login_uses_a_session_and_protects_mutations(self):
        get_user_model().objects.create_user("returning", password="a-test-password-only-32")
        client = APIClient(enforce_csrf_checks=True)
        csrf = client.get("/api/session/").data["csrfToken"]
        response = client.post("/api/login/", {"username": "returning", "password": "a-test-password-only-32"}, format="json", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.post("/api/experiences/", {"draft": story_content()}, format="json").status_code, 403)
        self.assertEqual(client.post("/api/experiences/", {"draft": story_content()}, format="json", HTTP_X_CSRFTOKEN=response.data["csrfToken"]).status_code, 201)