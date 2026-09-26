import { describe, expect, it } from "vitest";
import { MAP_COUNTER_TIMEOUT_MS, providerAfterFailure, readCounter, resolveMapProvider, selectMapProvider, shouldCountMapLoad, type CounterOutcome } from "./map-provider";

const tokens = [undefined, null, "", "   ", "pk.dummy"] as const;
const consents = [false, true];
const counters: CounterOutcome[] = ["mapbox", "openfreemap", "error", "timeout", "unreachable"];

describe("map provider selection", () => {
  it("uses Mapbox only when the token, consent, and counter all allow it", () => {
    for (const token of tokens) {
      for (const consented of consents) {
        for (const counter of counters) {
          const provider = selectMapProvider({ token, consented, counter });
          const mapbox = Boolean(token?.trim()) && consented && counter === "mapbox";
          expect(provider, `${String(token)} consent=${consented} counter=${counter}`).toBe(mapbox ? "mapbox" : "openfreemap");
        }
      }
    }
  });

  it("falls back from a Mapbox init failure and stops there", () => {
    expect(providerAfterFailure("mapbox")).toBe("openfreemap");
    expect(providerAfterFailure("openfreemap")).toBe("error");
  });

  it("does not call the counter without a token or consent", async () => {
    const fetchImpl = (() => {
      throw new Error("counter should not be called");
    }) as typeof fetch;
    await expect(resolveMapProvider({ token: "", consented: true, fetchImpl })).resolves.toBe("openfreemap");
    await expect(resolveMapProvider({ token: "pk.dummy", consented: false, fetchImpl })).resolves.toBe("openfreemap");
    await expect(resolveMapProvider({ token: "   ", consented: true, fetchImpl })).resolves.toBe("openfreemap");
  });

  it("reads a granted or refused counter response", async () => {
    const asJson = (provider: string, ok = true) =>
      (async () => new Response(JSON.stringify({ provider }), { status: ok ? 200 : 500 })) as typeof fetch;
    await expect(resolveMapProvider({ token: "pk.dummy", consented: true, countLoads: true, fetchImpl: asJson("mapbox") })).resolves.toBe("mapbox");
    await expect(resolveMapProvider({ token: "pk.dummy", consented: true, countLoads: true, fetchImpl: asJson("openfreemap") })).resolves.toBe("openfreemap");
    await expect(resolveMapProvider({ token: "pk.dummy", consented: true, countLoads: true, fetchImpl: asJson("mapbox", false) })).resolves.toBe("openfreemap");
    await expect(
      resolveMapProvider({
        token: "pk.dummy",
        consented: true,
        countLoads: true,
        fetchImpl: (async () => new Response("<!doctype html>", { status: 200 })) as typeof fetch,
      }),
    ).resolves.toBe("openfreemap");
    await expect(
      resolveMapProvider({
        token: "pk.dummy",
        consented: true,
        countLoads: true,
        fetchImpl: (async () => new Response(JSON.stringify({ provider: "somewhere" }), { status: 200 })) as typeof fetch,
      }),
    ).resolves.toBe("openfreemap");
  });

  it("treats a counter error, timeout, or unreachable host as OpenFreeMap", async () => {
    await expect(
      resolveMapProvider({
        token: "pk.dummy",
        consented: true,
        countLoads: true,
        fetchImpl: (async () => {
          throw new TypeError("Failed to fetch");
        }) as typeof fetch,
      }),
    ).resolves.toBe("openfreemap");

    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })) as typeof fetch;
    await expect(resolveMapProvider({ token: "pk.dummy", consented: true, countLoads: true, timeoutMs: 20, fetchImpl: hanging })).resolves.toBe("openfreemap");

    const seen: RequestInit[] = [];
    const recording = ((url: string, init?: RequestInit) => {
      seen.push(init ?? {});
      return Promise.resolve(new Response(JSON.stringify({ provider: "mapbox" }), { status: 200 }));
    }) as typeof fetch;
    await resolveMapProvider({ token: "pk.dummy", consented: true, countLoads: true, endpoint: "https://example.test/api/map-load", fetchImpl: recording });
    expect(JSON.stringify(seen)).not.toMatch(/pk\.|203\.0\.113|cf-connecting-ip/i);
    expect(seen[0]?.method).toBe("POST");
    expect(MAP_COUNTER_TIMEOUT_MS).toBeLessThanOrEqual(2000);
  });

  it("does not increment the counter outside a production build", async () => {
    expect(shouldCountMapLoad("production")).toBe(true);
    expect(shouldCountMapLoad("development")).toBe(false);
    expect(shouldCountMapLoad("test")).toBe(false);
    const fetchImpl = (() => {
      throw new Error("counter should not be called");
    }) as typeof fetch;
    await expect(resolveMapProvider({ token: "pk.dummy", consented: true, countLoads: false, fetchImpl })).resolves.toBe("mapbox");
    await expect(resolveMapProvider({ token: "pk.dummy", consented: true, fetchImpl })).resolves.toBe("mapbox");
  });
});

describe("readCounter outcomes", () => {
  it("names timeout, unreachable, and error separately from a mapbox grant", async () => {
    await expect(
      readCounter({
        endpoint: "/api/map-load",
        timeoutMs: 20,
        fetchImpl: ((_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          })) as typeof fetch,
      }),
    ).resolves.toBe("timeout");
    await expect(
      readCounter({
        endpoint: "/api/map-load",
        timeoutMs: 50,
        fetchImpl: (async () => {
          throw new TypeError("offline");
        }) as typeof fetch,
      }),
    ).resolves.toBe("unreachable");
    await expect(
      readCounter({
        endpoint: "/api/map-load",
        timeoutMs: 50,
        fetchImpl: (async () => new Response("nope", { status: 404 })) as typeof fetch,
      }),
    ).resolves.toBe("error");
    await expect(
      readCounter({
        endpoint: "/api/map-load",
        timeoutMs: 50,
        fetchImpl: (async () => new Response(JSON.stringify({ provider: "mapbox" }), { status: 200 })) as typeof fetch,
      }),
    ).resolves.toBe("mapbox");
  });
});
