# Reelify Data Flow - Visual Diagram

## Simplified Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 1: UPLOAD & PREP                             │
└─────────────────────────────────────────────────────────────────────────────┘

    User Browser                    Client-Side Processing
    ┌─────────────┐                ┌──────────────────────┐
    │ Upload Video│───────────────▶│  FFmpeg WASM         │
    │   (File)    │                │  • Extract Audio    │
    └─────────────┘                │  • Convert to WAV   │
                                   └──────────┬───────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │  Vercel Blob Client  │
                                   │  Upload Audio        │
                                   └──────────┬───────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │  POST /api/upload     │
                                   └──────────┬───────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │  Vercel Blob Storage │
                                   │  audioUrl returned   │
                                   └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 2: USER PREFERENCES                               │
└─────────────────────────────────────────────────────────────────────────────┘

    User Browser                    API Endpoint
    ┌─────────────┐                ┌──────────────────────┐
    │ Fill Form   │───────────────▶│ POST /api/preferences│
    │ (5 Q's)     │                └──────────┬───────────┘
    └─────────────┘                           │
                                              ▼
                                   ┌──────────────────────┐
                                   │  File System         │
                                   │  Save to JSON        │
                                   │  data/user-preferences│
                                   └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: TRANSCRIPTION & AI ANALYSIS                       │
└─────────────────────────────────────────────────────────────────────────────┘

    User Browser                    Server API
    ┌─────────────┐                ┌──────────────────────┐
    │ Click Start │───────────────▶│ POST /api/process    │
    │ Processing  │                │ { audioUrl, prefs }  │
    └─────────────┘                └──────────┬───────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │ Download Audio       │
                                   │ from Vercel Blob     │
                                   └──────────┬───────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │ ElevenLabs API       │
                                   │ Speech-to-Text       │
                                   │ • Model: scribe_v1   │
                                   │ • Word timestamps    │
                                   └──────────┬───────────┘
                                              │
                                              ▼ TranscriptSegment[]
                                   ┌──────────────────────┐
                                   │ Google Gemini API    │
                                   │ • Model: gemini-2.5  │
                                   │ • Analyze transcript │
                                   │ • Generate 3 clips   │
                                   └──────────┬───────────┘
                                              │
                                              ▼ ClipCandidate[]
                                   ┌──────────────────────┐
                                   │ Return to Client     │
                                   │ { clips, segments }  │
                                   └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 4: VIDEO CLIP GENERATION                           │
└─────────────────────────────────────────────────────────────────────────────┘

    Client-Side Processing          Cloud Storage
    ┌──────────────────────┐        ┌──────────────────────┐
    │ FFmpeg WASM          │        │                      │
    │ • Clip video         │        │                      │
    │ • Extract thumbnail  │        │                      │
    └──────────┬───────────┘        │                      │
               │                    │                      │
               ▼                    │                      │
    ┌──────────────────────┐        │                      │
    │ Upload Clip          │────────▶│  Vercel Blob        │
    │ Upload Thumbnail     │────────▶│  Storage            │
    └──────────────────────┘        │                      │
                                     │                      │
                                     └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                          PHASE 5: RESULTS DISPLAY                             │
└─────────────────────────────────────────────────────────────────────────────┘

    User Browser
    ┌──────────────────────┐
    │ Display Clips        │
    │ • Thumbnails         │
    │ • Titles, Tags       │
    │ • Preview Button     │
    └──────────────────────┘
```

---

## Detailed Tool Usage Per Step

### Step 1: Video Upload
- **Tool**: Browser File API
- **Input**: User-selected video file
- **Output**: File object

### Step 2: Audio Extraction
- **Tool**: FFmpeg WASM (`@ffmpeg/ffmpeg`)
- **Command**: `-i input.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 audio.wav`
- **Input**: Video file
- **Output**: WAV audio blob

### Step 3: Audio Upload
- **Tool**: Vercel Blob Client (`@vercel/blob/client`)
- **Endpoint**: `POST /api/upload`
- **Input**: Audio blob
- **Output**: `audioUrl` (public URL)

### Step 4: Preferences Collection
- **Tool**: React state management
- **Storage**: `POST /api/preferences` → File System (`data/user-preferences.json`)
- **Input**: User form responses
- **Output**: Preferences object

### Step 5: Processing Request
- **Tool**: Fetch API
- **Endpoint**: `POST /api/process`
- **Input**: `{ audioUrl, preferences }`
- **Output**: `{ clips, segments }`

### Step 6: Audio Download
- **Tool**: Node.js `fetch` + File System
- **Input**: Vercel Blob URL
- **Output**: Temporary audio file (`audio.wav`)

### Step 7: Transcription
- **Tool**: ElevenLabs Speech-to-Text API
- **Endpoint**: `https://api.elevenlabs.io/v1/speech-to-text`
- **Model**: `scribe_v1`
- **Input**: Audio file
- **Output**: `TranscriptSegment[]` with timestamps

### Step 8: AI Analysis
- **Tool**: Google Gemini AI (`@google/generative-ai`)
- **Model**: `gemini-2.5-pro`
- **Input**: Transcript + Preferences
- **Output**: `ClipCandidate[]` (3 clips with titles, timestamps, categories, tags)

### Step 9: Video Clipping
- **Tool**: FFmpeg WASM
- **Command**: `-ss {start} -i input.mp4 -t {duration} -c copy clip.mp4`
- **Input**: Original video + clip timestamps
- **Output**: Video clip blob

### Step 10: Thumbnail Extraction
- **Tool**: FFmpeg WASM
- **Command**: `-ss {start} -i input.mp4 -frames:v 1 -vf "scale=720:-1" thumb.jpg`
- **Input**: Original video + timestamp
- **Output**: Thumbnail image blob

### Step 11: Upload Media
- **Tool**: Vercel Blob Client
- **Endpoint**: `POST /api/upload`
- **Input**: Clip blob + Thumbnail blob
- **Output**: Public URLs for clips and thumbnails

---

## API Endpoints Reference

| Endpoint | Method | Purpose | Tools Used |
|----------|--------|---------|------------|
| `/api/upload` | POST | Upload files to cloud storage | Vercel Blob Client |
| `/api/preferences` | GET | Get user preferences | File System |
| `/api/preferences` | POST | Save user preferences | File System |
| `/api/process` | POST | Main processing pipeline | ElevenLabs API, Gemini API |

---

## External APIs

| Service | Purpose | Endpoint | Authentication |
|---------|---------|----------|----------------|
| **ElevenLabs** | Speech-to-Text | `api.elevenlabs.io/v1/speech-to-text` | `xi-api-key` header |
| **Google Gemini** | AI Analysis | `generativelanguage.googleapis.com` | API Key in request |
| **Vercel Blob** | File Storage | `blob.vercel-storage.com` | Token-based |

---

## Data Types Flow

```
File (Browser)
    ↓
Blob (Audio)
    ↓
Vercel Blob URL (audioUrl)
    ↓
File (Server temp)
    ↓
TranscriptSegment[] (with timestamps)
    ↓
ClipCandidate[] (AI-generated)
    ↓
ClipItem[] (with video URLs)
    ↓
Display in UI
```

---

## Key Decision Points

1. **Background Processing**: Audio extraction happens while user fills form (parallel)
2. **Preference Merging**: Request preferences override stored preferences
3. **Clip Validation**: Only clips 30-90 seconds are accepted
4. **Timestamp Snapping**: Clip boundaries snap to nearest transcript segment
5. **Error Recovery**: JSON parsing has fallback mechanisms for Gemini responses
