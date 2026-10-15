import { updateModal } from "./modules/user-update.js";
import { deactivateModal } from "./modules/user-delete.js";
import { showToast, showError as showSwalError } from "./swal-helper.js";

const baseApiUrl = "/api";
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

let roleList = [];
let currentUser = null;
document.addEventListener("DOMContentLoaded", () => {
  const addFieldsHtml = document.getElementById("blank-main-div").innerHTML;
  document.getElementById("btn-add").addEventListener("click", () => {
    document.getElementById("blank-modal-title").innerText = "Add User";
    document.getElementById("blank-main-div").innerHTML = addFieldsHtml;
    document.getElementById("add-form").reset();
    loadRole();
    document.getElementById("blank-modal-footer").innerHTML = `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      <button type="submit" class="btn btn-primary" id="btn-submit" form="add-form">Submit</button>`;
  });
  Promise.all([loadRole(), loadCurrentUser()]).then(displayRecords).catch(showError);
  document.getElementById("add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    insertUser();
  });
});

const loadRole = async () => {
  const select = document.getElementById("role_id");
  const response = await axios.get(`${baseApiUrl}/role.php`, {
    params: { operation: "getAllRoles" },
    withCredentials: true,
  });
  if (response.status == 200) {
    roleList = response.data.filter((role) =>
      ["Cashier", "Accounts Receivable Staff", "Manager"].includes(role.role_name));
    select.innerHTML = '<option value="">-- SELECT ROLE --</option>';
    roleList.forEach((role) => {
      const option = document.createElement("option");
      option.textContent = role.role_name;
      option.value = role.role_id;
      select.appendChild(option);
    });
  }
};

const loadCurrentUser = async () => {
  const response = await axios.get(`${baseApiUrl}/auth.php`, {
    params: { operation: "session" },
    withCredentials: true,
  });
  currentUser = response.data.user;
  window.currentUserId = currentUser?.user_id;
};

const showError = (error) => {
  console.error(error);
  const errorDiv = document.getElementById("users-error");
  errorDiv.textContent = error.response?.data?.message || "Unable to load employee accounts.";
  errorDiv.classList.remove("d-none");
};

const displayRecords = async () => {
  const response = await axios.get(`${baseApiUrl}/user.php`, {
    params: { operation: "getAllUsers" },
    withCredentials: true,
  });
  if (response.status == 200) {
    displayRecordsTable(response.data);
  }
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

let userSortDirection = "desc";

const displayRecordsTable = (records) => {
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";
  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");

  const sorted = [...records].sort((a, b) => {
    const idA = Number(a.user_id || 0);
    const idB = Number(b.user_id || 0);
    return userSortDirection === "desc" ? idB - idA : idA - idB;
  });

  const thead = document.createElement("thead");
  thead.innerHTML = `
      <tr>
        <th id="th-user-id" style="cursor: pointer; user-select: none;" title="Click to sort by User ID">
          USER ID <span class="sort-icon">${userSortDirection === "desc" ? "▼" : "▲"}</span>
        </th>
        <th>USERNAME</th>
        <th>FIRST NAME</th>
        <th>LAST NAME</th>
        <th>ROLE</th>
        <th>EMAIL</th>
        <th>PHONE</th>
        <th>STATUS</th>
        <th>ACTION</th>
      </tr>
    `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  sorted.forEach((user) => {
    let row = document.createElement("tr");
    row.innerHTML = `
        <td class="font-monospace fw-bold">#${user.user_id}</td>
        <td>${escapeHtml(user.username)}</td>
        <td>${escapeHtml(user.first_name)}</td>
        <td>${escapeHtml(user.last_name)}</td>
        <td>${escapeHtml(user.role_name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.phone)}</td>
        <td>${user.is_active == 1 ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}</td>
        <td>
          <button type='button' class='btn btn-success btn-sm btn-update'>Update</button>
          ${user.is_active == 1 && Number(user.user_id) !== Number(currentUser?.user_id)
            ? `<button type='button' class='btn btn-danger btn-sm btn-delete'>Deactivate</button>`
            : user.is_active != 1 ? `<button type='button' class='btn btn-secondary btn-sm btn-restore'>Restore</button>` : ""}
        </td>
      `;
    tbody.appendChild(row);

    row.querySelector(".btn-update").addEventListener("click", () => {
      updateModal(user.user_id, roleList, displayRecords, currentUser?.user_id);
    });

    if (user.is_active == 1) {
      row.querySelector(".btn-delete")?.addEventListener("click", () => {
        deactivateModal(user.user_id, displayRecords);
      });
    } else {
      row.querySelector(".btn-restore")?.addEventListener("click", () => {
        restoreRecord(user.user_id);
      });
    }
  });
  table.appendChild(tbody);
  tableDiv.appendChild(table);

  document.getElementById("th-user-id")?.addEventListener("click", () => {
    userSortDirection = userSortDirection === "desc" ? "asc" : "desc";
    displayRecordsTable(records);
  });
};

const insertUser = async () => {
  const errorDiv = document.getElementById("users-error");
  errorDiv.classList.add("d-none");
  const jsonData = {
    username: document.getElementById("username").value,
    firstName: document.getElementById("first_name").value,
    lastName: document.getElementById("last_name").value,
    roleId: document.getElementById("role_id").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    password: document.getElementById("password").value,
  };
  const formData = new FormData();
  formData.append("operation", "insertUser");
  formData.append("json", JSON.stringify(jsonData));
  try {
    const response = await axios({
      url: `${baseApiUrl}/user.php`,
      method: "POST",
      data: formData,
      withCredentials: true,
    });
    if (response.data == 1) {
      await displayRecords();
      document.getElementById("add-form").reset();
      bootstrap.Modal.getOrCreateInstance(document.getElementById("blank-modal")).hide();
      showToast("Employee account successfully created.", "success");
    } else {
      throw new Error("Employee account was not created.");
    }
  } catch (error) {
    showError(error);
  }
};

const restoreRecord = async (userId) => {
  const formData = new FormData();
  formData.append("operation", "restoreUser");
  formData.append("json", JSON.stringify({ userId: userId }));
  try {
    const response = await axios({
      url: `${baseApiUrl}/user.php`,
      method: "POST",
      data: formData,
      withCredentials: true,
    });
    if (response.data == 1) {
      await displayRecords();
    } else {
      throw new Error("Employee account was not restored.");
    }
  } catch (error) {
    showError(error);
  }
};
