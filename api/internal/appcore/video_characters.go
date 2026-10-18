package appcore

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (s *Service) handleVideoAgentCharacters(w http.ResponseWriter, r *http.Request) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureVideoAgentCharactersTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	switch r.Method {
	case http.MethodGet:
		profileID := intQuery(r, "profile_id", 0)
		query := `SELECT * FROM video_agent_characters ORDER BY updated_at DESC LIMIT 80`
		args := []any{}
		if profileID > 0 {
			query = `SELECT * FROM video_agent_characters WHERE profile_id = ? OR profile_id = 0 ORDER BY updated_at DESC LIMIT 80`
			args = append(args, profileID)
		}
		rows, err := db.Query(query, args...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		items, err := rowsToMaps(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for _, item := range items {
			normalizeVideoAgentCharacter(item)
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "items": items})
	case http.MethodPost:
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}
		now := time.Now().Format("2006-01-02 15:04:05")
		name := strings.TrimSpace(stringify(req["name"]))
		label := strings.TrimSpace(stringify(req["label"]))
		if name == "" {
			name = defaultText(label, "주인공 모델 "+time.Now().Format("2006-01-02 15:04"))
		}
		settingsJSON := stringify(req["settings_json"])
		if settingsJSON == "" && req["settings"] != nil {
			if raw, err := json.Marshal(req["settings"]); err == nil {
				settingsJSON = string(raw)
			}
		}
		if settingsJSON == "" {
			settingsJSON = "{}"
		}
		result, err := db.Exec(`INSERT INTO video_agent_characters (
			profile_id, name, label, prompt, settings_json, image_url, provider, model,
			source_topic, source_objective, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			intFromAny(req["profile_id"]),
			name,
			label,
			stringify(req["prompt"]),
			settingsJSON,
			stringify(req["image_url"]),
			stringify(req["provider"]),
			stringify(req["model"]),
			stringify(req["source_topic"]),
			stringify(req["source_objective"]),
			now,
			now,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		id, _ := result.LastInsertId()
		item, err := querySingleMap(db, `SELECT * FROM video_agent_characters WHERE id = ?`, id)
		if err == nil {
			normalizeVideoAgentCharacter(item)
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "id": id, "item": item})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleVideoAgentCharacterByID(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/vag/characters/"), "/")
	characterID, err := strconv.Atoi(path)
	if err != nil || characterID <= 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureVideoAgentCharactersTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	switch r.Method {
	case http.MethodGet:
		item, err := queryVideoAgentCharacter(db, characterID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "주인공 모델을 찾을 수 없습니다."})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, item)
	case http.MethodPut, http.MethodPatch:
		item, err := updateVideoAgentCharacter(db, characterID, r)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "주인공 모델을 찾을 수 없습니다."})
				return
			}
			if strings.Contains(err.Error(), "invalid json") {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "item": item})
	case http.MethodDelete:
		if _, err := db.Exec(`DELETE FROM video_agent_characters WHERE id = ?`, characterID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func queryVideoAgentCharacter(db *sql.DB, id int) (map[string]any, error) {
	item, err := querySingleMap(db, `SELECT * FROM video_agent_characters WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	normalizeVideoAgentCharacter(item)
	return item, nil
}

func updateVideoAgentCharacter(db *sql.DB, id int, r *http.Request) (map[string]any, error) {
	current, err := querySingleMap(db, `SELECT * FROM video_agent_characters WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return nil, errors.New("invalid json body")
	}

	textValue := func(key string) string {
		if value, ok := req[key]; ok {
			return strings.TrimSpace(stringify(value))
		}
		return strings.TrimSpace(stringify(current[key]))
	}
	profileID := intFromAny(current["profile_id"])
	if value, ok := req["profile_id"]; ok {
		profileID = intFromAny(value)
	}
	settingsJSON := strings.TrimSpace(stringify(current["settings_json"]))
	if value, ok := req["settings_json"]; ok {
		settingsJSON = strings.TrimSpace(stringify(value))
	}
	if value, ok := req["settings"]; ok && value != nil {
		if raw, err := json.Marshal(value); err == nil {
			settingsJSON = string(raw)
		}
	}
	if settingsJSON == "" {
		settingsJSON = "{}"
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	name := textValue("name")
	if name == "" {
		name = defaultText(textValue("label"), "주인공 모델 "+now)
	}
	_, err = db.Exec(`UPDATE video_agent_characters SET
		profile_id = ?, name = ?, label = ?, prompt = ?, settings_json = ?,
		image_url = ?, provider = ?, model = ?, source_topic = ?, source_objective = ?,
		updated_at = ?
		WHERE id = ?`,
		profileID,
		name,
		textValue("label"),
		textValue("prompt"),
		settingsJSON,
		textValue("image_url"),
		textValue("provider"),
		textValue("model"),
		textValue("source_topic"),
		textValue("source_objective"),
		now,
		id,
	)
	if err != nil {
		return nil, err
	}
	return queryVideoAgentCharacter(db, id)
}

func ensureVideoAgentCharactersTable(db *sql.DB) error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS video_agent_characters (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		profile_id INTEGER DEFAULT 0,
		name TEXT NOT NULL,
		label TEXT DEFAULT '',
		prompt TEXT DEFAULT '',
		settings_json TEXT DEFAULT '{}',
		image_url TEXT DEFAULT '',
		provider TEXT DEFAULT '',
		model TEXT DEFAULT '',
		source_topic TEXT DEFAULT '',
		source_objective TEXT DEFAULT '',
		created_at TEXT DEFAULT (datetime('now', 'localtime')),
		updated_at TEXT DEFAULT (datetime('now', 'localtime'))
	)`)
	return err
}

func normalizeVideoAgentCharacter(item map[string]any) {
	if item == nil {
		return
	}
	raw := strings.TrimSpace(stringify(item["settings_json"]))
	settings := map[string]any{}
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &settings)
	}
	item["settings"] = settings
	if stringify(item["label"]) == "" {
		item["label"] = stringify(item["name"])
	}
}
