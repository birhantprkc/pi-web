import { html, svg, type TemplateResult } from "lit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PiWebComponentStatus, PiWebStatusResponse, PluginRuntimeState, WorkspacePanelContext, WorkspacePanelContribution, WorkspacePanelTerminal } from "@jmfederico/pi-web/plugin-api";
import plugin from "./pi-web-plugin";

function isTemplateResult(value: unknown): value is TemplateResult {
  return typeof value === "object" && value !== null && "_$litType$" in value;
}

function isFunction(value: unknown): value is () => void {
  return typeof value === "function";
}

// The repo runs vitest in plain Node (no DOM), so instead of mounting the
// template we walk the lit TemplateResult tree to collect its rendered text
// and any event-handler functions.
function walk(node: unknown, text: string[], handlers: (() => void)[]): void {
  if (isFunction(node)) {
    handlers.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) walk(child, text, handlers);
    return;
  }
  if (isTemplateResult(node)) {
    for (const piece of node.strings) text.push(piece);
    for (const value of node.values) walk(value, text, handlers);
    return;
  }
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    text.push(String(node));
  }
}

function rendered(template: TemplateResult): { text: string; handlers: (() => void)[] } {
  const text: string[] = [];
  const handlers: (() => void)[] = [];
  walk(template, text, handlers);
  return { text: text.join(" "), handlers };
}

function badgeText(value: string | number | TemplateResult | undefined): string {
  if (value === undefined) return "";
  if (isTemplateResult(value)) return rendered(value).text;
  return String(value);
}

function updatesPanel(): WorkspacePanelContribution {
  const result = plugin.activate({ apiVersion: 1, pluginId: "updates", html, svg });
  const panel = result.contributions.workspacePanels?.[0];
  if (panel === undefined) throw new Error("Updates plugin did not contribute a workspace panel");
  return panel;
}

function component(overrides: Partial<PiWebComponentStatus> = {}): PiWebComponentStatus {
  return {
    component: "web",
    label: "Web/UI",
    runtimeVersion: "1.202605.8",
    installedVersion: "1.202605.8",
    stale: false,
    available: true,
    ...overrides,
  };
}

function status(overrides: Partial<PiWebStatusResponse> = {}): PiWebStatusResponse {
  return {
    packageName: "@jmfederico/pi-web",
    generatedAt: "2026-06-14T00:00:00.000Z",
    components: {
      web: component({ component: "web", label: "Web/UI" }),
      sessiond: component({ component: "sessiond", label: "Session daemon" }),
    },
    release: { packageName: "@jmfederico/pi-web", updateAvailable: false },
    commands: {},
    messages: [],
    ...overrides,
  };
}

function noopTerminal(): WorkspacePanelTerminal {
  return { open: vi.fn(), runCommand: vi.fn().mockResolvedValue({}) };
}

function contextFor(state: PluginRuntimeState | undefined, terminal: WorkspacePanelTerminal = noopTerminal()): WorkspacePanelContext {
  return {
    machine: { id: "local", name: "Local", kind: "local" },
    workspace: { id: "ws", projectId: "p", path: "/tmp/ws", label: "ws", isMain: true, isGitRepo: false, isGitWorktree: false },
    ...(state === undefined ? {} : { state }),
    files: { readFile: vi.fn() },
    host: { requestRender: vi.fn() },
    terminal,
  };
}

describe("Updates plugin panel", () => {
  it("contributes a single Updates workspace panel", () => {
    const panel = updatesPanel();
    expect(panel.id).toBe("workspace.updates");
    expect(panel.title).toBe("Updates");
  });

  it("shows a checking placeholder before status is available", () => {
    const { text } = rendered(updatesPanel().render(contextFor(undefined)));
    expect(text).toContain("Checking PI WEB update status");
  });

  it("renders installed services and commands without throwing", () => {
    const value = status({
      release: { packageName: "@jmfederico/pi-web", updateAvailable: true },
      commands: { update: "pi-web update && pi-web restart", status: "pi-web status" },
    });
    const { text } = rendered(updatesPanel().render(contextFor({ piWebStatus: value })));
    expect(text).toContain("Installed services");
    expect(text).toContain("Recommended");
    expect(text).toContain("Copy");
  });

  describe("with a terminal", () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

    beforeEach(() => {
      Object.defineProperty(globalThis, "navigator", {
        value: { clipboard: { writeText: vi.fn() } },
        configurable: true,
      });
    });

    afterEach(() => {
      if (originalNavigator === undefined) Reflect.deleteProperty(globalThis, "navigator");
      else Object.defineProperty(globalThis, "navigator", originalNavigator);
    });

    it("renders Run actions and wires them to the terminal with plugin metadata", () => {
      const runCommand = vi.fn().mockResolvedValue({});
      const terminal: WorkspacePanelTerminal = { open: vi.fn(), runCommand };
      const value = status({
        release: { packageName: "@jmfederico/pi-web", updateAvailable: true },
        commands: { update: "pi-web update && pi-web restart" },
      });

      const { text, handlers } = rendered(updatesPanel().render(contextFor({ piWebStatus: value }, terminal)));
      expect(text).toContain(">Run<");

      for (const handler of handlers) handler();

      expect(runCommand).toHaveBeenCalledWith(expect.objectContaining({
        command: "pi-web update && pi-web restart",
        open: true,
        metadata: { "pi.plugin": "updates" },
      }));
    });
  });

  describe("visibility and badge", () => {
    it("is hidden for managed installs with no messages and visible for local installs", () => {
      const panel = updatesPanel();
      const managed = status({
        components: {
          web: component({ installation: { kind: "pi-package" } }),
          sessiond: component({ component: "sessiond", label: "Session daemon", installation: { kind: "npm-global" } }),
        },
      });
      const local = status({
        components: {
          web: component({ installation: { kind: "local" } }),
          sessiond: component({ component: "sessiond", label: "Session daemon", installation: { kind: "pi-package" } }),
        },
      });
      expect(panel.visible?.(contextFor({ piWebStatus: managed }))).toBe(false);
      expect(panel.visible?.(contextFor({ piWebStatus: local }))).toBe(true);
    });

    it("marks the badge beta and appends the message count", () => {
      const panel = updatesPanel();
      expect(badgeText(panel.badge?.(contextFor({ piWebStatus: status() })))).toContain("beta");

      const withMessages = badgeText(panel.badge?.(contextFor({ piWebStatus: status({ messages: [{ id: "a", severity: "warning", title: "t", body: "b" }] }) })));
      expect(withMessages).toContain("beta");
      expect(withMessages).toContain("1");
    });
  });
});
