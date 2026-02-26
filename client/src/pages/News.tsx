import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, Send, Loader2, Globe, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

const topicLabels: Record<string, string> = {
  combined: "総合ニュース",
  morning_briefing: "朝のブリーフィング",
  gold_xauusd: "ゴールド",
  gbpjpy: "ポンド円",
};

export default function NewsPage() {
  const { data: newsHistory, isLoading } = trpc.news.history.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const sendNow = trpc.news.sendNow.useMutation({
    onSuccess: () => {
      toast.success("ニュースを配信しました");
      utils.news.history.invalidate();
    },
    onError: () => toast.error("配信に失敗しました"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ニュース配信</h1>
          <p className="text-muted-foreground mt-1">マーケットブリーフィングを自動配信（毎朝7時 JST）</p>
        </div>
        <Button onClick={() => sendNow.mutate()} disabled={sendNow.isPending}>
          {sendNow.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />配信中...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />今すぐ配信</>
          )}
        </Button>
      </div>

      {/* Analysis Scope Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            分析スコープ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-amber-400 text-lg">📊</span>
              <div>
                <p className="text-sm font-medium text-amber-400">ゴールド</p>
                <p className="text-xs text-muted-foreground">XAUUSD</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <span className="text-blue-400 text-lg">💷</span>
              <div>
                <p className="text-sm font-medium text-blue-400">ポンド円</p>
                <p className="text-xs text-muted-foreground">GBP/JPY</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="text-green-400 text-lg">💵</span>
              <div>
                <p className="text-sm font-medium text-green-400">ドル円</p>
                <p className="text-xs text-muted-foreground">USD/JPY</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="text-purple-400 text-lg">💶</span>
              <div>
                <p className="text-sm font-medium text-purple-400">ユーロドル</p>
                <p className="text-xs text-muted-foreground">EUR/USD</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-red-400 text-lg">🏛️</span>
              <div>
                <p className="text-sm font-medium text-red-400">米国経済</p>
                <p className="text-xs text-muted-foreground">FRB・CPI・雇用統計</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <span className="text-orange-400 text-lg">🌍</span>
              <div>
                <p className="text-sm font-medium text-orange-400">地政学リスク</p>
                <p className="text-xs text-muted-foreground">世界情勢・マネーフロー</p>
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-secondary/50 border border-border/30">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                米国経済を軸に、各資産の相関関係（ドル高/安→ゴールド・ポンド・ユーロへの影響）を横断的に分析。投資家Fの「世界がこう動いているから、ここを見る」フィルターで考察します。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            配信履歴
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-secondary/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : newsHistory && newsHistory.length > 0 ? (
            <div className="space-y-4">
              {newsHistory.map((news) => (
                <div key={news.id} className="p-4 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                      {topicLabels[news.topic] ?? news.topic}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(news.sentAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <div className="text-sm prose prose-sm prose-invert max-w-none">
                    <Streamdown>{news.content}</Streamdown>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Newspaper className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">まだニュースが配信されていません</p>
              <p className="text-xs text-muted-foreground mt-1">「今すぐ配信」ボタンでテスト配信できます</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
