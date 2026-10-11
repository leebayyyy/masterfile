import { updateModal } from "./modules/pos_terminal-update.js?v=3";
import { deleteModal } from "./modules/pos_terminal-delete.js?v=3";
import { getSession } from "./auth.js?v=3";

const baseApiUrl = new URL("../api", import.meta.url).href;
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

let canManageTerminals = false;

document.addEventListener("DOMContentLoaded", () => {
  const addFieldsHtml = document.getElementById("blank-main-div").innerHTML;
  document.getElementById("btn-add").addEventListener("click", () => {
    if (!canManageTerminals) return;
    document.getElementById("blank-modal-title").innerText = "Add POS Terminal";
    document.getElementById("blank-main-div").innerHTML = addFieldsHtml;
    document.getElementById("add-form").reset();
    document.getElementById("blank-modal-footer").innerHTML = `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      <button type="submit" class="btn btn-primary" id="btn-submit" form="add-form">Submit</button>`;
  });
  document.getElementById("add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    insertPosTerminal();
  });
  loadPage();
});

const loadPage = async () => {
  try {
    const session = await getSession();
    canManageTerminals = session.user?.role_name === "Admin";
    document.getElementById("btn-add").classList.toggle("d-none", !canManageTerminals);
    await displayRecords();
  } catch (error) {
    showError(error);
  }
};

const showError = (error) => {
  console.error(error);
  const errorDiv = document.getElementById("terminal-error");
  errorDiv.textContent = error.response?.data?.message || "Unable to load POS terminal data.";
  errorDiv.classList.remove("d-none");
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

const displayRecords = async () => {
  const response = await axios.get(`${baseApiUrl}/pos_terminal.php`, {
    params: { operation: "getAllPosTerminals" },
    withCredentials: true,
  });
  const tableDiv = document.getElementById("table-div");
  const records = response.data;
  tableDiv.innerHTML = records.length
    ? `<table class="table table-hover table-striped table-sm">
        <thead><tr><th>TERMINAL NAME</th>${canManageTerminals ? "<th>ACTION</th>" : ""}</tr></thead>
        <tbody>${records.map((terminal) => `
          <tr><td>${escapeHtml(terminal.terminal_name)}</td>
          ${canManageTerminals ? `<td>
            <button type="button" class="btn btn-success btn-sm btn-update" data-id="${terminal.pos_terminal_id}">Update</button>
            <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${terminal.pos_terminal_id}">Delete</button>
          </td>` : ""}</tr>`).join("")}</tbody>
      </table>`
    : '<p class="text-muted">No POS terminals configured.</p>';

  if (canManageTerminals) {
    tableDiv.querySelectorAll(".btn-update").forEach((button) =>
      button.addEventListener("click", () =>
        updateModal(button.dataset.id, displayRecords)));
    tableDiv.querySelectorAll(".btn-delete").forEach((button) =>
      button.addEventListener("click", () =>
        deleteModal(button.dataset.id, displayRecords)));
  }
};

const insertPosTerminal = async () => {
  const formData = new FormData();
  formData.append("operation", "insertPosTerminal");
  formData.append("json", JSON.stringify({
    terminalName: document.getElementById("terminal_name").value,
  }));
  try {
    const { data } = await axios.post(`${baseApiUrl}/pos_terminal.php`, formData, { withCredentials: true });
    if (data !== 1) throw new Error("POS terminal was not saved.");
    await displayRecords();
    document.getElementById("add-form").reset();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("blank-modal")).hide();
  } catch (error) {
    showError(error);
  }
};
