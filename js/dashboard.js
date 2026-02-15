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
import { toDateInputValue, formatDate } from "./utils.js";

const profileForm = document.getElementById("profileForm");
const weightForm = document.getElementById("weightForm");
const weightDateInput = document.getElementById("weightDate");
const weightHistory = document.getElementById("weightHistory");
const workoutCountNode = document.getElementById("metricWorkoutDays");
const foodCountNode = document.getElementById("metricMealsWeek");
const latestWeightNode = document.getElementById("metricLatestWeight");
const goalEtaNode = document.getElementById("metricGoalEta");

weightDateInput.value = toDateInputValue();

function slopePerDay(items) {
  if (items.length < 2) return 0;
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const dayDiff = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
  return (Number(last.weightKg) - Number(first.weightKg)) / dayDiff;
}

function estimateGoalEta(profile, weightLogs) {
  if (!profile?.goalWeightKg || weightLogs.length < 2) return "Need more data";
  const latest = [...weightLogs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const slope = slopePerDay(weightLogs.slice(0, 21));
  const distance = Number(profile.goalWeightKg) - Number(latest.weightKg);

  if (distance === 0) return "Goal reached";
  if (slope === 0) return "No trend yet";

  const trendHelps = distance > 0 ? slope > 0 : slope < 0;
  if (!trendHelps) return "Current trend moves away";

  const days = Math.ceil(Math.abs(distance / slope));
  if (!Number.isFinite(days) || days > 3650) return "Not enough stable data";
  const eta = new Date();
  eta.setDate(eta.getDate() + days);
  return `${days} days (${eta.toLocaleDateString()})`;
}

function renderWeightHistory(items) {
  if (!items.length) {
    weightHistory.innerHTML = '<li class="list-item">No weight logs yet.</li>';
    return;
  }

  const top = [...items]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
    .map(
      (item) => `
        <li class="list-item">
          <div class="head">
            <span>${formatDate(item.date)}</span>
            <span>${item.weightKg} kg</span>
          </div>
          ${item.note ? `<p class="subtle">${item.note}</p>` : ""}
        </li>
      `
    )
    .join("");

  weightHistory.innerHTML = top;
}

async function refreshDashboard(user) {
  const [profile, weightLogs, workoutLogs, foodLogs] = await Promise.all([
    getProfile(user.uid),
    getWeightLogs(user.uid, 90),
    getRecentWorkoutLogs(user.uid, 90),
    getRecentFoodLogs(user.uid, 200)
  ]);

  if (profile) {
    profileForm.heightCm.value = profile.heightCm || "";
    profileForm.currentWeightKg.value = profile.currentWeightKg || "";
    profileForm.goalWeightKg.value = profile.goalWeightKg || "";
    profileForm.goalDate.value = profile.goalDate || "";
  }

  renderWeightHistory(weightLogs);

  const workoutDays = workoutLogs.filter((log) => Array.isArray(log.completedSteps) && log.completedSteps.length > 0)
    .length;

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  const mealsThisWeek = foodLogs.filter((entry) => new Date(entry.eatenAt) >= oneWeekAgo).length;
  const latestWeight = [...weightLogs].sort((a, b) => b.date.localeCompare(a.date))[0];

  workoutCountNode.textContent = String(workoutDays);
  foodCountNode.textContent = String(mealsThisWeek);
  latestWeightNode.textContent = latestWeight ? `${latestWeight.weightKg} kg` : "-";
  goalEtaNode.textContent = estimateGoalEta(profile, weightLogs);
}

protectPage((user) => {
  wireGlobalActions();

  refreshDashboard(user).catch((error) => {
    setStatus(error.message || "Unable to load dashboard data.", "alert");
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(profileForm);

    const payload = {
      heightCm: Number(formData.get("heightCm") || 0),
      currentWeightKg: Number(formData.get("currentWeightKg") || 0),
      goalWeightKg: Number(formData.get("goalWeightKg") || 0),
      goalDate: String(formData.get("goalDate") || "")
    };

    try {
      await saveProfile(user.uid, payload);
      setStatus("Profile saved.", "success");
      await refreshDashboard(user);
    } catch (error) {
      setStatus(error.message || "Could not save profile.", "alert");
    }
  });

  weightForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(weightForm);
    const date = String(formData.get("date") || "");
    const weightKg = Number(formData.get("weightKg") || 0);
    const note = String(formData.get("note") || "").trim();

    if (!date || !weightKg) {
      setStatus("Date and weight are required.", "alert");
      return;
    }

    try {
      await saveDailyWeight(user.uid, date, { date, weightKg, note });
      await saveProfile(user.uid, { currentWeightKg: weightKg });
      weightForm.reset();
      weightDateInput.value = toDateInputValue();
      setStatus("Weight log saved.", "success");
      await refreshDashboard(user);
    } catch (error) {
      setStatus(error.message || "Could not save weight log.", "alert");
    }
  });
});
