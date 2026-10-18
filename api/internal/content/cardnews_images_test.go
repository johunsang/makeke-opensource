package content

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestFindGeneratedImageIgnoresOldSiblingImages(t *testing.T) {
	dir := t.TempDir()
	outputPath := filepath.Join(dir, "slide_02.png")
	oldSibling := filepath.Join(dir, "slide_01.png")
	if err := os.WriteFile(oldSibling, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	since := time.Now()
	oldTime := since.Add(-5 * time.Minute)
	if err := os.Chtimes(oldSibling, oldTime, oldTime); err != nil {
		t.Fatal(err)
	}

	if got := findGeneratedImage(outputPath, since); got != "" {
		t.Fatalf("expected no generated image, got %q", got)
	}
}

func TestFindGeneratedImageAcceptsNewSiblingImage(t *testing.T) {
	dir := t.TempDir()
	outputPath := filepath.Join(dir, "slide_02.png")
	newSibling := filepath.Join(dir, "generated.png")
	since := time.Now().Add(-1 * time.Second)
	if err := os.WriteFile(newSibling, []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}

	got := findGeneratedImage(outputPath, since)
	if got == "" {
		t.Fatal("expected generated image")
	}
	if _, err := os.Stat(outputPath); err != nil {
		t.Fatalf("expected generated image copied to output path: %v", err)
	}
}

func TestBuildCardnewsImagePromptIncludesBrandVisuals(t *testing.T) {
	prompt := buildCardnewsImagePrompt(cardnewsSlideImageInput{
		Slide: map[string]any{
			"slide_number":  1,
			"title":         "테스트 제목",
			"body":          "테스트 본문",
			"visual_prompt": "테스트 비주얼",
		},
		Topic:          "브랜드 테스트",
		Style:          "modern",
		AspectRatio:    "1:1",
		ImageSize:      "1K",
		SlideIndex:     0,
		SlideCount:     3,
		BrandColor:     "#ff8c00",
		LogoEnabled:    true,
		LogoPath:       "/tmp/logo.png",
		ReferencePaths: []string{"/tmp/ref.png"},
	}, "/tmp/output.png")

	for _, want := range []string{"/tmp/logo.png", "자연스럽게 녹이세요", "/tmp/ref.png"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to include %q\n%s", want, prompt)
		}
	}
	if strings.Contains(prompt, "#ff8c00") {
		t.Fatalf("expected prompt not to expose raw color codes to the image model\n%s", prompt)
	}
	for _, blocked := range []string{"로고 크기 힌트", "로고 투명도 힌트", "로고 위치 설정 힌트"} {
		if strings.Contains(prompt, blocked) {
			t.Fatalf("expected prompt not to include forced logo placement hint %q\n%s", blocked, prompt)
		}
	}
}

func TestBuildCardnewsImagePromptBuildsCompleteCardImage(t *testing.T) {
	prompt := buildCardnewsImagePrompt(cardnewsSlideImageInput{
		Slide: map[string]any{
			"slide_number":  1,
			"title":         "뉴스에서 70% 증가",
			"body":          "참고 자료에 70%, 2026년 같은 수치가 있습니다.",
			"visual_prompt": "70%를 크게 보여주는 카드",
		},
		Topic:       "뉴스 카드뉴스",
		Style:       "modern",
		AspectRatio: "1:1",
		ImageSize:   "1K",
		SlideIndex:  0,
		SlideCount:  3,
	}, "/tmp/output.png")

	for _, want := range []string{"카드뉴스 이미지 한 장", "제목과 본문", "한국어 카드뉴스 타이포그래피"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to include complete-card instruction %q\n%s", want, prompt)
		}
	}
	for _, blocked := range []string{"이미지 안에는 읽을 수 있는 글자", "이미지 속 텍스트로 쓰지 말고", "비주얼 프롬프트가 글자/숫자/퍼센트 표시를 요구하더라도", "70% 배지"} {
		if strings.Contains(prompt, blocked) {
			t.Fatalf("expected prompt to remove old no-text guard %q\n%s", blocked, prompt)
		}
	}
}

func TestBuildCardnewsImagePromptAppendsCompleteCardGuardToTemplate(t *testing.T) {
	prompt := buildCardnewsImagePrompt(cardnewsSlideImageInput{
		Slide: map[string]any{
			"slide_number":  1,
			"title":         "뉴스에서 70% 증가",
			"body":          "본문",
			"visual_prompt": "70% 배지",
		},
		Topic:          "뉴스 카드뉴스",
		SlideIndex:     0,
		SlideCount:     1,
		PromptTemplate: "사용자 템플릿 {visual_prompt}",
	}, "/tmp/output.png")

	for _, want := range []string{"카드뉴스 이미지 한 장", "제목과 본문"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected templated prompt to include %q\n%s", want, prompt)
		}
	}
	if strings.Contains(prompt, "사용자 템플릿 70% 배지") {
		t.Fatalf("expected image prompt to avoid raw custom template text that can become visible design debris\n%s", prompt)
	}
}

func TestBuildCardnewsImagePromptAppliesDetailPageDesignRules(t *testing.T) {
	prompt := buildCardnewsImagePrompt(cardnewsSlideImageInput{
		Slide: map[string]any{
			"slide_number": 1,
			"title":        "방문 전 준비사항",
			"body":         "처음 상담 전에 확인할 핵심 기준을 정리합니다.",
		},
		Topic:              "임플란트 상세페이지",
		AspectRatio:        "9:16",
		SlideIndex:         0,
		SlideCount:         3,
		DesignRules:        "## 1. 간단 컨셉\n- 신뢰감 있는 의료형 상세페이지\n- 메인 색상 #FF8C00과 텍스트 #1E1E1E를 사용",
		CustomInstructions: "상세페이지 유형: 병원/헬스케어\n한국어 텍스트를 사용하고 영어 라벨을 남발하지 마세요.",
		Source:             "detailpage",
	}, "/tmp/output.png")

	for _, want := range []string{"모바일 상세페이지 섹션 이미지", "프로필 디자인 규칙 - 반드시 반영", "신뢰감 있는 의료형 상세페이지", "상세페이지 제작 지시 - 반드시 반영", "병원/헬스케어"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected detailpage prompt to include %q\n%s", want, prompt)
		}
	}
	if strings.Contains(prompt, "#FF8C00") || strings.Contains(prompt, "#1E1E1E") {
		t.Fatalf("expected detailpage prompt to avoid raw HEX codes as drawable text\n%s", prompt)
	}
}

func TestBuildCardnewsGenerationPromptTellsVisualPromptToBuildCompleteCard(t *testing.T) {
	var service Service
	prompt := service.buildCardnewsGenerationPrompt(keywordContentRequest{
		Keyword:        "뉴스 카드뉴스",
		CardnewsSlides: 3,
	}, "뉴스 본문에 70% 증가라는 수치가 있습니다.")

	for _, want := range []string{"visual_prompt는 완성 카드뉴스 이미지", "title/body 문구를 이미지 안에", "수치, 체크포인트, CTA"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected generation prompt to include %q\n%s", want, prompt)
		}
	}
	for _, blocked := range []string{"visual_prompt에는 이미지 안에 글자", "수치와 문구는 title/body에만"} {
		if strings.Contains(prompt, blocked) {
			t.Fatalf("expected generation prompt to remove old no-text rule %q\n%s", blocked, prompt)
		}
	}
}

func TestContentPromptVariablesKeepVisualFieldsOutOfEditableBrandInfo(t *testing.T) {
	var service Service
	values := service.contentPromptVariables(keywordContentRequest{
		Keyword:          "테스트 주제",
		BrandName:        "테스트 브랜드",
		BrandDescription: "테스트 설명",
		BrandColor:       "#ff8c00",
		BrandLogoURL:     "/api/library/image/1/logo.png",
	}, nil, "테스트 참고자료")

	brandInfo := values["brand_info"]
	for _, blocked := range []string{"#ff8c00", "/api/library/image/1/logo.png"} {
		if strings.Contains(brandInfo, blocked) {
			t.Fatalf("editable brand_info should not include visual-only value %q\n%s", blocked, brandInfo)
		}
	}
}
