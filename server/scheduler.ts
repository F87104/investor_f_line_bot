import { getActiveLineUsers, saveNewsDelivery, getActiveReminders, updateReminderLastSent } from "./db";
import { multicastMessage, textMessage } from "./line";
import { generateMemoReminder } from "./llm-handlers";

// ─── Send Morning Memo Reminder ───
export async function sendMorningNews() {
  console.log("[Scheduler] Starting morning memo reminder delivery...");

  try {
    const activeUsers = await getActiveLineUsers();
    if (activeUsers.length === 0) {
      console.log("[Scheduler] No active LINE users to send reminder to");
      return;
    }

    const reminder = await generateMemoReminder();

    const userIds = activeUsers.map(u => u.lineUserId);
    await multicastMessage(userIds, [textMessage(reminder)]);

    // Save delivery record
    await saveNewsDelivery({
      topic: "morning_briefing",
      content: reminder,
    });

    console.log(`[Scheduler] Morning memo reminder sent to ${userIds.length} users`);
  } catch (e) {
    console.error("[Scheduler] Morning memo reminder error:", e);
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
      if (reminder.cronExpression) {
        const [cronMin, cronHour] = reminder.cronExpression.split(" ");
        if (parseInt(cronHour) === tokyoHour && parseInt(cronMin) === tokyoMinute) {
          if (reminder.lastSentAt) {
            const lastSent = new Date(reminder.lastSentAt);
            const lastSentDate = lastSent.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
            const todayDate = now.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
            if (lastSentDate === todayDate) continue;
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

  // Morning memo reminder at 7:00 AM JST
  const checkMorningReminder = () => {
    const now = new Date();
    const tokyoTime = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", minute: "numeric", hour12: false });
    const [hour, minute] = tokyoTime.split(":").map(Number);
    if (hour === 7 && minute === 0) {
      sendMorningNews();
    }
  };
  setInterval(checkMorningReminder, 60 * 1000);

  console.log("[Scheduler] Initialized - morning memo reminder at 7:00 JST, reminders active");
}
