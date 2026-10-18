package content

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func resolveCLIPath(name string) (string, error) {
	envName := strings.ToUpper(name) + "_CLI"
	if value := strings.TrimSpace(os.Getenv(envName)); value != "" {
		if info, err := os.Stat(value); err == nil && !info.IsDir() {
			return value, nil
		}
	}
	names := []string{name}
	if name == "claude" {
		names = append(names, "claude-code")
	}
	for _, candidateName := range names {
		if cliPath, err := exec.LookPath(candidateName); err == nil {
			return cliPath, nil
		}
	}
	home, _ := os.UserHomeDir()
	candidates := make([]string, 0, len(names)*5)
	for _, candidateName := range names {
		candidates = append(candidates,
			filepath.Join(home, ".local", "bin", candidateName),
			filepath.Join(home, ".npm-global", "bin", candidateName),
			filepath.Join(home, ".bun", "bin", candidateName),
			"/opt/homebrew/bin/"+candidateName,
			"/usr/local/bin/"+candidateName,
		)
	}
	if appData := strings.TrimSpace(os.Getenv("APPDATA")); appData != "" {
		for _, candidateName := range names {
			candidates = append(candidates,
				filepath.Join(appData, "npm", candidateName+".cmd"),
				filepath.Join(appData, "npm", candidateName+".ps1"),
				filepath.Join(appData, "npm", candidateName),
			)
		}
	}
	if localAppData := strings.TrimSpace(os.Getenv("LOCALAPPDATA")); localAppData != "" {
		for _, candidateName := range names {
			candidates = append(candidates,
				filepath.Join(localAppData, "Programs", "nodejs", candidateName+".cmd"),
				filepath.Join(localAppData, "Programs", "nodejs", candidateName),
			)
		}
	}
	if home != "" {
		for _, candidateName := range names {
			if matches, _ := filepath.Glob(filepath.Join(home, ".nvm", "versions", "node", "*", "bin", candidateName)); len(matches) > 0 {
				candidates = append(matches, candidates...)
			}
		}
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	return "", exec.ErrNotFound
}
