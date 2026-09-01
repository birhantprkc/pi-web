import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "../appState";
import { browserErrorScopeKey, workspaceBrowserErrorScope } from "../browserErrors";
import { HttpRequestError } from "../api/http";
import { ServerNoticesController } from "../serverNotices";
import type { Workspace } from "../api";
import { PiWebApp } from "./PiWebApp";

const workspace: Workspace = {
  id: "workspace-1",
  projectId: "project-1",
  path: "/repo-feature",
  label: "feature",
  isMain: false,
  effectiveConfig: {},
};

function createApp(): PiWebApp {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  vi.stubGlobal("window", { location: { search: "" }, localStorage: storage });
  return new PiWebApp();
}

function appState(app: PiWebApp): AppState {
  const value: unknown = Reflect.get(app, "state");
  if (!isAppState(value)) throw new Error("PiWebApp state was unavailable");
  return value;
}

function setState(app: PiWebApp, patch: Partial<AppState>): AppState {
  const next: AppState = { ...appState(app), ...patch };
  if (!Reflect.set(app, "state", next)) throw new Error("Could not set PiWebApp state");
  return next;
}

type ReportWorkspaceRemovalFailure = (workspace: Workspace, machineId: string, scope: ReturnType<typeof workspaceBrowserErrorScope>, error: unknown) => Promise<void>;

function reportWorkspaceRemovalFailure(app: PiWebApp): ReportWorkspaceRemovalFailure {
  const method: unknown = Reflect.get(app, "reportWorkspaceRemovalFailure");
  if (!isReportWorkspaceRemovalFailure(method)) throw new Error("Workspace removal failure boundary was unavailable");
  return (workspace, machineId, scope, error) => method.call(app, workspace, machineId, scope, error);
}

function isReportWorkspaceRemovalFailure(value: unknown): value is ReportWorkspaceRemovalFailure {
  return typeof value === "function";
}

function isAppState(value: unknown): value is AppState {
  return typeof value === "object" && value !== null && "browserErrors" in value;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PiWebApp workspace removal browser error boundary", () => {
  it("does not add a browser fallback when a matching server notice is fresh", async () => {
    const app = createApp();
    setState(app, { selectedWorkspace: workspace });
    const noticesValue: unknown = Reflect.get(app, "serverNotices");
    if (!(noticesValue instanceof ServerNoticesController)) throw new Error("Server notices controller was unavailable");
    const notices = noticesValue;
    vi.spyOn(notices, "hasNotice").mockReturnValue(true);
    const scope = workspaceBrowserErrorScope("local", workspace.projectId, workspace.id);

    await reportWorkspaceRemovalFailure(app)(workspace, "local", scope, new HttpRequestError("workspace has unsubmitted changes", 400));

    expect(appState(app).browserErrors).toEqual({});
  });

  it("uses the browser fallback when a server response has no matching notice", async () => {
    const app = createApp();
    setState(app, { selectedWorkspace: workspace });
    const noticesValue: unknown = Reflect.get(app, "serverNotices");
    if (!(noticesValue instanceof ServerNoticesController)) throw new Error("Server notices controller was unavailable");
    const notices = noticesValue;
    const hasNotice = vi.spyOn(notices, "hasNotice").mockReturnValue(false);
    const refresh = vi.spyOn(notices, "refresh").mockResolvedValue();
    const scope = workspaceBrowserErrorScope("local", workspace.projectId, workspace.id);

    await reportWorkspaceRemovalFailure(app)(workspace, "local", scope, new HttpRequestError("workspace confirmation is stale", 409));

    expect(appState(app).browserErrors[browserErrorScopeKey(scope)]?.message).toBe("Failed to start workspace removal: workspace confirmation is stale");
    expect(hasNotice).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledWith("local");
  });

  it("keeps browser feedback for the gateway's session-daemon-unavailable response", async () => {
    const app = createApp();
    setState(app, { selectedWorkspace: workspace });
    const noticesValue: unknown = Reflect.get(app, "serverNotices");
    if (!(noticesValue instanceof ServerNoticesController)) throw new Error("Server notices controller was unavailable");
    const notices = noticesValue;
    const hasNotice = vi.spyOn(notices, "hasNotice");
    const scope = workspaceBrowserErrorScope("local", workspace.projectId, workspace.id);

    await reportWorkspaceRemovalFailure(app)(workspace, "local", scope, new HttpRequestError("Session daemon unavailable: connection refused", 502));

    expect(appState(app).browserErrors[browserErrorScopeKey(scope)]?.message).toBe("Failed to start workspace removal: Session daemon unavailable: connection refused");
    expect(hasNotice).not.toHaveBeenCalled();
  });
});
