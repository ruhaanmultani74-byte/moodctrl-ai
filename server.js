const express = require("express");
const path = require("path");
const fs = require("fs");
const { Client, handle_file } = require("@gradio/client");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname)));

const MUSETALK_SPACE = "henrybit/musetalk-1-5";

let jobs = new Map();

app.get("/api/config", (req, res) => {
  res.json({
    configured: true,
    provider: "MuseTalk 1.5 ZeroGPU"
  });
});

app.get("/api/avatars", (req, res) => {
  res.json([
    { id: "default", name: "Default Avatar" }
  ]);
});

app.get("/api/voices", (req, res) => {
  res.json([
    { id: "default", name: "Default Voice" }
  ]);
});

app.post("/api/generate", async (req, res) => {
  const jobId = Date.now().toString();

  try {
    const {
      idea,
      audioUrl,
      avatarUrl
    } = req.body;

    if (!audioUrl || !avatarUrl) {
      return res.status(400).json({
        error: "audioUrl and avatarUrl are required."
      });
    }

    jobs.set(jobId, {
      status: "processing"
    });

    res.json({
      videoId: jobId,
      status: "processing"
    });

    processMuseTalk(jobId, audioUrl, avatarUrl);

  } catch (error) {
    jobs.set(jobId, {
      status: "error",
      error: error.message
    });
  }
});

app.get("/api/status/:id", (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({
      status: "error",
      error: "Job not found"
    });
  }

  res.json(job);
});

async function processMuseTalk(jobId, audioUrl, avatarUrl) {
  try {
    const client = await Client.connect(MUSETALK_SPACE);

    const audio = handle_file(audioUrl);
    const avatar = handle_file(avatarUrl);

    const result = await client.predict("/generate", [
      audio,
      avatar,
      0,
      10,
      "jaw",
      90,
      90
    ]);

    const output = result.data?.[0];

    if (!output) {
      throw new Error("MuseTalk did not return a video.");
    }

    let videoUrl;

    if (typeof output === "string") {
      videoUrl = output;
    } else if (output.url) {
      videoUrl = output.url;
    } else if (output.path) {
      videoUrl = output.path;
    }

    if (!videoUrl) {
      throw new Error("Could not read the generated video URL.");
    }

    jobs.set(jobId, {
      status: "created",
      video_url: videoUrl
    });

  } catch (error) {
    console.error("MuseTalk error:", error);

    jobs.set(jobId, {
      status: "error",
      error: error.message || "MuseTalk generation failed."
    });
  }
}

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`MOODCTRL AI running on port ${PORT}`);
});
