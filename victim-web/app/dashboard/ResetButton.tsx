"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!confirm("Are you sure you want to clear all attack logs?")) return;

    setLoading(true);
    try {
      await fetch("/api/reset", { method: "POST" });
      router.refresh();
    } catch (error) {
      alert("Failed to reset logs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow mb-6 disabled:opacity-50"
    >
      {loading ? "Resetting..." : "🗑️ Reset Logs"}
    </button>
  );
}
