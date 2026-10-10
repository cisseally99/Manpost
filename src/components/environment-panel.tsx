"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Variable = { id: string; key: string; value: string; enabled: boolean };
type Environment = { id: string; name: string; variables: Variable[] };

const initialEnvironment: Environment = { id: "local", name: "Local", variables: [] };

export default function EnvironmentPanel({ email, onVariablesChange }: { email: string; onVariablesChange: (variables: Variable[]) => void }) {
  const storageKey = `manpost:environments:${encodeURIComponent(email.toLowerCase())}`;
  const [environments, setEnvironments] = useState<Environment[]>([initialEnvironment]);
  const [activeId, setActiveId] = useState(initialEnvironment.id);
  const [loaded, setLoaded] = useState(false);
  const activeEnvironment = useMemo(() => environments.find((environment) => environment.id === activeId) ?? environments[0], [activeId, environments]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const data = JSON.parse(stored) as { environments?: Environment[]; activeId?: string };
          if (Array.isArray(data.environments) && data.environments.length && data.environments.every((environment) => typeof environment.id === "string" && typeof environment.name === "string" && Array.isArray(environment.variables))) {
            setEnvironments(data.environments);
            setActiveId(data.environments.some((environment) => environment.id === data.activeId) ? data.activeId! : data.environments[0].id);
          }
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ environments, activeId }));
    onVariablesChange(activeEnvironment?.variables ?? []);
  }, [activeEnvironment, activeId, environments, loaded, onVariablesChange, storageKey]);

  function addEnvironment() {
    const environment = { id: crypto.randomUUID(), name: `Environment ${environments.length + 1}`, variables: [] };
    setEnvironments((items) => [...items, environment]);
    setActiveId(environment.id);
  }

  function removeEnvironment() {
    if (environments.length <= 1 || !activeEnvironment) return;
    const remaining = environments.filter((environment) => environment.id !== activeEnvironment.id);
    setEnvironments(remaining);
    setActiveId(remaining[0].id);
  }

  function updateActive(update: (environment: Environment) => Environment) {
    if (!activeEnvironment) return;
    setEnvironments((items) => items.map((environment) => environment.id === activeEnvironment.id ? update(environment) : environment));
  }

  return <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="environment-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="environment-heading" className="text-sm font-semibold">Environments</h2><p className="mt-1 text-xs text-slate-500">Use <code>{"{{variableName}}"}</code> in your URL, headers, or JSON body.</p></div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="active-environment">Active environment</label>
        <select id="active-environment" value={activeEnvironment?.id ?? ""} onChange={(event) => setActiveId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
        </select>
        <button type="button" onClick={addEnvironment} aria-label="Add environment" className="rounded-lg p-2 text-[var(--brand)] hover:bg-violet-50"><Plus size={17} /></button>
        <button type="button" onClick={removeEnvironment} disabled={environments.length <= 1} aria-label="Delete active environment" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 size={16} /></button>
      </div>
    </div>
    {activeEnvironment && <div className="mt-4 space-y-2">
      <label className="sr-only" htmlFor="environment-name">Environment name</label>
      <input id="environment-name" value={activeEnvironment.name} onChange={(event) => updateActive((environment) => ({ ...environment, name: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:max-w-xs" aria-label="Environment name" />
      {activeEnvironment.variables.map((variable, index) => <div key={variable.id} className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-2">
        <input type="checkbox" checked={variable.enabled} aria-label={`Enable variable ${index + 1}`} onChange={() => updateActive((environment) => ({ ...environment, variables: environment.variables.map((item) => item.id === variable.id ? { ...item, enabled: !item.enabled } : item) }))} className="mx-auto accent-[var(--brand)]" />
        <input value={variable.key} aria-label={`Variable ${index + 1} name`} onChange={(event) => updateActive((environment) => ({ ...environment, variables: environment.variables.map((item) => item.id === variable.id ? { ...item, key: event.target.value } : item) }))} placeholder="Variable name" className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input value={variable.value} aria-label={`Variable ${index + 1} value`} onChange={(event) => updateActive((environment) => ({ ...environment, variables: environment.variables.map((item) => item.id === variable.id ? { ...item, value: event.target.value } : item) }))} placeholder="Value" className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button type="button" aria-label={`Remove variable ${index + 1}`} onClick={() => updateActive((environment) => ({ ...environment, variables: environment.variables.filter((item) => item.id !== variable.id) }))} className="mx-auto rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
      </div>)}
      <button type="button" onClick={() => updateActive((environment) => ({ ...environment, variables: [...environment.variables, { id: crypto.randomUUID(), key: "", value: "", enabled: true }] }))} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--brand)] hover:bg-violet-50"><Plus size={14} /> Add variable</button>
      <p className="text-xs leading-5 text-amber-700">Environment values are saved in this browser for this account. Don’t use this on a shared computer for secrets; browser storage is not encrypted.</p>
    </div>}
  </section>;
}
