const settingsUrl = new URL("../api/settings.php", import.meta.url).href;
let settingsData;

document.addEventListener("DOMContentLoaded", () => {
  const get = (id) => document.getElementById(id).value;
  document.getElementById("promotion-form").addEventListener("submit", (event) => {
    event.preventDefault();
    runAction(() => save("insertPromotion", {
      promoName: get("promo_name"),
      description: get("promo_description"),
      startDate: get("start_date"),
      endDate: get("end_date"),
      discountRate: get("discount_rate"),
    }, event.target));
  });
  document.getElementById("method-form").addEventListener("submit", (event) => {
    event.preventDefault();
    runAction(() => save("insertPaymentMethod", {
      methodName: get("method_name"),
      description: get("method_description"),
    }, event.target));
  });
  document.getElementById("assignment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    runAction(async () => {
      await post("assignPromotion", {
        productId: get("assignment_product"),
        promoId: get("assignment_promo"),
      });
      event.target.reset();
      await load();
    });
  });
  runAction(load);
});

const runAction = async (action) => {
  const errorDiv = document.getElementById("settings-error");
  errorDiv.classList.add("d-none");
  errorDiv.textContent = "";
  try {
    await action();
  } catch (error) {
    console.error(error);
    errorDiv.textContent = error.response?.data?.message || "Unable to update system settings.";
    errorDiv.classList.remove("d-none");
  }
};

const load = async () => {
  const response = await axios.get(settingsUrl, {
    params: { operation: "getSettings" },
    withCredentials: true,
  });
  settingsData = response.data;
  render();
};

const save = async (operation, data, form) => {
  await post(operation, data);
  await load();
  form.reset();
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

const toggle = async (type, id, active) => {
  await post("setActive", { type, id, active: active ? 0 : 1 });
  await load();
};

const post = async (operation, data) => {
  const formData = new FormData();
  formData.append("operation", operation);
  formData.append("json", JSON.stringify(data));
  await axios.post(settingsUrl, formData, { withCredentials: true });
};

const render = () => {
  document.getElementById("promotions").innerHTML = `
    <h6>Promotions</h6>
    <ul class="list-group">${settingsData.promotions.map((promotion) => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${promotion.promo_name} (${promotion.discount_rate ?? 0}%)
          <small class="d-block text-muted">${promotion.start_date || "Any start"} – ${promotion.end_date || "No end"}${promotion.description ? ` · ${promotion.description}` : ""}</small>
        </span>
        <button class="btn btn-sm ${promotion.is_active == 1 ? "btn-outline-danger" : "btn-outline-success"}"
          data-promo="${promotion.promo_id}" data-active="${promotion.is_active}">
          ${promotion.is_active == 1 ? "Deactivate" : "Activate"}
        </button>
      </li>`).join("")}</ul>`;
  document.getElementById("methods").innerHTML = `
    <h6>Payment Methods</h6>
    <ul class="list-group">${settingsData.paymentMethods.map((method) => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${escapeHtml(method.method_name)}
          <small class="d-block text-muted">${escapeHtml(method.description || "")}</small>
        </span>
        <button class="btn btn-sm ${method.is_active == 1 ? "btn-outline-danger" : "btn-outline-success"}"
          data-method="${method.payment_method_id}" data-active="${method.is_active}">
          ${method.is_active == 1 ? "Deactivate" : "Activate"}
        </button>
      </li>`).join("")}</ul>`;

  document.querySelectorAll("[data-promo]").forEach((button) => {
    button.addEventListener("click", () => runAction(() =>
      toggle("promotion", button.dataset.promo, button.dataset.active == 1)));
  });
  document.querySelectorAll("[data-method]").forEach((button) => {
    button.addEventListener("click", () => runAction(() =>
      toggle("payment_method", button.dataset.method, button.dataset.active == 1)));
  });
  document.getElementById("assignment_product").innerHTML =
    '<option value="">-- SELECT PRODUCT --</option>' +
    settingsData.products.map((product) =>
      `<option value="${product.product_id}">${product.product_name}</option>`).join("");
  document.getElementById("assignment_promo").innerHTML =
    '<option value="">-- SELECT PROMOTION --</option>' +
    settingsData.promotions.map((promotion) =>
      `<option value="${promotion.promo_id}">${promotion.promo_name}</option>`).join("");
  document.getElementById("assignments").innerHTML = settingsData.productPromos.map((assignment) =>
    `<span class="badge text-bg-light me-2 mb-2">${assignment.product_name}: ${assignment.promo_name}
      <button type="button" class="btn btn-sm p-0" data-assignment="${assignment.product_promo_id}" aria-label="Remove promotion assignment">&times;</button>
    </span>`).join("");
  document.querySelectorAll("[data-assignment]").forEach((button) => {
    button.addEventListener("click", () => runAction(async () => {
      await post("removePromotion", { id: button.dataset.assignment });
      await load();
    }));
  });
};
