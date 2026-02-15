import { protectPage } from "./auth-guard.js";
import { wireGlobalActions, setStatus } from "./layout.js";
import {
  saveProfile,
  getProfile,
  saveDailyWeight,
  getWeightLogs,
  getRecentWorkoutLogs,
  getRecentFoodLogs
} from "./firebase.js";
import {
  toDateInputValue,
  formatDate,
  numberOrNull,
  buildChartUrl,
  escapeHtml
} from "./utils.js";

const weightForm = document.getElementById("weightForm");
const weightDateInput = document.getElementById("weightDate");
const weightHistory = document.getElementById("weightHistory");
const profileSummary = document.getElementById("profileSummary");
const weightSaveHint = document.getElementById("weightSaveHint");
const workoutCountNode = document.getElementById("metricWorkoutDays");
const foodCountNode = document.getElementById("metricMealsWeek");
const latestWeightNode = document.getElementById("metricLatestWeight");
const goalEtaNode = document.getElementById("metricGoalEta");

const profileModalBackdrop = document.getElementById("profileModalBackdrop");
const profileModalForm = document.getElementById("profileModalForm");
const profileModalStatus = document.getElementById("profileModalStatus");
const saveProfileModalBtn = document.getElementById("saveProfileModalBtn");

weightDateInput.value = toDateInputValue();

function setModalStatus(message = "", type = "") {
  if (!profileModalStatus) return;
  profileModalStatus.textContent = message;
  profileModalStatus.className = type;
}

function profileIsComplete(profile) {
  return Boolean(
    profile && numberOrNull(profile.heightCm) && numberOrNull(profile.currentWeightKg) && numberOrNull(profile.goalWeightKg)
  );
}

function slopePerDay(items) {
  if (items.length < 2) return 0;
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const dayDiff = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
  return (Number(last.weightKg) - Number(first.weightKg)) / dayDiff;
}

function estimateGoalEta(profile, weightLogs) {
  if (!profile?.goalWeightKg || weightLogs.length < 2) return "Need more weight logs";
  const latest = [...weightLogs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const slope = slopePerDay(weightLogs.slice(0, 30));
  const distance = Number(profile.goalWeightKg) - Number(latest.weightKg);

  if (distance === 0) return "Goal reached";
  if (slope === 0) return "Flat trend";

  const towardGoal = distance > 0 ? slope > 0 : slope < 0;
  if (!towardGoal) return "Current trend is away from goal";

  const days = Math.ceil(Math.abs(distance / slope));
  if (!Number.isFinite(days) || days > 3650) return "Need more stable data";

  const eta = new Date();
  eta.setDate(eta.getDate() + days);
  return `${days} days (${eta.toLocaleDateString()})`;
}

function renderWeightHistory(items) {
  if (!items.length) {
    weightHistory.innerHTML = '<li class="list-item">No weight logs yet.</li>';
    return;
  }

  weightHistory.innerHTML = [...items]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
    .map(
      (item) => `
        <li class="list-item">
          <div class="item-head">
            <span>${formatDate(item.date)}</span>
            <span>${item.weightKg} kg</span>
          </div>
          ${item.note ? `<p class="inline-note">${escapeHtml(item.note)}</p>` : ""}
        </li>
      `
    )
    .join("");
}

function renderProfileSummary(profile) {
  if (!profile) {
    profileSummary.textContent = "Profile not set yet.";
    return;
  }

  const pieces = [
    profile.heightCm ? `Height ${profile.heightCm} cm` : null,
    profile.currentWeightKg ? `Current ${profile.currentWeightKg} kg` : null,
    profile.goalWeightKg ? `Goal ${profile.goalWeightKg} kg` : null,
    profile.goalDate ? `Target ${profile.goalDate}` : null
  ].filter(Boolean);

  profileSummary.textContent = pieces.length ? pieces.join(" | ") : "Profile partially set.";
}

function showProfileModal(profile = null) {
  if (!profileModalBackdrop) return;
  profileModalBackdrop.classList.remove("hidden");

  if (profile) {
    profileModalForm.heightCm.value = profile.heightCm || "";
    profileModalForm.currentWeightKg.value = profile.currentWeightKg || "";
    profileModalForm.goalWeightKg.value = profile.goalWeightKg || "";
    profileModalForm.goalDate.value = profile.goalDate || "";
  }
}

function hideProfileModal() {
  if (!profileModalBackdrop) return;
  profileModalBackdrop.classList.add("hidden");
}

async function refreshDashboard(user) {
  const [profile, weightLogs, workoutLogs, foodLogs] = await Promise.all([
    getProfile(user.uid),
    getWeightLogs(user.uid, 120),
    getRecentWorkoutLogs(user.uid, 120),
    getRecentFoodLogs(user.uid, 220)
  ]);

  renderProfileSummary(profile);
  renderWeightHistory(weightLogs);

  const workoutDays = workoutLogs.filter((log) => Array.isArray(log.completedSteps) && log.completedSteps.length > 0).length;
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  const mealsThisWeek = foodLogs.filter((entry) => new Date(entry.eatenAt) >= oneWeekAgo).length;
  const latestWeight = [...weightLogs].sort((a, b) => b.date.localeCompare(a.date))[0];

  workoutCountNode.textContent = String(workoutDays);
  foodCountNode.textContent = String(mealsThisWeek);
  latestWeightNode.textContent = latestWeight ? `${latestWeight.weightKg} kg` : "-";
  goalEtaNode.textContent = estimateGoalEta(profile, weightLogs);

  if (!profileIsComplete(profile)) {
    showProfileModal(profile);
  } else {
    hideProfileModal();
  }

  return { profile };
}

let initialized = false;

protectPage((user) => {
  if (initialized) return;
  initialized = true;
  wireGlobalActions();

  refreshDashboard(user).catch((error) => {
    setStatus(error.message || "Unable to load dashboard data.", "alert");
  });

  profileModalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setModalStatus("");
    saveProfileModalBtn.disabled = true;

    const formData = new FormData(profileModalForm);
    const payload = {
      heightCm: numberOrNull(formData.get("heightCm")),
      currentWeightKg: numberOrNull(formData.get("currentWeightKg")),
      goalWeightKg: numberOrNull(formData.get("goalWeightKg")),
      goalDate: String(formData.get("goalDate") || "")
    };

    if (!payload.heightCm || !payload.currentWeightKg || !payload.goalWeightKg) {
      setModalStatus("Height, current weight, and goal weight are required.", "alert");
      saveProfileModalBtn.disabled = false;
      return;
    }

    try {
      await saveProfile(user.uid, payload);
      setModalStatus("Profile saved.", "success");
      await refreshDashboard(user);
      setStatus("Profile setup complete.", "success");
    } catch (error) {
      setModalStatus(error.message || "Could not save profile.", "alert");
    } finally {
      saveProfileModalBtn.disabled = false;
    }
  });

  weightForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(weightForm);
    const date = String(formData.get("date") || "");
    const weightKg = numberOrNull(formData.get("weightKg"));
    const note = String(formData.get("note") || "").trim();
    const wantsChart = event.submitter?.value === "chart";

    if (!date || !weightKg) {
      setStatus("Date and a valid weight are required.", "alert");
      return;
    }

    try {
      await saveDailyWeight(user.uid, date, { date, weightKg, note });
      await saveProfile(user.uid, { currentWeightKg: weightKg });
      weightForm.reset();
      weightDateInput.value = toDateInputValue();
      setStatus("Weight log saved.", "success");

      weightSaveHint.classList.remove("hidden");
      weightSaveHint.innerHTML = `Saved. <a href="${buildChartUrl("weight")}">View updated charts</a>.`;

      await refreshDashboard(user);

      if (wantsChart) {
        window.location.href = buildChartUrl("weight");
      }
    } catch (error) {
      setStatus(error.message || "Could not save weight log.", "alert");
    }
  });
});
