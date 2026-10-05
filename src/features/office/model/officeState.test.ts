import { describe, expect, it } from "vitest";
import type { Block, Session } from "../../sessions/model/session";
import { agentPhase, buildOfficeZones, officeStatusLabel } from "./officeState";

function session(id: string, cwd: string, extra: Partial<Session> = {}): Session {
  return {
    id,
    harness: "claude",
    title: id,
    cwd,
    blocks: [],
    ...extra,
  } as Session;
}

const user: Block = { id: "u", role: "user", text: "go", startedAt: 1 };

function zones(sessions: Session[], unseen: string[] = []) {
  return buildOfficeZones({
    projects: [{ path: "/work/shop" }, { path: "/work/blog" }, { path: "/work/api" }],
    groups: [{ id: "g1", name: "Clients" }],
    assignments: { "/work/shop": "g1" },
    sessions,
    unseenFinishedIds: new Set(unseen),
    appearance: (path) => ({ color: path === "/work/shop" ? "#ff0000" : "#00ff00" }),
    groupColor: () => "#0000ff",
  });
}

describe("agentPhase", () => {
  it("thinks until the turn shows a tool call or reply text", () => {
    expect(agentPhase(session("a", "/w", { busy: true, blocks: [user] }))).toBe("thinking");
    expect(
      agentPhase(
        session("a", "/w", {
          busy: true,
          blocks: [user, { id: "r", role: "reasoning", text: "hmm" }],
        }),
      ),
    ).toBe("thinking");
    expect(
      agentPhase(
        session("a", "/w", {
          busy: true,
          blocks: [user, { id: "t", role: "tool", text: "Read file" }],
        }),
      ),
    ).toBe("working");
  });

  it("needs input while a question or approval waits", () => {
    expect(
      agentPhase(
        session("a", "/w", {
          busy: true,
          blocks: [
            user,
            { id: "p", role: "approval", text: "Run?", approval: { requestId: 1 } } as Block,
          ],
        }),
      ),
    ).toBe("needs-input");
  });
});

describe("buildOfficeZones", () => {
  it("groups desks like the project rail and leaves idle desks offline", () => {
    const result = zones([]);
    expect(result.map((zone) => [zone.name, zone.desks.map((desk) => desk.name)])).toEqual([
      ["Clients", ["shop"]],
      ["Ungrouped", ["blog", "api"]],
    ]);
    expect(result.flatMap((zone) => zone.desks).every((desk) => desk.status === "offline")).toBe(true);
  });

  it("counts running agents and keeps the strongest status", () => {
    const desks = zones([
      session("a", "/work/shop", { busy: true, blocks: [user] }),
      session("b", "/work/shop", {
        busy: true,
        blocks: [user, { id: "t", role: "tool", text: "Edit" }],
      }),
      session("c", "/work/blog"),
    ]).flatMap((zone) => zone.desks);
    const shop = desks.find((desk) => desk.name === "shop")!;
    expect(shop).toMatchObject({ status: "working", agents: 2, sessionId: "b", color: "#ff0000" });
    expect(desks.find((desk) => desk.name === "blog")?.status).toBe("offline");
  });

  it("shows finished work nobody has opened as updates", () => {
    const desks = zones(
      [session("a", "/work/blog"), session("b", "/work/blog")],
      ["a", "b"],
    ).flatMap((zone) => zone.desks);
    const blog = desks.find((desk) => desk.name === "blog")!;
    expect(blog).toMatchObject({ status: "updates", updates: 2, agents: 0, sessionId: "a" });
    expect(officeStatusLabel(blog)).toBe("2 new updates");
  });

  it("keeps a worker at the desk for unread work from closed conversations", () => {
    const desks = buildOfficeZones({
      projects: [{ path: "/work/api" }, { path: "/work/blog" }],
      groups: [],
      assignments: {},
      sessions: [],
      unseenFinishedIds: new Set(["gone"]),
      unread: new Map([
        ["/work/api", { replies: 2, questions: 0, count: 2, sessionId: "gone" }],
      ]),
      appearance: () => ({ color: "#fff" }),
      groupColor: () => "#000",
    }).flatMap((zone) => zone.desks);
    expect(desks.find((desk) => desk.name === "api")).toMatchObject({
      status: "updates",
      updates: 2,
      unread: 2,
      sessionId: "gone",
    });
    expect(desks.find((desk) => desk.name === "blog")).toMatchObject({
      status: "offline",
      unread: 0,
    });
  });

  it("ignores inbox asks and orchestration workers", () => {
    const desks = zones([
      session("a", "/work/api", { busy: true, inboxAsk: {} as Session["inboxAsk"] }),
      session("b", "/work/api", { busy: true, orchestrationLeadId: "lead" } as Partial<Session>),
    ]).flatMap((zone) => zone.desks);
    expect(desks.find((desk) => desk.name === "api")?.status).toBe("offline");
  });
});
