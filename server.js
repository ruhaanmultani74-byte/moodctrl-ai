const express = require("express");
const path = require("path");
const { Client, handle_file } = require("@gradio/client");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

const MUSETALK = "henrybit/musetalk-1-5";
const TTS = "remsky/Kokoro-TTS-Zero";

const jobs = new Map();

app.get("/api/config", (req, res) => {
  res.json({
    configured: true,
    provider: "Hugging Face ZeroGPU"
  });
});

app.get("/api/avatars", (req, res) => {
  res.json([
    {
      id: "default",
      name: "Default AI Avatar",
      url: "https://raw.githubusercontent.com/ruhaanmultani74-byte/moodctrl-ai/main/avatar.jpg"
    }
  ]);
});

app.get("/api/voices", (req, res) => {
  res.json([
    { id: "af_heart", name: "Sarah" },
    { id: "af_bella", name: "Bella" },
    { id: "am_adam", name: "Adam" },
    { id: "am_michael", name: "Michael" }
  ]);
});

app.post("/api/generate", async (req, res) => {
  const jobId = Date.now().toString();

  const {
    idea,
    avatarUrl,
    voice = "af_heart"
  } = req.body;

  if (!idea || !idea.trim()) {
    return res.status(400).json({
      error: "Please enter an idea."
    });
  }

  jobs.set(jobId, {
    status: "processing",
    message: "Creating your AI reel..."
  });

  res.json({
    videoId: jobId,
    status: "processing"
  });

  createReel(jobId, idea.trim(), avatarUrl, voice);
});

app.get("/api/status/:id", (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({
      status: "error",
      error: "Job not found."
    });
  }

  res.json(job);
});

async
