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

let terminalSortDirection = "desc";

const displayRecords = async () => {
  const response = await axios.get(`${baseApiUrl}/pos_terminal.php`, {
    params: { operation: "getAllPosTerminals" },
    withCredentials: true,
  });
  const tableDiv = document.getElementById("table-div");
  const records = response.data || [];

  const sorted = [...records].sort((a, b) => {
    const idA = Number(a.pos_terminal_id || 0);
    const idB = Number(b.pos_terminal_id || 0);
    return terminalSortDirection === "desc" ? idB - idA : idA - idB;
  });

  tableDiv.innerHTML = sorted.length
    ? `<table class="table table-hover table-striped table-sm align-middle">
        <thead>
          <tr>
            <th id="th-terminal-id" style="cursor: pointer; user-select: none;" title="Click to sort by Terminal ID">
              TERMINAL ID <span class="sort-icon">${terminalSortDirection === "desc" ? "▼" : "▲"}</span>
            </th>
            <th>TERMINAL NAME</th>
            ${canManageTerminals ? "<th>ACTION</th>" : ""}
          </tr>
        </thead>
        <tbody>${sorted.map((terminal) => `
          <tr>
            <td class="font-monospace fw-bold">#${terminal.pos_terminal_id}</td>
            <td>${escapeHtml(terminal.terminal_name)}</td>
            ${canManageTerminals ? `<td>
              <button type="button" class="btn btn-success btn-sm btn-update" data-id="${terminal.pos_terminal_id}">Update</button>
              <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${terminal.pos_terminal_id}">Delete</button>
            </td>` : ""}
          </tr>`).join("")}
        </tbody>
      </table>`
    : '<p class="text-muted">No POS terminals configured.</p>';

  document.getElementById("th-terminal-id")?.addEventListener("click", () => {
    terminalSortDirection = terminalSortDirection === "desc" ? "asc" : "desc";
    displayRecords();
  });

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
