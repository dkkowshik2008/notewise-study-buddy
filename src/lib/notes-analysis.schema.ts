import { z } from "zod";

const conciseText = z.string().trim().min(1).max(400);

export const notesAnalysisInputSchema = z.object({
  notes: z.string().trim().min(20).max(50_000),
});

export const notesAnalysisSchema = z.object({
  summary: z.array(conciseText).min(5).max(6),
  quiz: z
    .array(
      z.object({
        question: conciseText,
        options: z
          .tuple([conciseText, conciseText, conciseText, conciseText])
          .refine((options) => new Set(options).size === 4),
        correctOptionIndex: z.number().int().min(0).max(3),
        explanation: conciseText,
      }),
    )
    .length(5),
  keyTerms: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(80),
        meaning: z.string().trim().min(1).max(400),
      }),
    )
    .length(3),
});

export type NotesAnalysis = z.infer<typeof notesAnalysisSchema>;