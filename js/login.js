const authUrl = new URL("../api/auth.php", import.meta.url).href;

const passwordInput = document.getElementById("password");
const usernameInput = document.getElementById("username");
const togglePasswordButton = document.getElementById("toggle-password");
const loginForm = document.getElementById("login-form");
const submitBtn = document.getElementById("login-submit-btn");
const submitText = document.getElementById("login-submit-text");
const spinner = document.getElementById("login-spinner");
const errorAlert = document.getElementById("login-error");
const errorText = document.getElementById("login-error-text");

// Password visibility toggle
togglePasswordButton?.addEventListener("click", () => {
  const isVisible = passwordInput.type === "password";
  passwordInput.type = isVisible ? "text" : "password";
  togglePasswordButton.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
  togglePasswordButton.setAttribute("aria-pressed", String(isVisible));
  document.getElementById("password-visible-icon").hidden = !isVisible;
  document.getElementById("password-hidden-icon").hidden = isVisible;
  passwordInput.focus();
});

// Form submission with loading and error states
loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput?.value.trim();
  const password = passwordInput?.value;

  if (!username || !password) {
    showError("Please enter both username and password.");
    if (!username) usernameInput?.focus();
    else passwordInput?.focus();
    return;
  }

  // Set loading state
  setLoading(true);
  hideError();

  const formData = new FormData();
  formData.append("operation", "login");
  formData.append(
    "json",
    JSON.stringify({
      username,
      password,
    })
  );

  try {
    const response = await axios.post(authUrl, formData, { withCredentials: true });
    if (response.data.returnValue === 1) {
      const role = response.data.user?.role_name;
      // Cashiers enter via terminal selection; all other authorized staff proceed to dashboard
      window.location.href = role === "Cashier" ? "terminal_select.html" : "index.html";
    } else {
      showError(response.data.message || "Invalid credentials.");
      setLoading(false);
    }
  } catch (error) {
    console.error("Login request failed:", error);
    showError(error.response?.data?.message || "Invalid username or password. Please try again.");
    setLoading(false);
  }
});

function setLoading(isLoading) {
  if (submitBtn) submitBtn.disabled = isLoading;
  if (usernameInput) usernameInput.disabled = isLoading;
  if (passwordInput) passwordInput.disabled = isLoading;
  if (spinner) spinner.classList.toggle("d-none", !isLoading);
  if (submitText) submitText.textContent = isLoading ? "Authenticating..." : "Sign In to Workspace";
}

function showError(msg) {
  if (errorText) errorText.textContent = msg;
  if (errorAlert) errorAlert.classList.remove("d-none");
  if (passwordInput) {
    passwordInput.select();
  }
}

function hideError() {
  if (errorAlert) errorAlert.classList.add("d-none");
}
