"use client";

import { useMemo, type CSSProperties } from "react";
import { passes, resorts } from "@/lib/data";
import { passShortName } from "@/lib/pass-label";
import { useApp } from "./AppState";

/** One tap to see where a pass takes you. Chips toggle the pass filter; the map follows. */
export function PassChips() {
  const { t, share, updateShare } = useApp();
  const ordered = useMemo(() => {
    const counts = new Map<string, number>();
    for (const resort of resorts) {
      if (resort.abandoned) continue;
      for (const id of resort.passes) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...passes].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, []);
  const none = share.passes.length === 0 && !share.noPass;
  // Selected passes come first, so the active choice is visible without scrolling the row.
  const shown = [...ordered.filter((pass) => share.passes.includes(pass.id)), ...ordered.filter((pass) => !share.passes.includes(pass.id))];
  return (
    <div className="pass-chips" role="toolbar" aria-label={t("passFilter")}>
      <button type="button" className="chip" aria-pressed={none} onClick={() => updateShare({ passes: [], noPass: false })}>
        {t("anyPass")}
      </button>
      {shown.map((pass) => {
        const on = share.passes.includes(pass.id);
        return (
          <button
            key={pass.id}
            type="button"
            className="chip"
            aria-pressed={on}
            title={pass.name}
            style={{ "--pass": pass.color } as CSSProperties}
            onClick={() =>
              updateShare({
                passes: on ? share.passes.filter((id) => id !== pass.id) : [...share.passes, pass.id],
                noPass: false,
              })
            }
          >
            <span className="chip-dot" aria-hidden="true" />
            {passShortName(pass)}
          </button>
        );
      })}
    </div>
  );
}
