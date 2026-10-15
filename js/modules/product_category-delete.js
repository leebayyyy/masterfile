import { showToast, showError, showConfirm } from "../swal-helper.js";

export const deleteModal = async (categoryId, refreshDisplay) => {
  const res = await showConfirm({
    title: "Delete Category?",
    text: "Delete this product category? This cannot be undone.",
    confirmButtonText: "Yes, Delete",
    isDestructive: true
  });
  if (!res.isConfirmed) return;

  const result = await deleteProductCategory(categoryId);
  if (result == 1) {
    refreshDisplay();
    showToast("Product Category has been deleted.", "success");
  } else if (result && result.message) {
    showError(result.message);
  } else {
    showError("Failed to delete product category.");
  }
};

const deleteProductCategory = async (categoryId) => {
  const params = {
    operation: "deleteProductCategory",
    json: JSON.stringify({ categoryId: categoryId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/product_category.php`,
    { params: params }
  );
  return response.data;
};
