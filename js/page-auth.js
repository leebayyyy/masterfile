import { requirePageRole, addLogout, getSession } from "./auth.js?v=6";

const page = window.location.pathname.split("/").pop();
const permissions = {
  "index.html": ["Admin", "Cashier", "Accounts Receivable Staff", "Manager"],
  "role.html": ["Admin"],
  "user.html": ["Admin"],
  "product_category.html": ["Admin"],
  "product.html": ["Admin", "Cashier", "Manager"],
  "pos_terminal.html": ["Admin", "Cashier", "Manager"],
  "ar_customer_type.html": ["Admin", "Accounts Receivable Staff", "Manager"],
  "ar_customer.html": ["Admin", "Accounts Receivable Staff", "Manager"],
  "payment.html": ["Admin", "Cashier", "Accounts Receivable Staff", "Manager"],
  "sales.html": ["Admin", "Cashier", "Manager"],
  "reports.html": ["Admin", "Accounts Receivable Staff", "Manager"],
  "settings.html": ["Admin"],
  "ar_transactions.html": ["Admin", "Accounts Receivable Staff", "Manager"],
  "suki_card.html": ["Admin", "Manager"],
  "terminal_select.html": ["Cashier"],
};

const navigationItems = [
  ["index.html", "Dashboard"],
  ["role.html", "Roles"],
  ["user.html", "Users"],
  ["product_category.html", "Product Categories"],
  ["product.html", "Products"],
  ["pos_terminal.html", "POS Terminals"],
  ["ar_customer_type.html", "Customer Types"],
  ["ar_customer.html", "AR Customers"],
  ["payment.html", "Payments"],
  ["sales.html", "Sales"],
  ["reports.html", "Reports"],
  ["settings.html", "Settings"],
  ["ar_transactions.html", "AR Transactions"],
  ["suki_card.html", "Suki Cards"],
];

const user = await requirePageRole(permissions[page] || []);
if (user) {
  const session = await getSession();
  if (user.role_name === "Cashier" &&
      (page !== "terminal_select.html" && !session.selectedTerminalId)) {
    window.location.href = "terminal_select.html";
  } else if (user.role_name === "Cashier" &&
      page === "terminal_select.html" && session.selectedTerminalId) {
    window.location.href = "index.html";
  }
  renderNavigation(user);
}

function renderNavigation(currentUser) {
  const nav = document.querySelector(".navbar");
  if (!nav) return;
  nav.className = "navbar navbar-dark bg-dark sticky-top app-navbar";
  nav.replaceChildren();

  if (!document.getElementById("app-navbar-styles")) {
    const style = document.createElement("style");
    style.id = "app-navbar-styles";
    style.textContent = `
      .app-navbar { position: fixed; inset: 0 0 auto; width: 100%; z-index: 1030; }
      body { padding-top: var(--dashboard-navbar-height, 4rem); }
      .app-navbar > .container-fluid { align-items: center; flex-wrap: wrap; gap: .25rem .75rem; }
      .app-navbar .navbar-brand { flex: 0 0 100%; margin-right: 0; }
      .app-navbar .app-navbar-collapse { flex: 0 0 100%; min-width: 0; overflow: visible; width: 100%; }
      .app-navbar .app-navbar-links { display: flex; flex: 1 1 auto; flex-direction: column; gap: 0; margin: 0; min-width: 0; width: 100%; }
      .app-navbar .app-navbar-row { align-items: center; column-gap: .25rem; display: flex; flex-direction: row; flex-wrap: nowrap; justify-content: flex-start; margin: 0; min-width: 0; row-gap: 0; width: 100%; }
      .app-navbar .app-navbar-row > .nav-item { align-items: center; display: flex; justify-content: flex-start; margin: 0 !important; min-width: 0; }
      .app-navbar .app-navbar-row > .nav-item .nav-link { line-height: 1.25; padding: .25rem .3rem; white-space: nowrap; }
      .app-navbar .navbar-brand, .app-navbar .navbar-text, .app-navbar .btn { align-items: center; }
      .app-navbar .navbar-nav .nav-link { padding-block: .5rem; }
      .app-navbar .app-navbar-toggle { display: none; }
      .app-navbar .app-navbar-user .nav-item { align-items: center; display: flex; flex-wrap: nowrap; gap: .25rem; justify-content: flex-start; padding: 0; }
      @media (max-width: 991.98px) {
        .app-navbar > .container-fluid { flex-wrap: wrap; }
        .app-navbar .navbar-brand { flex: 0 1 auto; }
        .app-navbar .app-navbar-toggle { display: inline-flex; margin-left: auto; }
        .app-navbar .app-navbar-collapse { display: none; flex: 0 0 100%; width: 100%; }
        .app-navbar .app-navbar-collapse.show { display: block; }
        .app-navbar .app-navbar-links { max-height: calc(100vh - 8rem); max-height: calc(100dvh - 8rem); overflow-x: hidden; overflow-y: auto; }
        .app-navbar .app-navbar-row { flex-wrap: wrap; }
        .app-navbar .app-navbar-row > .nav-item { justify-content: flex-start; white-space: normal; }
        .app-navbar .app-navbar-row > .nav-item .nav-link { text-align: left; white-space: normal; }
        .app-navbar .app-navbar-user .nav-item { justify-content: flex-start; text-align: left; }
      }
    `;
    document.head.appendChild(style);
  }

  const container = document.createElement("div");
  container.className = "container-fluid app-navbar-container";
  const brand = document.createElement("a");
  brand.className = "navbar-brand";
  brand.href = "index.html";
  brand.textContent = "POS & AR Master Files";
  container.appendChild(brand);

  const toggle = document.createElement("button");
  toggle.className = "btn btn-outline-light app-navbar-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "app-navbar-collapse");
  toggle.setAttribute("aria-label", "Toggle navigation");
  toggle.textContent = "Menu";
  container.appendChild(toggle);

  const collapse = document.createElement("div");
  collapse.className = "app-navbar-collapse";
  collapse.id = "app-navbar-collapse";
  const links = document.createElement("div");
  links.className = "app-navbar-links";
  const availableItems = navigationItems.filter(([href]) => permissions[href]?.includes(currentUser.role_name));
  for (let index = 0; index < availableItems.length; index += 7) {
    const row = document.createElement("ul");
    row.className = "navbar-nav app-navbar-row";
    if (index + 7 >= availableItems.length) row.classList.add("app-navbar-user");
    for (const [href, label] of availableItems.slice(index, index + 7)) {
      const item = document.createElement("li");
      item.className = "nav-item";
      const link = document.createElement("a");
      link.className = `nav-link${page === href ? " active" : ""}`;
      link.href = href;
      if (page === href) link.setAttribute("aria-current", "page");
      link.textContent = label;
      item.appendChild(link);
      row.appendChild(item);
    }
    links.appendChild(row);
  }
  collapse.appendChild(links);
  container.appendChild(collapse);
  nav.appendChild(container);
  const updateNavbarHeight = () => {
    document.documentElement.style.setProperty(
      "--dashboard-navbar-height",
      `${Math.ceil(nav.getBoundingClientRect().height)}px`
    );
  };
  new ResizeObserver(updateNavbarHeight).observe(nav);
  updateNavbarHeight();
  toggle.addEventListener("click", () => {
    const expanded = collapse.classList.toggle("show");
    toggle.setAttribute("aria-expanded", String(expanded));
    updateNavbarHeight();
  });

  hideUnauthorizedDashboardCards(currentUser.role_name);
  addLogout(currentUser);
}

function hideUnauthorizedDashboardCards(roleName) {
  document.querySelectorAll("a[href]").forEach((link) => {
    if (link.closest(".navbar")) return;
    const target = link.getAttribute("href").split("#")[0].split("?")[0];
    const targetPage = target.substring(target.lastIndexOf("/") + 1);
    const allowedRoles = permissions[targetPage];
    if (!allowedRoles || allowedRoles.includes(roleName)) return;
    const card = link.closest(".col-md-3");
    if (card) card.remove();
  });
}
