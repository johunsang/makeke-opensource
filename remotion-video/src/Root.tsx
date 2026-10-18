import React from "react";
import { Composition } from "remotion";
import { MakekeComposition, defaultProps, Props } from "./Composition";

/**
 * 렌더 전 calculateMetadata 로 씬 duration 합산 → 최종 durationInFrames 계산.
 * 이러면 --duration-in-frames CLI 플래그 안 써도 props 대로 정확한 길이의 영상이 만들어짐.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Makeke"
        component={MakekeComposition}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={90}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          const fps = 30;
          // Composition 의 slotFor 와 동일 로직 — visual·audio sync + 정확한 영상 길이
          const totalSec = (props.scenes || []).reduce((acc: number, sc: any) => {
            const dur = Math.max(1, Number(sc.duration_sec) || 4);
            const tts = Number(sc.narration_duration_sec) || 0;
            return acc + Math.max(dur, tts > 0 ? tts + 0.3 : 0);
          }, 0);
          // 마지막 씬 나레이션이 잘리지 않도록 2초 tail buffer 추가
          const frames = Math.max(fps, Math.round((totalSec + 2) * fps));
          return {
            durationInFrames: frames,
            fps,
            width: 1080,
            height: 1920,
          };
        }}
      />
    </>
  );
};
