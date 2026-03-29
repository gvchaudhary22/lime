# Lime Component Patterns

## Page Structure
Every page follows this template:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ... } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, SomeType } from "@/lib/api";

export default function PageName() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SomeType | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) { router.push("/"); return; }
    fetchData();
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    const res = await api.someMethod();
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          {/* Content */}
        </div>
      </main>
    </div>
  );
}
```

## SSE Streaming
For streaming endpoints, use `src/lib/stream.ts`:
```tsx
import { streamChat } from "@/lib/stream";
const abort = streamChat(conversationId, message, {
  onToken: (token) => setOutput(prev => prev + token),
  onDone: () => setLoading(false),
  onError: (err) => setError(err.message),
});
// Cleanup: abort() on unmount
```

## Tables
```tsx
<div className="bg-[#111] rounded-xl border border-[#222] overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-[#222] text-gray-400 text-sm">
        <th className="text-left p-4">Column</th>
      </tr>
    </thead>
    <tbody>
      {items.map(item => (
        <tr key={item.id} className="border-b border-[#1a1a1a]">
          <td className="p-4 text-white">{item.name}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

## Modals
```tsx
{showModal && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-[#111] rounded-xl border border-[#222] w-full max-w-2xl max-h-[70vh] overflow-y-auto">
      {/* Modal content */}
    </div>
  </div>
)}
```
