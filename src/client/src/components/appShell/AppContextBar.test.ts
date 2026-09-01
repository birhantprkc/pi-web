// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import type { Machine } from "../../api";
import { AppContextBar, machineContextDetail } from "./AppContextBar";

afterEach(() => {
  document.body.replaceChildren();
});

describe("machineContextDetail", () => {
  it("identifies the local machine by the serving gateway", () => {
    expect(machineContextDetail(machine("local"), "pi-dev.example.com")).toBe("pi-dev.example.com");
  });

  it("identifies a remote machine by its host", () => {
    const remote = machine("remote-a");
    remote.baseUrl = "https://fleet-a.example.com/pi-web/";
    expect(machineContextDetail(remote, "pi-dev.example.com")).toBe("fleet-a.example.com");
  });

  it("omits the detail when a remote has no usable base URL", () => {
    const remote = machine("remote-a");
    remote.baseUrl = "not a url";
    expect(machineContextDetail(remote, "pi-dev.example.com")).toBeUndefined();
  });
});

describe("machine crumb", () => {
  it("always shows the machine crumb, falling back to the local machine", async () => {
    const bar = await mountBar({ machines: [machine("local")] });

    expect(machineChip(bar)?.querySelector("img")).not.toBeNull();
  });

  it("is a static identity chip leading with the URL when there is no machine choice", async () => {
    const bar = await mountBar({ machines: [machine("local")] });

    const chip = machineChip(bar);
    expect(chip?.tagName).toBe("SPAN");
    expect(chip?.textContent).toContain(document.location.host);
    expect(chip?.textContent).not.toContain("Local");
  });

  it("opens machine selection when multiple machines exist", async () => {
    const opened: string[] = [];
    const bar = await mountBar({ machines: [machine("local"), machine("remote-a")], onOpenSection: (section) => { opened.push(section); } });

    const chip = machineChip(bar);
    expect(chip?.tagName).toBe("BUTTON");
    chip?.click();
    expect(opened).toEqual(["machines"]);
  });

  it("shows the remote host for a selected remote machine", async () => {
    const remote = machine("remote-a");
    remote.baseUrl = "https://fleet-a.example.com/";
    const bar = await mountBar({ machines: [machine("local"), remote], machine: remote });

    expect(machineChip(bar)?.textContent).toContain("fleet-a.example.com");
  });

  it("shows a machine icon alongside the label", async () => {
    const bar = await mountBar({ machines: [machine("local")] });

    const icon = machineChip(bar)?.querySelector("img");
    expect(icon?.getAttribute("src")).toContain("favicon.svg");
  });
});

interface BarFixture {
  machines: Machine[];
  machine?: Machine;
  onOpenSection?: (section: "machines" | "projects" | "workspaces" | "sessions") => void;
}

async function mountBar(fixture: BarFixture): Promise<AppContextBar> {
  const bar = new AppContextBar();
  bar.machines = fixture.machines;
  if (fixture.machine !== undefined) bar.machine = fixture.machine;
  if (fixture.onOpenSection !== undefined) bar.onOpenSection = fixture.onOpenSection;
  document.body.append(bar);
  await bar.updateComplete;
  return bar;
}

function machineChip(bar: AppContextBar): HTMLElement | undefined {
  return bar.shadowRoot?.querySelector<HTMLElement>(".context-chip") ?? undefined;
}

function machine(id: string): Machine {
  return {
    id,
    name: id === "local" ? "Local" : id,
    kind: id === "local" ? "local" : "remote",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
  };
}
