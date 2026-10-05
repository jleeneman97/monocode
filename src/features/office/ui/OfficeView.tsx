import { useEffect, useMemo, useState } from "react";
import { IS_MAC } from "../../../platform/tauri/platform";
import { OverlayNav } from "../../../app/shell/TitleBar";
import { WindowControls } from "../../../app/shell/WindowControls";
import { Office } from "../../../shared/ui/icons";
import { projectKey, projectName } from "../../../shared/lib/paths";
import {
  projectRailItems,
  subscribeProjectPathsChanged,
  type RecentProject,
} from "../../projects/model/recents";
import {
  loadProjectGroupAssignments,
  loadProjectGroups,
  projectGroupColor,
} from "../../projects/model/projectGroups";
import {
  loadTabGroupColors,
  loadTabGroupCustomColors,
  loadTabGroupLabels,
  loadTabGroupMascots,
  resolveTabGroupColor,
  resolveTabGroupLabel,
  resolveTabGroupMascot,
  usesAutomaticTabGroupColor,
} from "../../workspace/model/tabGroups";
import {
  mascotBodyColor,
  projectMascot,
} from "../../projects/model/projectMascots";
import type { Session } from "../../sessions/model/session";
import type { ProjectUnread } from "../../sessions/model/projectUnread";
import { buildOfficeZones, type OfficeZone } from "../model/officeState";
import { OfficeFloor } from "./OfficeFloor";

type Props = {
  besideRail?: boolean;
  compactRail?: boolean;
  cwd: string;
  recents: RecentProject[];
  sessions: Session[];
  unseenFinishedIds: ReadonlySet<string>;
  projectUnread?: ReadonlyMap<string, ProjectUnread>;
  onClose: () => void;
  onToggleSidebar?: () => void;
  onOpenSession: (sessionId: string) => void;
  onOpenProject: (path: string) => void;
};

/** A live, illustrated view of every project's agents at their desks. */
export function OfficeView({
  besideRail = false,
  compactRail = false,
  cwd,
  recents,
  sessions,
  unseenFinishedIds,
  projectUnread,
  onClose,
  onToggleSidebar,
  onOpenSession,
  onOpenProject,
}: Props) {
  // Groups, names, and colors live in storage; rebuild when they change.
  const [revision, setRevision] = useState(0);
  useEffect(
    () => subscribeProjectPathsChanged(() => setRevision((value) => value + 1)),
    [],
  );

  const zones = useMemo<OfficeZone[]>(() => {
    const labels = loadTabGroupLabels();
    const colors = loadTabGroupColors();
    const customColors = loadTabGroupCustomColors();
    const mascots = loadTabGroupMascots();
    return buildOfficeZones({
      projects: projectRailItems(recents, cwd),
      groups: loadProjectGroups(),
      assignments: loadProjectGroupAssignments(),
      sessions,
      unseenFinishedIds,
      unread: projectUnread,
      appearance: (path) => {
        const key = projectKey(path);
        const name = projectName(path);
        const color = resolveTabGroupColor(key, colors, customColors, name);
        const mascot = projectMascot(name, resolveTabGroupMascot(key, mascots));
        // A monkey mascot sends a monkey to the desk, furred like the mascot:
        // its own brown on the automatic color, the picked color otherwise.
        const monkeyFur =
          mascot.name === "monkey"
            ? usesAutomaticTabGroupColor(key, colors, customColors)
              ? mascotBodyColor("monkey")
              : color
            : undefined;
        return {
          name: resolveTabGroupLabel(key, labels, name),
          color,
          ...(monkeyFur ? { monkeyFur } : {}),
        };
      },
      groupColor: projectGroupColor,
    });
    // `revision` re-reads storage after a rename, regroup, or recolor.
  }, [cwd, recents, sessions, unseenFinishedIds, projectUnread, revision]);

  const totals = useMemo(() => {
    let agents = 0;
    let updates = 0;
    let waiting = 0;
    for (const zone of zones) {
      for (const desk of zone.desks) {
        agents += desk.agents;
        updates += desk.updates;
        if (desk.status === "needs-input") waiting += 1;
      }
    }
    return { agents, updates, waiting };
  }, [zones]);


  return (
    <div
      role="region"
      aria-label="Office"
      data-app-office
      className="flex min-h-0 min-w-0 flex-1 flex-col text-content"
    >
      <div
        className="flex h-10 shrink-0 select-none items-center border-b border-stroke"
        data-tauri-drag-region="deep"
      >
        {IS_MAC && compactRail ? <div className="w-4 shrink-0" /> : null}
        {IS_MAC && !besideRail ? <div className="w-[78px] shrink-0" /> : null}
        {besideRail ? null : (
          <OverlayNav onBack={onClose} onToggleSidebar={onToggleSidebar} />
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-[13px]">
          <Office className="size-3.5 shrink-0 text-content/45" strokeWidth={1.75} />
          <span className="min-w-0 truncate text-content">Office</span>
          <span className="ml-2 flex min-w-0 items-center gap-3 truncate text-[12px] text-content/50">
            <Stat color="bg-emerald-400" value={totals.agents} label={totals.agents === 1 ? "agent at work" : "agents at work"} />
            {totals.waiting ? (
              <Stat color="bg-amber-400" value={totals.waiting} label="waiting on you" />
            ) : null}
            {totals.updates ? (
              <Stat color="bg-sky-400" value={totals.updates} label={totals.updates === 1 ? "new update" : "new updates"} />
            ) : null}
          </span>
        </div>
        {IS_MAC ? null : <WindowControls />}
      </div>
      {zones.length ? (
        <OfficeFloor
          zones={zones}
          onOpenSession={onOpenSession}
          onOpenProject={onOpenProject}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-content/50">
          Open a project and its desk will appear here.
        </div>
      )}
    </div>
  );
}

function Stat({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={`size-1.5 rounded-full ${color}`} />
      <span className="tabular-nums text-content/75">{value}</span>
      {label}
    </span>
  );
}
