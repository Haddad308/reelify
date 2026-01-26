import { Caption, ExportSettings } from '@/types';

/**
 * Apply text transformation
 */
function applyTextTransform(
  text: string,
  transform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
): string {
  if (!transform || transform === 'none') {
    return text;
  }

  switch (transform) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      return text
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    default:
      return text;
  }
}

/**
 * Build FFmpeg drawtext filter for captions
 * If caption has keyword highlights, returns array of filters (one per segment)
 * Otherwise returns single filter
 */
export function buildCaptionFilter(
  caption: Caption,
  trimStart: number,
  videoWidth: number = 1080,
  videoHeight: number = 1920
): string {
  // Check if we have keyword highlights
  const hasKeywords = caption.style.keywordHighlights && caption.style.keywordHighlights.length > 0;

  if (hasKeywords) {
    return buildCaptionWithKeywordFilters(caption, trimStart, videoWidth, videoHeight);
  }

  return buildSimpleCaptionFilter(caption, trimStart, videoWidth, videoHeight);
}

/**
 * Build simple caption filter (no keyword highlighting)
 */
function buildSimpleCaptionFilter(
  caption: Caption,
  trimStart: number,
  videoWidth: number,
  videoHeight: number
): string {
  // Adjust caption timing relative to trim start
  const captionStart = Math.max(0, caption.startTime - trimStart);
  const captionEnd = Math.max(0, caption.endTime - trimStart);

  // Apply text transform
  let text = applyTextTransform(caption.text, caption.style.textTransform);

  // Escape text for FFmpeg
  const escapedText = text.replace(/'/g, "\\'").replace(/:/g, "\\:");

  // Calculate position (FFmpeg uses top-left origin)
  const x = caption.position.x;
  const y = caption.position.y;

  // Build filter options
  const options: string[] = [
    `text='${escapedText}'`,
    `fontsize=${caption.style.fontSize}`,
    `fontcolor=${caption.style.color.replace('#', '0x')}`,
    `x=${x}`,
    `y=${y}`,
    `enable='between(t,${captionStart},${captionEnd})'`,
  ];

  // Font weight
  if (caption.style.fontWeight && caption.style.fontWeight !== 'normal') {
    options.push(`fontweight=${caption.style.fontWeight}`);
  }

  if (caption.style.textAlign) {
    options.push(`text_align=${caption.style.textAlign}`);
  }

  if (caption.style.backgroundColor && caption.style.backgroundColor !== 'transparent') {
    options.push(`box=1`);
    const bgColor = caption.style.backgroundColor.replace('#', '0x');
    options.push(`boxcolor=${bgColor}`);
  }

  if (caption.style.strokeColor && caption.style.strokeWidth) {
    options.push(`borderw=${caption.style.strokeWidth}`);
    options.push(`bordercolor=${caption.style.strokeColor.replace('#', '0x')}`);
  }

  // Shadow support
  if (caption.style.shadow && (caption.style.shadow.blur > 0 || caption.style.shadow.offsetX !== 0 || caption.style.shadow.offsetY !== 0)) {
    options.push(`shadowcolor=${caption.style.shadow.color.replace('#', '0x')}`);
    options.push(`shadowx=${caption.style.shadow.offsetX}`);
    options.push(`shadowy=${caption.style.shadow.offsetY}`);
  }

  // Opacity (alpha channel)
  if (caption.style.opacity !== undefined && caption.style.opacity < 1) {
    const alpha = Math.round(caption.style.opacity * 255).toString(16).padStart(2, '0');
    // Append alpha to fontcolor
    const colorWithAlpha = caption.style.color.replace('#', '0x') + alpha;
    // Replace the fontcolor option
    const colorIndex = options.findIndex(opt => opt.startsWith('fontcolor='));
    if (colorIndex !== -1) {
      options[colorIndex] = `fontcolor=${colorWithAlpha}`;
    }
  }

  return `drawtext=${options.join(':')}`;
}

/**
 * Build caption filters with keyword highlighting
 * Creates multiple drawtext filters - one for each text segment
 */
function buildCaptionWithKeywordFilters(
  caption: Caption,
  trimStart: number,
  videoWidth: number,
  videoHeight: number
): string {
  // For FFmpeg, keyword highlighting is complex to implement properly
  // We'll render it as a single caption with the base style
  // True multi-colored text within a single caption requires complex filter graphs
  // For now, just render the caption normally
  // TODO: Implement advanced keyword highlighting in FFmpeg if needed
  return buildSimpleCaptionFilter(caption, trimStart, videoWidth, videoHeight);
}

/**
 * Build FFmpeg filter complex for all captions
 */
export function buildCaptionFilters(
  captions: Caption[],
  trimStart: number,
  videoWidth: number = 1080,
  videoHeight: number = 1920
): string {
  const filters = captions
    .filter((caption) => caption.isVisible)
    .map((caption) => buildCaptionFilter(caption, trimStart, videoWidth, videoHeight));

  return filters.join(',');
}

/**
 * Build FFmpeg export command arguments
 */
export function buildFFmpegCommand(
  startTime: number,
  duration: number,
  captions: Caption[],
  settings: ExportSettings,
  inputFile: string = 'input.mp4',
  outputFile: string = 'output.mp4'
): string[] {
  const args: string[] = [
    '-ss',
    startTime.toString(),
    '-i',
    inputFile,
    '-t',
    duration.toString(),
  ];

  // Build video filter complex
  const [width, height] = settings.resolution.split('x').map(Number);
  const filterParts: string[] = [];
  
  // Add scale filter for resolution first
  filterParts.push(`scale=${width}:${height}`);
  
  // Add caption filters if any (chained after scale)
  // Multiple drawtext filters can be chained with commas
  if (captions.length > 0) {
    const captionFilters = captions
      .filter((caption) => caption.isVisible)
      .map((caption) => buildCaptionFilter(caption, startTime, width, height));
    
    if (captionFilters.length > 0) {
      filterParts.push(...captionFilters);
    }
  }

  if (filterParts.length > 0) {
    args.push('-vf', filterParts.join(','));
  }

  // Video codec settings
  args.push('-c:v', settings.videoCodec);
  args.push('-preset', settings.preset);
  args.push('-crf', settings.crf.toString());
  args.push('-r', settings.fps.toString());

  // Audio codec settings
  args.push('-c:a', settings.audioCodec);
  args.push('-b:a', settings.audioBitrate);

  // Output file
  args.push(outputFile);

  return args;
}

/**
 * Get export settings based on quality preset
 */
export function getExportSettings(quality: 'low' | 'medium' | 'high' = 'medium'): ExportSettings {
  const presets = {
    low: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '1M',
      audioBitrate: '96k',
      resolution: '720x1280',
      fps: 24,
      preset: 'ultrafast',
      crf: 28,
    },
    medium: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '2M',
      audioBitrate: '128k',
      resolution: '1080x1920',
      fps: 30,
      preset: 'medium',
      crf: 23,
    },
    high: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '4M',
      audioBitrate: '192k',
      resolution: '1080x1920',
      fps: 30,
      preset: 'slow',
      crf: 18,
    },
  };

  return presets[quality];
}
