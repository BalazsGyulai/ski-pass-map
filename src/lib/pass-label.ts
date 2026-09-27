import labels from "../../config/pass-labels.json";

const shortNames: Record<string, string> = labels;

/** Curated UI label. Falls back to the official name. Not part of the imported catalog. */
export function passShortName(pass: { id: string; name: string }): string {
  const short = shortNames[pass.id]?.trim();
  return short ? short : pass.name;
}

export function passHasShortName(pass: { id: string; name: string }): boolean {
  const short = shortNames[pass.id]?.trim();
  return Boolean(short && short !== pass.name);
}
