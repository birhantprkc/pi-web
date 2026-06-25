export const MOBILE_PROMPT_ENTER_MEDIA_QUERY = "(pointer: coarse), (max-width: 760px)";

export type PromptEnterMedia = Pick<MediaQueryList, "matches">;

export function createMobilePromptEnterMedia(): PromptEnterMedia | undefined {
  return typeof window !== "undefined" && "matchMedia" in window ? window.matchMedia(MOBILE_PROMPT_ENTER_MEDIA_QUERY) : undefined;
}

export function shouldSendPromptOnEnter(media = createMobilePromptEnterMedia()): boolean {
  return media?.matches !== true;
}
