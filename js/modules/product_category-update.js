import { showToast, showError } from "../swal-helper.js";

export const updateModal = async (categoryId, refreshDisplay) => {
  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  document.getElementById("blank-modal-title").innerText = "Update Product Category";
  const record = await getProductCategoryDetails(categoryId);

  let myHtml = `
        <table class="table table-sm">
          <tr>
            <td>Category Name</td>
            <td><input type="text" id="update-category_name" class="form-control" value="${record.category_name ?? ""}" /></td>
          </tr>
          <tr>
            <td>Description</td>
            <td><textarea class="form-control" id="update-description" rows="2">${record.description ?? ""}</textarea></td>
          </tr>
        </table>
    `;
  document.getElementById("blank-main-div").innerHTML = myHtml;


  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
      <button type="button" class="btn btn-primary btn-sm w-100 btn-update">UPDATE</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    `;

  modalFooter.querySelector(".btn-update").addEventListener("click", async () => {
    if (await updateProductCategory(categoryId) == 1) {
      refreshDisplay();
      showToast("Product Category record has been successfully updated!", "success");
      myModal.hide();
    } else {
      showError("Failed to update product category.");
    }
  });

  myModal.show();
};

const getProductCategoryDetails = async (categoryId) => {
  const params = {
    operation: "getProductCategory",
    json: JSON.stringify({ categoryId: categoryId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/product_category.php`,
    { params: params }
  );
  return response.data[0];
};

const updateProductCategory = async (categoryId) => {
  const jsonData = {
    categoryName: document.getElementById("update-category_name").value,
    description: document.getElementById("update-description").value,
    categoryId: categoryId,
  };
  const formData = new FormData();
  formData.append("operation", "updateProductCategory");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/product_category.php`,
    method: "POST",
    data: formData,
  });
  return response.data;
};
