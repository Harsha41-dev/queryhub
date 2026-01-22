// "What do you want to ask?" box at the top of the feed

import Link from "next/link";
import { useSession } from "next-auth/react";
import { MessageSquareText, PenLine } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export function FeedComposer({
  onAsk,
  publicMode,
}: {
  onAsk?: () => void;
  publicMode?: boolean;
}) {
  const { data: session } = useSession();
  const user = {
    name: session?.user?.name ?? (publicMode ? "Guest" : "QueryHub member"),
    avatar: session?.user?.image,
  };
  return (
    <section className="border-y bg-card p-4 shadow-card sm:rounded-xl sm:border">
      <div className="flex items-center gap-3">
        <Avatar src={user.avatar} name={user.name} />
        {publicMode ? (
          <Link
            href="/login"
            className="flex h-10 flex-1 items-center rounded-full border bg-muted/50 px-4 text-sm text-muted-foreground hover:bg-muted"
          >
            What do you want to know?
          </Link>
        ) : (
          <button
            onClick={onAsk}
            className="h-10 flex-1 rounded-full border bg-muted/50 px-4 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            What do you want to know?
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 divide-x">
        <button
          onClick={onAsk}
          className="flex items-center justify-center gap-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          <MessageSquareText className="size-4" /> Ask
        </button>
        <Link
          href={publicMode ? "/login" : "/answer"}
          className="flex items-center justify-center gap-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          <PenLine className="size-4" /> Answer
        </Link>
      </div>
    </section>
  );
}
