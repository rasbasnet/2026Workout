import { CALORIE_LEVELS } from "./constants.js";
import { protectPage } from "./auth-guard.js";
import { setStatus, wireGlobalActions } from "./layout.js";
import { addFoodLog, getRecentFoodLogs } from "./firebase.js";
import { toDateTimeInputValue, formatDateTime, escapeHtml } from "./utils.js";

const form = document.getElementById("foodForm");
const eatenAtInput = document.getElementById("eatenAt");
const levelInput = document.getElementById("calorieLevel");
const historyNode = document.getElementById("foodHistory");

eatenAtInput.value = toDateTimeInputValue();

levelInput.innerHTML = CALORIE_LEVELS.map(
  (level) => `<option value="${level}">${level}</option>`
).join("");

function renderHistory(items) {
  if (!items.length) {
    historyNode.innerHTML = '<li class="list-item">No food logs yet.</li>';
    return;
  }

  historyNode.innerHTML = items
    .slice(0, 35)
    .map(
      (entry) => `
        <li class="list-item">
          <div class="head">
            <span>${formatDateTime(entry.eatenAt)}</span>
            <span>${escapeHtml(entry.calorieLevel || "-")}</span>
          </div>
          <p><strong>${escapeHtml(entry.meal || "")}</strong></p>
          ${entry.notes ? `<p class="subtle">${escapeHtml(entry.notes)}</p>` : ""}
        </li>
      `
    )
    .join("");
}

async function refreshLogs(user) {
  const logs = await getRecentFoodLogs(user.uid, 200);
  renderHistory(logs);
}

protectPage((user) => {
  wireGlobalActions();

  refreshLogs(user).catch((error) => {
    setStatus(error.message || "Could not load food logs.", "alert");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const eatenAt = String(data.get("eatenAt") || "");
    const meal = String(data.get("meal") || "").trim();
    const calorieLevel = String(data.get("calorieLevel") || "");
    const notes = String(data.get("notes") || "").trim();

    if (!meal || !eatenAt || !calorieLevel) {
      setStatus("Meal, time, and calorie level are required.", "alert");
      return;
    }

    try {
      await addFoodLog(user.uid, {
        eatenAt,
        meal,
        calorieLevel,
        notes
      });
      setStatus("Food log saved.", "success");
      form.reset();
      eatenAtInput.value = toDateTimeInputValue();
      levelInput.value = "Medium";
      await refreshLogs(user);
    } catch (error) {
      setStatus(error.message || "Could not save food log.", "alert");
    }
  });

  levelInput.value = "Medium";
});
