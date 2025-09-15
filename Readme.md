# Video Processing Server

A Node.js server that receives trimmed videos from a mobile frontend, optionally overlays audio, converts videos to HLS format, and generates thumbnails automatically.

---

## Features

- Accepts a trimmed video via `POST /share`.
- Optionally overlays an audio track with start/end times.
- Generates a thumbnail automatically at 1 second.
- Converts video to HLS (`.m3u8`) for streaming.
- Lists all processed videos with their thumbnails via `GET /videos`.

---

## Requirements

- Node.js >= 18
- ffmpeg (installed automatically via `ffmpeg-static`)
- npm or yarn

---

## Installation

1. Clone the repository:

```bash
git clone https://github.com/spases13/video-upload-server-hls-m3u
cd video-processing-server
```
