import { describe, expect, it } from "vitest";
import type { Session } from "./session";
import { projectUnreadCounts } from "./projectUnread";

function session(id: string, cwd: string, extra: Partial<Session> = {}): Session {
  return { id, harness: "claude", title: id, cwd, blocks: [], ...extra } as Session;
}

describe("projectUnreadCounts", () => {
  it("counts unread replies and waiting questions per project", () => {
    const counts = projectUnreadCounts(
      [
        session("a", "/work/shop"),
        session("b", "/work/shop"),
        session("q", "/work/shop", {
          busy: true,
          pendingQuestion: { requestId: 1, title: "Which?", questions: [] } as unknown as Session["pendingQuestion"],
        }),
        session("busy", "/work/blog", { busy: true }),
        session("seen", "/work/blog"),
      ],
      new Set(["a", "b", "busy"]),
    );
    expect(counts.get("/work/shop")).toEqual({
      replies: 2,
      questions: 1,
      count: 3,
      sessionId: "q",
    });
    // A session still running is not unread yet, and a seen one never is.
    expect(counts.get("/work/blog")).toBeUndefined();
  });

  it("includes conversations that finished after leaving every tab", () => {
    const counts = projectUnreadCounts(
      [session("live", "/work/shop")],
      new Set(["live", "closed", "archived"]),
      [
        { id: "live", cwd: "/work/shop" },
        { id: "closed", cwd: "/work/api" },
        { id: "archived", cwd: "/work/api", archived: true },
        { id: "old", cwd: "/work/api" },
      ],
    );
    expect(counts.get("/work/shop")?.count).toBe(1);
    expect(counts.get("/work/api")).toEqual({
      replies: 1,
      questions: 0,
      count: 1,
      sessionId: "closed",
    });
  });

  it("skips inbox asks and orchestration workers", () => {
    const counts = projectUnreadCounts(
      [
        session("ask", "/work/shop", { inboxAsk: {} as Session["inboxAsk"] }),
        session("worker", "/work/shop", { orchestrationLeadId: "lead" } as Partial<Session>),
      ],
      new Set(["ask", "worker"]),
    );
    expect(counts.size).toBe(0);
  });
});
