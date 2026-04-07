import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, Newspaper, Bell, TrendingUp, Sparkles, Menu, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const messageTypeLabels: Record<string, string> = {
  memo_input: "メモ入力",
  workflow_step: "ワークフロー",
  analysis_result: "分析結果",
  notification: "通知",
};

const messageTypeColors: Record<string, string> = {
  memo_input: "text-blue-400",
  workflow_step: "text-green-400",
  analysis_result: "text-amber-400",
  notification: "text-purple-400",
};

function RichMenuButton() {
  const setupMutation = trpc.richMenu.setup.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("リッチメニューを設定しました");
      } else {
        toast.error(data.error ?? "設定に失敗しました");
      }
    },
    onError: () => toast.error("リッチメニューの設定に失敗しました"),
  });

  return (
    <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending} className="w-full">
      {setupMutation.isPending ? (
        <><Loader2 className="h-4 w-4 animate-spin mr-2" />設定中...</>
      ) : (
        <><Menu className="h-4 w-4 mr-2" />リッチメニューを作成・設定</>
      )}
    </Button>
  );
}

function WebhookUrlCopy() {
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${window.location.origin}/api/webhook`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("コピーしました");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-xs bg-secondary/50 p-2 rounded truncate">{webhookUrl}</code>
      <Button variant="outline" size="sm" onClick={handleCopy} className="bg-transparent shrink-0">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function Home() {
  const { data: lineUsers } = trpc.lineUsers.list.useQuery();
  const { data: messageStats } = trpc.messages.stats.useQuery();
  const { data: recentMessages } = trpc.messages.list.useQuery({ limit: 5 });
  const { data: newsHistory } = trpc.news.history.useQuery({ limit: 5 });
  const { data: reminders } = trpc.reminders.list.useQuery();

  const totalMessages = messageStats?.reduce((sum: number, s: any) => sum + Number(s.count), 0) ?? 0;
  const activeReminders = reminders?.filter(r => r.isActive).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground mt-1">投資家Fアシスタントの管理画面（ゴールド・GBP/JPY・USD/JPY・EUR/USD・米国経済・地政学リスク）</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">LINE ユーザー</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lineUsers?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">アクティブな接続数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">メッセージ</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMessages}</div>
            <p className="text-xs text-muted-foreground mt-1">総メッセージ数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ニュース配信</CardTitle>
            <Newspaper className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newsHistory?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">配信済みニュース</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">リマインダー</CardTitle>
            <Bell className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReminders}</div>
            <p className="text-xs text-muted-foreground mt-1">アクティブなリマインダー</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Menu className="h-5 w-5 text-primary" />
              リッチメニュー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">LINEボットのリッチメニューを自動作成・設定します。X投稿・図解提案・ニュース・アイデア・カテゴリ・ヘルプの6ボタンが表示されます。</p>
            <RichMenuButton />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-primary" />
              Webhook URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">LINE DevelopersコンソールのMessaging API設定に以下のURLを設定してください。</p>
            <WebhookUrlCopy />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              カテゴリ別メッセージ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {messageStats && messageStats.length > 0 ? (
              <div className="space-y-3">
                {messageStats.map((stat: any) => (
                  <div key={stat.messageType} className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${messageTypeColors[stat.messageType ?? "memo_input"]}`}>
                      {messageTypeLabels[stat.messageType ?? "memo_input"] ?? stat.messageType}
                    </span>
                    <span className="text-sm text-muted-foreground">{Number(stat.count)} 件</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">まだメッセージがありません。LINEでボットにメッセージを送ると、ここに分類結果が表示されます。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              最近のメッセージ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentMessages && recentMessages.length > 0 ? (
              <div className="space-y-3">
                {recentMessages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${messageTypeColors[msg.messageType ?? "memo_input"]}`}>
                        {messageTypeLabels[msg.messageType ?? "memo_input"]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {msg.direction === "incoming" ? "受信" : "送信"}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">{msg.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">まだメッセージがありません。</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
