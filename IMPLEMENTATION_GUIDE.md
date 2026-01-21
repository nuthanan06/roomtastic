# 2D to 3D Model Conversion Pipeline

## Architecture

```
User Upload
    ↓
Frontend (React/Next.js) → Upload Form
    ↓
Backend (Go) → /api/process-image
    ↓
Python Script → MiDaS Depth Estimation
    ↓
Backend Returns (Base64)
    - original_image.jpg
    - depth_map.png
    ↓
Frontend (Three.js) → 3D Visualization
    - PlaneGeometry with 256x256 segments
    - Vertex displacement based on depth
    - Auto-rotating 3D view
```

## Setup Instructions

### 1. Backend Setup (Go)

```bash
cd backend

# Install dependencies
go mod tidy
go get github.com/gorilla/cors

# For MiDaS Python integration
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the backend
go run main.go
```

The backend will start on `http://localhost:8080`

### 2. Frontend Setup (Node.js)

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will start on `http://localhost:3000`

## How It Works

### Step 1: Image Upload
- User selects an image via the web interface
- Image preview is shown before processing

### Step 2: Depth Estimation (Backend)
- Go backend receives the image file
- Calls Python script with MiDaS model
- MiDaS generates a depth map (grayscale PNG)
- Both original and depth map are returned as base64

### Step 3: 3D Rendering (Frontend)
- **Geometry**: `PlaneGeometry(4, 3, 256, 256)`
  - 4 units wide × 3 units tall
  - 256×256 segments for high detail
  
- **Displacement**: 
  - Sample depth map at each vertex
  - Z-displacement = normalized_depth × 0.8
  - Recompute vertex normals for lighting
  
- **Material**: Phong material with original image as texture
- **Animation**: Auto-rotating 3D object with interactive lighting

## API Endpoints

### POST /api/process-image
Processes an image and returns depth map

**Request:**
```
Content-Type: multipart/form-data
Body:
  - image: <File>
```

**Response:**
```json
{
  "success": true,
  "originalImage": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "depthMap": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA...",
  "error": null
}
```

## Model Performance

### MiDaS Model: DPT-Hybrid
- **Speed**: ~0.3-1.0 seconds per image (GPU accelerated)
- **Resolution**: Works with any input size
- **Accuracy**: High quality depth estimation
- **Memory**: ~1.5GB (with GPU)

### Configuration Options

In `depth_estimator.py`, you can modify:
```python
model_type = "dpt_hybrid"  # Options: dpt_hybrid, dpt_large, midas_v2
```

## Troubleshooting

### Python/MiDaS Not Found
```bash
pip install -r backend/requirements.txt
```

### CORS Issues
The backend includes CORS middleware configured for `localhost:3000`

### Out of Memory
- Reduce vertex segments: `PlaneGeometry(4, 3, 128, 128)`
- Use CPU instead of GPU in Python script

## Performance Tips

1. **Vertex Resolution**: More segments = more detail but slower
   - 256×256: High quality, slower rendering
   - 128×128: Balanced
   - 64×64: Fast

2. **Depth Scale**: Adjust in `Viewer3D.tsx`:
   ```typescript
   positionAttribute.setZ(i, depth * 0.8);  // Change 0.8 multiplier
   ```

3. **Model Selection**: In `depth_estimator.py`:
   - `dpt_hybrid`: Fast & accurate (default)
   - `dpt_large`: Slower but more detailed

## Next Steps / Enhancements

- [ ] Add model export (GLTF/OBJ)
- [ ] Implement post-processing filters
- [ ] Add multiple depth estimation models
- [ ] User interaction (mouse controls)
- [ ] Comparison view (side-by-side original/depth)
- [ ] Batch processing
- [ ] Result sharing/caching
