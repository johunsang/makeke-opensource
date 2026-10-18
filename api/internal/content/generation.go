package content

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
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
	blogsvc "makeke/api/internal/blog"
	"makeke/api/internal/codexcli"
	"makeke/api/internal/prompts"

	_ "modernc.org/sqlite"
)

type keywordContentRequest struct {
	Keyword           string         `json:"keyword"`
	SelectedSources   []sourceItem   `json:"selected_sources"`
	ScrapedTexts      []string       `json:"scraped_texts"`
	BrandName         string         `json:"brand_name"`
	BrandDescription  string         `json:"brand_description"`
	BrandColor        string         `json:"brand_color"`
	BrandLogoURL      string         `json:"brand_logo_url"`
	LogoInsert        bool           `json:"logo_insert"`
	ContactInfo       string         `json:"contact_info"`
	UserImageURLs     []string       `json:"user_image_urls"`
	GenerateBlog      bool           `json:"generate_blog"`
	GenerateCardnews  bool           `json:"generate_cardnews"`
	GenerateVideo     bool           `json:"generate_video"`
	GenerateSNS       bool           `json:"generate_sns"`
	Tone              string         `json:"tone"`
	BlogLength        string         `json:"blog_length"`
	ThreadsLength     string         `json:"threads_length"`
	ThreadsMode       string         `json:"threads_mode"`
	TwitterLength     string         `json:"twitter_length"`
	CommaRate         int            `json:"comma_rate"`
	PeriodRate        int            `json:"period_rate"`
	HumanLevel        string         `json:"human_level"`
	IncludeCTA        bool           `json:"include_cta"`
	CardnewsStyle     string         `json:"cardnews_style"`
	CardnewsSlides    int            `json:"cardnews_slides"`
	CardnewsRatio     string         `json:"cardnews_ratio"`
	CardnewsImageSize string         `json:"cardnews_image_size"`
	ComicStyle        string         `json:"comic_style"`
	ComicPanels       int            `json:"comic_panels"`
	VeoSceneCount     int            `json:"veo_scene_count"`
	BusinessGoal      string         `json:"business_goal"`
	CTAText           string         `json:"cta_text"`
	ProfileID         int            `json:"profile_id"`
	BlogImageCount    int            `json:"blog_image_count"`
	BlogImgSource     string         `json:"blog_img_source"`
	BlogImgStyle      string         `json:"blog_img_style"`
	TextProvider      string         `json:"text_provider"`
	ImageProvider     string         `json:"image_provider"`
	ImageModel        string         `json:"image_model"`
	SEO               bool           `json:"seo"`
	WebSearchEnhance  bool           `json:"web_search_enhance"`
	WebSearchKeyword  string         `json:"web_search_keyword"`
	PromptOverrides   map[string]any `json:"prompt_overrides"`
	LibraryID         string         `json:"library_id"`
	BlogHeaderImages  []string       `json:"blog_header_images"`
	BlogFooterImages  []string       `json:"blog_footer_images"`
	Source            string         `json:"source"`
}

type sourceItem struct {
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	URL     string `json:"url"`
}

type providerConfig struct {
	Provider string
	Model    string
	APIKey   string
}

var (
	contentTonePrompts = map[string]string{
		"professional": "전문적이고 신뢰감 있게, 근거와 데이터 중심으로",
		"friendly":     "친근하고 대화하듯이, 독자에게 말 걸듯이",
		"informative":  "정보 전달 중심으로 명확하고 체계적으로",
		"casual":       "편안하고 일상적으로, 블로그 톡톡 튀는 느낌으로",
		"humorous":     "유머러스하고 재미있게, 위트 있는 비유와 예시로",
		"storytelling": "이야기를 풀어가듯이, 상황 묘사와 에피소드 중심으로",
		"review":       "실제 사용/체험 후기처럼, 장단점을 솔직하게",
		"howto":        "단계별 가이드 형식으로, 따라하기 쉽게 설명",
		"comparison":   "항목별 비교/분석 형식으로, 표나 리스트 활용",
		"news":         "뉴스 기사처럼 객관적으로, 핵심 위주로",
		"listicle":     "리스트형으로, 핵심만 간결하게",
		"emotional":    "감성적이고 공감 가는 톤으로",
		"persuasive":   "설득력 있는 마케팅 톤으로, 혜택과 행동 유도 중심으로",
	}
	contentLengthGuides = map[string]string{
		"short":      "최소 800자 이상 (1000자 권장)",
		"medium":     "최소 1500자 이상 (2000자 권장)",
		"long":       "최소 2500자 이상 (3000자 이상 권장)",
		"extra_long": "최소 4000자 이상 (5000자 이상 권장)",
	}
)

func (s *Service) buildPromptPreview(req keywordContentRequest) (map[string]any, error) {
	sourceSummary := s.buildSourceSummary(req)
	enhancedSummary, webResearch := s.maybeEnhanceSourceSummaryWithCodexWeb(req, sourceSummary)
	sourceSummary = enhancedSummary
	styleMap := s.loadProfileStyle(req.ProfileID)
	prompts := map[string]any{
		"blog": map[string]any{
			"system_prompt": s.buildBlogSystemPrompt(req, styleMap),
			"user_prompt":   s.buildBlogUserPrompt(req, styleMap, sourceSummary),
		},
		"cardnews": map[string]any{
			"text_prompt": s.buildCardnewsPrompt(req, sourceSummary),
		},
		"sns": map[string]any{
			"common_rules":  s.buildSNSPrompt(req, styleMap, sourceSummary),
			"threads_rules": s.buildThreadsPrompt(req, sourceSummary),
			"twitter_rules": s.buildTwitterPrompt(req, sourceSummary),
		},
		"video": map[string]any{
			"prompt_bundle": s.buildVideoPrompt(req, sourceSummary),
		},
		"comic": map[string]any{
			"script_prompt": s.buildComicPrompt(req, sourceSummary),
		},
		"blog_image": map[string]any{
			"design_rules":    s.buildBlogImageDesignRules(req),
			"prompt_template": s.buildBlogImagePromptTemplate(req, sourceSummary),
		},
		"detail_page": map[string]any{
			"section_template": s.buildDetailPagePrompt(req),
		},
	}
	return map[string]any{
		"status":         "ok",
		"prompts":        prompts,
		"source_summary": sourceSummary,
		"style_meta":     s.buildPromptPreviewStyleMeta(styleMap),
		"web_research":   webResearch,
	}, nil
}

func (s *Service) generateKeywordContent(req keywordContentRequest) (map[string]any, error) {
	s.resetCodexLogs("콘텐츠 생성")
	cfg := s.resolveTextProvider(req.TextProvider)
	imageCfg := s.resolveImageProvider(req.ImageProvider, req.ImageModel)
	s.appendCodexLog(fmt.Sprintf("provider text=%s/%s image=%s/%s", cfg.Provider, cfg.Model, imageCfg.Provider, imageCfg.Model))
	styleMap := s.loadProfileStyle(req.ProfileID)
	sourceSummary := s.buildSourceSummary(req)
	enhancedSummary, webResearch := s.maybeEnhanceSourceSummaryWithCodexWeb(req, sourceSummary)
	sourceSummary = enhancedSummary
	s.appendCodexLog(fmt.Sprintf("source summary ready keyword=%q chars=%d", req.Keyword, len(sourceSummary)))
	result := map[string]any{
		"status":       "ok",
		"blog":         nil,
		"cardnews":     nil,
		"video":        nil,
		"sns":          nil,
		"blog_images":  nil,
		"web_research": webResearch,
		"meta": map[string]any{
			"text_provider":  cfg.Provider,
			"text_model":     cfg.Model,
			"image_provider": imageCfg.Provider,
			"image_model":    imageCfg.Model,
		},
	}

	needsBlogFirst := req.GenerateBlog || req.GenerateCardnews || req.BlogImageCount > 0 || req.GenerateVideo
	var blog map[string]any
	if needsBlogFirst {
		s.appendCodexLog("blog draft requested")
		generated, err := s.generateBlogDraft(req, styleMap, sourceSummary, cfg)
		if err != nil {
			s.appendCodexLog("blog draft failed: " + err.Error())
			blog = map[string]any{"error": err.Error()}
		} else {
			s.appendCodexLog("blog draft completed")
			blog = generated
		}
		result["blog"] = blog
	}

	downstreamReference := sourceSummary
	if body := strings.TrimSpace(stringify(blog["body"])); body != "" {
		downstreamReference = body
	}

	if req.GenerateCardnews {
		s.appendCodexLog("cardnews requested")
		cardnews, err := s.generateCardnews(req, downstreamReference, cfg, imageCfg)
		if err != nil {
			s.appendCodexLog("cardnews failed: " + err.Error())
			result["cardnews"] = map[string]any{"error": err.Error()}
		} else {
			s.appendCodexLog("cardnews completed")
			result["cardnews"] = cardnews
		}
	}

	if req.GenerateSNS {
		s.appendCodexLog("sns requested")
		sns, err := s.generateSNSBundle(req, downstreamReference, cfg, styleMap)
		if err != nil {
			s.appendCodexLog("sns failed: " + err.Error())
			result["sns"] = map[string]any{"error": err.Error()}
		} else {
			s.appendCodexLog("sns completed")
			result["sns"] = sns
		}
	}

	if req.BlogImageCount > 0 {
		s.appendCodexLog(fmt.Sprintf("blog images requested count=%d", req.BlogImageCount))
		contentForImages := strings.TrimSpace(stringify(blog["body"]))
		if contentForImages == "" {
			contentForImages = strings.TrimSpace(downstreamReference)
		}
		if contentForImages == "" {
			result["blog_images"] = map[string]any{"error": "블로그 이미지 생성용 본문이 없습니다."}
		} else {
			blogService := blogsvc.New(s.cfg)
			blogLogoURL := ""
			if req.LogoInsert && strings.TrimSpace(req.BrandLogoURL) != "" {
				blogLogoURL = req.BrandLogoURL
			}
			blogImages, err := blogService.GenerateImagesForContent(
				contentForImages,
				req.BlogImageCount,
				req.Keyword,
				req.BrandName,
				req.ProfileID,
				nil,
				req.UserImageURLs,
				blogLogoURL,
				downstreamReference,
				s.buildBlogImageDesignRules(req),
				s.buildBlogImagePromptTemplate(req, downstreamReference),
				imageCfg.Provider,
				imageCfg.Model,
			)
			if err != nil {
				s.appendCodexLog("blog images failed: " + err.Error())
				result["blog_images"] = map[string]any{"error": err.Error()}
			} else {
				s.appendCodexLog("blog images completed")
				blogImages["image_provider"] = imageCfg.Provider
				blogImages["image_model"] = imageCfg.Model
				result["blog_images"] = blogImages
			}
		}
	}

	if req.GenerateVideo {
		result["video"] = map[string]any{"error": "영상 생성은 아직 Go 이전 중입니다."}
	}

	return result, nil
}

func (s *Service) generateBlogDraft(req keywordContentRequest, styleMap map[string]any, sourceSummary string, cfg providerConfig) (map[string]any, error) {
	prompt := s.buildBlogGenerationPrompt(req, styleMap, sourceSummary)
	data, err := s.runJSONObjectPrompt(prompt, cfg, 420*time.Second)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(stringify(data["title"]))
	body := strings.TrimSpace(stringify(data["body"]))
	if body == "" {
		body = strings.TrimSpace(stringify(data["content"]))
	}
	if title == "" {
		title = strings.TrimSpace(req.Keyword)
	}
	if body == "" {
		return nil, fmt.Errorf("생성된 블로그 본문이 비어 있습니다")
	}

	content := strings.TrimSpace(title + "\n\n" + body)
	charCount := len(content)
	keywordCount := strings.Count(content, req.Keyword)
	postID, saveErr := s.saveGeneratedBlog(req.Keyword, title, content, charCount, keywordCount, cfg.Model, req.ScrapedTexts)
	if saveErr != nil {
		return nil, saveErr
	}

	return map[string]any{
		"post_id":    postID,
		"title":      title,
		"content":    content,
		"body":       body,
		"char_count": charCount,
		"model":      cfg.Model,
	}, nil
}

func (s *Service) generateCardnews(req keywordContentRequest, sourceSummary string, cfg providerConfig, imageCfg providerConfig) (map[string]any, error) {
	textData, err := s.generateCardnewsTexts(req, sourceSummary, cfg)
	if err != nil {
		return nil, err
	}
	slides, _ := textData["slides"].([]map[string]any)
	projectDir := strings.TrimSpace(stringify(textData["project_dir"]))
	cardnewsID := int64(intFromAny(textData["cardnews_id"]))

	imageSlides := make([]map[string]any, 0, len(slides))
	prevImagePath := ""
	imagePromptTemplate := s.resolveContentPrompt("cardnews", "image_prompt", req.ProfileID)
	visual := s.resolveCardnewsBrandVisuals(req.ProfileID, req.BrandColor, req.BrandLogoURL, req.LogoInsert)
	referencePaths := s.resolveLocalImagePathsFromURLs(req.UserImageURLs, 8)
	for idx, slide := range slides {
		nextSlide := cloneStringAnyMap(slide)
		imageURL, imagePath, imageErr := s.generateCardnewsSlideImage(cardnewsSlideImageInput{
			Slide:          nextSlide,
			Topic:          strings.TrimSpace(stringify(textData["topic"])),
			Style:          fallbackText(req.CardnewsStyle, "modern"),
			AspectRatio:    fallbackText(req.CardnewsRatio, "1:1"),
			ImageSize:      fallbackText(req.CardnewsImageSize, "1K"),
			ProjectDir:     projectDir,
			SlideIndex:     idx,
			SlideCount:     len(slides),
			PrevImagePath:  prevImagePath,
			BrandName:      req.BrandName,
			BrandColor:     visual.BrandColor,
			BrandColors:    visual.BrandColors,
			DesignRules:    visual.DesignRules,
			LogoEnabled:    visual.LogoEnabled,
			LogoPath:       visual.LogoPath,
			ReferencePaths: referencePaths,
			ImageProvider:  imageCfg.Provider,
			ImageModel:     imageCfg.Model,
			ImageAPIKey:    imageCfg.APIKey,
			PromptTemplate: imagePromptTemplate,
		})
		if imageErr != nil {
			nextSlide["image_error"] = imageErr.Error()
		} else {
			nextSlide["image_path"] = imagePath
			nextSlide["image_url"] = imageURL
			prevImagePath = imagePath
		}
		imageSlides = append(imageSlides, nextSlide)
	}
	status := "done"
	successCount := 0
	for _, slide := range imageSlides {
		if strings.TrimSpace(stringify(slide["image_path"])) != "" {
			successCount++
		}
	}
	if successCount == 0 {
		status = "texts_only"
	} else if successCount < len(imageSlides) {
		status = "partial"
	}
	if err := s.updateCardnewsProject(cardnewsID, projectDir, imageSlides, status, successCount); err != nil {
		return nil, err
	}

	textData["texts"] = imageSlides
	textData["slides"] = imageSlides
	textData["meta"] = map[string]any{
		"text_provider":  cfg.Provider,
		"text_model":     cfg.Model,
		"image_provider": imageCfg.Provider,
		"image_model":    imageCfg.Model,
	}
	return textData, nil
}

func (s *Service) generateCardnewsTexts(req keywordContentRequest, sourceSummary string, cfg providerConfig) (map[string]any, error) {
	prompt := s.buildCardnewsGenerationPrompt(req, sourceSummary)
	rawSlides, err := s.runJSONArrayPrompt(prompt, cfg, 420*time.Second)
	if err != nil {
		return nil, err
	}
	imageCfg := s.resolveImageProvider(req.ImageProvider, req.ImageModel)

	slideCount := req.CardnewsSlides
	if slideCount <= 0 {
		slideCount = 5
	}
	slides := make([]map[string]any, 0, slideCount)
	for idx, item := range rawSlides {
		slide, ok := item.(map[string]any)
		if !ok {
			continue
		}
		title := firstNonEmpty(
			strings.TrimSpace(stringify(slide["title"])),
			strings.TrimSpace(stringify(slide["headline"])),
			strings.TrimSpace(stringify(slide["heading"])),
			strings.TrimSpace(stringify(slide["hook"])),
			strings.TrimSpace(stringify(slide["message"])),
		)
		body := firstNonEmpty(
			strings.TrimSpace(stringify(slide["body"])),
			strings.TrimSpace(stringify(slide["content"])),
			strings.TrimSpace(stringify(slide["copy"])),
			strings.TrimSpace(stringify(slide["description"])),
			strings.TrimSpace(stringify(slide["text"])),
		)
		if title == "" {
			title = fmt.Sprintf("%s %d", strings.TrimSpace(req.Keyword), idx+1)
		}
		if body == "" {
			body = truncate(sourceSummary, 180)
		}
		slides = append(slides, map[string]any{
			"slide_number":  idx + 1,
			"title":         title,
			"body":          body,
			"visual_prompt": firstNonEmpty(strings.TrimSpace(stringify(slide["visual_prompt"])), strings.TrimSpace(stringify(slide["image_prompt"])), strings.TrimSpace(stringify(slide["visual"]))),
		})
		if len(slides) >= slideCount {
			break
		}
	}
	for len(slides) < slideCount {
		idx := len(slides) + 1
		slides = append(slides, map[string]any{
			"slide_number":  idx,
			"title":         fmt.Sprintf("%s %d", strings.TrimSpace(req.Keyword), idx),
			"body":          truncate(sourceSummary, 180),
			"visual_prompt": fmt.Sprintf("%s 카드뉴스 %d번 슬라이드용 이미지", strings.TrimSpace(req.Keyword), idx),
		})
	}

	topic := strings.TrimSpace(req.Keyword)
	if strings.TrimSpace(req.BrandName) != "" {
		topic = strings.TrimSpace(req.BrandName) + " - " + topic
	}
	projectDir, err := s.createCardnewsProjectDir(topic)
	if err != nil {
		return nil, err
	}
	cardnewsID, err := s.saveCardnewsProject(topic, req, projectDir, slides, "generating")
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"topic":       topic,
		"texts":       slides,
		"slides":      slides,
		"cardnews_id": cardnewsID,
		"project_dir": projectDir,
		"meta": map[string]any{
			"text_provider":  cfg.Provider,
			"text_model":     cfg.Model,
			"image_provider": imageCfg.Provider,
			"image_model":    imageCfg.Model,
		},
	}, nil
}

func (s *Service) generateFallbackCardnewsTexts(req keywordContentRequest, sourceSummary string, cfg providerConfig, cause error) (map[string]any, error) {
	slideCount := req.CardnewsSlides
	if slideCount <= 0 {
		slideCount = 5
	}
	slides := buildDeterministicCardnewsSlides(req.Keyword, sourceSummary, slideCount)
	topic := strings.TrimSpace(req.Keyword)
	if strings.TrimSpace(req.BrandName) != "" {
		topic = strings.TrimSpace(req.BrandName) + " - " + topic
	}
	projectDir, err := s.createCardnewsProjectDir(topic)
	if err != nil {
		return nil, err
	}
	cardnewsID, err := s.saveCardnewsProject(topic, req, projectDir, slides, "text_fallback")
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"topic":       topic,
		"texts":       slides,
		"slides":      slides,
		"cardnews_id": cardnewsID,
		"project_dir": projectDir,
		"fallback":    true,
		"warning":     truncate(cause.Error(), 240),
		"meta": map[string]any{
			"text_provider": cfg.Provider,
			"text_model":    cfg.Model,
		},
	}, nil
}

func buildDeterministicCardnewsSlides(topic string, sourceSummary string, count int) []map[string]any {
	if count <= 0 {
		count = 5
	}
	cleanTopic := strings.TrimSpace(topic)
	if cleanTopic == "" {
		cleanTopic = "카드뉴스"
	}
	segments := splitTextForCardnews(sourceSummary, count)
	slides := make([]map[string]any, 0, count)
	for idx := 0; idx < count; idx++ {
		body := strings.TrimSpace(segments[idx])
		if body == "" {
			body = cleanTopic
		}
		title := buildFallbackCardnewsTitle(cleanTopic, body, idx)
		slides = append(slides, map[string]any{
			"slide_number":  idx + 1,
			"title":         title,
			"body":          body,
			"visual_prompt": fmt.Sprintf("%s 카드뉴스 %d번 슬라이드", cleanTopic, idx+1),
		})
	}
	return slides
}

func splitTextForCardnews(text string, count int) []string {
	if count <= 0 {
		count = 1
	}
	cleaned := strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(text, " "))
	if cleaned == "" {
		return make([]string, count)
	}
	parts := regexp.MustCompile(`(?m)(?:\n{2,}|[.!?。！？]\s+)`).Split(cleaned, -1)
	grouped := make([][]string, count)
	for idx, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		grouped[idx%count] = append(grouped[idx%count], part)
	}
	result := make([]string, count)
	for idx := range result {
		value := strings.TrimSpace(strings.Join(grouped[idx], " "))
		if value == "" && idx < len(parts) {
			value = strings.TrimSpace(parts[idx])
		}
		result[idx] = truncate(value, 280)
	}
	return result
}

func buildFallbackCardnewsTitle(topic string, body string, index int) string {
	if index == 0 {
		return truncate(topic, 50)
	}
	for _, piece := range regexp.MustCompile(`[.!?。！？]`).Split(body, -1) {
		piece = strings.TrimSpace(piece)
		if piece != "" {
			return truncate(piece, 50)
		}
	}
	return fmt.Sprintf("%s %d", truncate(topic, 40), index+1)
}

func (s *Service) generateSNSBundle(req keywordContentRequest, sourceSummary string, cfg providerConfig, styleMap map[string]any) (map[string]any, error) {
	prompt := s.buildSNSGenerationPrompt(req, styleMap, sourceSummary)
	data, err := s.runJSONObjectPrompt(prompt, cfg, 240*time.Second)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"threads":   strings.TrimSpace(stringify(data["threads"])),
		"twitter":   strings.TrimSpace(stringify(data["twitter"])),
		"instagram": strings.TrimSpace(stringify(data["instagram"])),
	}, nil
}

func (s *Service) buildBlogSystemPrompt(req keywordContentRequest, styleMap map[string]any) string {
	if override := nestedString(req.PromptOverrides, "blog", "system_prompt"); override != "" {
		return s.renderContentPrompt(override, req, styleMap, "")
	}
	if template := s.resolveContentPrompt("blog", "system_prompt", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, styleMap, "")
	}
	toneText := contentTonePrompts[req.Tone]
	if toneText == "" {
		toneText = contentTonePrompts["friendly"]
	}
	lengthText := contentLengthGuides[req.BlogLength]
	if lengthText == "" {
		lengthText = contentLengthGuides["medium"]
	}
	styleText := s.formatPlatformStyle(styleMap, "blog")
	if styleText == "" {
		styleText = toneText
	} else {
		styleText = "프로필에 저장된 내 문체를 최우선으로 따르세요.\n" + styleText
	}
	return strings.TrimSpace(fmt.Sprintf("한국어 마케팅 블로그 작성자입니다.\n- 분량 가이드: %s\n- 문체/어조: %s\n- JSON 객체만 출력합니다.", lengthText, styleText))
}

func (s *Service) buildBlogUserPrompt(req keywordContentRequest, styleMap map[string]any, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "blog", "user_prompt"); override != "" {
		return s.renderContentPrompt(override, req, styleMap, sourceSummary)
	}
	if template := s.resolveContentPrompt("blog", "user_prompt", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, styleMap, sourceSummary)
	}
	return s.buildBlogGenerationPrompt(req, styleMap, sourceSummary)
}

func (s *Service) buildCardnewsPrompt(req keywordContentRequest, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "cardnews", "text_prompt"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if override := nestedString(req.PromptOverrides, "cardnews_text_prompt"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if template := s.resolveContentPrompt("cardnews", "text_prompt", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, nil, sourceSummary)
	}
	return s.buildCardnewsGenerationPrompt(req, sourceSummary)
}

func (s *Service) buildSNSPrompt(req keywordContentRequest, styleMap map[string]any, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "sns", "common_rules"); override != "" {
		return s.renderContentPrompt(override, req, styleMap, sourceSummary)
	}
	if override := nestedString(req.PromptOverrides, "sns_prompt"); override != "" {
		return s.renderContentPrompt(override, req, styleMap, sourceSummary)
	}
	if template := s.resolveContentPrompt("sns", "common_rules", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, styleMap, sourceSummary)
	}
	return s.buildSNSGenerationPrompt(req, styleMap, sourceSummary)
}

func (s *Service) buildThreadsPrompt(req keywordContentRequest, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "sns", "threads_rules"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if template := s.resolveContentPrompt("sns", "threads_rules", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, nil, sourceSummary)
	}
	threadsGuide := map[string]string{
		"short":  "짧고 빠르게 읽히게 180~220자 안쪽으로",
		"medium": "보통 길이로 320~450자 안쪽으로",
		"long":   "여러 개로 자연스럽게 이어질 수 있게 700~1200자 안쪽으로",
	}[req.ThreadsLength]
	if threadsGuide == "" {
		threadsGuide = "보통 길이로 320~450자 안쪽으로"
	}
	return fmt.Sprintf("주제: %s\n참고 요약:\n%s\n\n스레드용 글을 %s 작성하세요.", req.Keyword, truncate(sourceSummary, 2000), threadsGuide)
}

func (s *Service) buildTwitterPrompt(req keywordContentRequest, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "sns", "twitter_rules"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if template := s.resolveContentPrompt("sns", "twitter_rules", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, nil, sourceSummary)
	}
	twitterGuide := "짧지만 정보가 보이게 180~250자 안쪽으로"
	if req.TwitterLength == "short" {
		twitterGuide = "매우 짧고 강하게 120~180자 안쪽으로"
	}
	return fmt.Sprintf("주제: %s\n참고 요약:\n%s\n\n트위터(X)용 글을 %s 작성하세요.", req.Keyword, truncate(sourceSummary, 1200), twitterGuide)
}

func (s *Service) buildVideoPrompt(req keywordContentRequest, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "video", "prompt_bundle"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if override := nestedString(req.PromptOverrides, "video_prompt"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if template := s.resolveContentPrompt("video", "prompt_bundle", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, nil, sourceSummary)
	}
	return fmt.Sprintf("주제: %s\n브랜드 디자인 규칙:\n%s\n\n원문 요약:\n%s\n\nHyperFrames 기반 짧은 영상으로 확장할 때 필요한 장면 구성, 내레이션 방향, 색상·타이포·이미지 스타일·CTA 모션 방향을 한국어로 설계하세요.", req.Keyword, fallbackText(s.profileDesignGuide(req.ProfileID), "프로필 디자인 규칙 없음"), truncate(sourceSummary, 3000))
}

func (s *Service) buildComicPrompt(req keywordContentRequest, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "comic", "script_prompt"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if override := nestedString(req.PromptOverrides, "comic_script_prompt"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if template := s.resolveContentPrompt("comic", "script_prompt", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, nil, sourceSummary)
	}
	return fmt.Sprintf("주제: %s\n브랜드 디자인 규칙:\n%s\n\n참고 요약:\n%s\n\n한국어 스토리 만화 초안을 작성하세요. 4컷으로 고정하지 말고 내용 흐름에 맞게 보통 5~8컷으로 자연스럽게 구성하세요. 각 컷은 도입, 상황, 갈등/궁금증, 핵심 전환, 해결, 마무리 또는 CTA가 이어지게 설계하고, visual_prompt에는 브랜드 색상·이미지 스타일·금지 디자인을 반영하세요.", req.Keyword, fallbackText(s.profileDesignGuide(req.ProfileID), "프로필 디자인 규칙 없음"), truncate(sourceSummary, 2500))
}

func (s *Service) buildBlogImageDesignRules(req keywordContentRequest) string {
	profileRules := s.profileDesignGuide(req.ProfileID)
	if override := nestedString(req.PromptOverrides, "blog_image", "design_rules"); override != "" {
		return appendBlogImageLogoRule(mergeDesignRules(s.renderContentPrompt(override, req, nil, ""), profileRules), req)
	}
	if override := nestedString(req.PromptOverrides, "blog_image_design_rules"); override != "" {
		return appendBlogImageLogoRule(mergeDesignRules(s.renderContentPrompt(override, req, nil, ""), profileRules), req)
	}
	if template := s.resolveContentPrompt("blog_image", "design_rules", req.ProfileID); template != "" {
		return appendBlogImageLogoRule(mergeDesignRules(s.renderContentPrompt(template, req, nil, ""), profileRules), req)
	}
	rules := mergeDesignRules(strings.TrimSpace(`
- 표현 방식은 내용에 따라 자유롭게 결정하세요.
- 같은 구도, 같은 색조, 같은 아이콘 배치를 반복하지 마세요.
- 16:9 비율을 유지하고 일반 텍스트 없이 핵심 의미가 읽히게 구성하세요.
- 브랜드 톤은 참고만 하고 모든 이미지를 같은 템플릿으로 만들지 마세요.
`), profileRules)
	return appendBlogImageLogoRule(rules, req)
}

func appendBlogImageLogoRule(rules string, req keywordContentRequest) string {
	if req.LogoInsert {
		rules = strings.TrimSpace(rules + "\n- 프로필 로고 reference가 제공되면 앱 오버레이처럼 붙이지 말고, 간판, 제품 표식, 패키지 라벨, 공간 소품처럼 이미지 장면 안에 자연스럽게 녹이세요.")
	}
	return rules
}

func (s *Service) buildBlogImagePromptTemplate(req keywordContentRequest, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "blog_image", "prompt_template"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if override := nestedString(req.PromptOverrides, "blog_image_prompt_template"); override != "" {
		return s.renderContentPrompt(override, req, nil, sourceSummary)
	}
	if template := s.resolveContentPrompt("blog_image", "prompt_template", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, nil, sourceSummary)
	}
	return strings.TrimSpace(fmt.Sprintf("블로그 삽입용 이미지를 생성하세요.\n\n블로그 주제: {keyword}\n블로그 전체 맥락: %s\n현재 이미지: {index}/{total}\n이 섹션의 제목: {title}\n이 섹션의 내용: {body}\n\n디자인 참고:\n%s", truncate(sourceSummary, 1800), s.buildBlogImageDesignRules(req)))
}

func (s *Service) buildDetailPagePrompt(req keywordContentRequest) string {
	profileRules := s.profileDesignGuide(req.ProfileID)
	if override := nestedString(req.PromptOverrides, "detail_page", "section_template"); override != "" {
		return mergeDesignRules(s.renderContentPrompt(override, req, nil, ""), profileRules)
	}
	if override := nestedString(req.PromptOverrides, "detail_page_section_template"); override != "" {
		return mergeDesignRules(s.renderContentPrompt(override, req, nil, ""), profileRules)
	}
	if template := s.resolveContentPrompt("detail_page", "section_template", req.ProfileID); template != "" {
		return mergeDesignRules(s.renderContentPrompt(template, req, nil, ""), profileRules)
	}
	base := "{cover_instruction}\n제목: {title}\n본문: {body}\n원문 요약: {source_summary}\n\n이 정보를 바탕으로 상세페이지용 시각 구성 프롬프트를 한국어로 작성하세요.\n- 프로필 디자인 규칙의 색상, 타이포그래피, 레이아웃, 이미지 톤, CTA 규칙을 상세페이지 섹션에 반드시 반영하세요."
	return mergeDesignRules(base, profileRules)
}

func (s *Service) buildBlogGenerationPrompt(req keywordContentRequest, styleMap map[string]any, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "blog", "user_prompt"); override != "" {
		systemPrompt := s.buildBlogSystemPrompt(req, styleMap)
		return strings.TrimSpace(systemPrompt + "\n\n---\n\n" + s.renderContentPrompt(override, req, styleMap, sourceSummary))
	}
	if template := s.resolveContentPrompt("blog", "user_prompt", req.ProfileID); template != "" {
		systemPrompt := s.buildBlogSystemPrompt(req, styleMap)
		return strings.TrimSpace(systemPrompt + "\n\n---\n\n" + s.renderContentPrompt(template, req, styleMap, sourceSummary))
	}
	lengthText := contentLengthGuides[req.BlogLength]
	if lengthText == "" {
		lengthText = contentLengthGuides["medium"]
	}
	toneText := contentTonePrompts[req.Tone]
	if toneText == "" {
		toneText = contentTonePrompts["friendly"]
	}
	styleText := s.formatPlatformStyle(styleMap, "blog")
	seoRule := "키워드를 자연스럽게 여러 번 녹여 SEO 친화적으로 작성하세요."
	if !req.SEO {
		seoRule = "키워드 반복을 과하게 하지 마세요."
	}
	ctaRule := "과한 CTA는 넣지 마세요."
	if req.IncludeCTA {
		ctaRule = "마지막 문단에 자연스러운 행동 유도 문장을 넣으세요."
	}
	styleBlock := ""
	if styleText != "" {
		toneText = "프로필에 저장된 내 문체를 최우선으로 반영"
		styleBlock = "\n[내 문체 스타일 - 반드시 최우선 적용]\n" + styleText + "\n\n문체 적용 규칙:\n- 위 문체는 기본 어조보다 우선합니다.\n- 문장 길이, 끝맺음, 문단 호흡, 자주 쓰는 표현, 금지 표현을 그대로 반영하세요.\n"
	}
	return strings.TrimSpace(fmt.Sprintf(`
한국어 네이버 블로그 글을 작성하세요.
설명문 없이 반드시 JSON 객체만 출력합니다.

출력 스키마:
{
  "title": "한 줄 제목",
  "body": "본문 전체"
}

작성 조건:
- 키워드: %s
- 어조: %s
- 분량 가이드: %s
- 브랜드명: %s
- 브랜드 설명: %s
- 비즈니스 목표: %s
- 연락처/정보: %s
- %s
- %s
- 본문은 한국어 순수 텍스트 문단으로 작성
- 프로필 문체 스타일이 제공되면 브랜드 설명이나 일반 톤보다 그 문체를 우선하세요.
- AI, 모델, 프롬프트 같은 내부 표현은 절대 쓰지 마세요%s

[참고 자료]
%s
`, req.Keyword, toneText, lengthText, fallbackText(req.BrandName, "없음"), fallbackText(req.BrandDescription, "없음"), fallbackText(req.BusinessGoal, "없음"), fallbackText(req.ContactInfo, "없음"), seoRule, ctaRule, styleBlock, fallbackText(sourceSummary, "(참고 자료 없음)")))
}

func (s *Service) buildCardnewsGenerationPrompt(req keywordContentRequest, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "cardnews", "text_prompt"); override != "" {
		return appendCardnewsVisualPromptRule(s.renderContentPrompt(override, req, nil, sourceSummary))
	}
	if override := nestedString(req.PromptOverrides, "cardnews_text_prompt"); override != "" {
		return appendCardnewsVisualPromptRule(s.renderContentPrompt(override, req, nil, sourceSummary))
	}
	if template := s.resolveContentPrompt("cardnews", "text_prompt", req.ProfileID); template != "" {
		return appendCardnewsVisualPromptRule(s.renderContentPrompt(template, req, nil, sourceSummary))
	}
	slideCount := req.CardnewsSlides
	if slideCount <= 0 {
		slideCount = 5
	}
	topic := strings.TrimSpace(req.Keyword)
	if strings.TrimSpace(req.BrandName) != "" {
		topic = strings.TrimSpace(req.BrandName + " - " + req.Keyword)
	}
	designRules := s.profileDesignGuide(req.ProfileID)
	return strings.TrimSpace(fmt.Sprintf(`
한국어 카드뉴스 슬라이드 구성을 작성하세요.
설명 없이 JSON 배열만 출력합니다. 배열 길이는 정확히 %d개입니다.

각 항목 스키마:
{
  "slide_number": 1,
  "title": "짧은 제목",
  "body": "2~4문장 설명",
  "visual_prompt": "이미지 생성용 상세 비주얼 프롬프트"
}

조건:
- 주제: %s
- 스타일: %s
- 브랜드명: %s
- 브랜드 설명: %s
- 비즈니스 목표: %s
- 브랜드 디자인 규칙: %s
- 각 slide_number는 1부터 순서대로 증가
- title은 짧고 강하게
- body는 한국어 자연문
- visual_prompt는 완성 카드뉴스 이미지 제작에 바로 쓸 수 있을 정도로 구체적으로 작성하고, title/body 문구를 이미지 안에 반드시 넣되 구도와 배치는 AI가 자연스럽게 구성하도록 지시
- visual_prompt에는 브랜드 디자인 규칙의 색상·타이포·이미지 스타일·금지 요소와 프로필 로고/참조 이미지가 자연스럽게 녹아들 무드를 반영
- 참고 자료의 수치, 체크포인트, CTA가 필요하면 원문 의미를 유지해 카드 안에서 자연스럽게 디자인하도록 지시
- 같은 웜톤 배경, 같은 중앙 오브제, 같은 화살표, 같은 아이콘 묶음을 반복하지 마세요

[참고 자료]
%s
`, slideCount, topic, fallbackText(req.CardnewsStyle, "modern"), fallbackText(req.BrandName, "없음"), fallbackText(req.BrandDescription, "없음"), fallbackText(req.BusinessGoal, "없음"), fallbackText(designRules, "없음"), truncate(sourceSummary, 9000)))
}

func appendCardnewsVisualPromptRule(prompt string) string {
	clean := strings.TrimSpace(prompt)
	rule := strings.TrimSpace(cardnewsVisualPromptRule())
	if clean == "" {
		return rule
	}
	if strings.Contains(clean, "visual_prompt는 완성 카드뉴스 이미지") {
		return clean
	}
	return clean + "\n\n" + rule
}

func cardnewsVisualPromptRule() string {
	return `[카드뉴스 이미지 방향 규칙]
- visual_prompt는 완성 카드뉴스 이미지 제작 지시입니다. title/body의 한국어 문구를 이미지 안에 반드시 넣되, 위치/구도/크기/시각 흐름은 AI가 카드뉴스 목적에 맞게 자연스럽게 구성하게 하세요.
- 수치/체크포인트/CTA가 필요한 경우 원문 의미를 유지해 카드 안에 디자인하세요.
- 프로필 로고/참조 이미지가 제공되면 앱이 따로 얹지 않으므로 이미지 안에 자연스럽게 반영하세요.
- 무관한 가짜 브랜드명, 워터마크, 랜덤 문구는 만들지 마세요.`
}

func (s *Service) buildSNSGenerationPrompt(req keywordContentRequest, styleMap map[string]any, sourceSummary string) string {
	if override := nestedString(req.PromptOverrides, "sns_prompt"); override != "" {
		return s.renderContentPrompt(override, req, styleMap, sourceSummary)
	}
	if override := nestedString(req.PromptOverrides, "sns", "common_rules"); override != "" {
		return s.renderContentPrompt(override, req, styleMap, sourceSummary)
	}
	if template := s.resolveContentPrompt("sns", "common_rules", req.ProfileID); template != "" {
		return s.renderContentPrompt(template, req, styleMap, sourceSummary)
	}
	threadsGuide := "스레드는 320~450자 안쪽으로, 여러 개로 쪼개지지 않게 자연스럽게 작성"
	if req.ThreadsLength == "short" {
		threadsGuide = "스레드는 180~220자 안쪽으로 짧고 강하게 작성"
	} else if req.ThreadsLength == "long" {
		threadsGuide = "스레드는 700~1200자 안쪽으로 길게 쓰되 자연스럽게 이어질 수 있게 작성"
	}
	twitterGuide := "트위터는 180~250자 안쪽으로 짧지만 정보가 보이게 작성"
	if req.TwitterLength == "short" {
		twitterGuide = "트위터는 120~180자 안쪽으로 매우 짧고 강하게 작성"
	}
	styleBlock := ""
	if styleText := s.formatPlatformStyle(styleMap, "sns"); styleText != "" {
		styleBlock = "\n[내 문체 스타일 - 반드시 최우선 적용]\n" + styleText + "\n\n문체 적용 규칙:\n- 위 문체는 플랫폼 규칙과 기본 톤보다 우선합니다.\n- 문장 길이, 끝맺음, 문단 호흡, 자주 쓰는 표현, 금지 표현을 SNS 길이에 맞게 유지하세요.\n- 프로필 문체와 충돌하는 일반적인 마케팅 말투를 쓰지 마세요.\n"
	}
	return strings.TrimSpace(fmt.Sprintf(`
한국어 SNS 마케팅 카피를 작성하세요.
설명 없이 반드시 JSON 객체만 출력합니다.

출력 스키마:
{
  "threads": "스레드용 글",
  "twitter": "트위터용 글",
  "instagram": "인스타 캡션"
}

조건:
- 주제: %s
- 브랜드명: %s
- 브랜드 설명: %s
- 비즈니스 목표: %s
- %s
- %s
- 인스타 캡션은 300~500자 안쪽으로 작성
- 이모지, 해시태그 사용 금지
- 한국어만 사용
- 프로필 문체 스타일이 제공되면 그 문체를 가장 먼저 따르세요.%s

[참고 자료]
%s
`, req.Keyword, fallbackText(req.BrandName, "없음"), fallbackText(req.BrandDescription, "없음"), fallbackText(req.BusinessGoal, "없음"), threadsGuide, twitterGuide, styleBlock, truncate(sourceSummary, 7000)))
}

func (s *Service) buildSourceSummary(req keywordContentRequest) string {
	parts := make([]string, 0, 16)
	for idx, source := range req.SelectedSources {
		line := strings.TrimSpace(source.Title)
		if snippet := strings.TrimSpace(source.Snippet); snippet != "" {
			line += ": " + truncate(snippet, 180)
		}
		if urlValue := strings.TrimSpace(source.URL); urlValue != "" {
			line += " (" + urlValue + ")"
		}
		if line != "" {
			parts = append(parts, fmt.Sprintf("[선택 소스 %d] %s", idx+1, line))
		}
		if len(parts) >= 5 {
			break
		}
	}
	for idx, text := range req.ScrapedTexts {
		cleaned := strings.TrimSpace(text)
		if cleaned == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("[원문 %d]\n%s", idx+1, truncate(cleaned, 1800)))
		if idx >= 4 {
			break
		}
	}
	if len(parts) == 0 {
		brandInfo := strings.TrimSpace(strings.Join([]string{
			req.BrandName,
			req.BrandDescription,
			req.BusinessGoal,
			req.ContactInfo,
		}, "\n"))
		if brandInfo != "" {
			return truncate(brandInfo, 1800)
		}
		return strings.TrimSpace(req.Keyword)
	}
	return truncate(strings.Join(parts, "\n\n"), 8000)
}

func (s *Service) buildPromptPreviewStyleMeta(styleMap map[string]any) map[string]any {
	return map[string]any{
		"blog":     s.formatPlatformStyle(styleMap, "blog"),
		"cardnews": s.formatPlatformStyle(styleMap, "cardnews"),
		"sns":      s.formatPlatformStyle(styleMap, "sns"),
		"comic":    s.formatPlatformStyle(styleMap, "comic"),
	}
}

func (s *Service) formatPlatformStyle(styleMap map[string]any, platform string) string {
	if len(styleMap) == 0 {
		return ""
	}
	if nested, ok := styleMap[platform].(map[string]any); ok {
		return flattenStyleMap(nested)
	}
	return flattenStyleMap(styleMap)
}

func flattenStyleMap(style map[string]any) string {
	lines := make([]string, 0, 12)
	appendLine := func(label string, value any) {
		text := strings.TrimSpace(stringify(value))
		if text != "" {
			lines = append(lines, fmt.Sprintf("%s: %s", label, text))
		}
	}
	appendLine("어조", style["tone"])
	appendLine("문장 구조", style["sentence_style"])
	appendLine("끝맺음 패턴", style["ending_style"])
	appendLine("문단 구성", style["paragraph_style"])
	appendLine("어휘 수준", style["vocabulary_level"])
	appendLine("자주 쓰는 표현", style["expressions"])
	appendLine("금지 표현", style["forbidden_expressions"])
	appendLine("연결어", style["connector_words"])
	appendLine("수사/전개", style["rhetoric"])
	appendLine("고유 특징", style["unique_features"])
	appendLine("글 시작 방식", style["opening_pattern"])
	appendLine("글 마무리 방식", style["closing_pattern"])
	appendLine("예시 문장", style["sample_sentences"])
	return strings.Join(lines, "\n")
}

func (s *Service) loadProfileStyle(profileID int) map[string]any {
	if profileID <= 0 {
		return map[string]any{}
	}
	db, err := s.openDB()
	if err != nil {
		return map[string]any{}
	}
	defer db.Close()
	if !tableExists(db, "brand_profiles") {
		return map[string]any{}
	}
	var raw string
	if err := db.QueryRow(`SELECT writing_style FROM brand_profiles WHERE id = ?`, profileID).Scan(&raw); err != nil {
		return map[string]any{}
	}
	if strings.TrimSpace(raw) == "" {
		return map[string]any{}
	}
	var style map[string]any
	if err := json.Unmarshal([]byte(raw), &style); err != nil {
		return map[string]any{}
	}
	return style
}

func (s *Service) resolveContentPrompt(category string, subcategory string, profileID int) string {
	category = strings.TrimSpace(category)
	subcategory = strings.TrimSpace(subcategory)
	if category == "" || subcategory == "" {
		return ""
	}
	db, err := s.openDB()
	if err != nil {
		return ""
	}
	defer db.Close()
	if !tableExists(db, "prompt_templates") {
		return ""
	}
	return prompts.ResolvePromptContent(db, category, subcategory, profileID)
}

func (s *Service) renderContentPrompt(template string, req keywordContentRequest, styleMap map[string]any, sourceSummary string) string {
	result := strings.TrimSpace(template)
	if result == "" {
		return ""
	}
	for key, value := range s.contentPromptVariables(req, styleMap, sourceSummary) {
		result = strings.ReplaceAll(result, "{"+key+"}", value)
	}
	return strings.TrimSpace(result)
}

func (s *Service) contentPromptVariables(req keywordContentRequest, styleMap map[string]any, sourceSummary string) map[string]string {
	sourceText := strings.TrimSpace(sourceSummary)
	if sourceText == "" {
		sourceText = s.buildSourceSummary(req)
	}
	keyword := strings.TrimSpace(req.Keyword)
	brandName := strings.TrimSpace(req.BrandName)
	topic := keyword
	if brandName != "" {
		topic = brandName + " - " + keyword
	}

	brandInfoParts := make([]string, 0, 5)
	if brandName != "" {
		brandInfoParts = append(brandInfoParts, "브랜드명: "+brandName)
	}
	if desc := strings.TrimSpace(req.BrandDescription); desc != "" {
		brandInfoParts = append(brandInfoParts, "브랜드 설명: "+desc)
	}
	if goal := strings.TrimSpace(req.BusinessGoal); goal != "" {
		brandInfoParts = append(brandInfoParts, "콘텐츠 목적: "+goal)
	}
	if cta := strings.TrimSpace(req.CTAText); cta != "" {
		brandInfoParts = append(brandInfoParts, "CTA 문구: "+cta)
	}
	if contact := strings.TrimSpace(req.ContactInfo); contact != "" {
		brandInfoParts = append(brandInfoParts, "연락처/정보: "+contact)
	}
	brandInfo := strings.Join(brandInfoParts, "\n")
	if brandInfo == "" {
		brandInfo = "브랜드 정보 없음"
	}

	toneText := contentTonePrompts[req.Tone]
	if toneText == "" {
		toneText = contentTonePrompts["friendly"]
	}
	lengthText := contentLengthGuides[req.BlogLength]
	if lengthText == "" {
		lengthText = contentLengthGuides["medium"]
	}
	styleText := s.formatPlatformStyle(styleMap, "blog")
	if styleText == "" {
		styleText = toneText
	}
	styleHint := ""
	if styleText != "" {
		styleHint = "\n[내 문체 스타일 — 반드시 이 스타일로 작성하세요]\n" + styleText + "\n"
	}

	slideCount := req.CardnewsSlides
	if slideCount <= 0 {
		slideCount = 5
	}
	comicPanels := req.ComicPanels
	if comicPanels <= 0 {
		comicPanels = 6
	}
	sceneCount := req.VeoSceneCount
	if sceneCount <= 0 {
		sceneCount = 5
	}

	threadsInstruction := map[string]string{
		"short":  "스레드는 짧고 빠르게 읽히게 쓰세요. 180~220자 안쪽이 좋습니다.",
		"medium": "스레드는 보통 길이로 쓰세요. 320~450자 안쪽이 좋습니다.",
		"long":   "스레드는 길게 쓰되 여러 개로 자연스럽게 이어지는 흐름으로 작성하세요. 전체 700~1200자 안쪽이 좋습니다.",
	}[req.ThreadsLength]
	if threadsInstruction == "" {
		threadsInstruction = "스레드는 보통 길이로 쓰세요. 320~450자 안쪽이 좋습니다."
	}
	threadsModeInstruction := "스레드는 길어지면 여러 개로 나눠 이어서 게시할 수 있게 문장 단위를 분명하게 나눠주세요."
	if req.ThreadsMode == "single" {
		threadsModeInstruction = "스레드는 길어도 한 번에 맞춰 줄일 수 있게 너무 늘어지지 마세요."
	}
	twitterInstruction := "트위터(X)는 짧지만 정보가 보이게 쓰세요. 180~250자 안쪽이 좋습니다."
	twitterLimit := "250"
	if req.TwitterLength == "short" {
		twitterInstruction = "트위터(X)는 매우 짧고 강하게 압축하세요. 120~180자 안쪽이 좋습니다."
		twitterLimit = "180"
	}
	humanHint := ""
	humanLabel := "가볍게"
	switch req.HumanLevel {
	case "heavy":
		humanHint = "\n- 구어체 많이 사용, 띄어쓰기 오류 1~2개, 진짜 사람이 쓴 느낌으로"
		humanLabel = "많이"
	case "none":
		humanLabel = "안 함"
	default:
		humanHint = "\n- 구어체를 자연스럽게 섞어서 실제 사람이 쓴 것처럼"
	}
	commaRate := req.CommaRate
	if commaRate <= 0 {
		commaRate = 50
	}
	periodRate := req.PeriodRate
	if periodRate <= 0 {
		periodRate = 70
	}

	cardnewsStyle := fallbackText(req.CardnewsStyle, "modern")
	cardnewsStyleHint := "스타일: " + cardnewsStyle
	if cardnewsStyle == "ai-auto" || cardnewsStyle == "informative" || cardnewsStyle == "" {
		cardnewsStyleHint = "디자인 스타일: 주제와 브랜드에 가장 어울리는 색상·레이아웃·분위기를 AI가 자동으로 결정합니다."
	}
	comicStyle := fallbackText(req.ComicStyle, "cute")

	designRules := nestedString(req.PromptOverrides, "blog_image", "design_rules")
	if designRules == "" {
		designRules = s.resolveContentPrompt("blog_image", "design_rules", req.ProfileID)
	}
	if designRules == "" {
		designRules = "- 핵심 개념이 한눈에 보이게 구성\n- 텍스트는 최소화하고 시각 요소 중심으로 표현"
	}
	profileDesignRules := s.profileDesignGuide(req.ProfileID)
	designRules = mergeDesignRules(designRules, profileDesignRules)

	values := map[string]string{
		"키워드":                      keyword,
		"keyword":                  keyword,
		"주제":                       topic,
		"topic":                    topic,
		"브랜드명":                     brandName,
		"brand_name":               brandName,
		"브랜드정보":                    brandInfo,
		"brand_info":               brandInfo,
		"브랜드맥락":                    brandInfo,
		"brand_context":            brandInfo,
		"콘텐츠목적":                    strings.TrimSpace(req.BusinessGoal),
		"business_goal":            strings.TrimSpace(req.BusinessGoal),
		"CTA문구":                    strings.TrimSpace(req.CTAText),
		"cta_text":                 strings.TrimSpace(req.CTAText),
		"참고자료":                     fallbackText(sourceText, "참고자료 없음"),
		"reference":                sourceText,
		"source_text":              sourceText,
		"source_summary":           sourceText,
		"source_context":           sourceText,
		"blog_content":             sourceText,
		"원문":                       sourceText,
		"문체지시":                     styleHint,
		"스타일힌트":                    styleHint,
		"style_hint":               styleHint,
		"블로그스타일":                   styleText,
		"blog_style":               styleText,
		"tone_desc":                toneText,
		"글길이":                      lengthText,
		"blog_length":              lengthText,
		"쉼표비율":                     strconv.Itoa(commaRate),
		"comma_rate":               strconv.Itoa(commaRate),
		"마침표비율":                    strconv.Itoa(periodRate),
		"period_rate":              strconv.Itoa(periodRate),
		"자연스러움":                    humanLabel,
		"human_level":              humanLabel,
		"human_hint":               humanHint,
		"장수":                       strconv.Itoa(slideCount),
		"slide_count":              strconv.Itoa(slideCount),
		"카드뉴스스타일":                  cardnewsStyleHint,
		"cardnews_style":           cardnewsStyleHint,
		"브랜드색상":                    strings.TrimSpace(req.BrandColor),
		"brand_color":              strings.TrimSpace(req.BrandColor),
		"브랜드디자인규칙":                 profileDesignRules,
		"brand_design_rules":       profileDesignRules,
		"profile_design_rules":     profileDesignRules,
		"컷수":                       strconv.Itoa(comicPanels),
		"panel_count":              strconv.Itoa(comicPanels),
		"만화스타일":                    comicStyle,
		"comic_style":              comicStyle,
		"장면수":                      strconv.Itoa(sceneCount),
		"scene_count":              strconv.Itoa(sceneCount),
		"threads_instruction":      threadsInstruction,
		"threads_mode_instruction": threadsModeInstruction,
		"twitter_instruction":      twitterInstruction,
		"thread_rule":              threadsInstruction,
		"스레드규칙":                    threadsInstruction,
		"chain_rule":               threadsModeInstruction,
		"이어쓰기규칙":                   threadsModeInstruction,
		"thread_limit":             "450",
		"스레드글자수":                   "450",
		"twitter_limit":            twitterLimit,
		"트위터글자수":                   twitterLimit,
		"twitter_rule":             twitterInstruction,
		"트위터규칙":                    twitterInstruction,
		"소스텍스트":                    sourceText,
		"design_rules":             designRules,
		"body":                     sourceText,
		"title":                    fallbackText(brandName, keyword),
		"cover_instruction":        "이것은 예시 섹션 프롬프트입니다. 실제 생성 시에는 표지/본문 여부에 따라 문구가 바뀝니다.",
	}
	return values
}

func (s *Service) profileDesignGuide(profileID int) string {
	if profileID <= 0 {
		return ""
	}
	visual := s.resolveCardnewsBrandVisuals(profileID, "", "", false)
	return strings.TrimSpace(visual.DesignRules)
}

func mergeDesignRules(base string, profileRules string) string {
	base = strings.TrimSpace(base)
	profileRules = strings.TrimSpace(profileRules)
	if profileRules == "" {
		return base
	}
	if base == "" {
		return "[브랜드 프로필 디자인 규칙]\n" + profileRules
	}
	return strings.TrimSpace(base + "\n\n[브랜드 프로필 디자인 규칙]\n" + profileRules)
}

func (s *Service) resolveTextProvider(requested string) providerConfig {
	raw := strings.TrimSpace(requested)
	rawLower := strings.ToLower(raw)
	if rawLower == "atlas" || strings.HasPrefix(rawLower, "atlas:") {
		apiKey := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
		model := strings.TrimSpace(strings.TrimPrefix(raw, "atlas:"))
		if model == "" || strings.EqualFold(model, "atlas") {
			model = strings.TrimSpace(s.getSetting("MODELS.text_model", ""))
		}
		if model == "" || strings.EqualFold(model, "atlas") || strings.HasPrefix(strings.ToLower(model), "gemini-") || model == "codex-cli" || model == "kimi-cli" || model == "gemini-cli" || model == "claude-code" || model == "claude-cli" {
			model = atlas.DefaultChatModel
		}
		if apiKey != "" {
			return providerConfig{Provider: "atlas", Model: model, APIKey: apiKey}
		}
	}
	provider := normalizeAIProvider(requested)
	if provider == "" {
		provider = normalizeAIProvider(s.getSetting("MODELS.text_provider", ""))
	}
	if provider == "" {
		if fallback := s.resolveNonCLITextProvider(); fallback.Provider != "" {
			return fallback
		}
	}
	if provider == "cli" {
		model := strings.ToLower(strings.TrimSpace(s.getSetting("MODELS.text_model", "")))
		if model == "claude-code" || model == "claude-cli" || strings.Contains(model, "claude") {
			return providerConfig{Provider: "claude", Model: "claude-code"}
		}
		if model == "gemini-cli" || strings.Contains(model, "gemini cli") {
			return providerConfig{Provider: "gemini-cli", Model: "gemini-cli"}
		}
		if model == "kimi-cli" || strings.Contains(model, "kimi") {
			return providerConfig{Provider: "kimi", Model: "kimi-cli"}
		}
		return providerConfig{Provider: "codex", Model: "codex-cli"}
	}
	if provider == "claude" {
		if _, err := resolveCLIPath("claude"); err == nil {
			return providerConfig{Provider: "claude", Model: "claude-code"}
		}
		return s.resolveNonCLITextProvider()
	}
	if provider == "gemini-cli" {
		if _, err := resolveCLIPath("gemini"); err == nil {
			return providerConfig{Provider: "gemini-cli", Model: "gemini-cli"}
		}
		return s.resolveNonCLITextProvider()
	}
	if provider == "kimi" {
		if _, err := resolveCLIPath("kimi"); err == nil {
			return providerConfig{Provider: "kimi", Model: "kimi-cli"}
		}
		return s.resolveNonCLITextProvider()
	}
	if provider == "codex" {
		if _, err := resolveCLIPath("codex"); err == nil {
			return providerConfig{Provider: "codex", Model: "codex-cli"}
		}
		return s.resolveNonCLITextProvider()
	}
	if provider == "gemini" {
		apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", ""))
		if apiKey == "" {
			apiKey = strings.TrimSpace(s.getSetting("API.google_api_key", ""))
		}
		model := strings.TrimSpace(s.getSetting("MODELS.text_model", ""))
		if model == "" {
			model = "gemini-3.1-pro-preview"
		}
		if apiKey != "" {
			return providerConfig{
				Provider: "gemini",
				Model:    model,
				APIKey:   apiKey,
			}
		}
	}
	return providerConfig{
		Provider: "codex",
		Model:    "codex-cli",
	}
}

func (s *Service) resolveNonCLITextProvider() providerConfig {
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", ""))
	if apiKey == "" {
		apiKey = strings.TrimSpace(s.getSetting("API.google_api_key", ""))
	}
	if apiKey != "" {
		model := strings.TrimSpace(s.getSetting("MODELS.text_model", ""))
		if model == "" || model == "codex-cli" || model == "kimi-cli" || model == "gemini-cli" || model == "claude-code" || model == "claude-cli" {
			model = "gemini-3.1-pro-preview"
		}
		return providerConfig{Provider: "gemini", Model: model, APIKey: apiKey}
	}
	atlasKey := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
	if atlasKey != "" {
		model := strings.TrimSpace(s.getSetting("MODELS.text_model", ""))
		if model == "" || model == "codex-cli" || model == "kimi-cli" || model == "gemini-cli" || model == "claude-code" || model == "claude-cli" || strings.HasPrefix(strings.ToLower(model), "gemini-") {
			model = atlas.DefaultChatModel
		}
		return providerConfig{Provider: "atlas", Model: model, APIKey: atlasKey}
	}
	if _, err := resolveCLIPath("kimi"); err == nil {
		return providerConfig{Provider: "kimi", Model: "kimi-cli"}
	}
	return providerConfig{Provider: "codex", Model: "codex-cli"}
}

func (s *Service) resolveImageProvider(requested string, requestedModel ...string) providerConfig {
	provider := normalizeAIProvider(requested)
	storedProvider := normalizeAIProvider(s.getSetting("MODELS.image_provider", ""))
	model := ""
	if len(requestedModel) > 0 {
		model = strings.TrimSpace(requestedModel[0])
	}
	if model == "" {
		model = strings.TrimSpace(s.getSetting("MODELS.image_model", ""))
	}
	geminiImageModel := strings.TrimSpace(s.getSetting("API.gemini_image_model", ""))
	if provider == "" {
		provider = storedProvider
	}
	if inferred := inferImageProviderFromModel(model); inferred != "" && (provider == "" || provider == "cli" || provider == "codex") {
		provider = inferred
	}
	if provider == "" {
		if fallback := s.resolveNonCLIImageProvider(model, geminiImageModel); fallback.Provider != "" {
			return fallback
		}
	}
	if provider == "atlas" || strings.HasPrefix(strings.ToLower(model), "openai/gpt-image-2") || strings.HasPrefix(strings.ToLower(model), "qwen/") || strings.HasPrefix(strings.ToLower(model), "baidu/") || strings.HasPrefix(strings.ToLower(model), "alibaba/") {
		apiKey := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
		if apiKey == "" {
			apiKey = strings.TrimSpace(os.Getenv("ATLASCLOUD_API_KEY"))
		}
		if model == "" || model == "codex-cli" {
			model = atlas.DefaultImageModel
		}
		return providerConfig{
			Provider: "atlas",
			Model:    model,
			APIKey:   apiKey,
		}
	}
	if provider == "gemini" {
		apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", ""))
		if apiKey == "" {
			apiKey = strings.TrimSpace(s.getSetting("API.google_api_key", ""))
		}
		if model == "" || model == "codex-cli" {
			model = geminiImageModel
		}
		if model == "" {
			model = "gemini-3.1-flash-image-preview"
		}
		if apiKey != "" {
			return providerConfig{
				Provider: "gemini",
				Model:    model,
				APIKey:   apiKey,
			}
		}
	}
	if provider == "codex" {
		if _, err := resolveCLIPath("codex"); err == nil {
			return providerConfig{
				Provider: "codex",
				Model:    "codex-cli",
			}
		}
		if fallback := s.resolveNonCLIImageProvider(model, geminiImageModel); fallback.Provider != "" {
			return fallback
		}
	}
	if provider == "" {
		if _, err := resolveCLIPath("codex"); err == nil {
			return providerConfig{
				Provider: "codex",
				Model:    "codex-cli",
			}
		}
		if fallback := s.resolveNonCLIImageProvider(model, geminiImageModel); fallback.Provider != "" {
			return fallback
		}
	}
	return providerConfig{
		Provider: "codex",
		Model:    "codex-cli",
	}
}

func inferImageProviderFromModel(model string) string {
	value := strings.ToLower(strings.TrimSpace(model))
	switch {
	case value == "":
		return ""
	case strings.HasPrefix(value, "gemini-"), strings.Contains(value, "gemini"):
		return "gemini"
	case strings.HasPrefix(value, "openai/gpt-image-2"), strings.HasPrefix(value, "qwen/"), strings.HasPrefix(value, "baidu/"), strings.HasPrefix(value, "alibaba/"):
		return "atlas"
	case value == "codex-cli":
		return "codex"
	}
	return ""
}

func (s *Service) resolveNonCLIImageProvider(model string, geminiImageModel string) providerConfig {
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", ""))
	if apiKey == "" {
		apiKey = strings.TrimSpace(s.getSetting("API.google_api_key", ""))
	}
	if apiKey != "" {
		if model == "" || model == "codex-cli" || model == "kimi-cli" {
			model = geminiImageModel
		}
		if model == "" {
			model = "gemini-3.1-flash-image-preview"
		}
		return providerConfig{Provider: "gemini", Model: model, APIKey: apiKey}
	}
	atlasKey := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
	if atlasKey != "" {
		if model == "" || model == "codex-cli" || model == "kimi-cli" {
			model = atlas.DefaultImageModel
		}
		return providerConfig{Provider: "atlas", Model: model, APIKey: atlasKey}
	}
	return providerConfig{}
}

func normalizeAIProvider(value string) string {
	raw := strings.ToLower(strings.TrimSpace(value))
	switch raw {
	case "cli":
		return "cli"
	case "codex", "codex-cli", "cli:codex":
		return "codex"
	case "kimi", "kimi-cli", "cli:kimi":
		return "kimi"
	case "claude", "claude-code", "claude-cli", "cli:claude":
		return "claude"
	case "gemini-cli", "cli:gemini":
		return "gemini-cli"
	case "gemini", "google", "google-gemini":
		return "gemini"
	case "atlas", "atlascloud", "atlas-cloud":
		return "atlas"
	default:
		return ""
	}
}

func codexCLIAvailable() bool {
	if _, err := resolveCLIPath("codex"); err != nil {
		return false
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return true
	}
	for _, path := range []string{
		filepath.Join(home, ".codex"),
		filepath.Join(home, ".openai"),
	} {
		if _, statErr := os.Stat(path); statErr == nil {
			return true
		}
	}
	return true
}

func (s *Service) runJSONObjectPrompt(prompt string, cfg providerConfig, timeout time.Duration) (map[string]any, error) {
	fullPrompt := prompt + "\n\n반드시 JSON 객체만 출력하세요. 설명, 코드블록, 머리말은 금지합니다."
	text, err := s.runTextPrompt(fullPrompt, cfg, timeout)
	if err != nil {
		return nil, err
	}
	raw := extractJSONObject(text)
	if raw == "" {
		return nil, fmt.Errorf("JSON 객체 파싱 실패: %s", truncate(strings.TrimSpace(text), 240))
	}
	var parsed map[string]any
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func (s *Service) runJSONArrayPrompt(prompt string, cfg providerConfig, timeout time.Duration) ([]any, error) {
	fullPrompt := prompt + "\n\n반드시 JSON 배열만 출력하세요. 설명, 코드블록, 머리말은 금지합니다."
	text, err := s.runTextPrompt(fullPrompt, cfg, timeout)
	if err != nil {
		return nil, err
	}
	raw := extractJSONArray(text)
	if raw == "" {
		return nil, fmt.Errorf("JSON 배열 파싱 실패: %s", truncate(strings.TrimSpace(text), 240))
	}
	var parsed []any
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func (s *Service) runTextPrompt(prompt string, cfg providerConfig, timeout time.Duration) (string, error) {
	switch cfg.Provider {
	case "gemini":
		return s.runGeminiPrompt(prompt, cfg, timeout)
	case "atlas":
		return atlas.ChatCompletion(atlas.ChatOptions{
			APIKey:      cfg.APIKey,
			Model:       cfg.Model,
			Prompt:      prompt,
			Temperature: 0.4,
			Timeout:     timeout,
		})
	case "kimi":
		return s.runKimiPrompt(prompt, timeout)
	case "claude":
		return s.runClaudePrompt(prompt, timeout)
	case "gemini-cli":
		return s.runGeminiCLIPrompt(prompt, timeout)
	default:
		return s.runCodexPrompt(prompt, timeout)
	}
}

func (s *Service) runCodexPrompt(prompt string, timeout time.Duration) (string, error) {
	cliPath, err := resolveCLIPath("codex")
	if err != nil {
		s.appendCodexLog("Codex CLI not found")
		return "", fmt.Errorf("Codex CLI를 찾지 못했습니다")
	}
	cmd := exec.Command(cliPath, codexcli.ExecArgs(cliPath, "-")...)
	cmd.Dir = s.cfg.ProjectRoot
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	cmd.Stdin = strings.NewReader(prompt)
	return s.runCodexCommand(cmd, timeout)
}

func (s *Service) runKimiPrompt(prompt string, timeout time.Duration) (string, error) {
	cliPath, err := resolveCLIPath("kimi")
	if err != nil {
		s.appendCodexLog("Kimi CLI not found")
		return "", fmt.Errorf("Kimi CLI를 찾지 못했습니다")
	}
	cmd := exec.Command(cliPath, "--quiet", "--yolo", "-p", prompt)
	cmd.Dir = s.cfg.ProjectRoot
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	return s.runCodexCommand(cmd, timeout)
}

func (s *Service) runClaudePrompt(prompt string, timeout time.Duration) (string, error) {
	cliPath, err := resolveCLIPath("claude")
	if err != nil {
		s.appendCodexLog("Claude Code CLI not found")
		return "", fmt.Errorf("Claude Code CLI를 찾지 못했습니다")
	}
	cmd := exec.Command(cliPath, "-p", prompt)
	cmd.Dir = s.cfg.ProjectRoot
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	return s.runCodexCommand(cmd, timeout)
}

func (s *Service) runGeminiCLIPrompt(prompt string, timeout time.Duration) (string, error) {
	cliPath, err := resolveCLIPath("gemini")
	if err != nil {
		s.appendCodexLog("Gemini CLI not found")
		return "", fmt.Errorf("Gemini CLI를 찾지 못했습니다")
	}
	cmd := exec.Command(cliPath, "-p", prompt)
	cmd.Dir = s.cfg.ProjectRoot
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	return s.runCodexCommand(cmd, timeout)
}

func (s *Service) runGeminiPrompt(prompt string, cfg providerConfig, timeout time.Duration) (string, error) {
	if strings.TrimSpace(cfg.APIKey) == "" {
		return "", fmt.Errorf("Gemini API 키가 설정되지 않았습니다")
	}
	model := strings.TrimSpace(cfg.Model)
	if model == "" || model == "codex-cli" || model == "kimi-cli" || model == "gemini-cli" || model == "claude-code" || model == "claude-cli" {
		model = "gemini-3.1-pro-preview"
	}
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":generateContent?key=" + url.QueryEscape(cfg.APIKey)
	payload := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]any{
			"temperature": 0.4,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: timeout}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Gemini API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 300))
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	candidates, _ := parsed["candidates"].([]any)
	if len(candidates) == 0 {
		return "", fmt.Errorf("Gemini 응답 후보가 없습니다")
	}
	first, _ := candidates[0].(map[string]any)
	content, _ := first["content"].(map[string]any)
	parts, _ := content["parts"].([]any)
	for _, part := range parts {
		partMap, _ := part.(map[string]any)
		if text := strings.TrimSpace(stringify(partMap["text"])); text != "" {
			return text, nil
		}
	}
	return "", fmt.Errorf("Gemini 텍스트 응답이 비어 있습니다")
}

func extractJSONObject(text string) string {
	return extractBalancedJSON(text, '{', '}')
}

func extractJSONArray(text string) string {
	return extractBalancedJSON(text, '[', ']')
}

func extractBalancedJSON(text string, openCh rune, closeCh rune) string {
	start := -1
	depth := 0
	inString := false
	escaped := false
	for idx, ch := range text {
		if start == -1 {
			if ch == openCh {
				start = idx
				depth = 1
			}
			continue
		}
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}
		if ch == '"' {
			inString = true
			continue
		}
		if ch == openCh {
			depth++
			continue
		}
		if ch == closeCh {
			depth--
			if depth == 0 {
				return text[start : idx+1]
			}
		}
	}
	return ""
}

func (s *Service) openDB() (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(s.dbPath), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", s.dbPath)
	if err != nil {
		return nil, err
	}
	if err := ensurePostsTable(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func (s *Service) getSetting(key, fallback string) string {
	db, err := s.openDB()
	if err != nil {
		return fallback
	}
	defer db.Close()
	if err := ensureSettingsTable(db); err != nil {
		return fallback
	}
	var value string
	if err := db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value); err != nil {
		return fallback
	}
	return value
}

func (s *Service) saveGeneratedBlog(keyword, title, content string, charCount int, keywordCount int, model string, scrapedTexts []string) (int64, error) {
	db, err := s.openDB()
	if err != nil {
		return 0, err
	}
	defer db.Close()
	keywordDensity := 0.0
	if charCount > 0 {
		keywordDensity = (float64(keywordCount) / float64(charCount)) * 100
	}
	contentHash := regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(fmt.Sprintf("%x", title+content), "")
	if len(contentHash) > 12 {
		contentHash = contentHash[:12]
	}
	result, err := db.Exec(
		`INSERT INTO posts (keyword, title, content, char_count, keyword_density, status, trend_score, source_count, model_used, content_hash)
		 VALUES (?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?)`,
		keyword,
		title,
		content,
		charCount,
		keywordDensity,
		len(scrapedTexts),
		model,
		contentHash,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func nestedString(root map[string]any, path ...string) string {
	if len(path) == 0 {
		return ""
	}
	current := any(root)
	for _, key := range path {
		m, ok := current.(map[string]any)
		if !ok {
			return ""
		}
		next, exists := m[key]
		if !exists {
			return ""
		}
		current = next
	}
	return strings.TrimSpace(stringify(current))
}

func fallbackText(value, fallback string) string {
	text := strings.TrimSpace(value)
	if text == "" {
		return fallback
	}
	return text
}

func ensurePostsTable(db *sql.DB) error {
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			keyword TEXT NOT NULL,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			char_count INTEGER DEFAULT 0,
			keyword_density REAL DEFAULT 0,
			status TEXT DEFAULT 'draft',
			published_at TEXT,
			created_at TEXT DEFAULT (datetime('now', 'localtime')),
			trend_score INTEGER DEFAULT 0,
			source_count INTEGER DEFAULT 0,
			model_used TEXT DEFAULT '',
			content_hash TEXT DEFAULT '',
			tags TEXT DEFAULT ''
		)
	`); err != nil {
		return err
	}
	return nil
}

func tableExists(db *sql.DB, name string) bool {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?`, name).Scan(&count); err != nil {
		return false
	}
	return count > 0
}

func ensureSettingsTable(db *sql.DB) error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	return err
}

func intFromAny(value any) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case string:
		parsed, _ := strconv.Atoi(strings.TrimSpace(v))
		return parsed
	default:
		return 0
	}
}

func boolFromAny(value any) bool {
	switch v := value.(type) {
	case bool:
		return v
	case int:
		return v != 0
	case int64:
		return v != 0
	case float64:
		return v != 0
	case string:
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "1", "true", "yes", "y", "on":
			return true
		default:
			return false
		}
	default:
		return false
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
