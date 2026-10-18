package codingagent

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"makeke/api/internal/config"
)

var cliCandidates = map[string][]string{
	"claude": {"claude", "claude-code"},
	"codex":  {"codex"},
	"gemini": {"gemini"},
	"kimi":   {"kimi", "kimi-cli"},
}

type Service struct {
	cfg       config.Config
	workspace string
}

type ToolStatus struct {
	Installed bool   `json:"installed"`
	Path      string `json:"path,omitempty"`
	LoggedIn  bool   `json:"logged_in"`
}

type AuthArtifacts struct {
	LoggedIn  bool     `json:"logged_in"`
	Artifacts []string `json:"artifacts"`
}

type loginRequest struct {
	Tool string `json:"tool"`
}

type runRequest struct {
	Tool            string   `json:"tool"`
	Prompt          string   `json:"prompt"`
	Cwd             string   `json:"cwd"`
	Timeout         int      `json:"timeout"`
	SessionID       string   `json:"session_id"`
	SystemPrompt    string   `json:"system_prompt"`
	DesignHTML      string   `json:"design_html"`
	DesignMode      string   `json:"design_mode"`
	ReferenceImages []string `json:"reference_images"`
}

func New(cfg config.Config) *Service {
	workspace := filepath.Join(resolveDataDir(cfg), "coding-agent", "workspace")
	_ = os.MkdirAll(workspace, 0o755)
	return &Service{
		cfg:       cfg,
		workspace: workspace,
	}
}

func (s *Service) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/coding-agent/which", s.handleWhich)
	mux.HandleFunc("/api/coding-agent/login-status", s.handleLoginStatus)
	mux.HandleFunc("/api/coding-agent/login", s.handleLogin)
	mux.HandleFunc("/api/coding-agent/files", s.handleFiles)
	mux.HandleFunc("/api/coding-agent/run", s.handleRun)
}

func (s *Service) handleWhich(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	out := map[string]ToolStatus{}
	for _, name := range sortedTools() {
		path := resolveCLI(name)
		out[name] = ToolStatus{
			Installed: path != "",
			Path:      path,
			LoggedIn:  path != "" && checkLoggedIn(name),
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ok",
		"tools":     out,
		"workspace": s.workspace,
		"runtime":   s.cfg.Runtime,
	})
}

func (s *Service) handleLoginStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	out := map[string]AuthArtifacts{}
	for _, name := range sortedTools() {
		out[name] = checkAuthArtifacts(name)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"tools":  out,
	})
}

func (s *Service) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}

	tool := strings.TrimSpace(strings.ToLower(req.Tool))
	if tool == "" {
		tool = "codex"
	}
	cli := resolveCLI(tool)
	if cli == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("CLI 도구 '%s' 가 설치되지 않았습니다.", tool)})
		return
	}

	command := loginCommand(tool, cli)
	res, err := openTerminalWith(command, s.workspace)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	res["tool"] = tool
	res["cli_path"] = cli
	res["hint"] = "열린 터미널에서 안내를 따라 로그인을 완료하세요. 브라우저가 자동으로 열립니다."
	writeJSON(w, http.StatusOK, res)
}

func (s *Service) handleFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	target := strings.TrimSpace(r.URL.Query().Get("path"))
	base := s.workspace
	if target != "" {
		base = target
	}

	entries, err := os.ReadDir(base)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, map[string]any{
				"status": "ok",
				"cwd":    base,
				"files":  []any{},
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	files := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		item := map[string]any{
			"name":   entry.Name(),
			"is_dir": entry.IsDir(),
		}
		if !entry.IsDir() {
			if info, err := entry.Info(); err == nil {
				item["size"] = info.Size()
			}
		}
		files = append(files, item)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"cwd":    base,
		"files":  files,
	})
}

func (s *Service) handleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req runRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}

	tool := strings.TrimSpace(strings.ToLower(req.Tool))
	if tool == "" {
		tool = "codex"
	}
	cli := resolveCLI(tool)
	if cli == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("CLI 도구 '%s' 가 설치되지 않았습니다.", tool)})
		return
	}
	if !checkLoggedIn(tool) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": fmt.Sprintf("'%s' 에 로그인되어 있지 않습니다.", tool)})
		return
	}

	cwd := strings.TrimSpace(req.Cwd)
	if cwd == "" {
		cwd = s.workspace
	}
	if err := os.MkdirAll(cwd, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	finalPrompt := strings.TrimSpace(req.Prompt)
	referenceFiles := make([]string, 0, len(req.ReferenceImages))
	for i, imageData := range req.ReferenceImages {
		if i >= 12 {
			break
		}
		path, err := writeReferenceImageFile(cwd, imageData, i+1)
		if err == nil && path != "" {
			referenceFiles = append(referenceFiles, path)
		}
	}
	if len(referenceFiles) > 0 {
		finalPrompt += "\n\n[참고 이미지 파일]\n"
		for _, path := range referenceFiles {
			finalPrompt += "- " + path + "\n"
		}
		finalPrompt += "위 파일은 로고/상품/무드/색감 reference입니다. 새 로고를 만들지 말고 reference 일관성을 유지하세요.\n"
	}
	designPath := ""
	if strings.TrimSpace(req.DesignHTML) != "" {
		designPath = filepath.Join(cwd, "makeke_design_input.html")
		if err := os.WriteFile(designPath, []byte(req.DesignHTML), 0o644); err == nil {
			mode := strings.TrimSpace(strings.ToLower(req.DesignMode))
			if mode == "" {
				mode = "edit"
			}
			finalPrompt = finalPrompt + "\n\n[작업 파일]\n" +
				"- 현재 HTML 파일 경로: " + designPath + "\n" +
				"- 이 파일을 직접 수정하세요.\n" +
				"- 작업 모드: " + mode + "\n" +
				"- 수정 후 최종 결과는 반드시 이 파일 기준의 완전한 HTML 문서만 stdout으로 출력하세요.\n" +
				"- 설명문, 요약, 코드블록 표시 없이 <!DOCTYPE html>부터 </html>까지 최종 HTML만 출력하세요."
		}
	}
	if strings.TrimSpace(req.SystemPrompt) != "" && strings.TrimSpace(req.SessionID) == "" {
		finalPrompt = "[시스템 지침]\n\n" + strings.TrimSpace(req.SystemPrompt) + "\n\n" +
			"위 지침을 현재 세션 동안 유지한다. 이후 사용자 메시지에 답하기 시작하라.\n\n---\n\n" + finalPrompt
	}

	timeout := req.Timeout
	if timeout <= 0 {
		timeout = 300
	}
	args := buildArgs(tool, cli, strings.TrimSpace(req.SessionID), finalPrompt)
	env := append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if isWindowsShim(cli) {
		cmd = exec.CommandContext(ctx, "cmd", "/c", windowsJoin(args))
	} else {
		cmd = exec.CommandContext(ctx, args[0], args[1:]...)
	}
	cmd.Dir = cwd
	cmd.Env = env
	if tool == "codex" {
		cmd.Stdin = strings.NewReader(finalPrompt)
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		writeJSON(w, http.StatusGatewayTimeout, map[string]string{"error": fmt.Sprintf("CLI 실행 타임아웃 (%ds)", timeout)})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": truncateText(err.Error()+" "+stderr.String(), 400)})
		return
	}

	out, sessionID := stripSessionMarker(tool, stdout.String())
	designHTML := ""
	if designPath != "" {
		if raw, err := os.ReadFile(designPath); err == nil {
			designHTML = string(raw)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "ok",
		"tool":        tool,
		"cli_path":    cli,
		"cwd":         cwd,
		"returncode":  0,
		"stdout":      truncateText(out, 30000),
		"design_html": designHTML,
		"stderr":      truncateText(stderr.String(), 10000),
		"session_id":  sessionID,
	})
}

func writeReferenceImageFile(cwd string, raw string, index int) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", nil
	}
	if strings.HasPrefix(strings.ToLower(value), "data:image/") {
		comma := strings.Index(value, ",")
		if comma < 0 {
			return "", fmt.Errorf("invalid data url")
		}
		header := strings.ToLower(value[:comma])
		ext := ".png"
		switch {
		case strings.Contains(header, "image/jpeg"), strings.Contains(header, "image/jpg"):
			ext = ".jpg"
		case strings.Contains(header, "image/webp"):
			ext = ".webp"
		}
		decoded, err := base64.StdEncoding.DecodeString(value[comma+1:])
		if err != nil {
			return "", err
		}
		dir := filepath.Join(cwd, "reference_images")
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return "", err
		}
		path := filepath.Join(dir, fmt.Sprintf("reference_%02d%s", index, ext))
		if err := os.WriteFile(path, decoded, 0o644); err != nil {
			return "", err
		}
		return path, nil
	}
	if pathExists(value) {
		return value, nil
	}
	return "", nil
}

func resolveDataDir(cfg config.Config) string {
	if strings.TrimSpace(cfg.DataDir) != "" {
		return cfg.DataDir
	}
	return filepath.Join(cfg.ProjectRoot, "data")
}

func sortedTools() []string {
	names := make([]string, 0, len(cliCandidates))
	for name := range cliCandidates {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func resolveCLI(name string) string {
	envOverride := strings.TrimSpace(os.Getenv(fmt.Sprintf("MAKEKE_CLI_%s", strings.ToUpper(name))))
	if envOverride != "" && pathExists(envOverride) {
		return envOverride
	}

	candidates := append([]string{}, cliCandidates[name]...)
	if runtime.GOOS == "windows" {
		expanded := make([]string, 0, len(candidates)*4)
		for _, candidate := range candidates {
			expanded = append(expanded, candidate, candidate+".exe", candidate+".cmd", candidate+".ps1")
		}
		candidates = expanded
	}

	for _, candidate := range candidates {
		if resolved, err := exec.LookPath(candidate); err == nil && strings.TrimSpace(resolved) != "" {
			return resolved
		}
	}

	for _, dir := range extraSearchDirs() {
		for _, candidate := range candidates {
			target := filepath.Join(dir, candidate)
			if pathExists(target) {
				return target
			}
		}
	}

	for _, dir := range nodeVersionBins() {
		for _, candidate := range candidates {
			target := filepath.Join(dir, candidate)
			if pathExists(target) {
				return target
			}
		}
	}

	return ""
}

func extraSearchDirs() []string {
	home, _ := os.UserHomeDir()
	dirs := []string{
		filepath.Join(home, ".local", "bin"),
		filepath.Join(home, "bin"),
		filepath.Join(home, ".cargo", "bin"),
		filepath.Join(home, "go", "bin"),
		"/usr/local/bin",
		"/usr/bin",
		"/opt/homebrew/bin",
		"/home/linuxbrew/.linuxbrew/bin",
		filepath.Join(home, ".bun", "bin"),
		filepath.Join(home, ".deno", "bin"),
		filepath.Join(home, ".fnm", "aliases", "default", "bin"),
		filepath.Join(home, ".volta", "bin"),
		filepath.Join(home, ".asdf", "shims"),
		filepath.Join(home, ".npm-global", "bin"),
		filepath.Join(home, ".local", "share", "claude", "bin"),
		filepath.Join(home, ".local", "share", "uv", "tools", "kimi-cli", "bin"),
		filepath.Join(home, ".local", "share", "pipx", "venvs", "kimi-cli", "bin"),
	}

	if runtime.GOOS == "windows" {
		if appData := os.Getenv("APPDATA"); appData != "" {
			dirs = append(dirs,
				filepath.Join(appData, "npm"),
				filepath.Join(appData, "Python", "Scripts"),
			)
		}
		if localAppData := os.Getenv("LOCALAPPDATA"); localAppData != "" {
			dirs = append(dirs,
				filepath.Join(localAppData, "Programs"),
				filepath.Join(localAppData, "Programs", "claude"),
				filepath.Join(localAppData, "Programs", "claude-code"),
				filepath.Join(localAppData, "AnthropicClaude"),
				filepath.Join(localAppData, "Microsoft", "WinGet", "Links"),
				filepath.Join(localAppData, "kimi-cli"),
			)
		}
		if pf := os.Getenv("ProgramFiles"); pf != "" {
			dirs = append(dirs,
				filepath.Join(pf, "nodejs"),
				filepath.Join(pf, "Anthropic", "Claude Code"),
			)
		}
		if pf86 := os.Getenv("ProgramFiles(x86)"); pf86 != "" {
			dirs = append(dirs, filepath.Join(pf86, "nodejs"))
		}
		if userProfile := os.Getenv("USERPROFILE"); userProfile != "" {
			dirs = append(dirs,
				filepath.Join(userProfile, ".local", "bin"),
				filepath.Join(userProfile, ".local", "share", "claude", "bin"),
			)
		}
	}

	return uniqueStrings(dirs)
}

func nodeVersionBins() []string {
	home, _ := os.UserHomeDir()
	roots := []string{
		filepath.Join(home, ".nvm", "versions", "node"),
		filepath.Join(home, "Library", "Application Support", "fnm", "node-versions"),
		filepath.Join(home, ".local", "share", "fnm", "node-versions"),
	}

	var bins []string
	for _, root := range roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			candidates := []string{
				filepath.Join(root, entry.Name(), "bin"),
				filepath.Join(root, entry.Name(), "installation", "bin"),
			}
			for _, candidate := range candidates {
				if info, err := os.Stat(candidate); err == nil && info.IsDir() {
					bins = append(bins, candidate)
				}
			}
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(bins)))
	return uniqueStrings(bins)
}

func checkLoggedIn(tool string) bool {
	home, _ := os.UserHomeDir()
	switch tool {
	case "kimi":
		return pathExists(filepath.Join(home, ".kimi", "session.json")) ||
			pathExists(filepath.Join(home, ".kimi", "config.toml")) ||
			pathExists(filepath.Join(home, ".kimi-cli"))
	case "claude":
		return pathExists(filepath.Join(home, ".claude", "auth.json")) ||
			pathExists(filepath.Join(home, ".claude", "config.json")) ||
			pathExists(filepath.Join(home, ".claude.json")) ||
			pathExists(filepath.Join(home, ".config", "claude"))
	case "codex":
		return pathExists(filepath.Join(home, ".codex")) ||
			pathExists(filepath.Join(home, ".openai"))
	case "gemini":
		return pathExists(filepath.Join(home, ".gemini")) ||
			pathExists(filepath.Join(home, ".gemini.json")) ||
			strings.TrimSpace(os.Getenv("GEMINI_API_KEY")) != "" ||
			strings.TrimSpace(os.Getenv("GOOGLE_API_KEY")) != ""
	default:
		return false
	}
}

func checkAuthArtifacts(tool string) AuthArtifacts {
	home, _ := os.UserHomeDir()
	candidates := map[string][]string{
		"kimi": {
			filepath.Join(home, ".kimi"),
			filepath.Join(home, ".config", "kimi"),
			filepath.Join(home, ".config", "kimi-cli"),
		},
		"claude": {
			filepath.Join(home, ".claude.json"),
			filepath.Join(home, ".config", "claude"),
			filepath.Join(home, ".claude", "credentials"),
			filepath.Join(home, ".claude", "credentials.json"),
		},
		"codex": {
			filepath.Join(home, ".codex", "auth.json"),
			filepath.Join(home, ".codex"),
			filepath.Join(home, ".config", "codex"),
		},
		"gemini": {
			filepath.Join(home, ".gemini"),
			filepath.Join(home, ".gemini.json"),
			filepath.Join(home, ".config", "gemini"),
			filepath.Join(home, ".config", "gemini-cli"),
		},
	}

	if runtime.GOOS == "windows" {
		appData := os.Getenv("APPDATA")
		localAppData := os.Getenv("LOCALAPPDATA")
		if appData != "" {
			candidates["kimi"] = append(candidates["kimi"], filepath.Join(appData, "kimi"), filepath.Join(appData, "kimi-cli"))
			candidates["claude"] = append(candidates["claude"], filepath.Join(appData, "Claude"), filepath.Join(appData, "claude"), filepath.Join(appData, "anthropic", "claude"))
			candidates["codex"] = append(candidates["codex"], filepath.Join(appData, "codex"), filepath.Join(appData, "OpenAI", "codex"))
			candidates["gemini"] = append(candidates["gemini"], filepath.Join(appData, "gemini"), filepath.Join(appData, "gemini-cli"), filepath.Join(appData, "Google", "GeminiCli"))
		}
		if localAppData != "" {
			candidates["claude"] = append(candidates["claude"], filepath.Join(localAppData, "Claude"), filepath.Join(localAppData, "anthropic"))
			candidates["codex"] = append(candidates["codex"], filepath.Join(localAppData, "codex"), filepath.Join(localAppData, "OpenAI"))
			candidates["gemini"] = append(candidates["gemini"], filepath.Join(localAppData, "gemini"), filepath.Join(localAppData, "gemini-cli"), filepath.Join(localAppData, "Google", "GeminiCli"))
		}
	}

	var found []string
	for _, candidate := range candidates[tool] {
		if pathExists(candidate) {
			found = append(found, candidate)
		}
	}

	return AuthArtifacts{
		LoggedIn:  len(found) > 0,
		Artifacts: found,
	}
}

func loginCommand(tool, cli string) []string {
	switch tool {
	case "codex":
		return []string{cli, "login"}
	case "gemini":
		return []string{cli}
	default:
		return []string{cli}
	}
}

func buildArgs(tool, cli, sessionMarker, prompt string) []string {
	switch tool {
	case "kimi":
		args := []string{cli}
		if sessionMarker != "" {
			args = append(args, "-r", sessionMarker)
		}
		args = append(args, "--quiet", "--yolo", "-p", prompt)
		return args
	case "claude":
		args := []string{cli}
		if sessionMarker != "" {
			args = append(args, "--continue")
		}
		args = append(args, "-p", prompt)
		return args
	case "gemini":
		return []string{cli, "-p", prompt}
	case "codex":
		args := []string{cli, "exec", "--skip-git-repo-check", "--full-auto"}
		if sessionMarker != "" {
			args = append(args, "resume", "--last")
		}
		args = append(args, "-")
		return args
	default:
		return []string{cli, prompt}
	}
}

func stripSessionMarker(tool, text string) (string, string) {
	if strings.TrimSpace(text) == "" {
		return text, ""
	}
	if tool == "kimi" {
		lines := strings.Split(text, "\n")
		kept := make([]string, 0, len(lines))
		session := ""
		for _, line := range lines {
			stripped := strings.TrimLeft(line, " \t")
			if strings.HasPrefix(stripped, "To resume this session: kimi -r ") {
				session = strings.TrimSpace(strings.TrimPrefix(stripped, "To resume this session: kimi -r "))
				continue
			}
			kept = append(kept, line)
		}
		return strings.TrimSpace(strings.Join(kept, "\n")), session
	}
	return strings.TrimSpace(text), "ACTIVE"
}

func isWindowsShim(cliPath string) bool {
	if runtime.GOOS != "windows" {
		return false
	}
	lower := strings.ToLower(cliPath)
	return strings.HasSuffix(lower, ".cmd") || strings.HasSuffix(lower, ".bat") || strings.HasSuffix(lower, ".ps1")
}

func openTerminalWith(cmd []string, cwd string) (map[string]any, error) {
	commandString := shellJoin(cmd)
	fullCommand := fmt.Sprintf("cd %s && %s", shellQuote(cwd), commandString)

	switch runtime.GOOS {
	case "darwin":
		script := fmt.Sprintf(`tell application "Terminal"
  activate
  do script %q
end tell`, fullCommand)
		if err := exec.Command("osascript", "-e", script).Run(); err != nil {
			return nil, fmt.Errorf("Terminal 실행 실패: %w", err)
		}
		return map[string]any{"status": "ok", "opened": "Terminal.app", "command": fullCommand}, nil
	case "windows":
		winCommand := fmt.Sprintf(`cd /d %s && chcp 65001 > NUL && %s`, windowsQuote(cwd), windowsJoin(cmd))
		if wt, err := exec.LookPath("wt.exe"); err == nil {
			if err := exec.Command(wt, "new-tab", "--title", "Makeke CLI", "cmd", "/k", winCommand).Start(); err == nil {
				return map[string]any{"status": "ok", "opened": "Windows Terminal", "command": winCommand}, nil
			}
		}
		if pwsh, err := exec.LookPath("powershell.exe"); err == nil {
			if err := exec.Command(pwsh, "-NoExit", "-Command", winCommand).Start(); err == nil {
				return map[string]any{"status": "ok", "opened": "powershell.exe", "command": winCommand}, nil
			}
		}
		return nil, fmt.Errorf("Windows 터미널 실행 실패")
	default:
		terminals := []string{"x-terminal-emulator", "gnome-terminal", "konsole", "xterm", "kitty", "alacritty", "foot"}
		for _, terminal := range terminals {
			if path, err := exec.LookPath(terminal); err == nil {
				var cmdExec *exec.Cmd
				if terminal == "gnome-terminal" {
					cmdExec = exec.Command(path, "--", "bash", "-lc", fullCommand)
				} else {
					cmdExec = exec.Command(path, "-e", "bash", "-lc", fullCommand)
				}
				if err := cmdExec.Start(); err == nil {
					return map[string]any{"status": "ok", "opened": terminal, "command": fullCommand}, nil
				}
			}
		}
		return nil, fmt.Errorf("터미널 에뮬레이터를 찾지 못했습니다")
	}
}

func pathExists(target string) bool {
	if strings.TrimSpace(target) == "" {
		return false
	}
	_, err := os.Stat(target)
	return err == nil
}

func uniqueStrings(items []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func shellJoin(items []string) string {
	quoted := make([]string, 0, len(items))
	for _, item := range items {
		quoted = append(quoted, shellQuote(item))
	}
	return strings.Join(quoted, " ")
}

func windowsQuote(value string) string {
	if strings.ContainsAny(value, " \t\"") {
		return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
	}
	return value
}

func windowsJoin(items []string) string {
	quoted := make([]string, 0, len(items))
	for _, item := range items {
		quoted = append(quoted, windowsQuote(item))
	}
	return strings.Join(quoted, " ")
}

func truncateText(text string, max int) string {
	if max <= 0 {
		return ""
	}
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return strings.TrimSpace(string(runes[:max])) + "..."
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
