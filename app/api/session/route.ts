import { requestIsAuthorized } from "../../lib/auth";

export async function GET(request: Request) {
  const authorized = await requestIsAuthorized(request);
  return Response.json(
    { authorized },
    {
      status: authorized ? 200 : 401,
      headers: { "cache-control": "no-store" },
    },
  );
}
