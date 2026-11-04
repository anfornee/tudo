export function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_TUDO_BUILD_ID },
    { headers: { "Cache-Control": "no-store" } },
  );
}
