import uuid

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver


class Experience(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="experiences")
    draft = models.JSONField(default=dict)
    published_data = models.JSONField(null=True, blank=True)
    share_token = models.CharField(max_length=64, unique=True, null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


def private_upload_path(instance, filename):
    return f"{instance.experience_id}/{uuid.uuid4().hex}/{filename}"


class MediaAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    experience = models.ForeignKey(Experience, on_delete=models.CASCADE, related_name="assets")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file = models.FileField(upload_to=private_upload_path)
    still_file = models.FileField(upload_to=private_upload_path, blank=True)
    kind = models.CharField(max_length=8, choices=[("image", "Image"), ("video", "Video"), ("audio", "Audio")])
    mime_type = models.CharField(max_length=50)
    original_name = models.CharField(max_length=200)
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def private_url(self):
        return f"/api/media/{self.id}/"

    @property
    def still_url(self):
        return f"/api/media/{self.id}/still/" if self.still_file else self.private_url


@receiver(post_delete, sender=MediaAsset)
def remove_asset_file(sender, instance, **kwargs):
    instance.file.delete(save=False)
    if instance.still_file:
        instance.still_file.delete(save=False)