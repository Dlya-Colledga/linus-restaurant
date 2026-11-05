/** Animated full-screen transitions between the three HTML pages of LINUS. */
const STORAGE_KEY = "linus.route-wipe.v1";
const MAX_AGE = 20000;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const HEADLINES = {
  index: {
    ru: "ДОБРО ПОЖАЛОВАТЬ",
    ky: "КОШ КЕЛИҢИЗ",
    en: "WELCOME BACK",
  },
  menu: {
    ru: "ПРИВЕТСТВУЕМ ВАС!",
    ky: "КОШ КЕЛИҢИЗ!",
    en: "WELCOME!",
  },
  order: {
    ru: "ВАШ ЗАКАЗ",
    ky: "БУЙРУТМАҢЫЗ",
    en: "YOUR ORDER",
  },
};

let initialized = false;
let navigating = false;
let activeOverlay = null;

function destinationPage(url) {
  const name = url.pathname.split("/").pop();
  if (!name || name === "index.html") return "index";
  if (name === "menu.html") return "menu";
  if (name === "order.html") return "order";
  return null;
}

function getHeadline(page) {
  let language = "ru";
  try {
    language = localStorage.getItem("linus.language") || "ru";
  } catch {}
  return HEADLINES[page]?.[language] || HEADLINES[page]?.ru || "LINUS";
}

function getIncomingState() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    sessionStorage.removeItem(STORAGE_KEY);
    if (
      value &&
      typeof value.title === "string" &&
      value.path === location.pathname &&
      Math.abs(Date.now() - value.at) < MAX_AGE
    ) return value;
  } catch {}
  return null;
}

function buildOverlay(title, covered) {
  const overlay = document.createElement("div");
  overlay.className = "linus-route-wipe";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.transform = covered
    ? "translate3d(0, 0, 0)"
    : "translate3d(0, -100%, 0)";

  const inner = document.createElement("div");
  inner.className = "linus-route-wipe__inner";

  const caption = document.createElement("span");
  caption.className = "linus-route-wipe__caption";
  caption.textContent = "LINUS · FINE DINING";

  const heading = document.createElement("span");
  heading.className = "linus-route-wipe__title";
  heading.textContent = title;

  const rule = document.createElement("span");
  rule.className = "linus-route-wipe__rule";

  inner.append(caption, heading, rule);
  overlay.append(inner);
  document.body.append(overlay);
  return overlay;
}

function runAnimation(element, from, to, duration, easing) {
  if (reduceMotion.matches || !element.animate) {
    element.style.transform = to;
    return Promise.resolve();
  }
  return element.animate(
    [{ transform: from }, { transform: to }],
    { duration, easing, fill: "forwards" },
  ).finished.catch(() => {});
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export async function navigateWithTransition(destination) {
  if (navigating) return;

  const url = new URL(destination, location.href);
  const page = destinationPage(url);
  if (url.origin !== location.origin || !page || reduceMotion.matches) {
    location.assign(url.href);
    return;
  }
  if (url.href === location.href) return;

  navigating = true;
  const title = getHeadline(page);
  const overlay = buildOverlay(title, false);
  activeOverlay = overlay;

  await nextPaint();
  await runAnimation(
    overlay,
    "translate3d(0, -100%, 0)",
    "translate3d(0, 0, 0)",
    720,
    "cubic-bezier(.76, 0, .24, 1)",
  );

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      at: Date.now(), path: url.pathname, title,
    }));
  } catch {}
  location.assign(url.href);
}

function onInternalLinkClick(event) {
  if (
    event.defaultPrevented || event.button !== 0 ||
    event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
  ) return;
  if (!(event.target instanceof Element)) return;

  const anchor = event.target.closest("a[href]");
  if (!anchor || anchor.hasAttribute("download")) return;
  if (anchor.target && anchor.target !== "_self") return;

  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin || !destinationPage(url)) return;
  if (
    url.pathname === location.pathname &&
    url.search === location.search &&
    url.hash
  ) return;
  if (url.href === location.href) return;

  event.preventDefault();
  void navigateWithTransition(url.href);
}

export function initPageTransitions() {
  if (initialized) return;
  initialized = true;

  const incoming = getIncomingState();
  if (incoming && !reduceMotion.matches) {
    const overlay = buildOverlay(incoming.title, true);
    activeOverlay = overlay;
    document.documentElement.classList.remove("linus-route-pending");
    delete document.documentElement.dataset.linusRouteTitle;

    void nextPaint().then(() => runAnimation(
      overlay,
      "translate3d(0, 0, 0)",
      "translate3d(0, 100%, 0)",
      840,
      "cubic-bezier(.76, 0, .24, 1)",
    )).then(() => {
      overlay.remove();
      if (activeOverlay === overlay) activeOverlay = null;
    });
  } else {
    document.documentElement.classList.remove("linus-route-pending");
    delete document.documentElement.dataset.linusRouteTitle;
  }

  document.addEventListener("click", onInternalLinkClick);
  window.addEventListener("pageshow", (event) => {
    // Browsers may restore a covered page from the back/forward cache.
    if (!event.persisted) return;
    activeOverlay?.remove();
    activeOverlay = null;
    navigating = false;
    document.documentElement.classList.remove("linus-route-pending");
  });
}
