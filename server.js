const express = require("express");
const path = require("path");
const { Client, handle_file } = require("@gradio/client");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

const MUSETALK_SPACE = "henrybit/musetalk-1-5";
const TTS_SPACE = "remsky/Kokoro-TTS-Zero";

const jobs = new Map();

const DEFAULT_AVATAR =
  "https://raw.githubusercontent.com/ruhaanmultani74-byte/moodctrl-ai/main/avatar.jpg";

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
      url: DEFAULT_AVATAR
    }
  ]);
});

app.get("/api/voices", (req, res) => {
  res.json([
    { id: "af_jadzia", name: "Jadzia" },
    { id: "af_sky", name: "Sky" },
    { id: "af_heart", name: "Heart" },
    { id: "af_bella", name: "Bella" }
  ]);
});

app.post("/api/generate", async (req, res) => {
  const jobId = Date.now().toString();

  const idea = String(req.body.idea || "").trim();
  const voice = req.body.voice || "af_jadzia";
  const avatarUrl = req.body.avatarUrl || DEFAULT_AVATAR;

  if (!idea) {
    return res.status(400).json({
      error: "Please enter an idea."
    });
  }

  jobs.set(jobId, {
    status: "processing",
    message: "Starting AI generation..."
  });

  res.json({
    videoId: jobId,
    status: "processing"
  });

  createReel(jobId, idea, voice, avatarUrl);
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

async function createReel(jobId, idea, voice, avatarUrl) {
  try {
    jobs.set(jobId, {
      status: "processing",
      message: "Generating AI voice..."
    });

    const ttsClient = await Client.connect(TTS_SPACE);

    const ttsResult = await ttsClient.predict("/generate_speech_from_ui", [
      idea,
      [voice],
      1
    ]);

    const audioOutput = ttsResult.data?.[0];

    if (!audioOutput) {
      throw new Error("AI voice generation returned no audio.");
    }

    const audioPath =
      typeof audioOutput === "string"
        ? audioOutput
        : audioOutput.path || audioOutput.url;

    if (!audioPath) {
      throw new Error("Could not read the generated audio.");
    }

    jobs.set(jobId, {
      status: "processing",
      message: "AI voice ready. Creating talking avatar..."
    });

    const museClient = await Client.connect(MUSETALK_SPACE);

    const audio = handle_file(audioPath);
    const avatar = handle_file(avatarUrl);

    const result = await museClient.predict("/generate", [
      audio,
      avatar,
      0,
      10,
      "jaw",
      90,
      90
    ]);

    const output = result.data?.[0];

    let videoUrl = null;

    if (typeof output === "string") {
      videoUrl = output;
    } else if (output?.url) {
      videoUrl = output.url;
    } else if (output?.path) {
      videoUrl = output.path;
    }

    if (!videoUrl) {
      throw new Error("MuseTalk returned no video.");
    }

    jobs.set(jobId, {
      status: "created",
      video_url: videoUrl,
      message: "Your AI Reel is ready!"
    });

  } catch (error) {
    console.error("AI generation error:", error);

    jobs.set(jobId, {
      status: "error",
      error: error.message || "AI generation failed."
    });
  }
}

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`MOODCTRL AI running on port ${PORT}`);
});
