import { pathKey, projectName } from "../../../shared/lib/paths";
import type { ProjectGroup } from "../../projects/model/projectGroups";
import { projectGroupIdForPath } from "../../projects/model/projectGroups";
import { isInFlightSession } from "../../sessions/model/inFlight";
import { liveAgentsFromSessions } from "../../sessions/model/liveAgents";
import type { Block, Session } from "../../sessions/model/session";

/**
 * What the office shows for one project's desk, strongest first: an agent
 * waiting on the user, agents at work, agents still thinking, finished work
 * nobody has opened yet, and an empty desk.
 */
export type OfficeDeskStatus =
  | "needs-input"
  | "working"
  | "thinking"
  | "updates"
  | "offline";

export type OfficeDesk = {
  key: string;
  path: string;
  name: string;
  color: string;
  status: OfficeDeskStatus;
  /** Agents with a turn in flight. */
  agents: number;
  /** Finished conversations the user has not opened since. */
  updates: number;
  /** What the most relevant agent is doing, for the desk's tooltip. */
  activity?: string;
  /** The conversation a click on the desk opens. */
  sessionId?: string;
};

export type OfficeZone = {
  id: string;
  name: string;
  color: string;
  desks: OfficeDesk[];
};

export const UNGROUPED_ZONE_ID = "ungrouped";

type AgentPhase = "needs-input" | "working" | "thinking";

/** Thinking until the turn shows its first tool call or reply text. */
export function agentPhase(session: Session): AgentPhase {
  if (
    session.pendingQuestion ||
    session.blocks.some((block) => block.approval && !block.approval.decided)
  ) {
    return "needs-input";
  }
  const turn = currentTurn(session.blocks);
  for (let i = turn.length - 1; i >= 0; i--) {
    const block = turn[i];
    if (block.role === "reasoning") return "thinking";
    if (block.role === "tool" || block.role === "approval") return "working";
    if (block.role === "assistant" && block.text.trim()) return "working";
  }
  return "thinking";
}

function currentTurn(blocks: Block[]): Block[] {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].role === "user") return blocks.slice(i + 1);
  }
  return blocks;
}

const PHASE_RANK: Record<AgentPhase, number> = {
  "needs-input": 3,
  working: 2,
  thinking: 1,
};

export type OfficeInput = {
  projects: { path: string }[];
  groups: ProjectGroup[];
  assignments: Record<string, string>;
  sessions: Session[];
  unseenFinishedIds: ReadonlySet<string>;
  /** Display name and color for a project path. */
  appearance: (path: string) => { name?: string; color: string };
  groupColor: (group: ProjectGroup) => string;
};

/** Desks per project, grouped the way the project rail groups them. */
export function buildOfficeZones(input: OfficeInput): OfficeZone[] {
  const desks = new Map<string, OfficeDesk>();
  for (const project of input.projects) {
    const key = pathKey(project.path);
    if (desks.has(key)) continue;
    const look = input.appearance(project.path);
    desks.set(key, {
      key,
      path: project.path,
      name: look.name || projectName(project.path),
      color: look.color,
      status: "offline",
      agents: 0,
      updates: 0,
    });
  }

  const activities = new Map(
    liveAgentsFromSessions(input.sessions, input.unseenFinishedIds).map(
      (agent) => [agent.id, agent.activity],
    ),
  );
  const best = new Map<string, { rank: number; startedAt: number }>();
  for (const session of input.sessions) {
    if (session.inboxAsk || session.orchestrationLeadId) continue;
    const desk = desks.get(pathKey(session.cwd));
    if (!desk) continue;
    if (isInFlightSession(session)) {
      desk.agents += 1;
      const phase = agentPhase(session);
      const rank = PHASE_RANK[phase];
      const startedAt = turnStart(session.blocks);
      const current = best.get(desk.key);
      if (
        !current ||
        rank > current.rank ||
        (rank === current.rank && startedAt < current.startedAt)
      ) {
        best.set(desk.key, { rank, startedAt });
        desk.status = phase;
        desk.activity = activities.get(session.id);
        desk.sessionId = session.id;
      }
    } else if (input.unseenFinishedIds.has(session.id)) {
      desk.updates += 1;
      if (desk.status === "offline" || desk.status === "updates") {
        desk.status = "updates";
        desk.sessionId ??= session.id;
        desk.activity ??= "Finished";
      }
    }
  }

  const zones: OfficeZone[] = input.groups.map((group) => ({
    id: group.id,
    name: group.name,
    color: input.groupColor(group),
    desks: [],
  }));
  const byId = new Map(zones.map((zone) => [zone.id, zone]));
  const ungrouped: OfficeZone = {
    id: UNGROUPED_ZONE_ID,
    name: zones.length ? "Ungrouped" : "Projects",
    color: "hsl(210 8% 58%)",
    desks: [],
  };
  for (const desk of desks.values()) {
    const groupId = projectGroupIdForPath(desk.path, input.assignments);
    const zone = (groupId && byId.get(groupId)) || ungrouped;
    zone.desks.push(desk);
  }
  return [...zones, ungrouped].filter((zone) => zone.desks.length > 0);
}

function turnStart(blocks: Block[]): number {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].role === "user") return blocks[i].startedAt ?? Infinity;
  }
  return Infinity;
}

/** Short label for the status bubble above a desk. */
export function officeStatusLabel(desk: OfficeDesk): string {
  switch (desk.status) {
    case "needs-input":
      return "Needs you";
    case "working":
      return "Working";
    case "thinking":
      return "Thinking";
    case "updates":
      return desk.updates === 1 ? "1 new update" : `${desk.updates} new updates`;
    case "offline":
      return "Offline";
  }
}
