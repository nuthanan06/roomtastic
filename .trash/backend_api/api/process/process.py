
import os
import time
import requests
import subprocess
import json
import base64
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from utils.meshy import MeshyHelper
from utils.database import Database

def process_url(req: dict):
    url = req.get('url')
    if not url:
        raise HTTPException(status_code=400, detail='url is required')

    tmp_dir = os.path.join(os.getcwd(), 'temp')
    os.makedirs(tmp_dir, exist_ok=True)
    
    product_info = None
    
    # Check if it's an IKEA product URL
    if 'ikea.com' in url.lower() and not url.startswith('data:'):
        try:
            print(f"Detected IKEA URL, scraping product information...")
            from utils.ikea_scraper import scrape_ikea_product
            
            product_info = scrape_ikea_product(url, headless=True)
            
            if 'error' in product_info:
                raise HTTPException(status_code=500, detail=f"Failed to scrape IKEA product: {product_info['error']}")
            
            # Use the first product image if available
            if product_info.get('images') and len(product_info['images']) > 0:
                image_url_to_fetch = product_info['images'][0]
                print(f"Using scraped product image: {image_url_to_fetch}")
                
                # Download the scraped image
                r = requests.get(image_url_to_fetch)
                if r.status_code != 200:
                    raise HTTPException(status_code=400, detail=f'Failed to fetch scraped image: HTTP {r.status_code}')
                
                original_path = os.path.join(tmp_dir, f"ikea_product_{int(time.time()*1000)}.jpg")
                with open(original_path, 'wb') as f:
                    f.write(r.content)
            else:
                raise HTTPException(status_code=400, detail='No product images found in IKEA scraping')
                
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f'IKEA scraping error: {str(e)}')
    
    # Handle data URIs or regular image URLs
    elif url.startswith('data:'):
        comma = url.find(',')
        if comma < 0:
            raise HTTPException(status_code=400, detail='invalid data URI')
        meta = url[5:comma]
        data = url[comma+1:]
        if ';base64' in meta:
            file_bytes = base64.b64decode(data)
        else:
            file_bytes = data.encode()
        original_path = os.path.join(tmp_dir, f"input_{int(time.time()*1000)}.jpg")
        with open(original_path, 'wb') as f:
            f.write(file_bytes)
    else:
        # remote URL
        r = requests.get(url)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail=f'Failed to fetch URL: HTTP {r.status_code}')
        original_path = os.path.join(tmp_dir, f"input_{int(time.time()*1000)}_{os.path.basename(url)}")
        with open(original_path, 'wb') as f:
            f.write(r.content)

    # Use Database and MeshyHelper directly
    try:
        db = Database()
        image_url = db.upload_image_and_get_link(original_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'upload error: {e}')

    try:
        # Use product name and description if available from IKEA scraping
        name = product_info.get('name', os.path.basename(original_path)) if product_info else os.path.basename(original_path)
        description = product_info.get('description', 'created from URL') if product_info else 'created from URL'
        
        mh = MeshyHelper(name=name, description=description, image_url=image_url)
        task_id = mh.create_image_to_3d(image_url, should_texture=True, enable_pbr=True, should_remesh=True, save_pre_remeshed_model=True)
        glb = mh.get_glb_link(task_id, wait=True, timeout=900, poll_interval=5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Meshy error: {e}')

    response = {
        "success": True, 
        "task_id": task_id, 
        "glb_url": glb
    }
    
    # Include product information if it was scraped
    if product_info:
        response["product_info"] = product_info
    
    return response
