import { useEffect, useRef, useState, useCallback } from "react";
import {
  COLOR_MAP,
  type CursorColor,
  type CursorShape,
} from "../../layouts/ThemeColor";

interface CursorState {
  x: number;
  y: number;
  shape: CursorShape;
  color: CursorColor;
  isHovering: boolean;
  hoverLabel: string | null;
}

const LERP_FACTOR = 0.1;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function StarPath({ size }: { size: number }) {
  const r = size / 2;
  const innerR = r * 0.42;
  const points = 5;
  const coords: string[] = [];

  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : innerR;
    coords.push(
      `${r + radius * Math.cos(angle)},${r + radius * Math.sin(angle)}`,
    );
  }

  return (
    <polygon
      points={coords.join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  );
}

function CrossPath({ size }: { size: number }) {
  const t = size * 0.28;
  const s = size;
  return (
    <path
      d={`M${t},0 H${s - t} V${t} H${s} V${s - t} H${s - t} V${s} H${t} V${s - t} H0 V${t} H${t} Z`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  );
}

function CursorSVG({
  shape,
  color,
  isHovering,
}: {
  shape: CursorShape;
  color: CursorColor;
  isHovering: boolean;
}) {
  const size = isHovering ? 48 : 32;
  const hex = COLOR_MAP[color];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ color: hex, transition: "width 0.2s, height 0.2s, color 0.3s" }}
      overflow="visible"
    >
      {shape === "circle" && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 2}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {shape === "square" && (
        <rect
          x="2"
          y="2"
          width={size - 4}
          height={size - 4}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {shape === "diamond" && (
        <polygon
          points={`${size / 2},2 ${size - 2},${size / 2} ${size / 2},${size - 2} 2,${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {shape === "star" && <StarPath size={size} />}
      {shape === "cross" && <CrossPath size={size} />}
    </svg>
  );
}

interface CustomCursorProps {
  shape?: CursorShape;
  color?: CursorColor;
}

export default function CustomCursor({
  shape = "cross",
  color = "violet",
}: CustomCursorProps) {
  const [state, setState] = useState<CursorState>({
    x: -100,
    y: -100,
    shape,
    color,
    isHovering: false,
    hoverLabel: null,
  });

  const targetRef = useRef({ x: -100, y: -100 });
  const currentPosRef = useRef({ x: -100, y: -100 });
  const hoverInfoRef = useRef<{
    isHovering: boolean;
    color: CursorColor;
    shape: CursorShape;
    hoverLabel: string | null;
  }>({ isHovering: false, color, shape, hoverLabel: null });

  const dotRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };

      const target = e.target as HTMLElement;
      const hoverEl = target.closest(
        "[data-cursor-color], [data-cursor-shape], [data-cursor-label]",
      );
      hoverInfoRef.current = {
        isHovering: !!hoverEl,
        color:
          (hoverEl?.getAttribute("data-cursor-color") as CursorColor) ?? color,
        shape:
          (hoverEl?.getAttribute("data-cursor-shape") as CursorShape) ?? shape,
        hoverLabel: hoverEl?.getAttribute("data-cursor-label") ?? null,
      };
    },
    [color, shape],
  );

  useEffect(() => {
    const animate = () => {
      if (dotRef.current) {
        dotRef.current.style.left = `${targetRef.current.x}px`;
        dotRef.current.style.top = `${targetRef.current.y}px`;
      }

      const cx = lerp(
        currentPosRef.current.x,
        targetRef.current.x,
        LERP_FACTOR,
      );
      const cy = lerp(
        currentPosRef.current.y,
        targetRef.current.y,
        LERP_FACTOR,
      );
      currentPosRef.current = { x: cx, y: cy };

      setState({
        x: cx,
        y: cy,
        ...hoverInfoRef.current,
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    window.addEventListener("mousemove", handleMouseMove);
    document.body.style.cursor = "none";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.body.style.cursor = "";
    };
  }, [handleMouseMove]);

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: state.x,
          top: state.y,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      >
        <CursorSVG
          shape={state.shape}
          color={state.color}
          isHovering={state.isHovering}
        />
        {state.isHovering && state.hoverLabel && (
          <span
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontSize: "11px",
              fontFamily: "monospace",
              color: COLOR_MAP[state.color],
              opacity: 0.9,
              letterSpacing: "0.04em",
            }}
          >
            {state.hoverLabel}
          </span>
        )}
      </div>

      <div
        ref={dotRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: -100,
          top: -100,
          width: 4,
          height: 4,
          borderRadius: "50%",
          backgroundColor: COLOR_MAP[state.color],
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 10000,
        }}
      />
    </>
  );
}
