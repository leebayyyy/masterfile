import { showToast, showError, showConfirm } from "../swal-helper.js";

export const deactivateModal = async (userId, refreshDisplay) => {
  const res = await showConfirm({
    title: "Deactivate User?",
    text: "Deactivate this user? It can be restored later.",
    confirmButtonText: "Yes, Deactivate",
    isDestructive: true
  });
  if (!res.isConfirmed) return;

  const result = await deactivateUser(userId);
  if (result == 1) {
    refreshDisplay();
    showToast("User has been deactivated.", "success");
  } else if (result && result.message) {
    showError(result.message);
  } else {
    showError("Failed to deactivate user.");
  }
};

const deactivateUser = async (userId) => {
  const params = {
    operation: "deactivateUser",
    json: JSON.stringify({ userId: userId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/user.php`,
    { params: params }
  );
  return response.data;
};
