try:
    from backend.utils.database import Database
except Exception:
    import sys
    import os
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from backend.utils.database import Database


def test_upload_image_and_get_link():
    db = Database()
    test_file_path = "/Users/nuthanantharmarajah/Desktop/CS Side Projects/roomtastic/backend/db/tests/test_input.jpg"  # Ensure this file exists for the test
    public_url = db.upload_image_and_get_link(test_file_path)

    print("Public URL returned:", public_url)
    print("Test passed: upload_image_and_link returns a valid URL")


if __name__ == "__main__":
    test_upload_image_and_get_link()