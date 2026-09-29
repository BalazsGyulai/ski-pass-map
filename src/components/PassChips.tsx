"use client";

import { useMemo, type CSSProperties } from "react";
import { passes, resorts } from "@/lib/data";
import { orderPassChips } from "@/lib/pass-chips";
import { passShortName } from "@/lib/pass-label";
import { useApp } from "./AppState";

/** One tap to see where a pass takes you. Chips toggle the pass filter and stay where they are. */
export function PassChips() {
  const { t, share, updateShare, searchAsMove, areaBounds, home } = useApp();
  const ordered = useMemo(
    () => orderPassChips(passes, resorts, { searchAsMove, area: searchAsMove ? areaBounds : null, home, name: passShortName }),
    [searchAsMove, areaBounds, home],
  );
  const none = share.passes.length === 0 && !share.noPass;
  return (
    <div className="pass-chips" role="toolbar" aria-label={t("passFilter")}>
      <button type="button" className="chip" aria-pressed={none} onClick={() => updateShare({ passes: [], noPass: false })}>
        {t("anyPass")}
      </button>
      {ordered.map((pass) => {
        const on = share.passes.includes(pass.id);
        return (
          <button
            key={pass.id}
            type="button"
            className="chip"
            aria-pressed={on}
            title={pass.name}
            style={{ "--pass": pass.color } as CSSProperties}
            onClick={(event) => {
              updateShare({
                passes: on ? share.passes.filter((id) => id !== pass.id) : [...share.passes, pass.id],
                noPass: false,
              });
              event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" });
            }}
          >
            <span className="chip-dot" aria-hidden="true" />
            {passShortName(pass)}
          </button>
        );
      })}
    </div>
  );
}
