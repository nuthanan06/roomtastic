from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
import time
import re


class IkeaScraper:
    def __init__(self, headless=True):
        """Initialize the Selenium WebDriver"""
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Automatically download and install ChromeDriver
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.wait = WebDriverWait(self.driver, 15)
    
    def scrape_product(self, url):
        """
        Scrape IKEA product page and extract details
        
        Args:
            url: IKEA product URL
            
        Returns:
            dict: Product details including name, description, images, dimensions, price, etc.
        """
        try:
            print(f"Loading page: {url}")
            self.driver.get(url)
            
            # Wait specifically for product content to load
            try:
                self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div[class*='pip'], main, article")))
                print("Page content loaded")
            except:
                print("Timeout waiting for content, proceeding anyway...")
            
            # Additional wait for dynamic content
            time.sleep(3)
            
            product_data = {
                "url": url,
                "name": None,
                "description": None,
                "price": None,
                "images": [],
                "dimensions": {},
                "measurements": [],
                "colors": [],
                "materials": [],
                "assembly_required": None,
                "product_details": {}
            }
            
            # Try multiple selectors for product name with more specific patterns
            name_selectors = [
                "span.pip-header-section__title--small",
                "h1.pip-header-section__title--big",
                "h1 span[class*='title']",
                ".product-name",
                "h1"
            ]
            
            for selector in name_selectors:
                try:
                    elems = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for elem in elems:
                        text = elem.text.strip()
                        if text and text.lower() not in ['products', 'ikea'] and len(text) > 2:
                            product_data["name"] = text
                            print(f"✓ Found name: {text}")
                            break
                    if product_data["name"]:
                        break
                except Exception as e:
                    continue
            
            # Extract price
            price_selectors = [
                "span.pip-temp-price__integer",
                "span.pip-price__integer",
                ".product-pip-price-package__price-value",
                "[class*='price'] span[class*='integer']"
            ]
            
            for selector in price_selectors:
                try:
                    elems = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for elem in elems:
                        text = elem.text.strip()
                        if text and (text.startswith('$') or text.isdigit()):
                            product_data["price"] = f"${text}" if not text.startswith('$') else text
                            print(f"✓ Found price: {product_data['price']}")
                            break
                    if product_data["price"]:
                        break
                except:
                    continue
            
            # Extract description
            desc_selectors = [
                ".pip-header-section__description-text",
                "div[class*='description'] p",
                ".pip-product-summary__description"
            ]
            
            for selector in desc_selectors:
                try:
                    elem = self.driver.find_element(By.CSS_SELECTOR, selector)
                    text = elem.text.strip()
                    if text and len(text) > 15:
                        product_data["description"] = text
                        print(f"✓ Found description: {text[:80]}...")
                        break
                except:
                    continue
            
            # Extract product images - be very specific
            print("Searching for product images...")
            try:
                # Strategy 1: Look for images in product image gallery/carousel
                img_containers = self.driver.find_elements(By.CSS_SELECTOR, 
                    ".pip-media-grid__media-container, .pip-image-container, [class*='media-grid'], [class*='carousel']")
                
                for container in img_containers:
                    imgs = container.find_elements(By.TAG_NAME, "img")
                    for img in imgs:
                        src = img.get_attribute("src") or img.get_attribute("data-src")
                        alt = img.get_attribute("alt") or ""
                        
                        if src and src.startswith('http'):
                            # Filter out non-product images
                            if any(skip in src.lower() for skip in ['track', 'analytics', 'bat.bing', 'categorisation', 'yahoo', 'pixel']):
                                continue
                            
                            # Look for actual product URLs
                            if 'ikea.com' in src and ('.jpg' in src or '.jpeg' in src or '.png' in src):
                                # Ensure high quality
                                if '?' in src:
                                    src = re.sub(r'\?.*', '?f=xl', src)
                                else:
                                    src = src + '?f=xl'
                                
                                if src not in product_data["images"]:
                                    product_data["images"].append(src)
                                    print(f"✓ Added product image {len(product_data['images'])}")
                
                # Strategy 2: Look in picture elements
                pictures = self.driver.find_elements(By.CSS_SELECTOR, "picture source, picture img")
                for pic in pictures:
                    srcset = pic.get_attribute("srcset") or pic.get_attribute("src")
                    if srcset and 'ikea.com' in srcset and any(ext in srcset for ext in ['.jpg', '.jpeg', '.png']):
                        # Extract first URL from srcset
                        url_match = re.search(r'(https://[^\s,]+\.(?:jpg|jpeg|png))', srcset)
                        if url_match:
                            src = url_match.group(1)
                            if '?' in src:
                                src = re.sub(r'\?.*', '?f=xl', src)
                            else:
                                src = src + '?f=xl'
                            
                            if src not in product_data["images"] and not any(skip in src.lower() for skip in ['track', 'analytics', 'categorisation']):
                                product_data["images"].append(src)
                                print(f"✓ Added product image {len(product_data['images'])}")
                
                # Strategy 3: Fallback - get ALL images with ikea.com domain if we still have none
                if len(product_data["images"]) == 0:
                    print("No images found with specific selectors, trying fallback...")
                    all_imgs = self.driver.find_elements(By.TAG_NAME, "img")
                    for img in all_imgs:
                        src = img.get_attribute("src") or img.get_attribute("data-src")
                        if src and 'ikea.com' in src and any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png']):
                            # Skip obvious non-product images
                            if any(skip in src.lower() for skip in ['track', 'analytics', 'bat.bing', 'yahoo', 'pixel', 'logo', 'icon']):
                                continue
                            
                            # Clean up URL
                            if '?' in src:
                                src = re.sub(r'\?.*', '?f=xl', src)
                            else:
                                src = src + '?f=xl'
                            
                            if src not in product_data["images"]:
                                product_data["images"].append(src)
                                print(f"✓ Added fallback image {len(product_data['images'])}: {src[:80]}...")
                                if len(product_data["images"]) >= 5:  # Limit fallback
                                    break
                        
            except Exception as e:
                print(f"Error extracting images: {e}")
            
            # Extract dimensions from the page text
            try:
                page_text = self.driver.find_element(By.TAG_NAME, "body").text
                
                # Look for measurement patterns
                dimension_patterns = [
                    (r'[Ww]idth[:\s]+(\d+(?:\.\d+)?)\s*(["\']|cm|mm|inch)', 'width'),
                    (r'[Hh]eight[:\s]+(\d+(?:\.\d+)?)\s*(["\']|cm|mm|inch)', 'height'),
                    (r'[Dd]epth[:\s]+(\d+(?:\.\d+)?)\s*(["\']|cm|mm|inch)', 'depth'),
                    (r'[Ll]ength[:\s]+(\d+(?:\.\d+)?)\s*(["\']|cm|mm|inch)', 'length')
                ]
                
                for pattern, dim_name in dimension_patterns:
                    match = re.search(pattern, page_text)
                    if match:
                        value = match.group(1)
                        unit = match.group(2)
                        if unit in ['"', "'"]:
                            unit = 'inches'
                        product_data["dimensions"][dim_name] = f"{value} {unit}"
                        print(f"✓ Found {dim_name}: {product_data['dimensions'][dim_name]}")
                        
                # Look for measurements section
                measurement_headings = self.driver.find_elements(By.XPATH, 
                    "//*[contains(translate(., 'MEASUREMENTS', 'measurements'), 'measurement')]")
                
                for heading in measurement_headings[:3]:  # Limit to avoid too much data
                    try:
                        # Get parent or next sibling content
                        parent = heading.find_element(By.XPATH, "./parent::*")
                        text = parent.text.strip()
                        if text and len(text) < 500:
                            product_data["measurements"].append(text)
                            print(f"✓ Found measurement section")
                    except:
                        continue
                        
            except Exception as e:
                print(f"Error extracting measurements: {e}")
            
            # Extract materials and other product details
            try:
                # Look for definition lists (dt/dd pairs)
                dt_elements = self.driver.find_elements(By.TAG_NAME, "dt")
                for dt in dt_elements:
                    try:
                        label = dt.text.strip()
                        dd = dt.find_element(By.XPATH, "./following-sibling::dd[1]")
                        value = dd.text.strip()
                        
                        if label and value and len(label) < 100:
                            product_data["product_details"][label] = value
                            print(f"✓ Found detail: {label}")
                            
                            # Categorize
                            label_lower = label.lower()
                            if "material" in label_lower or "made of" in label_lower:
                                if value not in product_data["materials"]:
                                    product_data["materials"].append(value)
                            elif "color" in label_lower or "colour" in label_lower:
                                if value not in product_data["colors"]:
                                    product_data["colors"].append(value)
                            elif "assembly" in label_lower:
                                product_data["assembly_required"] = value
                    except:
                        continue
            except Exception as e:
                print(f"Error extracting details: {e}")
            
            return product_data
            
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()
            return {
                "error": str(e),
                "url": url
            }
        finally:
            self.driver.quit()
    
    def close(self):
        """Close the browser"""
        if self.driver:
            self.driver.quit()


def scrape_ikea_product(url, headless=True):
    """
    Helper function to scrape an IKEA product URL
    
    Args:
        url: IKEA product URL
        headless: Run browser in headless mode
        
    Returns:
        dict: Product details
    """
    scraper = IkeaScraper(headless=headless)
    return scraper.scrape_product(url)
