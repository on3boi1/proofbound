"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";
import { useApp } from "@/components/provider";

export function useResource<T>(path: string | null, poll = false) {
  const { data: app } = useApp();
  const account = app?.session?.accountId;
  const shouldPoll = poll && !app?.runtime.readOnly;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!path) { setData(null); setLoading(false); return; }
    try { setData(await api<T>(path)); setError(null); }
    catch(e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { setData(null); setLoading(true); void refresh(); if (shouldPoll) { const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 3500); return () => clearInterval(timer); } }, [refresh, account, shouldPoll]);
  return { data, error, loading, refresh };
}
