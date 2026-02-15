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
  const allRoutines = () => [...document.querySelectorAll(".routine[data-routine]")];

  const collapseAll = () => {
    allPlayers().forEach((panel) => panel.classList.add("hidden"));
    allRoutines().forEach((routine, index) => {
      if (index === 0) {
        routine.classList.remove("routine-collapsed");
      } else {
        routine.classList.add("routine-collapsed");
      }
      const toggle = routine.querySelector(".routine-toggle");
      if (toggle) toggle.textContent = routine.classList.contains("routine-collapsed") ? "Open" : "Hide";
    });
  };

  const expandAll = () => {
    allPlayers().forEach((panel) => panel.classList.remove("hidden"));
    allRoutines().forEach((routine) => {
      routine.classList.remove("routine-collapsed");
      const toggle = routine.querySelector(".routine-toggle");
      if (toggle) toggle.textContent = "Hide";
    });
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
    if (routine) {
      routine.classList.remove("routine-collapsed");
      const toggle = routine.querySelector(".routine-toggle");
      if (toggle) toggle.textContent = "Hide";
    }
  });

  allRoutines().forEach((routine, index) => {
    const head = routine.querySelector(".routineHead");
    if (!head) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ghost routine-toggle";
    toggle.textContent = index === 0 ? "Hide" : "Open";

    toggle.addEventListener("click", () => {
      routine.classList.toggle("routine-collapsed");
      toggle.textContent = routine.classList.contains("routine-collapsed") ? "Open" : "Hide";
    });

    head.appendChild(toggle);
    if (index !== 0) {
      routine.classList.add("routine-collapsed");
    }
  });
}

protectPage(() => {
  if (window.__routineBooted) return;
  window.__routineBooted = true;
  wireGlobalActions();
  injectRoutineControls();
});
