import { protectPage } from "./auth-guard.js";
import { wireGlobalActions, setStatus } from "./layout.js";
import {
  getProfile,
  saveProfile,
  saveDailyWeight,
  getWeightLogs,
  formatFirebaseError
} from "./firebase.js";
import { numberOrNull, toDateInputValue, formatDate, escapeHtml, buildChartUrl } from "./utils.js";

const profileForm = document.getElementById("profileForm");
const weightForm = document.getElementById("weightForm");
const weightDate = document.getElementById("weightDate");
const weightHistory = document.getElementById("weightHistory");
const startLockHint = document.getElementById("startLockHint");

weightDate.value = toDateInputValue();

let initialized = false;
let cachedProfile = null;
let startLocked = false;

function setStartLockUI(locked) {
  startLocked = locked;

  const startWeightInput = profileForm.elements.startingWeightKg;
  const startDateInput = profileForm.elements.startingDate;

  startWeightInput.readOnly = locked;
  startDateInput.readOnly = locked;

  startWeightInput.classList.toggle("locked", locked);
  startDateInput.classList.toggle("locked", locked);

  if (locked) {
    startLockHint.classList.remove("hidden");
    startLockHint.textContent = "Starting weight and starting date are locked and cannot be changed.";
  } else {
    startLockHint.classList.add("hidden");
  }
}

function fillProfile(profile) {
  if (!profile) {
    profileForm.reset();
    profileForm.elements.startingDate.value = toDateInputValue();
    setStartLockUI(false);
    return;
  }

  profileForm.heightCm.value = profile.heightCm || "";
  profileForm.startingWeightKg.value = profile.startingWeightKg || profile.currentWeightKg || "";
  profileForm.startingDate.value = profile.startingDate || toDateInputValue();
  profileForm.goalWeightKg.value = profile.goalWeightKg || "";
  profileForm.targetDate.value = profile.targetDate || profile.goalDate || "";

  setStartLockUI(Boolean(profile.startingWeightKg && profile.startingDate));
}

function renderWeightHistory(items) {
  if (!items.length) {
    weightHistory.innerHTML = '<li class="list-item">No weight logs yet.</li>';
    return;
  }

  weightHistory.innerHTML = items
    .slice(0, 10)
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

async function loadProfileAndWeights(user) {
  const [profile, weights] = await Promise.all([
    getProfile(user.uid),
    getWeightLogs(user.uid, 120)
  ]);

  cachedProfile = profile || null;
  fillProfile(cachedProfile);
  renderWeightHistory(weights);
}

protectPage((user) => {
  if (initialized) return;
  initialized = true;
  wireGlobalActions();

  loadProfileAndWeights(user).catch((error) => {
    setStatus(formatFirebaseError(error), "alert");
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(profileForm);

    const payload = {
      heightCm: numberOrNull(formData.get("heightCm")),
      goalWeightKg: numberOrNull(formData.get("goalWeightKg")),
      targetDate: String(formData.get("targetDate") || "")
    };

    if (!payload.heightCm || !payload.goalWeightKg) {
      setStatus("Height and goal weight are required.", "alert");
      return;
    }

    const startWeightInput = numberOrNull(formData.get("startingWeightKg"));
    const startDateInput = String(formData.get("startingDate") || "");

    if (startLocked && cachedProfile?.startingWeightKg && cachedProfile?.startingDate) {
      payload.startingWeightKg = cachedProfile.startingWeightKg;
      payload.startingDate = cachedProfile.startingDate;
    } else {
      if (!startWeightInput || !startDateInput) {
        setStatus("Starting weight and starting date are required.", "alert");
        return;
      }

      const accepted = window.confirm(
        "Starting weight and starting date can only be saved once. Continue?"
      );
      if (!accepted) return;

      payload.startingWeightKg = startWeightInput;
      payload.startingDate = startDateInput;
      payload.currentWeightKg = startWeightInput;
    }

    try {
      setStatus("Saving profile...", "info");
      await saveProfile(user.uid, payload);
      setStatus("Profile saved.", "success");
      await loadProfileAndWeights(user);
    } catch (error) {
      setStatus(formatFirebaseError(error), "alert");
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
      setStatus("Date and valid weight are required.", "alert");
      return;
    }

    try {
      setStatus("Saving weight...", "info");
      await saveDailyWeight(user.uid, date, { date, weightKg, note });
      await saveProfile(user.uid, { currentWeightKg: weightKg });
      setStatus("Weight saved.", "success");

      weightForm.reset();
      weightDate.value = toDateInputValue();
      await loadProfileAndWeights(user);

      if (wantsChart) {
        window.location.href = buildChartUrl("weight");
      }
    } catch (error) {
      setStatus(formatFirebaseError(error), "alert");
    }
  });
});
