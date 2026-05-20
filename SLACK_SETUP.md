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
履歴 投資メモ
今日のまとめ
今日のまとめ アイデア
記事化
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
```
