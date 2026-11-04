import { dictionary } from "../data/translations.js";

const supported = new Set(["ky", "ru", "en"]);
const storageKey = "linus.language";

let current = "ru";

try {
  const stored = localStorage.getItem(storageKey);

  if (supported.has(stored)) current = stored;
} catch {}

const subscribers = new Set();

function t(source) {
  if (source == null) return "";
  const value = String(source);
  const exact = dictionary[current][value];

  if (exact != null) return exact;
  if (current === "ru") return value;
  const number = value.match(/^(\d+(?:[–-]\d+)?) мин$/);

  if (number) return `${number[1]} ${current === "ky" ? "мүн" : "min"}`;
  const quantity = value.match(/^(\d+) (г|мл)$/);

  if (quantity)
    return `${quantity[1]} ${quantity[2] === "г" ? (current === "ky" ? "г" : "g") : "ml"}`;

  return value;
}

function render(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria")));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.setAttribute("title", t(node.getAttribute("data-i18n-title")));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.getAttribute("data-i18n-placeholder"));
  });
  document.documentElement.lang = current;
  document
    .querySelectorAll(".linus-lang")
    .forEach((node) => (node.value = current));
  const titles = {
    index: {
      ru: "LINUS — Выбор ресторана",
      ky: "LINUS — Ресторанды тандоо",
      en: "LINUS — Choose a restaurant",
    },
    menu: { ru: "LINUS — Меню", ky: "LINUS — Меню", en: "LINUS — Menu" },
    order: {
      ru: "LINUS — Ваш заказ",
      ky: "LINUS — Сиздин буйрутмаңыз",
      en: "LINUS — Your order",
    },
  };
  const page = document.body.dataset.page;

  if (page && titles[page]) document.title = titles[page][current];
}

function setLanguage(language) {
  if (!supported.has(language) || current === language) return;
  current = language;
  try {
    localStorage.setItem(storageKey, language);
  } catch {}

  render();
  for (const callback of subscribers) callback(language);
}

function init() {
  render();
  document.querySelectorAll(".linus-lang").forEach((node) => {
    node.addEventListener("change", () => setLanguage(node.value));
  });
}

export const I18n = {
  t,
  render,
  init,
  setLanguage,
  get language() {
    return current;
  },
  subscribe(callback) {
    subscribers.add(callback);

    return () => subscribers.delete(callback);
  },
  number(value) {
    return new Intl.NumberFormat(
      current === "en" ? "en-US" : current === "ky" ? "ky-KG" : "ru-RU",
    ).format(value);
  },
  currency(value) {
    return `${this.number(value)} ${t("сом")}`;
  },
};
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
