import { protectPage } from "./auth-guard.js";
import { wireGlobalActions, setStatus } from "./layout.js";
import {
  saveProfile,
  getProfile,
  getWeightLogs,
  getRecentWorkoutLogs,
  getRecentFoodLogs,
  formatFirebaseError
} from "./firebase.js";
import { toDateInputValue, numberOrNull } from "./utils.js";

const workoutCountNode = document.getElementById("metricWorkoutDays");
const foodCountNode = document.getElementById("metricMealsWeek");
const goalEtaNode = document.getElementById("metricGoalEta");
const weightTrendText = document.getElementById("weightTrendText");
const miniWeightChartCanvas = document.getElementById("miniWeightChart");
const miniActivityChartCanvas = document.getElementById("miniActivityChart");

const profileModalBackdrop = document.getElementById("profileModalBackdrop");
const profileModalForm = document.getElementById("profileModalForm");
const profileModalStatus = document.getElementById("profileModalStatus");
const saveProfileModalBtn = document.getElementById("saveProfileModalBtn");
const modalStartingDate = document.getElementById("modalStartingDate");

if (modalStartingDate) {
  modalStartingDate.value = toDateInputValue();
}

let miniWeightChart;
let miniActivityChart;

function setModalStatus(message = "", type = "") {
  if (!profileModalStatus) return;
  profileModalStatus.textContent = message;
  profileModalStatus.className = type;
}

function profileHasStart(profile) {
  return Boolean(profile?.startingWeightKg && profile?.startingDate);
}

function goalWeightOf(profile) {
  return numberOrNull(profile?.goalWeightKg);
}

function calcEta(profile, weightLogs) {
  const goalWeight = goalWeightOf(profile);
  if (!goalWeight) return "Not set";

  const sorted = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  if (!latest) return "Need weight logs";
  if (sorted.length < 2) return "Need more data";

  const first = sorted[0];
  const days = Math.max(1, (new Date(latest.date) - new Date(first.date)) / 86400000);
  const slope = (Number(latest.weightKg) - Number(first.weightKg)) / days;
  const distance = goalWeight - Number(latest.weightKg);

  if (distance === 0) return "Goal reached";
  if (slope === 0) return "Flat trend";

  const towardGoal = distance > 0 ? slope > 0 : slope < 0;
  if (!towardGoal) return "Trend away from goal";

  const etaDays = Math.ceil(Math.abs(distance / slope));
  if (!Number.isFinite(etaDays) || etaDays > 3650) return "Insufficient trend";

  const eta = new Date();
  eta.setDate(eta.getDate() + etaDays);
  return `${etaDays}d (${eta.toLocaleDateString()})`;
}

function lastNDates(days) {
  const labels = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    labels.push(d.toISOString().slice(0, 10));
  }
  return labels;
}

function renderCharts(weightLogs, workoutLogs, foodLogs) {
  const ChartCtor = window.Chart;
  if (!ChartCtor) return;

  const weightSorted = [...weightLogs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-21);

  miniWeightChart?.destroy();
  miniWeightChart = new ChartCtor(miniWeightChartCanvas, {
    type: "line",
    data: {
      labels: weightSorted.map((item) => item.date.slice(5)),
      datasets: [
        {
          label: "Weight",
          data: weightSorted.map((item) => Number(item.weightKg)),
          borderColor: "#7f8bff",
          backgroundColor: "rgba(127, 139, 255, 0.2)",
          tension: 0.35,
          fill: true,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });

  const labels = lastNDates(14);
  const workoutSet = new Set(
    workoutLogs.filter((x) => (x.completedSteps || []).length > 0).map((x) => x.date)
  );

  const mealByDay = new Map();
  foodLogs.forEach((item) => {
    const day = String(item.eatenAt || "").slice(0, 10);
    mealByDay.set(day, (mealByDay.get(day) || 0) + 1);
  });

  miniActivityChart?.destroy();
  miniActivityChart = new ChartCtor(miniActivityChartCanvas, {
    type: "bar",
    data: {
      labels: labels.map((d) => d.slice(5)),
      datasets: [
        {
          label: "Workout day",
          data: labels.map((d) => (workoutSet.has(d) ? 1 : 0)),
          backgroundColor: "#92f16f"
        },
        {
          label: "Meals",
          data: labels.map((d) => mealByDay.get(d) || 0),
          backgroundColor: "#7f8bff"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#9fb0c7" } } },
      scales: {
        x: { ticks: { color: "#95a6bf" }, grid: { color: "rgba(130,145,170,0.15)" } },
        y: { ticks: { color: "#95a6bf" }, grid: { color: "rgba(130,145,170,0.15)" }, beginAtZero: true }
      }
    }
  });
}

function showModal(profile = null) {
  profileModalBackdrop.classList.remove("hidden");
  if (profile) {
    profileModalForm.heightCm.value = profile.heightCm || "";
    profileModalForm.startingWeightKg.value = profile.startingWeightKg || "";
    profileModalForm.startingDate.value = profile.startingDate || toDateInputValue();
    profileModalForm.goalWeightKg.value = profile.goalWeightKg || "";
    profileModalForm.targetDate.value = profile.targetDate || profile.goalDate || "";
  }
}

function hideModal() {
  profileModalBackdrop.classList.add("hidden");
}

async function refreshDashboard(user) {
  const [profile, weightLogs, workoutLogs, foodLogs] = await Promise.all([
    getProfile(user.uid),
    getWeightLogs(user.uid, 180),
    getRecentWorkoutLogs(user.uid, 180),
    getRecentFoodLogs(user.uid, 220)
  ]);

  const workoutDays = workoutLogs.filter((x) => (x.completedSteps || []).length > 0).length;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const mealsThisWeek = foodLogs.filter((x) => new Date(x.eatenAt) >= oneWeekAgo).length;

  workoutCountNode.textContent = String(workoutDays);
  foodCountNode.textContent = String(mealsThisWeek);
  goalEtaNode.textContent = calcEta(profile, weightLogs);

  if (weightLogs.length >= 2) {
    const first = weightLogs[weightLogs.length - 1];
    const last = weightLogs[0];
    const diff = Number(last.weightKg) - Number(first.weightKg);
    weightTrendText.textContent = `Change across sample: ${diff.toFixed(1)} kg`;
  } else {
    weightTrendText.textContent = "Add more weight logs in Profile to unlock trend insights.";
  }

  renderCharts(weightLogs, workoutLogs, foodLogs);

  if (!profileHasStart(profile)) {
    showModal(profile);
  } else {
    hideModal();
  }

  return { profile };
}

let initialized = false;

protectPage((user) => {
  if (initialized) return;
  initialized = true;
  wireGlobalActions();

  refreshDashboard(user).catch((error) => {
    setStatus(formatFirebaseError(error), "alert");
  });

  profileModalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setModalStatus("Saving profile...", "info");
    saveProfileModalBtn.disabled = true;

    const formData = new FormData(profileModalForm);
    const payload = {
      heightCm: numberOrNull(formData.get("heightCm")),
      startingWeightKg: numberOrNull(formData.get("startingWeightKg")),
      startingDate: String(formData.get("startingDate") || ""),
      goalWeightKg: numberOrNull(formData.get("goalWeightKg")),
      targetDate: String(formData.get("targetDate") || ""),
      currentWeightKg: numberOrNull(formData.get("startingWeightKg"))
    };

    if (!payload.heightCm || !payload.startingWeightKg || !payload.startingDate || !payload.goalWeightKg) {
      setModalStatus("Height, starting weight/date, and goal weight are required.", "alert");
      saveProfileModalBtn.disabled = false;
      return;
    }

    try {
      await saveProfile(user.uid, payload);
      setModalStatus("Profile saved.", "success");
      setStatus("Setup complete.", "success");
      await refreshDashboard(user);
    } catch (error) {
      setModalStatus(formatFirebaseError(error), "alert");
      setStatus(formatFirebaseError(error), "alert");
    } finally {
      saveProfileModalBtn.disabled = false;
    }
  });
});
