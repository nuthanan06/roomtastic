# Roomtastic

An AI-powered spatial design platform that converts 2D images to interactive 3D models.

## Current Feature: 2D→3D Model Conversion

Convert any 2D image into an interactive 3D visualization using depth estimation:

- **Upload** a 2D image (room, object, landscape)
- **Process** with MiDaS depth estimation
- **Visualize** as rotating 3D model with Three.js
- **Interact** with auto-rotating object

## Tech Stack

- **Frontend**: React + Next.js 16 + Three.js + TypeScript
- **Backend**: Go + Python (MiDaS)
- **Depth Estimation**: Meta's MiDaS (DPT-Hybrid)
- **3D Rendering**: Three.js with WebGL

## Quick Start

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) for detailed setup instructions.

### Backend
```bash
cd backend
go mod tidy
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
go run main.go
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` and upload an image!

## Architecture

```
Image → MiDaS Depth Est. → Depth Map
           ↓
    Depth + Texture
           ↓
    Three.js PlaneGeometry
           ↓
    Vertex Displacement
           ↓
    Interactive 3D Model
```

## Future Enhancements

- [ ] Model export (GLTF/OBJ)
- [ ] Multiple depth models
- [ ] Post-processing effects
- [ ] Model caching/storage
- [ ] Batch processing
- [ ] Room design tools
- [ ] Furniture integration

## Future: Original Vision

An AI-powered spatial design platform that converts web-scrapped real-world furniture into interactive 3D assets and lets users design rooms using layout tools
