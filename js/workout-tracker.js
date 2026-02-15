import { WORKOUT_STEPS } from "./constants.js";
import { protectPage } from "./auth-guard.js";
import { setStatus, wireGlobalActions } from "./layout.js";
import { saveWorkoutLog, getRecentWorkoutLogs } from "./firebase.js";
import { toDateInputValue, formatDate, escapeHtml } from "./utils.js";

const stepsContainer = document.getElementById("stepsContainer");
const workoutForm = document.getElementById("workoutForm");
const historyNode = document.getElementById("workoutHistory");
const workoutDate = document.getElementById("workoutDate");

workoutDate.value = toDateInputValue();

const stepLabelById = new Map(WORKOUT_STEPS.map((step) => [step.id, step.label]));

stepsContainer.innerHTML = WORKOUT_STEPS.map(
  (step) => `
    <label class="checkbox-item">
      <input type="checkbox" name="completedSteps" value="${step.id}" />
      <span>
        <strong>${step.label}</strong>
        <span class="subtle">${step.group}</span>
      </span>
    </label>
  `
).join("");

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
    .slice(0, 25)
    .map((log) => {
      const steps = Array.isArray(log.completedSteps) ? log.completedSteps : [];
      const labels = steps.map((id) => stepLabelById.get(id) || id);

      return `
        <li class="list-item">
          <div class="head">
            <span>${formatDate(log.date)}</span>
            <span>${steps.length} step(s)</span>
          </div>
          <p class="subtle">Session: ${escapeHtml(log.sessionType || "mixed")}</p>
          <div class="badge-row">
            ${labels.map((label) => `<span class="badge">${escapeHtml(label)}</span>`).join("")}
          </div>
          ${log.notes ? `<p class="subtle">Notes: ${escapeHtml(log.notes)}</p>` : ""}
        </li>
      `;
    })
    .join("");
}

async function refreshLogs(user) {
  const logs = await getRecentWorkoutLogs(user.uid, 180);
  renderHistory(logs);
}

protectPage((user) => {
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
      await refreshLogs(user);
    } catch (error) {
      setStatus(error.message || "Could not save workout log.", "alert");
    }
  });
});
