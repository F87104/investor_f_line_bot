# 投資家F LINE Bot Assistant - TODO

## Phase 1: データベース・Webhook
- [x] LINE関連テーブル（line_users, messages, categories）のスキーマ設計
- [x] LINE Messaging API Webhookエンドポイント（/api/webhook）の実装
- [x] Webhook署名検証の実装
- [x] ユーザーIDの自動取得・保存機能
- [x] LINE Messaging APIシークレットの設定

## Phase 2: LLM連携・コンテンツ生成
- [x] メッセージの4カテゴリ自動分類（投資・AI・スライドプロジェクト・アイデア）
- [x] 双方向会話機能（LLMによる応答生成）
- [x] X（Twitter）投稿用コンテンツ生成機能
- [x] インフォグラフィック構造提案機能

## Phase 3: 自動配信・リマインダー
- [x] ゴールド（XAUUSD）・GBP/JPY市場ニュース収集機能
- [x] 毎朝7時の経済ニュースプッシュ通知配信
- [x] X投稿リマインダー通知
- [x] スライド作成リマインダー通知

## Phase 4: 管理ダッシュボード
- [x] ダッシュボードレイアウト（DashboardLayout使用）
- [x] メッセージ履歴・カテゴリ別表示
- [x] LINE接続状態・ユーザー管理画面
- [x] リマインダー設定画面
- [x] 経済ニュース配信履歴

## Phase 5: テスト・デプロイ
- [x] Webhook処理のユニットテスト
- [x] メッセージ分類のユニットテスト
- [x] チェックポイント保存

## Phase 6: 追加設定
- [x] デフォルトリマインダーの登録（X投稿・スライド作成）
- [x] リッチメニュー自動作成機能の実装
- [x] Webhook URL設定ガイド
- [x] リッチメニューのユニットテスト（4件追加、全15件パス）
