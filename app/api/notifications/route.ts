// list notifications, or just unread count with ?count=1

import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/session";
import { actionError, actionSuccess } from "@/lib/errors";
import { getNotifications, getUnreadNotificationCount } from "@/lib/query-data";

export async function GET(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to view notifications."),
      { status: 401 },
    );
  // badge only needs the number
  if (new URL(request.url).searchParams.get("count") === "1") {
    const unread = await getUnreadNotificationCount(session.user.id);
    return NextResponse.json(actionSuccess({ unread }));
  }
  const [items, unread] = await Promise.all([
    getNotifications(session.user.id),
    getUnreadNotificationCount(session.user.id),
  ]);
  return NextResponse.json(actionSuccess({ items, unread }));
}
