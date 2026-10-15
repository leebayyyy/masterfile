import { showToast, showError, showConfirm } from "../swal-helper.js";

export const deleteModal = async (posTerminalId, refreshDisplay) => {
  const res = await showConfirm({
    title: "Delete POS Terminal?",
    text: "Delete this POS terminal? This cannot be undone.",
    confirmButtonText: "Yes, Delete",
    isDestructive: true
  });
  if (!res.isConfirmed) return;

  const result = await deletePosTerminal(posTerminalId);
  if (result == 1) {
    refreshDisplay();
    showToast("POS Terminal has been deleted.", "success");
  } else if (result && result.message) {
    showError(result.message);
  } else {
    showError("Failed to delete POS terminal.");
  }
};

const deletePosTerminal = async (posTerminalId) => {
  const params = {
    operation: "deletePosTerminal",
    json: JSON.stringify({ posTerminalId: posTerminalId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/pos_terminal.php`,
    { params: params }
  );
  return response.data;
};
