import { updateModal } from "./modules/ar_customer-update.js";
import { deactivateModal } from "./modules/ar_customer-delete.js";

const baseApiUrl = new URL("../api", import.meta.url).href;
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

let arCustomerTypeList = [];
let canManageCustomers = false;
let canManageCreditLimits = false;
document.addEventListener("DOMContentLoaded", () => {
  const addFieldsHtml = document.getElementById("blank-main-div").innerHTML;
  document.getElementById("btn-add").addEventListener("click", () => {
    if (!canManageCustomers) return;
    document.getElementById("blank-modal-title").innerText = "Add AR Customer";
    document.getElementById("blank-main-div").innerHTML = addFieldsHtml;
    document.getElementById("add-form").reset();
    loadArCustomerType();
    document.getElementById("blank-modal-footer").innerHTML = `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      <button type="submit" class="btn btn-primary" id="btn-submit" form="add-form">Submit</button>`;
  });
  loadPermissions()
    .then(async () => {
      if (canManageCustomers) await loadArCustomerType();
      await displayRecords();
    })
    .catch((error) => {
      console.error(error);
      document.getElementById("table-div").innerHTML =
        '<div class="alert alert-danger">Unable to load AR customer data.</div>';
    });
  document.getElementById("add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    insertArCustomer();
  });
});

const loadPermissions = async () => {
  const response = await axios.get(`${baseApiUrl}/auth.php`, {
    params: { operation: "session" },
    withCredentials: true,
  });
  canManageCustomers = response.data.user?.role_name === "Admin";
  canManageCreditLimits = ["Admin", "Accounts Receivable Staff"].includes(response.data.user?.role_name);
  document.getElementById("btn-add").classList.toggle("d-none", !canManageCustomers);
};

const loadArCustomerType = async () => {
  const select = document.getElementById("customer_type_id");
  const response = await axios.get(`${baseApiUrl}/ar_customer_type.php`, {
    params: { operation: "getAllCustomerTypes" },
  });
  if (response.status == 200) {
    arCustomerTypeList = response.data;
    select.innerHTML = '<option value="">-- SELECT CUSTOMER TYPE --</option>';
    arCustomerTypeList.forEach((customerType) => {
      let option = document.createElement("option");
      option.innerText = customerType.type_name;
      option.value = customerType.customer_type_id;
      select.appendChild(option);
    });
  } else {
    alert("Error!");
  }
};

const displayRecords = async () => {
  const response = await axios.get(`${baseApiUrl}/ar_customer.php`, {
    params: { operation: "getAllCustomers" },
  });
  if (response.status == 200) {
    displayRecordsTable(response.data);
  } else {
    alert("Error!");
  }
};

const displayRecordsTable = (records) => {
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";
  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");

  const thead = document.createElement("thead");
  thead.innerHTML = `
      <tr>
        <th>CUSTOMER NAME</th>
        <th>CUSTOMER TYPE</th>
        <th>CONTACT NAME</th>
        <th>CONTACT PHONE</th>
        <th>BILLING ADDRESS</th>
        <th>EMAIL</th>
        <th>CREDIT LIMIT</th>
        <th>OUTSTANDING</th>
        <th>AVAILABLE CREDIT</th>
        <th>STATUS</th>
        ${canManageCustomers || canManageCreditLimits ? "<th>ACTION</th>" : ""}
      </tr>
    `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  records.forEach((customer) => {
    let row = document.createElement("tr");
    row.innerHTML = `
        <td>${customer.customer_name}</td>
        <td>${customer.type_name}</td>
        <td>${customer.contact_name}</td>
        <td>${customer.contact_phone}</td>
        <td>${customer.billing_address}</td>
        <td>${customer.email ?? ""}</td>
        <td>${Number(customer.credit_limit || 0).toFixed(2)}</td>
        <td>${Number(customer.credit_exposure || 0).toFixed(2)}</td>
        <td>${Number(customer.available_credit || 0).toFixed(2)}</td>
        <td>${customer.is_active == 1 ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}</td>
        ${canManageCustomers || canManageCreditLimits ? `<td>
          ${canManageCreditLimits ? "<button type='button' class='btn btn-primary btn-sm btn-credit-limit'>Credit Limit</button>" : ""}
          ${canManageCustomers ? `<button type='button' class='btn btn-success btn-sm btn-update'>Update</button>
          ${customer.is_active == 1
            ? `<button type='button' class='btn btn-danger btn-sm btn-delete'>Deactivate</button>`
            : `<button type='button' class='btn btn-secondary btn-sm btn-restore'>Restore</button>`}` : ""}
        </td>` : ""}
      `;
    tbody.appendChild(row);

    if (canManageCreditLimits) {
      row.querySelector(".btn-credit-limit").addEventListener("click", () => {
        updateCreditLimitModal(customer);
      });
    }
    if (canManageCustomers) {
      row.querySelector(".btn-update").addEventListener("click", () => {
        updateModal(customer.ar_customer_id, arCustomerTypeList, displayRecords);
      });

      if (customer.is_active == 1) {
        row.querySelector(".btn-delete").addEventListener("click", () => {
          deactivateModal(customer.ar_customer_id, displayRecords);
        });
      } else {
        row.querySelector(".btn-restore").addEventListener("click", () => {
          restoreRecord(customer.ar_customer_id);
        });
      }
    }
  });
  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

const updateCreditLimitModal = (customer) => {
  const modalElement = document.getElementById("blank-modal");
  document.getElementById("blank-modal-title").innerText = `Credit Limit — ${customer.customer_name}`;
  document.getElementById("blank-main-div").innerHTML = `
    <label class="form-label" for="credit-limit-input">Approved credit limit</label>
    <input class="form-control" type="number" id="credit-limit-input" min="0" max="9999999999.99" step="0.01" value="${Number(customer.credit_limit || 0).toFixed(2)}" required />
    <small class="form-text">Current outstanding: ${Number(customer.credit_exposure || 0).toFixed(2)}. A lower limit will not change existing balances, but will prevent additional credit purchases until the account is within its limit.</small>`;
  document.getElementById("blank-modal-footer").innerHTML = `
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
    <button type="button" class="btn btn-primary" id="save-credit-limit">Save Credit Limit</button>`;
  document.getElementById("save-credit-limit").addEventListener("click", async () => {
    const input = document.getElementById("credit-limit-input");
    if (!input.reportValidity()) return;
    const formData = new FormData();
    formData.append("operation", "updateCreditLimit");
    formData.append("json", JSON.stringify({
      arCustomerId: customer.ar_customer_id,
      creditLimit: input.value,
    }));
    try {
      const { data } = await axios.post(`${baseApiUrl}/ar_customer.php`, formData, { withCredentials: true });
      if (data !== 1) throw new Error("The credit limit was not updated.");
      bootstrap.Modal.getOrCreateInstance(modalElement).hide();
      await displayRecords();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || error.message || "Unable to update the credit limit.");
    }
  });
  bootstrap.Modal.getOrCreateInstance(modalElement).show();
};

const insertArCustomer = async () => {
  const jsonData = {
    customerName: document.getElementById("customer_name").value,
    customerTypeId: document.getElementById("customer_type_id").value,
    contactName: document.getElementById("contact_name").value,
    contactPhone: document.getElementById("contact_phone").value,
    billingAddress: document.getElementById("billing_address").value,
    email: document.getElementById("email").value,
  };
  const formData = new FormData();
  formData.append("operation", "insertCustomer");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${baseApiUrl}/ar_customer.php`,
    method: "POST",
    data: formData,
  });
  if (response.data == 1) {
    displayRecords();
    document.getElementById("add-form").reset();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("blank-modal")).hide();
    alert("AR Customer successfully saved!");
  } else {
    alert("ERROR");
  }
};

const restoreRecord = async (arCustomerId) => {
  const formData = new FormData();
  formData.append("operation", "restoreCustomer");
  formData.append("json", JSON.stringify({ arCustomerId: arCustomerId }));
  const response = await axios({
    url: `${baseApiUrl}/ar_customer.php`,
    method: "POST",
    data: formData,
  });
  if (response.data == 1) {
    displayRecords();
  } else {
    alert("ERROR");
  }
};
