import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkSourceForEdit } from "./index";

describe("checkSourceForEdit", () => {
  it("returns per-field verdicts when fetch is injected", async () => {
    const html = fs.readFileSync(path.join(process.cwd(), "public/fixtures/source.html"), "utf8");
    const result = await checkSourceForEdit(
      "https://example.com/fixture",
      [{ path: "dayTicket.value.eur", before: 50, after: 59, kind: "price" }],
      undefined,
      { NODE_ENV: "test" },
      {
        fetchText: async (url) => ({ finalUrl: url, text: html }),
      },
    );
    expect(result.deterministic[0]?.verdict).toBe("supported");
    expect(result.deterministic[0]?.snippet).toBeTruthy();
  });
});
