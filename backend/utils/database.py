import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client


class Database:
    def __init__(self):
        # Load environment variables from .env (if present)
        load_dotenv()

        # Initialize Supabase client
        url: str | None = os.environ.get("SUPABASE_URL")
        key: str | None = os.environ.get("SUPABASE_KEY")

        if not url or not key:
            raise ValueError(
                "Missing SUPABASE_URL or SUPABASE_KEY environment variables. Check your .env or environment."
            )

        self.supabase: Client = create_client(url, key)

    def upload_image_and_get_link(self, file_path) -> str:
        """
        Uploads a file to Supabase Storage and returns a public URL.
        """
        try:
            bucket_name = os.environ.get(
                "SUPABASE_BUCKETNAME"
            )  # Make sure this bucket exists
            if not bucket_name:
                raise ValueError("SUPABASE_BUCKETNAME env var is not set")

            # Read file content from local path
            with open(file_path, "rb") as f:
                file_content = f.read()

            # Use just the basename for the destination key
            dest = os.path.basename(file_path)

            # Try upload; if it fails (e.g. object exists or SDK mismatch), remove and retry
            try:
                upload_result = self.supabase.storage.from_(bucket_name).upload(
                    dest, file_content
                )
            except Exception as e:
                # attempt to remove existing object and retry
                try:
                    self.supabase.storage.from_(bucket_name).remove([dest])
                except Exception:
                    pass
                try:
                    upload_result = self.supabase.storage.from_(bucket_name).upload(
                        dest, file_content
                    )
                except Exception as e2:
                    raise RuntimeError(
                        f"Failed to upload to Supabase storage: {e2}"
                    ) from e

            # If upload_result is falsy, raise
            if not upload_result:
                raise RuntimeError("Upload returned no result")

            print("File uploaded successfully!")

            # Get public URL (normalize possible return shapes)
            pub = self.supabase.storage.from_(bucket_name).get_public_url(dest)
            url = None
            if isinstance(pub, dict):
                url = (
                    pub.get("publicURL")
                    or pub.get("publicUrl")
                    or pub.get("public_url")
                )
            else:
                url = (
                    getattr(pub, "publicURL", None)
                    or getattr(pub, "publicUrl", None)
                    or (pub if isinstance(pub, str) else None)
                )

            return url or ""
        except Exception as e:
            msg = str(e)
            if "Bucket not found" in msg or "bucket not found" in msg.lower():
                print(
                    "Error: bucket not found. Check SUPABASE_BUCKETNAME and that the bucket exists in your Supabase project."
                )
                print(f"Configured bucket: {bucket_name}")
                print(
                    "To fix: create the bucket in the Supabase dashboard (Storage → Buckets) or set SUPABASE_BUCKETNAME to an existing bucket."
                )
                print(
                    "If you want the file to be accessible publicly, make the bucket public or use signed URLs (create_signed_url)."
                )
            else:
                print("Error with Supabase client or storage:", e)
            return ""
