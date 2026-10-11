export const updateModal = async (customerTypeId, refreshDisplay) => {
  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  document.getElementById("blank-modal-title").innerText = "Update Customer Type";
  const record = await getArCustomerTypeDetails(customerTypeId);

  let myHtml = `
        <table class="table table-sm">
          <tr>
            <td>Type Name</td>
            <td><input type="text" id="update-type_name" class="form-control" maxlength="100" value="${record.type_name ?? ""}" required /></td>
          </tr>
          <tr>
            <td>Description</td>
            <td><textarea class="form-control" id="update-description" rows="2">${record.description ?? ""}</textarea></td>
          </tr>
          <tr>
            <td>Days</td>
            <td><input type="number" id="update-days" class="form-control" min="0" step="1" value="${record.days ?? ""}" /></td>
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
    if (await updateArCustomerType(customerTypeId) == 1) {
      refreshDisplay();
      alert("Customer Type record has been successfully updated!");
      myModal.hide();
    } else {
      alert("ERROR!");
    }
  });

  myModal.show();
};

const getArCustomerTypeDetails = async (customerTypeId) => {
  const params = {
    operation: "getCustomerType",
    json: JSON.stringify({ customerTypeId: customerTypeId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/ar_customer_type.php`,
    { params: params }
  );
  return response.data[0];
};

const updateArCustomerType = async (customerTypeId) => {
  const jsonData = {
    typeName: document.getElementById("update-type_name").value,
    description: document.getElementById("update-description").value,
    days: document.getElementById("update-days").value,
    customerTypeId: customerTypeId,
  };
  const formData = new FormData();
  formData.append("operation", "updateCustomerType");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/ar_customer_type.php`,
    method: "POST",
    data: formData,
  });
  return response.data;
};
