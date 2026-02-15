import { protectPage } from "./auth-guard.js";
import { wireGlobalActions } from "./layout.js";

function injectRoutineControls() {
  const anchor = document.querySelector("#status");
  if (!anchor) return;

  const controls = document.createElement("div");
  controls.className = "hero-actions";
  controls.style.margin = "8px 0 0";
  controls.innerHTML = `
    <button type="button" id="collapsePlayersBtn" class="ghost">Collapse video panels</button>
    <button type="button" id="expandPlayersBtn" class="ghost">Expand all video panels</button>
  `;

  anchor.insertAdjacentElement("afterend", controls);

  const collapseBtn = document.getElementById("collapsePlayersBtn");
  const expandBtn = document.getElementById("expandPlayersBtn");

  const allPlayers = () => [...document.querySelectorAll(".routine .player")];

  const collapseAll = () => {
    allPlayers().forEach((panel) => panel.classList.add("hidden"));
  };

  const expandAll = () => {
    allPlayers().forEach((panel) => panel.classList.remove("hidden"));
  };

  collapseBtn?.addEventListener("click", collapseAll);
  expandBtn?.addEventListener("click", expandAll);

  // Start in collapsed mode for a cleaner routine page.
  collapseAll();

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button.play");
    if (!button) return;
    const routine = button.closest("[data-routine]");
    const player = routine?.querySelector(".player");
    if (player) player.classList.remove("hidden");
  });
}

protectPage(() => {
  if (window.__routineBooted) return;
  window.__routineBooted = true;
  wireGlobalActions();
  injectRoutineControls();
});
