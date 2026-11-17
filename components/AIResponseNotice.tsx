"use client";
import { useEffect, useState } from "react";
type Notice = { message: string; url?: string };
export default function AIResponseNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = new URL(typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : args[0].href, window.location.origin);
      if (response.status === 402 && url.origin === window.location.origin && url.pathname.startsWith("/api/")) {
        const body = await response.clone().json().catch(() => null);
        if (body?.error) setNotice({ message: body.error, url: body.top_up_url });
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
  }, []);
  return notice ? <aside role="alert" className="fixed inset-x-4 top-4 z-50 rounded-xl border bg-card p-5 shadow-lg">
    <p>{notice.message}</p>{notice.url && <a className="underline" href={notice.url} target="_blank" rel="noreferrer">Get a plan</a>}
    <button className="ml-6 underline" onClick={() => setNotice(null)}>Dismiss</button>
  </aside> : null;
}
