import { pathKey } from "../../../shared/lib/paths";
import { isInFlightSession } from "./inFlight";
import { sessionNeedsInput, type Session } from "./session";

/**
 * What a project's agents have left for the user: finished replies nobody
 * has opened, and questions or approvals waiting on an answer.
 */
export type ProjectUnread = {
  replies: number;
  questions: number;
  /** replies + questions, for the round badge. */
  count: number;
  /** The conversation to open first: a question before a reply. */
  sessionId?: string;
};

type Summary = {
  id: string;
  cwd: string;
  archived?: boolean;
  orchestrationLeadId?: string;
};

/** Unread work per project, keyed by `pathKey` of the project path. */
export function projectUnreadCounts(
  sessions: Session[],
  unseenFinishedIds: ReadonlySet<string>,
  history: readonly Summary[] = [],
): Map<string, ProjectUnread> {
  const counts = new Map<string, ProjectUnread>();
  const entry = (cwd: string) => {
    const key = pathKey(cwd);
    let value = counts.get(key);
    if (!value) {
      value = { replies: 0, questions: 0, count: 0 };
      counts.set(key, value);
    }
    return value;
  };

  const live = new Set<string>();
  for (const session of sessions) {
    live.add(session.id);
    if (session.inboxAsk || session.orchestrationLeadId || !session.cwd) continue;
    if (sessionNeedsInput(session)) {
      const value = entry(session.cwd);
      value.questions += 1;
      value.count += 1;
      // The first question outranks any reply as the one to open.
      if (value.questions === 1) value.sessionId = session.id;
    } else if (unseenFinishedIds.has(session.id) && !isInFlightSession(session)) {
      const value = entry(session.cwd);
      value.replies += 1;
      value.count += 1;
      if (!value.questions) value.sessionId ??= session.id;
    }
  }
  // Conversations that finished after leaving every tab are no longer live,
  // but their summaries still say which project they belong to.
  for (const summary of history) {
    if (live.has(summary.id) || !unseenFinishedIds.has(summary.id)) continue;
    if (summary.archived || summary.orchestrationLeadId || !summary.cwd) continue;
    live.add(summary.id);
    const value = entry(summary.cwd);
    value.replies += 1;
    value.count += 1;
    if (!value.questions) value.sessionId ??= summary.id;
  }
  return counts;
}
