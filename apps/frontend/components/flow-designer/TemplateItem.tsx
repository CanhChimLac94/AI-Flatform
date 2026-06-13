"use client";

interface TemplateItemProps {
  label: string;
  description: string;
  icon: string;
  onClick: () => void;
}

export function TemplateItem({ label, description, icon, onClick }: TemplateItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group w-full cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/40 transition-colors">
          <span className="material-symbols-outlined text-[16px] text-blue-300">{icon}</span>
        </div>
        <span className="text-[11px] font-bold text-white/90">{label}</span>
      </div>
      <p className="text-[9px] text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
        {description}
      </p>
    </button>
  );
}
