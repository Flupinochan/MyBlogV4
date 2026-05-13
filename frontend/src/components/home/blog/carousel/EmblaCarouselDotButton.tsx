import {
  type ComponentPropsWithRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type EmblaCarouselType } from "embla-carousel";
import "./embla.css";
type UseDotButtonType = {
  selectedIndex: number;
  scrollSnaps: number[];
  onDotButtonClick: (index: number) => void;
};

export const useDotButton = (
  emblaApi: EmblaCarouselType | undefined,
  onReachEnd?: () => void,
): UseDotButtonType => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const onReachEndRef = useRef(onReachEnd);
  onReachEndRef.current = onReachEnd;

  const onDotButtonClick = useCallback(
    (index: number) => {
      if (!emblaApi) return;
      emblaApi.goTo(index);
    },
    [emblaApi],
  );

  const onInit = useCallback((emblaApi: EmblaCarouselType) => {
    setScrollSnaps(emblaApi.snapList());
  }, []);

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setSelectedIndex(emblaApi.selectedSnap());
    const total = emblaApi.slideNodes().length;
    if (emblaApi.selectedSnap() >= total - 2) {
      onReachEndRef.current?.();
    }
  }, []);

  const onSettleCallback = useCallback((emblaApi: EmblaCarouselType) => {
    emblaApi.reInit();
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    onInit(emblaApi);
    onSelect(emblaApi);

    emblaApi
      .on("reinit", onInit)
      .on("reinit", onSelect)
      .on("select", onSelect)
      .on("settle", onSettleCallback);
  }, [emblaApi, onInit, onSelect, onSettleCallback]);

  return {
    selectedIndex,
    scrollSnaps,
    onDotButtonClick,
  };
};

type PropType = ComponentPropsWithRef<"button"> & {
  isSelected?: boolean;
};

export const DotButton = (props: PropType) => {
  const { children, isSelected, ...restProps } = props;

  return (
    <button
      type="button"
      {...restProps}
      className="p-1 cursor-pointer transition-opacity duration-200 hover:opacity-80"
      aria-label={isSelected ? "Current slide" : "Go to slide"}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-all duration-300"
      >
        <circle
          cx="5"
          cy="5"
          r={isSelected ? "4.5" : "3.5"}
          fill={isSelected ? "#7c3aed" : "transparent"}
          stroke="#7c3aed"
          strokeWidth="1.5"
          className="transition-all duration-300"
        />
      </svg>
      {children}
    </button>
  );
};
