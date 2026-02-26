import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PushPage() {
  const [message, setMessage] = useState("");
  const { data: lineUsers } = trpc.lineUsers.list.useQuery();

  const sendPush = trpc.push.send.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`${data.sentTo}人のユーザーに送信しました`);
        setMessage("");
      } else {
        toast.error(data.error ?? "送信に失敗しました");
      }
    },
    onError: () => toast.error("送信に失敗しました"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">プッシュ通知</h1>
        <p className="text-muted-foreground mt-1">LINE登録ユーザーにメッセージを一斉送信</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Send Message */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              メッセージ送信
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="送信するメッセージを入力してください..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {lineUsers?.filter(u => u.isActive).length ?? 0} 人のアクティブユーザーに送信されます
              </p>
              <Button
                onClick={() => sendPush.mutate({ message })}
                disabled={!message.trim() || sendPush.isPending}
              >
                {sendPush.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />送信中...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />送信</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* LINE Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              LINE ユーザー
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lineUsers && lineUsers.length > 0 ? (
              <div className="space-y-2">
                {lineUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                    <div>
                      <p className="text-sm font-medium">{user.displayName ?? "不明"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user.lineUserId}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {user.isActive ? "有効" : "無効"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">まだLINEユーザーがいません</p>
                <p className="text-xs text-muted-foreground mt-1">LINEボットを友だち追加すると表示されます</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
