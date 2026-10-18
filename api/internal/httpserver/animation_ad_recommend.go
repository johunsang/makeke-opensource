package httpserver

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type animationAdBriefRecommendRequest struct {
	Topic             string         `json:"topic"`
	Objective         string         `json:"objective"`
	Tone              string         `json:"tone"`
	CTA               string         `json:"cta"`
	Duration          int            `json:"duration"`
	SceneCount        int            `json:"scene_count"`
	Aspect            string         `json:"aspect"`
	ProductionMode    any            `json:"production_mode"`
	ProfileContext    map[string]any `json:"profile_context"`
	ProfilePrompt     string         `json:"profile_prompt"`
	ReferenceContext  string         `json:"reference_context"`
	BenchmarkURL      string         `json:"benchmark_url"`
	BenchmarkNotes    string         `json:"benchmark_notes"`
	Source            string         `json:"source"`
	StoryArc          map[string]any `json:"story_arc"`
	AttentionHook     map[string]any `json:"attention_hook"`
	SemanticStructure map[string]any `json:"semantic_structure"`
	SuccessOntology   any            `json:"success_ontology"`
	SuccessCases      any            `json:"success_cases"`
	ExceptionRule     map[string]any `json:"exception_rule"`
	CreativityRule    map[string]any `json:"creativity_rule"`
	PlatformPlaybook  map[string]any `json:"platform_playbook"`
	HookRecipe        map[string]any `json:"hook_recipe"`
	Model             string         `json:"model"`
}

type animationAdBriefPackDetail struct {
	Target          string   `json:"target"`
	Hook            string   `json:"hook"`
	Problem         string   `json:"problem"`
	Proof           string   `json:"proof"`
	Offer           string   `json:"offer"`
	Scenes          []string `json:"scenes"`
	Visual          string   `json:"visual"`
	Sound           string   `json:"sound"`
	Overlay         string   `json:"overlay"`
	Avoid           string   `json:"avoid"`
	PurpleCow       string   `json:"purple_cow"`
	ExceptionRule   string   `json:"exception_rule"`
	Plausibility    string   `json:"plausibility"`
	Creativity      string   `json:"creativity"`
	EmotionalAppeal string   `json:"emotional_appeal"`
	ContagiousRule  string   `json:"contagious_rule"`
	SuccessFormula  string   `json:"success_formula"`
	OntologyTrace   string   `json:"ontology_trace"`
	SelectionReason string   `json:"selection_reason"`
}

type animationAdBriefPack struct {
	Value            string                     `json:"value"`
	Label            string                     `json:"label"`
	Topic            string                     `json:"topic"`
	Objective        string                     `json:"objective"`
	Tone             string                     `json:"tone"`
	CTA              string                     `json:"cta"`
	Duration         int                        `json:"duration"`
	Scenes           int                        `json:"scenes"`
	Style            string                     `json:"style"`
	VFX              string                     `json:"vfx"`
	Source           string                     `json:"source"`
	StoryArc         string                     `json:"story_arc"`
	AttentionHook    string                     `json:"attention_hook"`
	HookRecipe       string                     `json:"hook_recipe"`
	PlatformPlaybook string                     `json:"platform_playbook"`
	PersonaType      string                     `json:"persona_type"`
	Detail           animationAdBriefPackDetail `json:"detail"`
}

func (s *Server) handleAnimationAdRecommendBriefPacks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req animationAdBriefRecommendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request json", "detail": "광고 컨셉 생성 요청 데이터가 깨졌습니다. 화면을 새로고침한 뒤 다시 시도해주세요."})
		return
	}

	targets, targetErr := s.resolveHyperframesWritingPromptTargets(req.Model)
	if targetErr != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing writing model key", "detail": targetErr.Error()})
		return
	}

	prompt, err := buildAnimationAdBriefRecommendPrompt(req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	var text string
	var usedModel string
	var lastErr error
	for idx, target := range targets {
		timeout := 180 * time.Second
		if idx > 0 {
			timeout = 150 * time.Second
		}
		if target.Provider == "atlas" {
			timeout = 75 * time.Second
		}
		if target.Provider == "codex" {
			timeout = 240 * time.Second
		}
		text, lastErr = s.runHyperframesWritingDesignPrompt(prompt, target, timeout)
		if lastErr == nil {
			usedModel = target.Model
			break
		}
		if !isTransientGeminiMotionError(lastErr) {
			break
		}
	}
	if lastErr != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "brief pack generation failed", "detail": safeExternalErrorDetail(lastErr)})
		return
	}

	items, err := parseAnimationAdBriefPacks(text, req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "brief pack parse failed", "detail": err.Error(), "raw": truncate(text, 1200)})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"model":        usedModel,
		"generated_at": time.Now().Format(time.RFC3339),
		"items":        items,
	})
}

func buildAnimationAdBriefRecommendPrompt(req animationAdBriefRecommendRequest) (string, error) {
	profileJSON, err := json.MarshalIndent(req.ProfileContext, "", "  ")
	if err != nil {
		return "", fmt.Errorf("invalid profile context")
	}
	contextJSON, err := json.MarshalIndent(map[string]any{
		"story_arc":          req.StoryArc,
		"attention_hook":     req.AttentionHook,
		"semantic_structure": req.SemanticStructure,
		"success_ontology":   req.SuccessOntology,
		"success_cases":      req.SuccessCases,
		"exception_rule":     req.ExceptionRule,
		"creativity_rule":    req.CreativityRule,
		"platform_playbook":  req.PlatformPlaybook,
		"hook_recipe":        req.HookRecipe,
	}, "", "  ")
	if err != nil {
		return "", fmt.Errorf("invalid creative context")
	}
	productionMode := animationAdAnyString(req.ProductionMode, "production_mode", "value", "label")
	return fmt.Sprintf(`너는 세계 최고 수준의 릴스/쇼츠 광고 크리에이티브 디렉터다.
지금 단계가 가장 중요하다. 아래 브랜드 프로필을 보고 1분 이하 쇼츠 광고의 출발점이 될 광고 세트 3개를 새로 발명하라.

절대 규칙:
- 기존 템플릿, 고정 업종 카드, 뻔한 "제품 좋다"식 설명을 고르지 않는다.
- 광고처럼 보이지 않는 네이티브 쇼츠/릴스 사건으로 시작한다.
- 중간 자막, 나레이션, 가격/혜택 문구, 로고 인트로를 쓰지 않는다.
- 마지막 컷에만 브랜드 기억을 남긴다.
- 각 후보는 퍼플카우, 예외성, 개연성, 창조성을 모두 가져야 한다.
- 각 후보는 감정호소를 반드시 가져야 한다. 웃음, 놀람, 긴장, 질투, 욕망, 안도, 귀여움, 해방감, 수치심 회피, 소속감 중 어떤 감정을 누를지 명시한다.
- 각 후보는 전략적 입소문 6원리(STEPPS)를 적용해야 한다. 소셜 화폐, 계기, 감정, 공개성, 실용적 가치, 이야기 중 최소 2개 이상을 선택하고 왜 공유될지 설명한다.
- 각 후보는 성공 방정식 온톨로지를 반드시 통과해야 한다. 첫 정지 프레임 훅, 감정 급전환, 개연성 있는 이상함, 광고 아닌 척 사건, 제품 진실 다리, 기억 앵커, 공유 트리거, 컷 리듬 상승 중 현재 브랜드에 맞는 조합을 고르고 추론 경로를 남긴다.
- 예외성은 이상하기만 하면 실패다. 브랜드/상품/고객 문제와 의미적으로 연결되어야 한다.
- 개연성은 "왜 이 이상한 장면이 이 브랜드에서 가능한가"를 설명해야 한다.
- 창조성은 서로 먼 의미 두 개 이상을 브랜드 진실로 연결해야 한다.
- 감정호소는 팩트 설명보다 먼저 와야 한다. 기능/장점/수치는 인물의 반응, 손동작, 표정, 실패, 작은 승리, 감각적 장면으로 번역한다.
- 성적이거나 자극적인 방향은 노골적 표현 없이 조명, 질감, 시선, 속도, 리액션, 코미디, 긴장감으로 안전하게 만든다.
- 반환은 JSON만 한다. 설명 문장, markdown, 코드블록을 쓰지 않는다.

반환 스키마:
[
  {
    "value": "ai-generated-unique-slug",
    "label": "짧고 기억나는 한국어 컨셉명",
    "topic": "광고 주제",
    "objective": "광고 목표",
    "tone": "톤",
    "cta": "마지막 행동",
    "duration": 30 또는 60,
    "scenes": 4~12 숫자,
    "style": "world-class-commercial | cinematic-live-action | hybrid-vfx-commercial 중 하나",
    "vfx": "cinematic-light-sweep | hologram-scan | prism-burst | glitch-snap | liquid-morph | spark-impact 중 하나",
    "source": "광고 콘티 생성에 들어갈 상세 브리프",
    "story_arc": "native-shorts-story | problem-thriller | human-mini-drama | sensory-product-film | social-proof-docu | cinematic-trailer 중 하나",
    "attention_hook": "purple-cow | story-brain | comedy-twist | sensual-premium | provocative-challenge | cinematic-tension 중 하나",
    "hook_recipe": "first-frame-shock | problem-open-loop | before-after-satisfaction | creator-reaction | sound-hit-transition | loop-reversal 중 하나",
    "platform_playbook": "native-hook-shorts",
    "persona_type": "brand-creator | product-as-hero | customer-witness | mascot-character | signature-model 중 하나",
    "detail": {
      "target": "구체 타깃",
      "hook": "첫 1초 화면",
      "problem": "고객 문제",
      "proof": "증거가 되는 장면",
      "offer": "마지막 행동",
      "scenes": ["씬 1", "씬 2", "씬 3", "씬 4"],
      "visual": "화면 톤과 카메라",
      "sound": "영상 API가 만들 BGM/SFX 방향",
      "overlay": "마지막 브랜드만 남기는 방식",
      "avoid": "금지",
      "purple_cow": "보는 사람이 멈추는 이상한 소",
      "exception_rule": "예외성 규칙",
      "plausibility": "브랜드/상품과 연결되는 개연성",
      "creativity": "낯선 의미 연결",
      "emotional_appeal": "누를 감정과 그 감정을 만드는 장면",
      "contagious_rule": "전략적 입소문 6원리 중 선택한 원리와 공유 이유",
      "success_formula": "선택한 성공 방정식 노드 조합. 예: 스크롤 정지 이상 신호 -> 감정 급전환 -> 제품 진실 다리 -> 기억 앵커 반복",
      "ontology_trace": "브랜드/소재/고객 문제에서 이 성공 방정식이 왜 작동하는지의 추론 경로",
      "selection_reason": "이 브랜드 프로필에 추천하는 이유"
    }
  }
]

브랜드 프로필:
%s

프로필 텍스트:
%s

사용자 입력:
- 주제: %s
- 목표: %s
- 톤: %s
- CTA: %s
- 길이: %d초
- 씬 수: %d
- 화면비: %s
- 제작 방식: %s
- 벤치마크 URL: %s
- 벤치마크 메모: %s
- 소재 설명: %s
- 참고 이미지 요약: %s

현재 선택된 창의성/시맨틱 조건:
%s`, string(profileJSON), truncate(req.ProfilePrompt, 2000), fallbackHTTPText(req.Topic, "쇼츠 광고"), fallbackHTTPText(req.Objective, "브랜드 기억과 전환"), fallbackHTTPText(req.Tone, "네이티브 쇼츠 톤"), fallbackHTTPText(req.CTA, "브랜드 확인"), req.Duration, req.SceneCount, fallbackHTTPText(req.Aspect, "9:16"), fallbackHTTPText(productionMode, "animation"), truncate(req.BenchmarkURL, 500), truncate(req.BenchmarkNotes, 1200), truncate(req.Source, 2400), truncate(req.ReferenceContext, 1600), string(contextJSON)), nil
}

func parseAnimationAdBriefPacks(text string, req animationAdBriefRecommendRequest) ([]animationAdBriefPack, error) {
	var lastErr error
	for _, raw := range animationAdBriefJSONCandidates(text) {
		items, err := decodeAnimationAdBriefPackJSON(raw)
		if err != nil {
			lastErr = err
			continue
		}
		normalized, err := normalizeAnimationAdBriefPacks(items, req)
		if err != nil {
			lastErr = err
			continue
		}
		return normalized, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("AI 응답에서 JSON 배열을 찾지 못했습니다")
	}
	return nil, lastErr
}

func decodeAnimationAdBriefPackJSON(raw string) ([]animationAdBriefPack, error) {
	raw = strings.TrimSpace(strings.TrimPrefix(raw, "\ufeff"))
	if raw == "" {
		return nil, fmt.Errorf("empty json")
	}
	var items []animationAdBriefPack
	if err := json.Unmarshal([]byte(raw), &items); err == nil {
		return items, nil
	}
	var generic any
	if err := json.Unmarshal([]byte(raw), &generic); err != nil {
		return nil, err
	}
	items = extractAnimationAdBriefPackItems(generic)
	if len(items) == 0 {
		return nil, fmt.Errorf("AI 응답에서 광고 세트 목록을 찾지 못했습니다")
	}
	return items, nil
}

func normalizeAnimationAdBriefPacks(items []animationAdBriefPack, req animationAdBriefRecommendRequest) ([]animationAdBriefPack, error) {
	const requiredBriefPackCount = 3
	normalized := make([]animationAdBriefPack, 0, requiredBriefPackCount)
	seen := map[string]bool{}
	for index, item := range items {
		item = normalizeAnimationAdBriefPack(item, req, index)
		if item.Label == "" || item.Source == "" {
			continue
		}
		if seen[item.Value] {
			continue
		}
		seen[item.Value] = true
		normalized = append(normalized, item)
		if len(normalized) >= requiredBriefPackCount {
			break
		}
	}
	if len(normalized) < requiredBriefPackCount {
		return nil, fmt.Errorf("AI 추천 광고 세트가 3개보다 적습니다: %d개", len(normalized))
	}
	return normalized, nil
}

func animationAdBriefJSONCandidates(text string) []string {
	raw := strings.TrimSpace(strings.TrimPrefix(text, "\ufeff"))
	candidates := []string{raw}
	if strings.Contains(raw, "```") {
		parts := strings.Split(raw, "```")
		for _, part := range parts {
			part = strings.TrimSpace(part)
			part = strings.TrimPrefix(part, "json")
			part = strings.TrimPrefix(part, "JSON")
			part = strings.TrimSpace(part)
			if part != "" {
				candidates = append(candidates, part)
			}
		}
	}
	candidates = append(candidates, balancedJSONCandidates(raw, '[')...)
	candidates = append(candidates, balancedJSONCandidates(raw, '{')...)
	return uniqueNonEmptyStrings(candidates)
}

func balancedJSONCandidates(raw string, open byte) []string {
	close := byte(']')
	if open == '{' {
		close = '}'
	}
	var out []string
	for start := 0; start < len(raw); start++ {
		if raw[start] != open {
			continue
		}
		depth := 0
		inString := false
		escaped := false
		for i := start; i < len(raw); i++ {
			ch := raw[i]
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
			if ch == open {
				depth++
			}
			if ch == close {
				depth--
				if depth == 0 {
					out = append(out, raw[start:i+1])
					break
				}
			}
		}
	}
	return out
}

func normalizeAnimationAdBriefPack(item animationAdBriefPack, req animationAdBriefRecommendRequest, index int) animationAdBriefPack {
	item.Label = truncate(strings.TrimSpace(item.Label), 80)
	if item.Label == "" {
		item.Label = truncate(firstNonEmpty(item.Detail.Hook, item.Detail.PurpleCow, item.Source), 80)
	}
	item.Value = strings.TrimSpace(item.Value)
	if item.Value == "" {
		item.Value = fmt.Sprintf("ai-brief-%02d", index+1)
	}
	item.Value = slugifyAnimationAdBriefValue(item.Value)
	if item.Value == "" {
		item.Value = fmt.Sprintf("ai-brief-%02d", index+1)
	}
	item.Topic = truncate(firstNonEmpty(item.Topic, req.Topic, item.Label), 220)
	item.Objective = truncate(firstNonEmpty(item.Objective, req.Objective, "브랜드 기억과 전환"), 220)
	item.Tone = truncate(firstNonEmpty(item.Tone, req.Tone, "네이티브 쇼츠 톤"), 160)
	item.CTA = truncate(firstNonEmpty(item.CTA, req.CTA, "브랜드 확인"), 120)
	if item.Duration != 30 && item.Duration != 60 {
		if req.Duration == 60 {
			item.Duration = 60
		} else {
			item.Duration = 30
		}
	}
	if item.Scenes < 4 || item.Scenes > 12 {
		item.Scenes = req.SceneCount
		if item.Scenes < 4 || item.Scenes > 12 {
			item.Scenes = 8
		}
	}
	item.Style = firstNonEmpty(item.Style, "world-class-commercial")
	item.VFX = firstNonEmpty(item.VFX, "cinematic-light-sweep")
	item.StoryArc = firstNonEmpty(item.StoryArc, "native-shorts-story")
	item.AttentionHook = firstNonEmpty(item.AttentionHook, "purple-cow")
	item.HookRecipe = firstNonEmpty(item.HookRecipe, "first-frame-shock")
	item.PlatformPlaybook = firstNonEmpty(item.PlatformPlaybook, "native-hook-shorts")
	item.PersonaType = firstNonEmpty(item.PersonaType, "brand-creator")
	item.Source = truncate(strings.TrimSpace(firstNonEmpty(item.Source, strings.Join([]string{
		item.Detail.Hook,
		item.Detail.Problem,
		item.Detail.Proof,
		item.Detail.PurpleCow,
		item.Detail.EmotionalAppeal,
		item.Detail.SuccessFormula,
	}, "\n"))), 2400)
	item.Detail.Target = truncate(strings.TrimSpace(item.Detail.Target), 500)
	item.Detail.Hook = truncate(strings.TrimSpace(item.Detail.Hook), 500)
	item.Detail.Problem = truncate(strings.TrimSpace(item.Detail.Problem), 500)
	item.Detail.Proof = truncate(strings.TrimSpace(item.Detail.Proof), 500)
	item.Detail.Offer = truncate(strings.TrimSpace(item.Detail.Offer), 500)
	item.Detail.Visual = truncate(strings.TrimSpace(item.Detail.Visual), 700)
	item.Detail.Sound = truncate(strings.TrimSpace(item.Detail.Sound), 700)
	item.Detail.Overlay = truncate(strings.TrimSpace(item.Detail.Overlay), 500)
	item.Detail.Avoid = truncate(strings.TrimSpace(item.Detail.Avoid), 700)
	item.Detail.PurpleCow = truncate(strings.TrimSpace(item.Detail.PurpleCow), 700)
	item.Detail.ExceptionRule = truncate(strings.TrimSpace(item.Detail.ExceptionRule), 700)
	item.Detail.Plausibility = truncate(strings.TrimSpace(item.Detail.Plausibility), 700)
	item.Detail.Creativity = truncate(strings.TrimSpace(item.Detail.Creativity), 700)
	item.Detail.EmotionalAppeal = truncate(strings.TrimSpace(item.Detail.EmotionalAppeal), 700)
	item.Detail.ContagiousRule = truncate(strings.TrimSpace(item.Detail.ContagiousRule), 700)
	item.Detail.SuccessFormula = truncate(strings.TrimSpace(item.Detail.SuccessFormula), 700)
	item.Detail.OntologyTrace = truncate(strings.TrimSpace(item.Detail.OntologyTrace), 700)
	item.Detail.SelectionReason = truncate(strings.TrimSpace(item.Detail.SelectionReason), 700)
	if len(item.Detail.Scenes) > 8 {
		item.Detail.Scenes = item.Detail.Scenes[:8]
	}
	return item
}

func extractAnimationAdBriefPackItems(value any) []animationAdBriefPack {
	switch typed := value.(type) {
	case []any:
		items := make([]animationAdBriefPack, 0, len(typed))
		for _, entry := range typed {
			if item, ok := animationAdBriefPackFromAny(entry); ok {
				items = append(items, item)
			}
		}
		return items
	case map[string]any:
		keys := []string{
			"items", "packs", "brief_packs", "briefPacks", "recommendations",
			"concepts", "options", "candidates", "ads", "sets", "ideas",
		}
		for _, key := range keys {
			if list := extractAnimationAdBriefPackItems(typed[key]); len(list) > 0 {
				return list
			}
		}
		for _, key := range []string{"data", "result", "response", "output"} {
			if list := extractAnimationAdBriefPackItems(typed[key]); len(list) > 0 {
				return list
			}
		}
		var numbered []animationAdBriefPack
		for _, key := range []string{"1", "2", "3", "4", "5"} {
			if item, ok := animationAdBriefPackFromAny(typed[key]); ok {
				numbered = append(numbered, item)
			}
		}
		if len(numbered) > 0 {
			return numbered
		}
		if item, ok := animationAdBriefPackFromAny(typed); ok {
			return []animationAdBriefPack{item}
		}
	}
	return nil
}

func animationAdBriefPackFromAny(value any) (animationAdBriefPack, bool) {
	source, ok := value.(map[string]any)
	if !ok {
		return animationAdBriefPack{}, false
	}
	detailMap := animationAdMapValue(source, "detail", "details", "strategy", "reasoning", "plan")
	item := animationAdBriefPack{
		Value:            animationAdStringValue(source, "value", "id", "slug", "key"),
		Label:            animationAdStringValue(source, "label", "title", "name", "concept", "concept_name", "headline"),
		Topic:            animationAdStringValue(source, "topic", "subject", "ad_topic"),
		Objective:        animationAdStringValue(source, "objective", "goal", "ad_goal"),
		Tone:             animationAdStringValue(source, "tone", "mood", "voice"),
		CTA:              animationAdStringValue(source, "cta", "call_to_action", "action"),
		Duration:         animationAdIntValue(source, "duration", "length", "seconds"),
		Scenes:           animationAdIntValue(source, "scenes", "scene_count"),
		Style:            animationAdStringValue(source, "style", "visual_style", "mode"),
		VFX:              animationAdStringValue(source, "vfx", "vfx_preset", "visual_effect"),
		Source:           animationAdStringValue(source, "source", "brief", "description", "summary", "idea", "rationale", "concept_brief"),
		StoryArc:         animationAdStringValue(source, "story_arc", "storyArc", "arc", "structure"),
		AttentionHook:    animationAdStringValue(source, "attention_hook", "attentionHook", "hook_type"),
		HookRecipe:       animationAdStringValue(source, "hook_recipe", "hookRecipe", "recipe"),
		PlatformPlaybook: animationAdStringValue(source, "platform_playbook", "platformPlaybook", "playbook"),
		PersonaType:      animationAdStringValue(source, "persona_type", "personaType", "persona"),
	}
	item.Detail = animationAdBriefPackDetail{
		Target:          firstNonEmpty(animationAdStringValue(detailMap, "target", "audience"), animationAdStringValue(source, "target", "audience")),
		Hook:            firstNonEmpty(animationAdStringValue(detailMap, "hook", "first_frame", "opening"), animationAdStringValue(source, "hook", "first_frame", "opening")),
		Problem:         firstNonEmpty(animationAdStringValue(detailMap, "problem", "pain", "customer_problem"), animationAdStringValue(source, "problem", "pain", "customer_problem")),
		Proof:           firstNonEmpty(animationAdStringValue(detailMap, "proof", "evidence"), animationAdStringValue(source, "proof", "evidence")),
		Offer:           firstNonEmpty(animationAdStringValue(detailMap, "offer", "cta", "action"), animationAdStringValue(source, "offer")),
		Scenes:          firstNonEmptyStringSlice(animationAdStringSliceValue(detailMap, "scenes", "scene_list", "beats"), animationAdStringSliceValue(source, "scenes", "scene_list", "beats")),
		Visual:          firstNonEmpty(animationAdStringValue(detailMap, "visual", "look", "camera"), animationAdStringValue(source, "visual", "look", "camera")),
		Sound:           firstNonEmpty(animationAdStringValue(detailMap, "sound", "audio", "music"), animationAdStringValue(source, "sound", "audio", "music")),
		Overlay:         firstNonEmpty(animationAdStringValue(detailMap, "overlay", "slogan", "copy"), animationAdStringValue(source, "overlay", "slogan", "copy")),
		Avoid:           firstNonEmpty(animationAdStringValue(detailMap, "avoid", "forbidden", "negative"), animationAdStringValue(source, "avoid", "forbidden", "negative")),
		PurpleCow:       firstNonEmpty(animationAdStringValue(detailMap, "purple_cow", "purpleCow"), animationAdStringValue(source, "purple_cow", "purpleCow")),
		ExceptionRule:   firstNonEmpty(animationAdStringValue(detailMap, "exception_rule", "exception", "exceptionality"), animationAdStringValue(source, "exception_rule", "exception", "exceptionality")),
		Plausibility:    firstNonEmpty(animationAdStringValue(detailMap, "plausibility", "reason"), animationAdStringValue(source, "plausibility", "reason")),
		Creativity:      firstNonEmpty(animationAdStringValue(detailMap, "creativity", "creative_link"), animationAdStringValue(source, "creativity", "creative_link")),
		EmotionalAppeal: firstNonEmpty(animationAdStringValue(detailMap, "emotional_appeal", "emotion", "feeling"), animationAdStringValue(source, "emotional_appeal", "emotion", "feeling")),
		ContagiousRule:  firstNonEmpty(animationAdStringValue(detailMap, "contagious_rule", "stepps", "share_reason"), animationAdStringValue(source, "contagious_rule", "stepps", "share_reason")),
		SuccessFormula:  firstNonEmpty(animationAdStringValue(detailMap, "success_formula", "formula"), animationAdStringValue(source, "success_formula", "formula")),
		OntologyTrace:   firstNonEmpty(animationAdStringValue(detailMap, "ontology_trace", "trace", "reasoning_path"), animationAdStringValue(source, "ontology_trace", "trace", "reasoning_path")),
		SelectionReason: firstNonEmpty(animationAdStringValue(detailMap, "selection_reason", "why"), animationAdStringValue(source, "selection_reason", "why")),
	}
	return item, item.Label != "" || item.Source != "" || item.Detail.Hook != ""
}

func animationAdMapValue(source map[string]any, keys ...string) map[string]any {
	for _, key := range keys {
		if nested, ok := source[key].(map[string]any); ok {
			return nested
		}
	}
	return map[string]any{}
}

func animationAdStringValue(source map[string]any, keys ...string) string {
	for _, key := range keys {
		text := animationAdAnyString(source[key])
		if text != "" {
			return text
		}
	}
	return ""
}

func animationAdIntValue(source map[string]any, keys ...string) int {
	for _, key := range keys {
		value := source[key]
		switch typed := value.(type) {
		case float64:
			return int(typed)
		case int:
			return typed
		case string:
			var out int
			if _, err := fmt.Sscanf(strings.TrimSpace(typed), "%d", &out); err == nil {
				return out
			}
		}
	}
	return 0
}

func animationAdStringSliceValue(source map[string]any, keys ...string) []string {
	for _, key := range keys {
		value := source[key]
		switch typed := value.(type) {
		case []any:
			out := make([]string, 0, len(typed))
			for _, entry := range typed {
				if text := animationAdAnyString(entry); text != "" {
					out = append(out, text)
				}
			}
			if len(out) > 0 {
				return out
			}
		case []string:
			out := make([]string, 0, len(typed))
			for _, entry := range typed {
				if text := strings.TrimSpace(entry); text != "" {
					out = append(out, text)
				}
			}
			if len(out) > 0 {
				return out
			}
		case string:
			if text := strings.TrimSpace(typed); text != "" {
				return []string{text}
			}
		}
	}
	return nil
}

func firstNonEmptyStringSlice(items ...[]string) []string {
	for _, item := range items {
		if len(item) > 0 {
			return item
		}
	}
	return nil
}

func animationAdProfileString(profile map[string]any, keys ...string) string {
	return animationAdAnyString(profile, keys...)
}

func animationAdAnyString(value any, keys ...string) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text)
	}
	if profile, ok := value.(map[string]any); ok {
		for _, key := range keys {
			if nested, ok := profile[key]; ok {
				text := animationAdAnyString(nested)
				if text != "" {
					return text
				}
			}
		}
		return ""
	}
	if profile, ok := value.(map[string]string); ok {
		for _, key := range keys {
			if text := strings.TrimSpace(profile[key]); text != "" {
				return text
			}
		}
		return ""
	}
	text := strings.TrimSpace(fmt.Sprint(value))
	if text == "<nil>" {
		return ""
	}
	return text
}

func slugifyAnimationAdBriefValue(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	prevDash := false
	for _, r := range value {
		isAllowed := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAllowed {
			builder.WriteRune(r)
			prevDash = false
			continue
		}
		if !prevDash {
			builder.WriteByte('-')
			prevDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}
