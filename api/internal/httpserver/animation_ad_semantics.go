package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
)

type animationAdSemanticSeed struct {
	Kind        string   `json:"kind"`
	Slug        string   `json:"slug"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	LinkedSlugs []string `json:"linked_slugs"`
	Prompt      string   `json:"prompt"`
	Weight      int      `json:"weight"`
}

type animationAdSemanticItem struct {
	ID          int64    `json:"id"`
	Kind        string   `json:"kind"`
	Slug        string   `json:"slug"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	LinkedSlugs []string `json:"linked_slugs"`
	Prompt      string   `json:"prompt"`
	Weight      int      `json:"weight"`
}

func (s *Server) handleAnimationAdSemantics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	rows, err := db.Query(`
		SELECT id, kind, slug, name, description, linked_slugs_json, prompt, weight
		FROM animation_ad_semantics
		WHERE enabled = 1
		ORDER BY kind ASC, weight DESC, id ASC`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := make([]animationAdSemanticItem, 0)
	for rows.Next() {
		var item animationAdSemanticItem
		var linkedRaw string
		if err := rows.Scan(&item.ID, &item.Kind, &item.Slug, &item.Name, &item.Description, &linkedRaw, &item.Prompt, &item.Weight); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		_ = json.Unmarshal([]byte(linkedRaw), &item.LinkedSlugs)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": items})
}

func (s *Server) ensureAnimationAdSemanticSchema(db *sql.DB) error {
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS animation_ad_semantics (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kind TEXT NOT NULL DEFAULT '',
			slug TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			linked_slugs_json TEXT NOT NULL DEFAULT '[]',
			prompt TEXT NOT NULL DEFAULT '',
			weight INTEGER NOT NULL DEFAULT 50,
			enabled INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`); err != nil {
		return err
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_animation_ad_semantics_kind ON animation_ad_semantics(kind, weight DESC)`); err != nil {
		return err
	}
	return s.seedAnimationAdSemantics(db)
}

func (s *Server) seedAnimationAdSemantics(db *sql.DB) error {
	seeds, err := s.loadAnimationAdSemanticPack()
	if err != nil {
		seeds = fallbackAnimationAdSemanticSeeds()
	}
	for _, seed := range seeds {
		linkedRaw, _ := json.Marshal(seed.LinkedSlugs)
		if _, err := db.Exec(`
			INSERT INTO animation_ad_semantics (kind, slug, name, description, linked_slugs_json, prompt, weight, enabled)
			VALUES (?, ?, ?, ?, ?, ?, ?, 1)
			ON CONFLICT(slug) DO UPDATE SET
				kind = excluded.kind,
				name = excluded.name,
				description = excluded.description,
				linked_slugs_json = excluded.linked_slugs_json,
				prompt = excluded.prompt,
				weight = excluded.weight,
				enabled = 1,
				updated_at = CURRENT_TIMESTAMP`,
			seed.Kind, seed.Slug, seed.Name, seed.Description, string(linkedRaw), seed.Prompt, seed.Weight); err != nil {
			return err
		}
	}
	return nil
}

type animationAdSemanticPack struct {
	Version     int                       `json:"version"`
	Name        string                    `json:"name"`
	Description string                    `json:"description"`
	Items       []animationAdSemanticSeed `json:"items"`
}

func (s *Server) loadAnimationAdSemanticPack() ([]animationAdSemanticSeed, error) {
	candidates := []string{
		filepath.Join(s.config.ProjectRoot, "data", "animation_ad", "semantic_pack.default.json"),
		filepath.Join("data", "animation_ad", "semantic_pack.default.json"),
	}
	var raw []byte
	var err error
	for _, path := range candidates {
		raw, err = os.ReadFile(path)
		if err == nil {
			break
		}
	}
	if err != nil {
		return nil, err
	}
	var pack animationAdSemanticPack
	if err := json.Unmarshal(raw, &pack); err != nil {
		return nil, err
	}
	if len(pack.Items) == 0 {
		return nil, sql.ErrNoRows
	}
	return pack.Items, nil
}

func fallbackAnimationAdSemanticSeeds() []animationAdSemanticSeed {
	return []animationAdSemanticSeed{
		{Kind: "structure", Slug: "auto-semantic-graph", Name: "AI가 시맨틱 구조 자동 선택", Description: "브랜드명, 주인공, 주제, 예외성, 장면, 감정, 오브젝트, 공간, 장르 노드를 조합해 가장 강한 의미 연결을 고른다.", LinkedSlugs: []string{"hidden-friction", "wrong-hero", "one-second-accident", "relief-after-pressure", "brand-color-signal"}, Prompt: "AI가 업종 클리셰와 제품 진실을 비교한 뒤 하나의 의미망을 선택한다. 이름-주인공-주제-예외성-장면-감정-오브젝트가 서로 이유 있게 연결되어야 한다.", Weight: 100},
		{Kind: "structure", Slug: "hidden-friction-rescue-graph", Name: "숨은 불편 구출 구조", Description: "말로 설명하기 어려운 작은 불편을 위기처럼 키우고, 제품/브랜드가 마지막 직전에 구출한다.", LinkedSlugs: []string{"hidden-friction", "relief-after-pressure", "one-second-accident", "rescue-moment", "brand-color-signal"}, Prompt: "고객이 참던 작은 불편을 첫 1초 사고로 보이고, 압박 뒤 안도로 이어지는 구출 서사를 만든다.", Weight: 97},
		{Kind: "structure", Slug: "brand-name-spell-graph", Name: "브랜드명이 세계 규칙을 바꾸는 구조", Description: "브랜드명이 텍스트가 아니라 빛, 움직임, 물리 규칙, 주변 반응을 바꾸는 힘처럼 작동한다.", LinkedSlugs: []string{"brand-name-as-spell", "physics-break", "brand-color-signal", "status-shift", "surreal-metaphor"}, Prompt: "브랜드명은 마지막 텍스트로만 보이고, 앞 컷에서는 브랜드 색과 물리 변화가 이름의 의미를 예고한다.", Weight: 95},
		{Kind: "structure", Slug: "wrong-hero-prop-graph", Name: "예상 밖 주인공 구조", Description: "사람 대신 소품, 제품, 손, 그림자, 공간이 주인공이 되어 카테고리 클리셰를 깬다.", LinkedSlugs: []string{"wrong-hero", "signature-prop", "object-hero", "forbidden-angle", "brand-name-hidden-clue"}, Prompt: "예상 밖 대상이 의지를 가진 듯 움직이며 문제를 발견하고 해결 방향으로 장면을 끌고 간다.", Weight: 94},
		{Kind: "structure", Slug: "wrong-place-genre-graph", Name: "카테고리 밖 장소 구조", Description: "업종이 기대하는 공간 밖으로 문제를 옮기고, 낯선 장르 문법으로 의미를 선명하게 만든다.", LinkedSlugs: []string{"wrong-place", "category-wrong-room", "genre-invasion", "domestic-thriller", "hidden-friction"}, Prompt: "카테고리와 반대되는 장소에서 문제를 보여주고 낯선 장르 리듬으로 제품 진실을 더 또렷하게 만든다.", Weight: 92},
		{Kind: "structure", Slug: "mystery-clue-reveal-graph", Name: "숨은 단서 리빌 구조", Description: "브랜드/제품 정체를 직접 말하지 않고 단서, 감정, 오브젝트를 쌓아 마지막에 의미가 열린다.", LinkedSlugs: []string{"brand-name-hidden-clue", "curiosity-gap", "mystery-reveal", "signature-prop", "wrong-time"}, Prompt: "정답을 늦게 공개하고 색, 소리, 손동작, 오브젝트 단서가 마지막 브랜드 의미로 모이게 한다.", Weight: 91},
		{Kind: "structure", Slug: "public-judgement-graph", Name: "선택지 공개 판정 구조", Description: "제품 선택을 주변 반응, 스포츠 중계, 심판, 댓글 떡밥처럼 공개 판정 장면으로 만든다.", LinkedSlugs: []string{"reverse-role", "rival-duel", "sports-commentary", "before-after-judge", "comment-bait"}, Prompt: "고객이 조용히 비교하는 대신 장면 전체가 선택을 판정하고 시청자가 댓글로 끼어들고 싶게 만든다.", Weight: 89},
		{Kind: "name", Slug: "brand-name-as-spell", Name: "브랜드명이 주문처럼 작동", Description: "이름이 말로 설명되지 않고 장면의 규칙을 바꾸는 힘처럼 느껴진다.", LinkedSlugs: []string{"physics-break", "brand-color-signal"}, Prompt: "브랜드명을 화면 글자가 아니라 빛, 움직임, 반응의 규칙으로 느끼게 한다.", Weight: 96},
		{Kind: "name", Slug: "brand-name-hidden-clue", Name: "브랜드명이 숨은 단서", Description: "마지막 전까지 이름을 직접 말하지 않고 색, 형태, 소리, 행동 단서로 쌓는다.", LinkedSlugs: []string{"mystery-reveal", "object-hero"}, Prompt: "브랜드 이름은 마지막에만 드러나고 앞 컷들은 이름의 감각 단서로 연결한다.", Weight: 92},
		{Kind: "persona", Slug: "reluctant-expert", Name: "마지못해 인정하는 전문가", Description: "처음엔 의심하지만 결과를 보고 표정이 바뀌는 인물.", LinkedSlugs: []string{"myth-bust", "social-proof-docu"}, Prompt: "전문가가 과장 없이 의심에서 인정으로 변하는 장면을 만든다.", Weight: 94},
		{Kind: "persona", Slug: "tiny-rebel", Name: "작은 반항아", Description: "큰 문제 앞에서 작고 엉뚱한 행동으로 판을 바꾸는 주인공.", LinkedSlugs: []string{"scale-break", "absurd-scale"}, Prompt: "작은 행동 하나가 거대한 문제를 뒤집는 쾌감을 만든다.", Weight: 90},
		{Kind: "topic", Slug: "hidden-friction", Name: "숨은 불편", Description: "고객이 말로는 설명하지 않지만 매일 느끼는 작은 마찰.", LinkedSlugs: []string{"problem", "customer-pov"}, Prompt: "고객이 무심코 참는 불편을 몸짓과 표정으로 먼저 보여준다.", Weight: 97},
		{Kind: "topic", Slug: "status-shift", Name: "상태 변화", Description: "사용 전후의 기능 차이가 아니라 사람의 태도와 공간 분위기가 바뀐다.", LinkedSlugs: []string{"transform", "story-brain"}, Prompt: "기능이 아니라 사람의 자세, 속도, 표정, 주변 반응이 바뀌게 한다.", Weight: 91},
		{Kind: "exception", Slug: "wrong-hero", Name: "주인공 예외", Description: "사람이 아니라 제품, 소품, 그림자, 손, 공간이 주인공이 된다.", LinkedSlugs: []string{"object-hero", "brand-name-as-spell"}, Prompt: "가장 예상 밖 대상이 의지를 가진 듯 장면을 끌고 간다.", Weight: 99},
		{Kind: "exception", Slug: "wrong-place", Name: "장소 예외", Description: "업종이 절대 가지 않을 것 같은 장소로 문제를 옮긴다.", LinkedSlugs: []string{"genre-invasion", "surreal-metaphor"}, Prompt: "카테고리와 반대되는 장소에서 제품 문제가 더 선명하게 보이게 한다.", Weight: 94},
		{Kind: "exception", Slug: "wrong-time", Name: "시간 예외", Description: "결말을 먼저 보이거나 미래/과거를 오가며 이유를 추적한다.", LinkedSlugs: []string{"mystery-reveal", "micro-quest"}, Prompt: "끝 장면을 먼저 던지고 왜 그렇게 됐는지 역순으로 추적한다.", Weight: 91},
		{Kind: "exception", Slug: "scale-break", Name: "스케일 예외", Description: "작은 문제를 거대하게, 큰 문제를 작게 다룬다.", LinkedSlugs: []string{"absurd-scale", "tiny-rebel"}, Prompt: "문제의 크기를 반대로 뒤틀어 웃음이나 긴장을 만든다.", Weight: 93},
		{Kind: "exception", Slug: "physics-break", Name: "물리법칙 예외", Description: "중력, 빛, 속도, 공간이 제품 가치에 반응한다.", LinkedSlugs: []string{"surreal-metaphor", "brand-name-as-spell"}, Prompt: "제품 가치가 물리법칙을 바꾸는 것처럼 보이게 한다.", Weight: 95},
		{Kind: "exception", Slug: "taboo-truth", Name: "금기 진실 예외", Description: "업계가 숨기는 불편한 진실을 안전하게 보여준다.", LinkedSlugs: []string{"taboo-reversal", "myth-bust"}, Prompt: "불편한 진실을 공격 없이 드러내고 제품의 태도로 회수한다.", Weight: 89},
		{Kind: "exception", Slug: "reverse-role", Name: "역할 반전 예외", Description: "고객이 제품을 고르는 게 아니라 제품/공간이 고객을 시험한다.", LinkedSlugs: []string{"rival-duel", "comment-bait"}, Prompt: "선택의 주체를 뒤집어 시청자가 판정하고 싶게 만든다.", Weight: 88},
		{Kind: "exception", Slug: "genre-invasion", Name: "장르 침입 예외", Description: "평범한 순간에 스릴러, 로맨스, 스포츠 중계, 요리 배틀 문법이 침입한다.", LinkedSlugs: []string{"pov-crisis", "comedy-twist"}, Prompt: "업종과 어울리지 않는 장르 문법을 한 장면에 침입시킨다.", Weight: 92},
		{Kind: "exception", Slug: "silence-gap", Name: "침묵/공백 예외", Description: "시끄러운 숏폼 사이에서 정적과 멈춤으로 시선을 잡는다.", LinkedSlugs: []string{"sensory-loop", "cinematic-tension"}, Prompt: "순간적인 정적과 빈 공간 뒤에 강한 사운드/움직임을 터뜨린다.", Weight: 86},
		{Kind: "exception", Slug: "forbidden-angle", Name: "카메라 관점 예외", Description: "서랍 속, 제품 표면, 손바닥, 천장, 거울, CCTV 같은 비정상 시점.", LinkedSlugs: []string{"pov-crisis", "object-hero"}, Prompt: "평범한 행동을 비정상 카메라 위치에서 봐서 새롭게 느끼게 한다.", Weight: 90},
		{Kind: "scene", Slug: "one-second-accident", Name: "1초 사고", Description: "첫 프레임에서 아주 작은 사고가 터져 멈추게 한다.", LinkedSlugs: []string{"hidden-friction", "pov-crisis"}, Prompt: "첫 1초에 작은 사고나 오류가 화면 행동으로 보이게 한다.", Weight: 98},
		{Kind: "scene", Slug: "ritual-closeup", Name: "의식 클로즈업", Description: "손동작, 질감, 소리, 반복 리듬으로 감각 몰입을 만든다.", LinkedSlugs: []string{"asmr-ritual", "sensory-loop"}, Prompt: "손과 질감, 소리의 반복 의식으로 제품을 기억하게 한다.", Weight: 87},
		{Kind: "emotion", Slug: "relief-after-pressure", Name: "압박 뒤 안도", Description: "문제가 몰아붙인 뒤 표정이 풀리는 전환.", LinkedSlugs: []string{"hidden-friction", "rescue-moment"}, Prompt: "압박감에서 안도로 바뀌는 표정/호흡/공간 변화를 잡는다.", Weight: 95},
		{Kind: "emotion", Slug: "curiosity-gap", Name: "호기심 공백", Description: "정체를 숨긴 단서가 쌓이고 마지막에 의미가 열린다.", LinkedSlugs: []string{"mystery-reveal", "brand-name-hidden-clue"}, Prompt: "정답을 늦게 공개하고 단서만 빠르게 쌓는다.", Weight: 93},
		{Kind: "object", Slug: "brand-color-signal", Name: "브랜드 컬러 신호", Description: "브랜드 색이 문제를 정리하거나 분위기를 바꾸는 신호가 된다.", LinkedSlugs: []string{"brand-name-as-spell", "status-shift"}, Prompt: "브랜드 컬러를 장면 속 힘의 방향, 빛, 전환 신호로 사용한다.", Weight: 90},
		{Kind: "object", Slug: "signature-prop", Name: "시그니처 소품", Description: "한 번 보면 기억나는 작은 소품이 모든 컷을 연결한다.", LinkedSlugs: []string{"object-hero", "wrong-hero"}, Prompt: "시그니처 소품을 반복 단서로 써서 컷들을 하나의 세계로 묶는다.", Weight: 84},
		{Kind: "location", Slug: "category-wrong-room", Name: "카테고리 밖 방", Description: "업종과 맞지 않는 공간이 제품 문제를 더 선명하게 만든다.", LinkedSlugs: []string{"wrong-place", "genre-invasion"}, Prompt: "업종이 기대하는 공간과 반대되는 방에서 문제를 보여준다.", Weight: 86},
		{Kind: "genre", Slug: "sports-commentary", Name: "스포츠 중계 침입", Description: "작은 선택을 결승전처럼 긴장감 있게 보여준다.", LinkedSlugs: []string{"genre-invasion", "before-after-judge"}, Prompt: "작은 제품 선택을 스포츠 판정/중계 리듬으로 만든다.", Weight: 82},
		{Kind: "genre", Slug: "domestic-thriller", Name: "생활 스릴러 침입", Description: "일상 불편을 스릴러처럼 키우되 안전하게 회수한다.", LinkedSlugs: []string{"problem-thriller", "pov-crisis"}, Prompt: "생활 속 작은 불편을 과장된 스릴러 리듬으로 보여준다.", Weight: 85},
	}
}
