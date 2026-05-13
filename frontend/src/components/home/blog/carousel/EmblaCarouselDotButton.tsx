import {
  type ComponentPropsWithRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type EmblaCarouselType } from "embla-carousel";
import { GoDot } from "react-icons/go";
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
      className="p-1 cursor-pointer group relative z-0"
      aria-label={isSelected ? "Current slide" : "Go to slide"}
    >
      <GoDot
        size={24}
        className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-300"
      />
      {children}
    </button>
  );
};
