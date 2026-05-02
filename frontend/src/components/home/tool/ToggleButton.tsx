interface ToggleButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const ToggleButton = ({
  label,
  isActive,
  onClick,
}: ToggleButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1.5 text-left transition-all text-sm
          ${
            isActive
              ? "text-slate-900 dark:text-slate-100 bg-violet-500/35 hover:bg-violet-500/80"
              : "text-slate-100 dark:text-slate-900 bg-slate-950/50 dark:bg-white/50 hover:bg-slate-950/80 dark:hover:bg-white/80"
          }`}
    >
      <span className="uppercase">{label}</span>
    </button>
  );
};
