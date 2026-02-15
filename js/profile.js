import { protectPage } from "./auth-guard.js";
import { wireGlobalActions, setStatus } from "./layout.js";
import { getProfile, saveProfile, formatFirebaseError } from "./firebase.js";
import { numberOrNull } from "./utils.js";

const profileForm = document.getElementById("profileForm");

async function loadProfile(user) {
  const profile = await getProfile(user.uid);
  if (!profile) return;

  profileForm.heightCm.value = profile.heightCm || "";
  profileForm.currentWeightKg.value = profile.currentWeightKg || "";
  profileForm.goalWeightKg.value = profile.goalWeightKg || "";
  profileForm.goalDate.value = profile.goalDate || "";
}

let initialized = false;

protectPage((user) => {
  if (initialized) return;
  initialized = true;
  wireGlobalActions();

  loadProfile(user).catch((error) => {
    setStatus(formatFirebaseError(error), "alert");
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(profileForm);

    const payload = {
      heightCm: numberOrNull(formData.get("heightCm")),
      currentWeightKg: numberOrNull(formData.get("currentWeightKg")),
      goalWeightKg: numberOrNull(formData.get("goalWeightKg")),
      goalDate: String(formData.get("goalDate") || "")
    };

    if (!payload.heightCm || !payload.currentWeightKg || !payload.goalWeightKg) {
      setStatus("Height, current weight, and goal weight are required.", "alert");
      return;
    }

    try {
      setStatus("Saving profile...", "info");
      await saveProfile(user.uid, payload);
      setStatus("Profile saved.", "success");
    } catch (error) {
      setStatus(formatFirebaseError(error), "alert");
    }
  });
});
