"use client";

import { useEffect, useState } from "react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { LeftSidebar } from "@/components/layout/left-sidebar";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { QuestionDialog } from "@/components/question/question-dialog";
import type { PersonSummary, TopicSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type SidebarData = { topics: TopicSummary[]; people: PersonSummary[] };

export function AppShell({
  children,
  rightSidebar = true,
  publicMode = false,
  wide = false,
}: {
  children: React.ReactNode;
  rightSidebar?: boolean;
  publicMode?: boolean;
  wide?: boolean;
}) {
  const [questionOpen, setQuestionOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sidebar, setSidebar] = useState<SidebarData>({
    topics: [],
    people: [],
  });
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/sidebar", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { ok?: boolean; data?: SidebarData }) => {
        if (payload.ok && payload.data) setSidebar(payload.data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (publicMode) return;
    const controller = new AbortController();
    void fetch("/api/notifications?count=1", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { ok?: boolean; data?: { unread?: number } }) =>
        setUnread(payload.data?.unread ?? 0),
      )
      .catch(() => undefined);
    const update = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "number")
        setUnread(event.detail);
    };
    window.addEventListener("queryhub:unread", update);
    return () => {
      controller.abort();
      window.removeEventListener("queryhub:unread", update);
    };
  }, [publicMode]);
  return (
    <div className="min-h-screen">
      <MobileHeader
        onAsk={() => setQuestionOpen(true)}
        publicMode={publicMode}
        unread={unread}
      />
      <div
        className={cn(
          "mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-0 pb-24 md:grid-cols-[220px_minmax(0,1fr)] md:px-4 md:pb-8 lg:px-6",
          rightSidebar && "xl:grid-cols-[220px_minmax(0,720px)_300px]",
          wide && "xl:grid-cols-[220px_minmax(0,1fr)]",
        )}
      >
        <LeftSidebar
          onAsk={() => setQuestionOpen(true)}
          publicMode={publicMode}
          unread={unread}
          topics={sidebar.topics}
        />
        <main id="main-content" className="min-w-0 py-0 md:py-6">
          {children}
        </main>
        {rightSidebar && <RightSidebar {...sidebar} />}
      </div>
      <BottomNav
        onAsk={() => setQuestionOpen(true)}
        publicMode={publicMode}
        unread={unread}
      />
      <QuestionDialog
        open={questionOpen}
        onClose={() => setQuestionOpen(false)}
        publicMode={publicMode}
      />
    </div>
  );
}
