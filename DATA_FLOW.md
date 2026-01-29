# Reelify Data Flow Documentation

## Overview
Reelify is an Arabic video reel generator that processes long-form videos and automatically creates short-form clips optimized for social media platforms (Instagram Reels, TikTok, YouTube Shorts, etc.).

---

## Complete Data Flow Pipeline

### Phase 1: Video Upload & Background Processing

**Step 1.1: User Uploads Video**
- **Location**: `app/page.tsx` - Upload screen
- **Tool**: Browser File API
- **Action**: User selects video file (MP4, MOV, AVI)
- **Validation**: File size limit 100MB
- **Output**: `File` object stored in React state

**Step 1.2: Background Audio Extraction (Parallel Processing)**
- **Location**: `app/page.tsx` - `startBackgroundProcessing()` function
- **Tool**: FFmpeg WASM (`@ffmpeg/ffmpeg`)
- **Process**:
  1. Load FFmpeg WASM library
  2. Write video file to FFmpeg virtual filesystem
  3. Extract audio track using FFmpeg command:
     ```
     -i input.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 audio.wav
     ```
  4. Convert audio to WAV format (16kHz, mono)
- **Output**: Audio Blob (WAV format)

**Step 1.3: Upload Audio to Cloud Storage**
- **Location**: `app/page.tsx` - `startBackgroundProcessing()` function
- **Endpoint**: `/api/upload` (POST)
- **Tool**: Vercel Blob Storage (`@vercel/blob/client`)
- **Process**:
  1. Create File object from audio Blob
  2. Upload to Vercel Blob via `/api/upload` endpoint
  3. Store returned URL for later processing
- **Output**: `audioUrl` (Vercel Blob URL)
- **API Details**:
  - **Endpoint**: `POST /api/upload`
  - **Handler**: `app/api/upload/route.ts`
  - **Max Size**: 100MB
  - **Allowed Types**: audio/wav, audio/mpeg, video/mp4, video/quicktime, image/jpeg

---

### Phase 2: User Preferences Collection

**Step 2.1: Preference Form (5 Questions)**
- **Location**: `app/page.tsx` - Form screen
- **Questions**:
  1. **Platform Selection** (Required)
     - Options: Instagram, TikTok, YouTube Shorts, Snapchat, Facebook, LinkedIn
     - Auto-sets recommended duration based on platform
  2. **Preferred Duration** (Required)
     - Options: 30, 45, 60, 75, 90 seconds
     - Default based on selected platform
  3. **Target Audience** (Optional)
     - Pre-defined options or custom text input
     - Can be skipped
  4. **Tone** (Optional)
     - Options: ملهم (Inspiring), تعليمي (Educational), حماسي (Energetic), etc.
     - Can be skipped
  5. **Hook Style** (Optional)
     - Options: سؤال مباشر (Direct Question), رقم قوي (Strong Number), etc.
     - Can be skipped

**Step 2.2: Persist Preferences**
- **Location**: `app/page.tsx` - `persistPreferences()` function
- **Endpoint**: `/api/preferences` (POST)
- **Tool**: File System (`fs/promises`)
- **Process**:
  1. Send preferences to `/api/preferences` endpoint
  2. Server saves to `data/user-preferences.json`
  3. Preferences are merged with existing stored preferences
- **API Details**:
  - **Endpoint**: `POST /api/preferences`
  - **Handler**: `app/api/preferences/route.ts`
  - **Storage**: `lib/qaStore.ts`
  - **File**: `data/user-preferences.json`

---

### Phase 3: Audio Transcription & AI Analysis

**Step 3.1: Initiate Processing**
- **Location**: `app/page.tsx` - `onStartProcessing()` function
- **Trigger**: User clicks "ابدأ التحويل" (Start Conversion)
- **Prerequisites**: 
  - Background processing must be complete (audioUrl available)
  - User preferences collected (or skipped)

**Step 3.2: Call Processing API**
- **Location**: `app/page.tsx` - `onStartProcessing()` function
- **Endpoint**: `/api/process` (POST)
- **Request Body**:
  ```json
  {
    "audioUrl": "https://...blob.vercel-storage.com/...",
    "preferences": {
      "platform": "instagram",
      "preferredDuration": 45,
      "audience": "شباب 18-30",
      "tone": "ملهم",
      "hookStyle": "سؤال مباشر"
    }
  }
  ```
- **API Details**:
  - **Endpoint**: `POST /api/process`
  - **Handler**: `app/api/process/route.ts`
  - **Runtime**: Node.js

**Step 3.3: Download Audio from Blob Storage**
- **Location**: `app/api/process/route.ts`
- **Tool**: Node.js `fetch` API
- **Process**:
  1. Create temporary directory
  2. Download audio file from Vercel Blob URL
  3. Save to temporary file (`audio.wav`)
- **Output**: Local audio file path

**Step 3.4: Transcribe Audio**
- **Location**: `app/api/process/route.ts` → `lib/elevenlabs.ts`
- **Tool**: ElevenLabs Speech-to-Text API
- **API Endpoint**: `https://api.elevenlabs.io/v1/speech-to-text`
- **Process**:
  1. Read audio file from disk
  2. Create FormData with audio file
  3. Send POST request to ElevenLabs API:
     - Model: `scribe_v1`
     - Timestamps granularity: `word`
     - API Key: `ELEVENLABS_API_KEY` (from env)
  4. Parse response to extract word-level timestamps
  5. Group words into segments (max 12 words per segment)
- **Output**: `TranscriptSegment[]` array:
  ```typescript
  {
    start: number,  // seconds
    end: number,    // seconds
    text: string    // Arabic text
  }[]
  ```

**Step 3.5: Load User Preferences**
- **Location**: `app/api/process/route.ts`
- **Tool**: File System (`lib/qaStore.ts`)
- **Process**:
  1. Check if preferences provided in request
  2. If not, load from `data/user-preferences.json`
  3. Merge request preferences with stored preferences
- **Output**: `QAPreferences` object

**Step 3.6: Generate Clip Candidates with AI**
- **Location**: `app/api/process/route.ts` → `lib/gemini.ts`
- **Tool**: Google Gemini AI (`@google/generative-ai`)
- **Model**: `gemini-2.5-pro` (configurable via `GEMINI_MODEL` env var)
- **Process**:
  1. Format transcript with timestamps:
     ```
     [0.00 - 5.23] النص العربي...
     [5.23 - 10.45] المزيد من النص...
     ```
  2. Build prompt with:
     - Transcript with timestamps
     - User preferences (platform, duration, audience, tone, hook style)
     - Instructions for selecting best 3 clips (30-90 seconds)
     - Requirements for titles, categories, and tags
  3. Send prompt to Gemini API
  4. Parse JSON response (with error recovery)
  5. Validate clip candidates:
     - Duration between 30-90 seconds
     - Valid start/end times
     - Snap timestamps to nearest segment boundaries
- **Output**: `ClipCandidate[]` array:
  ```typescript
  {
    title: string,      // Arabic title
    start: number,      // seconds
    end: number,        // seconds
    category: string,   // e.g., "تعليمي", "ترفيهي"
    tags: string[]      // Arabic tags
  }[]
  ```
- **API Details**:
  - **API Key**: `GEMINI_API_KEY` (from env)
  - **Model**: `GEMINI_MODEL` (default: `gemini-2.5-pro`)

**Step 3.7: Return Results**
- **Location**: `app/api/process/route.ts`
- **Response**:
  ```json
  {
    "clips": [
      {
        "title": "...",
        "start": 0,
        "end": 45,
        "category": "...",
        "tags": ["...", "..."]
      }
    ],
    "segments": [
      {
        "start": 0,
        "end": 5.23,
        "text": "..."
      }
    ]
  }
  ```

---

### Phase 4: Video Clip Generation

**Step 4.1: Process Each Clip Candidate**
- **Location**: `app/page.tsx` - `onStartProcessing()` function
- **Tool**: FFmpeg WASM (client-side)
- **Process**: For each clip candidate:
  1. Extract video segment using FFmpeg:
     ```
     -ss {start} -i input.mp4 -t {duration} -c copy clip.mp4
     ```
  2. Extract thumbnail from first frame:
     ```
     -ss {start} -i input.mp4 -frames:v 1 -vf "scale=720:-1" thumb.jpg
     ```
  3. Generate transcript text for clip time range
  4. Upload clip to Vercel Blob Storage
  5. Upload thumbnail to Vercel Blob Storage

**Step 4.2: Upload Clips & Thumbnails**
- **Location**: `app/page.tsx` - `onStartProcessing()` function
- **Endpoint**: `/api/upload` (POST)
- **Tool**: Vercel Blob Storage
- **Process**:
  1. Upload video clip file
  2. Upload thumbnail image file
  3. Store URLs in clip objects
- **Output**: Complete `ClipItem[]` array:
  ```typescript
  {
    title: string,
    duration: number,
    url: string,           // Video URL
    start: number,
    end: number,
    thumbnail: string,     // Thumbnail URL
    category: string,
    tags: string[],
    transcript: string     // Text transcript for this clip
  }[]
  ```

**Step 4.3: Cleanup**
- **Location**: `app/page.tsx` - `onStartProcessing()` function
- **Process**:
  1. Delete input video file from FFmpeg virtual filesystem
  2. Free memory

---

### Phase 5: Results Display

**Step 5.1: Display Clips**
- **Location**: `app/page.tsx` - Results screen
- **UI Elements**:
  - Thumbnail image (9:16 aspect ratio)
  - Title, category, tags
  - Duration badge
  - "معاينة وتحميل" (Preview & Download) button

**Step 5.2: Preview & Download**
- **Location**: `app/preview/page.tsx`
- **Process**: User clicks preview button → navigates to preview page
- **Features**: Video player with editing capabilities (caption editor, timeline, etc.)

---

## API Endpoints Summary

### 1. `/api/upload` (POST)
- **Purpose**: Upload files to Vercel Blob Storage
- **Handler**: `app/api/upload/route.ts`
- **Tool**: `@vercel/blob/client`
- **Allowed Types**: audio/wav, audio/mpeg, video/mp4, video/quicktime, image/jpeg
- **Max Size**: 100MB
- **Returns**: Blob URL

### 2. `/api/preferences` (GET/POST)
- **Purpose**: Get/save user preferences
- **Handler**: `app/api/preferences/route.ts`
- **Storage**: `data/user-preferences.json`
- **GET**: Returns current preferences
- **POST**: Saves preferences (merges with existing)

### 3. `/api/process` (POST)
- **Purpose**: Main processing pipeline (transcription + AI analysis)
- **Handler**: `app/api/process/route.ts`
- **Request Body**:
  ```json
  {
    "audioUrl": "string",
    "preferences": {
      "platform": "string",
      "preferredDuration": number,
      "audience": "string",
      "tone": "string",
      "hookStyle": "string"
    }
  }
  ```
- **Response**:
  ```json
  {
    "clips": ClipCandidate[],
    "segments": TranscriptSegment[]
  }
  ```
- **External APIs Used**:
  - ElevenLabs Speech-to-Text API
  - Google Gemini AI API

---

## Tools & Technologies Used

### Client-Side
1. **FFmpeg WASM** (`@ffmpeg/ffmpeg`)
   - Video processing (audio extraction, clipping, thumbnail generation)
   - Runs entirely in browser

2. **Vercel Blob Client** (`@vercel/blob/client`)
   - File uploads to cloud storage

3. **React** (`react`)
   - UI framework and state management

### Server-Side
1. **ElevenLabs API**
   - Speech-to-text transcription
   - Word-level timestamps
   - Arabic language support

2. **Google Gemini AI** (`@google/generative-ai`)
   - Content analysis
   - Clip candidate generation
   - Natural language understanding

3. **Vercel Blob Storage**
   - Cloud file storage
   - Public URLs for media files

4. **Node.js File System** (`fs/promises`)
   - Temporary file management
   - Preferences storage

---

## Data Flow Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER UPLOADS VIDEO                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKGROUND PROCESSING (Parallel)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. FFmpeg WASM extracts audio from video                │  │
│  │ 2. Convert to WAV (16kHz, mono)                         │  │
│  │ 3. Upload audio to Vercel Blob → /api/upload            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              USER FILLS PREFERENCES FORM (5 Questions)          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Platform (Required)                                   │  │
│  │ • Duration (Required)                                   │  │
│  │ • Audience (Optional)                                    │  │
│  │ • Tone (Optional)                                        │  │
│  │ • Hook Style (Optional)                                   │  │
│  │                                                           │  │
│  │ Preferences saved to /api/preferences                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    USER CLICKS "START PROCESSING"               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POST /api/process                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Request: { audioUrl, preferences }                      │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              DOWNLOAD AUDIO FROM VERCEL BLOB                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Fetch audioUrl                                         │  │
│  │ • Save to temp file (audio.wav)                          │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              TRANSCRIBE AUDIO (ElevenLabs API)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • POST to api.elevenlabs.io/v1/speech-to-text           │  │
│  │ • Model: scribe_v1                                      │  │
│  │ • Returns: word-level timestamps                        │  │
│  │ • Group into segments (max 12 words)                    │  │
│  │ • Output: TranscriptSegment[]                           │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              LOAD USER PREFERENCES                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Merge request preferences with stored preferences      │  │
│  │ • Load from data/user-preferences.json                   │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              GENERATE CLIP CANDIDATES (Gemini AI)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Format transcript with timestamps                      │  │
│  │ • Build prompt with preferences                          │  │
│  │ • POST to Gemini API (gemini-2.5-pro)                   │  │
│  │ • Parse JSON response                                    │  │
│  │ • Validate clips (30-90 seconds)                        │  │
│  │ • Snap timestamps to segment boundaries                  │  │
│  │ • Output: ClipCandidate[] (3 clips)                      │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              RETURN RESULTS TO CLIENT                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Response: { clips: ClipCandidate[], segments: [] }       │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLIENT-SIDE VIDEO PROCESSING                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ For each clip candidate:                                 │  │
│  │ 1. Extract video segment (FFmpeg WASM)                  │  │
│  │ 2. Extract thumbnail (FFmpeg WASM)                      │  │
│  │ 3. Generate transcript text for clip                     │  │
│  │ 4. Upload clip → /api/upload                             │  │
│  │ 5. Upload thumbnail → /api/upload                       │  │
│  │ 6. Store URLs in ClipItem[]                             │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DISPLAY RESULTS                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Show clip thumbnails                                   │  │
│  │ • Display titles, categories, tags                       │  │
│  │ • "Preview & Download" buttons                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

- `ELEVENLABS_API_KEY`: API key for ElevenLabs Speech-to-Text
- `GEMINI_API_KEY`: API key for Google Gemini AI
- `GEMINI_MODEL`: Gemini model name (default: `gemini-2.5-pro`)
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob storage token

---

## Key Files

- **Frontend**: `app/page.tsx` (main UI and orchestration)
- **Processing API**: `app/api/process/route.ts` (main processing endpoint)
- **Upload API**: `app/api/upload/route.ts` (file upload handler)
- **Preferences API**: `app/api/preferences/route.ts` (preferences storage)
- **Transcription**: `lib/elevenlabs.ts` (ElevenLabs integration)
- **AI Analysis**: `lib/gemini.ts` (Gemini AI integration)
- **Video Processing**: `lib/ffmpegWasm.ts` (FFmpeg WASM wrapper)
- **Preferences Storage**: `lib/qaStore.ts` (file-based preferences)

---

## Performance Optimizations

1. **Background Processing**: Audio extraction happens while user fills form
2. **Stream Copy**: Video clipping uses `-c copy` (no re-encoding)
3. **Temporary File Cleanup**: Audio files deleted after processing
4. **Memory Management**: FFmpeg files deleted after use
5. **Parallel Operations**: Multiple clips processed sequentially but uploads can be parallelized
