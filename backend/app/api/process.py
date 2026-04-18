from fastapi import HTTPException


def process_url(req: dict):
    url = req.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    raise HTTPException(
        status_code=410,
        detail="Web scraping has been removed from this API.",
    )
