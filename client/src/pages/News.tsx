import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Send, Loader2, PenTool } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function NewsPage() {
  const { data: newsHistory, isLoading } = trpc.news.history.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const sendNow = trpc.news.sendNow.useMutation({
    onSuccess: () => {
      toast.success("メモリマインダーを配信しました");
      utils.news.history.invalidate();
    },
    onError: () => toast.error("配信に失敗しました"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">メモリマインダー履歴</h1>
          <p className="text-muted-foreground mt-1">毎朝7時にメモ習慣化リマインダーを自動配信</p>
        </div>
        <Button onClick={() => sendNow.mutate()} disabled={sendNow.isPending}>
          {sendNow.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />配信中...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />今すぐ配信</>
          )}
        </Button>
      </div>

      {/* Memo Magic Framework Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            メモの魔力フレームワーク
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="text-sm font-semibold text-blue-400 mb-1">抽象化</h4>
              <p className="text-xs text-muted-foreground">「なぜそう思ったのか？」「ここから何が言えるか？」を深掘りする</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <h4 className="text-sm font-semibold text-green-400 mb-1">具体化</h4>
              <p className="text-xs text-muted-foreground">抽象的な気づきを、具体的な事例やシーンに落とし込む</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h4 className="text-sm font-semibold text-amber-400 mb-1">転用</h4>
              <p className="text-xs text-muted-foreground">気づきを自分の仕事や生活にどう活かすかを考える</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            毎朝のリマインダーで、前田裕二さんの「メモの魔力」メソッドを習慣化します。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
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
                      メモリマインダー
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
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">まだリマインダーが配信されていません</p>
              <p className="text-xs text-muted-foreground mt-1">「今すぐ配信」ボタンでテスト配信できます</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
