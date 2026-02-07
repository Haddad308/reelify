/**
 * Comprehensive Metrics Service - Track API usage, health, and performance
 *
 * Tracks:
 * - API health (response time, errors, availability)
 * - Job success/failure
 * - End-to-end duration
 * - Gemini usage & costs
 * - ElevenLabs usage & costs
 */

import { Axiom } from "@axiomhq/js";

interface GeminiMetrics {
  model: string;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  cost_usd: number;
  response_time_minutes: number;
  success: boolean;
  error?: string;
}

interface ElevenLabsMetrics {
  model: string;
  transcription_characters: number; // Number of text characters transcribed from audio
  audio_duration_minutes?: number;
  cost_usd: number;
  response_time_minutes: number;
  success: boolean;
  error?: string;
}

interface JobMetrics {
  job_id: string;
  job_type: "video_processing" | "transcription" | "clip_generation";
  success: boolean;
  duration_ms: number;
  error?: string;
}

class MetricsService {
  private axiom: Axiom | null = null;
  private enabled: boolean;
  private jobStartTimes: Map<string, number> = new Map();

  constructor() {
    const token = process.env.AXIOM_TOKEN;
    this.enabled = !!token;

    if (this.enabled) {
      this.axiom = new Axiom({
        token: token!,
        orgId: process.env.AXIOM_ORG_ID,
      });
      console.log(
        "[Metrics] Axiom enabled - Comprehensive observability active"
      );
    } else {
      console.log(
        "[Metrics] Axiom not configured (metrics will only be logged)"
      );
    }
  }

  /**
   * Start tracking a job
   */
  startJob(jobId: string): void {
    this.jobStartTimes.set(jobId, Date.now());
  }

  /**
   * Track job completion
   */
  async trackJobComplete(
    jobId: string,
    jobType: JobMetrics["job_type"],
    success: boolean,
    error?: string
  ): Promise<void> {
    const startTime = this.jobStartTimes.get(jobId);
    const durationMs = startTime ? Date.now() - startTime : 0;
    const durationMinutes = durationMs / 60000;
    this.jobStartTimes.delete(jobId);

    const data = {
      metric_type: "job",
      job_id: jobId,
      job_type: jobType,
      success,
      duration_minutes: durationMinutes,
      error: error || undefined,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[Metrics] Job ${jobId} (${jobType}): ${
        success ? "SUCCESS" : "FAILED"
      } in ${durationMinutes.toFixed(2)} minutes${error ? ` - ${error}` : ""}`
    );

    await this.send(data);
  }

  /**
   * Track Gemini API call
   */
  async trackGemini(metrics: GeminiMetrics): Promise<void> {
    const data = {
      metric_type: "api_call",
      service: "gemini",
      model: metrics.model,

      // Tokens
      tokens_input: metrics.tokens_input,
      tokens_output: metrics.tokens_output,
      tokens_total: metrics.tokens_total,

      // Cost (Gemini only)
      gemini_cost_usd: metrics.cost_usd,

      // Performance & Health
      response_time_minutes: metrics.response_time_minutes,
      success: metrics.success,
      error: metrics.error || undefined,

      timestamp: new Date().toISOString(),
    };

    const status = metrics.success ? "✓" : "✗";
    const errorMsg = metrics.error ? ` - ERROR: ${metrics.error}` : "";

    console.log(
      `[Metrics] Gemini ${status}: ${
        metrics.tokens_total
      } tokens, $${metrics.cost_usd.toFixed(
        6
      )}, ${metrics.response_time_minutes.toFixed(3)} min${errorMsg}`
    );

    await this.send(data);
  }

  /**
   * Track ElevenLabs API call
   */
  async trackElevenLabs(metrics: ElevenLabsMetrics): Promise<void> {
    const data = {
      metric_type: "api_call",
      service: "elevenlabs",
      model: metrics.model,

      // Usage
      transcription_characters: metrics.transcription_characters,
      audio_duration_minutes: metrics.audio_duration_minutes || undefined,

      // Cost (ElevenLabs only)
      elevenlabs_cost_usd: metrics.cost_usd,

      // Performance & Health
      response_time_minutes: metrics.response_time_minutes,
      success: metrics.success,
      error: metrics.error || undefined,

      timestamp: new Date().toISOString(),
    };

    const status = metrics.success ? "✓" : "✗";
    const errorMsg = metrics.error ? ` - ERROR: ${metrics.error}` : "";
    const audioDuration = metrics.audio_duration_minutes
      ? `, ${metrics.audio_duration_minutes.toFixed(2)} min audio`
      : "";

    console.log(
      `[Metrics] ElevenLabs ${status}: ${
        metrics.transcription_characters
      } chars${audioDuration}, $${metrics.cost_usd.toFixed(
        6
      )}, ${metrics.response_time_minutes.toFixed(3)} min${errorMsg}`
    );

    await this.send(data);
  }

  /**
   * Track API error
   */
  async trackApiError(
    service: "gemini" | "elevenlabs",
    error: string,
    responseTimeMs?: number
  ): Promise<void> {
    const responseTimeMinutes = (responseTimeMs || 0) / 60000;

    const data = {
      metric_type: "api_error",
      service,
      error,
      response_time_minutes: responseTimeMinutes,
      timestamp: new Date().toISOString(),
    };

    console.error(`[Metrics] ${service.toUpperCase()} ERROR: ${error}`);
    await this.send(data);
  }

  /**
   * Send data to Axiom
   */
  private async send(data: Record<string, any>): Promise<void> {
    if (!this.enabled || !this.axiom) return;

    try {
      await this.axiom.ingest("reelify-metrics", [data]);
    } catch (error: any) {
      // Silently ignore dataset errors - don't spam logs
      if (!error?.message?.includes("dataset not found")) {
        console.error(
          "[Metrics] Failed to send to Axiom:",
          error?.message || error
        );
      }
    }
  }

  /**
   * Calculate Gemini cost based on token usage
   * Pricing: https://ai.google.dev/pricing
   */
  calculateGeminiCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing: Record<string, { input: number; output: number }> = {
      "gemini-3-flash-preview": { input: 0.075, output: 0.3 },
      "gemini-3-pro-preview": { input: 1.25, output: 5.0 },
      "gemini-2.5-flash": { input: 0.075, output: 0.3 },
      "gemini-2.5-pro": { input: 1.25, output: 5.0 },
      "gemini-1.5-flash": { input: 0.075, output: 0.3 },
      "gemini-1.5-pro": { input: 1.25, output: 5.0 },
    };

    const modelPricing = pricing[model] || pricing["gemini-3-flash-preview"];
    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * Calculate ElevenLabs cost based on character usage
   * Pricing: https://elevenlabs.io/pricing (update based on your plan)
   */
  calculateElevenLabsCost(model: string, characters: number): number {
    const pricing: Record<string, number> = {
      scribe_v2: 25.0, // $25 per 1M characters
      scribe_v1: 25.0,
      scribe_v1_experimental: 20.0,
    };

    const rate = pricing[model] || pricing["scribe_v2"];
    return (characters / 1_000_000) * rate;
  }

  /**
   * Calculate audio duration from segments (in minutes)
   */
  calculateAudioDuration(
    segments: Array<{ start: number; end: number }>
  ): number {
    if (segments.length === 0) return 0;
    const lastSegment = segments[segments.length - 1];
    const durationSeconds = lastSegment.end;
    return durationSeconds / 60; // Convert to minutes
  }
}

// Singleton instance
export const metrics = new MetricsService();

// Export types
export type { GeminiMetrics, ElevenLabsMetrics, JobMetrics };
