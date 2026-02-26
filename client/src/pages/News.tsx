import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

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
          <p className="text-muted-foreground mt-1">ゴールド・ポンド円の経済ニュースを自動配信（毎朝7時 JST）</p>
        </div>
        <Button onClick={() => sendNow.mutate()} disabled={sendNow.isPending}>
          {sendNow.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />配信中...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />今すぐ配信</>
          )}
        </Button>
      </div>

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
                      {news.topic === "combined" ? "総合ニュース" : news.topic}
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
