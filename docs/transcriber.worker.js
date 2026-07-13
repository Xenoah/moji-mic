async function loadTransformers() {
  if (!("DecompressionStream" in self)) {
    return import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1");
  }

  const response = await fetch("./vendor/transformers.min.js.gz");
  if (!response.ok || !response.body) {
    throw new Error("AIエンジンを読み込めませんでした");
  }
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  const source = await new Response(stream).text();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    return await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

const { env, pipeline } = await loadTransformers();

const pipelines = new Map();

env.useBrowserCache = true;
env.allowRemoteModels = true;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/";
}

function post(message) {
  self.postMessage(message);
}

async function getPipeline(model, device) {
  const key = `${model}:${device}`;
  const cached = pipelines.get(key);
  if (cached) return { instance: cached, loaded: false };

  post({
    type: "log",
    message: `${device.toUpperCase()}で ${model.split("/").pop()} を準備中`,
  });

  const instance = await pipeline("automatic-speech-recognition", model, {
    device,
    dtype: device === "webgpu"
      ? { encoder_model: "fp32", decoder_model_merged: "q4" }
      : "q8",
    progress_callback: (progress) => {
      post({
        type: "download",
        status: progress.status,
        file: progress.file,
        progress: progress.progress,
        loaded: progress.loaded,
        total: progress.total,
      });
    },
  });

  pipelines.set(key, instance);
  return { instance, loaded: true };
}

self.addEventListener("message", async (event) => {
  const {
    type,
    requestId,
    audio,
    model,
    language,
    device = "wasm",
  } = event.data;

  if (!model || !["load", "transcribe"].includes(type)) return;

  try {
    const { instance: transcriber, loaded } = await getPipeline(model, device);
    if (loaded || type === "load") post({ type: "ready", model, device });
    if (type === "load") return;

    const result = await transcriber(audio, {
      task: "transcribe",
      language: language ?? undefined,
      return_timestamps: true,
    });
    const value = Array.isArray(result) ? result[0] : result;
    post({
      type: "result",
      requestId,
      text: value?.text ?? "",
      chunks: value?.chunks ?? [],
    });
  } catch (error) {
    post({
      type: "error",
      requestId,
      model,
      device,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
