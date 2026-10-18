package appcore

import (
	"encoding/json"
	"errors"
	"fmt"
	"makeke/localhttp"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gobwas/ws"
	"github.com/gobwas/ws/wsutil"
)

type browserBridge struct {
	service *Service
	mu      sync.Mutex
	conn    net.Conn
	writeMu sync.Mutex
	nextID  int64
	pending map[string]chan bridgeMessage
	running bool
	err     string
}

type bridgeMessage map[string]any

func newBrowserBridge(service *Service) *browserBridge {
	return &browserBridge{
		service: service,
		pending: map[string]chan bridgeMessage{},
	}
}

func (b *browserBridge) start() {
	b.mu.Lock()
	if b.running {
		b.mu.Unlock()
		return
	}
	b.running = true
	b.mu.Unlock()
	go b.listen()
}

func (b *browserBridge) listen() {
	server := &http.Server{Addr: "127.0.0.1:9878", Handler: http.HandlerFunc(b.handle)}
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		b.mu.Lock()
		b.err = err.Error()
		b.running = false
		b.mu.Unlock()
		b.service.appendBrowserLog("Chrome 브릿지 시작 실패: " + err.Error())
	}
}

func (b *browserBridge) handle(w http.ResponseWriter, r *http.Request) {
	if !localhttp.AllowedRequest(r) {
		http.Error(w, "local requests only", http.StatusForbidden)
		return
	}
	conn, _, _, err := ws.UpgradeHTTP(r, w)
	if err != nil {
		return
	}
	b.setConn(conn)
	defer b.clearConn(conn)
	for {
		raw, err := wsutil.ReadClientText(conn)
		if err != nil {
			return
		}
		b.handleMessage(conn, raw)
	}
}

func (b *browserBridge) setConn(conn net.Conn) {
	b.mu.Lock()
	if b.conn != nil && b.conn != conn {
		_ = b.conn.Close()
	}
	b.conn = conn
	b.err = ""
	b.mu.Unlock()
	b.service.browserMu.Lock()
	b.service.browser.Connected = true
	b.service.browser.Port = 9878
	b.service.browser.CurrentProfile = "Default"
	b.service.browser.ExtensionPath = b.service.managedChromeExtensionDir()
	b.service.browserMu.Unlock()
	b.service.appendBrowserLog("Chrome 확장 브릿지 연결됨")
}

func (b *browserBridge) clearConn(conn net.Conn) {
	b.mu.Lock()
	if b.conn == conn {
		b.conn = nil
	}
	for id, ch := range b.pending {
		delete(b.pending, id)
		close(ch)
	}
	b.mu.Unlock()
	b.service.browserMu.Lock()
	b.service.browser.Connected = false
	b.service.browserMu.Unlock()
	b.service.appendBrowserLog("Chrome 확장 브릿지 연결 해제")
	_ = conn.Close()
}

func (b *browserBridge) handleMessage(conn net.Conn, raw []byte) {
	var msg bridgeMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}
	msgType := stringify(msg["type"])
	if msgType == "ping" {
		_ = b.write(conn, bridgeMessage{"type": "pong"})
		return
	}
	if msgType == "identify" {
		b.service.browserMu.Lock()
		b.service.browser.Connected = true
		b.service.browser.Port = 9878
		b.service.browser.CurrentProfile = "Default"
		b.service.browser.ExtensionPath = b.service.managedChromeExtensionDir()
		b.service.browserMu.Unlock()
		return
	}
	id := stringify(msg["id"])
	if id == "" {
		return
	}
	b.mu.Lock()
	ch := b.pending[id]
	if ch != nil {
		delete(b.pending, id)
	}
	b.mu.Unlock()
	if ch != nil {
		ch <- msg
		close(ch)
	}
}

func (b *browserBridge) write(conn net.Conn, payload bridgeMessage) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	b.writeMu.Lock()
	defer b.writeMu.Unlock()
	return wsutil.WriteServerText(conn, raw)
}

func (b *browserBridge) connected() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.conn != nil
}

func (b *browserBridge) status() map[string]any {
	b.mu.Lock()
	defer b.mu.Unlock()
	return map[string]any{
		"ws_port":           9878,
		"ws_server_running": b.running,
		"connected":         b.conn != nil,
		"bridge_ready":      b.conn != nil,
		"error":             b.err,
	}
}

func (b *browserBridge) command(command string, params map[string]any, timeout time.Duration) (bridgeMessage, error) {
	b.mu.Lock()
	if b.conn == nil {
		b.mu.Unlock()
		return nil, errors.New("Chrome 확장 브릿지가 연결되지 않았습니다")
	}
	b.nextID++
	id := fmt.Sprintf("cmd-%d", b.nextID)
	ch := make(chan bridgeMessage, 1)
	b.pending[id] = ch
	conn := b.conn
	b.mu.Unlock()
	if timeout <= 0 {
		timeout = 20 * time.Second
	}
	if err := b.write(conn, bridgeMessage{"id": id, "command": command, "params": params}); err != nil {
		b.mu.Lock()
		delete(b.pending, id)
		b.mu.Unlock()
		return nil, err
	}
	select {
	case resp, ok := <-ch:
		if !ok {
			return nil, errors.New("Chrome 확장 브릿지 응답이 닫혔습니다")
		}
		if errText := stringify(resp["error"]); errText != "" {
			return resp, errors.New(errText)
		}
		return resp, nil
	case <-time.After(timeout):
		b.mu.Lock()
		delete(b.pending, id)
		b.mu.Unlock()
		return nil, errors.New("Chrome 확장 브릿지 응답 시간이 초과되었습니다")
	}
}
