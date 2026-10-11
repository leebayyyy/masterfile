import { updateModal } from "./modules/product-update.js";
import { deactivateModal } from "./modules/product-delete.js";

const baseApiUrl = new URL("../api", import.meta.url).href;
sessionStorage.setItem("baseAPIUrl", baseApiUrl);

let productCategoryList = [];
let unitOfMeasureList = [];
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-add").addEventListener("click", () => {
    renderAddModal();
  });
  loadProductCategory();
  loadUnitOfMeasure();
  displayRecords();
  document.getElementById("add-product-form").addEventListener("submit", (event) => {
    event.preventDefault();
    insertProduct();
  });
});

const renderAddModal = () => {
  document.getElementById("blank-modal-title").innerText = "Add Product";
  document.getElementById("blank-main-div").innerHTML = `
    <div class="col-md-6">
      <input type="text" class="form-control" id="product_name" placeholder="Product Name" maxlength="200" required />
    </div>
    <div class="col-md-6">
      <input type="number" step="0.01" min="0" max="99999999.99" class="form-control" id="price" placeholder="Price" />
    </div>
    <div class="col-md-6">
      <select class="form-select" id="category_id" required>
        <option value="">-- SELECT CATEGORY --</option>
      </select>
    </div>
    <div class="col-md-6">
      <select class="form-select" id="unit_of_measure_id" required>
        <option value="">-- SELECT UNIT OF MEASURE --</option>
      </select>
    </div>
    <div class="col-md-6"><input type="text" class="form-control" id="price_tier" placeholder="Price Tier" /></div>
    <div class="col-md-6"><input type="number" step="0.01" min="0" class="form-control" id="wholesale_price" placeholder="Wholesale Price" /></div>
  `;
  document.getElementById("blank-modal-footer").innerHTML = `
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
    <button type="submit" class="btn btn-primary" id="btn-submit" form="add-product-form">Submit</button>
  `;

  const select = document.getElementById("category_id");
  productCategoryList.forEach((productCategory) => {
    const option = document.createElement("option");
    option.innerText = productCategory.category_name;
    option.value = productCategory.category_id;
    select.appendChild(option);
  });

  const unitSelect = document.getElementById("unit_of_measure_id");
  unitOfMeasureList.forEach((unit) => {
    const option = document.createElement("option");
    option.textContent = unit.measure_name;
    option.value = unit.unit_of_measure_id;
    unitSelect.appendChild(option);
  });
};

const loadProductCategory = async () => {
  const response = await axios.get(`${baseApiUrl}/product_category.php`, {
    params: { operation: "getAllProductCategories" },
  });
  if (response.status == 200) {
    productCategoryList = response.data;
    const select = document.getElementById("category_id");
    select.innerHTML = '<option value="">-- SELECT CATEGORY --</option>';
    productCategoryList.forEach((productCategory) => {
      let option = document.createElement("option");
      option.innerText = productCategory.category_name;
      option.value = productCategory.category_id;
      select.appendChild(option);
    });
  } else {
    alert("Error!");
  }
};

const loadUnitOfMeasure = async () => {
  const response = await axios.get(`${baseApiUrl}/product.php`, {
    params: { operation: "getAllUnitsOfMeasure" },
  });
  if (response.status == 200) {
    unitOfMeasureList = response.data;
  } else {
    alert("Error loading units of measure!");
  }
};

const displayRecords = async () => {
  const response = await axios.get(`${baseApiUrl}/product.php`, {
    params: { operation: "getAllProducts" },
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
        <th>PRODUCT NAME</th>
        <th>PRICE</th>
        <th>CATEGORY</th>
        <th>UNIT OF MEASURE</th>
        <th>PRICE TIER</th>
        <th>WHOLESALE PRICE</th>
        <th>STATUS</th>
        <th>ACTION</th>
      </tr>
    `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  records.forEach((product) => {
    let row = document.createElement("tr");
    row.innerHTML = `
        <td>${product.product_name}</td>
        <td>${product.price}</td>
        <td>${product.category_name}</td>
        <td>${unitOfMeasureList.find((unit) => Number(unit.unit_of_measure_id) === Number(product.unit_of_measure_id))?.measure_name ?? ""}</td>
        <td>${product.price_tier ?? ""}</td>
        <td>${product.wholesale_price ?? ""}</td>
        <td>${product.is_active == 1 ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}</td>
        <td>
          <button type='button' class='btn btn-success btn-sm btn-update'>Update</button>
          ${product.is_active == 1
            ? `<button type='button' class='btn btn-danger btn-sm btn-delete'>Deactivate</button>`
            : `<button type='button' class='btn btn-secondary btn-sm btn-restore'>Restore</button>`}
        </td>
      `;
    tbody.appendChild(row);

    row.querySelector(".btn-update").addEventListener("click", () => {
      updateModal(product.product_id, productCategoryList, unitOfMeasureList, displayRecords);
    });

    if (product.is_active == 1) {
      row.querySelector(".btn-delete").addEventListener("click", () => {
        deactivateModal(product.product_id, displayRecords);
      });
    } else {
      row.querySelector(".btn-restore").addEventListener("click", () => {
        restoreRecord(product.product_id);
      });
    }
  });
  table.appendChild(tbody);
  tableDiv.appendChild(table);
};

const insertProduct = async () => {
  const jsonData = {
    productName: document.getElementById("product_name").value,
    price: document.getElementById("price").value,
    categoryId: document.getElementById("category_id").value,
    unitOfMeasureId: document.getElementById("unit_of_measure_id").value,
    priceTier: document.getElementById("price_tier").value,
    wholesalePrice: document.getElementById("wholesale_price").value,
  };
  const formData = new FormData();
  formData.append("operation", "insertProduct");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${baseApiUrl}/product.php`,
    method: "POST",
    data: formData,
  });
  if (response.data == 1) {
    displayRecords();
    document.getElementById("add-product-form").reset();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("blank-modal")).hide();
    alert("Product successfully saved!");
  } else {
    alert("ERROR");
  }
};

const restoreRecord = async (productId) => {
  const formData = new FormData();
  formData.append("operation", "restoreProduct");
  formData.append("json", JSON.stringify({ productId: productId }));
  const response = await axios({
    url: `${baseApiUrl}/product.php`,
    method: "POST",
    data: formData,
  });
  if (response.data == 1) {
    displayRecords();
  } else {
    alert("ERROR");
  }
};
