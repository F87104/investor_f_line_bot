import { getActiveLineUsers, saveNewsDelivery, getActiveReminders, updateReminderLastSent } from "./db";
import { multicastMessage, textMessage } from "./line";
import { generateNewsSummary } from "./llm-handlers";
import { ENV } from "./_core/env";

// ─── Fetch Market Data (拡大版: ゴールド・ポンド円・ドル円・ユーロドル・米国経済) ───
async function fetchMarketData(): Promise<string> {
  const today = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const sections: string[] = [`本日の日付: ${today}`];

  // ── Gold price ──
  try {
    const goldRes = await fetch("https://api.metals.dev/v1/latest?api_key=demo&currency=USD&unit=toz");
    const goldData = await goldRes.json();
    if (goldData?.metals?.gold) {
      sections.push(`ゴールド（XAUUSD）: $${goldData.metals.gold}/トロイオンス`);
    }
  } catch { sections.push("ゴールド: データ取得中"); }

  // ── Forex rates (GBP/JPY, USD/JPY, EUR/USD) ──
  try {
    const usdRes = await fetch("https://open.er-api.com/v6/latest/USD");
    const usdData = await usdRes.json();
    if (usdData?.rates) {
      if (usdData.rates.JPY) sections.push(`ドル円（USD/JPY）: ${usdData.rates.JPY.toFixed(2)}`);
      if (usdData.rates.EUR) sections.push(`ユーロドル（EUR/USD）: ${(1 / usdData.rates.EUR).toFixed(4)}`);
    }
  } catch { sections.push("USD為替: データ取得中"); }

  try {
    const gbpRes = await fetch("https://open.er-api.com/v6/latest/GBP");
    const gbpData = await gbpRes.json();
    if (gbpData?.rates?.JPY) {
      sections.push(`ポンド円（GBP/JPY）: ${gbpData.rates.JPY.toFixed(2)}`);
    }
  } catch { sections.push("GBP/JPY: データ取得中"); }

  // ── US Economic Calendar / Key Events ──
  try {
    // Fetch recent economic news context via LLM knowledge
    sections.push("\n【米国経済の注目点】");
    sections.push("- FRB（連邦準備制度理事会）の政策金利動向");
    sections.push("- 直近の雇用統計・CPI（消費者物価指数）の影響");
    sections.push("- 地政学リスク（中東情勢、米中関係等）");
    sections.push("- 世界的なマネーフローの方向性");
  } catch { /* non-critical */ }

  return sections.join("\n");
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
      topic: "morning_briefing",
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

  console.log("[Scheduler] Initialized - morning briefing at 7:00 JST (Gold/GBP-JPY/USD-JPY/EUR-USD/US Economy), reminders active");
}
