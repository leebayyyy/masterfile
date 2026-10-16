import { showToast, showError, showConfirm } from "../swal-helper.js";

export const deleteModal = async (roleId, refreshDisplay) => {
  const res = await showConfirm({
    title: "Delete Role?",
    text: "Delete this role? This cannot be undone.",
    confirmButtonText: "Yes, Delete",
    isDestructive: true
  });
  if (!res.isConfirmed) return;

  const result = await deleteRole(roleId);
  if (result == 1) {
    refreshDisplay();
    showToast("Role has been deleted.", "success");
  } else if (result && result.message) {
    showError(result.message);
  } else {
    showError("Failed to delete role.");
  }
};

const deleteRole = async (roleId) => {
  const params = {
    operation: "deleteRole",
    json: JSON.stringify({ roleId: roleId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/role.php`,
    { params: params }
  );
  return response.data;
};
