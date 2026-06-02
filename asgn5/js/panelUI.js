const STORAGE_KEY = "cse160-panel-collapsed";

export function initPanelUI() {
  const panel = document.getElementById("lights-panel");
  const btn = document.getElementById("panel-collapse");
  if (!panel || !btn) return;

  if (sessionStorage.getItem(STORAGE_KEY) === "1") {
    setCollapsed(panel, btn, true);
  }

  btn.addEventListener("click", () => {
    const collapsed = !panel.classList.contains("is-collapsed");
    setCollapsed(panel, btn, collapsed);
    sessionStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  });
}

function setCollapsed(panel, btn, collapsed) {
  panel.classList.toggle("is-collapsed", collapsed);
  btn.setAttribute("aria-expanded", String(!collapsed));
  btn.title = collapsed ? "Expand panel" : "Collapse panel";
}
