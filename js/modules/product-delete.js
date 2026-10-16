import { showConfirm, showToast, showError } from "../swal-helper.js";

export const deactivateModal = async (productId, refreshDisplay) => {
  const result = await showConfirm({
    title: "Deactivate Product?",
    text: "Deactivate this product? It can be restored later.",
    confirmButtonText: "Yes, Deactivate",
    isDestructive: true
  });
  if (!result.isConfirmed) return;

  try {
    const res = await deactivateProduct(productId);
    if (res == 1) {
      refreshDisplay();
      showToast("Product has been deactivated.");
    } else if (res && res.message) {
      showError(res.message);
    } else {
      showError("Could not deactivate product.");
    }
  } catch (err) {
    showError(err.response?.data?.message || "Failed to deactivate product.");
  }
};

const deactivateProduct = async (productId) => {
  const params = {
    operation: "deactivateProduct",
    json: JSON.stringify({ productId: productId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/product.php`,
    { params: params }
  );
  return response.data;
};
