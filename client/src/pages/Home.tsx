import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, BookOpen, Bell, PenTool, Sparkles, Menu, Loader2, Copy, Check, Brain, ArrowRight } from "lucide-react";
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
  const { data: reminders } = trpc.reminders.list.useQuery();

  const totalMessages = messageStats?.reduce((sum: number, s: any) => sum + Number(s.count), 0) ?? 0;
  const activeReminders = reminders?.filter(r => r.isActive).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">メモの魔力 ダッシュボード</h1>
        <p className="text-muted-foreground mt-1">前田裕二「メモの魔力」メソッドで思考を深めるLINEアシスタント</p>
      </div>

      {/* Memo Magic Workflow Overview */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <PenTool className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-semibold">メモ入力</span>
              <span className="text-xs text-muted-foreground">ファクトを書く</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-semibold">仕分けワーク</span>
              <span className="text-xs text-muted-foreground">抽象・具体・転用</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-semibold">答え合わせ</span>
              <span className="text-xs text-muted-foreground">前田裕二的考察</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <CardTitle className="text-sm font-medium text-muted-foreground">メモリマインダー</CardTitle>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">毎朝 7:00</div>
            <p className="text-xs text-muted-foreground mt-1">メモ習慣化リマインダー</p>
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
            <p className="text-sm text-muted-foreground mb-3">LINEのリッチメニューを「メモの魔力」仕様に設定します。メモ入力・仕分けワーク・答え合わせ・メモ履歴・マイノート・ヘルプの6ボタンが表示されます。</p>
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
              <PenTool className="h-5 w-5 text-primary" />
              メッセージ種別
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
              <p className="text-sm text-muted-foreground">まだメッセージがありません。LINEでメモを送ると、ここに分類結果が表示されます。</p>
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
