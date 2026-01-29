import { NextResponse } from "next/server";
import { transcribeAudioFromUrl } from "../../../lib/elevenlabs";
import { generateClipCandidates } from "../../../lib/gemini";
import { loadPreferences, type QAPreferences } from "../../../lib/qaStore";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const tempAudioDir = path.join(process.cwd(), "data", "temp-audio");

// Accept FormData with audio file (client-side storage)
export async function POST(request: Request) {
  try {
    const startTime = Date.now();
    console.log("[API] Starting process request");

    // Parse FormData
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const preferencesStr = formData.get("preferences") as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    // Parse preferences JSON
    let preferences: QAPreferences | undefined;
    if (preferencesStr) {
      try {
        preferences = JSON.parse(preferencesStr) as QAPreferences;
      } catch {
        // Invalid JSON, will use stored preferences instead
      }
    }

    // Convert File to Buffer and save temporarily for ElevenLabs
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const audioSizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[API] Audio received: ${audioSizeMB}MB`);

    // Save to temporary file for ElevenLabs API
    await mkdir(tempAudioDir, { recursive: true });
    const tempAudioPath = path.join(tempAudioDir, `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);
    await writeFile(tempAudioPath, audioBuffer);
    console.log(`[API] Audio saved temporarily: ${tempAudioPath}`);

    // Load preferences in parallel with transcription (optimization)
    const preferencesPromise = (async () => {
      const stored = await loadPreferences();
      let mergedPreferences: QAPreferences | undefined;
      if (preferences && Object.keys(preferences).length > 0) {
        mergedPreferences = preferences;
      } else if (stored && Object.keys(stored).length > 0) {
        mergedPreferences = stored;
      } else {
        mergedPreferences = undefined;
      }
      return mergedPreferences;
    })();

    // Transcribe from local file (ElevenLabs will read it directly)
    const transcriptionStart = Date.now();
    let segments;
    try {
      segments = await transcribeAudioFromUrl(tempAudioPath, "");
      const transcriptionTime = Date.now() - transcriptionStart;
      console.log(`[API] Transcription: ${transcriptionTime}ms (${segments.length} segments)`);
    } finally {
      // Always delete the temporary file after transcription
      try {
        await unlink(tempAudioPath);
        console.log(`[API] Temporary audio file deleted: ${tempAudioPath}`);
      } catch (deleteError) {
        console.warn(`[API] Failed to delete temporary file:`, deleteError);
      }
    }
    
    if (segments.length === 0) {
      return NextResponse.json(
        { error: "Transcript was empty" },
        { status: 400 },
      );
    }

    // Get preferences (already loaded in parallel)
    const mergedPreferences = await preferencesPromise;
    console.log("[API] Preferences:", mergedPreferences);
    
    const geminiStart = Date.now();
    const clipCandidates = await generateClipCandidates(
      segments,
      mergedPreferences,
    );
    const geminiTime = Date.now() - geminiStart;
    console.log(`[API] Gemini analysis: ${geminiTime}ms (${clipCandidates.length} clips)`);
    
    const totalTime = Date.now() - startTime;
    console.log(`[API] Total processing time: ${totalTime}ms`);
    if (clipCandidates.length === 0) {
      return NextResponse.json(
        { error: "Gemini did not return valid clip candidates" },
        { status: 400 },
      );
    }
    return NextResponse.json({ clips: clipCandidates, segments });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Processing failed";
    const clientErrorMessages = [
      "Missing ELEVENLABS_API_KEY",
      "Missing GEMINI_API_KEY",
      "Missing audio file",
    ];
    const status = clientErrorMessages.includes(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
