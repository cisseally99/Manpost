"use client";

import { Bookmark, CheckCircle2, ChevronDown, Clock3, FileJson, FolderOpen, History, Plus, Save, Send, SlidersHorizontal, Trash2, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import JsonBodyEditor from "@/components/json-body-editor";
import EnvironmentPanel from "@/components/environment-panel";
import ManpostLogo from "@/components/manpost-logo";
import { logout } from "@/app/actions/auth";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Tab = "Params" | "Headers" | "Body";
type Row = { id: number; key: string; value: string; enabled: boolean };
type ApiResponse = { status: number; statusText: string; responseTimeMs: number; headers: Record<string, string>; body: string; bodyTruncated?: boolean };
type SavedRequest = { id: string; name: string; collection: string; method: HttpMethod; url: string; params: Row[]; headers: Row[]; body: string };
type HistoryEntry = { id: string; method: HttpMethod; url: string; params: Row[]; headers: Row[]; body: string; status: number | null; responseTimeMs: number | null; createdAt: string };
type EnvironmentVariable = { id: string; key: string; value: string; enabled: boolean };

const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function KeyValueEditor({ label, rows, setRows }: { label: string; rows: Row[]; setRows: (rows: Row[]) => void }) {
  const update = (id: number, field: "key" | "value", value: string) => setRows(rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p><button type="button" onClick={() => setRows([...rows, { id: Date.now(), key: "", value: "", enabled: true }])} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--brand)] hover:bg-violet-50"><Plus size={14} /> Add row</button></div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {rows.map((row, index) => <div key={row.id} className="grid grid-cols-[28px_1fr_1fr_36px] items-center gap-2 border-b border-slate-100 p-2 last:border-b-0"><input aria-label={`${label} row ${index + 1} enabled`} type="checkbox" checked={row.enabled} onChange={() => setRows(rows.map((item) => item.id === row.id ? { ...item, enabled: !item.enabled } : item))} className="mx-auto accent-[var(--brand)]" /><input aria-label={`${label} row ${index + 1} key`} value={row.key} onChange={(event) => update(row.id, "key", event.target.value)} placeholder="Key" className="min-w-0 rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:bg-white" /><input aria-label={`${label} row ${index + 1} value`} value={row.value} onChange={(event) => update(row.id, "value", event.target.value)} placeholder="Value" className="min-w-0 rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:bg-white" /><button type="button" aria-label={`Remove ${label.toLowerCase()} row ${index + 1}`} onClick={() => setRows(rows.filter((item) => item.id !== row.id))} className="mx-auto rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button></div>)}
      {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">No rows yet. Add one to get started.</p>}
    </div>
  </div>;
}

export default function RequestWorkspace({ email, welcome }: { email: string; welcome: boolean }) {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(welcome);
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("http://httpbin.org/get");
  const [tab, setTab] = useState<Tab>("Params");
  const [params, setParams] = useState<Row[]>([{ id: 1, key: "page", value: "1", enabled: true }]);
  const [headers, setHeaders] = useState<Row[]>([{ id: 2, key: "Accept", value: "application/json", enabled: true }]);
  const [body, setBody] = useState("{\n  \n}");
  const [sending, setSending] = useState(false);
  const [state, setState] = useState("Ready to send");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyState, setHistoryState] = useState("Loading history…");
  const [view, setView] = useState<"builder" | "history">("builder");
  const [environmentVariables, setEnvironmentVariables] = useState<EnvironmentVariable[]>([]);
  const updateEnvironmentVariables = useCallback((variables: EnvironmentVariable[]) => setEnvironmentVariables(variables), []);

  useEffect(() => {
    async function loadRequests() {
      try {
        const result = await fetch("/api/saved-requests");
        if (!result.ok) throw new Error("Could not load saved requests");
        const data = await result.json() as { requests: SavedRequest[] };
        let requests = data.requests;
        const previous = window.localStorage.getItem("manpost:saved-requests");
        if (previous) {
          try {
            const localRequests = JSON.parse(previous) as Omit<SavedRequest, "id">[];
            for (const item of localRequests) {
              const migrated = await fetch("/api/saved-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
              if (!migrated.ok) throw new Error("Some browser-saved requests could not be moved to your account.");
              const saved = await migrated.json() as { request: SavedRequest };
              requests = [saved.request, ...requests];
            }
            window.localStorage.removeItem("manpost:saved-requests");
          } catch { setState("Could not move all previous local requests; they remain in this browser"); }
        }
        setSavedRequests(requests);
      } catch { setState("Could not load saved requests"); }
    }
    void loadRequests();
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const result = await fetch("/api/history");
      if (!result.ok) throw new Error("Could not load request history.");
      const data = await result.json() as { history: HistoryEntry[] };
      setHistory(data.history);
      setHistoryState(data.history.length ? "" : "No requests sent yet. Requests you send will appear here.");
    } catch {
      setHistoryState("Could not load request history.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadHistory(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  async function saveRequest() {
    let name = `${method} request`;
    try { name = `${method} ${new URL(url).pathname || "/"}`; } catch { /* The request form will validate the URL when sent. */ }
    try {
      const result = await fetch("/api/saved-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, method, url, params, headers, body }) });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error ?? "Could not save this request.");
      setSavedRequests((items) => [data.request, ...items]); setState("Request saved to your account");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save this request."); }
  }

  function openRequest(item: SavedRequest) { setMethod(item.method); setUrl(item.url); setParams(item.params); setHeaders(item.headers); setBody(item.body); setState(`Loaded ${item.name}`); }

  function openHistory(item: HistoryEntry) { setMethod(item.method); setUrl(item.url); setParams(item.params); setHeaders(item.headers); setBody(item.body); setState("Loaded from request history"); setError(""); setView("builder"); }

  async function saveHistory(status: number | null, responseTimeMs: number | null) {
    try {
      const result = await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, url, params, headers, body, status, responseTimeMs }) });
      if (!result.ok) throw new Error("History could not be saved.");
      await loadHistory();
    } catch {
      setHistoryState("The request ran, but this entry could not be saved to history.");
    }
  }

  async function clearHistory() {
    try {
      const result = await fetch("/api/history", { method: "DELETE" });
      if (!result.ok) throw new Error("Could not clear history.");
      setHistory([]);
      setHistoryState("History cleared.");
    } catch {
      setHistoryState("Could not clear history. Please try again.");
    }
  }

  function dismissWelcome() {
    setShowWelcome(false);
    router.replace("/", { scroll: false });
  }

  async function sendRequest(event: FormEvent) {
    event.preventDefault();
    if (!["GET", "DELETE"].includes(method)) { try { JSON.parse(body); } catch { setError("The request body must contain valid JSON."); setState("Fix the JSON body first"); return; } }
    setSending(true); setResponse(null); setError(""); setState("Preparing request...");
    const variables = new Map(environmentVariables.filter((item) => item.enabled && item.key.trim()).map((item) => [item.key.trim(), item.value]));
    const resolve = (value: string) => value.replace(/\{\{([\w.-]+)\}\}/g, (match, key: string) => variables.has(key) ? variables.get(key)! : match);
    const resolvedRows = (rows: Row[]) => rows.filter((row) => row.enabled && row.key).map((row) => [resolve(row.key), resolve(row.value)]);
    try {
      const result = await fetch("/api/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, url: resolve(url), query: Object.fromEntries(resolvedRows(params)), headers: Object.fromEntries(resolvedRows(headers)), body: ["GET", "DELETE"].includes(method) ? undefined : resolve(body) }) });
      const data = await result.json(); if (!result.ok) throw new Error(data.error ?? "The request failed.");
      setResponse(data); setState("Request sent");
      await saveHistory(data.status, data.responseTimeMs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not send this request."); setState("Request could not be sent");
      await saveHistory(null, null);
    } finally { setSending(false); }
  }

  function formatBody(value: string) { if (!value) return "(empty response)"; try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }

  return <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 sm:px-8"><ManpostLogo size={36} /><div className="flex items-center gap-3"><span className="hidden text-xs text-slate-500 sm:inline">{email}</span><button type="button" onClick={saveRequest} className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-[var(--brand)] hover:bg-violet-100"><Save size={16} /> Save request</button><form action={logout}><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Sign out</button></form></div></div></header>
    <div className="mx-auto grid max-w-[1500px] gap-5 p-5 sm:p-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      {showWelcome && <div role="status" aria-live="polite" className="flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 lg:col-span-2"><div className="flex items-start gap-3"><CheckCircle2 aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-emerald-600" /><div><p className="text-sm font-semibold">Account created successfully</p><p className="mt-1 text-sm leading-5 text-emerald-800">You’re signed in and ready to use Manpost. This is an in-app confirmation; signup emails aren’t set up yet.</p></div></div><button type="button" onClick={dismissWelcome} aria-label="Dismiss account confirmation" className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100"><X size={17} /></button></div>}
      <aside className="hidden lg:block"><p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</p><nav className="mt-3 space-y-1"><button type="button" onClick={() => setView("builder")} aria-current={view === "builder" ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${view === "builder" ? "bg-violet-50 font-semibold text-[var(--brand)]" : "text-slate-500 hover:bg-white"}`}><SlidersHorizontal size={17} /> Request builder</button><button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-white"><FolderOpen size={17} /> Collections</button><button type="button" onClick={() => setView("history")} aria-current={view === "history" ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${view === "history" ? "bg-violet-50 font-semibold text-[var(--brand)]" : "text-slate-500 hover:bg-white"}`}><History size={17} /> History</button></nav><div className="mt-8"><div className="flex items-center justify-between px-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">My requests</p><Bookmark size={14} className="text-slate-400" /></div><div className="mt-2 space-y-1">{savedRequests.map((item) => <button type="button" key={item.id} onClick={() => { openRequest(item); setView("builder"); }} className="w-full truncate rounded-lg px-3 py-2 text-left text-xs text-slate-500 hover:bg-white hover:text-[var(--brand)]">{item.name}</button>)}{savedRequests.length === 0 && <p className="px-3 py-2 text-xs leading-5 text-slate-400">Saved requests will appear here.</p>}</div></div></aside>
      <section className="min-w-0">{view === "history" ? <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-5"><div><p className="text-sm font-medium text-[var(--brand)]">Workspace</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Request history</h1><p className="mt-1 text-sm text-slate-500">Your 50 most recent requests, saved to your account.</p></div><button type="button" onClick={clearHistory} disabled={!history.length} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">Clear history</button></div>{history.length ? <div className="divide-y divide-slate-100">{history.map((item) => <button type="button" key={item.id} onClick={() => openHistory(item)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left hover:bg-slate-50 sm:px-5"><span className="min-w-0 flex-1"><span className="mr-2 rounded-md bg-violet-50 px-2 py-1 text-xs font-bold text-[var(--brand)]">{item.method}</span><span className="break-all text-sm text-slate-700">{item.url}</span><span className="mt-2 block text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span></span><span className="flex items-center gap-3 text-xs text-slate-500">{item.status ? <span className={item.status < 400 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{item.status}</span> : <span className="text-rose-600">No response</span>}{item.responseTimeMs !== null && <span>{item.responseTimeMs} ms</span>}</span></button>)}</div> : <p className="p-8 text-center text-sm text-slate-500">{historyState || "No requests sent yet. Requests you send will appear here."}</p>}{historyState && history.length > 0 && <p role="status" className="border-t border-slate-100 px-5 py-3 text-xs text-amber-700">{historyState}</p>}</div> : <><div className="mb-5"><p className="text-sm font-medium text-[var(--brand)]">Request builder</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Make a request</h1><p className="mt-2 text-sm text-slate-500">Configure the details, then send it when you are ready.</p></div><EnvironmentPanel email={email} onVariablesChange={updateEnvironmentVariables} />
        <form onSubmit={sendRequest} className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="flex flex-col gap-3 sm:flex-row"><label className="relative shrink-0"><span className="sr-only">HTTP method</span><select value={method} onChange={(event) => setMethod(event.target.value as HttpMethod)} className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-10 text-sm font-bold text-[var(--brand)] outline-none focus:border-violet-400 sm:w-32">{methods.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-4 text-slate-400" /></label><label className="min-w-0 flex-1"><span className="sr-only">Request URL</span><input required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/api" className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50" /></label><button type="submit" disabled={sending} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:cursor-wait disabled:opacity-70"><Send size={16} />{sending ? "Sending" : "Send"}</button></div><div className="mt-3 flex items-center gap-2 px-1 text-xs text-slate-400"><Clock3 size={14} /><span>{state}</span></div></section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex overflow-x-auto border-b border-slate-200 px-3 sm:px-5">{(["Params", "Headers", "Body"] as Tab[]).map((item) => <button type="button" key={item} onClick={() => setTab(item)} className={`relative mr-6 whitespace-nowrap py-4 text-sm font-semibold ${tab === item ? "text-[var(--brand)]" : "text-slate-400 hover:text-slate-700"}`}>{item}{tab === item && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--brand)]" />}</button>)}</div><div className="p-4 sm:p-5">{tab === "Params" && <KeyValueEditor label="Query parameters" rows={params} setRows={setParams} />}{tab === "Headers" && <KeyValueEditor label="Request headers" rows={headers} setRows={setHeaders} />}{tab === "Body" && <div className="space-y-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"><FileJson size={15} /> JSON body</div><JsonBodyEditor value={body} onChange={setBody} /></div>}</div></section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Response</p>{response && <div className="mt-2 flex flex-wrap items-center gap-3 text-sm"><span className={`rounded-full px-2.5 py-1 font-bold ${response.status < 400 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{response.status} {response.statusText}</span><span className="text-slate-500">{response.responseTimeMs} ms</span></div>}</div>{response && <span className="text-xs text-slate-400">{Object.keys(response.headers).length} headers</span>}</div>{error && <div role="alert" className="m-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}{!response && !error && <div className="p-8 text-center sm:p-12"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-[var(--brand)]"><Send size={20} /></div><h2 className="mt-4 text-sm font-semibold">No response yet</h2><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Send a request to inspect its status, timing, headers, and body.</p></div>}{response && <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_260px]"><div>{response.bodyTruncated && <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">The response body was cut off at 1 MB to protect the app.</p>}<p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Body</p><pre className="max-h-[420px] min-h-48 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100">{formatBody(response.body)}</pre></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Headers</p><div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200">{Object.entries(response.headers).map(([key, value]) => <div key={key} className="border-b border-slate-100 p-3 last:border-b-0"><p className="break-all text-xs font-semibold text-slate-700">{key}</p><p className="mt-1 break-all text-xs leading-5 text-slate-500">{value}</p></div>)}</div></div></div>}</section>
        </form></>}</section>
    </div>
  </main>;
}
