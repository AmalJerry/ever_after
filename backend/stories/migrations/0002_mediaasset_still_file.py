from django.db import migrations, models

import stories.models


class Migration(migrations.Migration):
    dependencies = [("stories", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="mediaasset",
            name="still_file",
            field=models.FileField(blank=True, upload_to=stories.models.private_upload_path),
        ),
    ]