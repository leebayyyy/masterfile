import { updateModal } from "./modules/product_category-update.js";
import { deleteModal } from "./modules/product_category-delete.js";

const baseApiUrl = new URL("../api", import.meta.url).href;
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

document.addEventListener("DOMContentLoaded", () => {
  const addFieldsHtml = document.getElementById("blank-main-div").innerHTML;
  document.getElementById("btn-add").addEventListener("click", () => {
    document.getElementById("blank-modal-title").innerText = "Add Product Category";
    document.getElementById("blank-main-div").innerHTML = addFieldsHtml;
    document.getElementById("add-form").reset();
    document.getElementById("blank-modal-footer").innerHTML = `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      <button type="submit" class="btn btn-primary" id="btn-submit" form="add-form">Submit</button>`;
  });
  displayRecords();
  document.getElementById("add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    insertProductCategory();
  });
});

const displayRecords = async () => {
  const response = await axios.get(`${baseApiUrl}/product_category.php`, {
    params: { operation: "getAllProductCategories" },
  });
  if (response.status == 200) {
    displayRecordsTable(response.data);
  } else {
    alert("Error!");
  }
};

const displayRecordsTable = (records) => {
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";
  const table = document.createElement("table");
  table.classList.add("table", "table-hover", "table-striped", "table-sm");

  const thead = document.createElement("thead");
  thead.innerHTML = `
      <tr>
        <th>CATEGORY NAME</th>
        <th>DESCRIPTION</th>
        <th>ACTION</th>
      </tr>
    `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  records.forEach((productCategory) => {
    let row = document.createElement("tr");
    row.innerHTML = `
        <td>${productCategory.category_name}</td>
        <td>${productCategory.description}</td>
        <td>
          <button type='button' class='btn btn-success btn-sm btn-update'>Update</button>
          <button type='button' class='btn btn-danger btn-sm btn-delete'>Delete</button>
        </td>
      `;
    tbody.appendChild(row);

    row.querySelector(".btn-update").addEventListener("click", () => {
      updateModal(productCategory.category_id, displayRecords);
    });

    row.querySelector(".btn-delete").addEventListener("click", () => {
      deleteModal(productCategory.category_id, displayRecords);
    });
  });
  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

const insertProductCategory = async () => {
  const jsonData = {
    categoryName: document.getElementById("category_name").value,
    description: document.getElementById("description").value,
  };
  const formData = new FormData();
  formData.append("operation", "insertProductCategory");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${baseApiUrl}/product_category.php`,
    method: "POST",
    data: formData,
  });
  if (response.data == 1) {
    displayRecords();
    document.getElementById("add-form").reset();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("blank-modal")).hide();
    alert("Product Category successfully saved!");
  } else {
    alert("ERROR");
  }
};
