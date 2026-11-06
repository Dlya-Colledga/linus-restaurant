"use strict";
import { I18n } from "../core/i18n.js";
import { animate, prefersReducedMotion } from "../core/motion.js";
import { branches as restaurantBranches } from "../data/branches.js";
import { menuData } from "../data/menu.js";
import { initSite } from "../core/site.js";
import { navigateWithTransition } from "../core/page-transitions.js";

initSite();
const T = (text) => I18n.t(text);
const $ = (sel) => document.querySelector(sel);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const branches = Object.fromEntries(
  restaurantBranches.map((branch) => [branch.id, branch.name]),
);

let saved = "chuy";

try {
  saved = localStorage.getItem("linus.selectedRestaurant") || "chuy";
} catch {}

const requested = new URLSearchParams(location.search).get("location") || saved;

$("#locationLabel").textContent = T(branches[requested] || branches.chuy);
const categories = menuData.categories;
const track = $("#categoryTrack"),
  gallery = $("#gallery"),
  stage = $("#stage"),
  sphere = $("#sphere");
const dishOverlay = $("#dishOverlay"),
  dishPanel = $("#dishPanel");

let modalPhase = "idle";
const reduced = matchMedia("(prefers-reduced-motion:reduce)");
const catButtons = [];

let selected = 1,
  catPos = 1,
  catTarget = 1,
  catRAF = 0,
  catPrevious = 0,
  switchTimer = 0,
  switchToken = 0;
let centers = [];

function measureCategories() {
  centers = [0];
  const gap = innerWidth <= 700 ? 16 : 25;

  for (let i = 1; i < catButtons.length; i++) {
    centers[i] =
      centers[i - 1] +
      (catButtons[i - 1].offsetWidth + catButtons[i].offsetWidth) / 2 +
      gap;
  }

  paintCategories();
}

function centerAt(pos) {
  const lo = Math.floor(clamp(pos, 0, categories.length - 1));
  const hi = Math.min(lo + 1, categories.length - 1);

  return centers[lo] + (centers[hi] - centers[lo]) * (pos - lo);
}

function indexAt(offset) {
  if (offset <= 0) return 0;
  const last = centers.length - 1;

  if (offset >= centers[last]) return last;
  for (let i = 0; i < last; i++)
    if (offset <= centers[i + 1])
      return i + (offset - centers[i]) / (centers[i + 1] - centers[i]);

  return last;
}

function paintCategories() {
  if (!centers.length) return;
  const origin = centerAt(catPos);

  catButtons.forEach((button, i) => {
    const dist = Math.abs(i - catPos);

    button.style.transform = `translate(calc(-50% + ${centers[i] - origin}px), -50%) scale(${1 - Math.min(dist, 2) * 0.075})`;
    button.style.opacity = Math.max(0.14, 1 - dist * 0.31);
  });
}

function catFrame(now) {
  const dt = Math.min((now - catPrevious) / 1000, 0.05);

  catPrevious = now;
  catPos += (catTarget - catPos) * (1 - Math.exp(-dt / 0.16));
  if (Math.abs(catTarget - catPos) < 0.0006) catPos = catTarget;
  paintCategories();
  catRAF = catPos === catTarget ? 0 : requestAnimationFrame(catFrame);
}

function animateCategories() {
  if (catRAF) cancelAnimationFrame(catRAF);
  catRAF = 0;
  if (reduced.matches) {
    catPos = catTarget;
    paintCategories();

    return;
  }

  catPrevious = performance.now();
  catRAF = requestAnimationFrame(catFrame);
}

function choose(index) {
  if (modalPhase !== "idle") return;
  const next = clamp(Math.round(index), 0, categories.length - 1);

  catTarget = next;
  animateCategories();
  if (next !== selected) {
    selected = next;
    catButtons.forEach((b, i) => {
      b.classList.toggle("active", i === next);
      b.setAttribute("aria-selected", String(i === next));
      b.tabIndex = i === next ? 0 : -1;
    });
    refreshGallery();
  }

  $("#prev").disabled = selected === 0;
  $("#next").disabled = selected === categories.length - 1;
}

categories.forEach((category, i) => {
  const b = document.createElement("button");

  b.type = "button";
  b.className = "nav-item";
  b.textContent = T(category.name);
  b.dataset.index = i;
  b.setAttribute("role", "tab");
  b.setAttribute("aria-selected", String(i === selected));
  b.tabIndex = i === selected ? 0 : -1;
  b.classList.toggle("active", i === selected);
  b.addEventListener("click", (e) => {
    if (e.detail === 0) choose(i);
  });
  track.append(b);
  catButtons.push(b);
});
$("#prev").addEventListener("click", () => choose(selected - 1));
$("#next").addEventListener("click", () => choose(selected + 1));
const swipe = {
  active: false,
  id: null,
  x: 0,
  start: 0,
  moved: false,
  pressed: null,
};

track.addEventListener("pointerdown", (e) => {
  if (
    modalPhase !== "idle" ||
    swipe.active ||
    (e.pointerType === "mouse" && e.button !== 0)
  )
    return;
  if (catRAF) cancelAnimationFrame(catRAF);
  catRAF = 0;
  catTarget = catPos;
  Object.assign(swipe, {
    active: true,
    id: e.pointerId,
    x: e.clientX,
    start: centerAt(catPos),
    moved: false,
    pressed: e.target.closest(".nav-item")?.dataset.index ?? null,
  });
  track.setPointerCapture(e.pointerId);
  track.classList.add("dragging");
});
track.addEventListener("pointermove", (e) => {
  if (!swipe.active || swipe.id !== e.pointerId) return;
  const dx = e.clientX - swipe.x;

  if (Math.abs(dx) > 5) swipe.moved = true;
  if (!swipe.moved) return;
  catPos = indexAt(swipe.start - dx);
  catTarget = catPos;
  paintCategories();
});

function finishSwipe(e, cancelled = false) {
  if (!swipe.active || swipe.id !== e.pointerId) return;
  const moved = swipe.moved,
    pressed = swipe.pressed,
    id = swipe.id;

  swipe.active = false;
  swipe.id = null;
  track.classList.remove("dragging");
  if (track.hasPointerCapture(id)) track.releasePointerCapture(id);
  choose(
    cancelled || moved
      ? Math.round(catPos)
      : pressed === null
        ? selected
        : Number(pressed),
  );
}

track.addEventListener("pointerup", (e) => finishSwipe(e));
track.addEventListener("pointercancel", (e) => finishSwipe(e, true));
track.addEventListener("lostpointercapture", (e) => finishSwipe(e, true));
track.addEventListener("dragstart", (e) => e.preventDefault());
let wheelAccumulator = 0,
  wheelReset = 0;

track.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (modalPhase !== "idle" || swipe.active) return;
    wheelAccumulator +=
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(wheelAccumulator) >= 65) {
      choose(selected + Math.sign(wheelAccumulator));
      wheelAccumulator = 0;
    }

    clearTimeout(wheelReset);
    wheelReset = setTimeout(() => (wheelAccumulator = 0), 200);
  },
  {
    passive: false,
  },
);
const dome = {
  y: 0,
  radius: 650,
  segments: 35,
};
const DOME_SETTINGS = {
  sensitivity: 17,
  friction: 3.4,
  maxSpeed: 210,
  minSpeed: 0.42,
};

let inertiaRAF = 0,
  inertiaTime = 0,
  inertiaSpeed = 0;

function domeStyle() {
  sphere.style.transform = `translateZ(${-dome.radius}px) rotateY(${dome.y}deg)`;
}

function stopInertia() {
  if (inertiaRAF) cancelAnimationFrame(inertiaRAF);
  inertiaRAF = 0;
  inertiaSpeed = 0;
}

function inertiaFrame(now) {
  const dt = Math.min((now - inertiaTime) / 1000, 0.045);

  inertiaTime = now;
  const decay = Math.exp(-DOME_SETTINGS.friction * dt);
  const nextSpeed = inertiaSpeed * decay;

  dome.y += (inertiaSpeed + nextSpeed) * 0.5 * dt;
  inertiaSpeed = nextSpeed;
  domeStyle();
  if (Math.abs(inertiaSpeed) > DOME_SETTINGS.minSpeed) {
    inertiaRAF = requestAnimationFrame(inertiaFrame);
  } else {
    inertiaRAF = 0;
    inertiaSpeed = 0;
  }
}

function startInertia(speed) {
  stopInertia();
  if (reduced.matches || modalPhase !== "idle") return;
  inertiaSpeed = clamp(speed, -DOME_SETTINGS.maxSpeed, DOME_SETTINGS.maxSpeed);
  if (Math.abs(inertiaSpeed) < 2) return;
  inertiaTime = performance.now();
  inertiaRAF = requestAnimationFrame(inertiaFrame);
}

function fallback(image, name) {
  image.onerror = () => {
    image.onerror = null;
    const escapeXML = (text) =>
      text.replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
          })[c],
      );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500"><rect width="500" height="500" fill="#30312a"/><text x="250" y="250" fill="#c9ad70" text-anchor="middle" font-family="monospace" font-size="19">${escapeXML(name.slice(0, 28))}</text></svg>`;

    image.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };
}

function rebuildDome() {
  const w = stage.clientWidth,
    h = stage.clientHeight;

  dome.segments = w < 700 ? 35 : 35;
  dome.radius = Math.round(
    clamp(
      Math.min(
        w < 700 ? 610 : Math.max(w * 0.63, 650),
        h < 700 ? 650 : h * 1.16,
      ),
      600,
      1050,
    ),
  );
  stage.style.setProperty("--radius", `${dome.radius}px`);
  const angleStep = 360 / dome.segments;
  const horizontalTileSize =
    2 * dome.radius * Math.sin(Math.PI / dome.segments) * 0.95;
  const verticalTileSize =
    2 * dome.radius * Math.sin(Math.PI / dome.segments) * 0.95;
  const items = categories[selected].items;
  const fragment = document.createDocumentFragment();

  for (let c = 0; c < dome.segments; c++) {
    for (let r = 0; r < 5; r++) {
      // Смещение каждой второй горизонтальной строки на полплитки.
      const rowShift = r % 2 === 0 ? 0 : 0.5;
      const longitude =
        (c - Math.floor(dome.segments / 2) + rowShift) * angleStep;
      const latitude = (r - 2) * angleStep;
      const tileWidth =
        horizontalTileSize * Math.cos((latitude * Math.PI) / 180);
      const idx =
        (((c * 7 + r * 3 + Math.floor(c / 3)) % items.length) + items.length) %
        items.length;
      const item = items[idx];
      const wrapper = document.createElement("div");

      wrapper.className = "sphere-item";
      wrapper.style.width = `${tileWidth}px`;
      wrapper.style.height = `${verticalTileSize}px`;
      wrapper.style.transform = `translate(-50%,-50%) rotateY(${longitude}deg) rotateX(${latitude}deg) translateZ(${dome.radius}px)`;
      const button = document.createElement("button");

      button.type = "button";
      button.className = "tile";
      button.dataset.dish = String(idx);
      button.tabIndex = -1;
      button.setAttribute(
        "aria-label",
        `${item.name}, ${I18n.currency(item.price)}`,
      );
      button.addEventListener("click", (e) => {
        if (e.detail === 0) openDish(idx, button);
      });
      const image = document.createElement("img");

      image.src = item.image;
      image.alt = "";
      image.draggable = false;
      image.decoding = "async";
      image.loading = "lazy";
      fallback(image, item.name);
      const title = document.createElement("span");

      title.className = "tile-title";
      title.textContent = item.name;
      button.append(image, title);
      wrapper.append(button);
      fragment.append(wrapper);
    }
  }

  sphere.replaceChildren(fragment);
  domeStyle();
}

let sphereChangeTimer = 0;

async function refreshGallery() {
  if (modalPhase !== "idle") return;
  stopInertia();
  const token = ++switchToken;
  const category = categories[selected];

  $("#galleryTitle").textContent = T(category.name).toUpperCase();
  $("#galleryCount").textContent =
    `${String(category.items.length).padStart(2, "0")} ${T("ПОЗИЦИЙ")}`;
  clearTimeout(sphereChangeTimer);
  const fade = animate(
    stage,
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(.975)" },
    ],
    { duration: 190, easing: "ease-in" },
  );

  await fade;
  if (token !== switchToken || modalPhase !== "idle") return;
  dome.y = 0;
  rebuildDome();
  await animate(
    stage,
    [
      { opacity: 0, transform: "scale(1.025)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    { duration: 490, easing: "cubic-bezier(.16,1,.3,1)" },
  );
}

const gesture = {
  active: false,
  id: null,
  moved: false,
  startX: 0,
  startY: 0,
  startRot: 0,
  tap: null,
  samples: [],
};

function recordSample(x, t) {
  gesture.samples.push({ x, t });
  while (gesture.samples.length > 2 && gesture.samples[0].t < t - 110) {
    gesture.samples.shift();
  }
}

stage.addEventListener("pointerdown", (e) => {
  if (
    gesture.active ||
    modalPhase !== "idle" ||
    (e.pointerType === "mouse" && e.button !== 0)
  )
    return;
  stopInertia();
  Object.assign(gesture, {
    active: true,
    id: e.pointerId,
    moved: false,
    startX: e.clientX,
    startY: e.clientY,
    startRot: dome.y,
    tap: e.target.closest(".tile") ?? null,
    samples: [{ x: e.clientX, t: performance.now() }],
  });
  stage.setPointerCapture(e.pointerId);
  stage.classList.add("dragging");
});
stage.addEventListener("pointermove", (e) => {
  if (!gesture.active || e.pointerId !== gesture.id) return;
  const dx = e.clientX - gesture.startX;
  const dy = e.clientY - gesture.startY;

  if (Math.hypot(dx, dy) > 7) gesture.moved = true;
  if (!gesture.moved) return;
  dome.y = gesture.startRot + dx / DOME_SETTINGS.sensitivity;
  domeStyle();
  recordSample(e.clientX, performance.now());
});

function finishGesture(e, cancelled = false) {
  if (!gesture.active || gesture.id !== e.pointerId) return;
  const moved = gesture.moved,
    tap = gesture.tap,
    id = gesture.id;
  const t = performance.now();
  const samples = gesture.samples;

  let velocity = 0;

  if (moved && !cancelled && samples.length > 1 && t - samples.at(-1).t < 90) {
    const first = samples[0];
    const last = samples.at(-1);
    const dt = last.t - first.t;

    if (dt >= 10) {
      velocity = (((last.x - first.x) / dt) * 1000) / DOME_SETTINGS.sensitivity;
    }
  }

  gesture.active = false;
  gesture.id = null;
  gesture.tap = null;
  gesture.samples = [];
  stage.classList.remove("dragging");
  if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
  if (!cancelled && !moved && tap !== null) {
    openDish(Number(tap.dataset.dish), tap);
  } else if (!cancelled && moved) {
    startInertia(velocity);
  }
}

stage.addEventListener("pointerup", (e) => finishGesture(e));
stage.addEventListener("pointercancel", (e) => finishGesture(e, true));
stage.addEventListener("lostpointercapture", (e) => finishGesture(e, true));
stage.addEventListener("dragstart", (e) => e.preventDefault());
const meta = menuData.meta;

function showToast(message) {
  const toast = $("#toast");

  toast.textContent = message;
  toast.classList.add("show");
  animate(
    toast,
    [
      { opacity: 0, transform: "translate(-50%, 12px)" },
      { opacity: 1, transform: "translate(-50%, 0)" },
    ],
    { duration: 340 },
  );
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(async () => {
    await animate(
      toast,
      [
        { opacity: 1, transform: "translate(-50%, 0)" },
        { opacity: 0, transform: "translate(-50%, 10px)" },
      ],
      { duration: 220 },
    );
    toast.classList.remove("show");
  }, 2100);
}

function setSourceHidden(tile, hidden) {
  if (tile) tile.style.visibility = hidden ? "hidden" : "";
}

const backdrop = $("#dishBackdrop");
const morphCover = $("#dishMorphCover");
const morphImage = $("#dishMorphImage");
const morphLabel = $("#dishMorphLabel");
const dishCopy = $("#dishCopy");
const closeButton = $("#closeDialog");

function cardGeometry(sourceRect, panelRect) {
  return {
    x:
      sourceRect.left +
      sourceRect.width / 2 -
      (panelRect.left + panelRect.width / 2),
    y:
      sourceRect.top +
      sourceRect.height / 2 -
      (panelRect.top + panelRect.height / 2),
    scaleX: sourceRect.width / Math.max(panelRect.width, 1),
    scaleY: sourceRect.height / Math.max(panelRect.height, 1),
  };
}

function cardTransform({ x, y, scaleX, scaleY }) {
  return `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`;
}

function setMorphImage(source) {
  const tileImg = source?.querySelector("img");

  morphImage.src = tileImg?.currentSrc || activeDish.image;
  morphLabel.textContent = activeDish.name;
  fallback(morphImage, activeDish.name);
}

let activeTile = null;
let activeDish = null;
let activeQty = 1;
let modalOldFocus = null;
let flightNode = null;

function fillDish(i) {
  const item = categories[selected].items[i];
  const fields = meta[item.name] || [
    "Состав уточняется",
    "15 мин",
    "1 порция",
    "Для знакомства с меню",
    "Уточните у персонала",
  ];

  activeDish = item;
  activeQty = 1;
  $("#dishCategory").textContent = T(categories[selected].name).toUpperCase();
  $("#dishTitle").textContent = item.name;
  $("#dishDescription").textContent = T(item.description);
  $("#dishIngredients").textContent = T(fields[0]);
  $("#dishTime").textContent = T(fields[1]);
  $("#dishWeight").textContent = T(fields[2]);
  $("#dishAllergens").textContent =
    `${T("Возможные аллергены:")} ${T(fields[4])}. ${T("Состав и время указаны для демонстрации.")}`;
  const tags = $("#dishTags");

  tags.replaceChildren();
  T(fields[3])
    .split(",")
    .forEach((text) => {
      const span = document.createElement("span");

      span.textContent = text.trim();
      tags.appendChild(span);
    });
  const img = $("#dishImage");

  img.src = item.image;
  img.alt = item.name;
  fallback(img, item.name);
  updateQty();
}

function updateQty() {
  $("#qtyValue").textContent = String(activeQty);
  $("#dishPrice").innerHTML =
    `${activeDish?.price ?? 0} <small>${T("СОМ / ПОРЦИЯ")}</small>`;
  $("#orderTotal").textContent = I18n.currency(
    (activeDish?.price ?? 0) * activeQty,
  );
  $("#qtyMinus").disabled = activeQty <= 1;
  $("#qtyPlus").disabled = activeQty >= 20;
}

$("#qtyMinus").addEventListener("click", () => {
  activeQty = Math.max(1, activeQty - 1);
  updateQty();
});
$("#qtyPlus").addEventListener("click", () => {
  activeQty = Math.min(20, activeQty + 1);
  updateQty();
});

async function openDish(i, source) {
  if (
    modalPhase !== "idle" ||
    !source ||
    gallery.classList.contains("changing")
  )
    return;

  modalPhase = "opening";

  stopInertia();
  clearTimeout(switchTimer);
  clearTimeout(sphereChangeTimer);

  modalOldFocus = document.activeElement;
  activeTile = source;

  fillDish(i);

  dishOverlay.hidden = false;
  dishPanel.classList.add("ready", "content-visible");

  dishPanel.style.opacity = "";
  dishPanel.style.transform = "";
  dishCopy.style.opacity = "";
  dishCopy.style.transform = "";
  closeButton.style.opacity = "";
  backdrop.style.opacity = "0";

  const reduce = prefersReducedMotion.matches;

  await Promise.all([
    animate(
      dishPanel,
      [
        {
          opacity: 0,
          transform: "translate3d(0,18px,0) scale(.965)",
        },
        {
          opacity: 1,
          transform: "translate3d(0,0,0) scale(1)",
        },
      ],
      {
        duration: reduce ? 0 : 500,
        easing: "cubic-bezier(.22,1,.36,1)",
      },
    ),

    animate(backdrop, [{ opacity: 0 }, { opacity: 1 }], {
      duration: reduce ? 0 : 400,
    }),

    animate(dishCopy, [{ opacity: 0 }, { opacity: 1 }], {
      duration: reduce ? 0 : 360,
      delay: reduce ? 0 : 80,
    }),

    animate(closeButton, [{ opacity: 0 }, { opacity: 1 }], {
      duration: reduce ? 0 : 280,
      delay: reduce ? 0 : 100,
    }),
  ]);

  dishPanel.style.transform = "";
  modalPhase = "open";
  closeButton.focus({ preventScroll: true });
}

async function closeDish() {
  if (modalPhase !== "open") return;

  modalPhase = "closing";

  const reduce = prefersReducedMotion.matches;

  await Promise.all([
    animate(
      dishPanel,
      [
        {
          opacity: 1,
          transform: "translate3d(0,0,0) scale(1)",
        },
        {
          opacity: 0,
          transform: "translate3d(0,14px,0) scale(.97)",
        },
      ],
      {
        duration: reduce ? 0 : 300,
        easing: "cubic-bezier(.4,0,1,1)",
      },
    ),

    animate(backdrop, [{ opacity: 1 }, { opacity: 0 }], {
      duration: reduce ? 0 : 280,
    }),
  ]);

  dishOverlay.hidden = true;
  dishPanel.classList.remove("ready", "content-visible");

  dishPanel.style.opacity = "";
  dishPanel.style.transform = "";
  dishCopy.style.opacity = "";
  dishCopy.style.transform = "";
  closeButton.style.opacity = "";
  backdrop.style.opacity = "0";

  activeTile = null;
  activeDish = null;
  modalPhase = "idle";

  if (modalOldFocus instanceof HTMLElement && modalOldFocus.isConnected) {
    modalOldFocus.focus({ preventScroll: true });
  }
}

document.addEventListener("keydown", (e) => {
  if (modalPhase !== "open" || e.key !== "Tab") return;
  const focusables = [...dishPanel.querySelectorAll("button:not([disabled])")];

  if (!focusables.length) return;
  const first = focusables[0],
    last = focusables.at(-1);

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});
$("#closeDialog").addEventListener("click", closeDish);
$("#dishBackdrop").addEventListener("click", () => {
  if (modalPhase === "open") closeDish();
});

const cartKey = `linus.cart.${Object.hasOwn(branches, requested) ? requested : "chuy"}`;

let cart = [];

try {
  const data = JSON.parse(localStorage.getItem(cartKey) || "[]");

  if (Array.isArray(data))
    cart = data.filter(
      (x) =>
        x && typeof x.name === "string" && Number.isInteger(x.qty) && x.qty > 0,
    );
} catch {}

function persistCart() {
  try {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  } catch {}

  updateCart();
}

function updateCart() {
  const totalQty = cart.reduce((s, x) => s + x.qty, 0);

  $("#cartCount").textContent = String(totalQty);
  $("#cartButton").setAttribute(
    "aria-label",
    `${T("Открыть заказ,")} ${totalQty} ${T("позиций")}`,
  );
  $("#cartTotal").textContent = I18n.currency(
    cart.reduce((s, x) => s + x.price * x.qty, 0),
  );
  const list = $("#cartList");

  list.replaceChildren();
  if (!cart.length) {
    const empty = document.createElement("div");

    empty.className = "cart-empty";
    empty.textContent = T("Пока пусто. Выберите блюдо в галерее.");
    list.append(empty);
  }

  cart.forEach((entry, index) => {
    const row = document.createElement("div");

    row.className = "cart-item";
    const desc = document.createElement("div");
    const title = document.createElement("strong");

    title.textContent = entry.name;
    const sub = document.createElement("small");

    sub.textContent = `${I18n.currency(entry.price)} / ${T("шт.")}`;
    desc.append(title, sub);
    const controls = document.createElement("div");

    controls.className = "cart-item-actions";
    const minus = document.createElement("button");

    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `${T("Уменьшить")} ${entry.name}`);
    minus.addEventListener("click", () => {
      entry.qty--;
      if (entry.qty <= 0) cart.splice(index, 1);
      persistCart();
    });
    const amount = document.createElement("span");

    amount.textContent = String(entry.qty);
    const plus = document.createElement("button");

    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `${T("Увеличить")} ${entry.name}`);
    plus.addEventListener("click", () => {
      entry.qty = Math.min(20, entry.qty + 1);
      persistCart();
    });
    controls.append(minus, amount, plus);
    row.append(desc, controls);
    list.append(row);
  });
  $("#cartClear").disabled = !cart.length;
  setSlideDisabled(!cart.length);
}

$("#addOrder").addEventListener("click", () => {
  if (modalPhase !== "open" || !activeDish) return;
  const item = activeDish;
  const found = cart.find((x) => x.name === item.name);

  if (found) found.qty = Math.min(20, found.qty + activeQty);
  else cart.push({ name: item.name, price: item.price, qty: activeQty });
  persistCart();
  showToast(`${item.name} ${T("добавлен в заказ")}`);
  closeDish();
});
const cartDialog = $("#cartDialog");

$("#cartButton").addEventListener("click", () => {
  if (modalPhase !== "idle") return;
  $("#cartBranch").textContent = T(branches[requested] || branches.chuy);
  updateCart();
  cartDialog.showModal();
});
$("#cartClose").addEventListener("click", () => cartDialog.close());
$("#cartClear").addEventListener("click", () => {
  cart = [];
  persistCart();
});
cartDialog.addEventListener("click", (e) => {
  if (e.target === cartDialog) cartDialog.close();
});

const slideTrack = $("#slideTrack"),
  slideThumb = $("#slideThumb"),
  slideLabel = $("#slideLabel");
const slideState = {
  value: 0,
  disabled: true,
  busy: false,
  drag: null,
  raf: 0,
};

cartDialog.addEventListener("cancel", (event) => {
  if (slideState.busy) {
    event.preventDefault();
  }
});

function slideTravel() {
  return Math.max(0, slideTrack.clientWidth - slideThumb.offsetWidth - 8);
}

function paintSlide() {
  const percent = Math.round(slideState.value * 100);

  slideTrack.style.setProperty(
    "--slide-x",
    `${slideState.value * slideTravel()}px`,
  );
  slideTrack.style.setProperty("--slide-progress", String(slideState.value));
  slideThumb.setAttribute("aria-valuenow", String(percent));
  slideThumb.setAttribute("aria-valuetext", `${percent}%`);
}

function setSlideDisabled(disabled) {
  slideState.disabled = disabled;
  slideTrack.dataset.disabled = String(disabled);
  slideThumb.tabIndex = disabled ? -1 : 0;
  slideThumb.setAttribute("aria-disabled", String(disabled));
  if (disabled && !slideState.busy) {
    slideState.value = 0;
    paintSlide();
  }
}

function slideTo(value, duration = 350) {
  cancelAnimationFrame(slideState.raf);
  const from = slideState.value;

  if (reduced.matches || duration < 2) {
    slideState.value = value;
    paintSlide();

    return;
  }

  const started = performance.now();
  const tick = (now) => {
    const t = clamp((now - started) / duration, 0, 1);
    const ease =
      value === 0
        ? 1 - Math.pow(1 - t, 3) * Math.cos(t * 7)
        : 1 - Math.pow(1 - t, 3);

    slideState.value = clamp(from + (value - from) * ease, 0, 1);
    paintSlide();
    if (t < 1) slideState.raf = requestAnimationFrame(tick);
    else {
      slideState.value = value;
      paintSlide();
      slideState.raf = 0;
    }
  };

  slideState.raf = requestAnimationFrame(tick);
}

function resetSlide() {
  slideTrack.dataset.phase = "idle";
  slideLabel.textContent = T("Проведите, чтобы заказать →");
  slideTo(0);
}

slideThumb.addEventListener("pointerdown", (e) => {
  if (
    slideState.disabled ||
    slideState.busy ||
    slideState.drag ||
    (e.pointerType === "mouse" && e.button !== 0)
  )
    return;
  e.preventDefault();
  cancelAnimationFrame(slideState.raf);
  slideState.drag = { id: e.pointerId, x: e.clientX, from: slideState.value };
  slideThumb.classList.add("dragging");
  slideThumb.setPointerCapture(e.pointerId);
});
slideThumb.addEventListener("pointermove", (e) => {
  const g = slideState.drag;

  if (!g || g.id !== e.pointerId) return;
  slideState.value = clamp(
    g.from + (e.clientX - g.x) / Math.max(1, slideTravel()),
    0,
    1,
  );
  paintSlide();
});

function finishSlide(e, cancelled = false) {
  const g = slideState.drag;

  if (!g || g.id !== e.pointerId) return;
  slideState.drag = null;
  slideThumb.classList.remove("dragging");
  if (slideThumb.hasPointerCapture(e.pointerId))
    slideThumb.releasePointerCapture(e.pointerId);
  if (!cancelled && slideState.value >= 0.94) commitOrder();
  else slideTo(0);
}

slideThumb.addEventListener("pointerup", (e) => finishSlide(e));
slideThumb.addEventListener("pointercancel", (e) => finishSlide(e, true));
slideThumb.addEventListener("lostpointercapture", (e) => finishSlide(e, true));
slideThumb.addEventListener("keydown", (e) => {
  if (slideState.disabled || slideState.busy) return;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") {
    e.preventDefault();
    slideState.value = clamp(slideState.value + 0.1, 0, 1);
    paintSlide();
    if (slideState.value >= 0.94) commitOrder();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
    e.preventDefault();
    slideState.value = clamp(slideState.value - 0.1, 0, 1);
    paintSlide();
  } else if (e.key === "Home" || e.key === "Escape") {
    e.preventDefault();
    resetSlide();
  } else if (e.key === "End" || e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    commitOrder();
  }
});
window.addEventListener("resize", paintSlide);

function orderNumber(existing) {
  const used = new Set(existing.map((x) => String(x.id)));

  for (let i = 0; i < 20; i++) {
    let n;

    if (window.crypto?.getRandomValues) {
      const a = new Uint32Array(1);

      crypto.getRandomValues(a);
      n = 100000 + (a[0] % 900000);
    } else n = 100000 + Math.floor(Math.random() * 900000);
    if (!used.has(String(n))) return String(n);
  }

  return String(Date.now()).slice(-9);
}

async function commitOrder() {
  if (slideState.busy || slideState.disabled || !cart.length) return;
  slideState.busy = true;
  slideTrack.dataset.phase = "pending";
  slideLabel.textContent = T("СОХРАНЯЕМ ЗАКАЗ...");
  slideTo(1, 190);
  try {
    const raw = localStorage.getItem("linus.orders.v1");
    const previous = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(previous))
      throw new Error("Не удалось прочитать историю заказов");
    const items = cart
      .filter(
        (x) =>
          x &&
          typeof x.name === "string" &&
          Number.isFinite(x.price) &&
          Number.isInteger(x.qty) &&
          x.qty > 0,
      )
      .map((x) => ({ name: x.name, price: x.price, qty: x.qty }));

    if (!items.length) throw new Error("Корзина пуста");
    const id = orderNumber(previous);
    const locationId = Object.hasOwn(branches, requested) ? requested : "chuy";
    const order = {
      id,
      locationId,
      locationName: branches[locationId],
      createdAt: Date.now(),
      items,
      total: items.reduce((sum, x) => sum + x.price * x.qty, 0),
      manualStage: 0,
    };

    localStorage.setItem(
      "linus.orders.v1",
      JSON.stringify([...previous.slice(-49), order]),
    );
    localStorage.setItem("linus.order.active", id);
    localStorage.removeItem(cartKey);
    await new Promise((resolve) =>
      setTimeout(resolve, reduced.matches ? 50 : 480),
    );

    slideTrack.dataset.phase = "done";
    slideLabel.textContent = T("✓ ЗАКАЗ СОЗДАН");

    await new Promise((resolve) =>
      setTimeout(resolve, reduced.matches ? 30 : 650),
    );

    cartDialog.classList.add("cart-leaving");

    await animate(
      cartDialog,
      [
        {
          opacity: 1,
          transform: "translate3d(0,0,0) scale(1)",
          filter: "blur(0px)",
        },
        {
          opacity: 0,
          transform: "translate3d(0,24px,0) scale(.94)",
          filter: "blur(5px)",
        },
      ],
      {
        duration: reduced.matches ? 0 : 420,
        easing: "cubic-bezier(.4,0,1,1)",
      },
    );

    cartDialog.close();
    cartDialog.classList.remove("cart-leaving");

    cartDialog.style.opacity = "";
    cartDialog.style.transform = "";
    cartDialog.style.filter = "";

    void navigateWithTransition(`order.html?id=${encodeURIComponent(id)}`);
  } catch (error) {
    slideState.busy = false;
    slideTrack.dataset.phase = "idle";
    showToast(
      T("Не удалось сохранить заказ. Проверьте доступ к localStorage."),
    );
    resetSlide();
    console.error("LINUS checkout:", error);
  }
}

updateCart();

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalPhase === "open") {
    e.preventDefault();
    closeDish();

    return;
  }

  if (
    modalPhase !== "idle" ||
    cartDialog.open ||
    e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    e.shiftKey
  )
    return;
  if (
    e.target instanceof Element &&
    e.target.closest("input,textarea,select,[contenteditable]")
  )
    return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    choose(selected + (e.key === "ArrowRight" ? 1 : -1));
  }
});
let lastSize = "";
const ro = new ResizeObserver(() => {
  const size = `${Math.round(stage.clientWidth)}:${Math.round(stage.clientHeight)}`;

  measureCategories();
  if (size !== lastSize && modalPhase === "idle") {
    lastSize = size;
    rebuildDome();
  }
});

ro.observe(stage);
measureCategories();
refreshGallery();
document.fonts.ready.then(() => {
  measureCategories();
  if (modalPhase === "idle") rebuildDome();
});

I18n.subscribe(() => {
  $("#locationLabel").textContent = T(branches[requested] || branches.chuy);
  catButtons.forEach((button, i) => {
    button.textContent = T(categories[i].name);
  });
  measureCategories();
  const category = categories[selected];

  $("#galleryTitle").textContent = T(category.name).toUpperCase();
  $("#galleryCount").textContent =
    `${String(category.items.length).padStart(2, "0")} ${T("ПОЗИЦИЙ")}`;
  const currentQty = activeQty;

  if (activeDish) {
    const index = category.items.findIndex(
      (item) => item.name === activeDish.name,
    );

    if (index >= 0) {
      fillDish(index);
      activeQty = currentQty;
      updateQty();
    }
  }

  $("#cartBranch").textContent = T(branches[requested] || branches.chuy);
  updateCart();
  if (!slideState.busy) resetSlide();
});
