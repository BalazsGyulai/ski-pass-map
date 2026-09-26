import type { Lang } from "./languages";
import type { Messages } from "@/lib/i18n";

export async function loadMessages(lang: Lang): Promise<Messages> {
  switch (lang) {
    case "bg":
      return (await import("./messages/bg.json")).default;
    case "cs":
      return (await import("./messages/cs.json")).default;
    case "da":
      return (await import("./messages/da.json")).default;
    case "de":
      return (await import("./messages/de.json")).default;
    case "el":
      return (await import("./messages/el.json")).default;
    case "en":
      return (await import("./messages/en.json")).default;
    case "es":
      return (await import("./messages/es.json")).default;
    case "et":
      return (await import("./messages/et.json")).default;
    case "fi":
      return (await import("./messages/fi.json")).default;
    case "fr":
      return (await import("./messages/fr.json")).default;
    case "ga":
      return (await import("./messages/ga.json")).default;
    case "hr":
      return (await import("./messages/hr.json")).default;
    case "hu":
      return (await import("./messages/hu.json")).default;
    case "it":
      return (await import("./messages/it.json")).default;
    case "lt":
      return (await import("./messages/lt.json")).default;
    case "lv":
      return (await import("./messages/lv.json")).default;
    case "mt":
      return (await import("./messages/mt.json")).default;
    case "nb":
      return (await import("./messages/nb.json")).default;
    case "nl":
      return (await import("./messages/nl.json")).default;
    case "pl":
      return (await import("./messages/pl.json")).default;
    case "pt":
      return (await import("./messages/pt.json")).default;
    case "ro":
      return (await import("./messages/ro.json")).default;
    case "sk":
      return (await import("./messages/sk.json")).default;
    case "sl":
      return (await import("./messages/sl.json")).default;
    case "sv":
      return (await import("./messages/sv.json")).default;
    case "ca":
      return (await import("./messages/ca.json")).default;
    default: {
      const _exhaustive: never = lang;
      return _exhaustive;
    }
  }
}
