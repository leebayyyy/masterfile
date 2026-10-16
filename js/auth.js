const authApiUrl = "/api/auth.php";
const defaultBaseApiUrl = "/api";

if (!sessionStorage.getItem("baseAPIUrl") || sessionStorage.getItem("baseAPIUrl").includes("localhost") || sessionStorage.getItem("baseAPIUrl").startsWith("http")) {
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

import "./swal-helper.js";

export const renderAccessDenied = (user) => {
  document.title = "403 - Access Denied";
  document.body.className = "bg-light";
  const targetDashboard = user?.role_name === "Cashier" ? "sales.html" : "index.html";
  document.body.innerHTML = `
    <div class="container d-flex flex-column align-items-center justify-content-center min-vh-100 py-5">
      <div class="card shadow-lg border-0 text-center p-4 p-md-5" style="max-width: 520px; border-radius: 16px;">
        <div class="mb-3">
          <div class="d-inline-flex p-3 rounded-circle bg-danger-subtle text-danger mb-2">
            <svg width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 1a2 2 0 0 1 2 2v2H6V3a2 2 0 0 1 2-2zm3 4V3a3 3 0 0 0-6 0v2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/>
            </svg>
          </div>
          <h1 class="h3 fw-bold text-dark mb-1">Access Denied</h1>
          <span class="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-1">HTTP 403 Forbidden</span>
        </div>
        <p class="text-secondary mb-4">
          Your account role (<strong>${user?.role_name || "User"}</strong>) is not authorized to access this page. Your session is active and preserved.
        </p>
        <div class="d-grid gap-2">
          <a href="${targetDashboard}" class="btn btn-primary btn-lg fw-semibold shadow-sm" id="btn-back-dashboard">
            &larr; Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  `;
};

export const requirePageRole = async (allowedRoles = []) => {
  try {
    const session = await getSession();
    if (!session.authenticated) {
      window.location.replace("login.html");
      return null;
    }

    if (allowedRoles.length && !allowedRoles.includes(session.user?.role_name)) {
      renderAccessDenied(session.user);
      return null;
    }

    // Browser back/forward cache guard: re-verify session if restored from cache or back button
    window.addEventListener("pageshow", async (event) => {
      const freshSession = await getSession();
      if (!freshSession.authenticated) {
        window.location.replace("login.html");
      } else if (allowedRoles.length && !allowedRoles.includes(freshSession.user?.role_name)) {
        renderAccessDenied(freshSession.user);
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

export const confirmLogout = async () => {
  if (typeof Swal !== "undefined") {
    const res = await Swal.fire({
      title: "Log out of POS & AR?",
      text: "Are you sure you want to end your current session?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, Logout",
      cancelButtonText: "Stay Logged In"
    });
    if (!res.isConfirmed) return;
  }
  await logoutUser();
};

export const addLogout = (user) => {
  document.querySelectorAll('[data-action="logout"], #btn-logout, #btn-topbar-logout, .app-sidebar-logout-btn').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await confirmLogout();
    });
  });
};
