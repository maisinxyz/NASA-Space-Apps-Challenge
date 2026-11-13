// Placeholder. The real landing page is FE-01 (Prompt 11); the shell is Prompt 08.
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-10 font-sans">
      <h1 className="text-3xl font-semibold">FieldTwin</h1>
      <p className="mt-2">Scaffold only. Pages arrive in later prompts.</p>
      <p className="mt-4">
        <Link className="underline" href="/dev/api">
          /dev/api
        </Link>{" "}
        checks the API client in mock and live mode.
      </p>
    </main>
  );
}
