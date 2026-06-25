import { describe, expect, it } from "vitest";
import { MOBILE_PROMPT_ENTER_MEDIA_QUERY, shouldSendPromptOnEnter, type PromptEnterMedia } from "./promptEnterBehavior";

describe("promptEnterBehavior", () => {
  it("uses the expected mobile media query", () => {
    expect(MOBILE_PROMPT_ENTER_MEDIA_QUERY).toBe("(pointer: coarse), (max-width: 760px)");
  });

  it("sends on Enter outside the mobile environment", () => {
    expect(shouldSendPromptOnEnter({ matches: false } satisfies PromptEnterMedia)).toBe(true);
    expect(shouldSendPromptOnEnter(undefined)).toBe(true);
  });

  it("keeps Enter as a newline in the mobile environment", () => {
    expect(shouldSendPromptOnEnter({ matches: true } satisfies PromptEnterMedia)).toBe(false);
  });
});
