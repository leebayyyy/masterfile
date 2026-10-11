const navigationBreakpoint = window.matchMedia("(min-width: 1200px)");

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("../css/navigation.css?v=1", import.meta.url).href;
document.head.append(stylesheet);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("nav.navbar").forEach(setupResponsiveNavigation);
});

const setupResponsiveNavigation = (navbar) => {
  const container = navbar.querySelector(".container-fluid");
  const navList = navbar.querySelector(".navbar-nav");
  if (!container || !navList) return;

  navbar.classList.add("app-navbar");
  let collapse = navList.closest(".app-nav-collapse");
  if (!collapse) {
    collapse = document.createElement("div");
    collapse.className = "app-nav-collapse";
    collapse.id = `app-nav-collapse-${Math.random().toString(36).slice(2)}`;
    navList.before(collapse);
    collapse.append(navList);
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "app-nav-toggle";
  toggle.setAttribute("aria-label", "Open navigation");
  toggle.setAttribute("aria-controls", collapse.id);
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16"></path>
    </svg>`;
  container.insertBefore(toggle, collapse);

  const updateHeight = () => {
    document.documentElement.style.setProperty(
      "--app-nav-height",
      `${Math.ceil(navbar.getBoundingClientRect().height)}px`
    );
  };

  const updateBreakpoint = () => {
    const expanded = navigationBreakpoint.matches;
    if (expanded) {
      collapse.hidden = false;
      collapse.dataset.open = "true";
    } else {
      collapse.hidden = toggle.getAttribute("aria-expanded") !== "true";
      collapse.dataset.open = toggle.getAttribute("aria-expanded") === "true" ? "true" : "false";
    }
    toggle.hidden = expanded;
    updateHeight();
  };

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    collapse.dataset.open = String(open);
    collapse.hidden = !open;
    updateHeight();
  });

  collapse.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    if (navigationBreakpoint.matches) return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    collapse.dataset.open = "false";
    collapse.hidden = true;
    updateHeight();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    collapse.dataset.open = "false";
    collapse.hidden = true;
    toggle.focus();
    updateHeight();
  });

  navigationBreakpoint.addEventListener("change", updateBreakpoint);
  window.addEventListener("resize", updateHeight);
  new ResizeObserver(updateHeight).observe(navbar);
  updateBreakpoint();
};
