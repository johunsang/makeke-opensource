package codexlog

import (
	"strings"
	"sync"
	"time"
)

var (
	mu         sync.Mutex
	logs       []string
	generation uint64
)

func Reset(label string) uint64 {
	mu.Lock()
	defer mu.Unlock()
	generation++
	logs = []string{format("START " + label)}
	return generation
}

func Append(line string) {
	cleaned := strings.TrimSpace(line)
	if cleaned == "" {
		return
	}
	mu.Lock()
	defer mu.Unlock()
	for _, part := range strings.Split(cleaned, "\n") {
		text := strings.TrimSpace(part)
		if text == "" {
			continue
		}
		logs = append(logs, format(text))
	}
	if len(logs) > 240 {
		logs = logs[len(logs)-240:]
	}
}

func AppendFor(runID uint64, line string) {
	cleaned := strings.TrimSpace(line)
	if cleaned == "" {
		return
	}
	mu.Lock()
	defer mu.Unlock()
	if runID != 0 && runID != generation {
		return
	}
	for _, part := range strings.Split(cleaned, "\n") {
		text := strings.TrimSpace(part)
		if text == "" {
			continue
		}
		logs = append(logs, format(text))
	}
	if len(logs) > 240 {
		logs = logs[len(logs)-240:]
	}
}

func Snapshot() []string {
	mu.Lock()
	defer mu.Unlock()
	copied := make([]string, len(logs))
	copy(copied, logs)
	return copied
}

func format(line string) string {
	return time.Now().Format("15:04:05") + " " + line
}
