package config

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	defaultPort    = 8818
	defaultService = "marketing-agent"
	defaultVersion = "1.0.0"
)

type Config struct {
	Port        int
	Service     string
	Version     string
	Runtime     string
	DataDir     string
	WorkingDir  string
	ProjectRoot string
	GoRoot      string
}

func Load(args []string) (Config, error) {
	port, remaining, err := parsePortArgs(args)
	if err != nil {
		return Config{}, err
	}

	if len(remaining) > 0 {
		return Config{}, fmt.Errorf("unexpected arguments: %s", strings.Join(remaining, " "))
	}

	cwd, err := os.Getwd()
	if err != nil {
		return Config{}, err
	}

	exePath, err := os.Executable()
	if err != nil {
		return Config{}, err
	}

	goRoot, projectRoot := discoverRoots(cwd, exePath)

	service := strings.TrimSpace(os.Getenv("MAKEKE_SERVICE_NAME"))
	if service == "" {
		service = defaultService
	}

	version := strings.TrimSpace(os.Getenv("MAKEKE_SERVER_VERSION"))
	if version == "" {
		version = defaultVersion
	}

	return Config{
		Port:        port,
		Service:     service,
		Version:     version,
		Runtime:     "go",
		DataDir:     strings.TrimSpace(os.Getenv("MAKEKE_DATA_DIR")),
		WorkingDir:  cwd,
		ProjectRoot: projectRoot,
		GoRoot:      goRoot,
	}, nil
}

func parsePortArgs(args []string) (int, []string, error) {
	fs := flag.NewFlagSet("makeke-server", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)

	portFlag := fs.Int("port", defaultPort, "port to listen on")
	if err := fs.Parse(args); err != nil {
		return 0, nil, err
	}

	remaining := fs.Args()
	if len(remaining) > 0 {
		candidate := strings.TrimSpace(remaining[0])
		if port, err := strconv.Atoi(candidate); err == nil {
			if len(remaining) > 1 {
				return 0, nil, errors.New("too many positional arguments")
			}
			return port, nil, nil
		}
	}

	return *portFlag, remaining, nil
}

func discoverRoots(cwd, exePath string) (string, string) {
	candidates := []string{
		cwd,
		filepath.Dir(exePath),
		filepath.Dir(filepath.Dir(exePath)),
		filepath.Dir(filepath.Dir(filepath.Dir(exePath))),
	}

	var goRoot string
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if fileExists(filepath.Join(candidate, "go.mod")) && dirExists(filepath.Join(candidate, "cmd", "makeke-server")) {
			goRoot = candidate
			break
		}
	}
	if goRoot == "" {
		goRoot = cwd
	}

	projectRoot := goRoot
	if filepath.Base(goRoot) == "api" {
		projectRoot = filepath.Dir(goRoot)
	}

	// 패키징된 앱에서 static/ 디렉토리가 상위에 있는 경우 보정
	if !dirExists(filepath.Join(projectRoot, "static")) {
		for _, candidate := range candidates {
			if candidate != "" && dirExists(filepath.Join(candidate, "static")) {
				projectRoot = candidate
				break
			}
		}
	}

	return filepath.Clean(goRoot), filepath.Clean(projectRoot)
}

func fileExists(target string) bool {
	info, err := os.Stat(target)
	return err == nil && !info.IsDir()
}

func dirExists(target string) bool {
	info, err := os.Stat(target)
	return err == nil && info.IsDir()
}
