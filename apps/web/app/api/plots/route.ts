// Dev-only: writes the drawn plots to lib/plots/plots.json so they can be committed and shared with teammates.
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function PUT(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("disabled", { status: 403 });
  const body = await req.json();
  if (typeof body !== "object" || body === null || Array.isArray(body)) return new Response("bad body", { status: 400 });
  await writeFile(path.join(process.cwd(), "lib/plots/plots.json"), JSON.stringify(body, null, 2) + "\n");
  return new Response("ok");
}
