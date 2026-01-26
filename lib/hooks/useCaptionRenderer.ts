'use client';

import { useEffect, useRef } from 'react';
import { useReelEditorStore } from '@/lib/store/useReelEditorStore';
import { ReelCaptionRenderer } from '@/lib/services/ReelCaptionRenderer';

export function useCaptionRenderer(
  videoWidth: number = 1080,
  videoHeight: number = 1920
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { captions, currentPlayheadTime } = useReelEditorStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Render captions
    ReelCaptionRenderer.renderCaptions(
      canvas,
      captions,
      currentPlayheadTime,
      videoWidth,
      videoHeight
    );

    // Debug: Log visible captions
    const visibleCaptions = captions.filter(
      (c) => c.isVisible && currentPlayheadTime >= c.startTime && currentPlayheadTime <= c.endTime
    );
    if (visibleCaptions.length > 0) {
      console.log(`Rendering ${visibleCaptions.length} captions at ${currentPlayheadTime.toFixed(2)}s`);
    }
  }, [captions, currentPlayheadTime, videoWidth, videoHeight]);

  return canvasRef;
}
