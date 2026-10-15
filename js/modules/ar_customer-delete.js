import { showConfirm, showToast, showError } from "../swal-helper.js";

export const deactivateModal = async (arCustomerId, refreshDisplay) => {
  const result = await showConfirm({
    title: "Deactivate AR Customer?",
    text: "Are you sure you want to deactivate this customer? It can be restored later.",
    confirmButtonText: "Yes, Deactivate",
    isDestructive: true
  });
  if (!result.isConfirmed) return;

  try {
    const res = await deactivateArCustomer(arCustomerId);
    if (res == 1) {
      refreshDisplay();
      showToast("AR Customer has been deactivated.");
    } else if (res && res.message) {
      showError(res.message);
    } else {
      showError("Could not deactivate customer.");
    }
  } catch (err) {
    showError(err.response?.data?.message || "Failed to deactivate customer.");
  }
};

const deactivateArCustomer = async (arCustomerId) => {
  const params = {
    operation: "deactivateCustomer",
    json: JSON.stringify({ arCustomerId: arCustomerId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/ar_customer.php`,
    { params: params }
  );
  return response.data;
};
