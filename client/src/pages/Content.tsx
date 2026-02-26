import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Twitter, Image, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function ContentPage() {
  const [xTopic, setXTopic] = useState("");
  const [infoTopic, setInfoTopic] = useState("");
  const [generatedXPost, setGeneratedXPost] = useState("");
  const [generatedInfographic, setGeneratedInfographic] = useState("");
  const [copied, setCopied] = useState(false);

  const generateXPost = trpc.content.generateXPost.useMutation({
    onSuccess: (data) => {
      setGeneratedXPost(data.content);
      toast.success("X投稿案を生成しました");
    },
    onError: () => toast.error("生成に失敗しました"),
  });

  const generateInfographic = trpc.content.generateInfographic.useMutation({
    onSuccess: (data) => {
      setGeneratedInfographic(data.content);
      toast.success("インフォグラフィック構成案を生成しました");
    },
    onError: () => toast.error("生成に失敗しました"),
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
        <p className="text-muted-foreground mt-1">X投稿やインフォグラフィックの構成案をAIで生成</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* X Post Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Twitter className="h-5 w-5 text-primary" />
              X投稿生成
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="トピックを入力（例：ゴールド急騰の背景分析、AI投資ツールの活用法）"
              value={xTopic}
              onChange={(e) => setXTopic(e.target.value)}
              rows={3}
            />
            <Button
              onClick={() => generateXPost.mutate({ topic: xTopic })}
              disabled={!xTopic.trim() || generateXPost.isPending}
              className="w-full"
            >
              {generateXPost.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />生成中...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />X投稿を生成</>
              )}
            </Button>
            {generatedXPost && (
              <div className="p-4 rounded-lg bg-secondary/50 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(generatedXPost)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Streamdown>{generatedXPost}</Streamdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Infographic Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              インフォグラフィック構成案
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="トピックを入力（例：今週のゴールド市場動向、GBP/JPYテクニカル分析）"
              value={infoTopic}
              onChange={(e) => setInfoTopic(e.target.value)}
              rows={3}
            />
            <Button
              onClick={() => generateInfographic.mutate({ topic: infoTopic })}
              disabled={!infoTopic.trim() || generateInfographic.isPending}
              className="w-full"
            >
              {generateInfographic.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />生成中...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />構成案を生成</>
              )}
            </Button>
            {generatedInfographic && (
              <div className="p-4 rounded-lg bg-secondary/50">
                <Streamdown>{generatedInfographic}</Streamdown>
              </div>
            )}
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

  const statusLabels: Record<string, string> = { draft: "下書き", approved: "承認済み", posted: "投稿済み" };
  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-400",
    approved: "bg-green-500/20 text-green-400",
    posted: "bg-blue-500/20 text-blue-400",
  };
  const typeLabels: Record<string, string> = { x_post: "X投稿", infographic: "インフォグラフィック", news_summary: "ニュースサマリー" };

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
