package appcore

import (
	"strings"
	"testing"
)

func TestBuildBrandDesignConsultPromptKeepsConsultSimple(t *testing.T) {
	prompt := buildBrandDesignConsultPrompt(map[string]any{
		"name":          "마케케",
		"business_type": "마케팅 자동화",
		"brand_colors":  "#FF8C00, #2B3A4A, #F4F6F8, #1E1E1E, #3B82F6",
	})

	for _, want := range []string{"짧고 단순한", "12줄 안팎", "350~700자", "## 1. 간단 컨셉"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected simple consulting prompt to include %q\n%s", want, prompt)
		}
	}
	for _, blocked := range []string{"최소 35개 bullet", "카드뉴스 섹션은 1장 표지", "HyperFrames 섹션은 배경 이미지"} {
		if strings.Contains(prompt, blocked) {
			t.Fatalf("expected simple consulting prompt to remove detailed requirement %q\n%s", blocked, prompt)
		}
	}
}

func TestDefaultBrandDesignMarkdownIsShortPaletteAndConcept(t *testing.T) {
	markdown := defaultBrandDesignMarkdown(map[string]any{
		"name":          "마케케",
		"business_type": "마케팅 자동화",
		"description":   "콘텐츠 제작 시간을 줄이는 서비스",
	}, []string{"#FF8C00", "#2B3A4A", "#F4F6F8", "#1E1E1E", "#3B82F6"})

	for _, want := range []string{"## 1. 간단 컨셉", "## 2. 대표 색상 팔레트", "## 3. 기본 생성 규칙", "## 4. 금지 규칙"} {
		if !strings.Contains(markdown, want) {
			t.Fatalf("expected default markdown to include %q\n%s", want, markdown)
		}
	}
	for _, blocked := range []string{"## 4. 카드뉴스 규칙", "## 7. HyperFrames 영상 규칙", "Before & After", "마지막 CTA 장면"} {
		if strings.Contains(markdown, blocked) {
			t.Fatalf("expected default markdown to stay simple without %q\n%s", blocked, markdown)
		}
	}
	if bullets := strings.Count(markdown, "\n- "); bullets > 12 {
		t.Fatalf("expected compact markdown, got %d bullets\n%s", bullets, markdown)
	}
}
