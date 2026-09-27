import type { MessageKey } from "@/lib/i18n";

type CountdownKey = Extract<MessageKey, "endsIn" | "endsInOne" | "startsIn" | "startsInOne" | "ended" | "endsToday" | "startsToday" | "started">;

/** "ends in 5 days", "starts today", ... for a pre-sale deadline. */
export function countdownText(t: (key: CountdownKey, vars?: Record<string, string | number>) => string, kind: "starts" | "ends", days: number): string {
  if (kind === "ends" && days === 1) return t("endsInOne");
  if (kind === "ends" && days > 0) return t("endsIn", { n: days });
  if (kind === "ends" && days === 0) return t("endsToday");
  if (kind === "ends") return t("ended");
  if (days === 1) return t("startsInOne");
  if (days > 0) return t("startsIn", { n: days });
  if (days === 0) return t("startsToday");
  return t("started");
}
