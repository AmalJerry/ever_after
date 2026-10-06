import hashlib
import os
import secrets
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv, set_key


BASE_DIR = Path(__file__).resolve().parent.parent
ON_RENDER = os.environ.get("RENDER", "false").lower() == "true"
if not ON_RENDER and os.environ.get("DJANGO_LOAD_DOTENV", "true").lower() == "true":
    load_dotenv(BASE_DIR / ".env")
DEBUG = os.environ.get("DJANGO_DEBUG", "false" if ON_RENDER else "true").lower() == "true"
if ON_RENDER and DEBUG:
    raise ImproperlyConfigured("DJANGO_DEBUG must be false on Render.")
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("Set a unique DJANGO_SECRET_KEY in production.")
    SECRET_KEY = secrets.token_urlsafe(64)
    set_key(str(BASE_DIR / ".env"), "DJANGO_SECRET_KEY", SECRET_KEY)
if ON_RENDER:
    if len(SECRET_KEY) < 32:
        raise ImproperlyConfigured("Use a generated, high-entropy DJANGO_SECRET_KEY on Render.")
    SECRET_KEY = hashlib.sha256(SECRET_KEY.encode("utf-8")).hexdigest()

ALLOWED_HOSTS = [host.strip() for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()]
for render_host in (os.environ.get("RENDER_EXTERNAL_HOSTNAME"), os.environ.get("DJANGO_INTERNAL_HOST")):
    if render_host and render_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(render_host)
CSRF_TRUSTED_ORIGINS = [origin.strip().rstrip("/") for origin in os.environ.get(
    "DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000" if DEBUG else ""
).split(",") if origin.strip()]
PUBLIC_SITE_URL = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
if ON_RENDER and not PUBLIC_SITE_URL:
    raise ImproperlyConfigured("Set PUBLIC_SITE_URL to the public frontend HTTPS origin on Render.")
if PUBLIC_SITE_URL:
    public_site = urlsplit(PUBLIC_SITE_URL)
    if public_site.scheme not in ({"http", "https"} if DEBUG else {"https"}) or not public_site.netloc or public_site.path or public_site.query or public_site.fragment or public_site.username:
        raise ImproperlyConfigured("PUBLIC_SITE_URL must be the exact frontend origin, using HTTPS in production.")
    if PUBLIC_SITE_URL not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(PUBLIC_SITE_URL)
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "stories",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
database_url = os.environ.get("DATABASE_URL")
if database_url:
    parsed_database = urlsplit(database_url)
    if parsed_database.scheme not in {"postgres", "postgresql"}:
        raise ImproperlyConfigured("DATABASE_URL must be a PostgreSQL URL.")
    database_options = parse_qs(parsed_database.query)
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parsed_database.path.lstrip("/")),
        "USER": unquote(parsed_database.username or ""),
        "PASSWORD": unquote(parsed_database.password or ""),
        "HOST": parsed_database.hostname or "localhost",
        "PORT": parsed_database.port or 5432,
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
        "OPTIONS": {"sslmode": database_options.get("sslmode", ["require"])[0], "connect_timeout": 5},
    }}
else:
    sqlite_path = os.environ.get("DJANGO_SQLITE_PATH")
    if ON_RENDER and (
        os.environ.get("DJANGO_ALLOW_EPHEMERAL_SQLITE", "false").lower() != "true" or not sqlite_path
    ):
        raise ImproperlyConfigured("Set DATABASE_URL, or explicitly enable disposable storage with DJANGO_ALLOW_EPHEMERAL_SQLITE=true and an absolute DJANGO_SQLITE_PATH. Free Render storage is lost on sleep, restart, or redeploy.")
    sqlite_database = Path(sqlite_path or str(BASE_DIR / "db.sqlite3"))
    if not sqlite_database.is_absolute():
        raise ImproperlyConfigured("DJANGO_SQLITE_PATH must be an absolute path.")
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": sqlite_database,
        "OPTIONS": {"timeout": 20},
    }}

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
if not DEBUG:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "ever_after_cache", "TIMEOUT": 300}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"auth": "20/minute", "creator": "180/minute", "shared": "120/minute", "upload": "30/hour"},
    "NUM_PROXIES": 0,
}
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
if ON_RENDER and not os.environ.get("DJANGO_MEDIA_ROOT"):
    raise ImproperlyConfigured("Set DJANGO_MEDIA_ROOT to an absolute media directory on Render; free service storage is temporary.")
MEDIA_ROOT = Path(os.environ.get("DJANGO_MEDIA_ROOT") or str(BASE_DIR / "media"))
if not MEDIA_ROOT.is_absolute():
    raise ImproperlyConfigured("DJANGO_MEDIA_ROOT must be an absolute path.")
MEDIA_URL = "/private-media/"
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FILES = 1
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "no-referrer"
X_FRAME_OPTIONS = "DENY"
SECURE_SSL_REDIRECT = not DEBUG
SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
if os.environ.get("DJANGO_TRUST_PROXY", "false").lower() == "true":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")