package main

import (
	"encoding/base64"
	"encoding/json"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/rs/cors"
	"github.com/joho/godotenv"
)

type DepthResponse struct {
	OriginalImage string `json:"originalImage"`
	DepthMap      string `json:"depthMap"`
	BackImage     string `json:"backImage,omitempty"`
	BackDepthMap  string `json:"backDepthMap,omitempty"`
	Width         float64 `json:"width,omitempty"`
	Depth         float64 `json:"depth,omitempty"`
	Height        float64 `json:"height,omitempty"`
	Success       bool   `json:"success"`
	Error         string `json:"error,omitempty"`
}

type URLRequest struct {
	URL string `json:"url"`
}

// enableCORS wraps handler with CORS
func enableCORS(next http.Handler) http.Handler {
	return cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: true,
	}).Handler(next)
}

func uploadAndProcessImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Parse multipart form
	err := r.ParseMultipartForm(50 << 20) // 50MB max
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to parse form: %v"}`, err)
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"No file provided"}`)
		return
	}
	defer file.Close()

	// Read dimensions
	var width, depth, height float64
	if w_str := r.FormValue("width"); w_str != "" {
		fmt.Sscanf(w_str, "%f", &width)
	}
	if d_str := r.FormValue("depth"); d_str != "" {
		fmt.Sscanf(d_str, "%f", &depth)
	}
	if h_str := r.FormValue("height"); h_str != "" {
		fmt.Sscanf(h_str, "%f", &height)
	}

	// Read file into memory
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to read file"}`)
		return
	}

	// Create temp directory
	tmpDir := filepath.Join(".", "temp")
	os.MkdirAll(tmpDir, 0755)

	// Save original image
	originalPath := filepath.Join(tmpDir, "input.jpg")
	err = os.WriteFile(originalPath, fileBytes, 0644)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to save image"}`)
		return
	}

	// Run MiDaS depth estimation
	depthPath := filepath.Join(tmpDir, "depth.png")
	cmd := exec.Command("python3", "depth_estimator.py", originalPath, depthPath)
	cmd.Dir = "."

	output, err := cmd.CombinedOutput()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"MiDaS failed: %v\nOutput: %s"}`, err, string(output))
		return
	}

	// Read depth map
	depthBytes, err := os.ReadFile(depthPath)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to read depth map"}`)
		return
	}

	// Encode images to base64
	originalB64 := base64.StdEncoding.EncodeToString(fileBytes)
	depthB64 := base64.StdEncoding.EncodeToString(depthBytes)

	response := DepthResponse{
		OriginalImage: "data:image/jpeg;base64," + originalB64,
		DepthMap:      "data:image/png;base64," + depthB64,
		Width:         width,
		Depth:         depth,
		Height:        height,
		Success:       true,
	}

	// Check for optional back image
	backFile, _, err := r.FormFile("backImage")
	if err == nil {
		defer backFile.Close()

		backFileBytes, err := io.ReadAll(backFile)
		if err == nil {
			backPath := filepath.Join(tmpDir, "back_input.jpg")
			err = os.WriteFile(backPath, backFileBytes, 0644)
			if err == nil {
				backDepthPath := filepath.Join(tmpDir, "back_depth.png")
				backCmd := exec.Command("python3", "depth_estimator.py", backPath, backDepthPath)
				backCmd.Dir = "."

				if backOutput, err := backCmd.CombinedOutput(); err == nil {
					if backDepthBytes, err := os.ReadFile(backDepthPath); err == nil {
						backB64 := base64.StdEncoding.EncodeToString(backFileBytes)
						backDepthB64 := base64.StdEncoding.EncodeToString(backDepthBytes)

						response.BackImage = "data:image/jpeg;base64," + backB64
						response.BackDepthMap = "data:image/png;base64," + backDepthB64

						os.Remove(backPath)
						os.Remove(backDepthPath)
					}
				} else {
					log.Printf("Back image processing failed: %v\nOutput: %s", err, string(backOutput))
				}
			}
		}
	}

	// Clean up
	os.Remove(originalPath)
	os.Remove(depthPath)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// process3DPipeline receives a single image, generates 6 orthographic views (via a Python script),
// runs depth estimation on each view, merges point clouds and returns the images and depth maps
func process3DPipeline(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	err := r.ParseMultipartForm(200 << 20)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to parse form: %v"}` , err)
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"No file provided"}`)
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to read file"}`)
		return
	}

	// Create unique temp directory
	tmpDir := filepath.Join(".", "temp", fmt.Sprintf("run_%d", time.Now().UnixNano()))
	os.MkdirAll(tmpDir, 0755)

	inputPath := filepath.Join(tmpDir, "input.jpg")
	if err := os.WriteFile(inputPath, fileBytes, 0644); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to save input"}`)
		return
	}

	// Call the genai-based script to generate six views into tmpDir
	geminiCmd := exec.Command("python3", "gemini_orthographic_genai.py", inputPath, tmpDir)
	geminiCmd.Dir = "."
	if out, err := geminiCmd.CombinedOutput(); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"Gemini orthographic failed: %v","output":"%s"}` , err, string(out))
		return
	}

	// For each view run depth_estimator.py
	views := []string{"front", "back", "left", "right", "top", "bottom"}
	depthMapPaths := map[string]string{}
	imagePaths := map[string]string{}

	for _, v := range views {
		imgPath := filepath.Join(tmpDir, v+".png")
		depthPath := filepath.Join(tmpDir, v+"_depth.png")
		// run depth estimator
		cmd := exec.Command("python3", "depth_estimator.py", imgPath, depthPath)
		cmd.Dir = "."
		if out, err := cmd.CombinedOutput(); err != nil {
			log.Printf("depth failed for %s: %v output: %s", v, err, string(out))
			// continue but don't fail entire pipeline
			continue
		}
		depthMapPaths[v] = depthPath
		imagePaths[v] = imgPath
	}

	// Merge point clouds (normalization) into merged.ply
	mergedPath := filepath.Join(tmpDir, "merged.ply")
	mergeCmd := exec.Command("python3", "merge_point_clouds.py", tmpDir, mergedPath)
	mergeCmd.Dir = "."
	if out, err := mergeCmd.CombinedOutput(); err != nil {
		log.Printf("merge failed: %v output: %s", err, string(out))
		// proceed without merged output
	}

	// Read and encode images and depth maps
	type ViewsResponse struct {
		Views map[string]string `json:"views"`
		Depths map[string]string `json:"depths"`
		MergedPLY string `json:"mergedPly,omitempty"`
		Success bool `json:"success"`
		Error string `json:"error,omitempty"`
	}

	viewsB64 := map[string]string{}
	depthsB64 := map[string]string{}
	for _, v := range views {
		if p, ok := imagePaths[v]; ok {
			if b, err := os.ReadFile(p); err == nil {
				viewsB64[v] = "data:image/png;base64," + base64.StdEncoding.EncodeToString(b)
			}
		}
		if p, ok := depthMapPaths[v]; ok {
			if b, err := os.ReadFile(p); err == nil {
				depthsB64[v] = "data:image/png;base64," + base64.StdEncoding.EncodeToString(b)
			}
		}
	}

	var mergedB64 string
	if b, err := os.ReadFile(mergedPath); err == nil {
		mergedB64 = "data:application/octet-stream;base64," + base64.StdEncoding.EncodeToString(b)
	}

	resp := ViewsResponse{
		Views: viewsB64,
		Depths: depthsB64,
		MergedPLY: mergedB64,
		Success: true,
	}

	json.NewEncoder(w).Encode(resp)
}

func processing3DPipelinewMeshyAttempt(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	err := r.ParseMultipartForm(200 << 20)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to parse form: %v"}` , err)
		return
	}
	
	file, _, err := r.FormFile("image")
}
// tripoHandler calls the Python Tripo wrapper to generate a 3D model from an uploaded image
func tripoHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := r.ParseMultipartForm(200 << 20); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to parse form: %v"}` , err)
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"No file provided"}`)
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to read file"}`)
		return
	}

	// Create unique temp directory
	tmpDir := filepath.Join(".", "temp", fmt.Sprintf("tripo_%d", time.Now().UnixNano()))
	os.MkdirAll(tmpDir, 0755)

	inputPath := filepath.Join(tmpDir, "input.jpg")
	if err := os.WriteFile(inputPath, fileBytes, 0644); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to save input"}`)
		return
	}

	prompt := r.FormValue("prompt")

	// Call the Tripo Python wrapper
	args := []string{"tripo_generate.py", inputPath, tmpDir}
	if prompt != "" {
		args = append(args, "--prompt", prompt)
	}
	cmd := exec.Command("python3", args...)
	cmd.Dir = "."
	out, err := cmd.CombinedOutput()
	outStr := string(out)

	// Try to extract JSON object from combined output (in case script printed logs)
	first := -1
	last := -1
	for i, ch := range outStr {
		if ch == '{' {
			first = i
			break
		}
	}
	for i := len(outStr) - 1; i >= 0; i-- {
		if outStr[i] == '}' {
			last = i
			break
		}
	}

	var pyResp map[string]interface{}
	if first != -1 && last != -1 && last > first {
		jsonPart := outStr[first : last+1]
		if err := json.Unmarshal([]byte(jsonPart), &pyResp); err != nil {
			log.Printf("Failed to parse JSON from tripo script: %v\nRaw output:\n%s", err, outStr)
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, `{"success":false,"error":"Invalid JSON from tripo script","output":"%s"}` , outStr)
			return
		}
	} else {
		// No JSON found
		log.Printf("No JSON found in tripo wrapper output:\n%s", outStr)
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"No JSON output from tripo script","output":"%s"}` , outStr)
		return
	}

	// If python reported error, forward it
	if errMsg, ok := pyResp["error"]; ok {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": errMsg})
		return
	}

	// Read files listed in response and base64-encode to return to frontend
	models := map[string]string{}
	if filesObj, ok := pyResp["files"].(map[string]interface{}); ok {
		for k, v := range filesObj {
			if pathStr, ok := v.(string); ok {
				if b, err := os.ReadFile(pathStr); err == nil {
					// choose content type heuristically
					mime := "application/octet-stream"
					if filepath.Ext(pathStr) == ".glb" {
						mime = "model/gltf-binary"
					} else if filepath.Ext(pathStr) == ".ply" {
						mime = "application/octet-stream"
					}
					models[k] = fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(b))
				}
			}
		}
	}

	resp := map[string]interface{}{"success": true, "models": models}
	json.NewEncoder(w).Encode(resp)
}

func helloHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello from Go backend!")
}

func processURLImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Parse JSON request
	var req URLRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"Invalid request"}`)
		return
	}

	if req.URL == "" {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"URL is required"}`)
		return
	}

	// Download image from URL
	resp, err := http.Get(req.URL)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to fetch URL: %v"}`, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to fetch URL: HTTP %d"}`, resp.StatusCode)
		return
	}

	// Read image data
	fileBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to read image"}`)
		return
	}

	// Create temp directory
	tmpDir := filepath.Join(".", "temp")
	os.MkdirAll(tmpDir, 0755)

	// Save original image
	originalPath := filepath.Join(tmpDir, "input_url.jpg")
	err = os.WriteFile(originalPath, fileBytes, 0644)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("Failed to save image to %s: %v", originalPath, err)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to save image"}`)
		return
	}

	// Verify file was written
	if _, err := os.Stat(originalPath); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("File not found after writing: %s, error: %v", originalPath, err)
		fmt.Fprintf(w, `{"success":false,"error":"File not created"}`)
		return
	}

	// Get working directory for logging
	wd, _ := os.Getwd()
	log.Printf("Working directory: %s, Input path: %s, Depth path: temp/depth_url.png", wd, originalPath)

	// Run MiDaS depth estimation
	depthPath := filepath.Join(tmpDir, "depth_url.png")
	cmd := exec.Command("python3", "depth_estimator.py", originalPath, depthPath)
	cmd.Dir = "."

	output, err := cmd.CombinedOutput()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("MiDaS error for URL %s: %v\nInput: %s\nOutput: %s\nDepth: %s", req.URL, err, originalPath, string(output), depthPath)
		fmt.Fprintf(w, `{"success":false,"error":"MiDaS failed: %v\nOutput: %s"}`, err, string(output))
		return
	}

	// Read depth map
	depthBytes, err := os.ReadFile(depthPath)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("Failed to read depth map from %s: %v", depthPath, err)
		fmt.Fprintf(w, `{"success":false,"error":"Failed to read depth map"}`)
		return
	}

	// Encode images to base64
	originalB64 := base64.StdEncoding.EncodeToString(fileBytes)
	depthB64 := base64.StdEncoding.EncodeToString(depthBytes)

	// Clean up
	os.Remove(originalPath)
	os.Remove(depthPath)

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"originalImage":"data:image/jpeg;base64,%s","depthMap":"data:image/png;base64,%s","success":true}`, 
		originalB64, depthB64)
}

func main() {
	// Load .env so environment variables like TRIPO_API_KEY are available
	if err := godotenv.Load(".env"); err != nil {
		fmt.Println("No .env file loaded (this may be fine if env vars are set in the shell):", err)
	}
	mux := http.NewServeMux()

	mux.HandleFunc("/api/hello", helloHandler)
	mux.HandleFunc("/api/process-image", uploadAndProcessImage)
	mux.HandleFunc("/api/process-url", processURLImage)
	mux.HandleFunc("/api/process-3d", process3DPipeline)
	mux.HandleFunc("/api/tripo", tripoHandler)

	handler := enableCORS(mux)

	fmt.Println("Go server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
