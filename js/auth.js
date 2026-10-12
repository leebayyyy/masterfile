const authApiUrl = new URL("../api/auth.php", import.meta.url).href;
const defaultBaseApiUrl = new URL("../api", import.meta.url).href;

if (!sessionStorage.getItem("baseAPIUrl")) {
  sessionStorage.setItem("baseAPIUrl", defaultBaseApiUrl);
}

export const getSession = async () => {
  try {
    const response = await axios.get(authApiUrl, {
      params: { operation: "session" },
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    return { authenticated: false, user: null };
  }
};

export const requirePageRole = async (allowedRoles = []) => {
  try {
    const session = await getSession();
    if (!session.authenticated || (allowedRoles.length && !allowedRoles.includes(session.user?.role_name))) {
      window.location.replace("login.html");
      return null;
    }

    // Browser back/forward cache guard: re-verify session if restored from cache
    window.addEventListener("pageshow", async (event) => {
      if (event.persisted) {
        const freshSession = await getSession();
        if (!freshSession.authenticated || (allowedRoles.length && !freshSession.user?.role_name)) {
          window.location.replace("login.html");
        }
      }
    });

    return session.user;
  } catch (error) {
    console.error("Authentication check error:", error);
    window.location.replace("login.html");
    return null;
  }
};

export const logoutUser = async () => {
  try {
    await axios.post(
      authApiUrl,
      new URLSearchParams({ operation: "logout" }),
      { withCredentials: true }
    );
  } catch (error) {
    console.error("Logout request failed:", error);
  } finally {
    const baseApi = sessionStorage.getItem("baseAPIUrl") || defaultBaseApiUrl;
    sessionStorage.clear();
    sessionStorage.setItem("baseAPIUrl", baseApi);
    window.location.replace("login.html");
  }
};

export const addLogout = (user) => {
  document.querySelectorAll('[data-action="logout"], #btn-logout, #btn-topbar-logout, .app-sidebar-logout-btn').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await logoutUser();
    });
  });
};
