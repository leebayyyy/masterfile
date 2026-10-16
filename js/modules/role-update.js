import { showToast, showError } from "../swal-helper.js";

export const updateModal = async (roleId, refreshDisplay) => {
  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  document.getElementById("blank-modal-title").innerText = "Update Role";
  const record = await getRoleDetails(roleId);

  let myHtml = `
        <table class="table table-sm">
          <tr>
            <td>Role Name</td>
            <td><input type="text" id="update-role_name" class="form-control" value="${record.role_name ?? ""}" /></td>
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
    if (await updateRole(roleId) == 1) {
      refreshDisplay();
      showToast("Role record has been successfully updated!", "success");
      myModal.hide();
    } else {
      showError("Failed to update role record.");
    }
  });

  myModal.show();
};

const getRoleDetails = async (roleId) => {
  const params = {
    operation: "getRole",
    json: JSON.stringify({ roleId: roleId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/role.php`,
    { params: params }
  );
  return response.data[0];
};

const updateRole = async (roleId) => {
  const jsonData = {
    roleName: document.getElementById("update-role_name").value,
    description: document.getElementById("update-description").value,
    roleId: roleId,
  };
  const formData = new FormData();
  formData.append("operation", "updateRole");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/role.php`,
    method: "POST",
    data: formData,
  });
  return response.data;
};
