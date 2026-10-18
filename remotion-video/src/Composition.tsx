import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  Img,
  Video,
  Loop,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  delayRender,
  continueRender,
} from "remotion";

// ═══════════════════════════════════════════════
// 타입
// ═══════════════════════════════════════════════
export type SceneStyle =
  | "typography" | "card" | "photo" | "quote" | "chart" | "split" | "list" | "icon-grid" | "hero-mark";

export type Motion =
  | "stagger" | "spring" | "slide" | "scale" | "mask" | "tilt" | "kinetic" | "fade";

export type Transition =
  | "fade" | "wipe" | "slide" | "zoom" | "blur-cross";

export type SceneSpec = {
  title?: string;
  body?: string;
  meta?: string;
  quote?: string;
  author?: string;
  counter_from?: number;
  counter_to?: number;
  counter_suffix?: string;
  list_items?: string[];
  icon_labels?: { icon: string; label: string }[];
  duration_sec: number;
  bg?: string;
  fg?: string;
  accent?: string;
  style?: SceneStyle;
  motion?: Motion;
  transition?: Transition;
  image_url?: string;
  video_url?: string;
  image_dim_opacity?: number;
  narration_url?: string;
  narration_duration_sec?: number; // 🎙 TTS 실측 길이 (Audio Sequence 정확 매칭)
  logo_url?: string; // 🏷 브랜드 로고 (hero-mark 씬에 배치)
  // 🎨 AI 가 결정하는 모션 파라미터 — 하드코딩 최소화
  animation?: {
    entry_y_px?: number;        // 시작 Y 오프셋 (60~200)
    entry_x_px?: number;        // 시작 X 오프셋 (-80~80)
    entry_scale?: number;       // 시작 스케일 (0.5~1.2)
    entry_rotation_deg?: number; // 시작 회전 (-20~20)
    entry_blur_px?: number;     // 시작 블러 (0~25)
    spring_damping?: number;    // 5~20 (낮을수록 바운스)
    spring_stiffness?: number;  // 50~200
    hero_size_px?: number;      // 제목 크기 override (80~220)
    word_stagger_sec?: number;  // 스태거 간격 (0.03~0.15)
    ambient_scale_pulse?: number; // hold 구간 pulse amplitude (0~0.08)
    ken_burns_zoom?: number;    // photo zoom end (1.05~1.5)
    ken_burns_pan_px?: number;  // photo pan amount (-200~200)
    // 🎨 레이아웃·타이포 AI 결정
    layout_align?: "left" | "center" | "right";  // 텍스트 정렬
    padding_px?: number;          // 좌우 여백 (40~160)
    meta_size_px?: number;        // 메타 라벨 크기 (18~32)
    body_size_px?: number;        // 본문 크기 (32~64)
    text_stroke_px?: number;      // 흰색 테두리 두께 (0~4, photo 씬용)
    image_dim_opacity?: number;   // photo 씬 어둡기 (0~1)
    bg_pattern?: "solid" | "gradient-vertical" | "gradient-radial" | "split"; // 배경 패턴
    // 🎭 AI 가 고르는 이징·주변 모션·장식
    easing_enter?: "cubic-out" | "cubic-in-out" | "quart-out" | "quint-out" | "expo-out" | "back-out" | "elastic-out" | "bounce-out";
    easing_exit?: "cubic-in" | "cubic-in-out" | "quart-in" | "quint-in" | "expo-in" | "back-in";
    ambient_motion?: "none" | "pulse" | "drift-x" | "drift-y" | "slow-rotate" | "breath";
    ambient_amplitude?: number;   // 0~0.1
    decorations?: Array<"glow" | "dots" | "grid-lines" | "gradient-orb" | "stripe" | "diagonal">; // 배경 장식
    letter_spacing_em?: number;   // 씬 고유 letter-spacing (-0.05 ~ 0.15em)
    line_height?: number;         // 1.0 ~ 1.6
    title_font_weight?: number;   // 300 | 500 | 700 | 900
    body_font_weight?: number;    // 300 | 500 | 700
    highlight_words?: string[];   // 본문 중 강조 단어 (accent 색)
    // 🎨 AI 가 씬마다 다르게 고르는 비주얼·오디오 파라미터
    font_family_override?: string;  // CSS font-family stack (씬마다 타이포 차별화)
    color_filter?: "none" | "sepia" | "warm" | "cool" | "bw" | "vibrant" | "cinematic"; // 씬 컬러 톤
    camera_work?: "still" | "parallax" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right"; // 카메라 워크 시뮬레이션
    narration_voice?: string;       // 씬 전용 TTS 보이스 (gemini-Kore/Zephyr/Puck/Charon/Fenrir 등)
    narration_style?: string;       // 감정·속도 힌트 ("차분하게", "빠르게" ...)
  };
  // 씬 최상위 narration_voice override (하위 호환)
  narration_voice_override?: string;
};

export type Theme = {
  bg: string;
  fg: string;
  accent: string;
  secondary_accent?: string;       // AI 보조 액센트 (그라데이션·장식용)
  font_kr?: string;
  font_display?: string;
  font_google?: string[];
  bgm_fade_in_sec?: number;
  bgm_fade_out_sec?: number;
  default_transition_sec?: number;
  // 🎨 AI 글로벌 무드
  global_letter_spacing?: number;  // -0.05 ~ 0.1em
  global_line_height?: number;     // 1.0 ~ 1.6
  global_font_weight_mode?: "contrast" | "balanced" | "bold" | "light"; // 타이포 무게 대비
  global_bg_gradient_deg?: number; // 0~360 (바탕 그라데이션 각도)
  mood_tag?: string;               // "warm" | "cool" | "hype" | "premium" | "retro" ...
};

export type Props = {
  scenes: SceneSpec[];
  theme: Theme;
  brand?: string;
  cta?: string;
  bgm_url?: string;
  bgm_duration_sec?: number; // BGM 실제 길이 (Loop 프레임 정확 매칭용)
  narration_url?: string;
  bgm_volume?: number;  // 0~1, 기본 0.08
};

export const defaultProps: Props = {
  brand: "Makeke",
  cta: "",
  bgm_volume: 0.08,
  theme: {
    bg: "#0A0A0A", fg: "#F4F1EA", accent: "#FF8C00",
    font_kr: "'Noto Sans KR', sans-serif",
    font_display: "'Oswald', 'Noto Sans KR', sans-serif",
    font_google: ["Oswald:wght@400;900", "Noto+Sans+KR:wght@400;700;900"],
  },
  scenes: [
    { style: "typography", motion: "stagger", transition: "fade", meta: "HOOK", title: "빠르게", body: "영상을 코드로", duration_sec: 3 },
    { style: "chart", motion: "spring", transition: "zoom", counter_from: 0, counter_to: 95, counter_suffix: "%", body: "자동화율", duration_sec: 3 },
    { style: "card", motion: "scale", transition: "slide", meta: "CTA", title: "지금 시작", body: "Makeke.kr", duration_sec: 3 },
  ],
};

// ═══════════════════════════════════════════════
// Google Fonts 자동 로딩
// ═══════════════════════════════════════════════
const GoogleFontsLoader: React.FC<{ families: string[] }> = ({ families }) => {
  const [handle] = React.useState(() => delayRender("loading google fonts"));
  React.useEffect(() => {
    if (!families || families.length === 0) {
      continueRender(handle);
      return;
    }
    const url =
      "https://fonts.googleapis.com/css2?" +
      families.map((f) => `family=${f}`).join("&") + "&display=swap";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    const timer = setTimeout(() => continueRender(handle), 3000);
    link.onload = () => { clearTimeout(timer); continueRender(handle); };
    link.onerror = () => { clearTimeout(timer); continueRender(handle); };
    document.head.appendChild(link);
    return () => {
      clearTimeout(timer);
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, [handle, families]);
  return null;
};

// ═══════════════════════════════════════════════
// 🎬 트랜지션 — sceneFrames 를 직접 받음 (버그 수정)
// ═══════════════════════════════════════════════
const useSceneTransition = (transition: Transition, sceneFrames: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 충분히 긴 씬 보장 — 너무 짧으면 트랜지션 비활성
  const safe = Math.max(2, sceneFrames);
  // 트랜지션 시간: 씬 길이의 30% 이내 + 최대 0.5초
  const transTime = Math.min(fps * 0.5, safe * 0.3);
  const enterEnd = Math.max(1, transTime);
  // exitStart 는 반드시 enterEnd + 1 이상이고 safe - 1 이하
  let exitStart = Math.max(enterEnd + 1, safe - transTime);
  if (exitStart >= safe - 0.5) exitStart = Math.max(enterEnd + 1, safe - 1);
  // 정말 짧으면 트랜지션 없이 정적 opacity 1
  const tooShort = safe < 4 || exitStart >= safe;

  const enter = tooShort ? 1 : interpolate(frame, [0, enterEnd], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const exit = tooShort ? 1 : interpolate(frame, [exitStart, safe], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const style: React.CSSProperties = {};
  if (transition === "fade") {
    style.opacity = Math.min(enter, exit);
  } else if (transition === "wipe") {
    const x = interpolate(enter, [0, 1], [-100, 0]);
    style.transform = `translateX(${x}%)`;
    style.opacity = exit;
  } else if (transition === "slide") {
    const y = interpolate(enter, [0, 1], [80, 0]);
    style.transform = `translateY(${y}px)`;
    style.opacity = Math.min(enter, exit);
  } else if (transition === "zoom") {
    const scale = interpolate(enter, [0, 1], [0.85, 1]);
    style.transform = `scale(${scale})`;
    style.opacity = Math.min(enter, exit);
  } else if (transition === "blur-cross") {
    const blur = interpolate(enter, [0, 1], [20, 0]);
    // exit 은 1→0 으로 감소하므로 inputRange 를 [0, 1] 로 쓰려면 output 순서를 뒤집는다
    const blurOut = interpolate(exit, [0, 1], [20, 0]);
    style.filter = `blur(${Math.max(blur, blurOut)}px)`;
    style.opacity = Math.min(enter, exit);
  } else {
    style.opacity = Math.min(enter, exit);
  }
  return { style, enter, exit, frame, sceneFrames: safe };
};

// ═══════════════════════════════════════════════
// 공통 헬퍼 — spring 등장 (탄성감 강화)
// ═══════════════════════════════════════════════
const useEnterSpring = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame, fps, config: { damping: 10, stiffness: 180, mass: 0.7 } });
};

// AI 가 고른 이징 이름을 Remotion Easing 함수로 매핑
const EASING_MAP: Record<string, (t: number) => number> = {
  "cubic-out": Easing.out(Easing.cubic),
  "cubic-in-out": Easing.inOut(Easing.cubic),
  "cubic-in": Easing.in(Easing.cubic),
  "quart-out": Easing.out(Easing.quad), // Remotion 에 quart 없어 quad 로 근사
  "quart-in": Easing.in(Easing.quad),
  "quint-out": Easing.out(Easing.ease),
  "quint-in": Easing.in(Easing.ease),
  "expo-out": Easing.out(Easing.exp),
  "expo-in": Easing.in(Easing.exp),
  "back-out": Easing.out(Easing.back(1.6)),
  "back-in": Easing.in(Easing.back(1.4)),
  "elastic-out": Easing.out(Easing.elastic(0.9)),
  "bounce-out": Easing.out(Easing.bounce),
};
const _ease = (name?: string) => EASING_MAP[name || "cubic-out"] || Easing.out(Easing.cubic);

// 씬 ambient motion → transform
const ambientTransform = (type: string | undefined, frame: number, fps: number, amp: number) => {
  const t = frame / fps;
  switch (type) {
    case "pulse": return `scale(${1 + Math.sin(t * Math.PI * 1.2) * amp})`;
    case "drift-x": return `translateX(${Math.sin(t * Math.PI * 0.3) * amp * 400}px)`;
    case "drift-y": return `translateY(${Math.sin(t * Math.PI * 0.3) * amp * 200}px)`;
    case "slow-rotate": return `rotate(${Math.sin(t * Math.PI * 0.2) * amp * 60}deg)`;
    case "breath": return `scale(${1 + Math.sin(t * Math.PI * 0.8) * amp})`;
    default: return "none";
  }
};

// 배경 장식 레이어 — AI 가 고른 decorations 배열 대로 렌더
const DecorationLayer: React.FC<{ decor: string[]; accent: string; secondary: string }> = ({ decor, accent, secondary }) => {
  if (!decor || decor.length === 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {/* 장식은 미니멀하게 — opacity 낮춰 타이포에 시선 집중 */}
      {decor.includes("glow") && (
        <div style={{
          position: "absolute", width: 1100, height: 1100, left: "50%", top: "50%",
          transform: "translate(-50%,-50%)",
          background: `radial-gradient(circle, ${accent}22 0%, transparent 75%)`,
          filter: "blur(90px)",
        }} />
      )}
      {decor.includes("gradient-orb") && (
        <div style={{
          position: "absolute", width: 900, height: 900, right: -220, top: -220,
          background: `radial-gradient(circle, ${secondary || accent}44 0%, transparent 70%)`,
          filter: "blur(80px)",
        }} />
      )}
      {decor.includes("dots") && (
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: `radial-gradient(${accent} 1px, transparent 1.5px)`,
          backgroundSize: "60px 60px",
        }} />
      )}
      {decor.includes("grid-lines") && (
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
          backgroundSize: "120px 120px",
        }} />
      )}
      {decor.includes("stripe") && (
        <div style={{
          position: "absolute", inset: 0, opacity: 0.05,
          backgroundImage: `linear-gradient(90deg, ${accent} 0 40px, transparent 40px 100%)`,
          backgroundSize: "240px 100%",
        }} />
      )}
      {decor.includes("diagonal") && (
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: `repeating-linear-gradient(45deg, ${accent}, ${accent} 1px, transparent 1px, transparent 30px)`,
        }} />
      )}
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════
// 씬 스타일 컴포넌트들
// ═══════════════════════════════════════════════

// 1. Typography — AI 가 정의한 animation params 사용
const TypographyScene: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = scene.fg || theme.fg;
  const accent = scene.accent || theme.accent;
  const words = (scene.body || "").split(/\s+/).filter(Boolean);
  const a = scene.animation || {};
  const damping = a.spring_damping ?? 9;
  const stiffness = a.spring_stiffness ?? 110;
  const entryY = a.entry_y_px ?? 120;
  const entryScale = a.entry_scale ?? 1.15;
  const entryBlur = a.entry_blur_px ?? 18;
  const wordStagger = a.word_stagger_sec ?? 0.06;
  const heroSize = a.hero_size_px ?? 160;
  const metaIn = spring({ frame, fps, config: { damping: damping + 1, stiffness: stiffness + 30 } });
  const titleIn = spring({ frame: frame - fps * 0.2, fps, config: { damping, stiffness, mass: 1.1 } });
  const titleY = interpolate(titleIn, [0, 1], [entryY, 0]);
  const titleScale = interpolate(titleIn, [0, 1], [entryScale, 1]);
  const titleBlur = interpolate(titleIn, [0, 1], [entryBlur, 0]);
  const align = a.layout_align ?? "left";
  const pad = a.padding_px ?? 80;
  const metaSize = a.meta_size_px ?? 24;
  const bodySize = a.body_size_px ?? 56;
  return (
    <AbsoluteFill style={{
      justifyContent: "center", alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
      padding: `0 ${pad}px`, textAlign: align === "center" ? "center" : align === "right" ? "right" : "left",
      color: fg, fontFamily: theme.font_display,
    }}>
      {scene.meta && (
        <div style={{
          fontSize: metaSize, fontWeight: 600, letterSpacing: `${interpolate(metaIn,[0,1],[0.8,0.3])}em`,
          color: accent, textTransform: "uppercase", marginBottom: 24,
          opacity: metaIn, transform: `translateX(${interpolate(metaIn,[0,1],[-30,0])}px)`,
        }}>
          {scene.meta}
        </div>
      )}
      {scene.title && (
        <h1 style={{
          fontSize: heroSize, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", margin: 0,
          opacity: titleIn, transform: `translateY(${titleY}px) scale(${titleScale})`,
          filter: `blur(${titleBlur}px)`,
        }}>
          {scene.title}
        </h1>
      )}
      <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: "0 0.4em", fontFamily: theme.font_kr, fontSize: bodySize, fontWeight: 600, justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }}>
        {words.map((w, i) => {
          const delay = 0.45 + i * wordStagger;
          const wIn = spring({ frame: frame - fps * delay, fps, config: { damping: damping + 1, stiffness: stiffness + 20 } });
          const wY = interpolate(wIn, [0, 1], [entryY * 0.5, 0]);
          const wScale = interpolate(wIn, [0, 1], [0.85, 1]);
          return <span key={i} style={{ opacity: wIn, transform: `translateY(${wY}px) scale(${wScale})`, display: "inline-block" }}>{w}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

// 2. Card — 스프링 스케일 + 바 확장 + 로테이션 + 발광
const CardScene: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fg = scene.fg || theme.fg;
  const accent = scene.accent || theme.accent;
  const a = scene.animation || {};
  const enter = spring({ frame, fps, config: { damping: a.spring_damping ?? 8, stiffness: a.spring_stiffness ?? 90, mass: 1 } });
  const y = interpolate(enter, [0, 1], [a.entry_y_px ?? 150, 0]);
  const scaleIn = interpolate(enter, [0, 1], [a.entry_scale ?? 0.6, 1]);
  const rot = interpolate(enter, [0, 1], [a.entry_rotation_deg ?? -8, 0]);
  const barScale = interpolate(frame, [fps * 0.1, fps * 0.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  // Ambient pulse (hold 구간)
  const pulseAmt = a.ambient_scale_pulse ?? 0.02;
  const holdStart = fps * 1.2;
  const pulse = 1 + Math.sin(Math.max(0, frame - holdStart) / fps * Math.PI * 0.8) * pulseAmt;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 80px", color: fg, fontFamily: theme.font_display, textAlign: "center" }}>
      <div style={{ transform: `translateY(${y}px) scale(${scaleIn * pulse}) rotate(${rot}deg)`, opacity: enter, maxWidth: 900 }}>
        <div style={{ width: 120, height: 6, background: accent, margin: "0 auto 40px", transform: `scaleX(${barScale})`, transformOrigin: "center", boxShadow: `0 0 20px ${accent}80` }} />
        {scene.meta && <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.35em", color: accent, textTransform: "uppercase", marginBottom: 24 }}>{scene.meta}</div>}
        {scene.title && <h1 style={{ fontSize: a.hero_size_px ?? 130, fontWeight: 900, lineHeight: 1.05, margin: 0, letterSpacing: "-0.03em" }}>{scene.title}</h1>}
        {scene.body && <p style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.5, marginTop: 32, fontFamily: theme.font_kr, opacity: 0.9 }}>{scene.body}</p>}
      </div>
    </AbsoluteFill>
  );
};

// 3. Photo — Ken Burns 줌
const PhotoScene: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = scene.fg || theme.fg;
  const accent = scene.accent || theme.accent;
  const enter = useEnterSpring();
  const totalFrames = Math.max(1, scene.duration_sec * fps);
  const a = scene.animation || {};
  const zoomEnd = a.ken_burns_zoom ?? 1.25;
  const panEnd = a.ken_burns_pan_px ?? -120;
  const zoom = interpolate(frame, [0, totalFrames], [1, zoomEnd], { extrapolateRight: "clamp" });
  const pan = interpolate(frame, [0, totalFrames], [0, panEnd], { extrapolateRight: "clamp" });
  // AI 가 결정 (scene.animation.image_dim_opacity 또는 scene.image_dim_opacity, 기본 0.25)
  const dim = a.image_dim_opacity ?? scene.image_dim_opacity ?? 0.25;
  const strokePx = a.text_stroke_px ?? 3;
  return (
    <AbsoluteFill style={{ color: fg, fontFamily: theme.font_display }}>
      {scene.video_url ? (
        <Video src={scene.video_url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom}) translateX(${pan}px)` }} />
      ) : scene.image_url ? (
        <Img src={scene.image_url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom}) translateX(${pan}px)` }} />
      ) : (
        <AbsoluteFill style={{ background: scene.bg || theme.bg }} />
      )}
      {/* 살짝 어둡게만 (이미지 또렷함 유지) */}
      <AbsoluteFill style={{ background: `rgba(0,0,0,${dim})` }} />
      <AbsoluteFill style={{ padding: "120px 80px 200px", justifyContent: "flex-end", alignItems: "flex-start" }}>
        <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [80, 0])}px)`, opacity: enter }}>
          {scene.meta && (
            <div style={{
              fontSize: 22, fontWeight: 700, letterSpacing: "0.3em", color: accent, textTransform: "uppercase", marginBottom: 18,
              WebkitTextStrokeWidth: 1, WebkitTextStrokeColor: "#ffffff",
              textShadow: "0 0 8px rgba(255,255,255,0.6), 0 0 16px rgba(0,0,0,0.8)",
            }}>{scene.meta}</div>
          )}
          {scene.title && (
            <h1 style={{
              fontSize: a.hero_size_px ?? 130, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0,
              WebkitTextStrokeWidth: strokePx, WebkitTextStrokeColor: "#ffffff",
              textShadow: "0 0 6px rgba(255,255,255,0.9), 0 0 18px rgba(0,0,0,0.85), 0 4px 24px rgba(0,0,0,0.7)",
            }}>{scene.title}</h1>
          )}
          {scene.body && (
            <p style={{
              fontSize: a.body_size_px ?? 42, fontWeight: 600, lineHeight: 1.4, marginTop: 24, fontFamily: theme.font_kr,
              WebkitTextStrokeWidth: Math.max(1, strokePx * 0.5), WebkitTextStrokeColor: "#ffffff",
              textShadow: "0 0 4px rgba(255,255,255,0.8), 0 2px 12px rgba(0,0,0,0.85)",
            }}>{scene.body}</p>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 4. Quote
const QuoteScene: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const enter = useEnterSpring();
  const fg = scene.fg || theme.fg;
  const accent = scene.accent || theme.accent;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 120px", color: fg, fontFamily: theme.font_kr, textAlign: "center" }}>
      <div style={{ opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)` }}>
        <div style={{ fontSize: 160, color: accent, fontWeight: 900, lineHeight: 0.5, marginBottom: 40 }}>"</div>
        <p style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.35, margin: 0, letterSpacing: "-0.02em" }}>{scene.quote || scene.body || scene.title || ""}</p>
        {scene.author && <div style={{ marginTop: 60, fontSize: 28, fontWeight: 500, color: accent, letterSpacing: "0.15em", textTransform: "uppercase" }}>— {scene.author}</div>}
      </div>
    </AbsoluteFill>
  );
};

// 5. Chart
const ChartScene: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = scene.fg || theme.fg;
  const accent = scene.accent || theme.accent;
  const from = scene.counter_from ?? 0;
  const to = scene.counter_to ?? 100;
  const suffix = scene.counter_suffix || "";
  const val = interpolate(frame, [fps * 0.3, fps * 1.8], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const progress = interpolate(frame, [fps * 0.3, fps * 1.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const circ = 2 * Math.PI * 280;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 80px", color: fg, fontFamily: theme.font_display, flexDirection: "column" }}>
      {scene.meta && <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.3em", color: accent, textTransform: "uppercase", marginBottom: 40 }}>{scene.meta}</div>}
      <div style={{ position: "relative", width: 600, height: 600 }}>
        <svg width="600" height="600" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
          <circle cx="300" cy="300" r="280" fill="none" stroke={accent} strokeOpacity="0.15" strokeWidth="12" />
          <circle cx="300" cy="300" r="280" fill="none" stroke={accent} strokeWidth="12" strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} strokeLinecap="round" />
        </svg>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontSize: 220, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.05em" }}>{Math.round(val)}{suffix}</div>
        </AbsoluteFill>
      </div>
      {scene.body && <p style={{ fontSize: 40, fontWeight: 500, lineHeight: 1.4, marginTop: 40, fontFamily: theme.font_kr, textAlign: "center" }}>{scene.body}</p>}
    </AbsoluteFill>
  );
};

// 6. Split
const SplitScene: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = scene.fg || theme.fg;
  const accent = scene.accent || theme.accent;
  const parts = (scene.body || "").split("|");
  const left = scene.title || parts[0] || "";
  const right = parts[1] || scene.meta || "";
  const leftIn = interpolate(frame, [fps * 0.2, fps * 0.8], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const rightIn = interpolate(frame, [fps * 0.5, fps * 1.1], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ color: fg, fontFamily: theme.font_display, flexDirection: "column" }}>
      <div style={{ flex: 1, background: scene.bg || theme.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
        <div style={{ opacity: leftIn, transform: `translateY(${interpolate(leftIn, [0, 1], [40, 0])}px)`, textAlign: "center" }}>
          <div style={{ fontSize: 28, color: accent, opacity: 0.7, letterSpacing: "0.2em", marginBottom: 16 }}>BEFORE</div>
          <div style={{ fontSize: 100, fontWeight: 900, opacity: 0.55 }}>{left}</div>
        </div>
      </div>
      <div style={{ height: 6, background: accent }} />
      <div style={{ flex: 1, background: accent, color: scene.bg || theme.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
        <div style={{ opacity: rightIn, transform: `translateY(${interpolate(rightIn, [0, 1], [40, 0])}px)`, textAlign: "center" }}>
          <div style={{ fontSize: 28, opacity: 0.75, letterSpacing: "0.2em", marginBottom: 16 }}>AFTER</div>
          <div style={{ fontSize: 120, fontWeight: 900 }}>{right}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 7. List — 리스트 아이템 스태거
const ListScene: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = scene.fg || theme.fg;
  const accent = scene.accent || theme.accent;
  const items = scene.list_items || (scene.body || "").split("\n").filter(Boolean);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-start", padding: "0 100px", color: fg, fontFamily: theme.font_display }}>
      <div style={{ width: "100%" }}>
        {scene.title && <h2 style={{ fontSize: 80, fontWeight: 900, margin: 0, marginBottom: 40, letterSpacing: "-0.02em" }}>{scene.title}</h2>}
        {items.map((item, i) => {
          const d = 0.3 + i * 0.2;
          const itIn = interpolate(frame, [fps * d, fps * (d + 0.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const itX = interpolate(frame, [fps * d, fps * (d + 0.4)], [-60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 28, opacity: itIn, transform: `translateX(${itX}px)` }}>
              <div style={{ width: 60, height: 60, borderRadius: 30, background: accent, color: scene.bg || theme.bg, fontSize: 32, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ fontSize: 48, fontWeight: 600, lineHeight: 1.3, fontFamily: theme.font_kr, flex: 1 }}>{item}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// 8. Icon Grid — 아이콘 + 라벨 그리드
// Lucide 아이콘 이름 → 이모지 자동 매핑 (AI 가 실수로 lucide 이름 넣어도 보기 좋게 변환)
const LUCIDE_TO_EMOJI: Record<string, string> = {
  target: "🎯", clock: "⏰", zap: "⚡", star: "⭐", heart: "❤️", check: "✅",
  shield: "🛡", trophy: "🏆", rocket: "🚀", crown: "👑", gem: "💎", fire: "🔥",
  bolt: "⚡", sparkles: "✨", "thumbs-up": "👍", smile: "😊",
  user: "👤", users: "👥", phone: "📞", mail: "📧", "message-circle": "💬",
  calendar: "📅", "map-pin": "📍", globe: "🌐", shopping: "🛍", "shopping-cart": "🛒",
  gift: "🎁", music: "🎵", camera: "📷", video: "🎥", play: "▶️",
  search: "🔍", lock: "🔒", key: "🔑", award: "🏅", medal: "🏅",
  "chef-hat": "👨‍🍳", utensils: "🍽", coffee: "☕", "cup-soda": "🥤",
  cake: "🍰", "ice-cream": "🍦", pizza: "🍕", burger: "🍔",
  building: "🏢", home: "🏠", store: "🏪", briefcase: "💼", "trending-up": "📈",
  "bar-chart": "📊", "pie-chart": "📊", "credit-card": "💳", wallet: "💰",
  package: "📦", truck: "🚚", "alert-triangle": "⚠️", info: "ℹ️",
  thumbsup: "👍", lightbulb: "💡", bell: "🔔", clipboard: "📋",
  scissors: "✂️", wrench: "🔧", settings: "⚙", paintbrush: "🎨",
  leaf: "🌿", flower: "🌸", sun: "☀️", moon: "🌙", "cloud": "☁️",
  brain: "🧠", eye: "👁", hand: "✋", thumbs: "👍",
};

const _resolveIcon = (raw: string): string => {
  if (!raw) return "✨";
  const trimmed = raw.trim();
  // 이미 이모지면 그대로 (Latin 알파벳 이외 = 이모지 또는 한자 가능성)
  if (!/^[a-z0-9_-]+$/i.test(trimmed)) return trimmed;
  const key = trimmed.toLowerCase();
  return LUCIDE_TO_EMOJI[key] || "✨";
};

const IconGridScene: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = scene.fg || theme.fg;
  const accent = scene.accent || theme.accent;
  const items = scene.icon_labels || [];
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80, color: fg, fontFamily: theme.font_display }}>
      {scene.title && <h2 style={{ fontSize: 72, fontWeight: 900, margin: 0, marginBottom: 60, textAlign: "center" }}>{scene.title}</h2>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, maxWidth: 900 }}>
        {items.slice(0, 4).map((it, i) => {
          const d = 0.2 + i * 0.15;
          const itIn = interpolate(frame, [fps * d, fps * (d + 0.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const itY = interpolate(frame, [fps * d, fps * (d + 0.4)], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ padding: 40, borderRadius: 24, background: `${accent}15`, border: `2px solid ${accent}30`, opacity: itIn, transform: `translateY(${itY}px)`, textAlign: "center" }}>
              <div style={{ fontSize: 90, marginBottom: 16 }}>{_resolveIcon(it.icon)}</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: theme.font_kr }}>{it.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// 9. Hero Mark — 큰 브랜드 마크 + 태그라인 + 로고 (CTA/엔딩용)
const HeroMarkScene: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = scene.fg || theme.fg;
  const accent = scene.accent || theme.accent;
  const enter = useEnterSpring();
  const pulse = 1 + Math.sin((frame / fps) * Math.PI * 2 * 0.6) * 0.03;
  // 글자 수 기반 동적 폰트 사이즈 — 9:16 (1080w) 기준 잘림 방지
  const titleText = scene.title || "";
  const len = titleText.length;
  const titleSize = len <= 4 ? 180 : len <= 8 ? 130 : len <= 14 ? 96 : len <= 20 ? 72 : 56;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80, color: fg, fontFamily: theme.font_display, textAlign: "center" }}>
      <div style={{
        opacity: enter,
        transform: `scale(${pulse * interpolate(enter, [0, 1], [0.85, 1])})`,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 32,
        maxWidth: "90%",
      }}>
        {(scene as any).logo_url && (
          <Img src={(scene as any).logo_url} style={{ maxWidth: 280, maxHeight: 280, objectFit: "contain", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.3))" }} />
        )}
        {scene.meta && <div style={{ fontSize: 24, letterSpacing: "0.4em", color: accent, textTransform: "uppercase", fontWeight: 700 }}>{scene.meta}</div>}
        <h1 style={{
          fontSize: titleSize, fontWeight: 900, lineHeight: 1.05,
          letterSpacing: "-0.04em", margin: 0,
          wordBreak: "keep-all", overflowWrap: "break-word",
        }}>{titleText}</h1>
        {scene.body && <div style={{ fontSize: Math.max(24, Math.min(36, 360 / Math.max(8, scene.body.length))), letterSpacing: "0.2em", color: accent, fontWeight: 500, maxWidth: "90%" }}>{scene.body}</div>}
      </div>
    </AbsoluteFill>
  );
};

const SCENE_STYLES: Record<SceneStyle, React.FC<{ scene: SceneSpec; theme: Theme }>> = {
  typography: TypographyScene,
  card: CardScene,
  photo: PhotoScene,
  quote: QuoteScene,
  chart: ChartScene,
  split: SplitScene,
  list: ListScene,
  "icon-grid": IconGridScene,
  "hero-mark": HeroMarkScene,
};

// Scene wrapper — 배경 + 장식 + ambient motion + 스타일 컴포넌트 + 트랜지션
const SceneWrapper: React.FC<{ scene: SceneSpec; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneFrames = Math.max(1, Math.round(scene.duration_sec * fps));
  const { style: transStyle } = useSceneTransition(scene.transition || "fade", sceneFrames);
  const a = scene.animation || {};
  const bg = scene.bg || theme.bg;
  const accent = scene.accent || theme.accent;
  const secondary = theme.secondary_accent || accent;
  const decor = a.decorations || [];
  const ambient = ambientTransform(a.ambient_motion, frame, fps, a.ambient_amplitude ?? 0.02);
  // 씬 내부 ambient 는 엔트리가 끝난 뒤(1초 후)부터 적용되게 페이드
  const ambientMix = frame > fps * 0.8 ? ambient : "none";
  const StyleComponent = SCENE_STYLES[scene.style || "typography"] || TypographyScene;
  // 배경 패턴 렌더
  const bgStyle: React.CSSProperties = { backgroundColor: bg };
  if (a.bg_pattern === "gradient-vertical") {
    bgStyle.background = `linear-gradient(180deg, ${bg}, ${secondary})`;
  } else if (a.bg_pattern === "gradient-radial") {
    bgStyle.background = `radial-gradient(ellipse at center, ${secondary}, ${bg})`;
  } else if (a.bg_pattern === "split") {
    bgStyle.background = `linear-gradient(90deg, ${bg} 50%, ${secondary} 50%)`;
  } else if (theme.global_bg_gradient_deg !== undefined && secondary !== accent) {
    bgStyle.background = `linear-gradient(${theme.global_bg_gradient_deg}deg, ${bg}, ${secondary})`;
  }
  // 🎨 color filter — AI 가 씬마다 고르는 컬러 톤
  const filter = (() => {
    switch (a.color_filter) {
      case "sepia": return "sepia(0.55) contrast(1.05)";
      case "warm": return "hue-rotate(-10deg) saturate(1.15) brightness(1.02)";
      case "cool": return "hue-rotate(10deg) saturate(0.95) brightness(0.98)";
      case "bw": return "grayscale(1) contrast(1.1)";
      case "vibrant": return "saturate(1.35) contrast(1.08)";
      case "cinematic": return "contrast(1.12) saturate(1.1) brightness(0.96)";
      default: return undefined;
    }
  })();
  return (
    <AbsoluteFill style={{ ...bgStyle, ...transStyle, filter }}>
      <DecorationLayer decor={decor} accent={accent} secondary={secondary} />
      <AbsoluteFill style={{ transform: ambientMix, transformOrigin: "center" }}>
        <StyleComponent scene={scene} theme={theme} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// BGM 감싸기 — 각 루프 사이클을 Sequence 로 배치 + 전체 영상 기준 페이드 계산
const BgmTrack: React.FC<{ url: string; peakVolume: number; clipFrames: number; totalFrames: number; fadeInSec: number; fadeOutSec: number }> = ({
  url, peakVolume, clipFrames, totalFrames, fadeInSec, fadeOutSec,
}) => {
  const { fps } = useVideoConfig();
  const fadeIn = Math.round(fps * fadeInSec);
  const fadeOut = Math.round(fps * fadeOutSec);
  // 루프 횟수 계산
  const loops = Math.ceil(totalFrames / clipFrames);
  const elems = [];
  for (let i = 0; i < loops; i++) {
    const absStart = i * clipFrames;
    // 이 루프 내 Audio 의 frame f 는 0~clipFrames → 절대 프레임 absStart + f
    const volumeFn = (f: number) => {
      const abs = absStart + f;
      const fadeInVol = interpolate(abs, [0, fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const fadeOutVol = interpolate(abs, [totalFrames - fadeOut, totalFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return peakVolume * Math.min(fadeInVol, fadeOutVol);
    };
    elems.push(
      <Sequence key={i} from={absStart} durationInFrames={clipFrames}>
        <Audio src={url} volume={volumeFn} />
      </Sequence>
    );
  }
  return <>{elems}</>;
};

export const MakekeComposition: React.FC<Props> = ({ scenes, theme, bgm_url, bgm_duration_sec, narration_url, bgm_volume }) => {
  const { fps } = useVideoConfig();
  let cursor = 0;
  const bgmLoopFrames = Math.max(fps, Math.round((bgm_duration_sec ?? 30) * fps));
  // 씬 슬롯 길이: visual·audio 동기화를 위해 sceneFrames 와 ttsFrames 중 큰 값 사용
  const slotFor = (sc: SceneSpec) => {
    const sceneFrames = Math.max(1, Math.round((sc.duration_sec || 4) * fps));
    const ttsFrames = sc.narration_duration_sec
      ? Math.round(sc.narration_duration_sec * fps) + Math.round(fps * 0.3)
      : 0;
    return Math.max(sceneFrames, ttsFrames);
  };
  const totalFrames = scenes.reduce((acc, sc) => acc + slotFor(sc), 0);
  const peakVolume = bgm_volume ?? 0.08;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {theme.font_google && theme.font_google.length > 0 && <GoogleFontsLoader families={theme.font_google} />}
      {/* 🎵 BGM — AI 결정 페이드 인·아웃 시간 */}
      {bgm_url && (
        <BgmTrack
          url={bgm_url}
          peakVolume={peakVolume}
          clipFrames={bgmLoopFrames}
          totalFrames={totalFrames}
          fadeInSec={theme.bgm_fade_in_sec ?? 0.6}
          fadeOutSec={theme.bgm_fade_out_sec ?? 1.2}
        />
      )}
      {/* ⚠ 전역 narration 은 씬별 narration 과 겹쳐 TTS 가 끊겨 들리게 하므로 제거.
          씬별 sc.narration_url 만 사용. (전역 narration_url 은 레거시 props) */}
      {/* 🎙 씬별 나레이션 — Audio cursor 와 Visual cursor 를 동일하게 유지해
          두 씬 audio 가 겹치지 않도록 한다. 씬 길이는 백엔드가 TTS 실측 + 여유로
          이미 늘려서 보내주므로 audio Sequence 길이도 sceneFrames 로 통일. */}
      {(() => {
        let narrCursor = 0;
        const narrElems: React.ReactNode[] = [];
        scenes.forEach((sc, i) => {
          const sceneFrames = Math.max(1, Math.round(sc.duration_sec * fps));
          // 백엔드 보강이 부족할 경우의 안전 마진 — narrFrames 가 sceneFrames 보다 크면
          // 그만큼 두 cursor 를 함께 늘려서 visual/audio 동기 유지
          const ttsFrames = sc.narration_duration_sec
            ? Math.round(sc.narration_duration_sec * fps) + Math.round(fps * 0.3)
            : 0;
          const slotFrames = Math.max(sceneFrames, ttsFrames);
          if (sc.narration_url) {
            narrElems.push(
              <Sequence key={`n${i}`} from={narrCursor} durationInFrames={slotFrames}>
                <Audio src={sc.narration_url} volume={1} />
              </Sequence>
            );
          }
          narrCursor += slotFrames;
        });
        return narrElems;
      })()}
      {scenes.map((sc, i) => {
        const frames = slotFor(sc); // audio 와 동일 슬롯 → visual·audio sync 보장
        const el = (
          <Sequence key={i} from={cursor} durationInFrames={frames}>
            <SceneWrapper scene={sc} theme={theme} />
          </Sequence>
        );
        cursor += frames;
        return el;
      })}
    </AbsoluteFill>
  );
};
