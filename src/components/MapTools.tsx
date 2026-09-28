"use client";

import { useEffect, useState } from "react";
import { LIFT_KINDS, LIFT_KIND_LABEL } from "@/lib/lift-icons";
import { IconLayers, IconLocate } from "./icons";
import { LiftSign } from "./LiftSign";
import { useApp } from "./AppState";

export function MapTools({ onLayers, layersOpen }: { onLayers: () => void; layersOpen: boolean }) {
  const { t, locate, locating, geoError, home } = useApp();
  const located = home?.kind === "geo";
  const [note, setNote] = useState<"denied" | "unsupported" | null>(geoError);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (geoError) {
      setNote(geoError);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setNote(null);
      setLeaving(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [geoError]);

  return (
    <div className="map-tools">
      <button type="button" className="tool-btn" aria-expanded={layersOpen} aria-controls="map-layers" onClick={onLayers} aria-label={t("layers")}>
        <IconLayers />
      </button>
      <button
        type="button"
        className={located ? "tool-btn is-on" : "tool-btn"}
        onClick={locate}
        disabled={locating}
        aria-busy={locating}
        aria-pressed={located}
        aria-label={t("myLocation")}
      >
        <IconLocate />
      </button>
      {note ? (
        <p className={leaving ? "map-tool-note is-leaving" : "map-tool-note"} role="status">
          {t(note === "unsupported" ? "geoUnsupported" : "geoDenied")}
        </p>
      ) : null}
    </div>
  );
}

export function LayersPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, share, updateShare, terrain3d, setTerrain3d, liftMotion, setLiftMotion } = useApp();
  if (!open) return null;
  return (
    <div id="map-layers" className="layers-panel" role="dialog" aria-label={t("layersTitle")}>
      <div className="drawer-head">
        <h2>{t("layersTitle")}</h2>
        <button type="button" className="ghost" onClick={onClose}>
          {t("close")}
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={terrain3d} onChange={() => setTerrain3d(!terrain3d)} />
        <span>{t("terrain3d")}</span>
      </label>
      <p className="hint">{t("terrain3dHint")}</p>
      <label className="check">
        <input type="checkbox" checked={liftMotion} onChange={() => setLiftMotion(!liftMotion)} />
        <span>{t("liftMotion")}</span>
      </label>
      <p className="hint">{t("liftMotionHint")}</p>
      <label className="check">
        <input type="checkbox" checked={share.showPistes} onChange={() => updateShare({ showPistes: !share.showPistes })} />
        <span>{t("showAllPistes")}</span>
      </label>
      <p className="hint">{t("opensnowmapLicence")}</p>
      <h3>{t("pisteLegend")}</h3>
      <ul className="piste-legend">
        <li><span className="piste-swatch" style={{ background: "#1f9d55" }} />{t("pisteNovice")}</li>
        <li><span className="piste-swatch" style={{ background: "#2563EB" }} />{t("pisteEasy")}</li>
        <li><span className="piste-swatch" style={{ background: "#DC2626" }} />{t("pisteIntermediate")}</li>
        <li><span className="piste-swatch" style={{ background: "#111827" }} />{t("pisteAdvanced")}</li>
        <li><span className="piste-swatch dashed" />{t("pisteFreeride")}</li>
        <li><span className="piste-swatch lift" />{t("pisteLift")}</li>
      </ul>
      <h3>{t("liftLegend")}</h3>
      <ul className="lift-legend">
        {LIFT_KINDS.map((kind) => (
          <li key={kind}>
            <LiftSign kind={kind} />
            {t(LIFT_KIND_LABEL[kind])}
          </li>
        ))}
      </ul>
      <h3>{t("legendTitle")}</h3>
      <p className="hint">{t("legendPill")}</p>
      <p className="hint">{t("legendEmpty")}</p>
      <p className="hint">{t("legendRing")}</p>
      <p className="hint">{t("legendClosed")}</p>
      <p className="hint">{t("legendKlima")}</p>
      <p className="hint">{t("osmLicence")}</p>
    </div>
  );
}
