import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Perfect Spot — Our Private Space" },
      { name: "description", content: "A private space for memories, messages, dates, and moments together." },
      { property: "og:title", content: "Perfect Spot — Our Private Space" },
      { property: "og:description", content: "A private space for memories, messages, dates, and moments together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
