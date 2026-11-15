"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Bootstrap, TransactionIntent } from "@proofbound/shared";
import type { NearConnector } from "@hot-labs/near-connect";
import { CheckCircle2, CircleAlert, LoaderCircle, X } from "lucide-react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { BRAND } from "@/lib/brand";

type Notice = { message: string; kind: "success" | "error" | "info" };
interface ContextValue {
  data: Bootstrap | null; loading: boolean; error: string | null; walletBusy: boolean;
  walletAccount: string | null;
  refresh: () => Promise<void>; connect: (account?: string) => Promise<void>; disconnect: () => Promise<void>;
  mutate: <T>(path: string, body?: unknown, method?: string) => Promise<T>;
  pendingOperation: string | null;
  confirmPending: (hash: string) => Promise<void>;
  notify: (message: string, kind?: Notice["kind"]) => void;
}
const Context = createContext<ContextValue | null>(null);
const pendingStorageKey = "proofbound.pending-operation";

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletAccount, setWalletAccount] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingOperation, setPendingOperation] = useState<string | null>(null);
  const connector = useRef<NearConnector | null>(null);
  const refreshInFlight = useRef(false);
  const notify = useCallback((message: string, kind: Notice["kind"] = "success") => setNotice({ message, kind }), []);
  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try { setData(await api<Bootstrap>("/bootstrap")); setError(null); }
    catch (e) {
      if (e instanceof ApiError && e.status === 503) setData(null);
      setError(errorMessage(e));
    }
    finally { setLoading(false); refreshInFlight.current = false; }
  }, []);
  const readOnly = data?.runtime.readOnly === true;
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, readOnly ? 60000 : 4000); return () => clearInterval(timer); }, [readOnly, refresh]);
  useEffect(() => { setPendingOperation(sessionStorage.getItem(pendingStorageKey)); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), notice.kind === "error" ? 10000 : 6000); return () => clearTimeout(timer); }, [notice]);

  const getConnector = useCallback(async () => {
    if (!connector.current) {
      const { NearConnector } = await import("@hot-labs/near-connect");
      connector.current = new NearConnector({
        network: "testnet",
        features: { signMessage: true },
        autoConnect: false,
        footerBranding: {
          icon: new URL(BRAND.mark, window.location.origin).href,
          heading: BRAND.name,
          link: new URL("/demo", window.location.origin).href,
          linkText: "About PROOFBOUND",
        },
      });
    }
    return connector.current;
  }, []);

  const connect = useCallback(async (account?: string) => {
    setWalletBusy(true);
    try {
      if (data?.runtime.mode === "local") {
        await api("/session/local", { method: "POST", body: JSON.stringify({ accountId: account || "owner.local" }) });
        notify(`Demo identity selected: ${account || "owner.local"}`);
      } else {
        const near = await getConnector();
        await near.connect();
        const wallet = await near.wallet();
        const accounts = await wallet.getAccounts();
        const accountId = accounts[0]?.accountId;
        if (!accountId) throw new Error("Choose a NEAR testnet wallet account to continue.");
        if (readOnly) {
          setWalletAccount(accountId);
          notify("Wallet connected for viewing public testnet data.");
          return;
        }
        const challenge = await api<{ challengeId: string; message: string; nonce: number[]; recipient: string; state: string }>("/auth/challenge", { method: "POST", body: JSON.stringify({ accountId }) });
        const signed = await wallet.signMessage({ message: challenge.message, recipient: challenge.recipient, nonce: new Uint8Array(challenge.nonce) });
        if (!signed) throw new Error("The wallet did not return a signed message. Return here after approving the sign-in request and retry.");
        await api("/auth/verify", { method: "POST", body: JSON.stringify({ challengeId: challenge.challengeId, accountId, publicKey: signed.publicKey, signature: signed.signature, state: challenge.state }) });
        notify("Wallet ownership verified. You’re connected to NEAR testnet.");
      }
      await refresh();
    } catch (e) { notify(errorMessage(e), "error"); } finally { setWalletBusy(false); }
  }, [data?.runtime.mode, getConnector, notify, readOnly, refresh]);

  const disconnect = useCallback(async () => {
    if (!readOnly) await api("/session", { method: "DELETE" });
    if (connector.current) await connector.current.disconnect();
    setWalletAccount(null);
    if (!readOnly) await refresh();
    notify("Signed out.");
  }, [readOnly, refresh, notify]);

  const complete = useCallback(async <T,>(operationId: string, transactionHash: string) => {
    const confirmed = await api<T>("/transactions/confirm", {
      method: "POST", body: JSON.stringify({ operationId, transactionHash }),
    });
    sessionStorage.removeItem(pendingStorageKey);
    setPendingOperation(null);
    await refresh();
    return confirmed;
  }, [refresh]);

  const confirmPending = useCallback(async (hash: string) => {
    if (!pendingOperation) return;
    await complete(pendingOperation, hash.trim());
    notify("The finalized testnet transaction was confirmed.");
  }, [complete, notify, pendingOperation]);

  const mutate = useCallback(async <T,>(path: string, body: unknown = {}, method = "POST"): Promise<T> => {
    const response = await api<T & { transactionIntent?: TransactionIntent; operationId?: string }>(path, { method, body: JSON.stringify(body) });
    if (response.transactionIntent) {
      const intent = response.transactionIntent;
      if (data?.runtime.mode !== "testnet" || intent.receiverId !== data.runtime.contractId) throw new Error("The transaction destination does not match the configured testnet contract.");
      if (!response.operationId || !data.session) throw new Error("The wallet operation could not be prepared.");
      if (pendingOperation) throw new Error("Confirm the previous wallet operation or discard its local reference before signing another.");
      notify("Review this transaction in your wallet. Waiting for your signature.", "info");
      const wallet = await (await getConnector()).wallet();
      sessionStorage.setItem(pendingStorageKey, response.operationId);
      setPendingOperation(response.operationId);
      const result = await wallet.signAndSendTransaction({ network: "testnet", signerId: data.session.accountId, receiverId: intent.receiverId, actions: intent.actions });
      const transactionHash = (result as { transaction?: { hash?: string } }).transaction?.hash;
      if (!transactionHash) throw new Error("Enter the finalized transaction hash in the confirmation panel to finish.");
      notify("Transaction submitted. Checking the finalized contract result…", "info");
      return complete<T>(response.operationId, transactionHash);
    }
    await refresh();
    return response;
  }, [complete, data?.runtime, data?.session, getConnector, notify, pendingOperation, refresh]);

  return <Context.Provider value={{ data, loading, error, walletBusy, walletAccount, refresh, connect, disconnect, mutate, notify, pendingOperation, confirmPending }}>
    {children}
    {data?.runtime.mode === "testnet" && !readOnly && pendingOperation && <PendingTransaction
      confirm={confirmPending}
      discard={() => { sessionStorage.removeItem(pendingStorageKey); setPendingOperation(null); }}
    />}
    {notice && <div className={`toast toast-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
      {notice.kind === "error" ? <CircleAlert size={19} /> : notice.kind === "success" ? <CheckCircle2 size={19} /> : <LoaderCircle size={19} className="spin" />}
      <span>{notice.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={17} /></button>
    </div>}
  </Context.Provider>;
}
function PendingTransaction({ confirm, discard }: { confirm: (hash: string) => Promise<void>; discard: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return <form className="panel pending-transaction" onSubmit={async event => {
    event.preventDefault();
    const hash = String(new FormData(event.currentTarget).get("hash") ?? "");
    setBusy(true);
    setError(null);
    try { await confirm(hash); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }}>
    <strong>Confirm a wallet transaction</strong>
    <p>If your wallet confirmed the action, use its transaction hash to finish. Discard the reference only if you cancelled signing.</p>
    <label className="field">Finalized transaction hash<input name="hash" minLength={32} maxLength={64} required /></label>
    {error && <p role="alert" className="red">{error}</p>}
    <div className="button-row"><button className="button button-small" disabled={busy}>Confirm transaction</button><button type="button" className="button button-small button-secondary" disabled={busy} onClick={discard}>Discard reference</button></div>
  </form>;
}
export function useApp() { const value = useContext(Context); if (!value) throw new Error("App provider unavailable"); return value; }
