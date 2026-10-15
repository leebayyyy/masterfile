import { showToast, showError, showConfirm } from "../swal-helper.js";

export const deleteModal = async (customerTypeId, refreshDisplay) => {
  const res = await showConfirm({
    title: "Delete Customer Type?",
    text: "Delete this customer type? This cannot be undone.",
    confirmButtonText: "Yes, Delete",
    isDestructive: true
  });
  if (!res.isConfirmed) return;

  const result = await deleteArCustomerType(customerTypeId);
  if (result == 1) {
    refreshDisplay();
    showToast("Customer Type has been deleted.", "success");
  } else if (result && result.message) {
    showError(result.message);
  } else {
    showError("Failed to delete customer type.");
  }
};

const deleteArCustomerType = async (customerTypeId) => {
  const params = {
    operation: "deleteCustomerType",
    json: JSON.stringify({ customerTypeId: customerTypeId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/ar_customer_type.php`,
    { params: params }
  );
  return response.data;
};
