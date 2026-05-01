import "./ToolTable.css";
import { flushSync } from "react-dom";
import { FaReact } from "react-icons/fa";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  createColumnHelper,
} from "@tanstack/react-table";
import { toolData } from "./tableData";
import { Fragment, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TbBrandTypescript } from "react-icons/tb";
import { AiOutlinePython } from "react-icons/ai";
import { FaVuejs } from "react-icons/fa";
import { FaFlutter } from "react-icons/fa6";
import { IoLogoElectron } from "react-icons/io5";
import { TbBrandCSharp } from "react-icons/tb";
import { IoExtensionPuzzleOutline } from "react-icons/io5";
import { MdOpenInNew } from "react-icons/md";
import { VscVscode } from "react-icons/vsc";

type Status = "Active" | "Inactive";
type Platform =
  | "Web"
  | "Android"
  | "iOS"
  | "Windows"
  | "Mac"
  | "Chrome Extension"
  | "VSCode Extension";
type Skill =
  | "TypeScript"
  | "Python"
  | "React"
  | "Vue"
  | "Flutter"
  | "Electron"
  | "C#"
  | "Chrome Extension"
  | "VSCode Extension";

export interface Tool {
  id: string;
  name: string;
  url: string;
  description: string;
  skills: Skill[];
  platform: Platform;
  status: Status;
  createdAt: string;
}

const STATUS_COLOR_MAP: Record<Status, string> = {
  Active: "var(--color-emerald-500)",
  Inactive: "var(--color-rose-500)",
} as const;

const SKILL_SVG_MAP: Record<Skill, React.ReactNode> = {
  TypeScript: <TbBrandTypescript className="size-6 text-blue-500" />,
  Python: <AiOutlinePython className="size-6 text-yellow-500" />,
  React: <FaReact className="size-6 text-cyan-500" />,
  Vue: <FaVuejs className="size-6 text-green-500" />,
  Flutter: <FaFlutter className="size-6 text-blue-400" />,
  Electron: <IoLogoElectron className="size-6 text-cyan-400" />,
  "C#": <TbBrandCSharp className="size-6 text-purple-500" />,
  "Chrome Extension": (
    <IoExtensionPuzzleOutline className="size-6 text-emerald-500" />
  ),
  "VSCode Extension": <VscVscode className="size-6 text-sky-500" />,
} as const;

const columnHelper = createColumnHelper<Tool>();
const defaultColumns = [
  columnHelper.accessor("name", {
    header: "Name",
    cell: (info) => (
      <a
        href={info.row.original.url}
        target="_blank"
        rel="noopener"
        className="text-blue-500 hover:underline flex flex-row items-center gap-1 "
      >
        {info.getValue()} <MdOpenInNew className="size-4 translate-y-px" />
      </a>
    ),
  }),
  columnHelper.accessor("description", {
    header: "Description",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("platform", {
    header: "Platform",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("skills", {
    header: "Skills",
    cell: (info) => (
      <div className="flex flex-wrap gap-1">
        {info.getValue().map((skill) => (
          <Fragment key={skill}>{SKILL_SVG_MAP[skill as Skill]}</Fragment>
        ))}
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      return (
        <span
          className={`rounded-md border border-current/30 bg-current/10 px-2 py-0.5 text-[11px] font-medium leading-none`}
          style={{ color: STATUS_COLOR_MAP[info.getValue() as Status] }}
        >
          {info.getValue()}
        </span>
      );
    },
  }),
  columnHelper.accessor("createdAt", {
    header: "Created At",
    cell: (info) => {
      const date = new Date(info.getValue());
      return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    },
  }),
];

export default function ToolTable() {
  const [data, setData] = useState(() => [...toolData]);
  const [rowUpdating, setRowUpdating] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Tanstack Table Hook
  const table = useReactTable({
    columns: defaultColumns,
    data: data,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      columnVisibility: {
        createdAt: false, // invisible by default
      },
    },
  });

  // random sort
  const handleRandomSort = async () => {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    const container = scrollContainerRef.current;

    if (!container?.startViewTransition) {
      setData(shuffled);
      return;
    }

    try {
      // view-transition-name付与
      setRowUpdating(true);
      await container.startViewTransition(() => {
        flushSync(() => {
          // view-transition対象のDOM更新
          setData(shuffled);
        });
      }).finished;
    } finally {
      // view-transition-name削除
      setRowUpdating(false);
    }
  };

  // Tanstack Virtual Table
  const { rows } = table.getRowModel();
  const virtualizer = useVirtualizer({
    getScrollElement: () => scrollContainerRef.current,
    count: rows.length,
    estimateSize: () => 50, // height: `${virtualRow.size}px` で各行の高さとして参照される
    overscan: 1,
    gap: 0,
    useFlushSync: false,
    horizontal: false,
  });
  return (
    // table
    <div
      className="mt-20 overflow-hidden rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
      role="table"
      aria-label="作成したツール一覧"
    >
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleRandomSort}
          className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
        >
          🔀 ランダムに並び替え
        </button>
      </div>

      {/* header */}
      <div
        className="pr-2 flex w-full border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60"
        role="rowgroup"
      >
        {table.getHeaderGroups().map((hg) => (
          <div key={hg.id} className="flex w-full" role="row">
            {hg.headers.map((header) => (
              <div
                key={header.id}
                className="flex-1 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                role="columnheader"
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* body */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto max-h-62.5 custom-scrollbar"
        role="rowgroup"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                className="absolute flex w-full items-center border-b border-slate-100 dark:border-slate-800 
                hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  // rowUpdating=trueの時のみ動的にview-transition-nameを付与
                  viewTransitionClass: rowUpdating ? "row-item" : "none",
                  viewTransitionName: rowUpdating
                    ? `row-${row.original.id}`
                    : "none",
                }}
                role="row"
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className="flex flex-1 self-stretch items-center truncate px-3 text-sm text-slate-700 dark:text-slate-300"
                    role="cell"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
