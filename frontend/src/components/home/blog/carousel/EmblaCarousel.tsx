import React, { type ReactNode } from "react";
import { type EmblaOptionsType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import { GoDotFill } from "react-icons/go";
import {
  NextButton,
  PrevButton,
  usePrevNextButtons,
} from "./EmblaCarouselArrowButtons";
import { DotButton, useDotButton } from "./EmblaCarouselDotButton";
import "./embla.css";

type PropType = {
  slides: ReactNode[];
  isFetching?: boolean;
  options?: EmblaOptionsType;
  onReachEnd?: () => void;
};

const baseButtonStyle =
  "hidden lg:block cursor-pointer text-violet-500 transition-all duration-150 hover:scale-110 enable:active:scale-95 enable:active:text-violet-700 disabled:cursor-default disabled:opacity-50 disabled:scale-100";

const EmblaCarousel = (props: PropType) => {
  const { slides, isFetching, options, onReachEnd } = props;
  const [emblaRef, emblaApi] = useEmblaCarousel(options);

  const { selectedIndex, scrollSnaps, onDotButtonClick } = useDotButton(
    emblaApi,
    onReachEnd,
  );

  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = usePrevNextButtons(emblaApi);

  return (
    <div
      className={`w-full flex flex-col justify-center ${isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}`}
    >
      <div className="flex justify-between items-center gap-4">
        <PrevButton
          onClick={onPrevButtonClick}
          disabled={prevBtnDisabled}
          className={baseButtonStyle}
        />
        <div className="embla__viewport flex-1 min-w-0" ref={emblaRef}>
          <div className="embla__container">
            {slides.map((slide, index) => (
              <div className="embla__slide" key={index}>
                {slide}
              </div>
            ))}
          </div>
        </div>
        <NextButton
          onClick={onNextButtonClick}
          disabled={nextBtnDisabled}
          className={baseButtonStyle}
        />
      </div>

      {/* dots indicator */}
      <div
        className="embla__dots flex justify-center items-center gap-1 mt-3 relative"
        style={
          { "--active-dot": `--dot-${selectedIndex}` } as React.CSSProperties
        }
      >
        <span className="embla__dot-fill" aria-hidden="true">
          <GoDotFill size={24} className="text-violet-500" />
        </span>
        {scrollSnaps.map((_, index) => (
          <DotButton
            key={index}
            onClick={() => onDotButtonClick(index)}
            isSelected={index === selectedIndex}
            style={{ anchorName: `--dot-${index}` } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
};

export default EmblaCarousel;
