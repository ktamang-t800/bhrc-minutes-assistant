import {
  authIsConfigured,
  createSessionToken,
  sessionCookie,
  verifyPasscode,
} from "../../lib/auth";

export async function POST(request: Request) {
  if (!authIsConfigured()) {
    return Response.json(
      { error: "The shared passcode has not been configured yet." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    passcode?: unknown;
  } | null;
  const passcode =
    typeof body?.passcode === "string" ? body.passcode.slice(0, 256) : "";

  if (!(await verifyPasscode(passcode))) {
    return Response.json(
      { error: "That passcode was not accepted." },
      { status: 401 },
    );
  }

  const token = await createSessionToken();
  return Response.json(
    { ok: true },
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": sessionCookie(token, request),
      },
    },
  );
}
