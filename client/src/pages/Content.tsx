import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Brain, BookOpen, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function ContentPage() {
  const [summaryInput, setSummaryInput] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [copied, setCopied] = useState(false);

  const summarize = trpc.content.summarize.useMutation({
    onSuccess: (data: { content: string }) => {
      setGeneratedSummary(data.content);
      toast.success("メモの魔力式 要約を生成しました");
    },
    onError: () => toast.error("要約に失敗しました"),
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("クリップボードにコピーしました");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">コンテンツ生成</h1>
        <p className="text-muted-foreground mt-1">前田裕二の「メモの魔力」式で記事やテキストを要約・分析</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memo Magic Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              メモの魔力式 要約
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="記事URLまたは要約したいテキストを入力&#10;&#10;例: https://... または 記事の本文&#10;&#10;前田裕二の「ファクト→抽象化→転用」フレームワークで要約します"
              value={summaryInput}
              onChange={(e) => setSummaryInput(e.target.value)}
              rows={5}
            />
            <Button
              onClick={() => summarize.mutate({ input: summaryInput })}
              disabled={!summaryInput.trim() || summarize.isPending}
              className="w-full"
            >
              {summarize.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />分析中...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />メモの魔力式で要約</>
              )}
            </Button>
            {generatedSummary && (
              <div className="p-4 rounded-lg bg-secondary/50 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(generatedSummary)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Streamdown>{generatedSummary}</Streamdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How to Use */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              メモの魔力フレームワーク
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <h4 className="font-semibold mb-1">📝 ステップ1: ファクト</h4>
                <p className="text-muted-foreground">見たこと、聞いたこと、感じたことをそのまま書く</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <h4 className="font-semibold mb-1">🔍 ステップ2: 抽象化</h4>
                <p className="text-muted-foreground">「なぜ？」「ここから何が言えるか？」を考える</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <h4 className="font-semibold mb-1">💡 ステップ3: 転用</h4>
                <p className="text-muted-foreground">抽象化した気づきを、自分の仕事や生活にどう活かすか</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              前田裕二さんの「メモの魔力」より。すべての出来事に学びがあります。
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Generated Content History */}
      <ContentHistory />
    </div>
  );
}

function ContentHistory() {
  const { data: contents } = trpc.content.list.useQuery();

  if (!contents || contents.length === 0) return null;

  const statusLabels: Record<string, string> = { draft: "下書き", approved: "承認済み", posted: "完了" };
  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-400",
    approved: "bg-green-500/20 text-green-400",
    posted: "bg-blue-500/20 text-blue-400",
  };
  const typeLabels: Record<string, string> = { summary: "メモの魔力式 要約", x_post: "メモ分析", infographic: "思考整理", news_summary: "サマリー" };

  return (
    <Card>
      <CardHeader>
        <CardTitle>生成履歴</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {contents.map((content) => (
            <div key={content.id} className="p-3 rounded-lg border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                    {typeLabels[content.type] ?? content.type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[content.status]}`}>
                    {statusLabels[content.status]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(content.createdAt).toLocaleString("ja-JP")}
                </span>
              </div>
              {content.topic && <p className="text-xs text-muted-foreground mb-1">トピック: {content.topic}</p>}
              <p className="text-sm line-clamp-3">{content.content}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
