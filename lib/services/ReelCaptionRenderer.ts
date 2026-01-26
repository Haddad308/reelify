import { Caption } from '@/types';
import { calculateAnimationProgress, getAnimationTransform, getTypewriterCharCount } from '@/lib/hooks/useCaptionAnimation';

export class ReelCaptionRenderer {
  /**
   * Render captions on canvas at current time
   */
  static renderCaptions(
    canvas: HTMLCanvasElement,
    captions: Caption[],
    currentTime: number,
    videoWidth: number = 1080,
    videoHeight: number = 1920
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render visible captions at current time
    captions.forEach((caption) => {
      if (
        caption.isVisible &&
        currentTime >= caption.startTime &&
        currentTime <= caption.endTime
      ) {
        this.renderCaptionWithAnimation(ctx, caption, currentTime, videoWidth, videoHeight);
      }
    });
  }

  /**
   * Render caption with animation support
   */
  private static renderCaptionWithAnimation(
    ctx: CanvasRenderingContext2D,
    caption: Caption,
    currentTime: number,
    videoWidth: number,
    videoHeight: number
  ): void {
    // Calculate animation progress
    const progress = calculateAnimationProgress(caption, currentTime);

    if (progress <= 0) {
      return; // Not visible yet due to delay
    }

    // Get animation transforms
    const transform = getAnimationTransform(caption, progress);

    // Save context state
    ctx.save();

    // Apply transforms
    ctx.globalAlpha = transform.opacity * (caption.style.opacity ?? 1);

    // Handle typewriter effect separately
    let textToRender = caption.text;
    if (caption.style.animation?.type === 'typewriter') {
      const charCount = getTypewriterCharCount(caption.text, progress);
      textToRender = caption.text.substring(0, charCount);
    }

    // Apply spatial transformations
    if (transform.translateX !== 0 || transform.translateY !== 0 || transform.scale !== 1) {
      const centerX = caption.position.x;
      const centerY = caption.position.y;

      // Translate to position
      ctx.translate(centerX, centerY);

      // Apply scale
      if (transform.scale !== 1) {
        ctx.scale(transform.scale, transform.scale);
      }

      // Apply translation
      ctx.translate(transform.translateX, transform.translateY);

      // Translate back
      ctx.translate(-centerX, -centerY);
    }

    // Render the caption with transformed text
    const modifiedCaption = {
      ...caption,
      text: textToRender,
    };

    this.renderCaption(ctx, modifiedCaption, videoWidth, videoHeight);

    // Restore context state
    ctx.restore();
  }

  /**
   * Render a single caption
   */
  private static renderCaption(
    ctx: CanvasRenderingContext2D,
    caption: Caption,
    videoWidth: number,
    videoHeight: number
  ): void {
    const { style, position } = caption;
    let { text } = caption;

    // Apply text transform
    text = this.applyTextTransform(text, style.textTransform);

    // Check if we have keyword highlights
    const hasKeywords = style.keywordHighlights && style.keywordHighlights.length > 0;

    if (hasKeywords) {
      this.renderCaptionWithKeywords(ctx, text, style, position);
    } else {
      this.renderSimpleCaption(ctx, text, style, position);
    }
  }

  /**
   * Render caption without keyword highlighting
   */
  private static renderSimpleCaption(
    ctx: CanvasRenderingContext2D,
    text: string,
    style: Caption['style'],
    position: { x: number; y: number }
  ): void {
    // Set font
    const fontStyle = style.fontStyle || 'normal';
    const fontWeight = style.fontWeight || 'normal';
    ctx.font = `${fontStyle} ${fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    ctx.textBaseline = 'middle';

    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = style.fontSize;

    // Calculate background dimensions
    const padding = style.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const bgWidth = textWidth + padding.left + padding.right;
    const bgHeight = textHeight + padding.top + padding.bottom;

    // Calculate text position based on alignment
    const textAlign = style.textAlign || 'center';
    let textX = position.x;
    let bgX = position.x;

    if (textAlign === 'center') {
      ctx.textAlign = 'center';
      textX = position.x;
      bgX = position.x - bgWidth / 2;
    } else if (textAlign === 'left') {
      ctx.textAlign = 'left';
      textX = position.x;
      bgX = position.x - padding.left;
    } else if (textAlign === 'right') {
      ctx.textAlign = 'right';
      textX = position.x;
      bgX = position.x - bgWidth + padding.right;
    } else {
      ctx.textAlign = 'center';
      textX = position.x;
      bgX = position.x - bgWidth / 2;
    }

    // Draw background if specified
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(
        bgX,
        position.y - bgHeight / 2,
        bgWidth,
        bgHeight
      );
    }

    // Apply shadow if specified
    if (style.shadow && (style.shadow.blur > 0 || style.shadow.offsetX !== 0 || style.shadow.offsetY !== 0)) {
      ctx.shadowColor = style.shadow.color;
      ctx.shadowOffsetX = style.shadow.offsetX;
      ctx.shadowOffsetY = style.shadow.offsetY;
      ctx.shadowBlur = style.shadow.blur;
    }

    // Draw stroke if specified
    if (style.strokeColor && style.strokeWidth) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeText(text, textX, position.y);
    }

    // Draw text
    ctx.fillStyle = style.color;
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.fillText(text, textX, position.y);
    ctx.globalAlpha = 1;

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
  }

  /**
   * Render caption with keyword highlighting
   */
  private static renderCaptionWithKeywords(
    ctx: CanvasRenderingContext2D,
    text: string,
    style: Caption['style'],
    position: { x: number; y: number }
  ): void {
    // Parse text into segments
    const segments = this.parseTextSegments(text, style.keywordHighlights!);

    // Set base font
    const fontStyle = style.fontStyle || 'normal';
    const fontWeight = style.fontWeight || 'normal';
    ctx.font = `${fontStyle} ${fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    ctx.textBaseline = 'middle';

    // Calculate total width for alignment
    const totalWidth = segments.reduce((sum, seg) => {
      const segFont = seg.isKeyword && seg.fontWeight
        ? `${fontStyle} ${seg.fontWeight} ${style.fontSize}px ${style.fontFamily}`
        : ctx.font;
      ctx.font = segFont;
      return sum + ctx.measureText(seg.text).width;
    }, 0);

    // Reset font
    ctx.font = `${fontStyle} ${fontWeight} ${style.fontSize}px ${style.fontFamily}`;

    // Calculate starting X position based on alignment
    const textAlign = style.textAlign || 'center';
    let currentX = position.x;

    if (textAlign === 'center') {
      currentX = position.x - totalWidth / 2;
    } else if (textAlign === 'right') {
      currentX = position.x - totalWidth;
    }

    // Draw background for entire text
    const padding = style.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const bgWidth = totalWidth + padding.left + padding.right;
    const bgHeight = style.fontSize + padding.top + padding.bottom;

    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
      const bgX = currentX - padding.left;
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(bgX, position.y - bgHeight / 2, bgWidth, bgHeight);
    }

    // Apply shadow if specified
    if (style.shadow && (style.shadow.blur > 0 || style.shadow.offsetX !== 0 || style.shadow.offsetY !== 0)) {
      ctx.shadowColor = style.shadow.color;
      ctx.shadowOffsetX = style.shadow.offsetX;
      ctx.shadowOffsetY = style.shadow.offsetY;
      ctx.shadowBlur = style.shadow.blur;
    }

    // Render each segment
    ctx.textAlign = 'left';
    segments.forEach((segment) => {
      // Set segment-specific styling
      const segFont = segment.isKeyword && segment.fontWeight
        ? `${fontStyle} ${segment.fontWeight} ${style.fontSize}px ${style.fontFamily}`
        : `${fontStyle} ${fontWeight} ${style.fontSize}px ${style.fontFamily}`;
      ctx.font = segFont;

      const segWidth = ctx.measureText(segment.text).width;
      const color = segment.isKeyword && segment.color ? segment.color : style.color;

      // Draw keyword background if specified
      if (segment.isKeyword && segment.backgroundColor) {
        ctx.fillStyle = segment.backgroundColor;
        ctx.fillRect(currentX, position.y - style.fontSize / 2, segWidth, style.fontSize);
      }

      // Draw stroke
      if (style.strokeColor && style.strokeWidth) {
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth;
        ctx.strokeText(segment.text, currentX, position.y);
      }

      // Draw text
      ctx.fillStyle = color;
      ctx.globalAlpha = style.opacity ?? 1;
      ctx.fillText(segment.text, currentX, position.y);

      currentX += segWidth;
    });

    // Reset
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
  }

  /**
   * Parse text into segments with keyword information
   */
  private static parseTextSegments(
    text: string,
    keywords: NonNullable<Caption['style']['keywordHighlights']>
  ): Array<{
    text: string;
    isKeyword: boolean;
    color?: string;
    backgroundColor?: string;
    fontWeight?: string;
  }> {
    const segments: ReturnType<typeof this.parseTextSegments> = [];
    let remainingText = text;
    let currentIndex = 0;

    while (remainingText.length > 0) {
      let foundKeyword = false;

      // Check each keyword
      for (const keyword of keywords) {
        const keywordIndex = remainingText.toLowerCase().indexOf(keyword.text.toLowerCase());

        if (keywordIndex === 0) {
          // Found a keyword at the start
          segments.push({
            text: remainingText.substring(0, keyword.text.length),
            isKeyword: true,
            color: keyword.color,
            backgroundColor: keyword.backgroundColor,
            fontWeight: keyword.fontWeight,
          });

          remainingText = remainingText.substring(keyword.text.length);
          currentIndex += keyword.text.length;
          foundKeyword = true;
          break;
        }
      }

      if (!foundKeyword) {
        // Find next keyword or take rest of text
        let nextKeywordIndex = remainingText.length;

        for (const keyword of keywords) {
          const idx = remainingText.toLowerCase().indexOf(keyword.text.toLowerCase());
          if (idx > 0 && idx < nextKeywordIndex) {
            nextKeywordIndex = idx;
          }
        }

        // Add non-keyword segment
        segments.push({
          text: remainingText.substring(0, nextKeywordIndex),
          isKeyword: false,
        });

        remainingText = remainingText.substring(nextKeywordIndex);
        currentIndex += nextKeywordIndex;
      }
    }

    return segments;
  }

  /**
   * Apply text transformation (uppercase, lowercase, capitalize)
   */
  private static applyTextTransform(
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
   * Update caption visibility based on trim points
   */
  static updateCaptionVisibility(
    captions: Caption[],
    trimStart: number,
    trimEnd: number
  ): Caption[] {
    return captions.map((caption) => ({
      ...caption,
      isVisible:
        caption.startTime >= trimStart &&
        caption.endTime <= trimEnd &&
        caption.startTime < caption.endTime,
    }));
  }
}
