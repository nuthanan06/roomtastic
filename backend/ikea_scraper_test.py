#!/usr/bin/env python3
"""
Standalone IKEA Product Scraper
Usage: python ikea_scraper_test.py <IKEA_URL>
"""

import sys
import json
from utils.ikea_scraper import scrape_ikea_product


def main():
    if len(sys.argv) < 2:
        print("Usage: python ikea_scraper_test.py <IKEA_URL>")
        print("\nExample:")
        print("  python ikea_scraper_test.py 'https://www.ikea.com/us/en/p/songesand-bed-frame-brown-luroey-s49307319/'")
        sys.exit(1)
    
    url = sys.argv[1]
    
    if 'ikea.com' not in url.lower():
        print("Error: Please provide a valid IKEA URL")
        sys.exit(1)
    
    print(f"Scraping IKEA product: {url}")
    print("-" * 60)
    
    # Scrape the product
    product_data = scrape_ikea_product(url, headless=True)
    
    if 'error' in product_data:
        print(f"Error: {product_data['error']}")
        sys.exit(1)
    
    # Pretty print the results
    print("\n✓ Product scraped successfully!\n")
    
    if product_data.get('name'):
        print(f"Name: {product_data['name']}")
    
    if product_data.get('price'):
        print(f"Price: {product_data['price']}")
    
    if product_data.get('description'):
        print(f"\nDescription:\n{product_data['description']}")
    
    if product_data.get('dimensions'):
        print(f"\nDimensions:")
        for key, value in product_data['dimensions'].items():
            print(f"  - {key.capitalize()}: {value} cm")
    
    if product_data.get('measurements'):
        print(f"\nMeasurements:")
        for measurement in product_data['measurements']:
            print(f"  - {measurement}")
    
    if product_data.get('materials'):
        print(f"\nMaterials:")
        for material in product_data['materials']:
            print(f"  - {material}")
    
    if product_data.get('colors'):
        print(f"\nColors:")
        for color in product_data['colors']:
            print(f"  - {color}")
    
    if product_data.get('assembly_required'):
        print(f"\nAssembly Required: {product_data['assembly_required']}")
    
    if product_data.get('images'):
        print(f"\nImages ({len(product_data['images'])} found):")
        for i, img_url in enumerate(product_data['images'][:5], 1):
            print(f"  {i}. {img_url}")
        if len(product_data['images']) > 5:
            print(f"  ... and {len(product_data['images']) - 5} more")
    
    if product_data.get('product_details'):
        print(f"\nAdditional Details:")
        for key, value in product_data['product_details'].items():
            print(f"  - {key}: {value}")
    
    # Save to JSON file
    output_file = "ikea_product_data.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(product_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Full data saved to: {output_file}")
    print("-" * 60)


if __name__ == "__main__":
    main()
