// This file contains the memos router definition to be inserted into routers.ts
// Insert this after the messages router and before the news router

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createMemo, getMemos, getMemoById, updateMemoStatus,
  saveCategorization, getCategorizationByMemoId,
  saveAnalysisResult, getAnalysisResultByMemoId,
} from "./db";
import { analyzeMemoMaedaStyle } from "./llm-handlers";

export const memosRouter = router({
  create: protectedProcedure
    .input(z.object({
      lineUserId: z.string(),
      factContent: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      return createMemo({
        lineUserId: input.lineUserId,
        factContent: input.factContent,
        status: "draft",
      });
    }),

  list: protectedProcedure
    .input(z.object({
      lineUserId: z.string(),
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ input }) => {
      if (!input?.lineUserId) return [];
      return getMemos(input.lineUserId, input.limit ?? 20);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getMemoById(input.id);
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "categorizing", "completed"]),
    }))
    .mutation(async ({ input }) => {
      await updateMemoStatus(input.id, input.status);
      return { success: true };
    }),

  saveCategorization: protectedProcedure
    .input(z.object({
      memoId: z.number(),
      abstractionInput: z.string().optional(),
      concreteInput: z.string().optional(),
      transferInput: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return saveCategorization({
        memoId: input.memoId,
        abstractionInput: input.abstractionInput || null,
        concreteInput: input.concreteInput || null,
        transferInput: input.transferInput || null,
      });
    }),

  getCategorization: protectedProcedure
    .input(z.object({ memoId: z.number() }))
    .query(async ({ input }) => {
      return getCategorizationByMemoId(input.memoId);
    }),

  analyze: protectedProcedure
    .input(z.object({
      memoId: z.number(),
      factContent: z.string(),
      userAbstraction: z.string().optional(),
      userConcrete: z.string().optional(),
      userTransfer: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const analysis = await analyzeMemoMaedaStyle(
        input.factContent,
        input.userAbstraction,
        input.userConcrete,
        input.userTransfer
      );
      const saved = await saveAnalysisResult({
        memoId: input.memoId,
        maedaAbstraction: analysis.maedaAbstraction,
        maedaConcrete: analysis.maedaConcrete,
        maedaTransfer: analysis.maedaTransfer,
        maedaInsight: analysis.maedaInsight,
      });
      return saved;
    }),

  getAnalysis: protectedProcedure
    .input(z.object({ memoId: z.number() }))
    .query(async ({ input }) => {
      return getAnalysisResultByMemoId(input.memoId);
    }),
});
