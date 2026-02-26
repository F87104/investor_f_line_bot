import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getAllLineUsers, getMessages, getMessagesByCategory,
  getRecentNewsDeliveries, getAllReminders, createReminder,
  updateReminderStatus, deleteReminder,
  getGeneratedContent, saveGeneratedContent, updateContentStatus,
  getActiveLineUsers,
} from "./db";
import { generateXPost, generateInfographicStructure, summarizeArticle } from "./llm-handlers";
import { extractUrl, scrapeUrl } from "./scraper";
import { sendMorningNews } from "./scheduler";
import { pushMessage, textMessage } from "./line";
import { setupRichMenu } from "./richmenu";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  lineUsers: router({
    list: protectedProcedure.query(async () => {
      return getAllLineUsers();
    }),
  }),

  messages: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(50),
        category: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getMessages(input?.limit ?? 50, input?.category);
      }),
    stats: protectedProcedure.query(async () => {
      return getMessagesByCategory();
    }),
  }),

  news: router({
    history: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        return getRecentNewsDeliveries(input?.limit ?? 20);
      }),
    sendNow: protectedProcedure.mutation(async () => {
      await sendMorningNews();
      return { success: true };
    }),
  }),

  reminders: router({
    list: protectedProcedure.query(async () => {
      return getAllReminders();
    }),
    create: protectedProcedure
      .input(z.object({
        type: z.enum(["x_post", "slide_creation", "custom"]),
        message: z.string().min(1),
        cronExpression: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await createReminder({
          type: input.type,
          message: input.message,
          cronExpression: input.cronExpression ?? null,
        });
        return { success: true };
      }),
    toggleActive: protectedProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        await updateReminderStatus(input.id, input.isActive);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteReminder(input.id);
        return { success: true };
      }),
  }),

  content: router({
    list: protectedProcedure
      .input(z.object({ type: z.string().optional(), limit: z.number().default(20) }).optional())
      .query(async ({ input }) => {
        return getGeneratedContent(input?.type, input?.limit ?? 20);
      }),
    generateXPost: protectedProcedure
      .input(z.object({ topic: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const content = await generateXPost(input.topic);
        await saveGeneratedContent({ type: "x_post", topic: input.topic, content });
        return { content };
      }),
    generateInfographic: protectedProcedure
      .input(z.object({ topic: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const content = await generateInfographicStructure(input.topic);
        await saveGeneratedContent({ type: "infographic", topic: input.topic, content });
        return { content };
      }),
    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["draft", "approved", "posted"]) }))
      .mutation(async ({ input }) => {
        await updateContentStatus(input.id, input.status);
        return { success: true };
      }),
    summarize: protectedProcedure
      .input(z.object({ input: z.string().min(1) }))
      .mutation(async ({ input: { input: userInput } }) => {
        const url = extractUrl(userInput);
        let content: string;
        if (url) {
          const article = await scrapeUrl(url);
          content = await summarizeArticle(
            `タイトル: ${article.title}\n\n${article.content}`,
            article.url
          );
        } else {
          content = await summarizeArticle(userInput);
        }
        await saveGeneratedContent({ type: "summary", topic: userInput.slice(0, 100), content });
        return { content };
      }),
  }),

  push: router({
    send: protectedProcedure
      .input(z.object({ message: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const users = await getActiveLineUsers();
        if (users.length === 0) return { success: false, error: "No active LINE users" };
        for (const user of users) {
          await pushMessage(user.lineUserId, [textMessage(input.message)]);
        }
        return { success: true, sentTo: users.length };
      }),
  }),

  richMenu: router({
    setup: protectedProcedure.mutation(async () => {
      return setupRichMenu();
    }),
  }),
});

export type AppRouter = typeof appRouter;
