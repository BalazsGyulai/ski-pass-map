import { describe, expect, it } from "vitest";
import { STORAGE_VERSION, storedLiftMotionChoice } from "./storage";

describe("storedLiftMotionChoice", () => {
  it("keeps a choice saved by the current version", () => {
    expect(storedLiftMotionChoice({ version: STORAGE_VERSION, liftMotion: true })).toBe(true);
    expect(storedLiftMotionChoice({ version: STORAGE_VERSION, liftMotion: false })).toBe(false);
    expect(storedLiftMotionChoice({ version: STORAGE_VERSION })).toBeNull();
  });

  it("treats an older saved 'on' as the default, so reduced motion still applies", () => {
    expect(storedLiftMotionChoice({ version: 4, liftMotion: true })).toBeNull();
    expect(storedLiftMotionChoice({ liftMotion: true })).toBeNull();
    expect(storedLiftMotionChoice({ version: 4, liftMotion: false })).toBe(false);
  });
});
