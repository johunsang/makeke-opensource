package main

import (
	"log"
	"os"

	"makeke/api/internal/config"
	"makeke/api/internal/httpserver"
)

func main() {
	cfg, err := config.Load(os.Args[1:])
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	server := httpserver.New(cfg)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("server exited with error: %v", err)
	}
}
