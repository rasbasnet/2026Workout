import { WORKOUT_STEPS } from "./constants.js";
import { protectPage } from "./auth-guard.js";
import { setStatus, wireGlobalActions } from "./layout.js";
import { saveWorkoutLog, getRecentWorkoutLogs } from "./firebase.js";
import {
  toDateInputValue,
  withDayOffset,
  formatDate,
  escapeHtml,
  buildChartUrl
} from "./utils.js";

const workoutForm = document.getElementById("workoutForm");
const historyNode = document.getElementById("workoutHistory");
const workoutDate = document.getElementById("workoutDate");
const datePills = document.getElementById("workoutDatePills");
const stepsContainerWfh = document.getElementById("stepsContainerWfh");
const stepsContainerNonWfh = document.getElementById("stepsContainerNonWfh");
const selectedStepCount = document.getElementById("selectedStepCount");
const postSaveHint = document.getElementById("postSaveHint");

const pickFullWfh = document.getElementById("pickFullWfh");
const pickIntensiveA = document.getElementById("pickIntensiveA");
const pickIntensiveB = document.getElementById("pickIntensiveB");
const clearStepsBtn = document.getElementById("clearSteps");

workoutDate.value = toDateInputValue();

const stepLabelById = new Map(WORKOUT_STEPS.map((step) => [step.id, step.label]));
const wfhSteps = WORKOUT_STEPS.filter((step) => step.group === "WFH");
const nonWfhSteps = WORKOUT_STEPS.filter((step) => step.group === "Non-WFH");

function renderStepOptions(container, steps) {
  container.innerHTML = steps
    .map(
      (step) => `
        <label class="step-item">
          <input type="checkbox" name="completedSteps" value="${step.id}" />
          <span>${step.label}</span>
        </label>
      `
    )
    .join("");
}

renderStepOptions(stepsContainerWfh, wfhSteps);
renderStepOptions(stepsContainerNonWfh, nonWfhSteps);

function allStepInputs() {
  return [...workoutForm.querySelectorAll('input[name="completedSteps"]')];
}

function getSelectedStepIds() {
  return allStepInputs().filter((item) => item.checked).map((item) => item.value);
}

function updateSelectedCount() {
  selectedStepCount.textContent = String(getSelectedStepIds().length);
}

function setDatePreset(type) {
  if (type === "today") workoutDate.value = toDateInputValue(new Date());
  if (type === "yesterday") workoutDate.value = toDateInputValue(withDayOffset(new Date(), -1));
}

function applyStepSelection(ids) {
  const wanted = new Set(ids);
  allStepInputs().forEach((input) => {
    input.checked = wanted.has(input.value);
  });
  updateSelectedCount();
}

function inferSessionType(completedSteps) {
  const groups = new Set(
    completedSteps
      .map((id) => WORKOUT_STEPS.find((step) => step.id === id)?.group)
      .filter(Boolean)
  );

  if (groups.size > 1) return "mixed";
  if (groups.has("WFH")) return "wfh";
  if (groups.has("Non-WFH")) return "non-wfh";
  return "mixed";
}

function renderHistory(logs) {
  if (!logs.length) {
    historyNode.innerHTML = '<li class="list-item">No workout logs yet.</li>';
    return;
  }

  historyNode.innerHTML = logs
    .slice(0, 30)
    .map((log) => {
      const steps = Array.isArray(log.completedSteps) ? log.completedSteps : [];
      const labels = steps.map((id) => stepLabelById.get(id) || id);

      return `
        <li class="list-item">
          <div class="item-head">
            <span>${formatDate(log.date)}</span>
            <span>${steps.length} step(s)</span>
          </div>
          <div class="meta-row">
            <span class="badge">${escapeHtml(log.sessionType || "mixed")}</span>
          </div>
          <div class="badge-row">
            ${labels.map((label) => `<span class="badge">${escapeHtml(label)}</span>`).join("")}
          </div>
          ${log.notes ? `<p class="inline-note">${escapeHtml(log.notes)}</p>` : ""}
        </li>
      `;
    })
    .join("");
}

async function refreshLogs(user) {
  const logs = await getRecentWorkoutLogs(user.uid, 180);
  renderHistory(logs);
}

workoutForm.addEventListener("change", (event) => {
  if (event.target.matches('input[name="completedSteps"]')) {
    updateSelectedCount();
  }
});

datePills.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-date-preset]");
  if (!button) return;
  const preset = button.getAttribute("data-date-preset");
  if (preset === "manual" || preset === "clear") {
    workoutDate.showPicker?.();
  } else {
    setDatePreset(preset);
  }
});

pickFullWfh.addEventListener("click", () => {
  applyStepSelection(wfhSteps.map((step) => step.id));
});

pickIntensiveA.addEventListener("click", () => {
  applyStepSelection(["ia"]);
});

pickIntensiveB.addEventListener("click", () => {
  applyStepSelection(["ib"]);
});

clearStepsBtn.addEventListener("click", () => {
  applyStepSelection([]);
});

let initialized = false;

protectPage((user) => {
  if (initialized) return;
  initialized = true;
  wireGlobalActions();

  refreshLogs(user).catch((error) => {
    setStatus(error.message || "Could not load workout logs.", "alert");
  });

  workoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(workoutForm);
    const date = String(formData.get("date") || "");
    const selected = formData.getAll("completedSteps").map(String);
    const notes = String(formData.get("notes") || "").trim();
    const selectedType = String(formData.get("sessionType") || "");
    const wantsChart = event.submitter?.value === "chart";

    if (!date) {
      setStatus("Choose a workout date.", "alert");
      return;
    }

    const sessionType =
      selectedType === "auto" ? inferSessionType(selected) : selectedType || inferSessionType(selected);

    try {
      await saveWorkoutLog(user.uid, date, {
        date,
        sessionType,
        completedSteps: selected,
        notes
      });

      setStatus("Workout log saved.", "success");
      postSaveHint.classList.remove("hidden");
      postSaveHint.innerHTML = `Saved. <a href="${buildChartUrl("workout")}">See chart update</a>.`;

      await refreshLogs(user);

      if (wantsChart) {
        window.location.href = buildChartUrl("workout");
      }
    } catch (error) {
      setStatus(error.message || "Could not save workout log.", "alert");
    }
  });
});

updateSelectedCount();
