const DB_NAME = "offline-transcriber";
const DB_VERSION = 1;
const STORE_NAME = "sessions";
const FILE_CHUNK_SECONDS = 20;
const LIVE_CHUNK_SECONDS = 5;
const SAMPLE_RATE = 16000;
const EDITOR_DRAFT_KEY = "mojmic-editor-draft-v1";

const MODELS = [
  { id: "onnx-community/whisper-tiny", name: "軽量", note: "Android向け・高速" },
  { id: "onnx-community/whisper-base", name: "標準", note: "速度と精度のバランス" },
  { id: "onnx-community/whisper-small", name: "高精度", note: "Windows向け・容量大" },
];

const FEATURED_LANGUAGES = [
  ["japanese", "日本語"], ["english", "英語"], ["chinese", "中国語"],
  ["korean", "韓国語"], ["spanish", "スペイン語"], ["french", "フランス語"],
  ["german", "ドイツ語"], ["portuguese", "ポルトガル語"], ["russian", "ロシア語"],
  ["italian", "イタリア語"], ["thai", "タイ語"], ["vietnamese", "ベトナム語"],
  ["indonesian", "インドネシア語"], ["hindi", "ヒンディー語"], ["arabic", "アラビア語"],
];

const OTHER_LANGUAGES = [
  ["afrikaans", "アフリカーンス語"], ["albanian", "アルバニア語"], ["amharic", "アムハラ語"],
  ["armenian", "アルメニア語"], ["assamese", "アッサム語"], ["azerbaijani", "アゼルバイジャン語"],
  ["bashkir", "バシキール語"], ["basque", "バスク語"], ["belarusian", "ベラルーシ語"],
  ["bengali", "ベンガル語"], ["bosnian", "ボスニア語"], ["breton", "ブルトン語"],
  ["bulgarian", "ブルガリア語"], ["catalan", "カタルーニャ語"], ["croatian", "クロアチア語"],
  ["czech", "チェコ語"], ["danish", "デンマーク語"], ["dutch", "オランダ語"],
  ["estonian", "エストニア語"], ["faroese", "フェロー語"], ["finnish", "フィンランド語"],
  ["galician", "ガリシア語"], ["georgian", "ジョージア語"], ["greek", "ギリシャ語"],
  ["gujarati", "グジャラート語"], ["haitian creole", "ハイチ・クレオール語"], ["hausa", "ハウサ語"],
  ["hawaiian", "ハワイ語"], ["hebrew", "ヘブライ語"], ["hungarian", "ハンガリー語"],
  ["icelandic", "アイスランド語"], ["javanese", "ジャワ語"], ["kannada", "カンナダ語"],
  ["kazakh", "カザフ語"], ["khmer", "クメール語"], ["lao", "ラオ語"],
  ["latin", "ラテン語"], ["latvian", "ラトビア語"], ["lingala", "リンガラ語"],
  ["lithuanian", "リトアニア語"], ["luxembourgish", "ルクセンブルク語"], ["macedonian", "マケドニア語"],
  ["malagasy", "マダガスカル語"], ["malay", "マレー語"], ["malayalam", "マラヤーラム語"],
  ["maltese", "マルタ語"], ["maori", "マオリ語"], ["marathi", "マラーティー語"],
  ["mongolian", "モンゴル語"], ["myanmar", "ミャンマー語"], ["nepali", "ネパール語"],
  ["norwegian", "ノルウェー語"], ["nynorsk", "ニーノシュク"], ["occitan", "オック語"],
  ["pashto", "パシュトー語"], ["persian", "ペルシャ語"], ["polish", "ポーランド語"],
  ["punjabi", "パンジャーブ語"], ["romanian", "ルーマニア語"], ["sanskrit", "サンスクリット語"],
  ["serbian", "セルビア語"], ["shona", "ショナ語"], ["sindhi", "シンド語"],
  ["sinhala", "シンハラ語"], ["slovak", "スロバキア語"], ["slovenian", "スロベニア語"],
  ["somali", "ソマリ語"], ["sundanese", "スンダ語"], ["swahili", "スワヒリ語"],
  ["swedish", "スウェーデン語"], ["tagalog", "タガログ語"], ["tajik", "タジク語"],
  ["tamil", "タミル語"], ["tatar", "タタール語"], ["telugu", "テルグ語"],
  ["tibetan", "チベット語"], ["turkish", "トルコ語"], ["turkmen", "トルクメン語"],
  ["ukrainian", "ウクライナ語"], ["urdu", "ウルドゥー語"], ["uzbek", "ウズベク語"],
  ["welsh", "ウェールズ語"], ["yiddish", "イディッシュ語"], ["yoruba", "ヨルバ語"],
];

const LANGUAGES = [...FEATURED_LANGUAGES, ...OTHER_LANGUAGES];

const elementIds = [
  "privacy-badge", "history-toggle", "history-panel", "history-backdrop", "close-history", "history-list",
  "file-mode", "live-mode", "source-title", "file-ready", "live-ready", "file-source", "drop-zone",
  "file-input", "loaded-source", "loaded-file-name", "loaded-file-duration", "replace-file-label",
  "replace-file-input", "audio-player", "missing-audio", "live-source", "mic-level", "live-copy-title",
  "live-copy-detail", "live-source-button", "transcript-title", "save-dot", "save-state-text", "status-text",
  "status-percent", "progress-track", "progress-bar", "model-progress", "model-progress-value", "segment-list",
  "transcript-empty", "empty-title", "transcript-editor", "primary-button", "prepare-model", "device-note",
  "model-select", "language-select", "engine-select", "export-txt", "export-srt", "export-json", "copy-text",
  "external-save", "log-count", "log-output", "toast",
];

const dom = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));

const state = {
  inputMode: "file",
  session: null,
  history: [],
  file: null,
  audioUrl: null,
  audioData: null,
  model: MODELS[0].id,
  language: "japanese",
  engine: "auto",
  status: "idle",
  statusText: "音声ファイルを選択してください",
  modelProgress: null,
  savedAt: null,
  logs: [],
  online: navigator.onLine,
  supportsPicker: "showSaveFilePicker" in window,
  liveActive: false,
  liveLevel: 0,
  liveCapturedSeconds: 0,
  historyOpen: false,
};

let worker = null;
let modelLoadRequested = false;
let forceWasm = false;
let stopRequested = false;
let saveTimer = null;
let saveTimerSessionId = null;
let toastTimer = null;
let fileHandle = null;
let pendingRequests = new Map();

let liveStream = null;
let liveContext = null;
let liveSourceNode = null;
let liveProcessor = null;
let liveGain = null;
let livePcm = [];
let livePcmSamples = 0;
let liveTotalSamples = 0;
let liveQueue = Promise.resolve();
let liveSessionId = null;
let liveStopping = false;

function languageName(id) {
  if (id === "auto") return "自動判定";
  return LANGUAGES.find(([value]) => value === id)?.[1] ?? id;
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(timestamp);
}

function isBusy() {
  return state.liveActive || ["decoding", "loading", "running"].includes(state.status);
}

function progressValue() {
  if (!state.session?.duration) return 0;
  return Math.min(100, Math.max(0, state.session.processedSeconds / state.session.duration * 100));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  toastTimer = window.setTimeout(() => { dom.toast.hidden = true; }, 2200);
}

function addLog(message) {
  state.logs = [...state.logs.slice(-79), `${new Date().toLocaleTimeString("ja-JP")}  ${message}`];
  dom["log-count"].textContent = String(state.logs.length);
  dom["log-output"].textContent = state.logs.join("\n") || "ログはまだありません";
}

function clearLogs() {
  state.logs = [];
  dom["log-count"].textContent = "0";
  dom["log-output"].textContent = "ログはまだありません";
}

function populateLanguages() {
  const automatic = document.createElement("option");
  automatic.value = "auto";
  automatic.textContent = "自動判定（多言語）";
  dom["language-select"].append(automatic);

  for (const [label, languages] of [["よく使う言語", FEATURED_LANGUAGES], ["その他の対応言語", OTHER_LANGUAGES]]) {
    const group = document.createElement("optgroup");
    group.label = label;
    for (const [value, name] of languages) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      group.append(option);
    }
    dom["language-select"].append(group);
  }
}

function renderHistory() {
  dom["history-list"].replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "文字起こしを始めると、ここへ自動保存されます。";
    dom["history-list"].append(empty);
    return;
  }

  for (const item of state.history) {
    const row = document.createElement("div");
    row.className = `history-item${state.session?.id === item.id ? " active" : ""}`;

    const select = document.createElement("button");
    select.type = "button";
    select.className = "history-main";
    select.disabled = isBusy();
    const title = document.createElement("strong");
    title.textContent = item.title;
    const detail = document.createElement("span");
    detail.textContent = `${item.sourceType === "live" ? "LIVE · " : ""}${formatDate(item.updatedAt)} · ${formatTime(item.duration)} · ${languageName(item.language)}`;
    select.append(title, detail);
    select.addEventListener("click", () => selectHistory(item));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "history-delete";
    remove.textContent = "×";
    remove.disabled = isBusy();
    remove.setAttribute("aria-label", `${item.title}を削除`);
    remove.addEventListener("click", () => deleteHistory(item.id));
    row.append(select, remove);
    dom["history-list"].append(row);
  }
}

function renderSegments() {
  const segments = state.session?.segments ?? [];
  dom["segment-list"].replaceChildren();
  dom["segment-list"].hidden = segments.length === 0;
  dom["transcript-empty"].hidden = segments.length > 0;

  for (const segment of segments) {
    const row = document.createElement(state.session.sourceType === "live" ? "div" : "button");
    row.className = `segment${state.session.sourceType === "live" ? " static" : ""}`;
    if (row instanceof HTMLButtonElement) {
      row.type = "button";
      row.title = "この位置から再生";
      row.addEventListener("click", () => seek(segment.start));
    }
    const time = document.createElement("time");
    time.textContent = formatTime(segment.start);
    const text = document.createElement("span");
    text.dir = "auto";
    text.textContent = segment.text;
    row.append(time, text);
    dom["segment-list"].append(row);
  }
}

function render() {
  const busy = isBusy();
  const progress = progressValue();
  const isLive = state.inputMode === "live";
  const selectedModel = MODELS.find((item) => item.id === state.model) ?? MODELS[0];
  const hasFileSession = state.session && state.session.sourceType !== "live" && state.session.fileName;
  const showLoadedFile = Boolean(state.file || state.audioUrl || hasFileSession);

  dom["privacy-badge"].classList.toggle("offline", !state.online);
  dom["privacy-badge"].title = state.online ? "オンライン" : "オフライン";

  dom["history-panel"].classList.toggle("open", state.historyOpen);
  dom["history-toggle"].setAttribute("aria-expanded", String(state.historyOpen));
  dom["history-backdrop"].hidden = !state.historyOpen;
  document.body.classList.toggle("history-locked", state.historyOpen && matchMedia("(max-width: 760px)").matches);

  dom["file-mode"].classList.toggle("active", !isLive);
  dom["live-mode"].classList.toggle("active", isLive);
  dom["file-mode"].setAttribute("aria-selected", String(!isLive));
  dom["live-mode"].setAttribute("aria-selected", String(isLive));
  dom["file-mode"].disabled = busy;
  dom["live-mode"].disabled = busy;

  dom["source-title"].textContent = isLive ? "マイク入力" : "音声ファイル";
  dom["file-source"].hidden = isLive;
  dom["live-source"].hidden = !isLive;
  dom["file-ready"].hidden = isLive || !state.file;
  dom["live-ready"].hidden = !isLive || !state.liveActive;
  dom["drop-zone"].hidden = isLive || showLoadedFile;
  dom["loaded-source"].hidden = isLive || !showLoadedFile;
  dom["drop-zone"].classList.toggle("disabled", busy);
  dom["file-input"].disabled = busy;
  dom["replace-file-input"].disabled = busy;
  dom["replace-file-label"].classList.toggle("disabled", busy);
  dom["loaded-file-name"].textContent = state.file?.name ?? state.session?.fileName ?? "音声ファイル";
  dom["loaded-file-duration"].textContent = state.session ? formatTime(state.session.duration) : "--:--";
  dom["audio-player"].hidden = !state.audioUrl;
  dom["missing-audio"].hidden = Boolean(state.audioUrl);

  dom["live-source"].classList.toggle("active", state.liveActive);
  dom["live-copy-title"].textContent = state.liveActive ? "マイクを録音・文字起こし中" : "端末のマイクからライブ文字起こし";
  dom["live-copy-detail"].textContent = state.liveActive
    ? `約${LIVE_CHUNK_SECONDS}秒ごとに認識して自動保存します · ${formatTime(state.liveCapturedSeconds)}`
    : "会議・会話・メモを、その場で端末内処理します。";
  dom["live-source-button"].textContent = state.liveActive ? "■ ライブ停止" : "● ライブ開始";
  dom["live-source-button"].classList.toggle("stop", state.liveActive);
  dom["live-source-button"].disabled = busy && !state.liveActive;

  dom["transcript-title"].textContent = state.session?.title || "文字起こし";
  dom["save-dot"].classList.toggle("saved", Boolean(state.savedAt));
  dom["save-state-text"].textContent = state.savedAt
    ? `保存済み ${new Date(state.savedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
    : "自動保存待機";

  dom["status-text"].textContent = state.statusText;
  dom["status-percent"].textContent = isLive && state.liveActive ? "LIVE" : `${Math.round(progress)}%`;
  dom["progress-track"].classList.toggle("live", isLive && state.liveActive);
  dom["progress-bar"].style.width = isLive && state.liveActive ? "100%" : `${progress}%`;
  dom["model-progress"].hidden = state.modelProgress === null || state.modelProgress >= 100;
  dom["model-progress-value"].textContent = `${state.modelProgress ?? 0}%`;

  dom["empty-title"].textContent = isLive
    ? "マイク音声がここへ順次表示されます"
    : "ここに文章がリアルタイム表示されます";
  renderSegments();

  const showEditor = Boolean(state.session && (
    state.session.segments.length > 0 || ["done", "paused", "error"].includes(state.status)
  ));
  dom["transcript-editor"].classList.toggle("visible", showEditor);
  if (document.activeElement !== dom["transcript-editor"]) {
    dom["transcript-editor"].value = state.session?.text ?? "";
  }
  dom["transcript-editor"].disabled = !state.session || busy;

  const primaryIcon = dom["primary-button"].querySelector("span");
  const primaryText = dom["primary-button"].querySelector("b");
  dom["primary-button"].classList.remove("stop", "live-start");
  if (isLive && state.liveActive) {
    primaryIcon.textContent = "■";
    primaryText.textContent = "ライブ停止";
    dom["primary-button"].classList.add("stop");
    dom["primary-button"].disabled = false;
  } else if (isLive) {
    primaryIcon.textContent = "●";
    primaryText.textContent = "ライブ開始";
    dom["primary-button"].classList.add("live-start");
    dom["primary-button"].disabled = busy;
  } else if (state.status === "running") {
    primaryIcon.textContent = "■";
    primaryText.textContent = "停止";
    dom["primary-button"].classList.add("stop");
    dom["primary-button"].disabled = false;
  } else {
    primaryIcon.textContent = "▶";
    primaryText.textContent = progress > 0 && progress < 100 ? "再開" : "文字起こし開始";
    dom["primary-button"].disabled = !state.audioData || busy || progress >= 100;
  }

  dom["prepare-model"].disabled = busy;
  dom["device-note"].textContent = `${state.engine === "auto" ? "WebGPU優先 / WASM自動切替" : state.engine.toUpperCase()} · ${selectedModel.name} · ${languageName(state.language)}`;
  dom["model-select"].value = state.model;
  dom["language-select"].value = state.language;
  dom["engine-select"].value = state.engine;
  dom["model-select"].disabled = busy;
  dom["language-select"].disabled = busy;
  dom["engine-select"].disabled = busy;

  dom["export-txt"].disabled = !state.session;
  dom["export-srt"].disabled = !state.session?.segments.length;
  dom["export-json"].disabled = !state.session;
  dom["copy-text"].disabled = !state.session;
  dom["external-save"].hidden = !state.supportsPicker;
  dom["external-save"].disabled = !state.session;
  renderHistory();
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSession(session) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(session);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function listSessions() {
  const db = await openDb();
  const sessions = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function removeSession(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function storeEditorDraft(session) {
  try {
    window.localStorage.setItem(EDITOR_DRAFT_KEY, JSON.stringify(session));
  } catch {
    // IndexedDBへの保存は継続する。
  }
}

function clearEditorDraft(id, savedThrough = Infinity) {
  try {
    const raw = window.localStorage.getItem(EDITOR_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft?.id === id && (draft.updatedAt ?? 0) <= savedThrough) {
      window.localStorage.removeItem(EDITOR_DRAFT_KEY);
    }
  } catch {
    try {
      window.localStorage.removeItem(EDITOR_DRAFT_KEY);
    } catch {
      // ストレージを利用できない環境では何もしない。
    }
  }
}

async function recoverEditorDraft() {
  let draft;
  try {
    const raw = window.localStorage.getItem(EDITOR_DRAFT_KEY);
    if (!raw) return;
    draft = JSON.parse(raw);
    if (
      typeof draft?.id !== "string"
      || typeof draft?.title !== "string"
      || typeof draft?.text !== "string"
      || !Array.isArray(draft?.segments)
    ) {
      window.localStorage.removeItem(EDITOR_DRAFT_KEY);
      return;
    }
    const sessions = await listSessions();
    const existing = sessions.find((item) => item.id === draft.id);
    if (!existing || (existing.updatedAt ?? 0) < (draft.updatedAt ?? 0)) {
      await saveSession(draft);
      try {
        await mirrorToOpfs(draft);
      } catch {
        // IndexedDBに復元済みのため続行する。
      }
      addLog("閉じる直前の編集内容を復元しました");
    }
    window.localStorage.removeItem(EDITOR_DRAFT_KEY);
  } catch (error) {
    addLog(`編集中ドラフトの復元を省略: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function mirrorToOpfs(session) {
  if (!navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  const folder = await root.getDirectoryHandle("transcripts", { create: true });
  const file = await folder.getFileHandle(`${session.id}.txt`, { create: true });
  const writable = await file.createWritable();
  await writable.write(session.text);
  await writable.close();
}

async function removeOpfsMirror(id) {
  if (!navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  try {
    const folder = await root.getDirectoryHandle("transcripts");
    await folder.removeEntry(`${id}.txt`);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
  }
}

async function refreshHistory() {
  try {
    state.history = await listSessions();
    renderHistory();
  } catch (error) {
    addLog(`履歴の読込に失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function persist(next) {
  if (saveTimer && saveTimerSessionId === next.id) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
    saveTimerSessionId = null;
  }
  const updated = { ...next, updatedAt: Date.now() };
  state.session = updated;
  render();
  try {
    await saveSession(updated);
    clearEditorDraft(updated.id, updated.updatedAt);
    state.savedAt = Date.now();
    await refreshHistory();
  } catch (error) {
    addLog(`自動保存に失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    await mirrorToOpfs(updated);
  } catch (error) {
    addLog(`端末内ミラー保存を省略: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(updated.text);
      await writable.close();
    } catch (error) {
      addLog(`指定ファイルへの保存に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  render();
  return updated;
}

function appendRecognizedText(current, segments) {
  const addition = segments.map((item) => item.text.trim()).filter(Boolean).join("\n");
  if (!addition) return current;
  return current.trimEnd() ? `${current.trimEnd()}\n${addition}` : addition;
}

function resampleAudioBuffer(buffer) {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return resamplePcm(mono, buffer.sampleRate);
}

function resamplePcm(input, inputRate) {
  if (inputRate === SAMPLE_RATE) return new Float32Array(input);
  const ratio = inputRate / SAMPLE_RATE;
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

function revokeAudioUrl() {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = null;
  dom["audio-player"].removeAttribute("src");
  dom["audio-player"].load();
}

async function loadFile(file) {
  if (isBusy()) return;
  revokeAudioUrl();
  state.audioUrl = URL.createObjectURL(file);
  dom["audio-player"].src = state.audioUrl;
  state.file = file;
  state.audioData = null;
  state.status = "decoding";
  state.statusText = "音声を読み込み中…";
  state.modelProgress = null;
  clearLogs();
  addLog(`${file.name} を読み込み`);
  render();

  try {
    addLog(`ファイルサイズ ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    const bytes = await file.arrayBuffer();
    addLog("音声データの読込完了");
    const context = new AudioContext();
    let decoded;
    try {
      decoded = await context.decodeAudioData(bytes);
    } finally {
      await context.close().catch(() => undefined);
    }
    addLog(`音声デコード完了 (${decoded.sampleRate} Hz)`);
    state.audioData = resampleAudioBuffer(decoded);

    const previous = state.session;
    const canResume = previous
      && previous.sourceType !== "live"
      && previous.fileName === file.name
      && (previous.fileSize === undefined || previous.fileSize === file.size)
      && (previous.fileLastModified === undefined || previous.fileLastModified === file.lastModified)
      && Math.abs(previous.duration - decoded.duration) < 0.5
      && previous.processedSeconds < previous.duration;
    const now = Date.now();
    const next = canResume ? { ...previous, updatedAt: now } : {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.[^.]+$/, "") || "音声文字起こし",
      fileName: file.name,
      fileSize: file.size,
      fileLastModified: file.lastModified,
      duration: decoded.duration,
      createdAt: now,
      updatedAt: now,
      processedSeconds: 0,
      model: state.model,
      language: state.language,
      segments: [],
      text: "",
      sourceType: "file",
    };
    if (!canResume) fileHandle = null;
    state.status = canResume ? "paused" : "idle";
    state.statusText = canResume
      ? `${formatTime(next.processedSeconds)} から再開できます`
      : `${formatTime(decoded.duration)} · 準備完了`;
    await persist(next);
    addLog(`16 kHz / モノラルへ変換完了 (${formatTime(decoded.duration)})`);
  } catch (error) {
    state.status = "error";
    state.statusText = "この音声形式を読み込めませんでした";
    addLog(error instanceof Error ? error.message : String(error));
    render();
  }
}

function terminateWorker(reason = "認識ワーカーを再起動しました") {
  worker?.terminate();
  worker = null;
  for (const request of pendingRequests.values()) request.reject(new Error(reason));
  pendingRequests.clear();
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./transcriber.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data: message }) => {
    if (message.type === "log") addLog(message.message);
    if (message.type === "download") {
      if (typeof message.progress === "number") {
        state.modelProgress = Math.min(100, Math.max(0, Math.round(message.progress)));
      }
      const name = message.file?.split("/").pop();
      if (name) state.statusText = `AIモデルを準備中 · ${name}`;
      render();
    }
    if (message.type === "ready") {
      state.modelProgress = 100;
      if (modelLoadRequested) {
        modelLoadRequested = false;
        state.status = "idle";
        state.statusText = "AIモデル準備完了 · オフラインで使用できます";
      }
      addLog(`AIモデル準備完了 (${message.device})`);
      render();
    }
    if (message.type === "result") {
      const request = pendingRequests.get(message.requestId);
      if (request) {
        pendingRequests.delete(message.requestId);
        request.resolve(message);
      }
    }
    if (message.type === "error") {
      const request = message.requestId ? pendingRequests.get(message.requestId) : null;
      if (request) {
        pendingRequests.delete(message.requestId);
        request.reject(new Error(message.message));
      } else {
        if (
          modelLoadRequested
          && message.device === "webgpu"
          && state.engine === "auto"
          && !forceWasm
        ) {
          forceWasm = true;
          addLog("WebGPUで準備できないためWASMへ自動切り替え");
          terminateWorker("WASMへ切り替えます");
          state.status = "loading";
          state.statusText = "WASMでAIモデルを準備中…";
          state.modelProgress = 0;
          ensureWorker().postMessage({ type: "load", model: state.model, device: "wasm" });
          render();
          return;
        }
        modelLoadRequested = false;
        state.modelProgress = null;
        state.status = "error";
        state.statusText = navigator.onLine
          ? "AIモデルの準備に失敗しました"
          : "初回はオンラインでAIモデルを準備してください";
        addLog(`エラー: ${message.message}`);
        render();
      }
    }
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "認識ワーカーが停止しました");
    for (const request of pendingRequests.values()) request.reject(error);
    pendingRequests.clear();
    worker = null;
    modelLoadRequested = false;
    state.status = "error";
    state.statusText = "認識処理を再開できませんでした";
    addLog(`認識処理エラー: ${error.message}`);
    render();
  };
  return worker;
}

function preferredDevice() {
  return state.engine === "webgpu" || (state.engine === "auto" && !forceWasm && "gpu" in navigator)
    ? "webgpu"
    : "wasm";
}

function sendRecognition(audio, model, language, device) {
  const activeWorker = ensureWorker();
  const requestId = crypto.randomUUID();
  const promise = new Promise((resolve, reject) => pendingRequests.set(requestId, { resolve, reject }));
  activeWorker.postMessage({
    type: "transcribe", requestId, audio, model,
    language: language === "auto" ? null : language,
    device,
  }, [audio.buffer]);
  return promise;
}

async function recognize(audio, model, language) {
  const device = preferredDevice();
  const canFallback = device === "webgpu" && state.engine === "auto" && !forceWasm;
  const backup = canFallback ? new Float32Array(audio) : null;
  try {
    return await sendRecognition(audio, model, language, device);
  } catch (error) {
    if (!canFallback) throw error;
    forceWasm = true;
    addLog("WebGPU処理に失敗したためWASMへ切り替えます");
    terminateWorker("WASMへ切り替えます");
    return sendRecognition(backup, model, language, "wasm");
  }
}

function resultSegments(result, startSeconds, endSeconds) {
  const segments = result.chunks?.length
    ? result.chunks.map((item) => ({
        id: crypto.randomUUID(),
        start: startSeconds + (item.timestamp?.[0] ?? 0),
        end: startSeconds + (item.timestamp?.[1] ?? endSeconds - startSeconds),
        text: item.text.trim(),
      }))
    : [{ id: crypto.randomUUID(), start: startSeconds, end: endSeconds, text: result.text.trim() }];
  return segments.filter((item) => item.text.length > 0);
}

async function startFileTranscription() {
  if (!state.session || !state.audioData || state.status === "running") return;
  stopRequested = false;
  state.status = "running";
  state.statusText = "文字起こしを開始しています…";
  state.modelProgress ??= 0;
  render();

  const samplesPerChunk = FILE_CHUNK_SECONDS * SAMPLE_RATE;
  let offset = Math.floor(state.session.processedSeconds * SAMPLE_RATE);
  let working = { ...state.session, model: state.model, language: state.language };
  try {
    while (offset < state.audioData.length && !stopRequested) {
      const end = Math.min(offset + samplesPerChunk, state.audioData.length);
      const startSeconds = offset / SAMPLE_RATE;
      const endSeconds = end / SAMPLE_RATE;
      state.statusText = `${formatTime(startSeconds)}–${formatTime(endSeconds)} を認識中`;
      render();
      const result = await recognize(state.audioData.slice(offset, end), state.model, state.language);
      const clean = resultSegments(result, startSeconds, endSeconds);
      working = await persist({
        ...working,
        processedSeconds: endSeconds,
        segments: [...working.segments, ...clean],
        text: appendRecognizedText(working.text, clean),
      });
      offset = end;
      addLog(`${formatTime(startSeconds)}–${formatTime(endSeconds)} 保存完了`);
    }
    if (offset >= state.audioData.length) {
      state.status = "done";
      state.statusText = "文字起こし完了 · すべて保存済み";
    } else {
      state.status = "paused";
      state.statusText = `${formatTime(offset / SAMPLE_RATE)} で一時停止`;
    }
  } catch (error) {
    state.status = "error";
    state.statusText = "認識処理を続行できませんでした";
    addLog(error instanceof Error ? error.message : String(error));
  }
  render();
}

function stopFileTranscription() {
  stopRequested = true;
  state.statusText = "現在の区間を保存して停止します…";
  render();
}

function microphoneErrorMessage(error) {
  if (!(error instanceof DOMException)) return "マイクを開始できませんでした";
  if (["NotAllowedError", "SecurityError"].includes(error.name)) return "マイクの使用が許可されていません · ブラウザ設定を確認してください";
  if (error.name === "NotFoundError") return "利用できるマイクが見つかりません";
  if (["NotReadableError", "AbortError"].includes(error.name)) return "マイクを使用できません · 他のアプリを閉じて再試行してください";
  return "マイクを開始できませんでした";
}

function updateLiveMeter() {
  dom["mic-level"].style.transform = `scale(${1 + state.liveLevel * 0.45})`;
  dom["mic-level"].style.opacity = String(0.22 + state.liveLevel * 0.35);
  if (state.liveActive) {
    dom["live-copy-detail"].textContent = `約${LIVE_CHUNK_SECONDS}秒ごとに認識して自動保存します · ${formatTime(state.liveCapturedSeconds)}`;
  }
}

function takeLiveSamples(count) {
  const chunk = new Float32Array(count);
  const remainder = [];
  let written = 0;
  for (const block of livePcm) {
    if (written >= count) {
      remainder.push(block);
      continue;
    }
    const needed = count - written;
    if (block.length <= needed) {
      chunk.set(block, written);
      written += block.length;
    } else {
      chunk.set(block.subarray(0, needed), written);
      remainder.push(block.slice(needed));
      written += needed;
    }
  }
  livePcm = remainder;
  livePcmSamples -= count;
  return chunk;
}

function drainLiveSamples(flush = false) {
  const target = LIVE_CHUNK_SECONDS * SAMPLE_RATE;
  if (livePcmSamples < target && !flush) return;
  if (flush && livePcmSamples < SAMPLE_RATE / 2) {
    livePcm = [];
    livePcmSamples = 0;
    return;
  }
  const take = flush ? livePcmSamples : target;
  const chunk = takeLiveSamples(take);
  const startSeconds = liveTotalSamples / SAMPLE_RATE;
  liveTotalSamples += take;
  const captureId = liveSessionId;
  if (captureId) {
    liveQueue = liveQueue.then(() => transcribeLiveChunk(chunk, startSeconds, captureId));
  }
}

async function transcribeLiveChunk(chunk, startSeconds, captureId) {
  try {
    const endSeconds = startSeconds + chunk.length / SAMPLE_RATE;
    state.statusText = `${formatTime(startSeconds)}–${formatTime(endSeconds)} をライブ認識中`;
    render();
    const result = await recognize(chunk, state.model, state.language);
    if (liveSessionId !== captureId || state.session?.id !== captureId) return;
    const clean = resultSegments(result, startSeconds, endSeconds);
    const current = state.session;
    await persist({
      ...current,
      duration: endSeconds,
      processedSeconds: endSeconds,
      model: state.model,
      language: state.language,
      segments: [...current.segments, ...clean],
      text: appendRecognizedText(current.text, clean),
    });
    addLog(`${formatTime(startSeconds)}–${formatTime(endSeconds)} ライブ保存完了`);
  } catch (error) {
    state.status = "error";
    state.statusText = "ライブ認識を続行できませんでした";
    addLog(`ライブ認識エラー: ${error instanceof Error ? error.message : String(error)}`);
    render();
  }
}

async function startLiveCapture() {
  if (state.liveActive || isBusy()) return;
  state.status = "loading";
  state.statusText = "マイクの使用許可を待っています…";
  clearLogs();
  render();

  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("このブラウザはマイク入力に対応していません");
    liveStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    liveContext = new AudioContext();
    await liveContext.resume();
    liveSourceNode = liveContext.createMediaStreamSource(liveStream);
    liveProcessor = liveContext.createScriptProcessor(4096, 1, 1);
    liveGain = liveContext.createGain();
    liveGain.gain.value = 0;

    const now = Date.now();
    const date = new Date(now);
    const pad = (value) => String(value).padStart(2, "0");
    const id = crypto.randomUUID();
    const session = {
      id,
      title: `ライブ文字起こし ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`,
      fileName: "マイク入力",
      duration: 0,
      createdAt: now,
      updatedAt: now,
      processedSeconds: 0,
      model: state.model,
      language: state.language,
      segments: [],
      text: "",
      sourceType: "live",
    };

    revokeAudioUrl();
    state.file = null;
    state.audioData = null;
    fileHandle = null;
    livePcm = [];
    livePcmSamples = 0;
    liveTotalSamples = 0;
    liveQueue = Promise.resolve();
    liveSessionId = id;
    state.liveCapturedSeconds = 0;
    await persist(session);

    liveProcessor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      let peak = 0;
      for (let i = 0; i < input.length; i += 1) peak = Math.max(peak, Math.abs(input[i]));
      state.liveLevel = Math.min(1, peak * 3);
      const pcm = resamplePcm(input, liveContext.sampleRate);
      livePcm.push(pcm);
      livePcmSamples += pcm.length;
      const captured = Math.floor((liveTotalSamples + livePcmSamples) / SAMPLE_RATE);
      if (captured !== state.liveCapturedSeconds) state.liveCapturedSeconds = captured;
      updateLiveMeter();
      while (livePcmSamples >= LIVE_CHUNK_SECONDS * SAMPLE_RATE) drainLiveSamples(false);
    };
    liveSourceNode.connect(liveProcessor);
    liveProcessor.connect(liveGain);
    liveGain.connect(liveContext.destination);

    state.liveActive = true;
    state.status = "running";
    state.statusText = "マイク入力を録音・認識中";
    addLog(`ライブ文字起こし開始 (${liveContext.sampleRate} Hz → 16 kHz)`);
    render();
  } catch (error) {
    await releaseLiveInput();
    state.liveActive = false;
    state.status = "error";
    state.statusText = microphoneErrorMessage(error);
    addLog(error instanceof Error ? error.message : String(error));
    render();
  }
}

async function releaseLiveInput() {
  if (liveProcessor) liveProcessor.onaudioprocess = null;
  liveSourceNode?.disconnect();
  liveProcessor?.disconnect();
  liveGain?.disconnect();
  liveStream?.getTracks().forEach((track) => track.stop());
  const context = liveContext;
  liveStream = null;
  liveContext = null;
  liveSourceNode = null;
  liveProcessor = null;
  liveGain = null;
  if (context) await context.close().catch(() => undefined);
}

async function stopLiveCapture() {
  if (liveStopping || !state.liveActive) return;
  liveStopping = true;
  state.liveActive = false;
  state.status = "loading";
  state.statusText = "残りの音声を認識・保存中…";
  render();
  await releaseLiveInput();
  drainLiveSamples(true);
  state.liveLevel = 0;
  updateLiveMeter();
  await liveQueue;
  if (state.status !== "error") {
    state.status = "done";
    state.statusText = "ライブ文字起こし停止 · すべて保存済み";
  }
  liveStopping = false;
  render();
}

function prepareModel() {
  if (isBusy()) return;
  state.status = "loading";
  state.statusText = "AIモデルを端末へ保存中…";
  state.modelProgress = 0;
  modelLoadRequested = true;
  ensureWorker().postMessage({ type: "load", model: state.model, device: preferredDevice() });
  render();
}

function changeInputMode(mode) {
  if (isBusy() || mode === state.inputMode) return;
  state.inputMode = mode;
  state.status = "idle";
  state.statusText = mode === "live"
    ? "マイクを開始してください"
    : state.audioData ? "音声ファイルの準備完了" : "音声ファイルを選択してください";
  render();
}

function selectHistory(item) {
  if (state.session?.id === item.id) {
    closeHistory();
    return;
  }
  fileHandle = null;
  state.session = item;
  state.file = null;
  state.audioData = null;
  revokeAudioUrl();
  state.model = item.model;
  state.language = item.language;
  state.inputMode = item.sourceType === "live" ? "live" : "file";
  state.status = item.processedSeconds >= item.duration ? "done" : "paused";
  state.statusText = item.sourceType === "live"
    ? "保存済みライブ文字起こしを表示中"
    : "保存済み文字起こしを表示中 · 続行には同じ音声を再選択";
  closeHistory();
  render();
}

async function deleteHistory(id) {
  const target = state.history.find((item) => item.id === id);
  if (!window.confirm(`「${target?.title ?? "この文字起こし"}」を削除しますか？`)) return;
  if (saveTimer && saveTimerSessionId === id) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
    saveTimerSessionId = null;
  }
  clearEditorDraft(id);
  await removeSession(id);
  try {
    await removeOpfsMirror(id);
  } catch (error) {
    addLog(`端末内ミラーの削除に失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (state.session?.id === id) {
    state.session = null;
    fileHandle = null;
  }
  await refreshHistory();
  render();
}

function seek(seconds) {
  if (!state.audioUrl) return;
  dom["audio-player"].currentTime = seconds;
  dom["audio-player"].play().catch(() => undefined);
}

function openHistory() {
  state.historyOpen = true;
  render();
}

function closeHistory() {
  state.historyOpen = false;
  render();
}

function safeFileName(name) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/[. ]+$/g, "").slice(0, 120) || "transcript";
}

function download(name, content, type = "text/plain;charset=utf-8") {
  const parts = type.startsWith("text/") ? ["\uFEFF", content] : [content];
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName(name);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sessionToSrt(session) {
  const stamp = (value) => {
    const ms = Math.max(0, Math.round(value * 1000));
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor(ms % 3_600_000 / 60_000);
    const s = Math.floor(ms % 60_000 / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return session.segments.map((segment, index) => (
    `${index + 1}\n${stamp(segment.start)} --> ${stamp(segment.end)}\n${segment.text.trim()}\n`
  )).join("\n");
}

async function copyTranscript() {
  if (!state.session) return;
  try {
    await navigator.clipboard.writeText(state.session.text);
  } catch {
    const temporary = document.createElement("textarea");
    temporary.value = state.session.text;
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.append(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
  }
  showToast("文章をコピーしました");
}

async function chooseExternalSaveFile() {
  if (!window.showSaveFilePicker || !state.session) return;
  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: safeFileName(`${state.session.title}.txt`),
      types: [{ description: "テキスト", accept: { "text/plain": [".txt"] } }],
    });
    await persist(state.session);
    addLog("指定したテキストファイルへの自動保存を開始");
    showToast("自動保存先を設定しました");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    addLog(`保存先を設定できませんでした: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function bindEvents() {
  dom["file-mode"].addEventListener("click", () => changeInputMode("file"));
  dom["live-mode"].addEventListener("click", () => changeInputMode("live"));
  dom["history-toggle"].addEventListener("click", () => state.historyOpen ? closeHistory() : openHistory());
  dom["close-history"].addEventListener("click", closeHistory);
  dom["history-backdrop"].addEventListener("click", closeHistory);

  for (const input of [dom["file-input"], dom["replace-file-input"]]) {
    input.addEventListener("change", () => {
      const selected = input.files?.[0];
      if (selected) loadFile(selected).finally(() => { input.value = ""; });
    });
  }
  dom["drop-zone"].addEventListener("dragover", (event) => {
    event.preventDefault();
    dom["drop-zone"].classList.add("dragging");
  });
  dom["drop-zone"].addEventListener("dragleave", () => dom["drop-zone"].classList.remove("dragging"));
  dom["drop-zone"].addEventListener("drop", (event) => {
    event.preventDefault();
    dom["drop-zone"].classList.remove("dragging");
    const selected = event.dataTransfer?.files?.[0];
    if (selected) loadFile(selected);
  });

  dom["live-source-button"].addEventListener("click", () => state.liveActive ? stopLiveCapture() : startLiveCapture());
  dom["primary-button"].addEventListener("click", () => {
    if (state.inputMode === "live") {
      return state.liveActive ? stopLiveCapture() : startLiveCapture();
    }
    return state.status === "running" ? stopFileTranscription() : startFileTranscription();
  });
  dom["prepare-model"].addEventListener("click", prepareModel);

  dom["model-select"].addEventListener("change", () => {
    if (state.model !== dom["model-select"].value) {
      terminateWorker("モデルを変更しました");
      modelLoadRequested = false;
      state.modelProgress = null;
      forceWasm = false;
    }
    state.model = dom["model-select"].value;
    render();
  });
  dom["language-select"].addEventListener("change", () => { state.language = dom["language-select"].value; render(); });
  dom["engine-select"].addEventListener("change", () => {
    if (state.engine !== dom["engine-select"].value) {
      terminateWorker("処理方式を変更しました");
      modelLoadRequested = false;
      state.modelProgress = null;
    }
    state.engine = dom["engine-select"].value;
    forceWasm = false;
    render();
  });

  dom["transcript-editor"].addEventListener("input", () => {
    if (!state.session) return;
    const edited = { ...state.session, text: dom["transcript-editor"].value, updatedAt: Date.now() };
    state.session = edited;
    storeEditorDraft(edited);
    window.clearTimeout(saveTimer);
    saveTimerSessionId = edited.id;
    saveTimer = window.setTimeout(async () => {
      saveTimer = null;
      saveTimerSessionId = null;
      const updated = { ...edited, updatedAt: Date.now() };
      let stored = false;
      try {
        await saveSession(updated);
        stored = true;
        clearEditorDraft(updated.id, updated.updatedAt);
        if (state.session?.id === updated.id) {
          state.session = { ...state.session, updatedAt: updated.updatedAt };
          state.savedAt = Date.now();
        }
        await refreshHistory();
      } catch (error) {
        addLog(`本文の自動保存に失敗: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (stored) {
        try {
          await mirrorToOpfs(updated);
        } catch (error) {
          addLog(`端末内ミラー保存を省略: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (fileHandle && state.session?.id === updated.id) {
          try {
            const writable = await fileHandle.createWritable();
            await writable.write(updated.text);
            await writable.close();
          } catch (error) {
            addLog(`指定ファイルへの保存に失敗: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      render();
    }, 500);
  });

  dom["export-txt"].addEventListener("click", () => state.session && download(`${state.session.title}.txt`, state.session.text));
  dom["export-srt"].addEventListener("click", () => state.session && download(`${state.session.title}.srt`, sessionToSrt(state.session)));
  dom["export-json"].addEventListener("click", () => state.session && download(`${state.session.title}.json`, JSON.stringify(state.session, null, 2), "application/json"));
  dom["copy-text"].addEventListener("click", copyTranscript);
  dom["external-save"].addEventListener("click", chooseExternalSaveFile);

  window.addEventListener("online", () => { state.online = true; render(); });
  window.addEventListener("offline", () => { state.online = false; render(); });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.historyOpen) closeHistory(); });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    worker?.terminate();
    liveStream?.getTracks().forEach((track) => track.stop());
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  });
}

async function initialize() {
  populateLanguages();
  bindEvents();
  render();
  navigator.storage?.persist?.().catch(() => false);
  await recoverEditorDraft();
  await refreshHistory();

  if (!window.isSecureContext) {
    addLog("マイクとオフライン機能にはHTTPSまたはlocalhostが必要です");
  }
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((error) => {
      addLog(`オフライン準備を開始できませんでした: ${error.message}`);
    });
  }
}

initialize();
