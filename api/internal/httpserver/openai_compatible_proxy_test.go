package httpserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"makeke/api/internal/config"
)

func TestOpenAICompatibleChatEndpointNormalizesBaseURL(t *testing.T) {
	tests := []struct {
		name string
		base string
		want string
	}{
		{
			name: "versioned root",
			base: "https://api.openai.com/v1",
			want: "https://api.openai.com/v1/chat/completions",
		},
		{
			name: "versioned sub path",
			base: "https://openrouter.ai/api/v1",
			want: "https://openrouter.ai/api/v1/chat/completions",
		},
		{
			name: "bare host",
			base: "https://gateway.example.com",
			want: "https://gateway.example.com/v1/chat/completions",
		},
		{
			name: "full endpoint",
			base: "https://gateway.example.com/openai/deployments/main/chat/completions",
			want: "https://gateway.example.com/openai/deployments/main/chat/completions",
		},
		{
			name: "local development provider",
			base: "http://127.0.0.1:11434/v1",
			want: "http://127.0.0.1:11434/v1/chat/completions",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := openAICompatibleChatEndpoint(tt.base)
			if err != nil {
				t.Fatalf("openAICompatibleChatEndpoint() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("openAICompatibleChatEndpoint() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestOpenAICompatibleChatEndpointRejectsUnsafeBaseURL(t *testing.T) {
	tests := []string{
		"",
		"ftp://api.example.com/v1",
		"http://api.example.com/v1",
		"https://user:pass@example.com/v1",
		"https://api.example.com/v1?token=secret",
		"https://10.0.0.2/v1",
		"https://169.254.1.1/v1",
	}
	for _, base := range tests {
		t.Run(base, func(t *testing.T) {
			if got, err := openAICompatibleChatEndpoint(base); err == nil {
				t.Fatalf("openAICompatibleChatEndpoint(%q) = %q, want error", base, got)
			}
		})
	}
}

func TestHandleOpenAICompatibleChatCompletionsForwardsRequest(t *testing.T) {
	var upstreamPath string
	var upstreamAuth string
	var upstreamPayload map[string]any
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamPath = r.URL.Path
		upstreamAuth = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&upstreamPayload); err != nil {
			t.Fatalf("decode upstream body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chatcmpl-test","choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer upstream.Close()

	server := &Server{config: config.Config{}}
	reqBody := `{
		"base_url": "` + upstream.URL + `/v1",
		"api_key": "sk-test",
		"model": "gpt-test",
		"system_prompt": "Be concise.",
		"messages": [{"role":"user","content":"hello"}],
		"temperature": 0.2
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/openai-compatible/chat/completions", strings.NewReader(reqBody))
	rec := httptest.NewRecorder()

	server.handleOpenAICompatibleChatCompletions(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if upstreamPath != "/v1/chat/completions" {
		t.Fatalf("upstream path = %q", upstreamPath)
	}
	if upstreamAuth != "Bearer sk-test" {
		t.Fatalf("authorization header = %q", upstreamAuth)
	}
	if _, ok := upstreamPayload["api_key"]; ok {
		t.Fatalf("api_key leaked into upstream payload: %#v", upstreamPayload)
	}
	if upstreamPayload["base_url"] != nil {
		t.Fatalf("base_url leaked into upstream payload: %#v", upstreamPayload)
	}
	if upstreamPayload["stream"] != false {
		t.Fatalf("stream = %#v, want false", upstreamPayload["stream"])
	}
	messages, ok := upstreamPayload["messages"].([]any)
	if !ok || len(messages) != 2 {
		t.Fatalf("messages = %#v, want system + user messages", upstreamPayload["messages"])
	}
	first, ok := messages[0].(map[string]any)
	if !ok || first["role"] != "system" || first["content"] != "Be concise." {
		t.Fatalf("first message = %#v", messages[0])
	}
	if !strings.Contains(rec.Body.String(), `"chatcmpl-test"`) {
		t.Fatalf("response body = %s", rec.Body.String())
	}
}

func TestHandleOpenAICompatibleChatCompletionsRejectsStreaming(t *testing.T) {
	server := &Server{config: config.Config{}}
	reqBody := `{
		"base_url": "https://api.example.com/v1",
		"api_key": "sk-test",
		"model": "gpt-test",
		"messages": [{"role":"user","content":"hello"}],
		"stream": true
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/openai-compatible/chat/completions", strings.NewReader(reqBody))
	rec := httptest.NewRecorder()

	server.handleOpenAICompatibleChatCompletions(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestHandleOpenAICompatibleChatCompletionsRejectsUnsafeRedirect(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://10.0.0.2/v1/chat/completions", http.StatusFound)
	}))
	defer upstream.Close()

	server := &Server{config: config.Config{}}
	reqBody := `{
		"base_url": "` + upstream.URL + `/v1",
		"api_key": "sk-test",
		"model": "gpt-test",
		"messages": [{"role":"user","content":"hello"}]
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/openai-compatible/chat/completions", strings.NewReader(reqBody))
	rec := httptest.NewRecorder()

	server.handleOpenAICompatibleChatCompletions(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}
