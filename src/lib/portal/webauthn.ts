import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

function b64urlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export interface WebAuthnConfig {
  rpName: string;
  rpID: string;
  origin: string;
}

export function webAuthnConfigFromRequest(request: Request, env?: { PORTAL_RP_ID?: string }): WebAuthnConfig {
  const url = new URL(request.url);
  const rpID = env?.PORTAL_RP_ID?.trim() || url.hostname;
  return { rpName: "Skimap Resort Portal", rpID, origin: url.origin };
}

export async function createRegistrationOptions(
  config: WebAuthnConfig,
  userId: string,
  userName: string,
  excludeCredentialIds: string[] = [],
) {
  return generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName,
    userID: new TextEncoder().encode(userId),
    attestationType: "none",
    excludeCredentials: excludeCredentialIds.map((id) => ({ id, transports: [] as AuthenticatorTransportFuture[] })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

export async function verifyRegistration(
  config: WebAuthnConfig,
  expectedChallenge: string,
  response: unknown,
) {
  return verifyRegistrationResponse({
    response: response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    requireUserVerification: false,
  });
}

export async function createAuthenticationOptions(config: WebAuthnConfig, allowCredentialIds: string[]) {
  return generateAuthenticationOptions({
    rpID: config.rpID,
    allowCredentials: allowCredentialIds.map((id) => ({ id, transports: [] as AuthenticatorTransportFuture[] })),
    userVerification: "preferred",
  });
}

export async function verifyAuthentication(
  config: WebAuthnConfig,
  expectedChallenge: string,
  response: unknown,
  credential: { id: string; publicKey: string; counter: number },
) {
  return verifyAuthenticationResponse({
    response: response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    credential: {
      id: credential.id,
      publicKey: b64urlToBytes(credential.publicKey),
      counter: credential.counter,
    },
    requireUserVerification: false,
  });
}
