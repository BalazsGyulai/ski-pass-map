import { LIFT_GLYPHS, SIGN_FILL, type LiftKind } from "@/lib/lift-icons";

/** The lift sign from the map, for legends. Same badge, same pictogram. */
export function LiftSign({ kind, size = 22 }: { kind: LiftKind; size?: number }) {
  return (
    <svg className="lift-sign" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill={SIGN_FILL} stroke="#fff" strokeWidth="1.5" />
      <g transform="translate(3.75 3.75) scale(0.6875)" strokeLinecap="round" strokeLinejoin="round">
        {LIFT_GLYPHS[kind].map((shape, index) =>
          shape.mode === "stroke" ? (
            <path key={index} d={shape.d} fill="none" stroke="#fff" strokeWidth={shape.width ?? 1.6} />
          ) : (
            <path key={index} d={shape.d} fill={shape.mode === "knockout" ? SIGN_FILL : "#fff"} />
          ),
        )}
      </g>
    </svg>
  );
}
