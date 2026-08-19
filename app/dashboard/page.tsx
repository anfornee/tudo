import { cookies } from "next/headers";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has("session");

  return (
    <div style={{ padding: "40px" }}>
      <h1>🔒 Dashboard Area</h1>
      <p>Authentication status: <strong>{hasSession ? "Logged In via Cookie!" : "No Cookie Found"}</strong></p>
    </div>
  );
}