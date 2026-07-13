# MojiMic

AndroidとWindowsで使える、ブラウザ内文字起こしPWAです。ビルド不要のHTML・CSS・JavaScriptだけで動きます。

GitHub Pages: https://xenoah.github.io/moji-mic/

## 機能

- 音声ファイルの文字起こし
- マイクからのライブ文字起こし
- 自動判定と99言語の手動選択
- 軽量・標準・高精度のWhisperモデル
- WebGPUを優先し、使えない場合はWASMへ自動切り替え
- 認識区間ごとにIndexedDBとOPFSへ自動保存
- 保存履歴の再表示・本文編集・区間再生
- TXT・SRT・JSONの書き出しとコピー
- PWAとしてホーム画面へインストール

## 使い方

1. GitHub Pages版を開きます。
2. 初回はオンラインで「モデル準備」を押します。
3. 「音声ファイル」または「マイク・ライブ」を選びます。
4. 準備後は、同じブラウザでオフライン文字起こしができます。

初回のAIエンジンとモデルの取得にだけ通信を使います。音声データと文字起こし本文は外部サーバーへ送信しません。サイトデータを削除すると履歴も消えるため、重要な結果は書き出してください。

## 対応環境

- Android: 最新版Google Chrome
- Windows: 最新版Microsoft EdgeまたはGoogle Chrome

マイクとPWAにはHTTPSまたはlocalhostが必要です。端末の性能やモデルによって、処理速度と必要容量が変わります。

## ビルド不要の構成

`docs/` がそのままアプリ本体です。`npm install`、フレームワーク、GitHub Actionsは必要ありません。

```text
docs/
├── index.html
├── styles.css
├── app.js
├── transcriber.worker.js
├── sw.js
├── manifest.webmanifest
└── vendor/transformers.min.js.gz
```

ローカルで確認するときは、ビルドせず簡易サーバーで開けます。

```bash
cd docs
python -m http.server 8000
```

その後 `http://localhost:8000` を開いてください。`file://` で直接開くと、ワーカーやマイクは動きません。

## GitHub Pagesへの公開

リポジトリの **Settings → Pages** で次のように設定します。

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/docs**

これだけで `docs/` のHTML・CSS・JavaScriptがそのまま公開されます。

## 主な技術

- HTML / CSS / Vanilla JavaScript
- Transformers.js / Whisper ONNX
- Web Worker / Service Worker
- IndexedDB / OPFS / Cache API
