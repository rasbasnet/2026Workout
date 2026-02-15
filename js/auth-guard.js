import { watchAuth, isFirebaseConfigured } from "./firebase.js";
import { fillUserChip, requireFirebaseOrShowError, initPageLoader } from "./layout.js";

export function protectPage(onAuthenticated) {
  initPageLoader();
  if (!requireFirebaseOrShowError()) return;

  watchAuth((user) => {
    if (!user) {
      const next = encodeURIComponent(window.location.pathname.split("/").pop() || "index.html");
      window.location.href = `./login.html?next=${next}`;
      return;
    }

    fillUserChip(user.email || "Logged in");
    onAuthenticated(user);
  });
}

export function initLoginGate(onAuthenticated) {
  initPageLoader();
  if (!isFirebaseConfigured) {
    const status = document.getElementById("status");
    if (status) {
      status.className = "alert";
      status.textContent =
        "Firebase is not configured. Set your keys in /js/firebase.js before signing in.";
    }
    return;
  }

  watchAuth((user) => {
    if (user) {
      onAuthenticated(user);
    }
  });
}
