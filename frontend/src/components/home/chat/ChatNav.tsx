import { FiSidebar } from "react-icons/fi";
import { IoIosAddCircle } from "react-icons/io";
import type { History } from "./useChat";

type ChatNavProps = {
  isNavOpen: boolean;
  histories: History[];
  currentHistoryId: string;
  onToggleNav: () => void;
  onNewHistory: () => void;
  onSelectHistory: (id: string) => void;
};

export default function ChatNav({
  isNavOpen,
  histories,
  currentHistoryId,
  onToggleNav,
  onNewHistory,
  onSelectHistory,
}: ChatNavProps) {
  return (
    <nav
      className={`flex flex-col p-2 gap-1 border-r border-slate-300 dark:border-slate-600 ${isNavOpen ? "w-50" : "w-14"} transition-[width] duration-300`}
    >
      <button className="nav-item flex h-10 justify-end" onClick={onToggleNav}>
        <FiSidebar className="h-full w-auto shrink-0" />
      </button>
      <button className="nav-item flex h-10 flex-row gap-2" onClick={onNewHistory}>
        <IoIosAddCircle className="h-full w-auto shrink-0" />
        <p
          className={`whitespace-nowrap transition-opacity duration-200 ${isNavOpen ? "opacity-100 delay-150" : "opacity-0"}`}
        >
          新規作成
        </p>
      </button>
      <ul
        className="history-list custom-scrollbar space-y-1 overflow-y-auto flex-1 min-h-0"
        style={
          {
            "--active-anchor": `--hist-${currentHistoryId.replace(/[:.]/g, "-")}`,
          } as React.CSSProperties
        }
      >
        {[...histories]
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .map((h) => (
            <li
              key={h.id}
              style={{ anchorName: `--hist-${h.id.replace(/[:.]/g, "-")}` } as React.CSSProperties}
              className="nav-item relative z-10"
              onClick={() => onSelectHistory(h.id)}
            >
              {h.name}
            </li>
          ))}
      </ul>
    </nav>
  );
}
