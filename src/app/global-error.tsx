"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-[#060b18] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Something went wrong</h1>
          <p className="text-gray-400 text-sm mb-8">
            {error.message || "A critical error occurred"}
          </p>
          <button
            onClick={reset}
            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
