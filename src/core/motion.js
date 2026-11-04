export const prefersReducedMotion = matchMedia(
  "(prefers-reduced-motion: reduce)",
);
const activeAnimations = new WeakMap();

export function animate(element, keyframes, options = {}) {
  if (!element) return Promise.resolve();
  const {
    duration = 500,
    easing = "cubic-bezier(.22,1,.36,1)",
    fill = "both",
    ...rest
  } = options;

  if (prefersReducedMotion.matches) {
    const end = keyframes.at(-1);

    for (const [key, value] of Object.entries(end)) {
      if (key !== "offset" && key !== "easing") element.style[key] = value;
    }

    return Promise.resolve();
  }

  activeAnimations.get(element)?.cancel();
  const animation = element.animate(keyframes, {
    duration,
    easing,
    fill,
    ...rest,
  });

  activeAnimations.set(element, animation);

  return animation.finished
    .catch(() => {})
    .finally(() => {
      if (activeAnimations.get(element) !== animation) return;
      if (animation.playState === "finished") {
        try {
          animation.commitStyles?.();
        } catch {}
      }

      animation.cancel();
      activeAnimations.delete(element);
    });
}

export function fadeIn(
  element,
  { duration = 430, delay = 0, distance = 13 } = {},
) {
  return animate(
    element,
    [
      { opacity: 0, transform: `translate3d(0, ${distance}px, 0)` },
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ],
    { duration, delay, fill: "both" },
  );
}

export function fadeOut(element, { duration = 220, distance = -8 } = {}) {
  return animate(
    element,
    [
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
      { opacity: 0, transform: `translate3d(0, ${distance}px, 0)` },
    ],
    { duration, fill: "both" },
  );
}
