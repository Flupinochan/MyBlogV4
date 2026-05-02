import "./ToolTable.css";
import { LuChevronDown } from "react-icons/lu";
import { LuChevronUp } from "react-icons/lu";
import { flushSync } from "react-dom";
import { FaReact } from "react-icons/fa";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  createColumnHelper,
  getFilteredRowModel,
} from "@tanstack/react-table";
import type {
  ColumnFiltersState,
  FilterFn,
  OnChangeFn,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
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
import toolRowJson from "./tool.json";
import { ToggleButton } from "./ToggleButton";

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

const filterOperators = [
  "includesString",
  "includesStringSensitive",
  "equalsString",
  "equalsStringSensitive",
];
type FilterOperator = (typeof filterOperators)[number];

interface Tool {
  id: string;
  name: string;
  url: string;
  description: string;
  skills: Skill[];
  platform: Platform;
  status: Status;
  createdAt: string;
}
type ToolColumn = keyof Tool;

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

const toolData = toolRowJson as Tool[];

type filterValue = {
  operator: FilterOperator;
  value: string;
};

// string用カスタムフィルタ関数 (falseの場合に対象の行が除外される)
const stringFilter: FilterFn<Tool> = (
  row,
  columnId,
  filterValue: filterValue,
) => {
  if (!filterValue || !filterValue.value) return true;

  const cellValue = row.getValue(columnId);
  const cellString = String(cellValue ?? "").trim();
  const inputString = String(filterValue.value ?? "").trim();

  // filterValueが空の場合は全ての行を表示
  if (!inputString) return true;

  switch (filterValue.operator as FilterOperator) {
    case "includesString":
      console.log("Comparing:", {
        cellString,
        inputString,
        result: cellString.toLowerCase().includes(inputString.toLowerCase()),
      });
      return cellString.toLowerCase().includes(inputString.toLowerCase());
    case "includesStringSensitive":
      console.log("Comparing (case-sensitive):", {
        cellString,
        inputString,
        result: cellString.includes(inputString),
      });
      return cellString.includes(inputString);
    case "equalsString":
      console.log("Comparing (equals):", {
        cellString,
        inputString,
        result: cellString.toLowerCase() === inputString.toLowerCase(),
      });
      return cellString.toLowerCase() === inputString.toLowerCase();
    case "equalsStringSensitive":
      console.log("Comparing (equals, case-sensitive):", {
        cellString,
        inputString,
        result: cellString === inputString,
      });
      return cellString === inputString;
    default:
      return true;
  }
};

const columnHelper = createColumnHelper<Tool>();
const defaultColumns = [
  columnHelper.accessor("name", {
    header: "Name",
    filterFn: stringFilter,
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
    filterFn: stringFilter,
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("platform", {
    header: "Platform",
    filterFn: stringFilter,
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("skills", {
    header: "Skills",
    filterFn: stringFilter,
    // 昇順/降順の判定を逆転
    invertSorting: true,
    // 配列の1要素目でソート
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.skills[0] ?? "";
      const b = rowB.original.skills[0] ?? "";
      return a.localeCompare(b);
    },
    cell: (info) => (
      <div className="flex flex-wrap gap-1">
        {info.getValue().map((skill) => (
          <Fragment key={`${info.row.id}-${skill}`}>
            {SKILL_SVG_MAP[skill as Skill]}
          </Fragment>
        ))}
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    filterFn: stringFilter,
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
    filterFn: stringFilter,
    sortDescFirst: true,
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

const SortIcon = ({
  isSorted,
  invert = false,
}: {
  isSorted: false | "asc" | "desc";
  invert?: boolean;
}) => (
  <span className="flex flex-col">
    <LuChevronUp
      className={`size-4 -mb-1 ${isSorted === (invert ? "desc" : "asc") ? "text-violet-500" : "opacity-30"}`}
    />
    <LuChevronDown
      className={`size-4 ${isSorted === (invert ? "asc" : "desc") ? "text-violet-500" : "opacity-30"}`}
    />
  </span>
);

export default function ToolTable() {
  const [filterColumnsOpen, setFilterColumnsOpen] = useState(false);
  const [rowUpdating, setRowUpdating] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "status", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    createdAt: false,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedColumnId, setSelectedColumnId] = useState<ToolColumn>("name");
  const [selectedOperator, setSelectedOperator] =
    useState<FilterOperator>("includesString");
  const [filterValue, setFilterValue] = useState<string>("");

  // sort
  const handleSortingChange: OnChangeFn<SortingState> = (updaterOrValue) => {
    const container = scrollContainerRef.current;

    if (!container?.startViewTransition) {
      setSorting(updaterOrValue);
      return;
    }

    setRowUpdating(true);
    container
      .startViewTransition(() => {
        flushSync(() => {
          setSorting(updaterOrValue);
        });
      })
      .finished.finally(() => {
        setRowUpdating(false);
      });
  };

  // column visibility
  const handleVisibilityChange: OnChangeFn<VisibilityState> = (
    updaterOrValue,
  ) => {
    const container = scrollContainerRef.current;

    if (!container?.startViewTransition) {
      setColumnVisibility(updaterOrValue);
      return;
    }

    setRowUpdating(true);
    container
      .startViewTransition(() => {
        flushSync(() => {
          setColumnVisibility(updaterOrValue);
        });
      })
      .finished.finally(() => {
        setRowUpdating(false);
      });
  };

  // filter
  const applyFilter = (
    columnId: string,
    operator: FilterOperator,
    value: string,
  ) => {
    const column = table.getColumn(columnId);
    if (!column) return;
    // filterValueにoperatorとvalueをまとめて渡す
    column.setFilterValue({
      operator: operator,
      value: value,
    } as filterValue);
  };

  // Tanstack Table Hook
  const table = useReactTable({
    columns: defaultColumns,
    data: toolData,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: handleVisibilityChange,
    onColumnFiltersChange: setColumnFilters,
  });

  // Tanstack Virtual Table
  const { rows } = table.getRowModel();
  const virtualizer = useVirtualizer({
    getScrollElement: () => scrollContainerRef.current,
    count: rows.length,
    estimateSize: () => 50, // height: `${virtualRow.size}px` で各行の高さとして参照される
    overscan: 5,
    gap: 0,
    useFlushSync: false,
    horizontal: false,
  });

  return (
    <>
      {/* SELECT COLUMNS (Popover + Anchor CSSでtable headerの右下に表示) */}
      <div
        id="col-visibility-switch-menu"
        popover="auto"
        style={{ positionAnchor: "--header-area" }}
        className="z-2 fixed inset-auto min-w-50
                   bg-transparent backdrop-blur-sm
                   top-[anchor(bottom)] right-[anchor(right)]"
      >
        <div className="flex flex-col">
          <ToggleButton
            label="All"
            isActive={table.getAllColumns().every((col) => col.getIsVisible())}
            onClick={() => table.toggleAllColumnsVisible()}
          />
          <div className="h-px bg-slate-200" />
          {table.getAllLeafColumns().map((column) => (
            <ToggleButton
              key={column.id}
              label={column.id}
              isActive={column.getIsVisible()}
              onClick={() => column.toggleVisibility(!column.getIsVisible())}
            />
          ))}
        </div>
      </div>

      {/* FILTER COLUMNS (PopoverとCustomizable Selectは競合するため利用不可) */}
      {filterColumnsOpen && (
        <div
          id="filter-columns-menu"
          style={{ positionAnchor: "--header-area" }}
          className="flex flex-row gap-8 p-2 pb-3
                   z-2 fixed inset-auto min-w-50
                   bg-slate-500/35 backdrop-blur-sm text-white
                   top-[anchor(bottom)] right-[anchor(right)]"
        >
          {/* Columns */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Columns</label>
            <select
              id="column-select"
              className="filter-select"
              value={selectedColumnId}
              onChange={(e) => {
                const nextColumnId = e.target.value as ToolColumn;
                setSelectedColumnId(nextColumnId);
                applyFilter(nextColumnId, selectedOperator, filterValue);
              }}
            >
              <button>
                <div>
                  <selectedcontent></selectedcontent>
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="m7 10l5 5l5-5z" />
                  </svg>
                </div>
              </button>

              {table.getAllLeafColumns().map((column) => (
                <option key={column.id} value={column.id}>
                  <span>{column.id}</span>
                </option>
              ))}
            </select>
          </div>

          {/* Operators */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Operators</label>
            <select
              id="operator-select"
              className="filter-select"
              value={selectedOperator}
              onChange={(e) => {
                const nextOperation = e.target.value as FilterOperator;
                setSelectedOperator(nextOperation);
                applyFilter(selectedColumnId, nextOperation, filterValue);
              }}
            >
              <button>
                <div>
                  <selectedcontent></selectedcontent>
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="m7 10l5 5l5-5z" />
                  </svg>
                </div>
              </button>

              {filterOperators.map((operator) => (
                <option key={operator} value={operator}>
                  <span>{operator}</span>
                </option>
              ))}
            </select>
          </div>

          {/* Value */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Value</label>
            <input
              className="border-b border-slate-500 transition-colors duration-200 focus:border-violet-500"
              onChange={(e) => {
                const nextValue = e.target.value;
                setFilterValue(nextValue);
                applyFilter(selectedColumnId, selectedOperator, nextValue);
              }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 mb-2 mt-20">
        {/* SELECT COLUMNS */}
        <button
          popoverTarget="col-visibility-switch-menu"
          className="rounded-lg border border-violet-500 px-3 py-1.5
                      text-xs font-medium text-violet-600
                      transition hover:bg-violet-500/20 active:scale-95"
        >
          SELECT COLUMNS
        </button>

        {/* FILTER COLUMNS */}
        <button
          className="rounded-lg border border-violet-500 px-3 py-1.5
                      text-xs font-medium text-violet-600
                      transition hover:bg-violet-500/20 active:scale-95"
          onClick={() => setFilterColumnsOpen((prev) => !prev)}
        >
          FILTER COLUMNS
        </button>
      </div>

      {/* table */}
      <div
        className="overflow-hidden rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
        role="table"
        aria-label="作成したツール一覧"
      >
        {/* header */}
        <div
          // anchor
          style={{ anchorName: "--header-area" }}
          className="pr-2 flex w-full border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60"
          role="rowgroup"
        >
          {table.getHeaderGroups().map((hg) => (
            <div key={hg.id} className="flex w-full" role="row">
              {hg.headers.length > 0 ? (
                hg.headers.map((header) => (
                  <div
                    key={header.id}
                    className="h-12 flex items-center flex-1 px-3 text-xs font-semibold tracking-wider text-slate-500"
                    role="columnheader"
                  >
                    {header.column.getCanSort() ? (
                      <button
                        onClick={header.column.getToggleSortingHandler()}
                        className="uppercase flex items-center gap-1 mr-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <SortIcon
                          isSorted={header.column.getIsSorted()}
                          invert={header.column.columnDef.invertSorting}
                        />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </div>
                ))
              ) : (
                <p className="h-12 px-3 flex items-center text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  No columns selected
                </p>
              )}
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
                  className="absolute flex w-full items-center border-b border-slate-200 dark:border-slate-800 
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
