import type { MessageKey } from "@/lib/i18n";
import { IconCalendar, IconMap, IconTicket } from "./icons";

/** The three places in the app. Settings sits behind the gear icon. */
export const primaryTabs: Array<{ rest: string; key: MessageKey; Icon: () => React.JSX.Element }> = [
  { rest: "/", key: "navMap", Icon: IconMap },
  { rest: "/passes", key: "passes", Icon: IconTicket },
  { rest: "/plan", key: "myPlanLink", Icon: IconCalendar },
];

export function isCurrentTab(rest: string, tabRest: string): boolean {
  if (tabRest === "/") return rest === "/";
  return rest === tabRest || rest.startsWith(`${tabRest}/`);
}
