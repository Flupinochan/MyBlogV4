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
          ${isActive ? "bg-violet-500/35 hover:bg-violet-500/80" : "hover:bg-slate-100/80 dark:hover:bg-slate-800/80"}`}
    >
      <span className="uppercase">{label}</span>
    </button>
  );
};
