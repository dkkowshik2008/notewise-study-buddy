import { describe, expect, it } from "vitest";

import { notesAnalysisSchema } from "@/lib/notes-analysis.schema";

function makeStudySet() {
  return {
    summary: Array.from({ length: 5 }, (_, index) => `Key idea ${index + 1}`),
    quiz: Array.from({ length: 5 }, (_, index) => ({
      question: `Question ${index + 1}?`,
      options: ["First", "Second", "Third", "Fourth"],
      correctOptionIndex: 1,
      explanation: "The notes support the second option.",
    })),
    keyTerms: [
      { term: "Term one", meaning: "A simple meaning." },
      { term: "Term two", meaning: "Another simple meaning." },
      { term: "Term three", meaning: "A third simple meaning." },
    ],
  };
}

describe("study set output rules", () => {
  it("requires 5–6 summary bullet points", () => {
    const five = makeStudySet();
    const six = { ...five, summary: [...five.summary, "Key idea 6"] };
    const four = { ...five, summary: five.summary.slice(0, 4) };
    const seven = { ...six, summary: [...six.summary, "Key idea 7"] };

    expect(notesAnalysisSchema.safeParse(five).success).toBe(true);
    expect(notesAnalysisSchema.safeParse(six).success).toBe(true);
    expect(notesAnalysisSchema.safeParse(four).success).toBe(false);
    expect(notesAnalysisSchema.safeParse(seven).success).toBe(false);
  });

  it("requires exactly 5 multiple-choice questions with 4 options, an answer, and an explanation", () => {
    const studySet = makeStudySet();
    const fourQuestions = { ...studySet, quiz: studySet.quiz.slice(0, 4) };
    const threeOptions = makeStudySet();
    threeOptions.quiz[0] = {
      ...threeOptions.quiz[0],
      options: ["First", "Second", "Third"],
    };
    const invalidAnswer = makeStudySet();
    invalidAnswer.quiz[0] = { ...invalidAnswer.quiz[0], correctOptionIndex: 4 };
    const missingExplanation = makeStudySet();
    missingExplanation.quiz[0] = { ...missingExplanation.quiz[0], explanation: "" };

    expect(notesAnalysisSchema.safeParse(studySet).success).toBe(true);
    expect(notesAnalysisSchema.safeParse(fourQuestions).success).toBe(false);
    expect(notesAnalysisSchema.safeParse(threeOptions).success).toBe(false);
    expect(notesAnalysisSchema.safeParse(invalidAnswer).success).toBe(false);
    expect(notesAnalysisSchema.safeParse(missingExplanation).success).toBe(false);
  });

  it("requires exactly 3 key terms with simple meanings", () => {
    const three = makeStudySet();
    const two = { ...three, keyTerms: three.keyTerms.slice(0, 2) };
    const four = { ...three, keyTerms: [...three.keyTerms, { term: "Term four", meaning: "Another meaning." }] };

    expect(notesAnalysisSchema.safeParse(three).success).toBe(true);
    expect(notesAnalysisSchema.safeParse(two).success).toBe(false);
    expect(notesAnalysisSchema.safeParse(four).success).toBe(false);
  });
});