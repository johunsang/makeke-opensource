package httpserver

import (
	"encoding/json"
	"net/http"
	"strings"
)

var directorPersonas = []map[string]string{
	{"id": "default", "label": "기본 감독", "style": "유니크·광고 최적", "notes": "의외성·대비·반전·문화 참조 중 하나 이상을 반드시 담는 기본 페르소나"},
	{"id": "kr-bjh", "label": "ㅂㅈㅎ 감독 톤 (한국 장르혼합)", "style": "계급·디테일·장르 혼합", "notes": "일상 속 균열, 블랙 유머, 한 숏 안에 계급 대비, 갑작스러운 장르 전환"},
	{"id": "kr-bcw", "label": "ㅂㅊㅇ 감독 톤 (한국 대비·미장센)", "style": "대비·미장센·고딕", "notes": "강렬한 명암 대비, 의식적 프레이밍, 붉은색·장미 모티브, 복수/욕망의 미학"},
	{"id": "kr-lcd", "label": "ㅇㅊㄷ 감독 톤 (한국 생활·여백)", "style": "생활·침묵·여백", "notes": "고요한 리듬, 일상의 상처, 얕은 심도, 롱테이크 걷기 씬"},
	{"id": "denis-villeneuve", "label": "드니 빌뇌브", "style": "웅장·여백·미니멀", "notes": "거대한 스케일, 차가운 색온도, 느린 줌, 사운드의 무게감"},
	{"id": "wes-anderson", "label": "웨스 앤더슨", "style": "대칭·파스텔·도식", "notes": "완벽한 대칭, 파스텔 팔레트, 클로즈업 물체 나열, 타이포 오버레이"},
	{"id": "spike-jonze", "label": "스파이크 존즈", "style": "위트·초현실·감성", "notes": "기발한 상상력, 따뜻한 감정, 핸드헬드와 슬로우모션 혼용"},
	{"id": "edgar-wright", "label": "에드가 라이트", "style": "컷 편집·리듬", "notes": "비트에 맞춘 컷, 프롭 매치컷, 빠른 줌, 오디오-비주얼 싱크"},
	{"id": "wong-kar-wai", "label": "왕가위", "style": "감성 스트리트·슬로우", "notes": "색번짐, 스텝 프린팅, 네온과 비, 상실의 감정"},
	{"id": "christopher-nolan", "label": "크리스토퍼 놀란", "style": "시간·퍼즐·IMAX", "notes": "시간의 층위, 거대한 스케일, 건축적 구도, 압도적인 BGM"},
	{"id": "david-fincher", "label": "데이비드 핀처", "style": "차갑고 정밀", "notes": "디지털 정밀도, 낮은 채도, 차가운 블루·그린, 타이트한 편집"},
	{"id": "sofia-coppola", "label": "소피아 코폴라", "style": "드림·파스텔·여성적", "notes": "파스텔 톤, 부드러운 햇살, 인디 감성, 공간의 공허함"},
	{"id": "martin-scorsese", "label": "마틴 스콜세지", "style": "에너지·리듬·도시", "notes": "빠른 줌, 스테디캠 롱테이크, 고전 록 BGM, 도시의 열기"},
	{"id": "greta-gerwig", "label": "그레타 거윅", "style": "여성 성장·화사·위트", "notes": "팝 컬러, 친근한 내레이션, 세대 감성, 경쾌한 에너지"},
	{"id": "kr-witty-pop", "label": "위트·팝 감성 스튜디오 톤", "style": "유머·위트·팝 감성", "notes": "발칙한 카피, 밝은 색감, 빠른 컷 유머, 자막 타이포 적극 활용"},
	{"id": "kr-corporate-classic", "label": "한국 클래식 기업 CF 톤", "style": "클래식 한국 CF·기업", "notes": "웅장한 BGM, 역사·자연·가족 모티브, 감동적 내레이션"},
}

func (s *Server) handleDirectorPersonas(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"personas": directorPersonas,
	})
}

type directorNoteRequest struct {
	Step        int    `json:"step"`
	IsFirst     bool   `json:"is_first"`
	UserMessage string `json:"user_message"`
}

func (s *Server) handleDirectorNote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req directorNoteRequest
	if r.Body != nil {
		defer r.Body.Close()
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	message := ""
	if userMessage := strings.TrimSpace(req.UserMessage); userMessage != "" {
		message = "Go 전용 모드에서는 감독 대화를 아직 축약 모드로 제공합니다. 자동 인사는 생략하고, 필요한 브리프·스크립트·이미지 생성 액션으로 바로 진행해주세요."
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"message":    message,
		"ask":        "",
		"actions":    []any{},
		"step":       req.Step,
		"auto_greet": false,
	})
}
