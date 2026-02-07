package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/rs/cors"
)

type DepthResponse struct {
	OriginalImage string `json:"originalImage"`
	DepthMap      string `json:"depthMap"`
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
		Success:       true,
	}

	// Clean up
	os.Remove(originalPath)
	os.Remove(depthPath)

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"originalImage":"%s","depthMap":"%s","success":true}`, 
		strings.ReplaceAll(response.OriginalImage, "\"", "\\\""),
		strings.ReplaceAll(response.DepthMap, "\"", "\\\""))
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
	mux := http.NewServeMux()

	mux.HandleFunc("/api/hello", helloHandler)
	mux.HandleFunc("/api/process-image", uploadAndProcessImage)
	mux.HandleFunc("/api/process-url", processURLImage)

	handler := enableCORS(mux)

	fmt.Println("Go server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
