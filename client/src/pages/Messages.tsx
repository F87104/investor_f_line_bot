import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowDownUp } from "lucide-react";

const messageTypes = [
  { value: "all", label: "すべて" },
  { value: "memo_input", label: "メモ入力", color: "bg-blue-500/20 text-blue-400" },
  { value: "workflow_step", label: "ワークフロー", color: "bg-green-500/20 text-green-400" },
  { value: "analysis_result", label: "分析結果", color: "bg-amber-500/20 text-amber-400" },
  { value: "notification", label: "通知", color: "bg-purple-500/20 text-purple-400" },
];

export default function MessagesPage() {
  const [selectedMessageType, setSelectedMessageType] = useState("all");
  const stableInput = useMemo(() => ({ limit: 100, messageType: selectedMessageType === "all" ? undefined : selectedMessageType }), [selectedMessageType]);
  const { data: messages, isLoading } = trpc.messages.list.useQuery(stableInput);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">メッセージ</h1>
        <p className="text-muted-foreground mt-1">LINEボットとのメッセージ履歴（自動分類済み）</p>
      </div>

      {/* Message Type Filter */}
      <div className="flex flex-wrap gap-2">
        {messageTypes.map((mt) => (
          <Button
            key={mt.value}
            variant={selectedMessageType === mt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedMessageType(mt.value)}
            className={selectedMessageType === mt.value ? "" : "bg-transparent"}
          >
            {mt.label}
          </Button>
        ))}
      </div>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            メッセージ一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map((msg) => {
                const mt = messageTypes.find(m => m.value === msg.messageType) ?? messageTypes[4];
                return (
                  <div key={msg.id} className="p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${mt?.color ?? "bg-gray-500/20 text-gray-400"}`}>
                          {mt?.label ?? msg.messageType}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ArrowDownUp className="h-3 w-3" />
                          {msg.direction === "incoming" ? "受信" : "送信"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleString("ja-JP")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">まだメッセージがありません</p>
              <p className="text-xs text-muted-foreground mt-1">LINEでボットにメッセージを送ると、ここに表示されます</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
