import type { PiWebPlugin } from "../types";
import { createCoreActions } from "./actions";
import { createCoreWorkspacePanels } from "./panels";

export const corePlugin: PiWebPlugin = {
  id: "core",
  name: "Pi Web Core",
  activate: () => ({
    actions: createCoreActions(),
    workspacePanels: createCoreWorkspacePanels(),
  }),
};
