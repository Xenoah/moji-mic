/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";

type Device = "webgpu" | "wasm";
type AsrResult = { text?: string; chunks?: Array<{ text: string; timestamp: [number, number] }> };
type AsrPipeline = (
  input: Float32Array,
  options: Record<string, unknown>,
) => Promise<AsrResult | AsrResult[]>;
type CreatePipeline = (
  task: string,
  model: string,
  options: Record<string, unknown>,
) => Promise<AsrPipeline>;

const pipelines = new Map<string, AsrPipeline>();
const createPipeline = pipeline as unknown as CreatePipeline;

env.useBrowserCache = true;
env.allowRemoteModels = true;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/";
}

function post(message: unknown) {
  self.postMessage(message);
}

async function getPipeline(model: string, device: Device) {
  const key = `${model}:${device}`;
  const cached = pipelines.get(key);
  if (cached) return { instance: cached, loaded: false };
  post({ type: "log", message: `${device.toUpperCase()}で ${model.split("/").pop()} を準備中` });
  const instance = await createPipeline("automatic-speech-recognition", model, {
    device,
    dtype: device === "webgpu"
      ? { encoder_model: "fp32", decoder_model_merged: "q4" }
      : "q8",
    progress_callback: (progress: Record<string, unknown>) => {
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

self.addEventListener("message", async (event: MessageEvent) => {
  const { type, requestId, audio, model, language, device = "wasm" } = event.data;
  try {
    const { instance: transcriber, loaded } = await getPipeline(model, device as Device);
    if (loaded || type === "load") post({ type: "ready", model, device });
    if (type === "load") return;
    if (type !== "transcribe") return;
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
    post({ type: "error", requestId, message: error instanceof Error ? error.message : String(error) });
  }
});

export {};
