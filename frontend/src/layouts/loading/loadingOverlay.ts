const FADE_OUT_MS = 500;

export function hideLoadingOverlay(): void {
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) {
    window.dispatchEvent(new Event("loading-overlay-hidden"));
    return;
  }
  if (overlay.dataset.hiding === "true") return;
  overlay.dataset.hiding = "true";

  overlay.classList.remove("opacity-100");
  overlay.classList.add("opacity-0");
  window.setTimeout(() => {
    overlay.style.display = "none";
    window.dispatchEvent(new Event("loading-overlay-hidden"));
  }, FADE_OUT_MS);
}
