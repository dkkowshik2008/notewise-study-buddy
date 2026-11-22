import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  FileText,
  FileUp,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { analyzeNotes } from "@/lib/notes-analysis.functions";
import type { NotesAnalysis } from "@/lib/notes-analysis.schema";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 50;
const MAX_NOTE_CHARACTERS = 50_000;

type NavigationTarget = "notes" | "summary" | "quiz";

function scrollToSection(target: NavigationTarget) {
  document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function StudyBuddy() {
  const [pastedNotes, setPastedNotes] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfPages, setPdfPages] = useState(0);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<NotesAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const runAnalysis = useServerFn(analyzeNotes);

  const combinedNotes = useMemo(
    () => [pastedNotes.trim(), pdfText.trim()].filter(Boolean).join("\n\n"),
    [pastedNotes, pdfText],
  );
  const wordCount = useMemo(
    () => combinedNotes.match(/\S+/g)?.length ?? 0,
    [combinedNotes],
  );
  const canAnalyze = combinedNotes.length >= 20 && combinedNotes.length <= MAX_NOTE_CHARACTERS;
  const sourceCount = Number(pastedNotes.trim().length > 0) + Number(pdfText.length > 0);

  function resetQuiz() {
    setAnswers({});
    setQuizSubmitted(false);
  }

  function clearAnalysis() {
    setAnalysis(null);
    setAnalysisError("");
    resetQuiz();
  }

  function clearNotes() {
    setPastedNotes("");
    setPdfText("");
    setPdfName("");
    setPdfPages(0);
    setPdfError("");
    clearAnalysis();
  }

  function removeFile() {
    setPdfText("");
    setPdfName("");
    setPdfPages(0);
    setPdfError("");
    clearAnalysis();
  }

  async function readPdf(file: File) {
    setPdfError("");
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setPdfError("Choose a PDF file to add it to your notes.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setPdfError("This PDF is larger than 15 MB. Choose a smaller file or paste its text.");
      return;
    }

    setIsReadingPdf(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const header = new TextDecoder().decode(data.slice(0, 5));
      if (header !== "%PDF-") {
        setPdfError("This file does not look like a readable PDF. Try another file.");
        return;
      }

      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const loadingTask = pdfjs.getDocument({ data });
      const document = await loadingTask.promise;
      if (document.numPages > MAX_PDF_PAGES) {
        await loadingTask.destroy();
        setPdfError("This PDF has more than 50 pages. Choose a shorter file or paste selected text.");
        return;
      }

      const pageText: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const text = await page.getTextContent();
        pageText.push(text.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      }
      await loadingTask.destroy();

      const extractedText = pageText.join("\n\n").replace(/\s+/g, " ").trim();
      if (extractedText.length < 20) {
        setPdfError("No readable text was found. This PDF may be scanned; paste the text instead.");
        return;
      }
      if (extractedText.length > MAX_NOTE_CHARACTERS) {
        setPdfError("This PDF contains too much text. Choose a shorter section or paste selected notes.");
        return;
      }

      setPdfText(extractedText);
      setPdfName(file.name);
      setPdfPages(document.numPages);
      clearAnalysis();
    } catch {
      setPdfError("Could not read this PDF. Try another file or paste the notes instead.");
    } finally {
      setIsReadingPdf(false);
    }
  }

  async function handleAnalyze() {
    if (!canAnalyze || isAnalyzing) return;
    setAnalysisError("");
    setIsAnalyzing(true);
    try {
      const result = await runAnalysis({ data: { notes: combinedNotes } });
      if (!result.success) {
        setAnalysis(null);
        setAnalysisError(result.error);
        return;
      }
      setAnalysis(result.data);
      resetQuiz();
    } catch {
      setAnalysisError("Could not reach Gemini. Check your connection and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function updatePastedNotes(value: string) {
    setPastedNotes(value);
    clearAnalysis();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) void readPdf(file);
  }

  const navItems: { label: string; target: NavigationTarget; disabled?: boolean }[] = [
    { label: "My notes", target: "notes" },
    { label: "Summary", target: "summary", disabled: !analysis },
    { label: "Quiz", target: "quiz", disabled: !analysis },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-10 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <BookOpenCheck aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="font-display text-base font-semibold leading-tight text-sidebar-foreground">
              Study Buddy
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Notes to quiz</p>
          </div>
        </div>

        <div className="mb-3 mt-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </div>
        <nav aria-label="Study workspace" className="flex flex-col gap-1">
          {navItems.map((item, index) => (
            <Button
              key={item.target}
              variant="ghost"
              disabled={item.disabled}
              onClick={() => scrollToSection(item.target)}
              className={`h-10 justify-start px-3 ${index === 0 ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75"}`}
            >
              {index === 0 ? (
                <FileText aria-hidden="true" />
              ) : index === 1 ? (
                <Lightbulb aria-hidden="true" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="mt-auto border-t border-sidebar-border pt-5">
          <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground">
            <LockKeyhole aria-hidden="true" className="size-4 text-primary" />
            Session-only notes
          </div>
          <p className="mt-2 pl-6 text-xs leading-relaxed text-muted-foreground">
            Notes are not saved to an account.
          </p>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
            <div className="flex items-center gap-2 lg:hidden">
              <BookOpenCheck aria-hidden="true" className="size-5 text-primary" />
              <span className="font-display text-sm font-semibold">Study Buddy</span>
            </div>
            <nav aria-label="Page sections" className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {navItems.map((item) => (
                <Button
                  key={item.target}
                  variant="ghost"
                  size="sm"
                  disabled={item.disabled}
                  onClick={() => scrollToSection(item.target)}
                  className="shrink-0 text-muted-foreground"
                >
                  {item.label}
                </Button>
              ))}
            </nav>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              No sign-in required
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-7 sm:pt-10 lg:px-10">
          <section id="notes" className="scroll-mt-24">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles aria-hidden="true" className="size-4" />
                  YOUR STUDY SPACE
                </p>
                <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
                  Make your notes memorable.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Bring your class notes in. Leave with the key ideas and a quiz to practice.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={clearNotes}
                disabled={!combinedNotes && !analysis && !pdfError && !analysisError}
                className="shrink-0"
              >
                <X aria-hidden="true" />
                Clear Notes
              </Button>
            </div>

            <div className="grid gap-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(250px,0.75fr)] xl:gap-10">
              <div className="rounded-md border border-border bg-card p-4 shadow-sm sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Your study material</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Paste notes or add a PDF.</p>
                  </div>
                  <span className="rounded-sm bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {wordCount} {wordCount === 1 ? "word" : "words"}
                  </span>
                </div>

                <textarea
                  aria-label="Study notes"
                  value={pastedNotes}
                  onChange={(event) => updatePastedNotes(event.currentTarget.value)}
                  maxLength={MAX_NOTE_CHARACTERS}
                  placeholder="Paste your lecture, textbook excerpt, or revision notes here…"
                  className="min-h-56 w-full resize-y rounded-sm border border-input bg-background px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground/75 sm:min-h-64"
                />
                <div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
                  <span>{combinedNotes.length.toLocaleString()} / {MAX_NOTE_CHARACTERS.toLocaleString()} characters</span>
                  <span>20 characters minimum</span>
                </div>

                <div
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`mt-5 flex flex-col items-start justify-between gap-4 rounded-sm border border-dashed px-4 py-4 sm:flex-row sm:items-center ${isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/35"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-background text-primary">
                      {isReadingPdf ? (
                        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
                      ) : (
                        <FileUp aria-hidden="true" className="size-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{pdfName || "Add a PDF"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isReadingPdf
                          ? "Extracting text in this browser…"
                          : pdfName
                            ? `${pdfPages} ${pdfPages === 1 ? "page" : "pages"} · ${pdfText.length.toLocaleString()} characters extracted`
                            : "Up to 15 MB and 50 pages"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pdfName ? (
                      <Button type="button" variant="outline" size="sm" onClick={removeFile}>
                        <X aria-hidden="true" />
                        Remove File
                      </Button>
                    ) : null}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      aria-label="Choose PDF file"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.item(0) ?? null;
                        event.currentTarget.value = "";
                        if (file) void readPdf(file);
                      }}
                    />
                    {!pdfName ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isReadingPdf}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp aria-hidden="true" />
                        Choose PDF
                      </Button>
                    ) : null}
                  </div>
                </div>

                {pdfError ? (
                  <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {pdfError}
                  </p>
                ) : null}
                {combinedNotes.length > MAX_NOTE_CHARACTERS ? (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    Shorten the material to 50,000 characters before analyzing.
                  </p>
                ) : null}

                <div className="mt-5 flex flex-col items-start justify-between gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
                  <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                    Your notes stay in this session and are sent to Gemini only when you analyze.
                  </p>
                  <Button type="button" onClick={() => void handleAnalyze()} disabled={!canAnalyze || isReadingPdf || isAnalyzing}>
                    {isAnalyzing ? (
                      <LoaderCircle aria-hidden="true" className="animate-spin" />
                    ) : (
                      <Sparkles aria-hidden="true" />
                    )}
                    {isAnalyzing ? "Analyzing…" : analysis ? "Analyze Again" : "Analyze Notes"}
                    {!isAnalyzing ? <ArrowUpRight aria-hidden="true" /> : null}
                  </Button>
                </div>
                {combinedNotes.length > 0 && combinedNotes.length < 20 ? (
                  <p className="mt-3 text-right text-xs text-muted-foreground">
                    Add a little more detail to start your analysis.
                  </p>
                ) : null}
              </div>

              <aside className="flex flex-col justify-between border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SESSION SNAPSHOT</p>
                  <h2 className="mt-3 font-display text-xl font-semibold">A focused start</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Everything you need for one study session, right here.
                  </p>
                  <dl className="mt-7 divide-y divide-border border-y border-border">
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-sm text-muted-foreground">Sources added</dt>
                      <dd className="text-sm font-semibold tabular-nums">{sourceCount}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-sm text-muted-foreground">Summary points</dt>
                      <dd className="text-sm font-semibold tabular-nums">{analysis ? analysis.summary.length : "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-sm text-muted-foreground">Practice questions</dt>
                      <dd className="text-sm font-semibold tabular-nums">{analysis ? analysis.quiz.length : "—"}</dd>
                    </div>
                  </dl>
                </div>
                <div className="mt-7 flex items-start gap-3 rounded-sm bg-accent/20 p-4">
                  <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
                  <p className="text-xs leading-relaxed text-accent-foreground">
                    A few clear ideas beat a whole chapter at once. Start with the notes you want to remember.
                  </p>
                </div>
              </aside>
            </div>

            {analysisError ? (
              <div role="alert" className="mt-6 flex items-start gap-3 rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p>{analysisError}</p>
              </div>
            ) : null}
          </section>

          {isAnalyzing ? (
            <div aria-live="polite" className="mt-10 flex items-center gap-3 border-y border-border py-8 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
              Gemini is turning your notes into a study set…
            </div>
          ) : null}

          {analysis ? (
            <div className="mt-12 space-y-12">
              <section id="summary" className="scroll-mt-24">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">YOUR STUDY SET</p>
                    <h2 className="font-display text-2xl font-semibold sm:text-3xl">The big picture</h2>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void handleAnalyze()} disabled={isAnalyzing || !canAnalyze}>
                    <RotateCcw aria-hidden="true" />
                    Analyze Again
                  </Button>
                </div>

                <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)] lg:gap-14">
                  <div>
                    <h3 className="mb-4 text-sm font-semibold">Key ideas</h3>
                    <ol className="space-y-3">
                      {analysis.summary.map((point, index) => (
                        <li key={`${index}-${point}`} className="flex gap-3 text-sm leading-relaxed sm:text-base">
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {index + 1}
                          </span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    <div className="mb-4 flex items-center gap-2">
                      <Lightbulb aria-hidden="true" className="size-4 text-accent-foreground" />
                      <h3 className="text-sm font-semibold">Key terms</h3>
                    </div>
                    <dl className="divide-y divide-border">
                      {analysis.keyTerms.map((item, index) => (
                        <div key={`${item.term}-${index}`} className="py-3 first:pt-0 last:pb-0">
                          <dt className="text-sm font-semibold">{item.term}</dt>
                          <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.meaning}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </section>

              <section id="quiz" className="scroll-mt-24">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">CHECK YOUR RECALL</p>
                    <h2 className="font-display text-2xl font-semibold sm:text-3xl">Practice quiz</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{analysis.quiz.length} questions · choose one answer each</p>
                  </div>
                  {quizSubmitted ? (
                    <Button type="button" variant="outline" onClick={resetQuiz}>
                      <RotateCcw aria-hidden="true" />
                      Try Again
                    </Button>
                  ) : null}
                </div>

                {quizSubmitted ? (
                  <div aria-live="polite" className="mb-6 flex flex-col gap-3 border-l-4 border-primary bg-primary/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-display text-xl font-semibold">
                        {analysis.quiz.reduce(
                          (score, question, index) => score + Number(answers[index] === question.correctOptionIndex),
                          0,
                        )} / {analysis.quiz.length} correct
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">Review the explanations below and give it another go.</p>
                    </div>
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                      {analysis.quiz.map((question, index) => (
                        <span
                          key={question.question}
                          className={`size-2.5 rounded-full ${answers[index] === question.correctOptionIndex ? "bg-primary" : "bg-destructive"}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {analysis.quiz.map((question, questionIndex) => (
                    <fieldset key={`${questionIndex}-${question.question}`} className="rounded-md border border-border bg-card p-4 sm:p-5">
                      <legend className="sr-only">Question {questionIndex + 1}</legend>
                      <div className="flex gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-secondary text-xs font-semibold text-secondary-foreground">
                          {String(questionIndex + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-relaxed">{question.question}</p>
                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {question.options.map((option, optionIndex) => {
                              const isSelected = answers[questionIndex] === optionIndex;
                              const isCorrect = question.correctOptionIndex === optionIndex;
                              const showCorrect = quizSubmitted && isCorrect;
                              const showIncorrect = quizSubmitted && isSelected && !isCorrect;
                              return (
                                <label
                                  key={`${optionIndex}-${option}`}
                                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-sm border px-3 py-2.5 text-sm leading-relaxed transition-colors ${
                                    showCorrect
                                      ? "border-primary bg-primary/5"
                                      : showIncorrect
                                        ? "border-destructive/50 bg-destructive/5"
                                        : isSelected
                                          ? "border-primary bg-primary/5"
                                          : "border-border bg-background hover:border-primary/50"
                                  } ${quizSubmitted ? "cursor-default" : ""}`}
                                >
                                  <input
                                    type="radio"
                                    name={`question-${questionIndex}`}
                                    value={optionIndex}
                                    checked={isSelected}
                                    disabled={quizSubmitted}
                                    onChange={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}
                                    className="mt-0.5 size-4 shrink-0 accent-primary"
                                  />
                                  <span className="min-w-0 flex-1">{option}</span>
                                  {showCorrect ? <Check aria-label="Correct answer" className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
                                  {showIncorrect ? <X aria-label="Your answer" className="mt-0.5 size-4 shrink-0 text-destructive" /> : null}
                                </label>
                              );
                            })}
                          </div>
                          {quizSubmitted ? (
                            <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
                              <span className="font-semibold text-foreground">Why: </span>
                              {question.explanation}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </fieldset>
                  ))}
                </div>

                {!quizSubmitted ? (
                  <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      onClick={() => setQuizSubmitted(true)}
                      disabled={analysis.quiz.some((_, index) => answers[index] === undefined)}
                    >
                      <CheckCircle2 aria-hidden="true" />
                      Submit Answers
                    </Button>
                    <p className="text-xs text-muted-foreground">Answer all five questions to see your score.</p>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}