"use client";
import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
export default function SyncManager() {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let snapshot = "";
    const sync = () => { if (navigator.onLine) void useAppStore.getState().syncNow(); };
    const unsubscribe = useAppStore.subscribe(s => {
      const next = JSON.stringify([s.people,s.weeklyBudget,s.currency,s.calories,s.proteinG,s.carbsG,s.fatG,s.pantryItems,s.weekPlan,s.groceryItems,s.priceMemory]);
      if (next === snapshot) return;
      snapshot = next; clearTimeout(timeout); timeout = setTimeout(sync, 1000);
    });
    const ping = () => { sync(); void fetch("/api/publik/status", { cache: "no-store" }); };
    const interval = setInterval(ping, 60_000);
    window.addEventListener("online", ping);
    sync();
    return () => { unsubscribe(); clearTimeout(timeout); clearInterval(interval); window.removeEventListener("online", ping); };
  }, []);
  return null;
}
