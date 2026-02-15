import { loginWithGoogle } from "./firebase.js";
import { initLoginGate } from "./auth-guard.js";

const status = document.getElementById("status");
const googleBtn = document.getElementById("googleSignInBtn");

const params = new URLSearchParams(window.location.search);
const next = params.get("next") || "index.html";

function setStatus(message = "", type = "") {
  status.textContent = message;
  status.className = type;
}

googleBtn.addEventListener("click", async () => {
  setStatus("");

  try {
    await loginWithGoogle();
    window.location.href = `./${next}`;
  } catch (error) {
    const message = String(error?.message || "Unable to sign in with Google.");
    if (message.includes("popup") || message.includes("blocked")) {
      setStatus("Google login popup was blocked. Allow popups and try again.", "alert");
      return;
    }
    setStatus(message, "alert");
  }
});

initLoginGate(() => {
  window.location.href = `./${next}`;
});
