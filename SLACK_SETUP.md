# Slack Bot Setup

## Environment Variables

Set these in the deployment environment:

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

`SLACK_BOT_TOKEN` is shown in Slack App settings under **OAuth & Permissions** after installing the app to the workspace.

`SLACK_SIGNING_SECRET` is shown under **Basic Information**.

## Required Bot Token Scopes

Add these under **OAuth & Permissions > Bot Token Scopes**:

```text
chat:write
app_mentions:read
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

In Slack, mention the bot, DM it, or use the slash command:

```text
@bot 朝の会議で質問が少ないほど理解度が低いと感じた
/memo-magic 履歴
/memo-magic 答え合わせ
/memo-magic 要約 https://example.com/article
```
