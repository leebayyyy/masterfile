import { showToast, showError } from "../swal-helper.js";

export const updateModal = async (productId, productCategoryList, unitOfMeasureList, refreshDisplay, promotionList = []) => {
  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  document.getElementById("blank-modal-title").innerText = "Update Product";
  const record = await getProductDetails(productId);

  let myHtml = `
        <table class="table table-sm">
          <tr>
            <td>Product Name</td>
            <td><input type="text" id="update-product_name" class="form-control" maxlength="200" value="${record.product_name ?? ""}" required /></td>
          </tr>
          <tr>
            <td>Price</td>
            <td><input type="number" step="0.01" min="0" max="99999999.99" id="update-price" class="form-control" value="${record.price ?? ""}" /></td>
          </tr>
          <tr>
            <td>Category</td>
            <td><select class="form-select" id="update-category_id" required></select></td>
          </tr>
          <tr>
            <td>Unit of Measure</td>
            <td><select id="update-unit_of_measure_id" class="form-select" required></select></td>
          </tr>
          <tr><td>Price Tier</td><td><div class="form-control bg-light text-muted fw-bold" style="cursor: not-allowed;" title="Static price tier">Retail</div><input type="hidden" id="update-price_tier" value="Retail" /></td></tr>
          <tr><td>Wholesale Price</td><td><input type="number" step="0.01" min="0" id="update-wholesale_price" class="form-control" value="${record.wholesale_price ?? ""}" /></td></tr>
          <tr><td>Active Promotion</td><td><select id="update-promo_id" class="form-select"></select></td></tr>
        </table>
    `;
  document.getElementById("blank-main-div").innerHTML = myHtml;

  let optionsHtml = '<option value="">-- SELECT CATEGORY --</option>';
  productCategoryList.forEach((productCategory) => {
    const selected = record.category_id == productCategory.category_id ? "selected" : "";
    optionsHtml += `<option value="${productCategory.category_id}" ${selected}>${productCategory.category_name}</option>`;
  });
  document.getElementById("update-category_id").innerHTML = optionsHtml;

  let unitOptionsHtml = '<option value="">-- SELECT UNIT OF MEASURE --</option>';
  unitOfMeasureList.forEach((unit) => {
    const selected = Number(record.unit_of_measure_id) === Number(unit.unit_of_measure_id) ? "selected" : "";
    unitOptionsHtml += `<option value="${unit.unit_of_measure_id}" ${selected}>${unit.measure_name}</option>`;
  });
  document.getElementById("update-unit_of_measure_id").innerHTML = unitOptionsHtml;

  let promoOptionsHtml = '<option value="">-- NO PROMOTION --</option>';
  (promotionList || []).forEach((promo) => {
    const selected = Number(record.promo_id) === Number(promo.promo_id) ? "selected" : "";
    promoOptionsHtml += `<option value="${promo.promo_id}" ${selected}>${promo.promo_name} (${Number(promo.discount_rate).toFixed(0)}% off)</option>`;
  });
  document.getElementById("update-promo_id").innerHTML = promoOptionsHtml;

  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
      <button type="button" class="btn btn-primary btn-sm w-100 btn-update">UPDATE</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    `;

  modalFooter.querySelector(".btn-update").addEventListener("click", async () => {
    try {
      if (await updateProduct(productId) == 1) {
        await refreshDisplay();
        showToast("Product record has been successfully updated!");
        myModal.hide();
      } else {
        showError("Could not update product.");
      }
    } catch (err) {
      showError(err.response?.data?.message || "Failed to update product.");
    }
  });

  myModal.show();
};

const getProductDetails = async (productId) => {
  const params = {
    operation: "getProduct",
    json: JSON.stringify({ productId: productId }),
  };
  const response = await axios.get(`${sessionStorage.baseAPIUrl}/product.php`, {
    params: params,
    withCredentials: true,
  });
  return response.data[0];
};

const updateProduct = async (productId) => {
  const jsonData = {
    productId: productId,
    productName: document.getElementById("update-product_name").value,
    price: document.getElementById("update-price").value,
    categoryId: document.getElementById("update-category_id").value,
    unitOfMeasureId: document.getElementById("update-unit_of_measure_id").value,
    priceTier: document.getElementById("update-price_tier")?.value?.trim() || "Retail",
    wholesalePrice: document.getElementById("update-wholesale_price").value,
    promoId: document.getElementById("update-promo_id") ? (document.getElementById("update-promo_id").value || null) : undefined,
  };
  const formData = new FormData();
  formData.append("operation", "updateProduct");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/product.php`,
    method: "POST",
    data: formData,
    withCredentials: true,
  });
  return response.data;
};
