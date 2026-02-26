import { getActiveLineUsers, saveNewsDelivery, getActiveReminders, updateReminderLastSent } from "./db";
import { multicastMessage, textMessage } from "./line";
import { generateNewsSummary } from "./llm-handlers";
import { ENV } from "./_core/env";

// ─── Fetch Market Data ───
async function fetchMarketData(): Promise<string> {
  try {
    // Use a free API to get basic market data
    const goldRes = await fetch("https://api.metals.dev/v1/latest?api_key=demo&currency=USD&unit=toz");
    const forexRes = await fetch("https://open.er-api.com/v6/latest/GBP");

    let goldInfo = "";
    let gbpjpyInfo = "";

    try {
      const goldData = await goldRes.json();
      if (goldData?.metals?.gold) {
        goldInfo = `ゴールド現在価格: $${goldData.metals.gold}/トロイオンス`;
      }
    } catch { goldInfo = "ゴールド価格データ取得中"; }

    try {
      const forexData = await forexRes.json();
      if (forexData?.rates?.JPY) {
        gbpjpyInfo = `GBP/JPY: ${forexData.rates.JPY.toFixed(2)}`;
      }
    } catch { gbpjpyInfo = "GBP/JPY価格データ取得中"; }

    return `最新市場データ:\n${goldInfo}\n${gbpjpyInfo}\n\n本日の日付: ${new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}`;
  } catch (e) {
    console.error("[Scheduler] Market data fetch error:", e);
    return `本日の日付: ${new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}`;
  }
}

// ─── Send Morning News ───
export async function sendMorningNews() {
  console.log("[Scheduler] Starting morning news delivery...");

  try {
    const activeUsers = await getActiveLineUsers();
    if (activeUsers.length === 0) {
      console.log("[Scheduler] No active LINE users to send news to");
      return;
    }

    const marketData = await fetchMarketData();
    const newsSummary = await generateNewsSummary(marketData);

    const userIds = activeUsers.map(u => u.lineUserId);

    await multicastMessage(userIds, [textMessage(newsSummary)]);

    // Save delivery record
    await saveNewsDelivery({
      topic: "combined",
      content: newsSummary,
    });

    console.log(`[Scheduler] Morning news sent to ${userIds.length} users`);
  } catch (e) {
    console.error("[Scheduler] Morning news delivery error:", e);
  }
}

// ─── Send Reminder ───
async function sendReminder(reminderMessage: string) {
  try {
    const activeUsers = await getActiveLineUsers();
    if (activeUsers.length === 0) return;

    const userIds = activeUsers.map(u => u.lineUserId);
    await multicastMessage(userIds, [textMessage(reminderMessage)]);
  } catch (e) {
    console.error("[Scheduler] Reminder send error:", e);
  }
}

// ─── Check and Send Reminders ───
export async function checkAndSendReminders() {
  try {
    const activeReminders = await getActiveReminders();
    const now = new Date();
    const tokyoHour = parseInt(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false }));
    const tokyoMinute = parseInt(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo", minute: "numeric" }));

    for (const reminder of activeReminders) {
      // Simple cron-like matching for hour:minute
      if (reminder.cronExpression) {
        const [cronMin, cronHour] = reminder.cronExpression.split(" ");
        if (parseInt(cronHour) === tokyoHour && parseInt(cronMin) === tokyoMinute) {
          // Check if already sent today
          if (reminder.lastSentAt) {
            const lastSent = new Date(reminder.lastSentAt);
            const lastSentDate = lastSent.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
            const todayDate = now.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
            if (lastSentDate === todayDate) continue; // Already sent today
          }
          await sendReminder(reminder.message);
          await updateReminderLastSent(reminder.id);
          console.log(`[Scheduler] Reminder sent: ${reminder.type}`);
        }
      }
    }
  } catch (e) {
    console.error("[Scheduler] Reminder check error:", e);
  }
}

// ─── Initialize Scheduler ───
export function initScheduler() {
  console.log("[Scheduler] Initializing...");

  // Check every minute for reminders
  setInterval(checkAndSendReminders, 60 * 1000);

  // Morning news at 7:00 AM JST
  const checkMorningNews = () => {
    const now = new Date();
    const tokyoTime = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", minute: "numeric", hour12: false });
    const [hour, minute] = tokyoTime.split(":").map(Number);
    if (hour === 7 && minute === 0) {
      sendMorningNews();
    }
  };
  setInterval(checkMorningNews, 60 * 1000);

  console.log("[Scheduler] Initialized - morning news at 7:00 JST, reminders active");
}
