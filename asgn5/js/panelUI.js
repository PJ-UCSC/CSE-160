/**
 * @file Collapsible controls panel — header toggle + `<details>` state in sessionStorage.
 */

const STORAGE_KEY = "cse160-panel-collapsed";

export function initPanelUI() {
  const panel = document.getElementById("lights-panel");
  const collapseBtn = document.getElementById("panel-collapse");
  if (!panel || !collapseBtn) return;

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored === "1") {
    setPanelCollapsed(panel, collapseBtn, true);
  }

  collapseBtn.addEventListener("click", () => {
    const collapsed = !panel.classList.contains("is-collapsed");
    setPanelCollapsed(panel, collapseBtn, collapsed);
    sessionStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  });
}

function setPanelCollapsed(panel, btn, collapsed) {
  panel.classList.toggle("is-collapsed", collapsed);
  btn.setAttribute("aria-expanded", String(!collapsed));
  btn.title = collapsed ? "Expand panel" : "Collapse panel";
}
