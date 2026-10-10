type ManpostLogoProps = {
  size?: number;
};

export default function ManpostLogo({ size = 40 }: ManpostLogoProps) {
  return (
    <span className="inline-flex items-center gap-3">
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className="shrink-0"
      >
        <rect width="48" height="48" rx="15" fill="#39318F" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="14.25" stroke="white" strokeOpacity="0.16" strokeWidth="1.5" />
        <path
          d="M14.5 24h6.2m0 0c7.7 0 6.4-10 14.7-10m-14.7 10c7.7 0 6.4 10 14.7 10"
          stroke="white"
          strokeOpacity="0.92"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="11.5" cy="24" r="3.25" fill="#A7F3D0" />
        <circle cx="21" cy="24" r="4" fill="#A7F3D0" stroke="#39318F" strokeWidth="1.5" />
        <circle cx="35.5" cy="14" r="3" fill="#39318F" stroke="white" strokeWidth="2.2" />
        <circle cx="35.5" cy="34" r="3" fill="#39318F" stroke="white" strokeWidth="2.2" />
      </svg>
      <span className="leading-tight">
        <span className="block font-semibold tracking-tight text-slate-900">Manpost</span>
        <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.14em] text-slate-400">API workspace</span>
      </span>
    </span>
  );
}
