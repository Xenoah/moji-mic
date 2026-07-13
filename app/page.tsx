"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Segment = {
  id: string;
  start: number;
  end: number;
  text: string;
};

type TranscriptSession = {
  id: string;
  title: string;
  fileName: string;
  fileSize?: number;
  fileLastModified?: number;
  duration: number;
  createdAt: number;
  updatedAt: number;
  processedSeconds: number;
  model: string;
  language: string;
  segments: Segment[];
  text: string;
  sourceType?: "file" | "live";
};

type WorkerMessage =
  | { type: "log"; message: string }
  | { type: "download"; file?: string; progress?: number; loaded?: number; total?: number; status?: string }
  | { type: "ready"; device: string; model: string }
  | { type: "result"; requestId: string; text: string; chunks?: Array<{ text: string; timestamp: [number, number] }> }
  | { type: "error"; requestId?: string; message: string };

type PendingRequest = {
  resolve: (message: Extract<WorkerMessage, { type: "result" }>) => void;
  reject: (error: Error) => void;
};

const DB_NAME = "offline-transcriber";
const DB_VERSION = 1;
const STORE_NAME = "sessions";
const CHUNK_SECONDS = 20;
const LIVE_CHUNK_SECONDS = 5;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const MODELS = [
  { id: "onnx-community/whisper-tiny", name: "軽量", note: "Android向け・高速" },
  { id: "onnx-community/whisper-base", name: "標準", note: "速度と精度のバランス" },
  { id: "onnx-community/whisper-small", name: "高精度", note: "Windows向け・容量大" },
];

const FEATURED_LANGUAGES = [
  { id: "japanese", name: "日本語" },
  { id: "english", name: "英語" },
  { id: "chinese", name: "中国語" },
  { id: "korean", name: "韓国語" },
  { id: "spanish", name: "スペイン語" },
  { id: "french", name: "フランス語" },
  { id: "german", name: "ドイツ語" },
  { id: "portuguese", name: "ポルトガル語" },
  { id: "russian", name: "ロシア語" },
  { id: "italian", name: "イタリア語" },
  { id: "thai", name: "タイ語" },
  { id: "vietnamese", name: "ベトナム語" },
  { id: "indonesian", name: "インドネシア語" },
  { id: "hindi", name: "ヒンディー語" },
  { id: "arabic", name: "アラビア語" },
];

const OTHER_LANGUAGES = [
  { id: "afrikaans", name: "アフリカーンス語" },
  { id: "albanian", name: "アルバニア語" },
  { id: "amharic", name: "アムハラ語" },
  { id: "armenian", name: "アルメニア語" },
  { id: "assamese", name: "アッサム語" },
  { id: "azerbaijani", name: "アゼルバイジャン語" },
  { id: "bashkir", name: "バシキール語" },
  { id: "basque", name: "バスク語" },
  { id: "belarusian", name: "ベラルーシ語" },
  { id: "bengali", name: "ベンガル語" },
  { id: "bosnian", name: "ボスニア語" },
  { id: "breton", name: "ブルトン語" },
  { id: "bulgarian", name: "ブルガリア語" },
  { id: "catalan", name: "カタルーニャ語" },
  { id: "croatian", name: "クロアチア語" },
  { id: "czech", name: "チェコ語" },
  { id: "danish", name: "デンマーク語" },
  { id: "dutch", name: "オランダ語" },
  { id: "estonian", name: "エストニア語" },
  { id: "faroese", name: "フェロー語" },
  { id: "finnish", name: "フィンランド語" },
  { id: "galician", name: "ガリシア語" },
  { id: "georgian", name: "ジョージア語" },
  { id: "greek", name: "ギリシャ語" },
  { id: "gujarati", name: "グジャラート語" },
  { id: "haitian creole", name: "ハイチ・クレオール語" },
  { id: "hausa", name: "ハウサ語" },
  { id: "hawaiian", name: "ハワイ語" },
  { id: "hebrew", name: "ヘブライ語" },
  { id: "hungarian", name: "ハンガリー語" },
  { id: "icelandic", name: "アイスランド語" },
  { id: "javanese", name: "ジャワ語" },
  { id: "kannada", name: "カンナダ語" },
  { id: "kazakh", name: "カザフ語" },
  { id: "khmer", name: "クメール語" },
  { id: "lao", name: "ラオ語" },
  { id: "latin", name: "ラテン語" },
  { id: "latvian", name: "ラトビア語" },
  { id: "lingala", name: "リンガラ語" },
  { id: "lithuanian", name: "リトアニア語" },
  { id: "luxembourgish", name: "ルクセンブルク語" },
  { id: "macedonian", name: "マケドニア語" },
  { id: "malagasy", name: "マダガスカル語" },
  { id: "malay", name: "マレー語" },
  { id: "malayalam", name: "マラヤーラム語" },
  { id: "maltese", name: "マルタ語" },
  { id: "maori", name: "マオリ語" },
  { id: "marathi", name: "マラーティー語" },
  { id: "mongolian", name: "モンゴル語" },
  { id: "myanmar", name: "ミャンマー語" },
  { id: "nepali", name: "ネパール語" },
  { id: "norwegian", name: "ノルウェー語" },
  { id: "nynorsk", name: "ニーノシュク" },
  { id: "occitan", name: "オック語" },
  { id: "pashto", name: "パシュトー語" },
  { id: "persian", name: "ペルシャ語" },
  { id: "polish", name: "ポーランド語" },
  { id: "punjabi", name: "パンジャーブ語" },
  { id: "romanian", name: "ルーマニア語" },
  { id: "sanskrit", name: "サンスクリット語" },
  { id: "serbian", name: "セルビア語" },
  { id: "shona", name: "ショナ語" },
  { id: "sindhi", name: "シンド語" },
  { id: "sinhala", name: "シンハラ語" },
  { id: "slovak", name: "スロバキア語" },
  { id: "slovenian", name: "スロベニア語" },
  { id: "somali", name: "ソマリ語" },
  { id: "sundanese", name: "スンダ語" },
  { id: "swahili", name: "スワヒリ語" },
  { id: "swedish", name: "スウェーデン語" },
  { id: "tagalog", name: "タガログ語" },
  { id: "tajik", name: "タジク語" },
  { id: "tamil", name: "タミル語" },
  { id: "tatar", name: "タタール語" },
  { id: "telugu", name: "テルグ語" },
  { id: "tibetan", name: "チベット語" },
  { id: "turkish", name: "トルコ語" },
  { id: "turkmen", name: "トルクメン語" },
  { id: "ukrainian", name: "ウクライナ語" },
  { id: "urdu", name: "ウルドゥー語" },
  { id: "uzbek", name: "ウズベク語" },
  { id: "welsh", name: "ウェールズ語" },
  { id: "yiddish", name: "イディッシュ語" },
  { id: "yoruba", name: "ヨルバ語" },
];

const LANGUAGES = [...FEATURED_LANGUAGES, ...OTHER_LANGUAGES];

function languageName(id: string) {
  if (id === "auto") return "自動判定";
  return LANGUAGES.find((item) => item.id === id)?.name ?? id;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSession(session: TranscriptSession) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function listSessions(): Promise<TranscriptSession[]> {
  const db = await openDb();
  const sessions = await new Promise<TranscriptSession[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function removeSession(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function mirrorToOpfs(session: TranscriptSession) {
  const storage = navigator.storage as StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> };
  if (!storage.getDirectory) return;
  const root = await storage.getDirectory();
  const folder = await root.getDirectoryHandle("transcripts", { create: true });
  const file = await folder.getFileHandle(`${session.id}.txt`, { create: true });
  const writable = await file.createWritable();
  await writable.write(session.text);
  await writable.close();
}

async function removeOpfsMirror(id: string) {
  const storage = navigator.storage as StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> };
  if (!storage.getDirectory) return;
  const root = await storage.getDirectory();
  try {
    const folder = await root.getDirectoryHandle("transcripts");
    await folder.removeEntry(`${id}.txt`);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
  }
}

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function sessionToSrt(session: TranscriptSession) {
  const stamp = (value: number) => {
    const ms = Math.max(0, Math.round(value * 1000));
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    const milli = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(milli).padStart(3, "0")}`;
  };
  return session.segments
    .map((segment, index) => `${index + 1}\n${stamp(segment.start)} --> ${stamp(segment.end)}\n${segment.text.trim()}\n`)
    .join("\n");
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/[. ]+$/g, "").slice(0, 120) || "transcript";
}

function download(name: string, content: string, type = "text/plain;charset=utf-8") {
  const parts = type.startsWith("text/") ? ["\uFEFF", content] : [content];
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName(name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function appendRecognizedText(current: string, segments: Segment[]) {
  const addition = segments.map((item) => item.text.trim()).filter(Boolean).join("\n");
  if (!addition) return current;
  return current.trimEnd() ? `${current.trimEnd()}\n${addition}` : addition;
}

function microphoneErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) return "マイクを開始できませんでした";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "マイクの使用が許可されていません · ブラウザ設定を確認してください";
  if (error.name === "NotFoundError") return "利用できるマイクが見つかりません";
  if (error.name === "NotReadableError" || error.name === "AbortError") return "マイクを使用できません · 他のアプリを閉じて再試行してください";
  return "マイクを開始できませんでした";
}

function resampleTo16k(buffer: AudioBuffer) {
  const inputLength = buffer.length;
  const mono = new Float32Array(inputLength);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < inputLength; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
  }
  if (buffer.sampleRate === 16000) return mono;
  const ratio = buffer.sampleRate / 16000;
  const output = new Float32Array(Math.floor(inputLength / ratio));
  for (let i = 0; i < output.length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, mono.length - 1);
    const amount = position - left;
    output[i] = mono[left] * (1 - amount) + mono[right] * amount;
  }
  return output;
}

function resamplePcmTo16k(input: Float32Array, sampleRate: number) {
  if (sampleRate === 16000) return new Float32Array(input);
  const ratio = sampleRate / 16000;
  const output = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < output.length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const amount = position - left;
    output[i] = input[left] * (1 - amount) + input[right] * amount;
  }
  return output;
}

export default function Home() {
  const [inputMode, setInputMode] = useState<"file" | "live">("file");
  const [session, setSession] = useState<TranscriptSession | null>(null);
  const [history, setHistory] = useState<TranscriptSession[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<Float32Array | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(MODELS[0].id);
  const [language, setLanguage] = useState("japanese");
  const [engine, setEngine] = useState<"auto" | "webgpu" | "wasm">("auto");
  const [status, setStatus] = useState<"idle" | "decoding" | "loading" | "running" | "paused" | "done" | "error">("idle");
  const [statusText, setStatusText] = useState("音声ファイルを選択してください");
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [supportsPicker, setSupportsPicker] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [liveLevel, setLiveLevel] = useState(0);
  const [liveCapturedSeconds, setLiveCapturedSeconds] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const stopRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<TranscriptSession | null>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveContextRef = useRef<AudioContext | null>(null);
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const livePcmRef = useRef<Float32Array[]>([]);
  const livePcmSamplesRef = useRef(0);
  const liveTotalSamplesRef = useRef(0);
  const liveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const liveSessionIdRef = useRef<string | null>(null);
  const liveStoppingRef = useRef(false);
  const forceWasmRef = useRef(false);

  const addLog = useCallback((message: string) => {
    const line = `${new Date().toLocaleTimeString("ja-JP")}  ${message}`;
    setLogs((current) => [...current.slice(-79), line]);
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await listSessions());
    } catch (error) {
      addLog(`履歴の読込に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [addLog]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void refreshHistory();
      setOnline(navigator.onLine);
      setSupportsPicker("showSaveFilePicker" in window);
    }, 0);
    navigator.storage?.persist?.().catch(() => false);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
        .catch(() => undefined);
    }
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshHistory]);

  useEffect(() => {
    forceWasmRef.current = false;
  }, [engine]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      liveProcessorRef.current?.disconnect();
      liveStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (liveContextRef.current) void liveContextRef.current.close();
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("./transcriber.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "log") addLog(message.message);
      if (message.type === "download") {
        if (typeof message.progress === "number") setModelProgress(Math.round(message.progress));
        const name = message.file?.split("/").pop();
        if (name) setStatusText(`AIモデルを準備中 · ${name}`);
      }
      if (message.type === "ready") {
        setModelProgress(100);
        setStatus((current) => current === "loading" ? "idle" : current);
        setStatusText((current) => current.startsWith("AIモデル") ? "AIモデル準備完了 · オフラインで使用できます" : current);
        addLog(`AIモデル準備完了 (${message.device})`);
      }
      if (message.type === "result") {
        const pending = pendingRef.current.get(message.requestId);
        if (pending) {
          pending.resolve(message);
          pendingRef.current.delete(message.requestId);
        }
      }
      if (message.type === "error") {
        const pending = message.requestId ? pendingRef.current.get(message.requestId) : undefined;
        if (pending) {
          pending.reject(new Error(message.message));
          pendingRef.current.delete(message.requestId!);
        } else {
          setModelProgress(null);
          setStatus("error");
          setStatusText(navigator.onLine ? "AIモデルの準備に失敗しました" : "初回はオンラインでAIモデルを準備してください");
        }
        addLog(`エラー: ${message.message}`);
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "認識ワーカーが停止しました");
      pendingRef.current.forEach((pending) => pending.reject(error));
      pendingRef.current.clear();
      if (workerRef.current === worker) workerRef.current = null;
      setStatus("error");
      setStatusText("認識処理を再開できませんでした");
      addLog(`認識処理エラー: ${error.message}`);
    };
    workerRef.current = worker;
    return worker;
  }, [addLog]);

  const persist = useCallback(async (next: TranscriptSession) => {
    const updated = { ...next, updatedAt: Date.now() };
    sessionRef.current = updated;
    setSession(updated);
    try {
      await saveSession(updated);
      setSavedAt(Date.now());
      await refreshHistory();
    } catch (error) {
      addLog(`自動保存に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      await mirrorToOpfs(updated);
    } catch (error) {
      addLog(`端末内ミラー保存を省略: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (fileHandleRef.current) {
      try {
        const writable = await fileHandleRef.current.createWritable();
        await writable.write(updated.text);
        await writable.close();
      } catch (error) {
        addLog(`指定ファイルへの保存に失敗: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }, [addLog, refreshHistory]);

  const loadFile = useCallback(async (nextFile: File) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const nextUrl = URL.createObjectURL(nextFile);
    setAudioUrl(nextUrl);
    setFile(nextFile);
    setAudioData(null);
    setStatus("decoding");
    setStatusText("音声を読み込み中…");
    setModelProgress(null);
    setLogs([]);
    addLog(`${nextFile.name} を読み込み`);
    try {
      addLog(`ファイルサイズ ${(nextFile.size / 1024 / 1024).toFixed(2)} MB`);
      const fileBytes = await nextFile.arrayBuffer();
      addLog("音声データの読込完了");
      const context = new AudioContext();
      let decoded: AudioBuffer;
      try {
        decoded = await context.decodeAudioData(fileBytes);
      } finally {
        await context.close().catch(() => undefined);
      }
      addLog(`音声デコード完了 (${decoded.sampleRate} Hz)`);
      const data = resampleTo16k(decoded);
      const id = crypto.randomUUID();
      const now = Date.now();
      const title = nextFile.name.replace(/\.[^.]+$/, "") || "音声文字起こし";
      const previous = sessionRef.current;
      const canResume = previous
        && previous.fileName === nextFile.name
        && (previous.fileSize === undefined || previous.fileSize === nextFile.size)
        && (previous.fileLastModified === undefined || previous.fileLastModified === nextFile.lastModified)
        && Math.abs(previous.duration - decoded.duration) < 0.5
        && previous.processedSeconds < previous.duration;
      const nextSession: TranscriptSession = canResume
        ? { ...previous, updatedAt: now }
        : {
            id,
            title,
            fileName: nextFile.name,
            fileSize: nextFile.size,
            fileLastModified: nextFile.lastModified,
            duration: decoded.duration,
            createdAt: now,
            updatedAt: now,
            processedSeconds: 0,
            model,
            language,
            segments: [],
            text: "",
            sourceType: "file",
          };
      if (!canResume) fileHandleRef.current = null;
      setAudioData(data);
      setStatus(canResume ? "paused" : "idle");
      setStatusText(canResume ? `${formatTime(nextSession.processedSeconds)} から再開できます` : `${formatTime(decoded.duration)} · 準備完了`);
      await persist(nextSession);
      addLog(`16 kHz / モノラルへ変換完了 (${formatTime(decoded.duration)})`);
    } catch (error) {
      setStatus("error");
      setStatusText("この音声形式を読み込めませんでした");
      addLog(error instanceof Error ? error.message : String(error));
    }
  }, [addLog, audioUrl, language, model, persist]);

  const requestChunk = useCallback((chunk: Float32Array, selectedModel: string, selectedLanguage: string) => {
    const worker = ensureWorker();
    const requestId = crypto.randomUUID();
    const promise = new Promise<Extract<WorkerMessage, { type: "result" }>>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject });
    });
    const useWebGpu = engine === "webgpu" || (engine === "auto" && !forceWasmRef.current && "gpu" in navigator);
    worker.postMessage({
      type: "transcribe",
      requestId,
      audio: chunk,
      model: selectedModel,
      language: selectedLanguage === "auto" ? null : selectedLanguage,
      device: useWebGpu ? "webgpu" : "wasm",
    }, [chunk.buffer]);
    return promise;
  }, [engine, ensureWorker]);

  const transcribeLiveChunk = useCallback(async (chunk: Float32Array, startSeconds: number, captureId: string) => {
    try {
      const chunkDuration = chunk.length / 16000;
      const endSeconds = startSeconds + chunkDuration;
      setStatusText(`${formatTime(startSeconds)}–${formatTime(endSeconds)} をライブ認識中`);
      let result;
      const canFallback = engine === "auto" && !forceWasmRef.current && "gpu" in navigator;
      const fallbackCopy = canFallback ? new Float32Array(chunk) : null;
      try {
        result = await requestChunk(chunk, model, language);
      } catch (firstError) {
        if (canFallback) {
          forceWasmRef.current = true;
          addLog("WebGPU処理に失敗したためWASMへ切り替えます");
          workerRef.current?.terminate();
          workerRef.current = null;
          const worker = ensureWorker();
          const requestId = crypto.randomUUID();
          const fallback = fallbackCopy!;
          const promise = new Promise<Extract<WorkerMessage, { type: "result" }>>((resolve, reject) => {
            pendingRef.current.set(requestId, { resolve, reject });
          });
          worker.postMessage({ type: "transcribe", requestId, audio: fallback, model, language: language === "auto" ? null : language, device: "wasm" }, [fallback.buffer]);
          result = await promise;
        } else {
          throw firstError;
        }
      }
      if (liveSessionIdRef.current !== captureId) return;
      const current = sessionRef.current;
      if (!current || current.id !== captureId) return;
      const pieces = result.chunks?.length
        ? result.chunks.map((item) => ({
            id: crypto.randomUUID(),
            start: startSeconds + (item.timestamp?.[0] ?? 0),
            end: startSeconds + (item.timestamp?.[1] ?? endSeconds - startSeconds),
            text: item.text.trim(),
          }))
        : [{ id: crypto.randomUUID(), start: startSeconds, end: endSeconds, text: result.text.trim() }];
      const clean = pieces.filter((item) => item.text.length > 0);
      const segments = [...current.segments, ...clean];
      await persist({
        ...current,
        duration: endSeconds,
        processedSeconds: endSeconds,
        model,
        language,
        segments,
        text: appendRecognizedText(current.text, clean),
      });
      addLog(`${formatTime(startSeconds)}–${formatTime(endSeconds)} ライブ保存完了`);
    } catch (error) {
      addLog(`ライブ認識エラー: ${error instanceof Error ? error.message : String(error)}`);
      setStatus("error");
      setStatusText("ライブ認識を続行できませんでした");
    }
  }, [addLog, engine, ensureWorker, language, model, persist, requestChunk]);

  const queueLiveChunk = useCallback((chunk: Float32Array, startSeconds: number, captureId: string) => {
    liveQueueRef.current = liveQueueRef.current.then(() => transcribeLiveChunk(chunk, startSeconds, captureId));
  }, [transcribeLiveChunk]);

  const drainLiveSamples = useCallback((flush = false) => {
    const target = LIVE_CHUNK_SECONDS * 16000;
    if (livePcmSamplesRef.current < target && !(flush && livePcmSamplesRef.current >= 8000)) return;
    const take = flush ? livePcmSamplesRef.current : target;
    const chunk = new Float32Array(take);
    let written = 0;
    const remainder: Float32Array[] = [];
    for (const block of livePcmRef.current) {
      if (written >= take) {
        remainder.push(block);
        continue;
      }
      const needed = take - written;
      if (block.length <= needed) {
        chunk.set(block, written);
        written += block.length;
      } else {
        chunk.set(block.subarray(0, needed), written);
        remainder.push(block.slice(needed));
        written += needed;
      }
    }
    livePcmRef.current = remainder;
    livePcmSamplesRef.current -= take;
    const startSeconds = liveTotalSamplesRef.current / 16000;
    liveTotalSamplesRef.current += take;
    const captureId = liveSessionIdRef.current;
    if (captureId) queueLiveChunk(chunk, startSeconds, captureId);
  }, [queueLiveChunk]);

  const stopLiveCapture = useCallback(async () => {
    if (liveStoppingRef.current || !liveActive) return;
    liveStoppingRef.current = true;
    setLiveActive(false);
    setStatus("loading");
    setStatusText("残りの音声を認識・保存中…");
    liveProcessorRef.current?.disconnect();
    liveProcessorRef.current = null;
    liveStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveStreamRef.current = null;
    const context = liveContextRef.current;
    liveContextRef.current = null;
    if (context) await context.close().catch(() => undefined);
    drainLiveSamples(true);
    setLiveLevel(0);
    await liveQueueRef.current;
    setStatus((current) => current === "error" ? current : "done");
    setStatusText((current) => current.includes("続行できません") ? current : "ライブ文字起こし停止 · すべて保存済み");
    liveStoppingRef.current = false;
  }, [drainLiveSamples, liveActive]);

  const startLiveCapture = useCallback(async () => {
    if (liveActive || status === "decoding" || status === "loading" || status === "running") return;
    setStatus("loading");
    setStatusText("マイクの使用許可を待っています…");
    setLogs([]);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("このブラウザはマイク入力に対応していません");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      liveStreamRef.current = stream;
      const context = new AudioContext();
      liveContextRef.current = context;
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      const now = Date.now();
      const id = crypto.randomUUID();
      const date = new Date(now);
      const pad = (value: number) => String(value).padStart(2, "0");
      const title = `ライブ文字起こし ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
      const liveSession: TranscriptSession = {
        id,
        title,
        fileName: "マイク入力",
        duration: 0,
        createdAt: now,
        updatedAt: now,
        processedSeconds: 0,
        model,
        language,
        segments: [],
        text: "",
        sourceType: "live",
      };
      liveProcessorRef.current = processor;
      livePcmRef.current = [];
      livePcmSamplesRef.current = 0;
      liveTotalSamplesRef.current = 0;
      setLiveCapturedSeconds(0);
      liveQueueRef.current = Promise.resolve();
      liveSessionIdRef.current = id;
      fileHandleRef.current = null;
      setFile(null);
      setAudioData(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      await persist(liveSession);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < input.length; i += 1) peak = Math.max(peak, Math.abs(input[i]));
        setLiveLevel(Math.min(1, peak * 3));
        const pcm = resamplePcmTo16k(input, context.sampleRate);
        livePcmRef.current.push(pcm);
        livePcmSamplesRef.current += pcm.length;
        const capturedSeconds = Math.floor((liveTotalSamplesRef.current + livePcmSamplesRef.current) / 16000);
        setLiveCapturedSeconds((current) => current === capturedSeconds ? current : capturedSeconds);
        while (livePcmSamplesRef.current >= LIVE_CHUNK_SECONDS * 16000) drainLiveSamples(false);
      };
      setLiveActive(true);
      setStatus("running");
      setStatusText("マイク入力を録音・認識中");
      addLog(`ライブ文字起こし開始 (${context.sampleRate} Hz → 16 kHz)`);
    } catch (error) {
      liveProcessorRef.current?.disconnect();
      liveProcessorRef.current = null;
      liveStreamRef.current?.getTracks().forEach((track) => track.stop());
      liveStreamRef.current = null;
      if (liveContextRef.current) await liveContextRef.current.close().catch(() => undefined);
      liveContextRef.current = null;
      setLiveActive(false);
      setStatus("error");
      setStatusText(microphoneErrorMessage(error));
      addLog(error instanceof Error ? error.message : String(error));
    }
  }, [addLog, audioUrl, drainLiveSamples, language, liveActive, model, persist, status]);

  const prepareModel = useCallback(async () => {
    setStatus("loading");
    setStatusText("AIモデルを端末へ保存中…");
    setModelProgress(0);
    const worker = ensureWorker();
    const useWebGpu = engine === "webgpu" || (engine === "auto" && !forceWasmRef.current && "gpu" in navigator);
    worker.postMessage({ type: "load", model, device: useWebGpu ? "webgpu" : "wasm" });
  }, [engine, ensureWorker, model]);

  const startTranscription = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || !audioData || status === "running") return;
    stopRef.current = false;
    setStatus("running");
    setStatusText("文字起こしを開始しています…");
    setModelProgress((value) => value ?? 0);
    const samplesPerChunk = CHUNK_SECONDS * 16000;
    let offset = Math.floor(current.processedSeconds * 16000);
    let working = { ...current, model, language };
    try {
      while (offset < audioData.length && !stopRef.current) {
        const end = Math.min(offset + samplesPerChunk, audioData.length);
        const startSeconds = offset / 16000;
        const endSeconds = end / 16000;
        setStatusText(`${formatTime(startSeconds)}–${formatTime(endSeconds)} を認識中`);
        const chunk = audioData.slice(offset, end);
        let result;
        const canFallback = engine === "auto" && !forceWasmRef.current && "gpu" in navigator;
        try {
          result = await requestChunk(chunk, model, language);
        } catch (firstError) {
          if (canFallback) {
            forceWasmRef.current = true;
            addLog("WebGPU処理に失敗したためWASMへ切り替えます");
            workerRef.current?.terminate();
            workerRef.current = null;
            const worker = ensureWorker();
            const requestId = crypto.randomUUID();
            const fallbackChunk = audioData.slice(offset, end);
            const promise = new Promise<Extract<WorkerMessage, { type: "result" }>>((resolve, reject) => {
              pendingRef.current.set(requestId, { resolve, reject });
            });
            worker.postMessage({ type: "transcribe", requestId, audio: fallbackChunk, model, language: language === "auto" ? null : language, device: "wasm" }, [fallbackChunk.buffer]);
            result = await promise;
          } else {
            throw firstError;
          }
        }
        const pieces = result.chunks?.length
          ? result.chunks.map((item) => ({
              id: crypto.randomUUID(),
              start: startSeconds + (item.timestamp?.[0] ?? 0),
              end: startSeconds + (item.timestamp?.[1] ?? endSeconds - startSeconds),
              text: item.text.trim(),
            }))
          : [{ id: crypto.randomUUID(), start: startSeconds, end: endSeconds, text: result.text.trim() }];
        const clean = pieces.filter((item) => item.text.length > 0);
        const segments = [...working.segments, ...clean];
        working = {
          ...working,
          processedSeconds: endSeconds,
          segments,
          text: appendRecognizedText(working.text, clean),
        };
        await persist(working);
        offset = end;
        addLog(`${formatTime(startSeconds)}–${formatTime(endSeconds)} 保存完了`);
      }
      if (offset >= audioData.length) {
        setStatus("done");
        setStatusText("文字起こし完了 · すべて保存済み");
      } else {
        setStatus("paused");
        setStatusText(`${formatTime(offset / 16000)} で一時停止`);
      }
    } catch (error) {
      setStatus("error");
      setStatusText("認識処理を続行できませんでした");
      addLog(error instanceof Error ? error.message : String(error));
    }
  }, [audioData, engine, ensureWorker, language, model, persist, requestChunk, status, addLog]);

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    const input = event.currentTarget;
    if (selected) void loadFile(selected).finally(() => { input.value = ""; });
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected) void loadFile(selected);
  };

  const handleTextChange = (value: string) => {
    const current = sessionRef.current;
    if (!current) return;
    const next = { ...current, text: value };
    setSession(next);
    sessionRef.current = next;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void persist(next), 500);
  };

  const chooseExternalSaveFile = async () => {
    const picker = (window as typeof window & { showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
    if (!picker || !session) return;
    try {
      fileHandleRef.current = await picker({
        suggestedName: safeFileName(`${session.title}.txt`),
        types: [{ description: "テキスト", accept: { "text/plain": [".txt"] } }],
      });
      await persist(session);
      addLog("指定したテキストファイルへの自動保存を開始");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      addLog(`保存先を設定できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const selectHistory = (item: TranscriptSession) => {
    fileHandleRef.current = null;
    setSession(item);
    sessionRef.current = item;
    setFile(null);
    setAudioData(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setModel(item.model);
    setLanguage(item.language);
    setInputMode(item.sourceType === "live" ? "live" : "file");
    setStatus(item.processedSeconds >= item.duration ? "done" : "paused");
    setStatusText(item.sourceType === "live" ? "保存済みライブ文字起こしを表示中" : "保存済み文字起こしを表示中 · 続行には同じ音声を再選択");
    setHistoryOpen(false);
  };

  const deleteHistory = async (id: string) => {
    const target = history.find((item) => item.id === id);
    if (!window.confirm(`「${target?.title ?? "この文字起こし"}」を削除しますか？`)) return;
    await removeSession(id);
    try {
      await removeOpfsMirror(id);
    } catch (error) {
      addLog(`端末内ミラーの削除に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (sessionRef.current?.id === id) {
      setSession(null);
      sessionRef.current = null;
      fileHandleRef.current = null;
    }
    await refreshHistory();
  };

  const seek = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    void audioRef.current.play();
  };

  const changeInputMode = (next: "file" | "live") => {
    if (isBusy || next === inputMode) return;
    setInputMode(next);
    setStatus("idle");
    setStatusText(next === "live" ? "マイクを開始してください" : audioData ? "音声ファイルの準備完了" : "音声ファイルを選択してください");
  };

  const progress = session?.duration ? Math.min(100, (session.processedSeconds / session.duration) * 100) : 0;
  const isBusy = liveActive || status === "decoding" || status === "loading" || status === "running";
  const showEditor = Boolean(session && (session.segments.length > 0 || status === "done" || status === "paused" || status === "error"));
  const selectedModel = useMemo(() => MODELS.find((item) => item.id === model) ?? MODELS[0], [model]);
  const selectedLanguage = useMemo(
    () => language === "auto" ? { id: "auto", name: "自動判定" } : LANGUAGES.find((item) => item.id === language) ?? FEATURED_LANGUAGES[0],
    [language],
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <div>
            <h1>MojiMic</h1>
            <p>端末内・99言語リアルタイム文字起こし</p>
          </div>
        </div>
        <div className="top-actions">
          <span className={`privacy-badge ${online ? "" : "offline"}`}><span /> 音声は端末内のみ</span>
          <button className="icon-button history-toggle" onClick={() => setHistoryOpen((value) => !value)} aria-label="履歴を開く">履歴</button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`history-panel ${historyOpen ? "open" : ""}`}>
          <div className="panel-heading">
            <div><span>ARCHIVE</span><h2>自動保存履歴</h2></div>
            <button className="close-history" onClick={() => setHistoryOpen(false)} aria-label="履歴を閉じる">×</button>
          </div>
          <div className="history-list">
            {history.length === 0 && <p className="empty-history">文字起こしを始めると、ここへ自動保存されます。</p>}
            {history.map((item) => (
              <div className={`history-item ${session?.id === item.id ? "active" : ""}`} key={item.id}>
                <button className="history-main" onClick={() => selectHistory(item)} disabled={isBusy}>
                  <strong>{item.title}</strong>
                  <span>{item.sourceType === "live" ? "LIVE · " : ""}{formatDate(item.updatedAt)} · {formatTime(item.duration)} · {languageName(item.language)}</span>
                </button>
                <button className="history-delete" onClick={() => void deleteHistory(item.id)} aria-label={`${item.title}を削除`} disabled={isBusy}>×</button>
              </div>
            ))}
          </div>
          <div className="storage-note"><span>LOCAL STORAGE</span><p>文章はブラウザ内と端末内領域へ、区間ごとに二重保存されます。</p></div>
        </aside>

        <section className="main-column">
          <div className="mode-switch" role="tablist" aria-label="文字起こし方法">
            <button role="tab" aria-selected={inputMode === "file"} className={inputMode === "file" ? "active" : ""} onClick={() => changeInputMode("file")} disabled={isBusy}>音声ファイル</button>
            <button role="tab" aria-selected={inputMode === "live"} className={inputMode === "live" ? "active" : ""} onClick={() => changeInputMode("live")} disabled={isBusy}>マイク・ライブ</button>
          </div>
          <section className="source-card">
            <div className="source-topline">
              <div><span className="section-index">01 / SOURCE</span><h2>{inputMode === "file" ? "音声ファイル" : "マイク入力"}</h2></div>
              {inputMode === "file" && file && <span className="file-ready"><span /> 読み込み済み</span>}
              {inputMode === "live" && liveActive && <span className="file-ready live"><span /> LIVE</span>}
            </div>
            {inputMode === "live" ? (
              <div className={`live-source ${liveActive ? "active" : ""}`}>
                <div className="mic-visual" aria-hidden="true">
                  <span className="mic-core">●</span>
                  <i style={{ transform: `scale(${1 + liveLevel * .45})`, opacity: .22 + liveLevel * .35 }} />
                </div>
                <div className="live-copy">
                  <strong>{liveActive ? "マイクを録音・文字起こし中" : "端末のマイクからライブ文字起こし"}</strong>
                  <p>{liveActive ? `約${LIVE_CHUNK_SECONDS}秒ごとに認識して自動保存します · ${formatTime(liveCapturedSeconds)}` : "会議・会話・メモを、その場で端末内処理します。"}</p>
                </div>
                {liveActive ? (
                  <button className="live-button stop" onClick={() => void stopLiveCapture()}>■ ライブ停止</button>
                ) : (
                  <button className="live-button" onClick={() => void startLiveCapture()} disabled={isBusy}>● ライブ開始</button>
                )}
              </div>
            ) : !file && !audioUrl ? (
              <label
                className={`drop-zone ${dragging ? "dragging" : ""}`}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={handleFileInput} />
                <span className="upload-icon" aria-hidden="true">＋</span>
                <strong>音声ファイルを選択</strong>
                <p>または、ここへドラッグ＆ドロップ</p>
                <small>MP3 / WAV / M4A / AAC / OGG など</small>
              </label>
            ) : (
              <div className="loaded-source">
                <div className="file-meta">
                  <div className="file-type">AUDIO</div>
                  <div><strong>{file?.name ?? session?.fileName}</strong><span>{session ? formatTime(session.duration) : "--:--"}</span></div>
                  <label className={`replace-file ${isBusy ? "disabled" : ""}`}>変更<input type="file" accept="audio/*" onChange={handleFileInput} disabled={isBusy} /></label>
                </div>
                {audioUrl ? <audio ref={audioRef} controls src={audioUrl} preload="metadata" /> : <p className="missing-audio">同じ音声ファイルを選択すると、この位置から続行できます。</p>}
              </div>
            )}
          </section>

          <section className="transcript-card">
            <div className="transcript-header">
              <div><span className="section-index">02 / TRANSCRIPT</span><h2>{session?.title || "文字起こし"}</h2></div>
              <div className="save-state"><span className={savedAt ? "saved" : ""} />{savedAt ? `保存済み ${new Date(savedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : "自動保存待機"}</div>
            </div>

            <div className="process-status">
              <div className="status-row"><strong>{statusText}</strong><span>{inputMode === "live" && liveActive ? "LIVE" : `${Math.round(progress)}%`}</span></div>
              <div className={`progress-track ${inputMode === "live" && liveActive ? "live" : ""}`}><div style={{ width: inputMode === "live" && liveActive ? "100%" : `${progress}%` }} /></div>
              {modelProgress !== null && modelProgress < 100 && <div className="model-progress">AIモデル準備 <span>{modelProgress}%</span></div>}
            </div>

            {session?.segments.length ? (
              <div className="segment-list">
                {session.segments.map((segment) => session.sourceType === "live" ? (
                  <div key={segment.id} className="segment static">
                    <time>{formatTime(segment.start)}</time><span dir="auto">{segment.text}</span>
                  </div>
                ) : (
                  <button key={segment.id} className="segment" onClick={() => seek(segment.start)} title="この位置から再生">
                    <time>{formatTime(segment.start)}</time><span dir="auto">{segment.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="transcript-empty">
                <div className="empty-wave"><i /><i /><i /><i /><i /><i /><i /></div>
                <strong>{inputMode === "live" ? "マイク音声がここへ順次表示されます" : "ここに文章がリアルタイム表示されます"}</strong>
                <p>認識した区間ごとに自動保存します。途中で画面を閉じても文章は残ります。</p>
              </div>
            )}

            <textarea
              className={`transcript-editor ${showEditor ? "visible" : ""}`}
              value={session?.text ?? ""}
              onChange={(event) => handleTextChange(event.target.value)}
              placeholder="認識後の文章を直接修正できます"
              aria-label="文字起こし本文"
              dir="auto"
              disabled={!session || isBusy}
            />

            <div className="transport-bar">
              <div className="primary-controls">
                {inputMode === "live" && liveActive ? (
                  <button className="primary-button stop" onClick={() => void stopLiveCapture()}><span>■</span> ライブ停止</button>
                ) : inputMode === "live" ? (
                  <button className="primary-button live-start" onClick={() => void startLiveCapture()} disabled={isBusy}><span>●</span> ライブ開始</button>
                ) : status === "running" ? (
                  <button className="primary-button stop" onClick={() => { stopRef.current = true; setStatusText("現在の区間を保存して停止します…"); }}><span>■</span> 停止</button>
                ) : (
                  <button className="primary-button" onClick={() => void startTranscription()} disabled={!audioData || isBusy || progress >= 100}><span>▶</span> {progress > 0 && progress < 100 ? "再開" : "文字起こし開始"}</button>
                )}
                <button className="secondary-button" onClick={() => void prepareModel()} disabled={isBusy}>モデル準備</button>
              </div>
              <span className="device-note">{engine === "auto" ? "WebGPU優先 / WASM自動切替" : engine.toUpperCase()} · {selectedModel.name} · {selectedLanguage.name}</span>
            </div>
          </section>
        </section>

        <aside className="settings-panel">
          <div className="panel-heading"><div><span>SETTINGS</span><h2>認識設定</h2></div></div>

          <label className="field-label">AIモデル<select value={model} onChange={(event) => setModel(event.target.value)} disabled={isBusy}>{MODELS.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.note}</option>)}</select></label>
          <label className="field-label">
            <span className="field-title">言語 <em>99言語対応</em></span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isBusy}>
              <option value="auto">自動判定（多言語）</option>
              <optgroup label="よく使う言語">
                {FEATURED_LANGUAGES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </optgroup>
              <optgroup label="その他の対応言語">
                {OTHER_LANGUAGES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </optgroup>
            </select>
            <span className="field-help">自動判定では区間ごとに識別します。ライブは言語指定の方が安定します。</span>
          </label>
          <label className="field-label">処理方式<select value={engine} onChange={(event) => setEngine(event.target.value as typeof engine)} disabled={isBusy}><option value="auto">自動（推奨）</option><option value="webgpu">WebGPU</option><option value="wasm">WASM</option></select></label>

          <div className="privacy-box"><div className="shield">✓</div><div><strong>プライベート処理</strong><p>音声データも文章もサーバーへ送信しません。</p></div></div>

          <div className="export-group">
            <span className="field-caption">保存・書き出し</span>
            <div className="export-grid">
              <button disabled={!session} onClick={() => session && download(`${session.title}.txt`, session.text)}>TXT</button>
              <button disabled={!session?.segments.length} onClick={() => session && download(`${session.title}.srt`, sessionToSrt(session))}>SRT</button>
              <button disabled={!session} onClick={() => session && download(`${session.title}.json`, JSON.stringify(session, null, 2), "application/json")}>JSON</button>
              <button disabled={!session} onClick={() => session && navigator.clipboard.writeText(session.text)}>コピー</button>
            </div>
            {supportsPicker && <button className="external-save" disabled={!session} onClick={() => void chooseExternalSaveFile()}>自動保存ファイルを指定</button>}
          </div>

          <details className="log-panel">
            <summary>処理ログ <span>{logs.length}</span></summary>
            <pre>{logs.length ? logs.join("\n") : "ログはまだありません"}</pre>
          </details>
        </aside>
      </div>
    </main>
  );
}
