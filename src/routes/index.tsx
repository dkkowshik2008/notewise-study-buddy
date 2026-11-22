import { createFileRoute } from "@tanstack/react-router";
import { StudyBuddy } from "@/components/study-buddy";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Study Buddy — Notes to Quiz" },
      {
        name: "description",
        content: "Turn class notes into a clear summary, key terms, and a five-question practice quiz.",
      },
      { property: "og:title", content: "AI Study Buddy — Notes to Quiz" },
      {
        property: "og:description",
        content: "Turn class notes into a clear summary, key terms, and a five-question practice quiz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyBuddy,
});
