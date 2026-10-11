import { getSession } from "./auth.js?v=3";

const apiUrl = new URL("../api/pos_terminal.php", import.meta.url).href;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("terminal-select-form").addEventListener("submit", selectTerminal);
  loadTerminals().catch(showError);
});

const loadTerminals = async () => {
  const session = await getSession();
  if (!session.authenticated || session.user?.role_name !== "Cashier") return;

  const { data } = await axios.get(apiUrl, {
    params: { operation: "getAllPosTerminals" },
    withCredentials: true,
  });
  const select = document.getElementById("terminal_id");
  select.innerHTML = '<option value="">-- SELECT TERMINAL --</option>';
  data.forEach((terminal) => {
    const option = document.createElement("option");
    option.value = terminal.pos_terminal_id;
    option.textContent = terminal.terminal_name;
    select.appendChild(option);
  });
  document.getElementById("select-terminal-button").disabled = data.length === 0;
  if (data.length === 0) {
    showError({ message: "No POS terminals are configured. Ask Admin to add a terminal." });
  }
};

const selectTerminal = async (event) => {
  event.preventDefault();
  const error = document.getElementById("terminal-error");
  error.classList.add("d-none");
  const formData = new FormData();
  formData.append("operation", "selectTerminal");
  formData.append("json", JSON.stringify({
    terminalId: document.getElementById("terminal_id").value,
  }));
  try {
    const { data } = await axios.post(apiUrl, formData, { withCredentials: true });
    if (data.returnValue !== 1) throw new Error("Terminal selection was not saved.");
    window.location.href = "index.html";
  } catch (requestError) {
    showError(requestError);
  }
};

const showError = (error) => {
  console.error(error);
  const errorDiv = document.getElementById("terminal-error");
  errorDiv.textContent = error.response?.data?.message || error.message ||
    "Unable to load or select a POS terminal.";
  errorDiv.classList.remove("d-none");
};
