package content

import (
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultCodexImageTimeout      = 10 * time.Minute
	defaultComicCodexImageTimeout = 15 * time.Minute
	defaultComicScriptTimeout     = 5 * time.Minute
)

func parseTimeoutSeconds(raw string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(raw)
	if value == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(value)
	if err != nil || seconds <= 0 {
		return fallback
	}
	return time.Duration(seconds) * time.Second
}

func (s *Service) codexImageTimeout() time.Duration {
	if envValue := strings.TrimSpace(os.Getenv("MAKEKE_CODEX_IMAGE_TIMEOUT_SECONDS")); envValue != "" {
		return parseTimeoutSeconds(envValue, defaultCodexImageTimeout)
	}
	return parseTimeoutSeconds(s.getSetting("TIMEOUTS.codex_image_timeout_seconds", ""), defaultCodexImageTimeout)
}

func (s *Service) comicCodexImageTimeout() time.Duration {
	if envValue := strings.TrimSpace(os.Getenv("MAKEKE_CODEX_COMIC_IMAGE_TIMEOUT_SECONDS")); envValue != "" {
		return parseTimeoutSeconds(envValue, defaultComicCodexImageTimeout)
	}
	if raw := strings.TrimSpace(s.getSetting("TIMEOUTS.comic_codex_image_timeout_seconds", "")); raw != "" {
		return parseTimeoutSeconds(raw, defaultComicCodexImageTimeout)
	}
	return s.codexImageTimeout()
}

func (s *Service) comicScriptTimeout() time.Duration {
	if envValue := strings.TrimSpace(os.Getenv("MAKEKE_COMIC_SCRIPT_TIMEOUT_SECONDS")); envValue != "" {
		return parseTimeoutSeconds(envValue, defaultComicScriptTimeout)
	}
	if raw := strings.TrimSpace(s.getSetting("TIMEOUTS.comic_script_timeout_seconds", "")); raw != "" {
		return parseTimeoutSeconds(raw, defaultComicScriptTimeout)
	}
	return defaultComicScriptTimeout
}
