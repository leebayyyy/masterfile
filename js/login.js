const authUrl = new URL("../api/auth.php", import.meta.url).href;

const passwordInput = document.getElementById("password");
const togglePasswordButton = document.getElementById("toggle-password");
togglePasswordButton.addEventListener("click", () => {
  const isVisible = passwordInput.type === "password";
  passwordInput.type = isVisible ? "text" : "password";
  togglePasswordButton.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
  togglePasswordButton.setAttribute("aria-pressed", String(isVisible));
  document.getElementById("password-visible-icon").hidden = !isVisible;
  document.getElementById("password-hidden-icon").hidden = isVisible;
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData();
  formData.append("operation", "login");
  formData.append("json", JSON.stringify({
    username: document.getElementById("username").value,
    password: document.getElementById("password").value,
  }));
  try {
    const response = await axios.post(authUrl, formData, { withCredentials: true });
    if (response.data.returnValue === 1) {
      window.location.href = response.data.user?.role_name === "Cashier"
        ? "terminal_select.html"
        : "index.html";
    }
  } catch (error) {
    document.getElementById("login-error").textContent = error.response?.data?.message || "Login failed.";
  }
});
