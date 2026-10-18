package localhttp

import (
	"net"
	"net/http"
	"net/url"
	"strings"
)

func allowedLocalHost(authority string) bool {
	host := authority
	if parsed, _, err := net.SplitHostPort(authority); err == nil {
		host = parsed
	}
	host = strings.Trim(host, "[]")
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

func allowedLocalOrigin(origin string) bool {
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" {
		return false
	}
	if u.Scheme == "http" || u.Scheme == "https" {
		return allowedLocalHost(u.Host)
	}
	if u.Scheme != "chrome-extension" || len(u.Host) != 32 {
		return false
	}
	for _, ch := range u.Host {
		if ch < 'a' || ch > 'p' {
			return false
		}
	}
	return true
}

// AllowedRequest rejects remote Host/Origin values before local state is accessed.
func AllowedRequest(r *http.Request) bool {
	return allowedLocalHost(r.Host) && allowedLocalOrigin(r.Header.Get("Origin"))
}

// CORS protects local app APIs while retaining native and Chrome extension access.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !AllowedRequest(r) {
			http.Error(w, "local requests only", http.StatusForbidden)
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-SB-Source, X-API-Key, X-User-Email")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
