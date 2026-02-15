import { isFirebaseConfigured, logoutUser } from "./firebase.js";

export function showConfigError(targetId = "status") {
  const node = document.getElementById(targetId);
  if (!node) return;
  node.className = "alert";
  node.textContent =
    "Firebase is not configured. Update /js/firebase.js with your project keys, then refresh.";
}

export function setStatus(message = "", type = "") {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = message;
  status.className = type ? type : "";
}

export function requireFirebaseOrShowError() {
  if (!isFirebaseConfigured) {
    showConfigError();
    return false;
  }
  return true;
}

export function wireGlobalActions() {
  const signOutBtn = document.getElementById("signOutBtn");
  if (!signOutBtn) return;

  signOutBtn.addEventListener("click", async () => {
    try {
      await logoutUser();
      window.location.href = "./login.html";
    } catch (error) {
      setStatus(error.message || "Could not sign out.", "alert");
    }
  });
}

export function fillUserChip(email) {
  const chip = document.getElementById("userChip");
  if (chip) chip.textContent = email;
}
