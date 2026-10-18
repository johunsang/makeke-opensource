package codexcli

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestExecArgsIncludesIgnoreUserConfigWhenSupported(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script 기반 테스트는 Windows에서 건너뜁니다")
	}
	cliPath := fakeCodexCLI(t, "      --ignore-user-config\n      --skip-git-repo-check\n")
	args := ExecArgs(cliPath, "-")

	if !containsArg(args, "--ignore-user-config") {
		t.Fatalf("expected --ignore-user-config in args: %#v", args)
	}
	if args[len(args)-1] != "-" {
		t.Fatalf("expected extra arg to be preserved at end: %#v", args)
	}
}

func TestExecArgsSkipsIgnoreUserConfigWhenUnsupported(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script 기반 테스트는 Windows에서 건너뜁니다")
	}
	cliPath := fakeCodexCLI(t, "      --skip-git-repo-check\n")
	args := ExecArgs(cliPath, "hello")

	if containsArg(args, "--ignore-user-config") {
		t.Fatalf("did not expect --ignore-user-config in args: %#v", args)
	}
	if args[len(args)-1] != "hello" {
		t.Fatalf("expected prompt arg to be preserved at end: %#v", args)
	}
}

func fakeCodexCLI(t *testing.T, helpOutput string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "codex")
	script := "#!/bin/sh\nif [ \"$1\" = \"exec\" ] && [ \"$2\" = \"--help\" ]; then\n  cat <<'EOF'\n" + helpOutput + "EOF\n  exit 0\nfi\nexit 0\n"
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func containsArg(args []string, want string) bool {
	for _, arg := range args {
		if arg == want {
			return true
		}
	}
	return false
}
