package atlas

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	LLMBaseURL            = "https://api.atlascloud.ai/v1"
	ImageAPIBaseURL       = "https://api.atlascloud.ai/api/v1/model"
	DefaultChatModel      = "openai/gpt-5.4"
	DefaultImageModel     = "openai/gpt-image-2-developer/text-to-image"
	DefaultImageEditModel = "openai/gpt-image-2-developer/edit"
	defaultMaxBodyLen     = 8 << 20
)

type ImageInput struct {
	MIMEType string
	Data     string
}

type ChatOptions struct {
	APIKey      string
	Model       string
	Prompt      string
	Images      []ImageInput
	Temperature float64
	MaxTokens   int
	Timeout     time.Duration
}

type GenerateImageOptions struct {
	APIKey         string
	Model          string
	Prompt         string
	AspectRatio    string
	OutputPath     string
	ReferencePaths []string
	Timeout        time.Duration
}

func ChatCompletion(opts ChatOptions) (string, error) {
	if strings.TrimSpace(opts.APIKey) == "" {
		return "", fmt.Errorf("Atlas Cloud API 키가 없습니다. 설정 > API > Atlas Cloud 를 확인하세요")
	}
	opts.Model = firstNonEmpty(opts.Model, DefaultChatModel)
	if opts.Temperature == 0 {
		opts.Temperature = 0.45
	}
	if opts.MaxTokens <= 0 {
		opts.MaxTokens = 24000
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 180 * time.Second
	}
	text, err := callChatCompletion(opts, true)
	if err == nil || len(opts.Images) == 0 {
		return text, err
	}
	// Some text-only Atlas models reject image_url content. In that case,
	// retry text-only and let the caller fill image placeholders later.
	return callChatCompletion(opts, false)
}

func callChatCompletion(opts ChatOptions, includeImages bool) (string, error) {
	content := []map[string]any{{"type": "text", "text": opts.Prompt}}
	if includeImages {
		for _, image := range opts.Images {
			mimeType := strings.TrimSpace(image.MIMEType)
			data := strings.TrimSpace(image.Data)
			if mimeType == "" || data == "" {
				continue
			}
			content = append(content, map[string]any{
				"type": "image_url",
				"image_url": map[string]any{
					"url": "data:" + mimeType + ";base64," + data,
				},
			})
		}
	}
	message := map[string]any{"role": "user", "content": opts.Prompt}
	if len(content) > 1 {
		message["content"] = content
	}
	payload := map[string]any{
		"model":       opts.Model,
		"messages":    []map[string]any{message},
		"temperature": opts.Temperature,
		"max_tokens":  opts.MaxTokens,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, LLMBaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+opts.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: opts.Timeout}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, defaultMaxBodyLen))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Atlas API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	choices, _ := parsed["choices"].([]any)
	for _, choice := range choices {
		c, _ := choice.(map[string]any)
		message, _ := c["message"].(map[string]any)
		if text := strings.TrimSpace(fmt.Sprint(message["content"])); text != "" && text != "<nil>" {
			return text, nil
		}
	}
	return "", fmt.Errorf("Atlas 응답 텍스트가 비어 있습니다")
}

func GenerateImageFile(opts GenerateImageOptions) error {
	if strings.TrimSpace(opts.OutputPath) == "" {
		return fmt.Errorf("output path is empty")
	}
	outputURL, err := GenerateImage(opts)
	if err != nil {
		return err
	}
	return downloadImageFile(outputURL, opts.OutputPath, opts.Timeout)
}

func GenerateImage(opts GenerateImageOptions) (string, error) {
	if strings.TrimSpace(opts.APIKey) == "" {
		return "", fmt.Errorf("Atlas Cloud API 키가 없습니다. 설정 > API > Atlas Cloud 를 확인하세요")
	}
	if strings.TrimSpace(opts.Prompt) == "" {
		return "", fmt.Errorf("image prompt is empty")
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 3 * time.Minute
	}
	model := firstNonEmpty(opts.Model, DefaultImageModel)
	width, height := imageSizeForAspect(opts.AspectRatio)
	payload := map[string]any{
		"model":        model,
		"prompt":       opts.Prompt,
		"aspect_ratio": normalizeImageAspect(opts.AspectRatio),
		"width":        width,
		"height":       height,
	}
	applyImageModelOptions(payload, model, opts.AspectRatio)
	if imageModelRequiresReference(model) {
		images, err := prepareImageReferences(opts.APIKey, opts.ReferencePaths, 14, opts.Timeout)
		if err != nil {
			return "", err
		}
		if len(images) == 0 {
			return "", fmt.Errorf("Atlas 이미지 편집 모델은 참고 이미지가 필요합니다. 이미지를 첨부하거나 Text-to-Image 모델을 선택하세요")
		}
		payload["images"] = images
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, ImageAPIBaseURL+"/generateImage", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+opts.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: opts.Timeout}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, defaultMaxBodyLen))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Atlas 이미지 API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
	}
	predictionID, outputURL, err := parseImageGenerateResponse(raw)
	if err != nil {
		return "", err
	}
	if outputURL != "" {
		return outputURL, nil
	}
	return pollImagePrediction(opts.APIKey, predictionID, opts.Timeout)
}

func prepareImageReferences(apiKey string, refs []string, limit int, timeout time.Duration) ([]string, error) {
	if limit <= 0 {
		limit = 14
	}
	out := make([]string, 0, limit)
	seen := map[string]bool{}
	for _, raw := range refs {
		ref := strings.TrimSpace(raw)
		if ref == "" || seen[ref] {
			continue
		}
		seen[ref] = true
		lower := strings.ToLower(ref)
		if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
			out = append(out, ref)
		} else {
			uploaded, err := UploadMedia(apiKey, ref, timeout)
			if err != nil {
				continue
			}
			if uploaded != "" && !seen[uploaded] {
				seen[uploaded] = true
				out = append(out, uploaded)
			}
		}
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func UploadMedia(apiKey, localPath string, timeout time.Duration) (string, error) {
	if strings.TrimSpace(apiKey) == "" {
		return "", fmt.Errorf("Atlas Cloud API 키가 없습니다")
	}
	if timeout <= 0 {
		timeout = 2 * time.Minute
	}
	file, err := os.Open(localPath)
	if err != nil {
		return "", err
	}
	defer file.Close()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filepath.Base(localPath))
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, file); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, ImageAPIBaseURL+"/uploadMedia", &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := (&http.Client{Timeout: timeout}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, defaultMaxBodyLen))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Atlas 업로드 API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	data, _ := parsed["data"].(map[string]any)
	out := firstNonEmpty(cleanString(valueFromMap(data, "download_url")), cleanString(valueFromMap(data, "url")), cleanString(parsed["download_url"]), cleanString(parsed["url"]))
	if out == "" {
		return "", fmt.Errorf("Atlas 업로드 응답에서 URL을 찾지 못했습니다: %s", truncate(strings.TrimSpace(string(raw)), 500))
	}
	return out, nil
}

func parseImageGenerateResponse(raw []byte) (string, string, error) {
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", "", err
	}
	data, _ := parsed["data"].(map[string]any)
	id := firstPredictionID(parsed)
	if id == "" {
		id = firstPredictionID(data)
	}
	output := firstImageOutput(parsed)
	if output == "" && data != nil {
		output = firstImageOutput(data)
	}
	if id == "" && output == "" {
		return "", "", fmt.Errorf("Atlas 이미지 응답에서 prediction id를 찾지 못했습니다: %s", truncate(strings.TrimSpace(string(raw)), 500))
	}
	return id, output, nil
}

func pollImagePrediction(apiKey, predictionID string, timeout time.Duration) (string, error) {
	if strings.TrimSpace(predictionID) == "" {
		return "", fmt.Errorf("Atlas prediction id가 비어 있습니다")
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		req, err := http.NewRequest(http.MethodGet, ImageAPIBaseURL+"/prediction/"+url.PathEscape(predictionID), nil)
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
		if err != nil {
			return "", err
		}
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, defaultMaxBodyLen))
		_ = resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return "", fmt.Errorf("Atlas prediction API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
		}
		var parsed map[string]any
		_ = json.Unmarshal(raw, &parsed)
		data, _ := parsed["data"].(map[string]any)
		status := strings.ToLower(firstNonEmpty(cleanString(parsed["status"]), cleanString(valueFromMap(data, "status"))))
		if status == "completed" || status == "complete" || status == "succeeded" || status == "success" {
			output := firstImageOutput(parsed)
			if output == "" && data != nil {
				output = firstImageOutput(data)
			}
			if output == "" {
				return "", fmt.Errorf("Atlas 이미지 생성은 완료됐지만 output URL이 없습니다")
			}
			return output, nil
		}
		if status == "failed" || status == "error" || status == "canceled" || status == "cancelled" {
			return "", fmt.Errorf("Atlas 이미지 생성 실패: %s", firstNonEmpty(cleanString(parsed["error"]), cleanString(valueFromMap(data, "error")), cleanString(parsed["message"]), "unknown error"))
		}
		time.Sleep(2 * time.Second)
	}
	return "", fmt.Errorf("Atlas 이미지 생성 시간이 초과되었습니다")
}

func downloadImageFile(rawURL, outputPath string, timeout time.Duration) error {
	if strings.TrimSpace(rawURL) == "" {
		return fmt.Errorf("image URL is empty")
	}
	if timeout <= 0 {
		timeout = 2 * time.Minute
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return err
	}
	resp, err := (&http.Client{Timeout: timeout}).Get(rawURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Atlas 이미지 다운로드 실패 %d", resp.StatusCode)
	}
	out, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, io.LimitReader(resp.Body, 64<<20))
	return err
}

func imageModelRequiresReference(model string) bool {
	lower := strings.ToLower(strings.TrimSpace(model))
	return strings.Contains(lower, "/edit") || strings.HasSuffix(lower, "-edit") || strings.Contains(lower, "edit")
}

func applyImageModelOptions(payload map[string]any, model, aspect string) {
	if payload == nil {
		return
	}
	lower := strings.ToLower(strings.TrimSpace(model))
	if strings.Contains(lower, "gpt-image-2") {
		payload["size"] = openAIImageSizeForAspect(aspect)
		payload["n"] = 1
		payload["quality"] = "high"
		payload["output_format"] = "png"
		payload["background"] = "auto"
		return
	}
	if strings.Contains(lower, "qwen") || strings.Contains(lower, "ernie") || strings.Contains(lower, "baidu") || strings.Contains(lower, "alibaba") {
		payload["num_images"] = 1
	}
}

func openAIImageSizeForAspect(aspect string) string {
	switch normalizeImageAspect(aspect) {
	case "16:9", "4:3":
		return "1536x1024"
	case "9:16", "3:4":
		return "1024x1536"
	default:
		return "1024x1024"
	}
}

func normalizeImageAspect(aspect string) string {
	switch strings.TrimSpace(aspect) {
	case "16:9", "9:16", "1:1", "4:3", "3:4":
		return strings.TrimSpace(aspect)
	default:
		return "1:1"
	}
}

func imageSizeForAspect(aspect string) (int, int) {
	switch strings.TrimSpace(aspect) {
	case "16:9":
		return 1024, 576
	case "9:16":
		return 576, 1024
	case "4:3":
		return 1024, 768
	case "3:4":
		return 768, 1024
	default:
		return 768, 768
	}
}

func firstImageOutput(parsed map[string]any) string {
	if parsed == nil {
		return ""
	}
	for _, key := range []string{"output", "outputs", "data", "result", "results", "images", "image", "url", "urls", "image_url", "output_url", "download_url", "file_url", "b64_json", "base64", "data_url"} {
		if out := firstImageOutputValue(parsed[key]); out != "" {
			return out
		}
	}
	return ""
}

func firstImageOutputValue(value any) string {
	switch v := value.(type) {
	case string:
		text := strings.TrimSpace(v)
		if looksLikeMediaOutput(text) {
			return text
		}
		if strings.HasPrefix(text, "iVBOR") || strings.HasPrefix(text, "/9j/") {
			return "data:image/png;base64," + text
		}
	case []any:
		for _, item := range v {
			if out := firstImageOutputValue(item); out != "" {
				return out
			}
		}
	case map[string]any:
		if out := firstImageOutput(v); out != "" {
			return out
		}
	}
	return ""
}

func looksLikeMediaOutput(text string) bool {
	lower := strings.ToLower(strings.TrimSpace(text))
	return strings.HasPrefix(lower, "http://") ||
		strings.HasPrefix(lower, "https://") ||
		strings.HasPrefix(lower, "data:image/") ||
		strings.HasPrefix(lower, "data:video/")
}

func firstPredictionID(parsed map[string]any) string {
	if parsed == nil {
		return ""
	}
	for _, key := range []string{"id", "prediction_id", "predictionId", "task_id", "taskId", "request_id", "requestId"} {
		if id := cleanString(parsed[key]); id != "" {
			return id
		}
	}
	for _, key := range []string{"data", "prediction", "task", "result"} {
		if nested, ok := parsed[key].(map[string]any); ok {
			if id := firstPredictionID(nested); id != "" {
				return id
			}
		}
	}
	return ""
}

func valueFromMap(parsed map[string]any, key string) any {
	if parsed == nil {
		return nil
	}
	return parsed[key]
}

func cleanString(value any) string {
	switch v := value.(type) {
	case string:
		text := strings.TrimSpace(v)
		if text == "" || text == "<nil>" {
			return ""
		}
		return text
	case json.Number:
		return strings.TrimSpace(v.String())
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func truncate(text string, limit int) string {
	if limit <= 0 || len(text) <= limit {
		return text
	}
	return text[:limit] + "..."
}
