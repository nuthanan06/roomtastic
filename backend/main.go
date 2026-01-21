package main

import (
	"encoding/base64"
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

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/hello", helloHandler)
	mux.HandleFunc("/api/process-image", uploadAndProcessImage)

	handler := enableCORS(mux)

	fmt.Println("Go server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
