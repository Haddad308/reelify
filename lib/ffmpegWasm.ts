import { fetchFile } from "@ffmpeg/util";
import { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpegPromise: Promise<FFmpeg> | null = null;

export async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpegPromise) {
    return ffmpegPromise;
  }

  ffmpegPromise = (async () => {
    const ffmpeg = new FFmpeg();
    // Let the library use its default URLs from unpkg
    await ffmpeg.load();
    return ffmpeg;
  })();

  return ffmpegPromise;
}

export async function writeInputFile(ffmpeg: FFmpeg, name: string, file: File) {
  await ffmpeg.writeFile(name, await fetchFile(file));
}

// Helper to safely delete a file from FFmpeg's virtual filesystem
async function deleteFile(ffmpeg: FFmpeg, name: string) {
  try {
    await ffmpeg.deleteFile(name);
  } catch {
    // Ignore errors if file doesn't exist
  }
}

export async function extractAudioWav(ffmpeg: FFmpeg, inputName: string, outputName: string) {
  await ffmpeg.exec([
    "-i",
    inputName,
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    outputName
  ]);
  const audioData = await ffmpeg.readFile(outputName);
  await deleteFile(ffmpeg, outputName); // Free memory
  const audioBytes = typeof audioData === "string" ? new TextEncoder().encode(audioData) : audioData;
  const audioBlobPart = audioBytes as BlobPart;
  return new Blob([audioBlobPart], { type: "audio/wav" });
}

export async function clipVideoSegment(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  start: number,
  end: number
) {
  const safeStart = Math.max(0, start);
  const safeEnd = Math.max(safeStart, end);
  const duration = safeEnd - safeStart;

  // Re-encode with 9:16 vertical aspect ratio for social media platforms
  // Scale to fit within 1080x1920, add padding if needed (letterbox/pillarbox)
  await ffmpeg.exec([
    "-ss",
    safeStart.toFixed(3),
    "-i",
    inputName,
    "-t",
    duration.toFixed(3),
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-avoid_negative_ts",
    "make_zero",
    outputName
  ]);
  const clipData = await ffmpeg.readFile(outputName);
  await deleteFile(ffmpeg, outputName); // Free memory
  const clipBytes = typeof clipData === "string" ? new TextEncoder().encode(clipData) : clipData;
  const clipBlobPart = clipBytes as BlobPart;
  return new Blob([clipBlobPart], { type: "video/mp4" });
}

export async function extractThumbnail(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  timestamp: number
) {
  const safeTimestamp = Math.max(0, timestamp);
  // Extract thumbnail in 9:16 vertical aspect ratio (640x1138)
  // Scale to fit and add padding if needed
  await ffmpeg.exec([
    "-ss",
    safeTimestamp.toFixed(3),
    "-i",
    inputName,
    "-frames:v",
    "1",
    "-q:v",
    "5",
    "-vf",
    "scale=640:1138:force_original_aspect_ratio=decrease,pad=640:1138:(ow-iw)/2:(oh-ih)/2:black",
    outputName
  ]);
  const thumbData = await ffmpeg.readFile(outputName);
  await deleteFile(ffmpeg, outputName); // Free memory
  const thumbBytes = typeof thumbData === "string" ? new TextEncoder().encode(thumbData) : thumbData;
  const thumbBlobPart = thumbBytes as BlobPart;
  return new Blob([thumbBlobPart], { type: "image/jpeg" });
}

// Clean up input file after all processing is done
export async function cleanupInputFile(ffmpeg: FFmpeg, inputName: string) {
  await deleteFile(ffmpeg, inputName);
}
