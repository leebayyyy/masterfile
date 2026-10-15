import { showToast, showError, showConfirm } from "../swal-helper.js";

export const deleteModal = async (wholesalePriceId, refreshDisplay) => {
  const res = await showConfirm({
    title: "Delete Wholesale Price?",
    text: "Delete this wholesale price? This cannot be undone.",
    confirmButtonText: "Yes, Delete",
    isDestructive: true
  });
  if (!res.isConfirmed) return;

  const result = await deleteWholesalePrice(wholesalePriceId);
  if (result == 1) {
    refreshDisplay();
    showToast("Wholesale Price has been deleted.", "success");
  } else if (result && result.message) {
    showError(result.message);
  } else {
    showError("Failed to delete wholesale price.");
  }
};

const deleteWholesalePrice = async (wholesalePriceId) => {
  const params = {
    operation: "deleteWholesalePrice",
    json: JSON.stringify({ wholesalePriceId: wholesalePriceId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/wholesale_price.php`,
    { params: params }
  );
  return response.data;
};
