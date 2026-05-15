import { gsap } from "./gsap";
import { SplitText } from "gsap/SplitText";

function applySpanningGradient(el: HTMLElement, chars: HTMLElement[]): void {
  if (chars.length === 0) return;
  const bgImage = window.getComputedStyle(el).backgroundImage;
  const firstRect = chars[0].getBoundingClientRect();
  const lastRect = chars[chars.length - 1].getBoundingClientRect();
  const textWidth = lastRect.right - firstRect.left;
  chars.forEach((charEl) => {
    const charOffset = charEl.getBoundingClientRect().left - firstRect.left;
    charEl.style.backgroundImage = bgImage;
    charEl.style.backgroundSize = `${textWidth}px 200px`;
    charEl.style.backgroundPositionX = `-${charOffset}px`;
    charEl.style.setProperty("-webkit-background-clip", "text");
    charEl.style.backgroundClip = "text";
    charEl.style.setProperty("-webkit-text-fill-color", "transparent");
  });
}

interface SectionHeadingAnimationOptions {
  onStart?: () => void;
  onComplete?: () => void;
}

export function initSectionHeadingAnimation(
  el: Element,
  options: SectionHeadingAnimationOptions = {},
): gsap.core.Timeline {
  const splitText = new SplitText(el, { type: "chars" });
  const chars = splitText.chars as HTMLElement[];

  applySpanningGradient(el as HTMLElement, chars);

  gsap.set(chars, { autoAlpha: 0, filter: "blur(10px)" });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: el,
      start: "top 50%",
      toggleActions: "play none none none",
    },
    ...(options.onStart && { onStart: options.onStart }),
    ...(options.onComplete && { onComplete: options.onComplete }),
  });

  tl.to(chars, {
    autoAlpha: 1,
    filter: "blur(0px)",
    duration: 0.25,
    stagger: 0.02,
    ease: "power2.out",
  });

  return tl;
}
