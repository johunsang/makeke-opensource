package httpserver

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestConcatVideosWithFFmpeg(t *testing.T) {
	ffmpegPath, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg is not installed")
	}
	dir := t.TempDir()
	first := filepath.Join(dir, "first.mp4")
	second := filepath.Join(dir, "second.mp4")
	output := filepath.Join(dir, "final.mp4")
	for _, item := range []struct {
		path  string
		color string
	}{
		{path: first, color: "red"},
		{path: second, color: "blue"},
	} {
		cmd := exec.Command(
			ffmpegPath,
			"-y",
			"-f", "lavfi",
			"-i", "color=c="+item.color+":s=320x180:d=0.25",
			"-pix_fmt", "yuv420p",
			"-an",
			item.path,
		)
		if raw, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("failed to create fixture video: %v / %s", err, string(raw))
		}
	}
	if err := concatVideosWithFFmpeg([]string{first, second}, output); err != nil {
		t.Fatalf("concatVideosWithFFmpeg failed: %v", err)
	}
	info, err := os.Stat(output)
	if err != nil {
		t.Fatalf("final video missing: %v", err)
	}
	if info.Size() == 0 {
		t.Fatal("final video is empty")
	}
}
