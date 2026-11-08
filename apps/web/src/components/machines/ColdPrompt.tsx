interface Props {
  machineName: string;
  onClose: () => void;
}

/** Shown after a 45-minute load is activated: the washer holds the credit but still has Hot selected, so staff pick COLD. */
export default function ColdPrompt({ machineName, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center">
        <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">{machineName} activated</div>
        <div className="mt-2 text-2xl font-extrabold text-zinc-900">Press COLD on the washer</div>
        <ol className="mt-4 space-y-2 text-left text-sm text-zinc-600">
          <li><span className="font-bold text-zinc-900">1.</span> Press the <span className="font-bold">COLD</span> button. The display shows 45 and the Start light blinks.</li>
          <li><span className="font-bold text-zinc-900">2.</span> Press <span className="font-bold">Start</span> on the washer.</li>
        </ol>
        <p className="mt-3 text-xs text-zinc-400">If it doesn't show 45, press Activate again.</p>
        <button
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-xl bg-[#009eb5] text-sm font-bold text-white hover:bg-[#007a8c] transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
