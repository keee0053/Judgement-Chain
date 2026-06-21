# 毎日チェックリスト

この小さなアプリは Firebase Authentication と Firestore を使って、ログインしたユーザーごとに「毎日チェック」できるタスクを管理します。既存プロジェクトに組み込む際は、ファイルを適宜移動してください。

## ファイル
- `index.html` — UI の HTML
- `style.css` — スタイル
- `app.js` — 動作ロジック（Google ログイン、Firestore 保存、日付検知など）
- `firebase-config.js` — Firebase Web アプリの設定
- `functions/index.js` — LINE通知用の定期実行処理

## Firebase 設定
Firebase Console:
- プロジェクト概要: https://console.firebase.google.com/project/judgment-chain/overview
- Firestore: https://console.firebase.google.com/project/judgment-chain/firestore
- Authentication: https://console.firebase.google.com/project/judgment-chain/authentication
- 公開URL: https://judgment-chain.web.app

1. Firebase Console でプロジェクトを作成する。
2. Web アプリを追加して、表示された Firebase config を `firebase-config.js` に貼り付ける。
3. Authentication で Google ログインを有効にする。
4. Firestore Database を作成する。
5. Firestore ルールを `firestore.rules` の内容にする。

## LINE 通知設定
日付が変わった直後、前日に達成できなかったタスクがある場合にLINEへ通知します。

1. LINE DevelopersでMessaging APIチャネルを作成する。
2. チャネルアクセストークンを発行する。
3. Firebase Secretにアクセストークンを保存する。

```bash
firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN
```

4. Cloud Functionsをデプロイする。

```bash
firebase deploy --only functions,hosting --project judgment-chain
```

5. アプリにログインし、LINE通知先IDを入力して保存する。

Cloud Functionsのスケジュールは `Asia/Tokyo` の毎日 `00:00` です。通知済みの日付は `users/{uid}/notifications/line-{YYYY-MM-DD}` に保存し、重複送信を防ぎます。

ログインユーザーだけが自分のデータを読み書きできる Firestore ルールは `firestore.rules` にあります。

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

ローカルで確認する場合は、プロジェクトフォルダで簡易サーバーを起動してください。

```bash
python3 -m http.server 8000
```

そのあと `http://localhost:8000/` を開きます。

## 動作確認手順
1. Firebase 設定後、ローカルサーバーまたは GitHub Pages で `index.html` を開く。
2. Google でログインする。
3. 入力欄にタスク名を入力し、「追加」または Enter で追加。
4. タスクをチェックすると今日の日付のチェック状態が Firestore に保存される。
5. ページ再読み込みしてもタスク・今日のチェック状態は維持される。
6. 日付を手動で翌日に変えるとタスクは未チェックになる（実運用では深夜をまたいだ際に自動で更新されます）。
7. タスク右の「削除」ボタンで削除（確認ダイアログあり）。

## データ設計（Firestore）
- `users/{uid}/tasks/{taskId}`: タスク名と作成日時
- `users/{uid}/dailyChecks/{YYYY-MM-DD}`: タスクID -> boolean
- `users/{uid}/settings/line`: LINE通知先IDと有効状態
- `users/{uid}/notifications/line-{YYYY-MM-DD}`: LINE通知の送信履歴

## 注意点
- 以前の共有データ構造 `tasks` / `dailyChecks` は使わず、ログインユーザーごとの `users/{uid}` 配下に保存します。
