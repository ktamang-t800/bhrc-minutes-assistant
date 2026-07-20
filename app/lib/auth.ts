import { env } from "cloudflare:workers";

const COOKIE_NAME = "bhrc_session";
const SESSION_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

async function constantTimeEqual(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all([
    digest(left),
    digest(right),
  ]);
  let difference = leftDigest.length ^ rightDigest.length;
  for (let index = 0; index < leftDigest.length; index += 1) {
    difference |= leftDigest[index] ^ rightDigest[index];
  }
  return difference === 0;
}

function sharedPasscode() {
  const value = env.SHARED_PASSCODE;
  return typeof value === "string" ? value.trim() : "";
}

async function sign(value: string) {
  const secret = sharedPasscode();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
  );
}

function cookieValue(request: Request) {
  const rawCookie = request.headers.get("cookie") ?? "";
  const match = rawCookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`),
  );
  return match?.[1] ?? "";
}

export function authIsConfigured() {
  return Boolean(sharedPasscode());
}

export async function verifyPasscode(candidate: string) {
  const configured = sharedPasscode();
  return Boolean(configured) && constantTimeEqual(candidate, configured);
}

export async function createSessionToken() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expires);
  return `${payload}.${await sign(payload)}`;
}

export async function requestIsAuthorized(request: Request) {
  if (!authIsConfigured()) return false;
  const token = cookieValue(request);
  const [expiresText, signature, extra] = token.split(".");
  if (!expiresText || !signature || extra) return false;

  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  return constantTimeEqual(signature, await sign(expiresText));
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function expiredSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}
