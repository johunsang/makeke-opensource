package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const (
	openAICompatibleProxyMaxRequestBytes  = 2 << 20
	openAICompatibleProxyMaxResponseBytes = 16 << 20
	openAICompatibleProxyTimeout          = 90 * time.Second
)

var openAICompatibleVersionPathPattern = regexp.MustCompile(`/v\d+(/|$)`)

func (s *Server) handleOpenAICompatibleChatCompletions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var body map[string]any
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, openAICompatibleProxyMaxRequestBytes))
	if err := decoder.Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid json body is required"})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "body must contain a single json object"})
		return
	}

	baseURL := firstStringValue(body, "base_url", "baseUrl")
	apiKey := firstStringValue(body, "api_key", "apiKey")
	model := firstStringValue(body, "model")
	messages, ok := body["messages"].([]any)
	if baseURL == "" || apiKey == "" || model == "" || !ok || len(messages) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "base_url, api_key, model, and messages are required"})
		return
	}
	if stream, ok := body["stream"].(bool); ok && stream {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "streaming is not supported by this endpoint yet"})
		return
	}

	endpoint, err := openAICompatibleChatEndpoint(baseURL)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	payload := cloneOpenAICompatiblePayload(body)
	payload["model"] = model
	payload["messages"] = messagesWithSystemPrompt(firstStringValue(body, "system_prompt", "systemPrompt"), messages)
	payload["stream"] = false
	delete(payload, "base_url")
	delete(payload, "baseUrl")
	delete(payload, "api_key")
	delete(payload, "apiKey")
	delete(payload, "system_prompt")
	delete(payload, "systemPrompt")

	encoded, err := json.Marshal(payload)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), openAICompatibleProxyTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Makeke/openai-compatible-proxy")

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if _, err := validateOpenAICompatibleBaseURL(req.URL.String()); err != nil {
				return err
			}
			return nil
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, openAICompatibleProxyMaxResponseBytes+1))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	if len(raw) > openAICompatibleProxyMaxResponseBytes {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "upstream response is too large"})
		return
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "application/json; charset=utf-8"
	}
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(raw)
}

func firstStringValue(body map[string]any, keys ...string) string {
	for _, key := range keys {
		value, ok := body[key].(string)
		if ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func cloneOpenAICompatiblePayload(body map[string]any) map[string]any {
	payload := make(map[string]any, len(body))
	for key, value := range body {
		payload[key] = value
	}
	return payload
}

func messagesWithSystemPrompt(systemPrompt string, messages []any) []any {
	if strings.TrimSpace(systemPrompt) == "" {
		return messages
	}
	out := make([]any, 0, len(messages)+1)
	out = append(out, map[string]any{
		"role":    "system",
		"content": strings.TrimSpace(systemPrompt),
	})
	out = append(out, messages...)
	return out
}

func openAICompatibleChatEndpoint(rawBaseURL string) (string, error) {
	parsed, err := validateOpenAICompatibleBaseURL(rawBaseURL)
	if err != nil {
		return "", err
	}
	trimmedPath := strings.TrimRight(parsed.Path, "/")
	switch {
	case strings.HasSuffix(trimmedPath, "/chat/completions"):
		parsed.Path = trimmedPath
	case openAICompatibleVersionPathPattern.MatchString(trimmedPath):
		parsed.Path = trimmedPath + "/chat/completions"
	default:
		parsed.Path = trimmedPath + "/v1/chat/completions"
	}
	return parsed.String(), nil
}

func validateOpenAICompatibleBaseURL(rawBaseURL string) (*url.URL, error) {
	rawBaseURL = strings.TrimSpace(rawBaseURL)
	if rawBaseURL == "" {
		return nil, fmt.Errorf("base_url is required")
	}
	parsed, err := url.Parse(rawBaseURL)
	if err != nil || parsed == nil || parsed.Host == "" {
		return nil, fmt.Errorf("base_url must be an absolute url")
	}
	if parsed.User != nil {
		return nil, fmt.Errorf("base_url must not include user info")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, fmt.Errorf("base_url must not include query or fragment")
	}
	hostname := strings.ToLower(parsed.Hostname())
	switch parsed.Scheme {
	case "https":
		if isBlockedPrivateAPIHost(hostname) {
			return nil, fmt.Errorf("private network hosts are not allowed except localhost")
		}
	case "http":
		if !isAllowedLocalAPIHost(hostname) {
			return nil, fmt.Errorf("http base_url is allowed only for localhost development providers")
		}
	default:
		return nil, fmt.Errorf("base_url scheme must be https, or http for localhost")
	}
	return parsed, nil
}

func isAllowedLocalAPIHost(hostname string) bool {
	if hostname == "localhost" {
		return true
	}
	ip := net.ParseIP(hostname)
	return ip != nil && ip.IsLoopback()
}

func isBlockedPrivateAPIHost(hostname string) bool {
	if isAllowedLocalAPIHost(hostname) {
		return false
	}
	ip := net.ParseIP(hostname)
	if ip == nil {
		return false
	}
	return ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}
