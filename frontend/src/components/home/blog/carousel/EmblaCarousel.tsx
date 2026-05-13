import { type ReactNode } from "react";
import { type EmblaOptionsType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import {
  NextButton,
  PrevButton,
  usePrevNextButtons,
} from "./EmblaCarouselArrowButtons";
import { DotButton, useDotButton } from "./EmblaCarouselDotButton";
import "./embla.css";

type PropType = {
  slides: ReactNode[];
  options?: EmblaOptionsType;
  onReachEnd?: () => void;
};

const baseButtonStyle =
  "cursor-pointer text-violet-500 transition-all duration-150 hover:scale-110 active:scale-95 active:text-violet-700 disabled:cursor-default disabled:opacity-50 disabled:scale-100";

const EmblaCarousel = (props: PropType) => {
  const { slides, options, onReachEnd } = props;
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
    <>
      <div className="embla flex justify-center items-center gap-4">
        <PrevButton
          onClick={onPrevButtonClick}
          disabled={prevBtnDisabled}
          className={baseButtonStyle}
        />
        <div className="embla__viewport" ref={emblaRef}>
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

      <div className="flex justify-center items-center gap-1 mt-3">
        {scrollSnaps.map((_, index) => (
          <DotButton
            key={index}
            onClick={() => onDotButtonClick(index)}
            isSelected={index === selectedIndex}
          />
        ))}
      </div>
    </>
  );
};

export default EmblaCarousel;
