import { CALORIE_LEVELS } from "./constants.js";
import { protectPage } from "./auth-guard.js";
import { setStatus, wireGlobalActions } from "./layout.js";
import { addFoodLog, getRecentFoodLogs, formatFirebaseError } from "./firebase.js";
import {
  toDateTimeInputValue,
  withHourOffset,
  formatDateTime,
  escapeHtml,
  buildChartUrl
} from "./utils.js";

const form = document.getElementById("foodForm");
const eatenAtInput = document.getElementById("eatenAt");
const levelInput = document.getElementById("calorieLevel");
const historyNode = document.getElementById("foodHistory");
const timePills = document.getElementById("foodTimePills");
const postSaveHint = document.getElementById("postSaveHint");

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
          <div class="item-head">
            <span>${formatDateTime(entry.eatenAt)}</span>
            <span>${escapeHtml(entry.calorieLevel || "-")}</span>
          </div>
          <p><strong>${escapeHtml(entry.meal || "")}</strong></p>
          <div class="meta-row">
            ${entry.mealType ? `<span class="badge">${escapeHtml(entry.mealType)}</span>` : ""}
          </div>
          ${entry.notes ? `<p class="inline-note">${escapeHtml(entry.notes)}</p>` : ""}
        </li>
      `
    )
    .join("");
}

function setTimePreset(type) {
  if (type === "now") eatenAtInput.value = toDateTimeInputValue(new Date());
  if (type === "1h") eatenAtInput.value = toDateTimeInputValue(withHourOffset(new Date(), -1));
  if (type === "3h") eatenAtInput.value = toDateTimeInputValue(withHourOffset(new Date(), -3));
  if (type === "manual") eatenAtInput.showPicker?.();
}

timePills.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-time-preset]");
  if (!button) return;
  setTimePreset(button.getAttribute("data-time-preset"));
});

async function refreshLogs(user) {
  const logs = await getRecentFoodLogs(user.uid, 220);
  renderHistory(logs);
}

let initialized = false;

protectPage((user) => {
  if (initialized) return;
  initialized = true;
  wireGlobalActions();

  refreshLogs(user).catch((error) => {
    setStatus(formatFirebaseError(error), "alert");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const eatenAt = String(data.get("eatenAt") || "");
    const meal = String(data.get("meal") || "").trim();
    const calorieLevel = String(data.get("calorieLevel") || "");
    const mealType = String(data.get("mealType") || "");
    const notes = String(data.get("notes") || "").trim();
    const wantsChart = event.submitter?.value === "chart";

    if (!meal || !eatenAt || !calorieLevel) {
      setStatus("Meal, time, and calorie level are required.", "alert");
      return;
    }

    try {
      setStatus("Saving meal...", "info");
      await addFoodLog(user.uid, {
        eatenAt,
        meal,
        calorieLevel,
        mealType,
        notes
      });

      setStatus("Food log saved.", "success");
      postSaveHint.classList.remove("hidden");
      postSaveHint.innerHTML = `Saved. <a href="${buildChartUrl("food")}">See chart update</a>.`;

      form.reset();
      eatenAtInput.value = toDateTimeInputValue();
      levelInput.value = "Medium";

      await refreshLogs(user);

      if (wantsChart) {
        window.location.href = buildChartUrl("food");
      }
    } catch (error) {
      setStatus(formatFirebaseError(error), "alert");
    }
  });

  levelInput.value = "Medium";
});
