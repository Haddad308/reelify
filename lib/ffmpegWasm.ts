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
  await ffmpeg.exec([
    "-ss",
    safeStart.toFixed(3),
    "-to",
    safeEnd.toFixed(3),
    "-i",
    inputName,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputName
  ]);
  const clipData = await ffmpeg.readFile(outputName);
  const clipBytes = typeof clipData === "string" ? new TextEncoder().encode(clipData) : clipData;
  const clipBlobPart = clipBytes as BlobPart;
  return new Blob([clipBlobPart], { type: "video/mp4" });
}
