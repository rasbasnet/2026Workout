import { protectPage } from "./auth-guard.js";
import { wireGlobalActions, setStatus } from "./layout.js";
import {
  getProfile,
  saveProfile,
  getRecentWorkoutLogs,
  getRecentFoodLogs,
  getWeightLogs,
  formatFirebaseError
} from "./firebase.js";
import { numberOrNull } from "./utils.js";

const workoutChartCanvas = document.getElementById("workoutChart");
const foodChartCanvas = document.getElementById("foodChart");
const weightChartCanvas = document.getElementById("weightChart");
const summaryBody = document.getElementById("summaryBody");
const trendNote = document.getElementById("trendNote");
const metricGoalEta = document.getElementById("metricGoalEta");
const metricConsistency = document.getElementById("metricConsistency");
const metricMealMix = document.getElementById("metricMealMix");
const fromTrackerNotice = document.getElementById("fromTrackerNotice");
const chartGoalForm = document.getElementById("chartGoalForm");
const chartGoalWeight = document.getElementById("chartGoalWeight");
const chartTargetDate = document.getElementById("chartTargetDate");

let workoutChart;
let foodChart;
let weightChart;
let initialized = false;

function getFlowLabel() {
  const from = new URLSearchParams(window.location.search).get("from") || "";
  if (from === "workout") return "Workout log saved. Charts include your latest workout entry.";
  if (from === "food") return "Food log saved. Charts include your latest meal entry.";
  if (from === "weight") return "Weight log saved. Weight trend is refreshed.";
  return "";
}

function renderFlowNotice() {
  const text = getFlowLabel();
  if (!text) return;
  fromTrackerNotice.classList.remove("hidden");
  fromTrackerNotice.textContent = text;
}

function lastNDates(days) {
  const labels = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    labels.push(date.toISOString().slice(0, 10));
  }
  return labels;
}

function trendSlope(weightLogs) {
  if (weightLogs.length < 2) return 0;
  const sorted = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
  return (Number(last.weightKg) - Number(first.weightKg)) / days;
}

function estimateEta(profile, weightLogs) {
  const goalWeight = numberOrNull(profile?.goalWeightKg);
  if (!goalWeight || weightLogs.length < 2) return "Need more data";

  const latest = [...weightLogs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const slope = trendSlope(weightLogs.slice(0, 30));
  const distance = goalWeight - Number(latest.weightKg);

  if (distance === 0) return "Goal reached";
  if (slope === 0) return "Flat trend";

  const towardGoal = distance > 0 ? slope > 0 : slope < 0;
  if (!towardGoal) return "Trend away from goal";

  const days = Math.ceil(Math.abs(distance / slope));
  if (!Number.isFinite(days) || days > 3650) return "Insufficient trend";

  const eta = new Date();
  eta.setDate(eta.getDate() + days);
  return `${days} days (${eta.toLocaleDateString()})`;
}

function calcConsistency(workoutLogs, spanDays = 30) {
  const labels = lastNDates(spanDays);
  const workoutDates = new Set(
    workoutLogs
      .filter((log) => Array.isArray(log.completedSteps) && log.completedSteps.length > 0)
      .map((log) => log.date)
  );
  const active = labels.filter((date) => workoutDates.has(date)).length;
  return Math.round((active / spanDays) * 100);
}

function calcMealMix(foodLogs) {
  if (!foodLogs.length) return { low: 0, medium: 0, high: 0 };
  return foodLogs.reduce(
    (acc, entry) => {
      const level = String(entry.calorieLevel || "").toLowerCase();
      if (level === "low") acc.low += 1;
      if (level === "medium") acc.medium += 1;
      if (level === "high") acc.high += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 }
  );
}

function toDailyWorkoutSeries(workoutLogs, days = 30) {
  const labels = lastNDates(days);
  const byDate = new Map(workoutLogs.map((log) => [log.date, log]));
  const steps = labels.map((date) => (byDate.get(date)?.completedSteps || []).length);
  return { labels, steps };
}

function toDailyFoodSeries(foodLogs, days = 30) {
  const labels = lastNDates(days);
  const grouped = new Map();

  foodLogs.forEach((entry) => {
    const date = String(entry.eatenAt || "").slice(0, 10);
    const level = String(entry.calorieLevel || "").toLowerCase();
    if (!grouped.has(date)) grouped.set(date, { low: 0, medium: 0, high: 0 });
    if (level === "low") grouped.get(date).low += 1;
    if (level === "medium") grouped.get(date).medium += 1;
    if (level === "high") grouped.get(date).high += 1;
  });

  return {
    labels,
    low: labels.map((date) => grouped.get(date)?.low || 0),
    medium: labels.map((date) => grouped.get(date)?.medium || 0),
    high: labels.map((date) => grouped.get(date)?.high || 0)
  };
}

function toWeightSeries(weightLogs, goalWeight) {
  const sorted = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date));
  return {
    labels: sorted.map((log) => log.date),
    values: sorted.map((log) => Number(log.weightKg)),
    goal: sorted.map(() => (goalWeight ? Number(goalWeight) : null))
  };
}

function chartTheme() {
  return {
    text: "#a7b4cc",
    grid: "rgba(125, 140, 165, 0.15)",
    blue: "#7f8bff",
    green: "#9ce56a",
    yellow: "#f4c45d",
    red: "#ff8b82"
  };
}

function renderCharts(profile, workoutLogs, foodLogs, weightLogs) {
  const ChartCtor = window.Chart;
  if (!ChartCtor) throw new Error("Chart.js did not load.");

  const theme = chartTheme();
  const workoutSeries = toDailyWorkoutSeries(workoutLogs, 30);
  const foodSeries = toDailyFoodSeries(foodLogs, 30);
  const weightSeries = toWeightSeries(weightLogs, profile?.goalWeightKg);

  workoutChart?.destroy();
  foodChart?.destroy();
  weightChart?.destroy();

  workoutChart = new ChartCtor(workoutChartCanvas, {
    type: "line",
    data: {
      labels: workoutSeries.labels,
      datasets: [
        {
          label: "Steps completed",
          data: workoutSeries.steps,
          tension: 0.34,
          borderColor: theme.blue,
          backgroundColor: "rgba(127, 139, 255, 0.2)",
          fill: true,
          pointRadius: 1.8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: theme.text } } },
      scales: {
        x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
        y: { ticks: { color: theme.text }, grid: { color: theme.grid }, beginAtZero: true }
      }
    }
  });

  foodChart = new ChartCtor(foodChartCanvas, {
    type: "bar",
    data: {
      labels: foodSeries.labels,
      datasets: [
        { label: "Low", data: foodSeries.low, backgroundColor: theme.green },
        { label: "Medium", data: foodSeries.medium, backgroundColor: theme.yellow },
        { label: "High", data: foodSeries.high, backgroundColor: theme.red }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: theme.text } } },
      scales: {
        x: { ticks: { color: theme.text }, grid: { color: theme.grid }, stacked: true },
        y: { ticks: { color: theme.text }, grid: { color: theme.grid }, stacked: true, beginAtZero: true }
      }
    }
  });

  weightChart = new ChartCtor(weightChartCanvas, {
    type: "line",
    data: {
      labels: weightSeries.labels,
      datasets: [
        {
          label: "Weight (kg)",
          data: weightSeries.values,
          borderColor: theme.blue,
          backgroundColor: "rgba(127, 139, 255, 0.15)",
          tension: 0.3,
          fill: true,
          pointRadius: 2
        },
        {
          label: "Goal",
          data: weightSeries.goal,
          borderColor: "#9ce56a",
          borderDash: [6, 5],
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: theme.text } } },
      scales: {
        x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
        y: { ticks: { color: theme.text }, grid: { color: theme.grid } }
      }
    }
  });
}

function renderSummary(profile, workoutLogs, foodLogs, weightLogs) {
  const consistency = calcConsistency(workoutLogs, 30);
  const mealMix = calcMealMix(foodLogs);
  const eta = estimateEta(profile, weightLogs);
  const slope = trendSlope(weightLogs.slice(0, 30));

  metricConsistency.textContent = `${consistency}%`;
  metricMealMix.textContent = `${mealMix.low}/${mealMix.medium}/${mealMix.high}`;
  metricGoalEta.textContent = `ETA: ${eta}`;

  trendNote.textContent =
    slope === 0
      ? "Weight trend is flat in the current sample window."
      : `Weight trend: ${slope.toFixed(3)} kg/day over latest logs.`;

  chartGoalWeight.value = profile?.goalWeightKg || "";
  chartTargetDate.value = profile?.targetDate || profile?.goalDate || "";

  const rows = [
    ["Height", profile?.heightCm ? `${profile.heightCm} cm` : "Not set"],
    ["Starting Weight", profile?.startingWeightKg ? `${profile.startingWeightKg} kg` : "Not set"],
    ["Starting Date", profile?.startingDate || "Not set"],
    ["Goal Weight", profile?.goalWeightKg ? `${profile.goalWeightKg} kg` : "Not set"],
    ["Target Date", profile?.targetDate || profile?.goalDate || "Not set"],
    ["Workout Logs", String(workoutLogs.length)],
    ["Food Logs", String(foodLogs.length)],
    ["Weight Logs", String(weightLogs.length)]
  ];

  summaryBody.innerHTML = rows
    .map(([name, value]) => `<tr><td>${name}</td><td>${value}</td></tr>`)
    .join("");
}

async function loadCharts(user) {
  const [profile, workoutLogs, foodLogs, weightLogs] = await Promise.all([
    getProfile(user.uid),
    getRecentWorkoutLogs(user.uid, 180),
    getRecentFoodLogs(user.uid, 260),
    getWeightLogs(user.uid, 260)
  ]);

  renderCharts(profile, workoutLogs, foodLogs, weightLogs);
  renderSummary(profile, workoutLogs, foodLogs, weightLogs);
  return { profile };
}

protectPage((user) => {
  if (initialized) return;
  initialized = true;
  wireGlobalActions();
  renderFlowNotice();

  const refresh = async () => {
    try {
      await loadCharts(user);
    } catch (error) {
      setStatus(formatFirebaseError(error), "alert");
    }
  };

  refresh();

  chartGoalForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const goalWeightKg = numberOrNull(chartGoalWeight.value);
    const targetDate = String(chartTargetDate.value || "");

    if (!goalWeightKg) {
      setStatus("Goal weight is required.", "alert");
      return;
    }

    try {
      setStatus("Saving goal...", "info");
      await saveProfile(user.uid, { goalWeightKg, targetDate });
      setStatus("Goal updated.", "success");
      await refresh();
    } catch (error) {
      setStatus(formatFirebaseError(error), "alert");
    }
  });

  const timer = window.setInterval(refresh, 15000);
  window.addEventListener("beforeunload", () => window.clearInterval(timer), { once: true });
});
