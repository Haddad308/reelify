import { create } from 'zustand';
import { ReelClipInput, Caption, TrimPoints, TranscriptionState } from '@/types';
import { filterVisibleCaptions } from '@/lib/utils/reelEditorUtils';

interface ReelEditorState {
  // Current clip data
  currentClip: ReelClipInput | null;
  sourceVideoDuration: number;
  
  // Trim points
  trimPoints: TrimPoints;
  
  // Captions
  captions: Caption[];
  selectedCaptionId: string | null;
  
  // Playback state
  currentPlayheadTime: number;
  isPlaying: boolean;
  
  // Export state
  isExporting: boolean;
  exportProgress: number;
  
  // Transcription state
  transcriptionState: TranscriptionState;
  
  // UI state
  showSafeAreas: boolean;
  
  // Actions
  setCurrentClip: (clip: ReelClipInput) => void;
  setSourceVideoDuration: (duration: number) => void;
  setTrimPoints: (trimPoints: TrimPoints) => void;
  updateTrimStart: (startTime: number) => void;
  updateTrimEnd: (endTime: number) => void;
  setCaptions: (captions: Caption[]) => void;
  updateCaption: (id: string, updates: Partial<Caption>) => void;
  updateCaptionPosition: (id: string, position: { x: number; y: number }) => void;
  updateCaptionStyle: (id: string, style: Partial<Caption['style']>) => void;
  setSelectedCaptionId: (id: string | null) => void;
  setCurrentPlayheadTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsExporting: (exporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  setTranscriptionState: (state: TranscriptionState) => void;
  setShowSafeAreas: (show: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentClip: null,
  sourceVideoDuration: 0,
  trimPoints: { startTime: 0, endTime: 0 },
  captions: [],
  selectedCaptionId: null,
  currentPlayheadTime: 0,
  isPlaying: false,
  isExporting: false,
  exportProgress: 0,
  transcriptionState: { status: 'idle' as const },
  showSafeAreas: false,
};

export const useReelEditorStore = create<ReelEditorState>((set, get) => ({
  ...initialState,

  setCurrentClip: (clip) => {
    set({
      currentClip: clip,
      sourceVideoDuration: clip.sourceVideoDuration,
      trimPoints: {
        startTime: clip.startTime,
        endTime: clip.endTime,
      },
      currentPlayheadTime: clip.startTime,
    });
    
    // Initialize captions from transcription (if available)
    if (clip.transcription && clip.transcription.segments.length > 0) {
      const captions: Caption[] = clip.transcription.segments.map((segment, index) => ({
        id: `caption-${index}`,
        text: segment.text,
        startTime: segment.start,
        endTime: segment.end,
        position: { x: 540, y: 1500 }, // Default position (center-bottom for 9:16)
        style: {
          fontSize: 48,
          fontFamily: 'Arial',
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          textAlign: 'center',
          padding: { top: 10, right: 20, bottom: 10, left: 20 },
        },
        isVisible: true,
        language: segment.language,
      }));

      // Filter captions based on initial trim points
      const filteredCaptions = filterVisibleCaptions(captions, {
        startTime: clip.startTime,
        endTime: clip.endTime,
      });

      set({ captions: filteredCaptions });
    } else {
      // No transcription, start with empty captions
      set({ captions: [] });
    }
  },

  setSourceVideoDuration: (duration) => {
    const { trimPoints } = get();
    // Only update duration, preserve trim points if they're valid
    // Only clamp trim points if they exceed the actual video duration
    let newStartTime = trimPoints.startTime;
    let newEndTime = trimPoints.endTime;
    
    // Clamp start time to valid range [0, duration]
    if (newStartTime < 0) {
      newStartTime = 0;
    } else if (newStartTime > duration) {
      newStartTime = Math.max(0, duration - 0.1);
    }
    
    // Clamp end time to valid range [startTime + 0.1, duration]
    if (newEndTime <= newStartTime) {
      newEndTime = Math.min(duration, newStartTime + 0.1);
    } else if (newEndTime > duration) {
      newEndTime = duration;
    }
    
    // Only update trim points if they were actually changed
    const needsUpdate = 
      newStartTime !== trimPoints.startTime || 
      newEndTime !== trimPoints.endTime;
    
    if (needsUpdate) {
      const newTrimPoints = {
        startTime: newStartTime,
        endTime: newEndTime,
      };
      set({ 
        sourceVideoDuration: duration,
        trimPoints: newTrimPoints,
      });
      // Filter captions based on new trim points
      const { captions } = get();
      const filteredCaptions = filterVisibleCaptions(captions, newTrimPoints);
      set({ captions: filteredCaptions });
    } else {
      // Just update duration, keep trim points as-is
      set({ sourceVideoDuration: duration });
    }
  },

  setTrimPoints: (trimPoints) => {
    const { captions, currentClip } = get();
    
    // If we have original transcription, regenerate captions from it
    if (currentClip?.transcription && currentClip.transcription.segments.length > 0) {
      const newCaptions: Caption[] = currentClip.transcription.segments
        .filter(segment => 
          segment.start >= trimPoints.startTime && 
          segment.end <= trimPoints.endTime
        )
        .map((segment, index) => ({
          id: `caption-${index}`,
          text: segment.text,
          startTime: segment.start,
          endTime: segment.end,
          position: { x: 540, y: 1500 },
          style: {
            fontSize: 48,
            fontFamily: 'Arial',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            textAlign: 'center',
            padding: { top: 10, right: 20, bottom: 10, left: 20 },
          },
          isVisible: true,
          language: segment.language,
        }));
      
      set({ trimPoints, captions: newCaptions });
    } else {
      // Otherwise just filter existing captions
      const filteredCaptions = filterVisibleCaptions(captions, trimPoints);
      set({ trimPoints, captions: filteredCaptions });
    }
  },

  updateTrimStart: (startTime) => {
    const { trimPoints } = get();
    const newTrimPoints = {
      ...trimPoints,
      startTime: Math.max(0, Math.min(startTime, trimPoints.endTime - 0.1)),
    };
    get().setTrimPoints(newTrimPoints);
  },

  updateTrimEnd: (endTime) => {
    const { trimPoints, sourceVideoDuration } = get();
    const newTrimPoints = {
      ...trimPoints,
      endTime: Math.min(sourceVideoDuration, Math.max(endTime, trimPoints.startTime + 0.1)),
    };
    get().setTrimPoints(newTrimPoints);
  },

  setCaptions: (captions) => {
    const { trimPoints } = get();
    const filteredCaptions = filterVisibleCaptions(captions, trimPoints);
    set({ captions: filteredCaptions });
  },

  updateCaption: (id, updates) => {
    const { captions } = get();
    const updatedCaptions = captions.map((caption) =>
      caption.id === id ? { ...caption, ...updates } : caption
    );
    // Don't re-filter when updating - just update the caption
    set({ captions: updatedCaptions });
  },

  updateCaptionPosition: (id, position) => {
    get().updateCaption(id, { position });
  },

  updateCaptionStyle: (id, style) => {
    const { captions } = get();
    const updatedCaptions = captions.map((caption) =>
      caption.id === id
        ? { ...caption, style: { ...caption.style, ...style } }
        : caption
    );
    set({ captions: updatedCaptions });
  },

  setSelectedCaptionId: (id) => {
    set({ selectedCaptionId: id });
  },

  setCurrentPlayheadTime: (time) => {
    set({ currentPlayheadTime: Math.max(0, time) });
  },

  setIsPlaying: (playing) => {
    set({ isPlaying: playing });
  },

  setIsExporting: (exporting) => {
    set({ isExporting: exporting });
  },

  setExportProgress: (progress) => {
    set({ exportProgress: Math.max(0, Math.min(100, progress)) });
  },

  setTranscriptionState: (state) => {
    set({ transcriptionState: state });
  },

  setShowSafeAreas: (show) => {
    set({ showSafeAreas: show });
  },

  reset: () => {
    set(initialState);
  },
}));
