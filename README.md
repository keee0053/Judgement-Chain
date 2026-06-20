# 毎日チェックリスト

この小さなアプリは Firebase Firestore を使って「毎日チェック」できるタスクを管理します。既存プロジェクトに組み込む際は、ファイルを適宜移動してください。

## ファイル
- `index.html` — UI の HTML
- `style.css` — スタイル
- `app.js` — 動作ロジック（Firestore 保存、日付検知など）
- `firebase-config.js` — Firebase Web アプリの設定

## Firebase 設定
Firebase Console:
- プロジェクト概要: https://console.firebase.google.com/project/judgment-chain/overview
- Firestore: https://console.firebase.google.com/project/judgment-chain/firestore

1. Firebase Console でプロジェクトを作成する。
2. Web アプリを追加して、表示された Firebase config を `firebase-config.js` に貼り付ける。
3. Firestore Database を作成する。
4. 開発中は Firestore ルールで読み書きを許可する。公開時は認証やユーザー単位の制限を追加する。

開発中だけ使う Firestore ルール例:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
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
2. 入力欄にタスク名を入力し、「追加」または Enter で追加。
3. タスクをチェックすると今日の日付のチェック状態が Firestore に保存される。
4. ページ再読み込みしてもタスク・今日のチェック状態は維持される。
5. 日付を手動で翌日に変えるとタスクは未チェックになる（実運用では深夜をまたいだ際に自動で更新されます）。
6. タスク右の「削除」ボタンで削除（確認ダイアログあり）。

## データ設計（Firestore）
- `tasks/{taskId}`: タスク名と作成日時
- `dailyChecks/{YYYY-MM-DD}`: タスクID -> boolean

## 注意点
- 現在の実装は全ユーザーで同じチェックリストを共有します。ユーザー別にしたい場合は Firebase Authentication を追加してください。
