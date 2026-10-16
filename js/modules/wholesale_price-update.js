import { showToast, showError } from "../swal-helper.js";

export const updateModal = async (wholesalePriceId, productList, refreshDisplay) => {
  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  document.getElementById("blank-modal-title").innerText = "Update Wholesale Price";
  const record = await getWholesalePriceDetails(wholesalePriceId);

  let myHtml = `
        <table class="table table-sm">
          <tr>
            <td>Product</td>
            <td><select class="form-select" id="update-product_id"></select></td>
          </tr>
          <tr>
            <td>Wholesale Price</td>
            <td><input type="number" step="0.01" id="update-wholesale_price" class="form-control" value="${record.wholesale_price ?? ""}" /></td>
          </tr>
          <tr>
            <td>Price Tier</td>
            <td><input type="text" id="update-price_tier" class="form-control" value="${record.price_tier ?? ""}" /></td>
          </tr>
          <tr>
            <td>Effective From</td>
            <td><input type="date" id="update-effective_from" class="form-control" value="${record.effective_from ?? ""}" /></td>
          </tr>
          <tr>
            <td>Effective To</td>
            <td><input type="date" id="update-effective_to" class="form-control" value="${record.effective_to ?? ""}" /></td>
          </tr>
        </table>
    `;
  document.getElementById("blank-main-div").innerHTML = myHtml;

  let optionsHtml = '<option value="">-- SELECT PRODUCT --</option>';
  productList.forEach((product) => {
    const selected = record.product_id == product.product_id ? "selected" : "";
    optionsHtml += `<option value="${product.product_id}" ${selected}>${product.product_name}</option>`;
  });
  document.getElementById("update-product_id").innerHTML = optionsHtml;

  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
      <button type="button" class="btn btn-primary btn-sm w-100 btn-update">UPDATE</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    `;

  modalFooter.querySelector(".btn-update").addEventListener("click", async () => {
    if (await updateWholesalePrice(wholesalePriceId) == 1) {
      refreshDisplay();
      showToast("Wholesale Price record has been successfully updated!", "success");
      myModal.hide();
    } else {
      showError("Failed to update wholesale price.");
    }
  });

  myModal.show();
};

const getWholesalePriceDetails = async (wholesalePriceId) => {
  const params = {
    operation: "getWholesalePrice",
    json: JSON.stringify({ wholesalePriceId: wholesalePriceId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/wholesale_price.php`,
    { params: params }
  );
  return response.data[0];
};

const updateWholesalePrice = async (wholesalePriceId) => {
  const jsonData = {
    productId: document.getElementById("update-product_id").value,
    wholesalePrice: document.getElementById("update-wholesale_price").value,
    priceTier: document.getElementById("update-price_tier").value,
    effectiveFrom: document.getElementById("update-effective_from").value,
    effectiveTo: document.getElementById("update-effective_to").value,
    wholesalePriceId: wholesalePriceId,
  };
  const formData = new FormData();
  formData.append("operation", "updateWholesalePrice");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/wholesale_price.php`,
    method: "POST",
    data: formData,
  });
  return response.data;
};
