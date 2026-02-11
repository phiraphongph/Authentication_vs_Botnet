import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold text-black dark:text-white">
          🛡️ Authentication vs Botnet
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          ระบบทดสอบการป้องกัน Brute Force Attack ด้วย Rate Limiting
        </p>
        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="flex h-12 items-center justify-center rounded-full bg-black px-8 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            📊 Dashboard →
          </Link>
        </div>
      </main>
    </div>
  );
}
