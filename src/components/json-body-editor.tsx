"use client";

import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { useMemo } from "react";

export default function JsonBodyEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const isValid = useMemo(() => { try { JSON.parse(value); return true; } catch { return false; } }, [value]);
  return <div className="space-y-2"><CodeMirror value={value} height="260px" extensions={[json()]} onChange={onChange} theme="dark" basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }} aria-label="JSON request body" className="overflow-hidden rounded-xl border border-slate-700 text-sm" /><p role="status" className={`text-xs ${isValid ? "text-emerald-600" : "text-rose-600"}`}>{isValid ? "Valid JSON" : "JSON needs attention before sending"}</p></div>;
}
