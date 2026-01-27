import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { transcribeAudio } from "../../../lib/elevenlabs";
import { generateClipCandidates } from "../../../lib/gemini";
import { loadPreferences, type QAPreferences } from "../../../lib/qaStore";

export const runtime = "nodejs";

// Accept JSON with audioUrl (Vercel Blob URL)
export async function POST(request: Request) {
  let tempDir = "";
  try {
    const body = await request.json();
    const { audioUrl, preferences } = body as {
      audioUrl?: string;
      preferences?: QAPreferences;
    };

    if (!audioUrl) {
      return NextResponse.json({ error: "Missing audioUrl" }, { status: 400 });
    }

    // Download audio from Vercel Blob
    tempDir = await mkdtemp(path.join(os.tmpdir(), "realify-"));
    const audioPath = path.join(tempDir, "audio.wav");

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error("Failed to download audio from blob");
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    await writeFile(audioPath, audioBuffer);

    const segments = await transcribeAudio(audioPath);
    if (segments.length === 0) {
      return NextResponse.json(
        { error: "Transcript was empty" },
        { status: 400 },
      );
    }

    // Resolve preferences:
    // - If request provides a preferences object, use it directly (per-run control).
    // - Otherwise, fall back to stored preferences for backward compatibility.
    const stored = await loadPreferences();
    let mergedPreferences: QAPreferences | undefined;

    if (preferences && Object.keys(preferences).length > 0) {
      // Only use what the client explicitly sent this run.
      mergedPreferences = preferences;
    } else if (stored && Object.keys(stored).length > 0) {
      mergedPreferences = stored;
    } else {
      mergedPreferences = undefined;
    }
    console.log("mergedPreferences", mergedPreferences);
    const clipCandidates = await generateClipCandidates(
      segments,
      mergedPreferences,
    );
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
      "Missing audioUrl",
      "Failed to download audio from blob",
    ];
    const status = clientErrorMessages.includes(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
