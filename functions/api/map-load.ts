import { createD1Store, handleMapLoad, type D1Like, type MapLoadEnv } from "../../src/lib/map-load";

interface Env extends MapLoadEnv {
  MAP_LOADS?: D1Like;
}

/** POST /api/map-load — Cloudflare Pages Function. Not part of the static export. */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (!context.env.MAP_LOADS) {
    return new Response(JSON.stringify({ provider: "openfreemap" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return handleMapLoad(context.request, context.env, createD1Store(context.env.MAP_LOADS));
}
