import django.db.models.deletion
import stories.models
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Experience',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('draft', models.JSONField(default=dict)),
                ('published_data', models.JSONField(blank=True, null=True)),
                ('share_token', models.CharField(blank=True, max_length=64, null=True, unique=True)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='experiences', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='MediaAsset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('file', models.FileField(upload_to=stories.models.private_upload_path)),
                ('kind', models.CharField(choices=[('image', 'Image'), ('video', 'Video'), ('audio', 'Audio')], max_length=8)),
                ('mime_type', models.CharField(max_length=50)),
                ('original_name', models.CharField(max_length=200)),
                ('size', models.PositiveIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('experience', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assets', to='stories.experience')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
