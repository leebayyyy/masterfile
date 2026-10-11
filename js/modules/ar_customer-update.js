export const updateModal = async (arCustomerId, arCustomerTypeList, refreshDisplay) => {
  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  document.getElementById("blank-modal-title").innerText = "Update AR Customer";
  const record = await getArCustomerDetails(arCustomerId);

  let myHtml = `
        <table class="table table-sm">
          <tr>
            <td>Customer Name</td>
            <td><input type="text" id="update-customer_name" class="form-control" value="${record.customer_name ?? ""}" /></td>
          </tr>
          <tr>
            <td>Customer Type</td>
            <td><select class="form-select" id="update-customer_type_id"></select></td>
          </tr>
          <tr>
            <td>Contact Name</td>
            <td><input type="text" id="update-contact_name" class="form-control" value="${record.contact_name ?? ""}" /></td>
          </tr>
          <tr>
            <td>Contact Phone</td>
            <td><input type="text" id="update-contact_phone" class="form-control" value="${record.contact_phone ?? ""}" /></td>
          </tr>
          <tr>
            <td>Billing Address</td>
            <td><input type="text" id="update-billing_address" class="form-control" value="${record.billing_address ?? ""}" /></td>
          </tr>
          <tr>
            <td>Email</td>
            <td><input type="email" id="update-email" class="form-control" value="${record.email ?? ""}" /></td>
          </tr>
        </table>
    `;
  document.getElementById("blank-main-div").innerHTML = myHtml;

  let optionsHtml = '<option value="">-- SELECT CUSTOMER TYPE --</option>';
  arCustomerTypeList.forEach((customerType) => {
    const selected = record.customer_type_id == customerType.customer_type_id ? "selected" : "";
    optionsHtml += `<option value="${customerType.customer_type_id}" ${selected}>${customerType.type_name}</option>`;
  });
  document.getElementById("update-customer_type_id").innerHTML = optionsHtml;

  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
      <button type="button" class="btn btn-primary btn-sm w-100 btn-update">UPDATE</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    `;

  modalFooter.querySelector(".btn-update").addEventListener("click", async () => {
    if (await updateArCustomer(arCustomerId) == 1) {
      refreshDisplay();
      alert("AR Customer record has been successfully updated!");
      myModal.hide();
    } else {
      alert("ERROR!");
    }
  });

  myModal.show();
};

const getArCustomerDetails = async (arCustomerId) => {
  const params = {
    operation: "getCustomer",
    json: JSON.stringify({ arCustomerId: arCustomerId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/ar_customer.php`,
    { params: params }
  );
  return response.data[0];
};

const updateArCustomer = async (arCustomerId) => {
  const jsonData = {
    customerName: document.getElementById("update-customer_name").value,
    customerTypeId: document.getElementById("update-customer_type_id").value,
    contactName: document.getElementById("update-contact_name").value,
    contactPhone: document.getElementById("update-contact_phone").value,
    billingAddress: document.getElementById("update-billing_address").value,
    email: document.getElementById("update-email").value,
    arCustomerId: arCustomerId,
  };
  const formData = new FormData();
  formData.append("operation", "updateCustomer");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/ar_customer.php`,
    method: "POST",
    data: formData,
  });
  return response.data;
};
