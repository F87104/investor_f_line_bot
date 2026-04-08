import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bell, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  memo_reminder: "メモ習慣リマインダー",
  shiwake_prompt: "振り返りリマインダー",
  custom: "カスタム",
};

export default function RemindersPage() {
  const { data: reminders, isLoading } = trpc.reminders.list.useQuery();
  const utils = trpc.useUtils();

  const [newType, setNewType] = useState<"memo_reminder" | "shiwake_prompt" | "custom">("memo_reminder");
  const [newMessage, setNewMessage] = useState("");
  const [newCron, setNewCron] = useState("0 9");

  const createReminder = trpc.reminders.create.useMutation({
    onSuccess: () => {
      toast.success("リマインダーを作成しました");
      utils.reminders.list.invalidate();
      setNewMessage("");
    },
    onError: () => toast.error("作成に失敗しました"),
  });

  const toggleReminder = trpc.reminders.toggleActive.useMutation({
    onSuccess: () => {
      utils.reminders.list.invalidate();
    },
  });

  const deleteReminder = trpc.reminders.delete.useMutation({
    onSuccess: () => {
      toast.success("リマインダーを削除しました");
      utils.reminders.list.invalidate();
    },
  });

  const defaultMessages: Record<string, string> = {
    memo_reminder: "📝 メモの時間です！今日感じたこと、気づいたことをメモしましょう。\n「メモを書く」でワークを始められます。",
    shiwake_prompt: "🔍 振り返りの時間です！今週のメモを見返して、抽象化・転用を深めましょう。",
    custom: "",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">リマインダー</h1>
        <p className="text-muted-foreground mt-1">メモ習慣や振り返りのリマインダーを管理</p>
      </div>

      {/* Create Reminder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            新しいリマインダー
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">タイプ</label>
              <Select value={newType} onValueChange={(v) => {
                const t = v as "memo_reminder" | "shiwake_prompt" | "custom";
                setNewType(t);
                if (defaultMessages[t]) setNewMessage(defaultMessages[t]);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="memo_reminder">メモ習慣リマインダー</SelectItem>
                  <SelectItem value="shiwake_prompt">振り返りリマインダー</SelectItem>
                  <SelectItem value="custom">カスタム</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">配信時刻（JST）</label>
              <Input
                placeholder="分 時（例: 0 9 = 9:00）"
                value={newCron}
                onChange={(e) => setNewCron(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">形式: 分 時（例: 0 9 = 毎日9:00, 30 12 = 毎日12:30）</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">メッセージ</label>
            <Textarea
              placeholder="リマインダーメッセージを入力"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            onClick={() => createReminder.mutate({
              type: newType,
              message: newMessage,
              cronExpression: newCron,
            })}
            disabled={!newMessage.trim() || createReminder.isPending}
          >
            {createReminder.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />作成中...</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" />リマインダーを作成</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Reminders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            リマインダー一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-secondary/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : reminders && reminders.length > 0 ? (
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="p-4 rounded-lg border border-border/50 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                        {typeLabels[reminder.type] ?? reminder.type}
                      </span>
                      {reminder.cronExpression && (
                        <span className="text-xs text-muted-foreground">
                          毎日 {reminder.cronExpression.split(" ").reverse().join(":")} JST
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{reminder.message}</p>
                    {reminder.lastSentAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        最終送信: {new Date(reminder.lastSentAt).toLocaleString("ja-JP")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={reminder.isActive}
                      onCheckedChange={(checked) => toggleReminder.mutate({ id: reminder.id, isActive: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteReminder.mutate({ id: reminder.id })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">リマインダーがまだありません</p>
              <p className="text-xs text-muted-foreground mt-1">上のフォームからリマインダーを作成してください</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
