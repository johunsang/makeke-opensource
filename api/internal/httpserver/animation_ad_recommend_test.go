package httpserver

import (
	"strings"
	"testing"
)

func TestParseAnimationAdBriefPacksExtractsWrappedJSON(t *testing.T) {
	req := animationAdBriefRecommendRequest{Topic: "마케케 쇼츠 광고", Objective: "브랜드 기억", Duration: 30, SceneCount: 8}
	text := "좋습니다. 아래 JSON만 사용하세요.\n```json\n{\"items\":[" + briefPackJSON("one", "첫 컨셉") + "," + briefPackJSON("two", "둘째 컨셉") + "," + briefPackJSON("three", "셋째 컨셉") + "]}\n```"

	items, err := parseAnimationAdBriefPacks(text, req)
	if err != nil {
		t.Fatalf("parseAnimationAdBriefPacks() error = %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("len(items) = %d, want 3", len(items))
	}
	if items[0].Label != "첫 컨셉" {
		t.Fatalf("first label = %q", items[0].Label)
	}
	if items[0].Detail.SuccessFormula == "" || items[0].Detail.OntologyTrace == "" {
		t.Fatalf("success ontology fields were not preserved: %+v", items[0].Detail)
	}
}

func TestParseAnimationAdBriefPacksAcceptsRecommendationAliases(t *testing.T) {
	req := animationAdBriefRecommendRequest{Topic: "마케케 쇼츠 광고", Objective: "브랜드 기억", Duration: 30, SceneCount: 8}
	text := `{
		"recommendations": [
			{"title":"오렌지 스캔들","summary":"평범한 탭 하나가 회의실을 뒤흔드는 사건처럼 시작한다.","strategy":{"hook":"책상 위 탭이 갑자기 튄다","success_formula":"정지 훅 -> 감정 급전환 -> 브랜드 기억","ontology_trace":"업무 피로와 자동화 기대를 사건으로 연결"}},
			{"name":"야간 편집실","idea":"새벽 화면에서 끝나지 않는 작업을 한 번에 접는 비주얼.","details":{"hook":"모니터가 스스로 정리된다","emotion":"해방감","formula":"문제 압박 -> 작은 승리"}},
			{"concept_name":"도미노 발행","brief":"흩어진 소재가 하나의 발행 흐름으로 도미노처럼 이어진다.","detail":{"first_frame":"카드가 하늘에서 순서대로 꽂힌다","trace":"산발 업무를 자동 흐름으로 바꾼다"}}
		]
	}`
	items, err := parseAnimationAdBriefPacks(text, req)
	if err != nil {
		t.Fatalf("parseAnimationAdBriefPacks() error = %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("len(items) = %d, want 3", len(items))
	}
	if items[0].Label != "오렌지 스캔들" || items[0].Source == "" {
		t.Fatalf("alias fields were not normalized: %+v", items[0])
	}
	if items[1].Detail.EmotionalAppeal != "해방감" {
		t.Fatalf("detail alias was not preserved: %+v", items[1].Detail)
	}
}

func TestBuildAnimationAdBriefRecommendPromptAcceptsProductionModeObject(t *testing.T) {
	prompt, err := buildAnimationAdBriefRecommendPrompt(animationAdBriefRecommendRequest{
		Topic:          "쇼츠 광고 만들기",
		Objective:      "클릭 전환",
		Duration:       30,
		SceneCount:     8,
		ProductionMode: map[string]any{"value": "animation", "label": "애니메이션 광고"},
		ProfileContext: map[string]any{"brand": "마케케"},
		SuccessOntology: []map[string]any{
			{"slug": "scroll-stop-irregularity", "name": "스크롤 정지 이상 신호"},
		},
	})
	if err != nil {
		t.Fatalf("buildAnimationAdBriefRecommendPrompt() error = %v", err)
	}
	if !strings.Contains(prompt, "- 제작 방식: animation") {
		t.Fatalf("prompt does not contain normalized production mode: %s", prompt)
	}
	if !strings.Contains(prompt, "성공 방정식 온톨로지") || !strings.Contains(prompt, "success_formula") || !strings.Contains(prompt, "ontology_trace") {
		t.Fatalf("prompt does not contain success ontology requirements: %s", prompt)
	}
}

func TestParseAnimationAdSuccessCaseExtractionNormalizesNodes(t *testing.T) {
	text := `{
		"title":"댓글 폭발 릴스",
		"summary":"첫 장면이 이상해서 멈추고 마지막에 브랜드 기억이 남는다.",
		"case_trace":"사례 -> 훅 -> 기억 앵커",
		"usage_rule":"다음 광고에서 첫 프레임 이상 신호와 감정 급전환을 쓴다.",
		"nodes":[
			{"kind":"other","slug":"odd first frame","name":"이상한 첫 프레임","description":"처음 1초에 말이 안 되는 장면으로 멈춘다.","linked_slugs":["scroll-stop-irregularity"],"prompt":"첫 컷은 카테고리 공식과 다른 이상 신호로 시작한다.","weight":91},
			{"kind":"success_formula","slug":"emotion flip","name":"감정 급전환","description":"긴장 뒤 안도로 전환해 기억을 만든다.","linked_slugs":[],"prompt":"중반에 표정과 리듬이 반대로 바뀌게 한다.","weight":88},
			{"kind":"success_formula","slug":"share trigger","name":"공유 트리거","description":"댓글로 말하고 싶은 질문을 남긴다.","linked_slugs":[],"prompt":"마지막 전 컷에 시청자가 해석하고 싶은 빈칸을 만든다.","weight":86}
		]
	}`
	item, err := parseAnimationAdSuccessCaseExtraction(text, animationAdSuccessCaseRequest{Title: "테스트"})
	if err != nil {
		t.Fatalf("parseAnimationAdSuccessCaseExtraction() error = %v", err)
	}
	if len(item.Nodes) != 3 {
		t.Fatalf("len(nodes) = %d, want 3", len(item.Nodes))
	}
	if item.Nodes[0].Kind != "success_formula" || !strings.HasPrefix(item.Nodes[0].Slug, "learned-") {
		t.Fatalf("node was not normalized: %+v", item.Nodes[0])
	}
}

func briefPackJSON(value string, label string) string {
	return `{"value":"` + value + `","label":"` + label + `","source":"첫 1초에 사건처럼 시작하고 마지막에만 브랜드를 남긴다.","detail":{"hook":"낯선 첫 장면","scenes":["훅","문제","증거","브랜드"],"success_formula":"스크롤 정지 이상 신호 -> 제품 진실 다리","ontology_trace":"브랜드 문제에서 훅과 기억 앵커가 이어진다"}}`
}
