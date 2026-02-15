import {
  loginWithGoogle,
  loginWithGoogleRedirect,
  resolveGoogleRedirect
} from "./firebase.js";
import { initLoginGate } from "./auth-guard.js";

const status = document.getElementById("status");
const googleBtn = document.getElementById("googleSignInBtn");

const params = new URLSearchParams(window.location.search);
const next = params.get("next") || "index.html";

function setStatus(message = "", type = "") {
  if (!status) return;
  status.textContent = message;
  status.className = type;
}

function setButtonPending(isPending) {
  if (!googleBtn) return;
  googleBtn.disabled = isPending;
  googleBtn.textContent = isPending ? "Signing in..." : "Continue with Google";
}

function readableAuthError(error) {
  const code = String(error?.code || "");

  if (code === "auth/popup-blocked") {
    return "Popup blocked. Retrying with redirect...";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Sign-in popup was closed before completing login.";
  }
  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized in Firebase Auth. Add rasbasnet.github.io in Firebase > Auth > Settings > Authorized domains.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Google provider is not enabled in Firebase Authentication.";
  }

  return String(error?.message || "Unable to sign in with Google.");
}

async function beginGoogleLogin() {
  setStatus("");
  setButtonPending(true);

  try {
    await loginWithGoogle();
    window.location.href = `./${next}`;
  } catch (error) {
    if (String(error?.code || "") === "auth/popup-blocked") {
      setStatus("Popup blocked. Redirecting to Google sign-in...", "alert");
      await loginWithGoogleRedirect();
      return;
    }

    setStatus(readableAuthError(error), "alert");
    setButtonPending(false);
  }
}

if (googleBtn) {
  googleBtn.addEventListener("click", () => {
    beginGoogleLogin();
  });
} else {
  setStatus("Login button not found on page.", "alert");
}

resolveGoogleRedirect()
  .then(() => {
    setButtonPending(false);
  })
  .catch((error) => {
    setStatus(readableAuthError(error), "alert");
    setButtonPending(false);
  });

initLoginGate(() => {
  window.location.href = `./${next}`;
});
