import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import AutoRefresh from "./AutoRefresh";
import ResetButton from "./ResetButton";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const totalAttacks = await prisma.attackLog.count();
  const successfulAttacks = await prisma.attackLog.count({
    where: { success: true },
  });
  const failedAttacks = await prisma.attackLog.count({
    where: { success: false },
  });

  const recentLogs = await prisma.attackLog.findMany({
    take: 20,
    orderBy: { timestamp: "desc" },
  });

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-gray-800">
      <AutoRefresh />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🛡️ Admin Dashboard</h1>
        <ResetButton />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h2 className="text-gray-500 text-sm font-semibold uppercase">
            Total Requests
          </h2>
          <p className="text-4xl font-bold mt-2">{totalAttacks}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
          <h2 className="text-gray-500 text-sm font-semibold uppercase">
            Successful Breaches
          </h2>
          <p className="text-4xl font-bold mt-2 text-red-600">
            {successfulAttacks}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <h2 className="text-gray-500 text-sm font-semibold uppercase">
            Stopped Attacks
          </h2>
          <p className="text-4xl font-bold mt-2 text-green-600">
            {failedAttacks}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <h2 className="bg-gray-100 p-4 border-b font-semibold">
          📜 Recent Attack Logs (Last 20)
        </h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm uppercase">
              <th className="p-3 border-b">ID</th>
              <th className="p-3 border-b">Time</th>
              <th className="p-3 border-b">IP Address</th>
              <th className="p-3 border-b">Mode</th>
              <th className="p-3 border-b">Result</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 border-b last:border-0">
                <td className="p-3 text-sm text-gray-500">{log.id}</td>
                <td className="p-3 text-sm">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="p-3 font-mono text-sm">{log.ip}</td>
                <td className="p-3 text-sm badge">
                  <span className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs">
                    {log.mode}
                  </span>
                </td>
                <td className="p-3">
                  {log.success ? (
                    <span className="text-red-600 font-bold text-sm bg-red-100 px-2 py-1 rounded">
                      SUCCESS
                    </span>
                  ) : (
                    <span className="text-green-600 font-bold text-sm bg-green-100 px-2 py-1 rounded">
                      FAILED
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
