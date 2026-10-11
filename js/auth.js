const authApiUrl = new URL("../api/auth.php", import.meta.url).href;

export const getSession = async () => {
  const response = await axios.get(authApiUrl, {
    params: { operation: "session" },
    withCredentials: true,
  });
  return response.data;
};

export const requirePageRole = async (allowedRoles = []) => {
  try {
    const session = await getSession();
    if (!session.authenticated || (allowedRoles.length && !allowedRoles.includes(session.user.role_name))) {
      window.location.href = "login.html";
      return null;
    }
    return session.user;
  } catch (error) {
    console.error(error);
    window.location.href = "login.html";
    return null;
  }
};

export const addLogout = (user) => {
  const nav = document.querySelector(".app-navbar-links .app-navbar-row:last-child") || document.querySelector(".navbar-nav");
  if (!nav || !user) return;
  const item = document.createElement("li");
  item.className = "nav-item d-flex align-items-center";
  const identity = document.createElement("span");
  identity.className = "navbar-text me-2";
  identity.textContent = `${user.first_name} (${user.role_name})`;
  const button = document.createElement("button");
  button.className = "btn btn-outline-light btn-sm";
  button.id = "btn-logout";
  button.type = "button";
  button.textContent = "Logout";
  item.append(identity, button);
  nav.appendChild(item);
  button.addEventListener("click", async () => {
    try {
      await axios.post(authApiUrl, new URLSearchParams({ operation: "logout" }), { withCredentials: true });
      window.location.href = "login.html";
    } catch (error) {
      console.error(error);
      window.alert(error.response?.data?.message || "Unable to log out. Please try again.");
    }
  });
};
