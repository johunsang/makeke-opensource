package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLocalAPIRejectsRemoteAndLookalikeOrigins(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusAccepted) })
	cases := []struct {
		host, origin string
		want         int
	}{
		{"127.0.0.1:8818", "", 202},
		{"localhost:8818", "http://127.0.0.1:8818", 202},
		{"[::1]:8818", "https://localhost:17818", 202},
		{"127.0.0.1:8818", "chrome-extension://abcdefghijklmnopabcdefghijklmnop", 202},
		{"attacker.example:8818", "", 403},
		{"localhost.evil:8818", "", 403},
		{"127.0.0.1:8818", "http://[::1]:8818", 202},
		{"127.0.0.1:8818", "chrome-extension://invalid-extension", 403},
		{"127.0.0.1:8818", "http://localhost:8818/path", 403},
		{"127.0.0.1:8818", "http://localhost.evil.example", 403},
		{"127.0.0.1:8818", "http://127.0.0.1.evil.example", 403},
		{"127.0.0.1:8818", "null", 403},
		{"127.0.0.1:8818", "https://makeke.kr", 403},
		{"127.0.0.1:8818", "http://user@localhost:8818", 403},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodPost, "http://"+tc.host+"/api/config/update", nil)
		req.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		withCORS(next).ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Errorf("host=%q origin=%q got=%d want=%d", tc.host, tc.origin, w.Code, tc.want)
		}
		if w.Header().Get("Access-Control-Allow-Origin") == "*" {
			t.Fatal("wildcard CORS is unsafe for a local API")
		}
	}
}
