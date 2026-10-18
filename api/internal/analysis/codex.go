package analysis

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"makeke/api/internal/codexcli"
	"makeke/api/internal/codexlog"
)

func (s *Service) runCodexJSONObject(prompt string, timeout time.Duration, logRunID uint64) (map[string]any, error) {
	text, err := s.runCodexText(prompt+"\n\n반드시 JSON 객체만 출력하세요. 설명과 코드블록은 금지합니다.", timeout, logRunID)
	if err != nil {
		return nil, err
	}
	raw := extractBalancedJSON(text, '{', '}')
	if raw == "" {
		return nil, fmt.Errorf("Codex JSON 객체 파싱 실패")
	}
	var parsed map[string]any
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func (s *Service) runCodexJSONArray(prompt string, timeout time.Duration, logRunID uint64) ([]any, error) {
	text, err := s.runCodexText(prompt+"\n\n반드시 JSON 배열만 출력하세요. 설명과 코드블록은 금지합니다.", timeout, logRunID)
	if err != nil {
		return nil, err
	}
	raw := extractBalancedJSON(text, '[', ']')
	if raw == "" {
		return nil, fmt.Errorf("Codex JSON 배열 파싱 실패")
	}
	var parsed []any
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func (s *Service) runCodexText(prompt string, timeout time.Duration, logRunID uint64) (string, error) {
	cliPath, err := exec.LookPath("codex")
	if err != nil {
		appendAnalysisCodexLog(logRunID, "Codex CLI not found")
		return "", fmt.Errorf("Codex CLI를 찾지 못했습니다")
	}
	args := codexcli.ExecArgs(cliPath, "-m", "gpt-5.4-mini", "-c", "model_reasoning_effort=\"low\"", "-")
	cmd := exec.Command(cliPath, args...)
	cmd.Dir = s.cfg.ProjectRoot
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	cmd.Stdin = strings.NewReader(prompt)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	appendAnalysisCodexLog(logRunID, fmt.Sprintf("Codex CLI start model=gpt-5.4-mini reasoning=low cwd=%s timeout=%s", cmd.Dir, timeout))
	done := make(chan error, 1)
	go func() { done <- cmd.Run() }()
	select {
	case err := <-done:
		if err != nil {
			message := strings.TrimSpace(stderr.String())
			if message == "" {
				message = strings.TrimSpace(stdout.String())
			}
			appendAnalysisCodexLog(logRunID, "Codex CLI failed: "+truncate(filterCodexLogNoise(message), 240))
			return "", fmt.Errorf("Codex CLI 실행 실패: %s", truncate(message, 300))
		}
		appendAnalysisCodexLog(logRunID, "Codex CLI completed")
		return strings.TrimSpace(stdout.String()), nil
	case <-time.After(timeout):
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		appendAnalysisCodexLog(logRunID, fmt.Sprintf("Codex CLI timeout: %s", timeout))
		return "", fmt.Errorf("Codex CLI 실행 타임아웃 (%s)", timeout)
	}
}

func appendAnalysisCodexLog(logRunID uint64, line string) {
	if logRunID == 0 {
		codexlog.Append(line)
		return
	}
	codexlog.AppendFor(logRunID, line)
}

func filterCodexLogNoise(text string) string {
	lines := strings.Split(text, "\n")
	filtered := make([]string, 0, len(lines))
	for _, line := range lines {
		if shouldHideCodexLogLine(line) {
			continue
		}
		filtered = append(filtered, line)
	}
	cleaned := strings.TrimSpace(strings.Join(filtered, "\n"))
	if cleaned == "" {
		return "Codex CLI error"
	}
	return cleaned
}

func shouldHideCodexLogLine(line string) bool {
	lowered := strings.ToLower(line)
	noisy := []string{
		"mcp.figma.com",
		"authrequired",
		"rmcp::transport::worker",
		"www_authenticate_header",
	}
	for _, item := range noisy {
		if strings.Contains(lowered, item) {
			return true
		}
	}
	return false
}

func extractBalancedJSON(text string, openCh rune, closeCh rune) string {
	start := -1
	depth := 0
	inString := false
	escaped := false
	for idx, ch := range text {
		if start == -1 {
			if ch == openCh {
				start = idx
				depth = 1
			}
			continue
		}
		if escaped {
			escaped = false
			continue
		}
		if ch == '\\' {
			escaped = true
			continue
		}
		if ch == '"' {
			inString = !inString
			continue
		}
		if inString {
			continue
		}
		if ch == openCh {
			depth++
		}
		if ch == closeCh {
			depth--
			if depth == 0 {
				return text[start : idx+len(string(ch))]
			}
		}
	}
	return ""
}

func fallbackText(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func truncate(text string, limit int) string {
	runes := []rune(text)
	if limit <= 0 || len(runes) <= limit {
		return text
	}
	return string(runes[:limit])
}
