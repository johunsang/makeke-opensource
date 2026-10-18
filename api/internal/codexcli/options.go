package codexcli

import (
	"context"
	"os/exec"
	"strings"
	"sync"
	"time"
)

var execOptionSupport sync.Map

// ExecArgs returns Codex exec arguments that are compatible with the installed CLI.
func ExecArgs(cliPath string, extra ...string) []string {
	args := []string{"exec"}
	if SupportsExecOption(cliPath, "--ignore-user-config") {
		args = append(args, "--ignore-user-config")
	}
	args = append(args, "--skip-git-repo-check", "--full-auto")
	args = append(args, extra...)
	return args
}

func SupportsExecOption(cliPath, option string) bool {
	key := cliPath + "\x00" + option
	if cached, ok := execOptionSupport.Load(key); ok {
		return cached.(bool)
	}
	supported := execHelpContainsOption(cliPath, option)
	execOptionSupport.Store(key, supported)
	return supported
}

func execHelpContainsOption(cliPath, option string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, cliPath, "exec", "--help").CombinedOutput()
	if err != nil && len(output) == 0 {
		return false
	}
	return strings.Contains(string(output), option)
}
