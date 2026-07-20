import { expiredSessionCookie } from "../../lib/auth";

export async function POST(request: Request) {
  return Response.json(
    { ok: true },
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": expiredSessionCookie(request),
      },
    },
  );
}
