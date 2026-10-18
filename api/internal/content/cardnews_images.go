package content

import (
	"bufio"
	"bytes"
	"crypto/sha1"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"makeke/api/internal/atlas"
	"makeke/api/internal/codexcli"
)

type cardnewsSlideImageInput struct {
	Slide              map[string]any
	Topic              string
	Style              string
	AspectRatio        string
	ImageSize          string
	ProjectDir         string
	SlideIndex         int
	SlideCount         int
	PrevImagePath      string
	BrandName          string
	BrandColor         string
	BrandColors        string
	DesignRules        string
	LogoEnabled        bool
	LogoPath           string
	ReferencePaths     []string
	ImageProvider      string
	ImageModel         string
	ImageAPIKey        string
	PromptTemplate     string
	CustomInstructions string
	Source             string
}

type cardnewsSingleSlideRequest struct {
	Slide              map[string]any `json:"slide"`
	Topic              string         `json:"topic"`
	Style              string         `json:"style"`
	AspectRatio        string         `json:"aspect_ratio"`
	ProjectDir         string         `json:"project_dir"`
	CardnewsID         int64          `json:"cardnews_id"`
	BrandName          string         `json:"brand_name"`
	BrandColor         string         `json:"brand_color"`
	BrandLogoURL       string         `json:"brand_logo_url"`
	LogoEnabled        bool           `json:"logo_enabled"`
	LogoText           string         `json:"logo_text"`
	UserImageURL       string         `json:"user_image_url"`
	UserImageURLs      []string       `json:"user_image_urls"`
	PrevImageURL       string         `json:"prev_image_url"`
	DesignRefURL       string         `json:"design_ref_url"`
	SlideCount         int            `json:"slide_count"`
	ImageSize          string         `json:"image_size"`
	ImageProvider      string         `json:"image_provider"`
	ImageModel         string         `json:"image_model"`
	ProfileID          int            `json:"profile_id"`
	UseProfileDesign   bool           `json:"use_profile_design_ref"`
	CustomInstructions string         `json:"custom_instructions"`
	Source             string         `json:"source"`
}

type cardnewsBrandVisuals struct {
	BrandColor  string
	BrandColors string
	DesignRules string
	LogoEnabled bool
	LogoPath    string
}

var (
	cardnewsSafeNamePattern = regexp.MustCompile(`[^\w가-힣\s-]`)
	codexNumericLogPattern  = regexp.MustCompile(`^[0-9,]+$`)
	cardnewsHexColorPattern = regexp.MustCompile(`(?i)#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b`)
)

func (s *Service) handleGenerateSingleCardnewsSlide(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req cardnewsSingleSlideRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if len(req.Slide) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "슬라이드 내용이 필요합니다."})
		return
	}
	topic := fallbackText(req.Topic, "cardnews")
	projectDir := strings.TrimSpace(req.ProjectDir)
	if projectDir == "" {
		var err error
		projectDir, err = s.createCardnewsProjectDir(topic)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	} else if !filepath.IsAbs(projectDir) {
		projectDir = filepath.Join(s.dataDir, projectDir)
	}
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	slideNum := intFromAny(req.Slide["slide_number"])
	if slideNum <= 0 {
		slideNum = 1
		req.Slide["slide_number"] = slideNum
	}
	slideCount := req.SlideCount
	if slideCount <= 0 {
		slideCount = slideNum
	}
	visual := s.resolveCardnewsBrandVisuals(req.ProfileID, req.BrandColor, req.BrandLogoURL, req.LogoEnabled)
	prevImagePath := s.resolveLocalImagePathFromURL(req.PrevImageURL)
	referenceInputs := append([]string{}, req.UserImageURLs...)
	if strings.TrimSpace(req.UserImageURL) != "" {
		referenceInputs = append([]string{req.UserImageURL}, referenceInputs...)
	}
	if strings.TrimSpace(req.DesignRefURL) != "" {
		referenceInputs = append(referenceInputs, req.DesignRefURL)
	}
	imageCfg := s.resolveImageProvider(req.ImageProvider, req.ImageModel)
	imageURL, imagePath, err := s.generateCardnewsSlideImage(cardnewsSlideImageInput{
		Slide:              req.Slide,
		Topic:              topic,
		Style:              fallbackText(req.Style, "modern"),
		AspectRatio:        fallbackText(req.AspectRatio, "1:1"),
		ImageSize:          fallbackText(req.ImageSize, "1K"),
		ProjectDir:         projectDir,
		SlideIndex:         slideNum - 1,
		SlideCount:         slideCount,
		PrevImagePath:      prevImagePath,
		BrandName:          req.BrandName,
		BrandColor:         visual.BrandColor,
		BrandColors:        visual.BrandColors,
		DesignRules:        visual.DesignRules,
		LogoEnabled:        visual.LogoEnabled,
		LogoPath:           visual.LogoPath,
		ReferencePaths:     s.resolveLocalImagePathsFromURLs(referenceInputs, 6),
		ImageProvider:      imageCfg.Provider,
		ImageModel:         imageCfg.Model,
		ImageAPIKey:        imageCfg.APIKey,
		PromptTemplate:     s.resolveContentPrompt("cardnews", "image_prompt", req.ProfileID),
		CustomInstructions: strings.TrimSpace(req.CustomInstructions),
		Source:             strings.TrimSpace(req.Source),
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	req.Slide["image_url"] = imageURL
	req.Slide["image_path"] = imagePath
	cardnewsID := req.CardnewsID
	if cardnewsID <= 0 {
		cardnewsID, _ = s.saveCardnewsProject(topic, keywordContentRequest{CardnewsStyle: req.Style, Source: req.Source}, projectDir, []map[string]any{req.Slide}, "generating")
	} else {
		_ = s.mergeCardnewsSlide(cardnewsID, projectDir, req.Slide)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"image_url":    imageURL,
		"image_path":   imagePath,
		"project_dir":  projectDir,
		"slide_number": slideNum,
		"cardnews_id":  cardnewsID,
	})
}

func (s *Service) handleCardnewsImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	rel := strings.TrimPrefix(r.URL.Path, "/api/cardnews/image/")
	rel = strings.TrimLeft(filepath.Clean("/"+rel), string(filepath.Separator))
	if rel == "" || strings.Contains(rel, "..") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid image path"})
		return
	}
	imagePath := filepath.Join(s.dataDir, "output", "cardnews", rel)
	if _, err := os.Stat(imagePath); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "이미지를 찾을 수 없습니다."})
		return
	}
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(imagePath)))
	if contentType == "" {
		contentType = "image/png"
	}
	if file, err := os.Open(imagePath); err == nil {
		buffer := make([]byte, 512)
		n, _ := file.Read(buffer)
		_ = file.Close()
		if detected := http.DetectContentType(buffer[:n]); strings.HasPrefix(detected, "image/") {
			contentType = detected
		}
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "no-cache, must-revalidate")
	w.Header().Set("Content-Type", contentType)
	http.ServeFile(w, r, imagePath)
}

func (s *Service) createCardnewsProjectDir(topic string) (string, error) {
	safeTopic := cardnewsSafeNamePattern.ReplaceAllString(strings.TrimSpace(topic), "")
	safeTopic = strings.TrimSpace(strings.ReplaceAll(safeTopic, " ", "_"))
	if safeTopic == "" {
		safeTopic = "cardnews"
	}
	if len([]rune(safeTopic)) > 30 {
		safeTopic = string([]rune(safeTopic)[:30])
	}
	projectDir := filepath.Join(s.dataDir, "output", "cardnews", fmt.Sprintf("%s_%s", safeTopic, time.Now().Format("20060102_150405")))
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		return "", err
	}
	return projectDir, nil
}

func (s *Service) generateCardnewsSlideImage(input cardnewsSlideImageInput) (string, string, error) {
	slideNum := intFromAny(input.Slide["slide_number"])
	if slideNum <= 0 {
		slideNum = input.SlideIndex + 1
		input.Slide["slide_number"] = slideNum
	}
	if err := os.MkdirAll(input.ProjectDir, 0o755); err != nil {
		return "", "", err
	}
	imagePath := filepath.Join(input.ProjectDir, fmt.Sprintf("slide_%02d.png", slideNum))
	prompt := buildCardnewsImagePrompt(input, imagePath)
	codexImageRefs := make([]string, 0, len(input.ReferencePaths)+2)
	if input.LogoEnabled && strings.TrimSpace(input.LogoPath) != "" {
		codexImageRefs = append(codexImageRefs, input.LogoPath)
	}
	codexImageRefs = append(codexImageRefs, input.ReferencePaths...)
	if strings.TrimSpace(input.PrevImagePath) != "" {
		codexImageRefs = append(codexImageRefs, input.PrevImagePath)
	}
	imageProvider := strings.TrimSpace(input.ImageProvider)
	if imageProvider == "" {
		imageProvider = "codex"
	}
	switch imageProvider {
	case "gemini":
		if err := s.runGeminiImageFile(prompt, imagePath, input.AspectRatio, input.ImageSize, input.ImageModel, 180*time.Second, codexImageRefs); err != nil {
			return "", "", err
		}
	case "atlas":
		if err := atlas.GenerateImageFile(atlas.GenerateImageOptions{
			APIKey:         input.ImageAPIKey,
			Model:          input.ImageModel,
			Prompt:         prompt,
			AspectRatio:    input.AspectRatio,
			OutputPath:     imagePath,
			ReferencePaths: codexImageRefs,
			Timeout:        180 * time.Second,
		}); err != nil {
			return "", "", err
		}
	default:
		if err := s.runCodexImageFile(prompt, imagePath, s.codexImageTimeout(), codexImageRefs); err != nil {
			return "", "", err
		}
	}
	rel, err := filepath.Rel(filepath.Join(s.dataDir, "output", "cardnews"), imagePath)
	if err != nil {
		rel = filepath.Base(imagePath)
	}
	return filepath.ToSlash(rel), imagePath, nil
}

func buildCardnewsImagePrompt(input cardnewsSlideImageInput, outputPath string) string {
	prevHint := ""
	if strings.TrimSpace(input.PrevImagePath) != "" {
		prevHint = "\n- 이전 카드 참고 이미지: " + input.PrevImagePath + "\n- 같은 시리즈 느낌만 이어가고 구도와 장면은 새롭게 만드세요."
	}
	brandVisualHint := buildCardnewsBrandVisualHint(input)
	designInstructionBlock := buildCardnewsDesignInstructionBlock(input)
	slideNum := intFromAny(input.Slide["slide_number"])
	if slideNum <= 0 {
		slideNum = input.SlideIndex + 1
	}
	logoRule := `- 로고 참조 이미지가 없으면 임의 로고나 워터마크를 만들지 마세요.`
	if input.LogoEnabled && strings.TrimSpace(input.LogoPath) != "" {
		logoRule = `- 제공된 실제 브랜드 로고 이미지를 결과 이미지 안에 자연스럽게 녹이세요.
- 로고를 새로 그리거나 브랜드명 텍스트로 다시 만들지 마세요. 특히 하단 우측 워드마크, 가짜 Makeke/마케케 로고, 임의 심볼, 워터마크를 만들지 마세요.
- 실제 로고 reference의 형태와 색을 정확히 반영할 수 없으면 틀린 로고를 넣지 말고 로고를 생략하세요.`
	}
	contentKind := "카드뉴스 이미지"
	textLayoutInstruction := "제목과 본문을 읽기 좋은 한국어 카드뉴스 타이포그래피로 직접 배치하세요."
	if isDetailPageImageInput(input) {
		contentKind = "모바일 상세페이지 섹션 이미지"
		textLayoutInstruction = "제목과 본문을 모바일 상세페이지 섹션에 어울리는 한국어 정보 구조와 타이포그래피로 직접 배치하세요."
	}
	return strings.TrimSpace(fmt.Sprintf(`
제공된 글로 %s 한 장을 잘 만들어주세요.

만들 내용:
- 주제: %s
- 현재 카드: %d/%d
- 제목: %s
- 본문: %s

제작 방식:
%s
- 레이아웃, 배경, 오브젝트, 색감, 강조 방식은 AI가 알아서 가장 보기 좋게 구성하세요.
- 아래 브랜드/참조 이미지는 참고만 하되, 카드뉴스 완성도를 우선하세요.
%s
- 프로필 디자인 규칙과 추가 제작 지시는 이미지 안에 노출할 문구가 아니라 색감, 타이포, 레이아웃, 이미지 톤, CTA 배치 판단 기준으로만 적용하세요.
%s
- 디자인 가이드, 색상표, HEX 코드, 제작 메모, 앱 편집 화면, 워터마크처럼 보이는 요소는 카드 안에 그리지 마세요.

저장:
- 최종 결과물은 실제 래스터 이미지 파일 1개입니다.
- 아래 절대 경로에 정확히 저장하세요: %s
- 작업이 끝나면 stdout에는 IMAGE_READY 한 줄만 출력하세요.
%s%s
`, contentKind, input.Topic, slideNum, input.SlideCount, stringify(input.Slide["title"]), stringify(input.Slide["body"]), textLayoutInstruction, logoRule, designInstructionBlock, outputPath, brandVisualHint, prevHint))
}

func buildCardnewsDesignInstructionBlock(input cardnewsSlideImageInput) string {
	blocks := []string{}
	if rules := sanitizeImageDesignRules(input.DesignRules); rules != "" {
		blocks = append(blocks, "[프로필 디자인 규칙 - 반드시 반영]\n"+rules)
	}
	if custom := sanitizeImageDesignRules(input.CustomInstructions); custom != "" {
		heading := "[추가 제작 지시 - 반드시 반영]"
		if isDetailPageImageInput(input) {
			heading = "[상세페이지 제작 지시 - 반드시 반영]"
		}
		blocks = append(blocks, heading+"\n"+custom)
	}
	if isDetailPageImageInput(input) {
		blocks = append(blocks, strings.TrimSpace(`[상세페이지 적용 규칙]
- 카드뉴스 템플릿이 아니라 모바일 상세페이지 섹션 이미지로 구성하세요.
- 프로필 디자인 규칙의 색감, 타이포그래피, 여백, CTA 톤을 각 섹션에 일관되게 적용하세요.
- 상품, 강의, 서비스, 병원/뷰티, 로컬 매장, B2B 등 입력 업종에 맞춰 정보 구조를 다르게 설계하세요.
- 입력 제목/본문의 핵심 문구만 한국어로 선명하게 배치하고, 임의 영어 라벨과 가짜 수치는 만들지 마세요.`))
	}
	if len(blocks) == 0 {
		return ""
	}
	return "\n" + strings.Join(blocks, "\n\n")
}

func sanitizeImageDesignRules(value string) string {
	cleaned := strings.TrimSpace(value)
	if cleaned == "" {
		return ""
	}
	cleaned = cardnewsHexColorPattern.ReplaceAllString(cleaned, "브랜드 팔레트 색상")
	cleaned = strings.ReplaceAll(cleaned, "\r\n", "\n")
	cleaned = strings.ReplaceAll(cleaned, "\r", "\n")
	return truncateRunes(cleaned, 1800)
}

func isDetailPageImageInput(input cardnewsSlideImageInput) bool {
	source := strings.ToLower(strings.TrimSpace(input.Source))
	if source == "detailpage" || source == "detail_page" {
		return true
	}
	if strings.TrimSpace(input.AspectRatio) == "9:16" && strings.Contains(input.CustomInstructions, "상세페이지") {
		return true
	}
	return false
}

func buildCardnewsLayoutGuard(input cardnewsSlideImageInput) string {
	lines := []string{
		"",
		"[카드뉴스 완성 이미지 규칙]",
		"- AI가 제목, 본문, 그래픽, 배경, 로고를 한 장 안에 완성된 카드뉴스로 구성합니다.",
		"- 제목과 본문은 한국어로 선명하게 읽히도록 반드시 포함하되, 위치/구도/크기는 AI가 카드뉴스 목적에 맞게 자연스럽게 구성하세요.",
		"- 이미지 안의 텍스트는 입력된 제목/본문의 한국어 문구만 허용합니다. 임의 영어 라벨, 임의 단계명, 랜덤 캡션은 만들지 마세요.",
		"- 수치, 체크포인트, CTA가 제목/본문에 실제로 포함된 경우에만 이미지 안에서 자연스럽게 디자인하세요. 없는 숫자나 퍼센트는 만들지 마세요.",
		"- 모든 주요 텍스트와 로고는 캔버스 안쪽 안전 여백 8%% 안에 배치하세요.",
		"- 불필요한 코너 태그, 가짜 워터마크, 무관한 브랜드명은 만들지 마세요.",
		"- 색상 코드(#FF8C00 등), 팔레트 스와치, 디자인 규칙 문서, 이미지 목업 프레임, 앱 편집 화면처럼 보이는 요소를 절대 넣지 마세요.",
	}
	if input.LogoEnabled && strings.TrimSpace(input.LogoPath) != "" {
		lines = append(lines, "- 제공된 실제 로고 이미지를 카드뉴스 브랜드 마크로 사용하세요.")
	}
	return strings.Join(lines, "\n") + "\n"
}

func buildCardnewsBrandVisualHint(input cardnewsSlideImageInput) string {
	lines := []string{}
	if input.LogoEnabled && strings.TrimSpace(input.LogoPath) != "" {
		lines = append(lines,
			"- 브랜드 로고 이미지 경로: "+input.LogoPath,
			"- 로고는 실제 제공된 이미지 파일만 참고하세요. 브랜드명을 새 텍스트 로고로 만들지 마세요.",
			"- 로고는 앱 오버레이가 아니라 이미지 생성 단계에서 카드뉴스 분위기와 구도 안에 자연스럽게 녹이세요.",
			"- 실제 로고와 다르게 보일 것 같으면 로고를 넣지 마세요.",
		)
	}
	if len(input.ReferencePaths) > 0 {
		lines = append(lines, "- 참조 이미지 경로:")
		for _, ref := range input.ReferencePaths {
			if strings.TrimSpace(ref) != "" {
				lines = append(lines, "  - "+ref)
			}
		}
		lines = append(lines, "- 참조 이미지는 색감, 브랜드 무드, 레이아웃 밀도, 오브젝트 톤만 참고하고 그대로 복사하지 마세요.")
	}
	if len(lines) == 0 {
		return ""
	}
	return "\n\n[브랜드/참조 이미지 필수 반영]\n" + strings.Join(lines, "\n") + "\n"
}

func renderCardnewsImageTemplate(template string, input cardnewsSlideImageInput, outputPath string) string {
	slideNum := intFromAny(input.Slide["slide_number"])
	if slideNum <= 0 {
		slideNum = input.SlideIndex + 1
	}
	title := strings.TrimSpace(stringify(input.Slide["title"]))
	body := strings.TrimSpace(stringify(input.Slide["body"]))
	visualPrompt := strings.TrimSpace(stringify(input.Slide["visual_prompt"]))
	brandInfo := ""
	if topic := strings.TrimSpace(input.Topic); topic != "" {
		brandInfo = "주제/브랜드 맥락: " + topic
	}
	brandVisualHint := strings.TrimSpace(buildCardnewsBrandVisualHint(input))
	styleDesc := strings.TrimSpace(input.Style)
	if styleDesc == "" {
		styleDesc = "modern"
	}
	replacer := strings.NewReplacer(
		"{슬라이드번호}", strconv.Itoa(slideNum),
		"{slide_num}", strconv.Itoa(slideNum),
		"{slide_number}", strconv.Itoa(slideNum),
		"{주제}", input.Topic,
		"{topic}", input.Topic,
		"{제목}", title,
		"{title}", title,
		"{본문}", body,
		"{body}", body,
		"{시각컨셉}", visualPrompt,
		"{visual_prompt}", visualPrompt,
		"{base_visual_prompt}", visualPrompt,
		"{스타일설명}", styleDesc,
		"{style_desc}", styleDesc,
		"{style}", styleDesc,
		"{브랜드정보}", brandInfo,
		"{brand_section}", brandInfo,
		"{brand_info}", brandInfo,
		"{브랜드색상}", input.BrandColor,
		"{brand_color}", input.BrandColor,
		"{브랜드팔레트}", input.BrandColors,
		"{brand_colors}", input.BrandColors,
		"{디자인규칙}", input.DesignRules,
		"{design_rules}", input.DesignRules,
		"{브랜드로고}", input.LogoPath,
		"{brand_logo}", input.LogoPath,
		"{brand_logo_path}", input.LogoPath,
		"{참조이미지}", strings.Join(input.ReferencePaths, "\n"),
		"{reference_images}", strings.Join(input.ReferencePaths, "\n"),
		"{brand_visual_hint}", brandVisualHint,
		"{custom_instructions}", input.CustomInstructions,
		"{출력경로}", outputPath,
		"{output_path}", outputPath,
		"{slide_count}", strconv.Itoa(input.SlideCount),
		"{image_size}", input.ImageSize,
		"{aspect_ratio}", input.AspectRatio,
	)
	return strings.TrimSpace(replacer.Replace(template))
}

func (s *Service) runCodexImageFile(prompt, outputPath string, timeout time.Duration, imagePaths []string) error {
	if _, err := resolveCLIPath("codex"); err != nil {
		return fmt.Errorf("Codex CLI를 찾지 못했습니다")
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return err
	}
	_ = os.Remove(outputPath)
	startedAt := time.Now().Add(-1 * time.Second)
	s.appendCodexLog("image generation requested: " + filepath.Base(outputPath))
	if _, err := s.runCodexPromptInDir(prompt, filepath.Dir(outputPath), timeout, imagePaths); err != nil {
		if found := findGeneratedImage(outputPath, startedAt); found != "" {
			s.appendCodexLog("image file found after Codex error: " + filepath.Base(outputPath))
			return nil
		}
		return err
	}
	if found := findGeneratedImage(outputPath, startedAt); found != "" {
		s.appendCodexLog("image file ready: " + filepath.Base(outputPath))
		return nil
	}
	return fmt.Errorf("Codex CLI가 이미지 파일을 만들지 않았습니다")
}

func (s *Service) runGeminiImageFile(prompt, outputPath string, aspectRatio string, imageSize string, modelOverride string, timeout time.Duration, imagePaths []string) error {
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", ""))
	if apiKey == "" {
		apiKey = strings.TrimSpace(s.getSetting("API.google_api_key", ""))
	}
	if apiKey == "" {
		return fmt.Errorf("Gemini 이미지 생성 API 키가 설정되지 않았습니다")
	}
	model := strings.TrimSpace(modelOverride)
	if model == "" {
		model = strings.TrimSpace(s.getSetting("MODELS.image_model", "gemini-3.1-flash-image-preview"))
	}
	if model == "" || model == "codex-cli" {
		model = "gemini-3.1-flash-image-preview"
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return err
	}
	parts := []map[string]any{{"text": prompt}}
	parts = append(parts, geminiInlineImageParts(imagePaths)...)
	payload := map[string]any{
		"contents": []map[string]any{
			{
				"parts": parts,
			},
		},
		"generationConfig": map[string]any{
			"responseModalities": []string{"TEXT", "IMAGE"},
			"imageConfig": map[string]any{
				"aspectRatio": fallbackText(aspectRatio, "1:1"),
				"imageSize":   fallbackText(imageSize, "1K"),
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":generateContent?key=" + url.QueryEscape(apiKey)
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: timeout}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 12<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Gemini 이미지 API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 300))
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return err
	}
	imageData := findGeminiInlineImageData(parsed)
	if imageData == "" {
		return fmt.Errorf("Gemini 응답에 이미지 데이터가 없습니다")
	}
	decoded, err := base64.StdEncoding.DecodeString(imageData)
	if err != nil {
		return err
	}
	if len(decoded) == 0 {
		return fmt.Errorf("Gemini 이미지 데이터가 비어 있습니다")
	}
	return os.WriteFile(outputPath, decoded, 0o644)
}

func geminiInlineImageParts(imagePaths []string) []map[string]any {
	parts := make([]map[string]any, 0, len(imagePaths))
	for _, imagePath := range sanitizeCodexImagePaths(imagePaths, 6) {
		data, err := os.ReadFile(imagePath)
		if err != nil || len(data) == 0 {
			continue
		}
		mimeType := mime.TypeByExtension(strings.ToLower(filepath.Ext(imagePath)))
		if mimeType == "" {
			mimeType = http.DetectContentType(data)
		}
		if !strings.HasPrefix(mimeType, "image/") {
			continue
		}
		parts = append(parts, map[string]any{
			"inline_data": map[string]any{
				"mime_type": mimeType,
				"data":      base64.StdEncoding.EncodeToString(data),
			},
		})
	}
	return parts
}

func findGeminiInlineImageData(parsed map[string]any) string {
	for _, candidate := range toAnySlice(parsed["candidates"]) {
		candidateMap, _ := candidate.(map[string]any)
		content, _ := candidateMap["content"].(map[string]any)
		for _, part := range toAnySlice(content["parts"]) {
			partMap, _ := part.(map[string]any)
			inlineData, _ := partMap["inlineData"].(map[string]any)
			if inlineData == nil {
				inlineData, _ = partMap["inline_data"].(map[string]any)
			}
			if data := strings.TrimSpace(stringify(inlineData["data"])); data != "" {
				return data
			}
		}
	}
	return ""
}

func toAnySlice(value any) []any {
	items, _ := value.([]any)
	return items
}

func (s *Service) runCodexPromptInDir(prompt, dir string, timeout time.Duration, imagePaths []string) (string, error) {
	cliPath, err := resolveCLIPath("codex")
	if err != nil {
		s.appendCodexLog("Codex CLI not found")
		return "", fmt.Errorf("Codex CLI를 찾지 못했습니다")
	}
	args := codexcli.ExecArgs(cliPath)
	for _, imagePath := range sanitizeCodexImagePaths(imagePaths, 6) {
		args = append(args, "--image", imagePath)
	}
	args = append(args, "-")
	cmd := exec.Command(cliPath, args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	cmd.Stdin = strings.NewReader(prompt)
	return s.runCodexCommand(cmd, timeout)
}

func sanitizeCodexImagePaths(imagePaths []string, limit int) []string {
	safe := make([]string, 0, len(imagePaths))
	seen := make(map[string]struct{}, len(imagePaths))
	for _, raw := range imagePaths {
		path := strings.TrimSpace(raw)
		if path == "" {
			continue
		}
		if !filepath.IsAbs(path) {
			continue
		}
		if _, exists := seen[path]; exists {
			continue
		}
		info, err := os.Stat(path)
		if err != nil || info.IsDir() || info.Size() == 0 {
			continue
		}
		switch strings.ToLower(filepath.Ext(path)) {
		case ".png", ".jpg", ".jpeg", ".webp":
		default:
			continue
		}
		seen[path] = struct{}{}
		safe = append(safe, path)
		if limit > 0 && len(safe) >= limit {
			break
		}
	}
	return safe
}

func (s *Service) runCodexCommand(cmd *exec.Cmd, timeout time.Duration) (string, error) {
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return "", err
	}
	var stdout strings.Builder
	var stderr strings.Builder
	readPipe := func(prefix string, reader io.Reader, target *strings.Builder) {
		scanner := bufio.NewScanner(reader)
		scanner.Buffer(make([]byte, 1024), 1024*1024)
		jsonResponseLogged := false
		for scanner.Scan() {
			line := scanner.Text()
			target.WriteString(line)
			target.WriteByte('\n')
			if shouldHideCodexLogLine(line) {
				continue
			}
			if shouldHideVerboseCodexLogLine(prefix, line) {
				if prefix == "stdout" && !jsonResponseLogged && looksLikeCodexJSONPayload(line) {
					s.appendCodexLog("stdout JSON response received")
					jsonResponseLogged = true
				}
				continue
			}
			s.appendCodexLog(prefix + " " + line)
		}
		if scanErr := scanner.Err(); scanErr != nil {
			s.appendCodexLog(prefix + " read error: " + scanErr.Error())
		}
	}
	s.appendCodexLog(fmt.Sprintf("Codex CLI start cwd=%s timeout=%s", cmd.Dir, timeout))
	if err := cmd.Start(); err != nil {
		s.appendCodexLog("Codex CLI start failed: " + err.Error())
		return "", err
	}
	done := make(chan error, 1)
	go readPipe("stdout", stdoutPipe, &stdout)
	go readPipe("stderr", stderrPipe, &stderr)
	go func() { done <- cmd.Wait() }()
	select {
	case err := <-done:
		if err != nil {
			message := strings.TrimSpace(stderr.String())
			if message == "" {
				message = strings.TrimSpace(stdout.String())
			}
			s.appendCodexLog("Codex CLI failed: " + truncate(message, 240))
			return "", fmt.Errorf("Codex CLI 실행 실패: %s", truncate(message, 300))
		}
		s.appendCodexLog("Codex CLI completed")
		return strings.TrimSpace(stdout.String()), nil
	case <-time.After(timeout):
		_ = cmd.Process.Kill()
		s.appendCodexLog(fmt.Sprintf("Codex CLI timeout: %s", timeout))
		return "", fmt.Errorf("Codex CLI 실행 타임아웃 (%s)", timeout)
	}
}

func shouldHideCodexLogLine(line string) bool {
	lowered := strings.ToLower(line)
	noisy := []string{
		"mcp.figma.com",
		"authrequired",
		"rmcp::transport::worker",
		"www_authenticate_header",
	}
	for _, item := range noisy {
		if strings.Contains(lowered, item) {
			return true
		}
	}
	return false
}

func shouldHideVerboseCodexLogLine(prefix, line string) bool {
	cleaned := strings.TrimSpace(line)
	if cleaned == "" {
		return true
	}
	if prefix == "stdout" {
		return looksLikeCodexJSONPayload(cleaned) || len([]rune(cleaned)) > 180
	}
	if prefix != "stderr" {
		return false
	}
	allowedPrefixes := []string{
		"OpenAI Codex",
		"workdir:",
		"model:",
		"provider:",
		"reasoning effort:",
		"tokens used",
	}
	for _, item := range allowedPrefixes {
		if strings.HasPrefix(cleaned, item) {
			return false
		}
	}
	if codexNumericLogPattern.MatchString(cleaned) {
		return false
	}
	return true
}

func looksLikeCodexJSONPayload(line string) bool {
	cleaned := strings.TrimSpace(line)
	return strings.HasPrefix(cleaned, "{") || strings.HasPrefix(cleaned, "[")
}

func findGeneratedImage(outputPath string, since time.Time) string {
	if info, err := os.Stat(outputPath); err == nil && !info.IsDir() && info.Size() > 0 && !info.ModTime().Before(since) {
		return outputPath
	}
	parent := filepath.Dir(outputPath)
	entries, err := os.ReadDir(parent)
	if err != nil {
		return ""
	}
	var picked string
	var pickedMod time.Time
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" {
			continue
		}
		path := filepath.Join(parent, entry.Name())
		info, err := entry.Info()
		if err != nil || info.Size() == 0 {
			continue
		}
		if info.ModTime().Before(since) {
			continue
		}
		if picked == "" || info.ModTime().After(pickedMod) {
			picked = path
			pickedMod = info.ModTime()
		}
	}
	if picked == "" {
		return ""
	}
	if picked != outputPath {
		_ = copyFile(picked, outputPath)
	}
	if info, err := os.Stat(outputPath); err == nil && info.Size() > 0 {
		return outputPath
	}
	return picked
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0o644)
}

func (s *Service) saveCardnewsProject(topic string, req keywordContentRequest, projectDir string, slides []map[string]any, status string) (int64, error) {
	db, err := s.openDB()
	if err != nil {
		return 0, err
	}
	defer db.Close()
	if err := ensureCardnewsTable(db); err != nil {
		return 0, err
	}
	raw, _ := json.Marshal(slides)
	result, err := db.Exec(
		`INSERT INTO cardnews (topic, style, aspect_ratio, slide_count, success_count, project_dir, slides_json, status, source)
		 VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
		topic,
		fallbackText(req.CardnewsStyle, "modern"),
		fallbackText(req.CardnewsRatio, "1:1"),
		len(slides),
		projectDir,
		string(raw),
		status,
		fallbackText(req.Source, "keyword"),
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Service) updateCardnewsProject(id int64, projectDir string, slides []map[string]any, status string, successCount int) error {
	db, err := s.openDB()
	if err != nil {
		return err
	}
	defer db.Close()
	if err := ensureCardnewsTable(db); err != nil {
		return err
	}
	raw, _ := json.Marshal(slides)
	_, err = db.Exec(
		`UPDATE cardnews SET slides_json=?, success_count=?, project_dir=?, status=? WHERE id=?`,
		string(raw),
		successCount,
		projectDir,
		status,
		id,
	)
	return err
}

func (s *Service) mergeCardnewsSlide(id int64, projectDir string, slide map[string]any) error {
	db, err := s.openDB()
	if err != nil {
		return err
	}
	defer db.Close()
	if err := ensureCardnewsTable(db); err != nil {
		return err
	}
	var raw string
	_ = db.QueryRow(`SELECT slides_json FROM cardnews WHERE id=?`, id).Scan(&raw)
	var slides []map[string]any
	_ = json.Unmarshal([]byte(raw), &slides)
	slideNum := intFromAny(slide["slide_number"])
	found := false
	for idx := range slides {
		if intFromAny(slides[idx]["slide_number"]) == slideNum {
			slides[idx] = slide
			found = true
			break
		}
	}
	if !found {
		slides = append(slides, slide)
	}
	successCount := 0
	for _, item := range slides {
		if strings.TrimSpace(stringify(item["image_url"])) != "" {
			successCount++
		}
	}
	encoded, _ := json.Marshal(slides)
	_, err = db.Exec(`UPDATE cardnews SET slides_json=?, success_count=?, project_dir=?, status='generating' WHERE id=?`, string(encoded), successCount, projectDir, id)
	return err
}

func ensureCardnewsTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS cardnews (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			topic TEXT NOT NULL,
			style TEXT DEFAULT 'modern',
			aspect_ratio TEXT DEFAULT '1:1',
			slide_count INTEGER DEFAULT 0,
			success_count INTEGER DEFAULT 0,
			project_dir TEXT DEFAULT '',
			slides_json TEXT DEFAULT '[]',
			status TEXT DEFAULT 'draft',
			source TEXT DEFAULT 'keyword',
			instagram_uploaded INTEGER DEFAULT 0,
			blog_published INTEGER DEFAULT 0,
			created_at TEXT DEFAULT (datetime('now', 'localtime'))
		)
	`)
	return err
}

func cloneStringAnyMap(src map[string]any) map[string]any {
	dst := make(map[string]any, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}

func (s *Service) resolveCardnewsImagePathFromURL(rawURL string) string {
	return s.resolveLocalImagePathFromURL(rawURL)
}

func (s *Service) resolveLocalImagePathsFromURLs(rawURLs []string, limit int) []string {
	paths := []string{}
	seen := map[string]struct{}{}
	for _, rawURL := range rawURLs {
		if limit > 0 && len(paths) >= limit {
			break
		}
		path := s.resolveLocalImagePathFromURL(rawURL)
		if path == "" {
			continue
		}
		if _, exists := seen[path]; exists {
			continue
		}
		seen[path] = struct{}{}
		paths = append(paths, path)
	}
	return paths
}

func (s *Service) resolveLocalImagePathFromURL(rawURL string) string {
	rawValue := strings.TrimSpace(rawURL)
	if rawValue == "" {
		return ""
	}
	value := strings.TrimSpace(strings.Split(rawValue, "?")[0])
	if parsed, err := url.Parse(rawValue); err == nil && parsed.Scheme != "" && parsed.Host != "" {
		if (parsed.Scheme == "http" || parsed.Scheme == "https") && !strings.HasPrefix(parsed.Path, "/api/") {
			if downloaded := s.cacheRemoteReferenceImage(parsed.String()); downloaded != "" {
				return downloaded
			}
		}
		value = parsed.Path
	}
	if strings.HasPrefix(value, "/api/cardnews/image/") {
		rel := strings.TrimPrefix(value, "/api/cardnews/image/")
		if decoded, err := url.PathUnescape(rel); err == nil {
			rel = decoded
		}
		return filepath.Join(s.dataDir, "output", "cardnews", rel)
	}
	if strings.HasPrefix(value, "/api/library/image/") {
		parts := strings.Split(strings.TrimPrefix(value, "/api/library/image/"), "/")
		if len(parts) >= 2 {
			for idx, part := range parts {
				if decoded, err := url.PathUnescape(part); err == nil {
					parts[idx] = decoded
				}
			}
			return filepath.Join(s.dataDir, "output", "library", parts[0], filepath.Join(parts[1:]...))
		}
	}
	if strings.HasPrefix(value, "/api/content/user-image/") {
		name := strings.TrimPrefix(value, "/api/content/user-image/")
		if decoded, err := url.PathUnescape(name); err == nil {
			name = decoded
		}
		if name != "" && !strings.Contains(name, "/") && !strings.Contains(name, `\`) {
			return filepath.Join(s.dataDir, "output", "user_images", name)
		}
	}
	if filepath.IsAbs(value) {
		return value
	}
	return ""
}

func (s *Service) cacheRemoteReferenceImage(rawURL string) string {
	refDir := filepath.Join(s.dataDir, "output", "user_images", "remote_refs")
	if err := os.MkdirAll(refDir, 0o755); err != nil {
		return ""
	}
	sum := sha1.Sum([]byte(rawURL))
	base := hex.EncodeToString(sum[:])
	if existing := existingRemoteReferenceImagePath(refDir, base); existing != "" {
		return existing
	}
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Makeke/1.0")
	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ""
	}
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0]))
	if !strings.HasPrefix(contentType, "image/") {
		return ""
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 12<<20))
	if err != nil || len(body) == 0 {
		return ""
	}
	ext := remoteReferenceImageExt(rawURL, contentType)
	target := filepath.Join(refDir, base+ext)
	if err := os.WriteFile(target, body, 0o644); err != nil {
		return ""
	}
	return target
}

func existingRemoteReferenceImagePath(refDir, base string) string {
	matches, err := filepath.Glob(filepath.Join(refDir, base+".*"))
	if err != nil {
		return ""
	}
	for _, match := range matches {
		if info, statErr := os.Stat(match); statErr == nil && info.Size() > 0 {
			return match
		}
	}
	return ""
}

func remoteReferenceImageExt(rawURL string, contentType string) string {
	allowed := map[string]struct{}{
		".png":  {},
		".jpg":  {},
		".jpeg": {},
		".webp": {},
		".gif":  {},
	}
	if parsed, err := url.Parse(rawURL); err == nil {
		if ext := strings.ToLower(filepath.Ext(parsed.Path)); ext != "" {
			if _, ok := allowed[ext]; ok {
				return ext
			}
		}
	}
	extensions, _ := mime.ExtensionsByType(contentType)
	for _, ext := range extensions {
		normalized := strings.ToLower(ext)
		if _, ok := allowed[normalized]; ok {
			return normalized
		}
	}
	return ".png"
}

func (s *Service) resolveCardnewsBrandVisuals(profileID int, requestColor string, requestLogoURL string, logoRequested bool) cardnewsBrandVisuals {
	visual := cardnewsBrandVisuals{
		BrandColor:  strings.TrimSpace(requestColor),
		LogoEnabled: logoRequested,
		LogoPath:    s.resolveLocalImagePathFromURL(requestLogoURL),
	}
	if profileID <= 0 {
		return visual
	}
	db, err := s.openDB()
	if err != nil {
		return visual
	}
	defer db.Close()
	if !tableExists(db, "brand_profiles") {
		return visual
	}
	var brandColor, brandColors, designTone, typographyRules, layoutRules, imageRules, ctaRules, designForbidden, designRules, logoPath, optionsRaw string
	if err := db.QueryRow(`SELECT brand_color, brand_colors, design_tone, typography_rules, layout_rules, image_rules, cta_rules, design_forbidden, design_rules, logo_path, content_options FROM brand_profiles WHERE id = ?`, profileID).Scan(
		&brandColor,
		&brandColors,
		&designTone,
		&typographyRules,
		&layoutRules,
		&imageRules,
		&ctaRules,
		&designForbidden,
		&designRules,
		&logoPath,
		&optionsRaw,
	); err != nil {
		return visual
	}
	if visual.BrandColor == "" {
		visual.BrandColor = strings.TrimSpace(brandColor)
	}
	visual.BrandColors = strings.TrimSpace(brandColors)
	visual.DesignRules = formatProfileDesignGuide(brandColors, designTone, typographyRules, layoutRules, imageRules, ctaRules, designForbidden, designRules)
	if visual.LogoPath == "" && strings.TrimSpace(logoPath) != "" {
		visual.LogoPath = filepath.Join(s.dataDir, "output", "library", strconv.Itoa(profileID), strings.TrimSpace(logoPath))
	}
	if strings.TrimSpace(optionsRaw) != "" {
		var opts map[string]any
		if err := json.Unmarshal([]byte(optionsRaw), &opts); err == nil {
			profileLogoEnabled := boolFromAny(opts["logo_insert"])
			visual.LogoEnabled = logoRequested || profileLogoEnabled
		}
	}
	if strings.TrimSpace(visual.LogoPath) == "" {
		visual.LogoEnabled = false
	}
	return visual
}

func formatProfileDesignGuide(brandColors, designTone, typographyRules, layoutRules, imageRules, ctaRules, designForbidden, designRules string) string {
	parts := []string{}
	if strings.TrimSpace(brandColors) != "" {
		parts = append(parts, "브랜드 색상: "+strings.TrimSpace(brandColors))
	}
	if strings.TrimSpace(designTone) != "" {
		parts = append(parts, "디자인 톤: "+strings.TrimSpace(designTone))
	}
	if strings.TrimSpace(typographyRules) != "" {
		parts = append(parts, "타이포그래피: "+strings.TrimSpace(typographyRules))
	}
	if strings.TrimSpace(layoutRules) != "" {
		parts = append(parts, "레이아웃: "+strings.TrimSpace(layoutRules))
	}
	if strings.TrimSpace(imageRules) != "" {
		parts = append(parts, "이미지 톤: "+strings.TrimSpace(imageRules))
	}
	if strings.TrimSpace(ctaRules) != "" {
		parts = append(parts, "CTA: "+strings.TrimSpace(ctaRules))
	}
	if strings.TrimSpace(designForbidden) != "" {
		parts = append(parts, "금지 규칙: "+strings.TrimSpace(designForbidden))
	}
	if strings.TrimSpace(designRules) != "" {
		parts = append(parts, "상세 규칙: "+strings.TrimSpace(designRules))
	}
	return strings.Join(parts, "\n")
}

func truthy(value any) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "1", "true", "yes", "y", "on":
			return true
		}
	}
	return false
}
