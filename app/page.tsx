"use client";

import { useState, useRef, useEffect } from "react";
import { upload } from "@vercel/blob/client";
import { getFfmpeg, writeInputFile, extractAudioWav, clipVideoSegment, extractThumbnail, cleanupInputFile } from "@/lib/ffmpegWasm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type ClipItem = {
  title: string;
  duration: number;
  url: string;
  start: number;
  end: number;
  thumbnail: string;
  category: string;
  tags: string[];
  transcript: string;
};

type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [screen, setScreen] = useState<"upload" | "form" | "loading" | "results">(
    "upload"
  );
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [platform, setPlatform] = useState("instagram");
  const [preferredDuration, setPreferredDuration] = useState(45);
  const [audience, setAudience] = useState("شباب 18-30");
  const [tone, setTone] = useState("ملهم");
  const [hookStyle, setHookStyle] = useState("سؤال مباشر");
  const [keyTopics, setKeyTopics] = useState<string[]>([]);
  const [callToAction, setCallToAction] = useState("شارك مع صديق");

  // Background processing state
  const [backgroundResult, setBackgroundResult] = useState<{
    ffmpeg: Awaited<ReturnType<typeof getFfmpeg>>;
    inputName: string;
    candidates: Array<{ title: string; start: number; end: number; category: string; tags: string[] }>;
    segments: TranscriptSegment[];
  } | null>(null);
  const [backgroundError, setBackgroundError] = useState<string>("");
  const [backgroundProcessing, setBackgroundProcessing] = useState(false);

  // Refs to access latest background state in async functions
  const backgroundResultRef = useRef(backgroundResult);
  const backgroundErrorRef = useRef(backgroundError);
  const backgroundProcessingRef = useRef(backgroundProcessing);

  useEffect(() => {
    backgroundResultRef.current = backgroundResult;
  }, [backgroundResult]);

  useEffect(() => {
    backgroundErrorRef.current = backgroundError;
  }, [backgroundError]);

  useEffect(() => {
    backgroundProcessingRef.current = backgroundProcessing;
  }, [backgroundProcessing]);

  const persistPreferences = async (partial: Record<string, unknown>) => {
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(partial)
      });
    } catch {
      // Best-effort persistence during processing.
    }
  };

  const startBackgroundProcessing = async (videoFile: File) => {
    setBackgroundProcessing(true);
    setBackgroundError("");
    setBackgroundResult(null);

    try {
      // Load FFmpeg and write input file
      const ffmpeg = await getFfmpeg();
      const inputName = `input-${Date.now()}.mp4`;
      await writeInputFile(ffmpeg, inputName, videoFile);

      // Extract audio
      const audioName = `audio-${Date.now()}.wav`;
      const audioBlob = await extractAudioWav(ffmpeg, inputName, audioName);

      // Upload audio to Vercel Blob
      const audioFile = new File([audioBlob], "audio.wav", { type: "audio/wav" });
      const audioUpload = await upload(audioFile.name, audioFile, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });

      // Call /api/process for transcription and Gemini analysis
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: audioUpload.url }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "حدث خطأ أثناء التحليل.");
      }

      const candidates = Array.isArray(payload?.clips) ? payload.clips : [];
      const segments: TranscriptSegment[] = Array.isArray(payload?.segments) ? payload.segments : [];

      if (candidates.length === 0) {
        throw new Error("لم يتم العثور على مقاطع مناسبة.");
      }

      // Store results
      setBackgroundResult({
        ffmpeg,
        inputName,
        candidates,
        segments,
      });
    } catch (err) {
      console.error("Background processing error:", err);
      const message = err instanceof Error ? err.message : "حدث خطأ أثناء المعالجة.";
      setBackgroundError(message);
    } finally {
      setBackgroundProcessing(false);
    }
  };

  const onUploadSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setClips([]);
    setBackgroundError("");
    setBackgroundResult(null);

    if (!file) {
      setError("يرجى اختيار فيديو قبل المتابعة.");
      return;
    }

    setStep(1);
    setScreen("form");

    // Start background processing (fire and forget)
    void startBackgroundProcessing(file);
  };

  const onStartProcessing = async () => {
    setError("");
    setScreen("loading");
    setIsProcessing(true);

    try {
      // Wait for background processing if still running
      if (backgroundProcessingRef.current) {
        setStatus("ننتظر اكتمال التحليل...");
        // Poll until background processing is done (max 120 seconds)
        let attempts = 0;
        while (backgroundProcessingRef.current && attempts < 1200) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
      }

      // Check for background error
      if (backgroundErrorRef.current) {
        throw new Error(backgroundErrorRef.current);
      }

      // Check if background result is ready
      if (!backgroundResultRef.current) {
        throw new Error("لم يتم تحليل الفيديو بعد. يرجى المحاولة مرة أخرى.");
      }

      const { ffmpeg, inputName, candidates, segments } = backgroundResultRef.current;

      // Helper to extract transcript for a specific time range
      const getClipTranscript = (start: number, end: number): string => {
        return segments
          .filter((seg) => seg.end > start && seg.start < end)
          .map((seg) => seg.text)
          .join(" ");
      };

      setStatus("نقوم بتجهيز المقاطع الآن...");
      const uploadedClips: ClipItem[] = [];

      for (const candidate of candidates) {
        const clipId = crypto.randomUUID();
        const clipName = `clip-${clipId}.mp4`;
        const thumbName = `thumb-${clipId}.jpg`;

        // Extract video clip
        const clipBlob = await clipVideoSegment(
          ffmpeg,
          inputName,
          clipName,
          candidate.start,
          candidate.end
        );

        // Extract thumbnail from first frame
        const thumbBlob = await extractThumbnail(
          ffmpeg,
          inputName,
          thumbName,
          candidate.start
        );

        // Upload clip to Vercel Blob
        const clipFile = new File([clipBlob], clipName, { type: "video/mp4" });
        const clipUpload = await upload(clipFile.name, clipFile, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });

        // Upload thumbnail to Vercel Blob
        const thumbFile = new File([thumbBlob], thumbName, { type: "image/jpeg" });
        const thumbUpload = await upload(thumbFile.name, thumbFile, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });

        const duration = Math.max(0, candidate.end - candidate.start);
        const clipTranscript = getClipTranscript(candidate.start, candidate.end);

        uploadedClips.push({
          title: candidate.title,
          start: candidate.start,
          end: candidate.end,
          duration,
          url: clipUpload.url,
          thumbnail: thumbUpload.url,
          category: candidate.category || "عام",
          tags: Array.isArray(candidate.tags) ? candidate.tags : [],
          transcript: clipTranscript,
        });
      }

      // Clean up input file to free memory
      await cleanupInputFile(ffmpeg, inputName);

      setClips(uploadedClips);
      setStatus("");
      setScreen("results");
    } catch (err) {
      console.error("Processing error:", err);
      let message = "تعذر إكمال المعالجة.";
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "string") {
        message = err;
      } else if (err && typeof err === "object" && "message" in err) {
        message = String((err as { message: unknown }).message);
      }
      setError(message);
      setStatus("");
      setScreen("form");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalSteps = 5;

  const questionTitles: Record<number, string> = {
    1: "على أي منصة ستنشر الفيديو؟",
    2: "ما المدة المفضلة للمقطع؟",
    3: "من هو الجمهور المستهدف؟",
    4: "ما النبرة الأنسب للمقطع؟",
    5: "ما أسلوب الافتتاح (الهوك)؟",
  };

  return (
    <main className="min-h-screen bg-gradient-warm" dir="rtl">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pb-24 pt-20">
        {/* Header */}
        <header className="text-center space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2 text-sm font-semibold text-primary shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
            Realify
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground leading-tight">
            اصنع ريلز عربية احترافية
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            ارفع الفيديو وأجب عن أسئلة بسيطة لنصنع لك أفضل المقاطع
          </p>
        </header>

        {/* Upload Screen */}
        {screen === "upload" && (
          <Card className="shadow-card border-0 bg-gradient-card animate-fade-in hover:shadow-card-hover transition-all duration-500">
            <CardContent className="p-10">
              <form className="flex flex-col items-center gap-8" onSubmit={onUploadSubmit}>
                <div className="w-full">
                  <label
                    htmlFor="video"
                    className="group flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-primary/20 rounded-2xl cursor-pointer bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all duration-300 hover:scale-[1.01]"
                  >
                    <div className="flex flex-col items-center justify-center pt-6 pb-8">
                      <div className="w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="mb-2 text-base text-foreground">
                        <span className="font-semibold text-primary">اضغط لرفع الفيديو</span>
                      </p>
                      <p className="text-sm text-muted-foreground">MP4, MOV, AVI</p>
                    </div>
                    <input
                      id="video"
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {file && (
                    <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-fade-in-scale">
                      <p className="text-sm text-center text-primary font-medium flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        تم اختيار: {file.name}
                      </p>
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={!file}
                  size="lg"
                  className="w-full max-w-sm text-white h-14 text-lg font-semibold bg-gradient-teal hover:shadow-teal hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-xl"
                >
                  متابعة
                </Button>
                {error && <p className="text-sm text-destructive animate-fade-in">{error}</p>}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Form Screen - One Question Per Step */}
        {screen === "form" && (
          <Card className="shadow-card border-0 bg-gradient-card animate-fade-in hover:shadow-card-hover transition-all duration-500">
            <CardContent className="p-10 space-y-10">
              {/* Progress */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">السؤال {step} من {totalSteps}</span>
                  <span className="font-semibold text-primary text-lg">{Math.round((step / totalSteps) * 100)}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full progress-gradient rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(step / totalSteps) * 100}%` }}
                  />
                </div>
              </div>

              {/* Background Processing Indicator */}
              {backgroundProcessing && (
                <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-fade-in">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-primary">نحلل الفيديو في الخلفية...</span>
                </div>
              )}

              {backgroundResult && !backgroundProcessing && (
                <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 animate-fade-in">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-emerald-700">جاهز للتحويل</span>
                </div>
              )}

              {backgroundError && (
                <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 animate-fade-in">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-red-600">{backgroundError}</span>
                </div>
              )}

              {/* Question Title */}
              <h2 className="text-2xl font-bold text-center text-foreground animate-fade-in">
                {questionTitles[step]}
              </h2>

              {error && <p className="text-sm text-destructive text-center animate-fade-in">{error}</p>}

              {/* Step 1: Platform */}
              {step === 1 && (
                <div className="grid gap-4 animate-fade-in">
                  {[
                    { value: "instagram", label: "إنستغرام ريلز", icon: "📸" },
                    { value: "tiktok", label: "تيك توك", icon: "🎵" },
                    { value: "youtube", label: "يوتيوب شورتس", icon: "▶️" },
                    { value: "snapchat", label: "سناب شات سبوتلايت", icon: "👻" },
                    { value: "facebook", label: "فيسبوك ريلز", icon: "📘" },
                  ].map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setPlatform(option.value);
                        void persistPreferences({ platform: option.value });
                      }}
                      className={`flex items-center gap-5 p-5 rounded-2xl border-2 transition-all duration-300 text-right hover:scale-[1.02] active:scale-[0.98] ${platform === option.value
                          ? "border-primary bg-primary/10 shadow-teal"
                          : "border-transparent bg-muted/50 hover:bg-muted hover:border-primary/20"
                        }`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <span className="text-3xl transition-transform duration-300 group-hover:scale-110">{option.icon}</span>
                      <span className="font-semibold text-lg">{option.label}</span>
                      {platform === option.value && (
                        <svg className="w-6 h-6 text-primary mr-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2: Duration */}
              {step === 2 && (
                <div className="grid grid-cols-3 gap-4 animate-fade-in">
                  {[30, 45, 60, 75, 90].map((duration, index) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => {
                        setPreferredDuration(duration);
                        void persistPreferences({ preferredDuration: duration });
                      }}
                      className={`p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.05] active:scale-[0.98] ${preferredDuration === duration
                          ? "border-primary bg-primary/10 shadow-teal"
                          : "border-transparent bg-muted/50 hover:bg-muted hover:border-primary/20"
                        }`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <span className="text-3xl font-bold text-foreground block">{duration}</span>
                      <span className="block text-sm text-muted-foreground mt-1">ثانية</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 3: Audience */}
              {step === 3 && (
                <div className="grid gap-4 animate-fade-in">
                  {[
                    { value: "شباب 18-30", icon: "👥" },
                    { value: "رواد أعمال", icon: "💼" },
                    { value: "مهتمون بالتطوير الذاتي", icon: "🚀" },
                    { value: "طلاب جامعات", icon: "🎓" },
                    { value: "مهنيون في التقنية", icon: "💻" },
                  ].map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setAudience(option.value);
                        void persistPreferences({ audience: option.value });
                      }}
                      className={`flex items-center gap-5 p-5 rounded-2xl border-2 transition-all duration-300 text-right hover:scale-[1.02] active:scale-[0.98] ${audience === option.value
                          ? "border-primary bg-primary/10 shadow-teal"
                          : "border-transparent bg-muted/50 hover:bg-muted hover:border-primary/20"
                        }`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <span className="text-3xl">{option.icon}</span>
                      <span className="font-semibold text-lg">{option.value}</span>
                      {audience === option.value && (
                        <svg className="w-6 h-6 text-primary mr-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 4: Tone */}
              {step === 4 && (
                <div className="grid gap-4 animate-fade-in">
                  {[
                    { value: "ملهم", icon: "✨" },
                    { value: "تعليمي", icon: "📚" },
                    { value: "حماسي", icon: "🔥" },
                    { value: "هادئ", icon: "🌿" },
                    { value: "عملي", label: "عملي ومباشر", icon: "🎯" },
                  ].map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTone(option.value);
                        void persistPreferences({ tone: option.value });
                      }}
                      className={`flex items-center gap-5 p-5 rounded-2xl border-2 transition-all duration-300 text-right hover:scale-[1.02] active:scale-[0.98] ${tone === option.value
                          ? "border-primary bg-primary/10 shadow-teal"
                          : "border-transparent bg-muted/50 hover:bg-muted hover:border-primary/20"
                        }`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <span className="text-3xl">{option.icon}</span>
                      <span className="font-semibold text-lg">{option.label || option.value}</span>
                      {tone === option.value && (
                        <svg className="w-6 h-6 text-primary mr-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 5: Hook Style */}
              {step === 5 && (
                <div className="grid gap-4 animate-fade-in">
                  {[
                    { value: "سؤال مباشر", icon: "❓" },
                    { value: "رقم قوي", label: "رقم قوي أو إحصائية", icon: "📊" },
                    { value: "وعد سريع", label: "وعد بنتيجة سريعة", icon: "⚡" },
                    { value: "قصة قصيرة", icon: "📖" },
                    { value: "تنبيه أو تحذير", icon: "⚠️" },
                  ].map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setHookStyle(option.value);
                        void persistPreferences({ hookStyle: option.value });
                      }}
                      className={`flex items-center gap-5 p-5 rounded-2xl border-2 transition-all duration-300 text-right hover:scale-[1.02] active:scale-[0.98] ${hookStyle === option.value
                          ? "border-primary bg-primary/10 shadow-teal"
                          : "border-transparent bg-muted/50 hover:bg-muted hover:border-primary/20"
                        }`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <span className="text-3xl">{option.icon}</span>
                      <span className="font-semibold text-lg">{option.label || option.value}</span>
                      {hookStyle === option.value && (
                        <svg className="w-6 h-6 text-primary mr-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => setStep((current) => Math.max(1, current - 1))}
                  disabled={step === 1}
                  className={`text-base px-6 ${step === 1 ? "invisible" : "hover:bg-muted"}`}
                >
                  السابق
                </Button>
                {step < totalSteps ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setStep((current) => Math.min(totalSteps, current + 1))}
                    className="text-base px-8 text-white bg-gradient-teal hover:shadow-teal hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    التالي
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={onStartProcessing}
                    disabled={isProcessing}
                    className="text-base text-white px-8 bg-gradient-coral hover:shadow-warm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    {isProcessing ? "جارٍ التحويل..." : "ابدأ التحويل"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Screen with Skeleton UI */}
        {screen === "loading" && (
          <div className="space-y-8 animate-fade-in">
            {/* Status Card */}
            <Card className="shadow-card border-0 bg-gradient-card">
              <CardContent className="p-10 text-center space-y-8">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-teal flex items-center justify-center animate-pulse-glow">
                  <svg className="w-10 h-10 text-white animate-bounce-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold text-foreground">نحضّر مقاطعك الآن</h2>
                  <p className="text-lg text-muted-foreground">
                    {status || "يرجى الانتظار قليلاً..."}
                  </p>
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full progress-gradient rounded-full animate-pulse" style={{ width: "66%" }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Skeleton Cards Preview */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden shadow-card border-0 bg-gradient-card animate-fade-in" style={{ animationDelay: `${i * 0.2}s` }}>
                  {/* Thumbnail Skeleton */}
                  <div className="aspect-video skeleton" />
                  {/* Content Skeleton */}
                  <CardContent className="p-5 space-y-4">
                    <div className="skeleton h-4 w-16 rounded-full" />
                    <div className="space-y-2">
                      <div className="skeleton h-5 w-full rounded" />
                      <div className="skeleton h-5 w-3/4 rounded" />
                    </div>
                    <div className="skeleton h-4 w-20 rounded" />
                    <div className="skeleton h-12 w-full rounded-xl" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Results Screen */}
        {screen === "results" && (
          <section className="space-y-10 animate-fade-in ">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-teal flex items-center justify-center animate-bounce-soft">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-foreground">المقاطع جاهزة!</h2>
              <p className="text-lg text-muted-foreground">اختر المقطع الذي يعجبك للمعاينة والتحميل</p>
            </div>
            {clips.length === 0 ? (
              <p className="text-base text-muted-foreground text-center">لم يتم إنشاء أي مقاطع بعد.</p>
            ) : (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {clips.map((clip, index) => {
                  const previewParams = new URLSearchParams({
                    url: clip.url,
                    title: clip.title,
                    duration: String(Math.round(clip.duration)),
                    thumbnail: clip.thumbnail,
                    category: clip.category,
                    tags: clip.tags.join(","),
                    transcript: clip.transcript,
                  });
                  const previewUrl = `/preview?${previewParams.toString()}`;
                  return (
                    <Card
                      key={clip.url}
                      className="overflow-hidden shadow-card border-0 bg-gradient-card group hover:shadow-card-hover hover:scale-[1.03] transition-all duration-500 animate-fade-in"
                      style={{ animationDelay: `${index * 0.15}s` }}
                    >
                      <div className="aspect-video bg-muted relative overflow-hidden">
                        <img
                          src={clip.thumbnail}
                          alt={clip.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100 shadow-xl">
                            <svg className="w-7 h-7 text-primary mr-[-3px]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                        {/* Duration Badge */}
                        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 text-white text-xs font-medium backdrop-blur-sm">
                          {Math.round(clip.duration)} ثانية
                        </div>
                      </div>
                      <CardContent className="p-5 space-y-4">
                        <div className="space-y-2">
                          <span className="inline-block px-3 py-1 text-xs font-semibold bg-primary/10 text-primary rounded-full">
                            {clip.category}
                          </span>
                          <h3 className="font-bold text-foreground text-lg line-clamp-2 leading-snug">{clip.title}</h3>
                        </div>
                        <Button
                          asChild
                          className="w-full h-12 text-white text-base font-semibold bg-gradient-teal hover:shadow-teal hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-xl"
                        >
                          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                            معاينة وتحميل
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
