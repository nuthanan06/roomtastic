import os

import requests
from fastapi import HTTPException


def process_url(req: dict):
    url = req.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    tmp_dir = os.path.join(os.getcwd(), "temp")
    os.makedirs(tmp_dir, exist_ok=True)

    product_info = None

    if "ikea.com" in url.lower() and not url.startswith("data:"):
        try:
            print("Detected IKEA URL, scraping product information...")
            from utils.ikea_scraper import scrape_ikea_product

            product_info = scrape_ikea_product(url, headless=True)

            if "error" in product_info:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to scrape IKEA product: {product_info['error']}",
                )

            if product_info.get("images") and len(product_info["images"]) > 0:
                image_url_to_fetch = product_info["images"][0]
                print(f"Using scraped product image: {image_url_to_fetch}")

                r = requests.get(image_url_to_fetch, timeout=60)
                if r.status_code == 200:
                    print(f"Successfully downloaded product image: {image_url_to_fetch}")
                else:
                    print(f"Failed to download product image: {image_url_to_fetch}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to download product image: {image_url_to_fetch}",
                    )

            return {"success": True, "product": product_info}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "product": product_info, "url": url}
