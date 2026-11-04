export function initSite() {
  const dialog = document.querySelector("#linusLegal");

  document.querySelectorAll("[data-open-legal]").forEach((button) => {
    button.addEventListener("click", () => dialog?.showModal());
  });
  document.querySelectorAll("[data-close-legal]").forEach((button) => {
    button.addEventListener("click", () => dialog?.close());
  });
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}
