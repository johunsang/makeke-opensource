package codingagent

import (
	"strings"
	"testing"
)

func TestBuildArgsCodexUsesStdinPrompt(t *testing.T) {
	prompt := "윈도우 카드뉴스 구조적 프롬프트"
	args := buildArgs("codex", "codex", "", prompt)

	if got := args[len(args)-1]; got != "-" {
		t.Fatalf("expected codex prompt to be read from stdin marker '-', got args=%#v", args)
	}
	for _, arg := range args {
		if strings.Contains(arg, prompt) {
			t.Fatalf("prompt must not be passed as argv on Windows shims: %#v", args)
		}
	}
}

func TestBuildArgsGeminiUsesPromptFlag(t *testing.T) {
	args := buildArgs("gemini", "gemini", "", "테스트 프롬프트")

	want := []string{"gemini", "-p", "테스트 프롬프트"}
	if len(args) != len(want) {
		t.Fatalf("expected args=%#v, got %#v", want, args)
	}
	for i := range want {
		if args[i] != want[i] {
			t.Fatalf("expected args=%#v, got %#v", want, args)
		}
	}
}
