package blog

import (
	"path/filepath"
	"strings"
	"testing"

	"makeke/api/internal/config"
)

func TestGenerateBlogImagesReturnsErrorWhenAllImagesFail(t *testing.T) {
	dataDir := t.TempDir()
	t.Setenv("MAKEKE_DB_PATH", filepath.Join(dataDir, "naver_blog.db"))

	service := New(config.Config{DataDir: dataDir})
	_, err := service.GenerateImagesForContent(
		"블로그 이미지 생성 실패 처리를 확인하기 위한 본문입니다. 이미지 API 키가 없으면 성공처럼 처리하면 안 됩니다.",
		1,
		"이미지 실패 처리 테스트",
		"마케케",
		0,
		nil,
		nil,
		"",
		"",
		"",
		"",
		"gemini",
		"gemini-3.1-flash-image-preview",
	)
	if err == nil {
		t.Fatal("expected all image failures to return an error")
	}
	if !strings.Contains(err.Error(), "블로그 이미지 생성에 실패했습니다") {
		t.Fatalf("expected blog image failure message, got %q", err.Error())
	}
	if !strings.Contains(err.Error(), "Gemini 이미지 생성 API 키") {
		t.Fatalf("expected underlying Gemini key error, got %q", err.Error())
	}
}

func TestBuildSingleBlogImagePromptBlocksEnglishLabels(t *testing.T) {
	service := New(config.Config{DataDir: t.TempDir()})
	prompt := service.buildSingleBlogImagePrompt(blogImageSingleRequest{
		Keyword:       "마케팅 자동화 blog",
		BrandName:     "Makeke",
		ImageIndex:    0,
		ImageCount:    1,
		Title:         "AI Marketing Dashboard",
		Body:          "BLOG, SNS, Data Collection, Publishing labels should not appear.",
		VisualPrompt:  "dashboard with BLOG SNS Data Collection labels",
		SourceContext: "blog.naver.com example with Marketing Publishing labels",
		DesignRules:   "use dashboard UI labels and English chart text",
		ProjectDir:    t.TempDir(),
	})
	for _, blocked := range []string{"BLOG", "SNS", "Data Collection", "Publishing", "Marketing Dashboard", "blog.naver.com"} {
		if strings.Contains(prompt, blocked) {
			t.Fatalf("expected prompt to remove visible English label %q\n%s", blocked, prompt)
		}
	}
	for _, required := range []string{"이미지 안에 읽을 수 있는 문자 자체를 만들지 마세요", "영문 라벨, 영문 약어, 영문 서비스명"} {
		if !strings.Contains(prompt, required) {
			t.Fatalf("expected hard no-text rule %q\n%s", required, prompt)
		}
	}
}
