import { gsap } from "./gsap";
import { SplitText } from "gsap/SplitText";

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
