# MojiMic

音声を外部サーバーへ送らず、ブラウザ内で文字起こしするPWAです。音声ファイルとマイクのライブ入力に対応し、AndroidとWindowsで利用できます。

公開版: https://offline-voice-transcriber.xenoah.chatgpt.site

GitHub Pages版: https://xenoah.github.io/moji-mic/

## 主な機能

- 音声ファイルの読み込みと文字起こし
- マイクからのライブ文字起こし
- 言語の自動判定と99言語の手動選択
- 軽量・標準・高精度の3種類のWhisperモデル
- WebGPU優先、利用できない環境ではWASMへ自動切り替え
- 文字起こし結果を区間ごとに自動保存
- ブラウザ内のIndexedDBと端末内領域（OPFS）への二重保存
- 保存履歴の再表示、本文編集、区間再生、テキスト書き出し
- PWAとしてホーム画面やデスクトップへインストール可能

## オフライン動作について

初回だけ、アプリ本体と選択したAIモデルのダウンロードにインターネット接続が必要です。準備完了後はブラウザのキャッシュから読み込み、オフラインで文字起こしできます。

音声データと文字起こし本文は文字起こし処理のために外部へ送信されません。保存内容は使用中のブラウザプロファイルに残るため、サイトデータを削除すると履歴も消えます。重要な結果はテキストとして書き出してください。

## 対応環境

- Android: 最新版Google Chrome
- Windows: 最新版Microsoft EdgeまたはGoogle Chrome

マイク入力にはHTTPSまたはlocalhostが必要です。端末の性能、選択したモデル、音声の長さによって処理速度とメモリ使用量が変わります。

## ローカル起動

Node.js 22.13以降が必要です。

```bash
npm ci
npm run dev
```

表示されたlocalhostのURLをブラウザで開いてください。

## 確認コマンド

```bash
npm run lint
npm test
npm run build:pages
```

`npm test` は本番用ビルド、成果物検証、レンダリングテストを実行します。
`npm run build:pages` は `/moji-mic/` 配下で動く静的サイトを生成し、検証済み成果物を `docs/` へ配置します。

## GitHub Pagesへの公開

GitHub Pagesは、リポジトリに同梱した完成済みの `docs/` をそのまま配信します。GitHub Actionsやサーバー上でのビルドは不要です。

初回だけリポジトリの **Settings → Pages** で公開元を **Deploy from a branch**、ブランチを **main**、フォルダーを **/docs** に設定してください。ソースを変更した場合は、ローカルで `npm run build:pages` を実行して更新された `docs/` もコミットします。

## 技術構成

- Next.js / React / TypeScript
- Vite / Vinext / Cloudflare Workers
- Transformers.js
- Whisper ONNXモデル
- IndexedDB / OPFS / Service Worker
