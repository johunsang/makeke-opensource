package httpserver

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestParseHyperframesScenarioScenesWrappedObject(t *testing.T) {
	scenes, err := parseHyperframesScenarioScenes(`{"scenes":[{"role":"hook","image_prompt":"제품 사용 장면","cut_plan":"느린 push-in"}]}`)
	if err != nil {
		t.Fatalf("parseHyperframesScenarioScenes returned error: %v", err)
	}
	if len(scenes) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(scenes))
	}
	if scenes[0].ImagePrompt == "" {
		t.Fatal("expected image_prompt-only scene to be preserved")
	}
}

func TestParseHyperframesScenarioScenesNestedObjectItems(t *testing.T) {
	raw := `{"storyboard_meta":{"creative_field":{"name":"오렌지 반전"}},"scenes":{"items":[{"role":"hook","title":"정지","image_prompt":"제품 사용 장면","cut_plan":"whip-pan"}]}}`
	scenes, err := parseHyperframesScenarioScenes(raw)
	if err != nil {
		t.Fatalf("parseHyperframesScenarioScenes returned error: %v", err)
	}
	if len(scenes) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(scenes))
	}
	if scenes[0].Title != "정지" {
		t.Fatalf("expected nested scene title to be preserved, got %q", scenes[0].Title)
	}
}

func TestParseHyperframesScenarioScenesNumberedObject(t *testing.T) {
	raw := `{"scenes":{"scene_2":{"title":"두번째","image_prompt":"두번째 장면","cut_plan":"orbit"},"scene_1":{"title":"첫번째","image_prompt":"첫번째 장면","cut_plan":"handheld macro"}}}`
	scenes, err := parseHyperframesScenarioScenes(raw)
	if err != nil {
		t.Fatalf("parseHyperframesScenarioScenes returned error: %v", err)
	}
	if len(scenes) != 2 {
		t.Fatalf("expected 2 scenes, got %d", len(scenes))
	}
	if scenes[0].Title != "첫번째" || scenes[1].Title != "두번째" {
		t.Fatalf("expected numbered object scenes to be sorted, got %#v", scenes)
	}
}

func TestParseHyperframesScenarioScenesStoryboardWrapper(t *testing.T) {
	raw := `{"storyboard":{"scenes":[{"title":"랩핑","image_prompt":"랩핑 장면","cut_plan":"rack focus"}]}}`
	scenes, err := parseHyperframesScenarioScenes(raw)
	if err != nil {
		t.Fatalf("parseHyperframesScenarioScenes returned error: %v", err)
	}
	if len(scenes) != 1 || scenes[0].Title != "랩핑" {
		t.Fatalf("expected storyboard wrapper scene, got %#v", scenes)
	}
}

func TestParseHyperframesScenarioScenesAliasFields(t *testing.T) {
	raw := `{"scenario":{"segments":[{"scene_title":"첫 장면","scene_description":"오렌지가 화면을 밀고 들어온다","visual_prompt":"orange SaaS mascot in cinematic office","shot_plan":"whip-pan reveal","camera_movement":"fast whip-pan","shots":[{"cut_title":"훅 컷","movement":"오렌지가 튀어나온다","visual_prompt":"orange object jump cut","motion_prompt":"quick impact"}]}]}}`
	scenes, err := parseHyperframesScenarioScenes(raw)
	if err != nil {
		t.Fatalf("parseHyperframesScenarioScenes returned error: %v", err)
	}
	if len(scenes) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(scenes))
	}
	if scenes[0].Title != "첫 장면" {
		t.Fatalf("expected alias title to be mapped, got %q", scenes[0].Title)
	}
	if scenes[0].ImagePrompt == "" || scenes[0].Camera == "" {
		t.Fatalf("expected alias image/camera fields to be mapped, got %#v", scenes[0])
	}
	if len(scenes[0].MicroCuts) != 1 || scenes[0].MicroCuts[0]["title"] != "훅 컷" {
		t.Fatalf("expected aliased shots to become micro cuts, got %#v", scenes[0].MicroCuts)
	}
}

func TestParseHyperframesScenarioScenesDirectArray(t *testing.T) {
	scenes, err := parseHyperframesScenarioScenes(`[{"role":"hook","image_prompt":"제품 사용 장면","cut_plan":"느린 push-in"}]`)
	if err != nil {
		t.Fatalf("parseHyperframesScenarioScenes returned error: %v", err)
	}
	if len(scenes) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(scenes))
	}
}

func TestParseHyperframesScenarioScenesStripsFencesAndTrailingText(t *testing.T) {
	scenes, err := parseHyperframesScenarioScenes("```json\n{\"scenes\":[{\"title\":\"후크\",\"body\":\"문제 시작\",\"narration\":\"멈춰 보게 합니다.\",\"image_prompt\":\"시네마틱 제품 장면\",\"micro_cuts\":[{\"title\":\"컷\"},{\"title\":\"컷\"},{\"title\":\"컷\"},{\"title\":\"컷\"},{\"title\":\"컷\"}]}]}\n```\n추가 설명")
	if err != nil {
		t.Fatalf("parseHyperframesScenarioScenes returned error: %v", err)
	}
	if len(scenes) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(scenes))
	}
}

func TestScenarioPlanParseErrorDetailExplainsTruncatedJSON(t *testing.T) {
	detail := scenarioPlanParseErrorDetail(io.ErrUnexpectedEOF, `{"scenes":[`)
	if !strings.Contains(detail, "중간에 끊겼습니다") {
		t.Fatalf("expected Korean truncated JSON explanation, got %q", detail)
	}
}

func TestNormalizeHyperframesWritingProviderCLI(t *testing.T) {
	for _, input := range []string{"codex-cli", "Codex CLI", "kimi-cli"} {
		if got := normalizeHyperframesWritingProvider(input); got != "cli" {
			t.Fatalf("expected %q to normalize to cli, got %q", input, got)
		}
	}
}

func TestNormalizeHyperframesScenarioScenesDoesNotInventFallback(t *testing.T) {
	req := hyperframesScenarioPlanRequest{
		Topic:     "마케케 AI 콘텐츠 자동화",
		Objective: "앱 설치/가입 유도",
		CTA:       "상담 문의",
		KeyPoints: []string{"하루 3포스트 자동 생성"},
	}
	scenes := normalizeHyperframesScenarioScenes(nil, req, 2)
	if len(scenes) != 0 {
		t.Fatalf("expected no invented fallback scenes, got %d", len(scenes))
	}
}

func TestNormalizeAtlasImageVideoDuration(t *testing.T) {
	if got := normalizeAtlasImageVideoModel("bytedance/seedance-2.0/image-to-video"); got != atlasDefaultKlingImageVideoModel {
		t.Fatalf("expected legacy Seedance to migrate to latest Kling model, got %q", got)
	}
	if got := normalizeAtlasImageVideoModel(""); got != atlasDefaultKlingImageVideoModel {
		t.Fatalf("expected empty video model to default to latest Kling model, got %q", got)
	}
	if got := normalizeAtlasImageVideoDuration("bytedance/seedance-2.0/image-to-video", 2.5); got != 5 {
		t.Fatalf("expected Seedance short clip to snap to 5s, got %v", got)
	}
	if got := normalizeAtlasImageVideoDuration("bytedance/seedance-2.0/image-to-video", 9); got != 10 {
		t.Fatalf("expected Seedance mid clip to snap to 10s, got %v", got)
	}
	if got := normalizeAtlasImageVideoDuration("atlascloud/wan-2.2-turbo-spicy/image-to-video", 7); got != 8 {
		t.Fatalf("expected Wan clip to keep 5/8s schema, got %v", got)
	}
}

func TestCompactAtlasImageVideoPromptFitsAtlasKlingLimit(t *testing.T) {
	raw := strings.Repeat("영상 움직임 지시: 브랜드 소스와 모델 reference를 유지하고 자연스러운 카메라 흔들림만 추가합니다. ", 140)
	prompt := compactAtlasImageVideoPrompt(raw)
	if len([]byte(prompt)) > atlasImageVideoPromptMaxBytes {
		t.Fatalf("expected prompt to fit Atlas Kling limit, got %d bytes", len([]byte(prompt)))
	}
	if !strings.Contains(prompt, "영상 움직임 지시") {
		t.Fatalf("expected compact prompt to preserve leading instruction, got %q", prompt)
	}
}

func TestNormalizeHyperframesScenarioScenesEnforcesNoTextImagePrompt(t *testing.T) {
	req := hyperframesScenarioPlanRequest{CTA: "상담 문의"}
	scenes := normalizeHyperframesScenarioScenes([]hyperframesScenarioScene{{
		Role:        "hook",
		Title:       "자동화",
		Narration:   "콘텐츠 자동화를 보여줍니다.",
		ImagePrompt: "A clean app UI dashboard on a tablet",
	}}, req, 1)
	if len(scenes) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(scenes))
	}
	if !regexp.MustCompile(`글자|UI 문구|텍스트 없는`).MatchString(scenes[0].ImagePrompt) {
		t.Fatalf("expected no-text guard in image prompt, got %q", scenes[0].ImagePrompt)
	}
}

func TestScenarioScenesMissingSurfaceFieldsCatchesIncompleteScene(t *testing.T) {
	missing := scenarioScenesMissingSurfaceFields([]hyperframesScenarioScene{{
		Role:        "hook",
		ImagePrompt: "제품 사용 장면",
	}}, 1, hyperframesScenarioPlanRequest{})
	if len(missing) == 0 {
		t.Fatal("expected missing title/body/narration to be reported")
	}
	joined := strings.Join(missing, " ")
	for _, want := range []string{"title", "body", "narration"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("expected missing summary to include %q, got %q", want, joined)
		}
	}
}

func TestNormalizeHyperframesScenarioScenesFillsSurfaceFieldsFromProductionPlan(t *testing.T) {
	req := hyperframesScenarioPlanRequest{
		Topic:     "마케케",
		Objective: "상담 문의",
		Tone:      "전문적인 SaaS 광고",
		Source:    "하루 3포스트, 113개 문체, 브랜드 디자인 규칙",
	}
	scenes := normalizeHyperframesScenarioScenes([]hyperframesScenarioScene{{
		Role:          "proof",
		Title:         "숫자로 증명",
		Narration:     "마케케는 하루 3포스트와 113개 문체로 반복 업무를 줄입니다.",
		SubjectAction: "대시보드 위에서 생성 결과와 문체 카드가 흐르듯 정리되는 장면",
		Camera:        "느린 push-in",
		Lighting:      "밝고 선명한 SaaS 스튜디오 조명",
		ArtDirection:  "앱 기본 강조색과 파란색 포인트의 모듈형 업무 공간",
	}}, req, 1)
	if len(scenes) != 1 {
		t.Fatalf("expected one scene, got %d", len(scenes))
	}
	if missing := scenarioScenesMissingSurfaceFields(scenes, 1, req); len(missing) > 0 {
		t.Fatalf("expected production fields to fill required surface fields, got %v / %#v", missing, scenes[0])
	}
	if !strings.Contains(scenes[0].ImagePrompt, "대시보드") {
		t.Fatalf("expected image prompt to include production details, got %q", scenes[0].ImagePrompt)
	}
}

func TestBuildHyperframesBackgroundImagePromptHardensMockupText(t *testing.T) {
	prompt := buildHyperframesBackgroundImagePrompt(hyperframesBackgroundImageRequest{
		Aspect:     "9:16",
		Topic:      "마케케 AI 콘텐츠 자동화",
		Objective:  "앱 설치/가입 유도",
		SceneTitle: "앱 화면",
		Prompt:     "A clean Makeke app UI dashboard mockup on a tablet with text on screen",
	})
	for _, want := range []string{
		"글자 없는",
		"가짜 브랜드명",
		"앱 화면, 대시보드",
		"텍스트 없는 추상 인터페이스",
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to contain %q, got:\n%s", want, prompt)
		}
	}
	if strings.Contains(prompt, "Makeke app UI dashboard mockup") {
		t.Fatalf("expected raw readable UI mockup phrase to be cleaned, got:\n%s", prompt)
	}
}

func TestFitNarrationScriptToDurationShortensFifteenSecondScript(t *testing.T) {
	req := hyperframesNarrationScriptRequest{Duration: 15}
	script := strings.Join([]string{
		"매일 쏟아지는 마케팅 업무, 마케케가 해결해 드립니다.",
		"113가지 문체를 학습해 하루 3개의 포스트를 자동으로 생성하고, 모든 채널의 브랜딩까지 하나의 규칙으로 통일하세요.",
		"전문적이고 효율적인 마케팅, 지금 바로 마케케에 상담 문의하세요.",
	}, "\n")
	fitted := fitNarrationScriptToDuration(req, script)
	if estimateNarrationDuration(fitted) > 15*0.84+0.01 {
		t.Fatalf("expected fitted narration to stay within 15s budget, got %.2fs: %q", estimateNarrationDuration(fitted), fitted)
	}
	if estimateNarrationDuration(fitted) < 15*0.48 {
		t.Fatalf("expected fitted narration not to collapse below minimum, got %.2fs: %q", estimateNarrationDuration(fitted), fitted)
	}
	if len([]rune(fitted)) >= len([]rune(script)) {
		t.Fatalf("expected narration to be shortened, got %q", fitted)
	}
}

func TestNarrationScriptExpansionFillsThirtySecondBudget(t *testing.T) {
	req := hyperframesNarrationScriptRequest{
		Topic:    "마케케",
		Duration: 30,
		CTA:      "상담 문의",
	}
	short := "마케케는 반복되는 마케팅 업무를 줄여줍니다.\n브랜드 규칙에 맞춰 콘텐츠를 완성합니다."
	expanded := fitNarrationScriptToDuration(req, sanitizeNarrationScript(expandNarrationScriptForDuration(req, short, []string{
		"하루 3포스트 자동 생성",
		"113개 문체와 프로필 디자인 규칙 반영",
	}, []string{"로고 reference 유지", "HyperFrames 모션 합성"})))
	got := estimateNarrationDuration(expanded)
	if got < 30*0.72 {
		t.Fatalf("expected 30s narration to fill most of the budget, got %.2fs: %q", got, expanded)
	}
	if got > 30*0.94+0.01 {
		t.Fatalf("expected 30s narration to stay under max budget, got %.2fs: %q", got, expanded)
	}
}

func TestExpectedScenarioSceneCountMatchesShortAdTiming(t *testing.T) {
	cases := []struct {
		duration float64
		want     int
	}{
		{duration: 15, want: 2},
		{duration: 30, want: 4},
		{duration: 45, want: 5},
		{duration: 60, want: 6},
	}
	for _, tt := range cases {
		if got := expectedScenarioSceneCount(tt.duration); got != tt.want {
			t.Fatalf("expected %.0fs to use %d scenes, got %d", tt.duration, tt.want, got)
		}
	}
}

func TestNormalizeScenarioScenesKeepsLastCTAWhenCompressing(t *testing.T) {
	scenes := []hyperframesScenarioScene{
		{Title: "후크", Body: "처음 문제", Narration: "처음 문제를 말합니다.", ImagePrompt: "첫 장면 배경 이미지 프롬프트입니다."},
		{Title: "중간", Body: "중간 설명", Narration: "중간 설명입니다.", ImagePrompt: "중간 장면 배경 이미지 프롬프트입니다."},
		{Title: "증거", Body: "증거 설명", Narration: "증거 설명입니다.", ImagePrompt: "증거 장면 배경 이미지 프롬프트입니다."},
		{Title: "해결", Body: "해결 설명", Narration: "해결 설명입니다.", ImagePrompt: "해결 장면 배경 이미지 프롬프트입니다."},
		{Title: "오늘 저녁 9시", Body: "줌에서 만나요", Narration: "오늘 저녁 9시 줌에서 만나요.", ImagePrompt: "마지막 CTA 배경 이미지 프롬프트입니다."},
	}
	req := hyperframesScenarioPlanRequest{CTA: "오늘 저녁 9시 줌에서 만나요"}
	normalized := normalizeHyperframesScenarioScenes(scenes, req, 2)
	if len(normalized) != 2 {
		t.Fatalf("expected 2 scenes, got %d", len(normalized))
	}
	if normalized[0].Title != "후크" {
		t.Fatalf("expected first hook scene to remain, got %q", normalized[0].Title)
	}
	if normalized[1].Title != "오늘 저녁 9시" {
		t.Fatalf("expected last CTA scene to remain, got %q", normalized[1].Title)
	}
}

func TestAtlasGPTImage2OptionsMatchAspect(t *testing.T) {
	payload := map[string]any{}
	applyAtlasImageModelOptions(payload, "openai/gpt-image-2-developer/text-to-image", "16:9")
	if payload["size"] != "1536x1024" {
		t.Fatalf("expected OpenAI image size for 16:9, got %#v", payload["size"])
	}
	if payload["quality"] != "high" || payload["output_format"] != "png" || payload["n"] != 1 {
		t.Fatalf("expected GPT image options, got %#v", payload)
	}
}

func TestParseAtlasImageGenerateResponseFindsNestedOutputs(t *testing.T) {
	raw := []byte(`{"data":{"prediction_id":"pred_123","result":{"images":[{"url":"https://cdn.example.com/out.png"}]}}}`)
	id, output, err := parseAtlasImageGenerateResponse(raw)
	if err != nil {
		t.Fatalf("parseAtlasImageGenerateResponse returned error: %v", err)
	}
	if id != "pred_123" {
		t.Fatalf("expected prediction id, got %q", id)
	}
	if output != "https://cdn.example.com/out.png" {
		t.Fatalf("expected nested output URL, got %q", output)
	}
}

func TestCropImageToAspectConvertsSquareToLandscape(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 1024, 1024))
	for y := 0; y < 1024; y++ {
		for x := 0; x < 1024; x++ {
			img.Set(x, y, color.RGBA{R: 240, G: 120, B: 20, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("png encode failed: %v", err)
	}
	cropped, err := cropImageToAspect(buf.Bytes(), "16:9")
	if err != nil {
		t.Fatalf("cropImageToAspect returned error: %v", err)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(cropped))
	if err != nil {
		t.Fatalf("decode cropped image failed: %v", err)
	}
	if cfg.Width <= cfg.Height {
		t.Fatalf("expected landscape cropped image, got %dx%d", cfg.Width, cfg.Height)
	}
	if err := validateGeneratedImageAspect(cropped, "16:9"); err != nil {
		t.Fatalf("expected cropped image to validate: %v", err)
	}
}

func TestEnsureTimedMediaIDsAddsMissingAudioID(t *testing.T) {
	html := `<audio data-start="0" data-duration="3" src="voice.wav"></audio><video id="kept" data-start="0" src="v.mp4"></video>`
	fixed := ensureTimedMediaIDs(html)
	if !strings.Contains(fixed, `audio id="hf-audio-01"`) {
		t.Fatalf("expected missing audio id to be added, got %s", fixed)
	}
	if !strings.Contains(fixed, `video id="kept"`) {
		t.Fatalf("expected existing video id to be preserved, got %s", fixed)
	}
}

func TestNormalizeHyperframesAudioDurationsUsesActualWAVLength(t *testing.T) {
	projectDir := t.TempDir()
	audioDir := filepath.Join(projectDir, "assets", "audio")
	if err := os.MkdirAll(audioDir, 0o755); err != nil {
		t.Fatalf("failed to create audio dir: %v", err)
	}
	pcm := make([]byte, 24000*2*3)
	if err := writePCM16WAV(filepath.Join(audioDir, "voice.wav"), pcm, 24000); err != nil {
		t.Fatalf("failed to write wav: %v", err)
	}
	html := `<audio id="voice" data-start="0" data-duration="1" src="assets/audio/voice.wav"></audio>`
	fixed := (&Server{}).normalizeHyperframesAudioDurations(html, projectDir)
	if !strings.Contains(fixed, `data-duration="3"`) {
		t.Fatalf("expected data-duration to be corrected to actual wav duration, got %s", fixed)
	}
}

func TestNormalizeHyperframesAudioDurationsKeepsIntentionalMediaStartClip(t *testing.T) {
	projectDir := t.TempDir()
	audioDir := filepath.Join(projectDir, "assets", "audio")
	if err := os.MkdirAll(audioDir, 0o755); err != nil {
		t.Fatalf("failed to create audio dir: %v", err)
	}
	pcm := make([]byte, 24000*2*4)
	if err := writePCM16WAV(filepath.Join(audioDir, "bgm.wav"), pcm, 24000); err != nil {
		t.Fatalf("failed to write wav: %v", err)
	}
	html := `<audio id="bgm-2" data-start="4" data-media-start="0" data-duration="1.5" src="assets/audio/bgm.wav"></audio>`
	fixed := (&Server{}).normalizeHyperframesAudioDurations(html, projectDir)
	if !strings.Contains(fixed, `data-duration="1.5"`) {
		t.Fatalf("expected intentional clipped BGM duration to be preserved, got %s", fixed)
	}
}
