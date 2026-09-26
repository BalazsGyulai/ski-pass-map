"use client";

import { IconLayers, IconLocate } from "./icons";
import { useApp } from "./AppState";

export function MapTools({ onLayers, layersOpen }: { onLayers: () => void; layersOpen: boolean }) {
  const { t, locate, locating } = useApp();
  return (
    <div className="map-tools">
      <button type="button" className="tool-btn" aria-expanded={layersOpen} aria-controls="map-layers" onClick={onLayers} aria-label={t("layers")}>
        <IconLayers />
      </button>
      <button type="button" className="tool-btn" onClick={locate} disabled={locating} aria-label={t("myLocation")}>
        <IconLocate />
      </button>
    </div>
  );
}

export function LayersPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, share, updateShare } = useApp();
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
