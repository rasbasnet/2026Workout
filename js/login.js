import { loginUser, registerUser } from "./firebase.js";
import { initLoginGate } from "./auth-guard.js";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const status = document.getElementById("status");
const showLoginBtn = document.getElementById("showLogin");
const showRegisterBtn = document.getElementById("showRegister");

const params = new URLSearchParams(window.location.search);
const next = params.get("next") || "index.html";

function setStatus(message = "", type = "") {
  status.textContent = message;
  status.className = type;
}

function setMode(mode) {
  const loginVisible = mode === "login";
  loginForm.classList.toggle("hidden", !loginVisible);
  registerForm.classList.toggle("hidden", loginVisible);
  showLoginBtn.classList.toggle("primary", loginVisible);
  showRegisterBtn.classList.toggle("primary", !loginVisible);
  showLoginBtn.classList.toggle("secondary", !loginVisible);
  showRegisterBtn.classList.toggle("secondary", loginVisible);
  setStatus("");
}

showLoginBtn.addEventListener("click", () => setMode("login"));
showRegisterBtn.addEventListener("click", () => setMode("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    await loginUser(email, password);
    window.location.href = `./${next}`;
  } catch (error) {
    setStatus(error.message || "Unable to sign in.", "alert");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password !== confirmPassword) {
    setStatus("Passwords do not match.", "alert");
    return;
  }

  if (password.length < 6) {
    setStatus("Password must be at least 6 characters.", "alert");
    return;
  }

  try {
    await registerUser(email, password);
    window.location.href = `./${next}`;
  } catch (error) {
    setStatus(error.message || "Unable to create account.", "alert");
  }
});

initLoginGate(() => {
  window.location.href = `./${next}`;
});

setMode("login");
