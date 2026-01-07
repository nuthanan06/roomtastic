package main

import (
    "fmt"
    "log"
    "net/http"
)

func helloHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello from Go backend!")
}

func main() {
    http.HandleFunc("/api/hello", helloHandler)
    fmt.Println("Go server running on http://localhost:8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
