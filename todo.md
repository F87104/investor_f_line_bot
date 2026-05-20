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

## Phase 7: デプロイ修正
- [x] canvasパッケージを削除（デプロイ環境でビルド不可）
- [x] リッチメニュー画像生成をSVG→PNG変換方式に変更（sharp使用）
- [x] テスト修正・再実行（15件全パス）
- [x] チェックポイント保存・再公開

## Phase 8: リッチメニューデザイン改善
- [x] AI画像生成でリッチメニュー用の高品質な画像を作成（2500x843px）
- [x] ゴールド系カラーでアイコン付き6ボタンデザイン
- [x] 生成画像をS3にアップロードしてリッチメニュー設定に組み込み
- [x] チェックポイント保存・再公開

## Phase 9: 投資家Fペルソナ再現
- [x] Xアカウント(@Fuj_100mili)の過去ポストを分析（13件以上のポストを収集）
- [x] 文章構成・言葉選び・独自の視点を抽出してペルソナドキュメント作成
- [x] LLMシステムプロンプトに投資家Fペルソナを組み込み（INVESTOR_F_PERSONA定数）
- [x] X投稿生成を3パターン出力に改善（たとえ話/市場分析/問いかけ）・署名「投資家Fより💌」徹底
- [x] 図解提案にFキャラクター（水色髪アニメ風女の子）の解説役を組み込み
- [x] 全コマンド応答・ウェルカムメッセージをFスタイルに統一
- [x] テスト実行・チェックポイント保存（15件全パス）

## Phase 10: リッチメニュー画像アップロードエラー修正
- [x] リッチメニュー画像をダウンロード後にsharpでJPEG圧縮（900KB以下）する処理を追加
- [x] LINE APIのリッチメニュー画像サイズ制限（1MB）に対応
- [x] テスト・チェックポイント保存・再公開（15件全パス）

## Phase 11: AI要約機能追加 + 413エラー完全修正
- [x] 413エラーの根本原因調査・修正（画像を45KBに圧縮、Content-Lengthヘッダー追加）
- [x] /summary コマンドの実装（URLまたはテキストを受け取り投資家Fスタイルで要約）
- [x] 記事URLからコンテンツをスクレイピングする機能（scraper.ts）
- [x] LLMハンドラーに投資家Fスタイルの要約生成関数を追加（summarizeArticle）
- [x] webhook.tsに/summaryコマンドハンドラーを追加
- [x] リッチメニューは6ボタン構成維持（既にAI要約ボタン含む）
- [x] リッチメニュー画像を45KB版に更新済み
- [x] ダッシュボードにもAI要約セクション追加、tRPCにcontent.summarizeエンドポイント追加
- [x] テスト16件全パス
- [x] チェックポイント保存

## Phase 12: 分析スコープ拡大
- [x] LLMプロンプトに主要通貨ペア（USD/JPY, EUR/USD）・米国経済・世界情勢を追加
- [x] ニュース収集対象をゴールド・ポンド円以外に拡大（ドル円・ユーロドル・米国経済指標・地政学リスク）
- [x] X投稿生成プロンプトに「Fのフィルターを通した考察」視点を強化
- [x] 図解提案に米国経済と各資産の相関関係を構造的に表現する機能を追加（相関関係マップセクション）
- [x] ダッシュボードUIに分析スコープ表示を追加（6資産・指標のカード表示）
- [x] DBスキーマにmorning_briefing topicを追加
- [x] テスト25件全パス（スコープ拡大テスト9件追加）
- [x] チェックポイント保存
- [ ] ダッシュボードUIの再設計（メモ入力→抽象/具体/転用仕分け→答え合わせフロー）
- [ ] LINE Webhookの更新（メモ入力・ワークフロー対応）
- [ ] チェックポイント保存


## Phase 13: コンセプト変更 - 前田裕二「メモの魔力」メソッドベースのメモアプリへ
- [x] 前田裕二さんの思考フレームワーク調査（著書・X・YouTube等から抽出）
- [x] MAEDA_FRAMEWORK.md作成（フレームワーク・思考特性・メモアプリ活用法をドキュメント化）
- [x] DBスキーマの再設計（memos・categorizations・analysisResults テーブル作成）
- [x] messages テーブルの category → messageType への変更
- [x] webhook.ts・db.ts・routers.ts・Home.tsx・Messages.tsx の全コード修正
- [x] LLMプロンプトに前田裕二さんの文体・思考パターンを組み込み（analyzeMemoMaedaStyle関数追加）
- [x] DBヘルパー関数追加（memo・categorization・analysisResult管理）
- [x] tRPCエンドポイント追加（memosルーター）
- [x] ユニットテスト30件全パス
- [ ] ダッシュボードUIの再設計（メモ入力→抽象/具体/転用仕分け→答え合わせフロー）
- [ ] LINE Webhookの更新（メモ入力・ワークフロー対応）
- [ ] チェックポイント保存

## Phase 14: 前田裕二コンセプトへの完全移行
- [x] リッチメニュー画像の再作成（メモ入力・仕分けガイド・答え合わせ・メモ履歴・マイノート・ヘルプ）
- [x] リッチメニューのボタンアクション更新（/memo, /shiwake, /kotaeawase, /history, /mynote, /help）
- [x] LINE Webhook返答ロジックの完全書き換え（投資家F→前田裕二メモ分析）
- [x] メモ入力→仕分けガイダンス→答え合わせの会話フロー実装
- [x] ダッシュボードUIの完全再設計（メモワークフロー中心）
- [x] サイドバーナビゲーション更新（メモ・仕分け・分析結果・履歴）
- [x] Home.tsxの完全書き換え（メモアプリのダッシュボード）
- [x] 投資家Fの痕跡を完全除去（テキスト・ペルソナ・ブランディング）
- [x] アプリ名称変更（投資家F → メモの魔力）
- [x] スケジューラーの更新（投資ニュース配信→メモリマインダー）
- [x] LLMハンドラーの完全書き換え（前田裕二ペルソナ）
- [x] テスト38件全パス
- [x] チェックポイント保存

## Phase 15: LINE Bot返答しないバグ修正
- [x] Webhookログ調査（受信確認・エラー特定）
- [x] express.raw()で署名検証修正・Webhookルートをbody-parserの前に登録
- [x] DBマイグレーション適用（messageTypeカラム追加）
- [x] テスト実行・チェックポイント保存

## Phase 16: LINE Bot日本語対応・直感的操作
- [x] コマンドを日本語対応（「メモ」「仕分け」「答え合わせ」「履歴」「ヘルプ」）
- [x] メッセージ送信だけで自動メモ保存→仕分けガイドが始まるフローに変更
- [x] リッチメニューのアクションを日本語に変更（メモ・仕分け・答え合わせ・履歴・マイノート・ヘルプ）
- [x] リセット・スキップコマンド追加
- [x] テスト45件全パス
- [x] チェックポイント保存

## Phase 17: LINE Bot応答速度の改善
- [x] Webhook処理フローのボトルネック調査（LLM 2回呼び出しが原因）
- [x] classifyMessage + generateReplyをclassifyAndReplyに統合（LLM 2回→1回）
- [x] DB保存・LLM呼び出しをPromise.allで並行実行
- [x] LLMプロンプト軽量化（MAEDA_PERSONA_SHORTに圧縮）
- [x] テスト45件全パス
- [x] チェックポイント保存

## Phase 18: Slack Bot連携
- [x] GitHubから最新コード（slack.ts, slack.test.ts, SLACK_SETUP.md）をpull
- [x] Slack環境変数（SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET）の設定
- [x] Slack Bot Token認証テスト（auth.test API）パス
- [x] Slackルート登録確認（/api/slack/events, /api/slack/commands, /api/slack/health）
- [x] 全テスト51件パス
- [x] チェックポイント保存・再デプロイ

## Phase 19: Slack #メモチャンネル自動保存
- [x] GitHubから最新コードpull（shouldHandleSlackEvent関数追加、メモチャンネル対応）
- [x] SLACK_MEMO_CHANNEL_ID環境変数追加（C0B48FG18PM）
- [x] テスト54件全パス
- [x] チェックポイント保存・再デプロイ

## Phase 20: カテゴリ別メモ分類・取り出し機能
- [x] GitHubから最新コードpull（カテゴリ分類・フィルタ機能追加）
- [x] TypeScriptエラー0件
- [x] テスト57件全パス
- [x] /api/slack/health がJSON応答確認
- [x] チェックポイント保存・再デプロイ

## Phase 21: スレッド会話・メモ追記・別メモ機能
- [x] GitHubから最新コードpull（スレッド文脈引き継ぎ、追記・別メモ機能追加）
- [x] TypeScriptエラー0件
- [x] テスト60件全パス
- [x] /api/slack/health がJSON応答確認
- [x] チェックポイント保存・再デプロイ

## Phase 22: 深掘り型プロンプト最適化
- [x] GitHubから最新コードpull（深掘り型プロンプト変更）
- [x] TypeScriptエラー0件
- [x] テスト60件全パス
- [x] /api/slack/health がJSON応答確認
- [x] チェックポイント保存・再デプロイ

## Phase 23: 記事化機能
- [x] GitHubから最新コードpull（記事化機能追加）
- [x] TypeScriptエラー0件
- [x] テスト60件全パス
- [x] /api/slack/health がJSON応答確認
- [x] チェックポイント保存・再デプロイ

## Phase 24: X化・ポスト化機能
- [x] GitHubから最新コードpull（X化・ポスト化機能追加）
- [x] TypeScriptエラー0件
- [x] テスト60件全パス
- [x] /api/slack/health がJSON応答確認
- [x] チェックポイント保存・再デプロイ

## Phase 25: 返答プロンプト最適化（短く強い言葉）
- [x] GitHubから最新コードpull（返答プロンプト最適化）
- [x] TypeScriptエラー0件
- [x] テスト60件全パス
- [x] /api/slack/health がJSON応答確認
- [x] チェックポイント保存・再デプロイ
