import "./ToolTable.css";
import { Badge } from "../../layout/Badge";
import type { BadgeColor } from "../../layout/badge.types";
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
import { Fragment, useEffect, useRef, useState } from "react";
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
const PLATFORMS = [
  "Web",
  "Android",
  "iOS",
  "Windows",
  "Mac",
  "Chrome Extension",
  "VSCode Extension",
] as const;
type Platform = (typeof PLATFORMS)[number];
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

const stringFilterOperators = [
  "includesString",
  "includesStringSensitive",
  "equalsString",
  "equalsStringSensitive",
];
type StringFilterOperator = (typeof stringFilterOperators)[number];
type StringFilterValue = {
  operator: StringFilterOperator;
  value: string;
};

const dateFilterOperators = ["beforeDate", "afterDate"];
type DateFilterOperator = (typeof dateFilterOperators)[number];
type DateFilterValue = {
  operator: DateFilterOperator;
  value: string;
};

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

const STATUS_BADGE_COLOR: Record<Status, BadgeColor> = {
  Active: "emerald",
  Inactive: "rose",
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

// string用カスタムフィルタ関数 (falseの場合に対象の行が除外される)
const stringFilter: FilterFn<Tool> = (
  row,
  columnId,
  filterValue: StringFilterValue,
) => {
  const cellString = String(row.getValue(columnId) ?? "").trim();
  const inputString = String(filterValue.value ?? "").trim();
  // filterValueが空の場合は表示
  if (!inputString) return true;

  switch (filterValue.operator as StringFilterOperator) {
    case "includesString":
      return cellString.toLowerCase().includes(inputString.toLowerCase());
    case "includesStringSensitive":
      return cellString.includes(inputString);
    case "equalsString":
      return cellString.toLowerCase() === inputString.toLowerCase();
    case "equalsStringSensitive":
      return cellString === inputString;
    default:
      return true;
  }
};

// platform用カスタムフィルタ関数
const platformFilter: FilterFn<Tool> = (
  row,
  columnId,
  filterValue: Platform,
) => {
  if (!filterValue) return true;
  const cellValue = row.getValue(columnId) as Platform;
  return cellValue === filterValue;
};

// skills用カスタムフィルタ関数
const skillsFilter: FilterFn<Tool> = (row, columnId, filterValue: Skill) => {
  if (!filterValue) return true;
  const cellValue = row.getValue(columnId) as Skill[];
  return cellValue.some(
    (skill) => skill.toLowerCase() === filterValue.toLowerCase(),
  );
};

// status用カスタムフィルタ関数
const statusFilter: FilterFn<Tool> = (row, columnId, filterValue: Status) => {
  if (!filterValue) return true;
  const cellValue = row.getValue(columnId) as Status;
  return cellValue === filterValue;
};

// createdAt用カスタムフィルタ関数
const dateFilter: FilterFn<Tool> = (
  row,
  columnId,
  filterValue: DateFilterValue,
) => {
  if (!filterValue || !filterValue.value) return true;

  const cellValue = row.getValue(columnId);
  if (!cellValue) return false;

  const cellDate = new Date(String(cellValue).trim().replaceAll("/", "-"));
  const inputDate = new Date(filterValue.value.trim().replaceAll("/", "-"));

  // 無効な日付データの場合は表示
  if (isNaN(cellDate.getTime()) || isNaN(inputDate.getTime())) return true;

  const cellTime = new Date(
    cellDate.getFullYear(),
    cellDate.getMonth(),
    cellDate.getDate(),
  ).getTime();
  const inputTime = new Date(
    inputDate.getFullYear(),
    inputDate.getMonth(),
    inputDate.getDate(),
  ).getTime();

  switch (filterValue.operator) {
    case "beforeDate":
      return cellTime <= inputTime;
    case "afterDate":
      return cellTime >= inputTime;
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
    filterFn: platformFilter,
    cell: (info) => (
      <Badge color="slate" rounded="md" border>
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("skills", {
    header: "Skills",
    filterFn: skillsFilter,
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
    filterFn: statusFilter,
    cell: (info) => (
      <Badge
        color={STATUS_BADGE_COLOR[info.getValue() as Status]}
        rounded="md"
        border
      >
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: "Created At",
    filterFn: dateFilter,
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
    useState<StringFilterOperator>("includesString");
  const [filterValue, setFilterValue] = useState<string>("");

  // sort change with view transition
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

  // column visibility change with view transition
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

  // filter change with view transition
  const handleFilterChange: OnChangeFn<ColumnFiltersState> = (
    updaterOrValue,
  ) => {
    const container = scrollContainerRef.current;

    if (!container?.startViewTransition) {
      setColumnFilters(updaterOrValue);
      return;
    }

    setRowUpdating(true);
    container
      .startViewTransition(() => {
        flushSync(() => {
          setColumnFilters(updaterOrValue);
        });
      })
      .finished.finally(() => {
        setRowUpdating(false);
      });
  };

  // filter
  const applyFilter = (
    columnId: string,
    operator: StringFilterOperator,
    value: string,
  ) => {
    // 変更前も変更後のFilterValueが空の場合は何もしない
    // DOMに変更がないのにView Transitionするとエラーが発生するため
    const currentFilters = table.getState().columnFilters;
    if (!value && currentFilters.length === 0) return;

    const nextFilters: ColumnFiltersState = value
      ? [
          {
            id: columnId,
            value:
              columnId === "skills" ||
              columnId === "status" ||
              columnId === "platform"
                ? value
                : { operator, value },
          },
        ]
      : [];

    table.setColumnFilters(nextFilters);
  };

  // 300msのdebounceでフィルタを適用
  useEffect(() => {
    const isDateCol = selectedColumnId === "createdAt";
    const isSpecialCol =
      selectedColumnId === "skills" ||
      selectedColumnId === "status" ||
      selectedColumnId === "platform";

    // 選択されているoperatorが対象のcolumnで利用可能か判定
    const isCompatible = isSpecialCol
      ? true
      : isDateCol
        ? dateFilterOperators.includes(selectedOperator)
        : stringFilterOperators.includes(selectedOperator);

    if (isCompatible) {
      const timer = setTimeout(() => {
        applyFilter(selectedColumnId, selectedOperator, filterValue);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [filterValue, selectedColumnId, selectedOperator]);

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
    onColumnFiltersChange: handleFilterChange,
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
                   bg-slate-400/35 backdrop-blur-md
                   text-slate-700 dark:text-slate-100
                   top-[anchor(bottom)] right-[anchor(right)]"
      >
        <div className="flex flex-col">
          <ToggleButton
            label="All"
            isActive={table.getAllColumns().every((col) => col.getIsVisible())}
            onClick={() => table.toggleAllColumnsVisible()}
          />
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
          className="flex flex-row gap-8 p-2
                   z-2 fixed inset-auto min-w-50
                   bg-slate-400/35 backdrop-blur-md
                   text-slate-700 dark:text-slate-100
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
                setFilterValue("");
                const nextColumnId = e.target.value as ToolColumn;
                setSelectedColumnId(nextColumnId);
              }}
            >
              <button>
                <div>
                  <selectedcontent className="text-slate-700 dark:text-slate-100"></selectedcontent>
                  <svg className="select-arrow size-6" viewBox="0 0 24 24">
                    <path fill="currentColor" d="m7 10l5 5l5-5z" />
                  </svg>
                </div>
              </button>

              <optgroup className="bg-slate-400/35 backdrop-blur-md">
                {table.getAllLeafColumns().map((column) => (
                  <option
                    key={column.id}
                    value={column.id}
                    className="text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                  >
                    <span>{column.id}</span>
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Operators */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Operators</label>
            {selectedColumnId === "skills" ||
            selectedColumnId === "status" ||
            selectedColumnId === "platform" ? (
              <div className="text-sm text-slate-400 filter-select">Equals</div>
            ) : (
              <select
                id="operator-select"
                className="filter-select"
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
              >
                <button>
                  <div>
                    <selectedcontent className="text-slate-700 dark:text-slate-100"></selectedcontent>
                    <svg className="select-arrow size-6" viewBox="0 0 24 24">
                      <path fill="currentColor" d="m7 10l5 5l5-5z" />
                    </svg>
                  </div>
                </button>

                <optgroup className="bg-slate-400/35 backdrop-blur-md">
                  {(selectedColumnId === "createdAt"
                    ? dateFilterOperators
                    : stringFilterOperators
                  ).map((operator) => (
                    <option
                      key={operator}
                      value={operator}
                      className="text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                    >
                      <span>{operator}</span>
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>

          {/* Value */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Value</label>
            {selectedColumnId === "skills" ? (
              <select
                id="skill-value-select"
                className="filter-select"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              >
                <button>
                  <div>
                    <selectedcontent className="text-slate-700 dark:text-slate-100"></selectedcontent>
                    <svg className="select-arrow size-6" viewBox="0 0 24 24">
                      <path fill="currentColor" d="m7 10l5 5l5-5z" />
                    </svg>
                  </div>
                </button>

                <div className="custom-scrollbar">
                  <optgroup className="bg-slate-400/35 backdrop-blur-md">
                    <option
                      value=""
                      className="text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                    >
                      <span>All</span>
                    </option>
                    {Object.entries(SKILL_SVG_MAP).map(([skill, icon]) => (
                      <option
                        key={skill}
                        value={skill}
                        className="text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                      >
                        {icon}
                      </option>
                    ))}
                  </optgroup>
                </div>
              </select>
            ) : selectedColumnId === "status" ? (
              <select
                id="status-value-select"
                className="filter-select"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              >
                <button>
                  <div>
                    <selectedcontent className="text-slate-700 dark:text-slate-100"></selectedcontent>
                    <svg className="select-arrow size-6" viewBox="0 0 24 24">
                      <path fill="currentColor" d="m7 10l5 5l5-5z" />
                    </svg>
                  </div>
                </button>

                <div className="custom-scrollbar">
                  <optgroup className="bg-slate-400/35 backdrop-blur-md">
                    <option
                      value=""
                      className="text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                    >
                      <span>All</span>
                    </option>
                    {(Object.keys(STATUS_BADGE_COLOR) as Status[]).map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                          className="text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                        >
                          <Badge
                            color={STATUS_BADGE_COLOR[status]}
                            rounded="md"
                            border
                          >
                            {status}
                          </Badge>
                        </option>
                      ),
                    )}
                  </optgroup>
                </div>
              </select>
            ) : selectedColumnId === "platform" ? (
              <select
                id="platform-value-select"
                className="filter-select"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              >
                <button>
                  <div>
                    <selectedcontent className="text-slate-700 dark:text-slate-100"></selectedcontent>
                    <svg className="select-arrow size-6" viewBox="0 0 24 24">
                      <path fill="currentColor" d="m7 10l5 5l5-5z" />
                    </svg>
                  </div>
                </button>

                <div className="custom-scrollbar">
                  <optgroup className="bg-slate-400/35 backdrop-blur-md">
                    <option
                      value=""
                      className="text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                    >
                      <span>All</span>
                    </option>
                    {PLATFORMS.map((platform) => (
                      <option
                        key={platform}
                        value={platform}
                        className="text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                      >
                        <Badge color="slate" rounded="md" border>
                          {platform}
                        </Badge>
                      </option>
                    ))}
                  </optgroup>
                </div>
              </select>
            ) : (
              <input
                className="text-slate-700 dark:text-slate-100 border-b border-slate-400 transition-colors duration-200 focus:border-violet-500 filter-select"
                value={filterValue}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setFilterValue(nextValue);
                }}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 mb-2 mt-20">
        {/* SELECT COLUMNS */}
        <button
          popoverTarget="col-visibility-switch-menu"
          className="tools-columns-open-button rounded-lg border border-violet-500 px-3 py-1.5 cursor-pointer
                      text-xs font-medium text-violet-600
                      transition hover:bg-violet-500/20 active:scale-95"
        >
          SELECT COLUMNS
        </button>

        {/* FILTER COLUMNS */}
        <button
          className="tools-columns-open-button rounded-lg border border-violet-500 px-3 py-1.5 cursor-pointer
                      text-xs font-medium text-violet-600
                      transition hover:bg-violet-500/20 active:scale-95"
          onClick={() => setFilterColumnsOpen((prev) => !prev)}
        >
          FILTER COLUMNS
        </button>
      </div>

      {/* table */}
      <div
        className="tool-table overflow-hidden rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
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
          className="overflow-auto h-62.5 custom-scrollbar"
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
                  className="tool-table-row absolute flex w-full items-center border-b border-slate-200 dark:border-slate-800 
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
