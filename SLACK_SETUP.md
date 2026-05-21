# Slack Bot Setup

## Environment Variables

Set these in the deployment environment:

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_MEMO_CHANNEL_ID=C...
```

`SLACK_BOT_TOKEN` is shown in Slack App settings under **OAuth & Permissions** after installing the app to the workspace.

`SLACK_SIGNING_SECRET` is shown under **Basic Information**.

`SLACK_MEMO_CHANNEL_ID` is optional. Set it to the Slack channel ID for the channel where normal messages should be saved as memos, such as `#メモ`.

## Required Bot Token Scopes

Add these under **OAuth & Permissions > Bot Token Scopes**:

```text
chat:write
app_mentions:read
channels:history
im:history
im:read
im:write
```

After changing scopes, reinstall the app with **Install App > Reinstall to Workspace**.

## Event Subscriptions

Enable **Event Subscriptions** and set the Request URL:

```text
https://YOUR_DOMAIN/api/slack/events
```

Subscribe to these bot events:

```text
app_mention
message.channels
message.im
```

## Slash Command

Create a slash command such as:

```text
/memo-magic
```

Set the Request URL:

```text
https://YOUR_DOMAIN/api/slack/commands
```

## Usage

In Slack, write in the configured memo channel, mention the bot, DM it, or use the slash command:

```text
今日の気づきテスト
できること
履歴 投資メモ
今日のまとめ
今日のまとめ アイデア
整理
整理 今日
整理 今週
整理 未処理
記事化
X化
コピー用
言葉
言葉1
重要
@bot 朝の会議で質問が少ないほど理解度が低いと感じた
/memo-magic 履歴
/memo-magic 答え合わせ
/memo-magic 要約 https://example.com/article
```

Thread replies to the bot's memo response keep the original memo context:

```text
これを投資ルールにすると？
追記: 金利だけでなく決算も見る
別メモ: 明日は決算資料を確認する
答え合わせ
記事化
X化
コピー用
言葉
言葉1
重要
```

## Copy and organize thread content

Keep `#メモ` as the single inbox. You do not need to choose a category when writing.

Use this in `#メモ` or a bot thread:

```text
整理
```

Shows recent memos grouped by:

```text
投資メモ
思考
アイデア
学び
タスク
その他
```

You can also use:

```text
整理 今日
整理 今週
整理 未処理
```

Use these inside a bot reply thread:

```text
コピー用
```

Creates a new `#メモ` parent post split into short blocks:

```text
【タイトル】
...

【大事な一文】
...

【短い本文】
...

【X投稿】
...

【次にやること】
...
```

```text
言葉
```

Creates a new `#メモ` parent post with short phrases from the thread:

```text
1. 自分を使う節約
2. 体力払い
3. 便利さを買わない代わりに自分を使っている
```

```text
言葉1
```

Turns phrase number 1 into a new `#メモ` parent post, so it can be discussed in its own thread. `言葉2` and `言葉3` work the same way.

```text
重要
```

Creates a new `#メモ` parent post with the important points from the current thread. No copy and paste is needed.
