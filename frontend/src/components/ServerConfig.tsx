import { useState } from "react";
import { setServerUrl } from "../capacitor/register";

interface Props {
  onConfigured: () => void;
}

export default function ServerConfig({ onConfigured }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim().replace(/\/+$/, "");
    if (!trimmed) {
      setError("Please enter a server address");
      return;
    }
    let finalUrl = trimmed;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `http://${finalUrl}`;
    }
    try {
      new URL(finalUrl);
    } catch {
      setError("Invalid URL format");
      return;
    }
    setError("");
    await setServerUrl(finalUrl);
    onConfigured();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-4 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:bg-gray-800">
        <div className="mb-6 text-center">
          <h1 className="font-outfit text-2xl font-bold text-gray-900 dark:text-white">
            MeleFlow
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Enter your server address
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="192.168.100.10:3001"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-purple-500"
              autoFocus
            />
            {error && (
              <p className="mt-1 text-xs text-red-500">{error}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  );
}
