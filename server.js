// server.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static");

// tell fluent-ffmpeg where to find both binaries
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

const app = express();
const PORT = process.env.PORT || 4455;

// Output folder
const OUTPUT_DIR = path.join(__dirname, "processed");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Serve processed videos as static
app.use("/processed", express.static(OUTPUT_DIR));

// Multer config → accept only video
const upload = multer({ dest: "uploads/" }).single("video");

// POST /share
app.post("/share", upload, async (req, res) => {
  try {
    console.log("📥 Received /share request");

    const videoFile = req.file;
    if (!videoFile) return res.status(400).json({ error: "❌ Missing video" });

    const songPath = req.body.songId; // now the client sends the path directly
    const musicStart = parseFloat(req.body.musicIntervalSelectedStartTime) || 0;
    const musicEnd = parseFloat(req.body.musicIntervalSelectedEndTime) || 0;

    // Resolve song path if provided
    let audioFilePath = null;
    if (songPath) {
      audioFilePath = path.join(__dirname, songPath);
      if (!fs.existsSync(audioFilePath)) {
        return res.status(400).json({ error: "❌ Invalid song path" });
      }
    }

    // Create dedicated folder for this process
    const timestamp = Date.now();
    const processFolder = path.join(OUTPUT_DIR, `vibe_${timestamp}`);
    fs.mkdirSync(processFolder, { recursive: true });

    const outputHls = path.join(processFolder, `index.m3u8`);
    const thumbnailPath = path.join(processFolder, "thumbnail.jpg");

    // Respond immediately
    res.json({
      message: "✅ Ok, processing started",
      folder: `vibe_${timestamp}`,
      song: songPath || null, // return the path
    });

    // Probe video metadata
    ffmpeg.ffprobe(videoFile.path, (err, metadata) => {
      if (err) {
        console.error("❌ ffprobe error:", err);
        return;
      }

      const { width, height } =
        metadata.streams.find((s) => s.width && s.height) || {};
      console.log(`📏 Video resolution: ${width}x${height}`);

      // Generate thumbnail automatically at 1 second
      ffmpeg(videoFile.path)
        .screenshots({
          timestamps: ["1"],
          filename: "thumbnail.jpg",
          folder: processFolder,
          size: "320x?",
        })
        .on("end", () => console.log("🖼️ Thumbnail generated:", thumbnailPath))
        .on("error", (err) => console.error("❌ Thumbnail error:", err));

      // Start HLS conversion
      let ffmpegCommand = ffmpeg(videoFile.path)
        .videoCodec("libx264")
        .outputOptions([
          "-preset veryfast",
          "-crf 23",
          "-hls_time 5",
          "-hls_playlist_type vod",
        ]);

      if (width > 1920 || height > 1080) {
        console.log("📉 Downscaling video to HD (1920x1080)");
        ffmpegCommand = ffmpegCommand.size("?x1080");
      }

      if (audioFilePath) {
        ffmpegCommand = ffmpegCommand
          .input(audioFilePath)
          .inputOptions([`-ss ${musicStart}`, `-to ${musicEnd}`])
          .outputOptions(["-map 0:v:0", "-map 1:a:0"])
          .audioCodec("aac");
      }

      ffmpegCommand
        .output(outputHls)
        .on("start", (cmd) => console.log(`🚀 FFmpeg command: ${cmd}`))
        .on("end", () => {
          console.log("✅ FFmpeg finished, removing temp upload");
          fs.unlinkSync(videoFile.path);

          const publicUrl = `${req.protocol}://${req.get(
            "host"
          )}/processed/vibe_${timestamp}/index.m3u8`;
          console.log(`🎉 Processing completed successfully`);
          console.log(`🌍 Accessible at: ${publicUrl}`);
        })
        .on("error", (err) => console.error("❌ FFmpeg error:", err))
        .run();
    });
  } catch (err) {
    console.error("⚠️ Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /videos → list processed videos with thumbnails
app.get("/videos", (req, res) => {
  try {
    const folders = fs
      .readdirSync(OUTPUT_DIR)
      .filter((f) => fs.lstatSync(path.join(OUTPUT_DIR, f)).isDirectory());

    const baseUrl = `${req.protocol}://${req.get("host")}/processed`;

    const videos = folders.map((folder) => {
      const folderPath = path.join(OUTPUT_DIR, folder);
      const files = fs.readdirSync(folderPath);

      const playlist = files.find((f) => f.endsWith(".m3u8"));
      const thumbnail = files.find((f) => f.startsWith("thumbnail"));

      return {
        folder,
        url: playlist ? `${baseUrl}/${folder}/${playlist}` : null,
        thumbnail: thumbnail ? `${baseUrl}/${folder}/${thumbnail}` : null,
      };
    });

    res.json({ count: videos.length, videos });
  } catch (err) {
    console.error("❌ Error reading videos:", err);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

app.listen(PORT, () =>
  console.log(`🌐 Server running on ${PORT}`)
);
