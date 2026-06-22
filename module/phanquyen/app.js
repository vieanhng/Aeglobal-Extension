const state = {
  items: [],
  users: [],
  sharedUsers: new Map(),
  rootId: "",
  expandedIds: new Set(),
  selectedIds: new Set(),
  sandToken: "",
  sandUiid: ""
};

const ALL_ROLES = [
  { value: "viewer", label: "Xem" },
  { value: "copy_editor", label: "Biên Soạn" },
  { value: "editor", label: "Biên tập" },
  { value: "commenter", label: "Bình Luận" },
  { value: "approver", label: "Duyệt" }
];


const MOCK_ITEMS = [
  {
    id: "6850f2b3028ecf95300d5146",
    name: "Thư mục Toán Học lớp 8",
    official_name: "Thư mục Toán Học lớp 8",
    type: "folder",
    parent_id: "684a38b2445a05ae9700eda5",
    stats: { child_count: 5 },
    sharing: { specific_sharing: [{ target: "user", roles: ["viewer"], user_iids: [18264204] }] }
  },
  {
    id: "toan_hinh",
    name: "Hình học Chương 1",
    official_name: "Hình học Chương 1",
    type: "folder",
    parent_id: "6850f2b3028ecf95300d5146",
    stats: { child_count: 2 },
    sharing: { specific_sharing: [] }
  },
  {
    id: "file_hinh_1",
    name: "Bài 1 - Tứ giác.docx",
    official_name: "Bài 1 - Tứ giác.docx",
    type: "file",
    target_item_type: "question_bank",
    target_item_iid: 30303389,
    parent_id: "toan_hinh",
    stats: { child_count: 0 },
    sharing: { specific_sharing: [] }
  },
  {
    id: "file_hinh_2",
    name: "Bài 2 - Hình thang.pdf",
    official_name: "Bài 2 - Hình thang.pdf",
    type: "file",
    parent_id: "toan_hinh",
    stats: { child_count: 0 },
    sharing: { specific_sharing: [] }
  },
  {
    id: "toan_so",
    name: "Đại số Chương 1",
    official_name: "Đại số Chương 1",
    type: "folder",
    parent_id: "6850f2b3028ecf95300d5146",
    stats: { child_count: 1 },
    sharing: { specific_sharing: [] }
  },
  {
    id: "file_so_1",
    name: "Hằng đẳng thức đáng nhớ.pdf",
    official_name: "Hằng đẳng thức đáng nhớ.pdf",
    type: "file",
    parent_id: "toan_so",
    stats: { child_count: 0 },
    sharing: { specific_sharing: [] }
  },
  {
    id: "file_toan_de",
    name: "Đề cương ôn tập Toán 8.pdf",
    official_name: "Đề cương ôn tập Toán 8.pdf",
    type: "file",
    parent_id: "6850f2b3028ecf95300d5146",
    stats: { child_count: 0 },
    sharing: { specific_sharing: [] }
  },
  {
    id: "698c2c3ec37f4f7b7d0ef94a",
    name: "Thư mục Ngữ Văn lớp 9",
    official_name: "Thư mục Ngữ Văn lớp 9",
    type: "folder",
    parent_id: "684a38b2445a05ae9700eda5",
    stats: { child_count: 2 },
    sharing: { specific_sharing: [{ target: "user", roles: ["viewer", "copy_editor"], user_iids: [18264204] }] }
  },
  {
    id: "van_tho",
    name: "Thơ hiện đại",
    official_name: "Thơ hiện đại",
    type: "folder",
    parent_id: "698c2c3ec37f4f7b7d0ef94a",
    stats: { child_count: 1 },
    sharing: { specific_sharing: [] }
  },
  {
    id: "file_van_1",
    name: "Đồng chí - Chính Hữu.pdf",
    official_name: "Đồng chí - Chính Hữu.pdf",
    type: "file",
    parent_id: "van_tho",
    stats: { child_count: 0 },
    sharing: { specific_sharing: [] }
  },
  {
    id: "file_van_2",
    name: "Đề kiểm tra Văn 15 phút.xlsx",
    official_name: "Đề kiểm tra Văn 15 phút.xlsx",
    type: "file",
    parent_id: "698c2c3ec37f4f7b7d0ef94a",
    stats: { child_count: 0 },
    sharing: { specific_sharing: [] }
  },
  {
    id: "68aec351a6652b2ccd024421",
    name: "Tài liệu hướng dẫn sử dụng LMS.pdf",
    official_name: "Tài liệu hướng dẫn sử dụng LMS.pdf",
    type: "file",
    parent_id: "684a38b2445a05ae9700eda5",
    stats: { child_count: 0 },
    sharing: { specific_sharing: [] }
  }
];

const MOCK_USERS = [
  { iid: 18264204, uiid: 18264204, name: "Nguyễn Văn A", code: "HLS25100008", mail: "nva@gmail.com" },
  { iid: 30196679, uiid: 30196679, name: "Trần Thị B", code: "BTVDI0047", mail: "ttb@gmail.com" }
];

const $ = (id) => document.getElementById(id);

const fields = {
  parentId: $("parentId"),
  bulkUserCode: $("bulkUserCode"),
  apiBase: $("apiBase"),
  domain: $("domain"),
  orgIid: $("orgIid"),
  sandUid: $("sandUid"),
  sessionId: $("sessionId"),
  itemsPerPage: $("itemsPerPage"),
  recursiveScan: $("recursiveScan"),
  showRootFolder: $("showRootFolder"),
  demoMode: $("demoMode"),
  maxDepth: $("maxDepth"),
  status: $("status"),
  log: $("log"),
  itemsBody: $("itemsBody"),
  checkAll: $("checkAll"),
  expandAllBtn: $("expandAllBtn"),
  collapseAllBtn: $("collapseAllBtn"),
  loadBtn: $("loadBtn"),
  bulkAddBtn: $("bulkAddBtn"),
  bulkRemoveBtn: $("bulkRemoveBtn"),
  displayUid: $("displayUid"),
  displayToken: $("displayToken"),
  displaySavedDate: $("displaySavedDate")
};

fields.parentId.value = "684a38b2445a05ae9700eda5";

// Load credentials using shared module
if (typeof SharedAuth !== 'undefined') {
  SharedAuth.loadAuthData((authData) => {
    state.sandToken = authData.token || "";
    state.sandUiid = authData.uid || "";

    SharedAuth.displayAuthData(authData, {
      displayUid: fields.displayUid,
      displayToken: fields.displayToken,
      displaySavedDate: fields.displaySavedDate
    });
  });
}

fields.loadBtn.addEventListener("click", loadData);
fields.bulkAddBtn.addEventListener("click", () => handleBulkAction("add"));
fields.bulkRemoveBtn.addEventListener("click", () => handleBulkAction("remove"));
fields.checkAll.addEventListener("change", () => {
  const isChecked = fields.checkAll.checked;
  state.items.forEach((item) => {
    if (isChecked) {
      state.selectedIds.add(item.id);
    } else {
      state.selectedIds.delete(item.id);
    }
  });
  renderItems(state.items);
});
fields.expandAllBtn.addEventListener("click", () => {
  state.items.filter(isFolder).forEach((item) => state.expandedIds.add(item.id));
  renderItems(state.items);
});
fields.collapseAllBtn.addEventListener("click", () => {
  state.expandedIds.clear();
  renderItems(state.items);
});
fields.itemsBody.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-toggle-id]");
  if (toggle) {
    const id = toggle.dataset.toggleId;
    handleToggleFolder(id, toggle);
    return;
  }

  const checkbox = event.target.closest("[data-item-check]");
  if (checkbox) {
    handleCheckboxChange(checkbox);
    return;
  }

  const addBtn = event.target.closest(".inline-add-btn");
  if (addBtn) {
    const itemId = addBtn.dataset.itemId;
    const input = fields.itemsBody.querySelector(`.inline-add-input[data-item-id="${itemId}"]`);
    if (input) {
      const rolesContainer = fields.itemsBody.querySelector(`.inline-add-roles[data-item-id="${itemId}"]`);
      const checkedCheckboxes = Array.from(rolesContainer.querySelectorAll("input[data-role]:checked"));
      const selectedRoles = checkedCheckboxes.map(cb => cb.dataset.role);
      handleInlineAddUser(itemId, input.value.trim(), input, selectedRoles);
    }
    return;
  }

  const removeBtn = event.target.closest(".inline-remove-user");
  if (removeBtn) {
    const itemId = removeBtn.dataset.itemId;
    const userIid = Number(removeBtn.dataset.userIid);
    if (confirm("Bạn có chắc chắn muốn xóa user này khỏi item?")) {
      handleInlineRemoveUser(itemId, userIid);
    }
    return;
  }

  const updateBtn = event.target.closest(".inline-update-btn");
  if (updateBtn) {
    const itemId = updateBtn.dataset.itemId;
    const userIid = Number(updateBtn.dataset.userIid);
    handleInlineRoleChange(itemId, userIid, updateBtn);
    return;
  }
});

fields.itemsBody.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const input = event.target.closest(".inline-add-input");
    if (input) {
      event.preventDefault();
      const itemId = input.dataset.itemId;
      const rolesContainer = fields.itemsBody.querySelector(`.inline-add-roles[data-item-id="${itemId}"]`);
      const checkedCheckboxes = Array.from(rolesContainer.querySelectorAll("input[data-role]:checked"));
      const selectedRoles = checkedCheckboxes.map(cb => cb.dataset.role);
      handleInlineAddUser(itemId, input.value.trim(), input, selectedRoles);
    }
  }
});

function getConfig() {
  return {
    parentId: fields.parentId.value.trim(),
    sandToken: state.sandToken || "",
    sandUiid: state.sandUiid || "",
    bulkUserCode: fields.bulkUserCode.value.trim(),
    apiBase: fields.apiBase.value.trim().replace(/\/+$/, ""),
    domain: fields.domain.value.trim(),
    orgIid: fields.orgIid.value.trim(),
    sandUid: fields.sandUid.value.trim(),
    sessionId: fields.sessionId.value.trim(),
    itemsPerPage: Number(fields.itemsPerPage.value) || -1,
    recursiveScan: fields.recursiveScan.checked,
    showRootFolder: fields.showRootFolder.checked,
    demoMode: fields.demoMode.checked,
    maxDepth: Number(fields.maxDepth.value) || 100
  };
}

function parseCodes(value) {
  return value
    .split(/[\n,;]+/)
    .map((code) => code.trim())
    .filter(Boolean);
}

function getBulkRoles() {
  return Array.from(document.querySelectorAll("input[name='bulkRoles']:checked"))
    .map((input) => input.value);
}

function assertConfig(config, options = {}) {
  const requireCodes = options.requireCodes ?? true;
  const requireRoles = options.requireRoles ?? true;
  const missing = [];

  if (!config.demoMode) {
    if (!config.parentId) missing.push("Folder cha");
    if (!config.sandToken) missing.push("_sand_token");
    if (!config.sandUiid) missing.push("_sand_uiid");
  } else {
    if (!config.parentId) missing.push("Folder cha (Demo)");
  }

  if (requireCodes && !config.bulkUserCode) missing.push("Mã người dùng (hoặc IID)");
  if (requireRoles && !getBulkRoles().length) missing.push("Quyền");
  if (missing.length) {
    throw new Error(`Thiếu thông tin: ${missing.join(", ")}`);
  }
}

async function fetchItemDetail(config, itemId) {
  if (config.demoMode) {
    await new Promise(r => setTimeout(r, 200));
    return {
      id: itemId,
      name: "Thư mục root (Demo)",
      official_name: "Thư mục root (Demo)",
      type: "folder",
      stats: { child_count: 5 },
      sharing: { specific_sharing: [{ target: "user", roles: ["viewer"], user_iids: [18264204] }] }
    };
  }

  const params = new URLSearchParams({
    submit: "1",
    _sand_ajax: "1",
    _sand_platform: "3",
    _sand_readmin: "1",
    _sand_is_wan: "false",
    _sand_domain: config.domain,
    _sand_masked: "",
    _sand_session_id: config.sessionId,
    _sand_use_internal_network: "0",
    allow_cache_api_cdn: "1",
    lang: "vn",
    _sand_user_agent: navigator.userAgent,
    item_id: itemId
  });

  const form = baseForm(config, `https://${config.domain}.lotuslms.com/content/${itemId}`);
  const data = await post(`${config.apiBase}/content/api/item-detail?${params}`, form);
  if (!data.success || !data.result) {
    throw new Error(data.message || "Không thể tải thông tin thư mục gốc");
  }
  return data.result;
}

async function loadData() {
  const config = getConfig();
  try {
    assertConfig(config, { requireCodes: false, requireRoles: false });
    setBusy(true, "Đang tải...");
    clearLog();

    let allItems = [];
    let items = [];

    if (config.showRootFolder) {
      log("Đang tải thông tin thư mục gốc...");
      // 1. Fetch root folder first
      const rootFolder = await fetchItemDetail(config, config.parentId);
      rootFolder._level = 1;
      rootFolder._path = rootFolder.name || rootFolder.official_name || rootFolder.id;
      rootFolder.parent_id = "virtual_root";

      log(`Đã tải thông tin thư mục gốc: ${rootFolder._path}`);

      // 2. Fetch children/descendants starting from level 2
      log("Đang tải danh sách mục con...");
      items = config.recursiveScan 
        ? await searchContentTree(config, rootFolder._path, 2) 
        : await searchContent(config, config.parentId, rootFolder._path, 2);

      allItems = [rootFolder, ...items];
      state.rootId = "virtual_root";
    } else {
      // Traditional way: no root folder shown, children start at level 1, path is empty
      log("Đang tải danh sách mục con...");
      items = config.recursiveScan 
        ? await searchContentTree(config, "", 1) 
        : await searchContent(config, config.parentId, "", 1);

      allItems = items;
      state.rootId = config.parentId;
    }

    // 3. Resolve sharing users
    const sharedIids = getAllSharingUserIids(allItems);
    const sharedUsers = sharedIids.length ? await searchUsersByIids(config, sharedIids) : [];

    state.items = allItems;
    state.selectedIds.clear();
    
    // Auto-expand folders by default
    if (config.showRootFolder && allItems.length > 0) {
      state.expandedIds = new Set([allItems[0].id, ...items.filter(isFolder).map((item) => item.id)]);
    } else {
      state.expandedIds = new Set(allItems.filter(isFolder).map((item) => item.id));
    }
    state.sharedUsers = makeUserMap(sharedUsers);

    renderItems(state.items);

    fields.bulkAddBtn.disabled = !state.items.length;
    fields.bulkRemoveBtn.disabled = !state.items.length;

    log(`Đã tải ${items.length} mục con, ${sharedUsers.length} người dùng đang được chia sẻ.`);
    setStatus("Đã tải dữ liệu");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function searchContentTree(config, startPath = "", startLevel = 1) {
  const seen = new Set();
  const allItems = [];
  const queue = [{ parentId: config.parentId, path: startPath, level: startLevel }];

  while (queue.length) {
    const current = queue.shift();
    if (current.level > config.maxDepth) continue;

    log(`Đang quét cấp ${current.level - startLevel + 1}: ${current.path || config.parentId}`);
    const items = await searchContent(config, current.parentId, current.path, current.level);

    items.forEach((item) => {
      if (!item.id || seen.has(item.id)) return;
      seen.add(item.id);
      allItems.push(item);

      const hasChildren = Number(item.stats?.child_count || 0) > 0;
      if (item.type === "folder" && hasChildren && current.level < config.maxDepth) {
        queue.push({
          parentId: item.id,
          path: item._path,
          level: current.level + 1
        });
      }
    });
  }

  return allItems;
}

async function searchContent(config, parentId, parentPath, level) {
  if (config.demoMode) {
    await new Promise(r => setTimeout(r, 300));
    const children = MOCK_ITEMS.filter(item => item.parent_id === parentId);
    return children.map(item => ({
      ...item,
      _level: level,
      _path: parentPath ? `${parentPath} / ${item.name || item.official_name || item.id}` : (item.name || item.official_name || item.id)
    }));
  }

  const items = [];
  let page = 1;

  while (true) {
    const pageItems = await searchContentPage(config, parentId, parentPath, level, page);
    items.push(...pageItems);
    if (pageItems.length < config.itemsPerPage) break;
    page += 1;
  }

  return items;
}

async function searchContentPage(config, parentId, parentPath, level, page) {
  const params = new URLSearchParams({
    _sand_get_total: "0",
    parent_id: parentId,
    items_per_page: String(config.itemsPerPage),
    depth: "1",
    submit: "1",
    page: String(page),
    _sand_ajax: "1",
    _sand_platform: "3",
    _sand_readmin: "1",
    _sand_is_wan: "false",
    _sand_ga_sessionToken: "",
    _sand_ga_browserToken: "",
    _sand_domain: config.domain,
    _sand_masked: "",
    _sand_session_id: config.sessionId,
    _sand_use_internal_network: "0",
    allow_cache_api_cdn: "1",
    lang: "vn",
    _sand_user_agent: navigator.userAgent
  });

  const form = baseForm(config, `https://${config.domain}.lotuslms.com/admin/content-manager/folder/${parentId}`);
  const data = await post(`${config.apiBase}/content/api/search-content?${params}`, form);
  const result = Array.isArray(data.result) ? data.result : [];
  return result.map((item) => ({
    ...item,
    _level: level,
    _path: parentPath ? `${parentPath} / ${item.name || item.official_name || item.id}` : (item.name || item.official_name || item.id)
  }));
}

async function searchUsers(config) {
  if (config.demoMode) {
    await new Promise(r => setTimeout(r, 200));
    if (!config.codes.length) return [];
    const codesSet = new Set(config.codes.map(c => c.toLowerCase()));
    return MOCK_USERS.filter(u => codesSet.has(u.code.toLowerCase()));
  }

  const form = baseForm(config, `https://${config.domain}.lotuslms.com/admin/account`);
  form.append("_sand_get_total", "0");
  form.append("textOp", "$like");
  form.append("include_sub_organizations", "1");
  form.append("statuses[0]", "activated");
  if (config.orgIid) {
    form.append("user_organizations[0]", config.orgIid);
    form.append("orgIids[0]", config.orgIid);
  }
  form.append("ntype", "user");
  form.append("_sand_step", "students");
  ["user_organizations", "positions", "phongbans", "abac_roles"].forEach((value, index) => {
    form.append(`_sand_expand[${index}]`, value);
  });
  form.append("all_accounts", "1");
  form.append("filter_users_excluded_from_report", "false");
  form.append("codes", config.codes.join("\n"));
  form.append("submit", "1");
  form.append("page", "1");
  form.append("items_per_page", String(Math.max(config.codes.length, 10)));

  const data = await post(`${config.apiBase}/user/api/search`, form);
  return Array.isArray(data.result) ? data.result : [];
}

async function searchUsersByIids(config, iids) {
  if (config.demoMode) {
    const uniqueIids = Array.from(new Set(iids.map(Number).filter(Number.isFinite)));
    const iidsSet = new Set(uniqueIids);
    return MOCK_USERS.filter(u => iidsSet.has(Number(u.iid || u.uiid)));
  }

  const uniqueIids = Array.from(new Set(iids.map(Number).filter(Number.isFinite)));
  const users = [];

  for (let start = 0; start < uniqueIids.length; start += 50) {
    const chunk = uniqueIids.slice(start, start + 50);
    const params = new URLSearchParams({
      __current_field_name: "user_iids",
      _sand_step: "accounts",
      textOp: "$like",
      ntype: "user",
      include_sub_organizations: "1",
      _sand_get_total: "0",
      submit: "1",
      _sand_ajax: "1",
      _sand_platform: "3",
      _sand_readmin: "1",
      _sand_is_wan: "false",
      _sand_ga_sessionToken: "",
      _sand_ga_browserToken: "",
      _sand_domain: config.domain,
      _sand_masked: "",
      _sand_session_id: config.sessionId,
      _sand_use_internal_network: "0",
      allow_cache_api_cdn: "1",
      lang: "vn",
      _sand_user_agent: navigator.userAgent
    });

    params.append("statuses[]", "activated");
    chunk.forEach((iid) => {
      params.append("__current_field_value[]", String(iid));
      params.append("text[]", String(iid));
    });

    const form = baseForm(config, `https://${config.domain}.lotuslms.com/admin/content-manager/folder/${config.parentId}`);
    const data = await post(`${config.apiBase}/user/api/search?${params}`, form);
    if (Array.isArray(data.result)) users.push(...data.result);
  }

  return users;
}

async function handleBulkAction(mode) {
  const config = getConfig();
  const selectedItems = getSelectedItems();

  try {
    assertConfig(config, { requireCodes: true, requireRoles: mode === "add" });
    if (!selectedItems.length) throw new Error("Vui lòng chọn ít nhất 1 mục trong danh sách để phân quyền.");

    const rawCodes = parseCodes(config.bulkUserCode);
    if (!rawCodes.length) throw new Error("Vui lòng nhập Mã người dùng (hoặc IID) để phân quyền.");

    setBusy(true, mode === "add" ? "Đang thêm quyền..." : "Đang xóa quyền...");

    // Resolve users dynamically
    const resolvedUsers = [];
    const iidsToSearch = [];
    const codesToSearch = [];

    for (const code of rawCodes) {
      let found = null;
      if (/^\d+$/.test(code)) {
        const iidNum = Number(code);
        found = state.sharedUsers.get(String(iidNum)) || state.users.find(u => Number(u.iid || u.uiid) === iidNum);
        if (found) {
          resolvedUsers.push(found);
        } else {
          iidsToSearch.push(iidNum);
        }
      } else {
        found = Array.from(state.sharedUsers.values()).find(u => String(u.code).toLowerCase() === code.toLowerCase()) ||
          state.users.find(u => String(u.code).toLowerCase() === code.toLowerCase());
        if (found) {
          resolvedUsers.push(found);
        } else {
          codesToSearch.push(code);
        }
      }
    }

    if (iidsToSearch.length > 0) {
      log(`Đang tìm kiếm ${iidsToSearch.length} IID trên hệ thống...`);
      const found = await searchUsersByIids(config, iidsToSearch);
      resolvedUsers.push(...found);
      found.forEach(u => {
        const userIid = u.iid || u.uiid;
        if (userIid) state.sharedUsers.set(String(userIid), u);
      });
    }

    if (codesToSearch.length > 0) {
      log(`Đang tìm kiếm ${codesToSearch.length} mã người dùng trên hệ thống...`);
      const searchConfig = { ...config, codes: codesToSearch };
      const found = await searchUsers(searchConfig);
      resolvedUsers.push(...found);
      found.forEach(u => {
        const userIid = u.iid || u.uiid;
        if (userIid) state.sharedUsers.set(String(userIid), u);
      });
    }

    // Verify resolving
    const foundIdentifiers = new Set();
    resolvedUsers.forEach(u => {
      if (u.code) foundIdentifiers.add(u.code.toLowerCase());
      const iid = u.iid || u.uiid;
      if (iid) foundIdentifiers.add(String(iid));
    });
    const unresolved = rawCodes.filter(c => !foundIdentifiers.has(c.toLowerCase()));
    if (unresolved.length > 0) {
      throw new Error(`Không tìm thấy người dùng cho các mã/IID sau: ${unresolved.join(", ")}`);
    }

    const userIids = resolvedUsers.map((user) => Number(user.iid || user.uiid)).filter(Number.isFinite);
    if (!userIids.length) throw new Error("Không xác định được IID của người dùng.");

    const roles = mode === "add" ? getBulkRoles() : [];

    log(`${mode === "add" ? "Thêm" : "Xóa"} quyền cho ${selectedItems.length} mục chính.`);

    // Map of itemId -> sharing payload
    const updates = new Map();

    for (const item of selectedItems) {
      const sharing = updates.has(item.id)
        ? cloneSharing(updates.get(item.id))
        : cloneSharing(item.sharing);
      const nextSharing = mode === "add"
        ? addUsersToSharing(sharing, userIids, roles)
        : removeUsersFromSharing(sharing, userIids);

      updates.set(item.id, nextSharing);

      // Handle descendants to bypass parent overwrite logic
      if (isFolder(item)) {
        const descendants = getLoadedDescendants(item.id);
        for (const desc of descendants) {
          const descSharing = updates.has(desc.id)
            ? cloneSharing(updates.get(desc.id))
            : cloneSharing(desc.sharing);

          if (mode === "add") {
            // For each user, nextRoles = Union(originalRoles, parentRoles)
            userIids.forEach((userIid) => {
              let originalRoles = [];
              const existingEntry = desc.sharing?.specific_sharing?.find(
                (e) => e.target === "user" && e.user_iids?.map(Number).includes(userIid)
              );
              if (existingEntry) {
                originalRoles = existingEntry.roles || [];
              }
              const mergedRoles = Array.from(new Set([...originalRoles, ...roles]));
              changeUserRolesInSharing(descSharing, userIid, mergedRoles);
            });
          } else {
            // For "remove", if a user originally had direct permissions on this descendant,
            // we want to preserve them!
            userIids.forEach((userIid) => {
              let originalRoles = [];
              const existingEntry = desc.sharing?.specific_sharing?.find(
                (e) => e.target === "user" && e.user_iids?.map(Number).includes(userIid)
              );
              if (existingEntry) {
                originalRoles = existingEntry.roles || [];
                // Re-apply originalRoles so they are not wiped by parent removal propagation
                changeUserRolesInSharing(descSharing, userIid, originalRoles);
              }
            });
          }
          updates.set(desc.id, descSharing);
        }
      }
    }

    // Perform updates sequentially
    let count = 0;
    for (const [itemId, nextSharing] of updates) {
      const item = state.items.find(i => i.id === itemId);
      await shareItem(config, itemId, nextSharing);
      if (item) item.sharing = nextSharing;
      count += 1;
      log(`Đồng bộ thành công (${count}/${updates.size}): ${item ? (item.name || item.id) : itemId}`);
    }

    renderItems(state.items);
    setStatus("Hoàn tất");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function shareItem(config, itemId, sharing) {
  if (config.demoMode) {
    await new Promise(r => setTimeout(r, 100));
    return { success: true };
  }

  const form = baseForm(config, `https://${config.domain}.lotuslms.com/admin/content-manager/folder/my_drive`);
  appendSharing(form, sharing);
  form.append("id", itemId);
  form.append("submit", "1");

  return post(`${config.apiBase}/content/api/share-item`, form);
}

function baseForm(config, webUrl) {
  const form = new FormData();
  form.append("_sand_ajax", "1");
  form.append("_sand_platform", "3");
  form.append("_sand_readmin", "1");
  form.append("_sand_is_wan", "false");
  form.append("_sand_ga_sessionToken", "");
  form.append("_sand_ga_browserToken", "");
  form.append("_sand_domain", config.domain);
  form.append("_sand_masked", "");
  form.append("_sand_web_url", webUrl);
  form.append("_sand_device_uuid", crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  form.append("_sand_session_id", config.sessionId);
  form.append("_sand_use_internal_network", "0");
  form.append("allow_cache_api_cdn", "1");
  form.append("_sand_token", config.sandToken);
  form.append("_sand_uiid", config.sandUiid);
  if (config.sandUid) form.append("_sand_uid", config.sandUid);
  form.append("lang", "vn");
  form.append("_sand_user_agent", navigator.userAgent);
  return form;
}

async function post(url, form) {
  const response = await fetch(url, {
    method: "POST",
    body: form,
    headers: {
      accept: "application/json, text/plain, */*"
    }
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`API không trả JSON (${response.status}): ${text.slice(0, 240)}`);
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || data.error || `API lỗi ${response.status}`);
  }

  return data;
}

function cloneSharing(sharing = {}) {
  return {
    specific_sharing: Array.isArray(sharing.specific_sharing)
      ? sharing.specific_sharing.map((entry) => ({
        ...entry,
        roles: Array.isArray(entry.roles) ? [...entry.roles] : [],
        user_iids: Array.isArray(entry.user_iids) ? [...entry.user_iids] : [],
        org_iids: Array.isArray(entry.org_iids) ? [...entry.org_iids] : undefined
      }))
      : [],
    general_sharing_type: sharing.general_sharing_type || "restricted",
    general_sharing_roles: Array.isArray(sharing.general_sharing_roles) ? [...sharing.general_sharing_roles] : ["viewer"],
    general_sharing_download_allowed: Number(sharing.general_sharing_download_allowed || 0),
    general_sharing_required_user_info: Number(sharing.general_sharing_required_user_info || 0)
  };
}

function addUsersToSharing(sharing, userIids, roles) {
  const signature = roles.join("|");
  let entry = sharing.specific_sharing.find((item) => {
    const itemRoles = Array.isArray(item.roles) ? item.roles.join("|") : "";
    return item.target === "user" && itemRoles === signature && !item.org_iids?.length;
  });

  if (!entry) {
    entry = {
      target: "user",
      roles: [...roles],
      user_iids: [],
      include_sub_organizations: 1
    };
    sharing.specific_sharing.push(entry);
  }

  const set = new Set((entry.user_iids || []).map(Number));
  userIids.forEach((iid) => set.add(Number(iid)));
  entry.user_iids = Array.from(set);
  return sharing;
}

function removeUsersFromSharing(sharing, userIids) {
  const removeSet = new Set(userIids.map(Number));
  sharing.specific_sharing = sharing.specific_sharing
    .map((entry) => {
      if (entry.target !== "user" || !Array.isArray(entry.user_iids)) return entry;
      return {
        ...entry,
        user_iids: entry.user_iids.map(Number).filter((iid) => !removeSet.has(iid))
      };
    })
    .filter((entry) => entry.target !== "user" || !Array.isArray(entry.user_iids) || entry.user_iids.length > 0 || entry.org_iids?.length);
  return sharing;
}

function appendSharing(form, sharing) {
  sharing.specific_sharing.forEach((entry, index) => {
    form.append(`specific_sharing[${index}][target]`, entry.target || "user");
    (entry.roles || []).forEach((role, roleIndex) => {
      form.append(`specific_sharing[${index}][roles][${roleIndex}]`, role);
    });
    (entry.user_iids || []).forEach((iid, iidIndex) => {
      form.append(`specific_sharing[${index}][user_iids][${iidIndex}]`, String(iid));
    });
    (entry.org_iids || []).forEach((iid, iidIndex) => {
      form.append(`specific_sharing[${index}][org_iids][${iidIndex}]`, String(iid));
    });
    form.append(`specific_sharing[${index}][include_sub_organizations]`, String(entry.include_sub_organizations ?? 1));
  });
  form.append("general_sharing_type", sharing.general_sharing_type || "restricted");
  (sharing.general_sharing_roles || ["viewer"]).forEach((role, index) => {
    form.append(`general_sharing_roles[${index}]`, role);
  });
  form.append("general_sharing_download_allowed", String(sharing.general_sharing_download_allowed || 0));
  form.append("general_sharing_required_user_info", String(sharing.general_sharing_required_user_info || 0));
}

function getSelectedItems() {
  return state.items.filter((item) => state.selectedIds.has(item.id));
}

const SVG_FOLDER = `
  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.15" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
`;
const SVG_FOLDER_OPEN = `
  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.15" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-2-3H6z"></path>
    <path d="M3 6h18"></path>
  </svg>
`;
const SVG_FILE = `
  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.15" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
    <polyline points="13 2 13 9 20 9"></polyline>
  </svg>
`;
const SVG_BANK = `
  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.15" stroke-linecap="round" stroke-linejoin="round">
    <line x1="3" y1="22" x2="21" y2="22"></line>
    <line x1="6" y1="18" x2="6" y2="11"></line>
    <line x1="10" y1="18" x2="10" y2="11"></line>
    <line x1="14" y1="18" x2="14" y2="11"></line>
    <line x1="18" y1="18" x2="18" y2="11"></line>
    <polygon points="12 2 2 7 22 7 12 2"></polygon>
  </svg>
`;

function renderItems(items) {
  if (!items.length) {
    fields.itemsBody.innerHTML = '<tr><td colspan="5" class="empty">Không có item con</td></tr>';
    return;
  }

  const tree = buildTreeRows(items);
  const indeterminateSet = new Set();

  // Update state.selectedIds recursively for items whose children are all checked
  // and find which ones should be indeterminate
  tree.forEach((item) => {
    if (isFolder(item)) {
      const descendants = getLoadedDescendants(item.id);
      if (descendants.length > 0) {
        const checkedDescendants = descendants.filter(d => state.selectedIds.has(d.id));
        if (checkedDescendants.length > 0 && checkedDescendants.length < descendants.length) {
          indeterminateSet.add(item.id);
          state.selectedIds.delete(item.id); // Parent cannot be selected if only partially checked
        } else if (checkedDescendants.length === descendants.length) {
          state.selectedIds.add(item.id);
        } else if (checkedDescendants.length === 0) {
          state.selectedIds.delete(item.id);
        }
      }
    }
  });

  fields.itemsBody.innerHTML = tree.map((item) => {
    const users = getSharingEntries(item.sharing);
    const folder = isFolder(item);
    const childCount = Number(item.stats?.child_count || 0);
    const hasChildren = item._children?.length > 0 || childCount > 0;
    const expanded = state.expandedIds.has(item.id);

    // Indent HTML lines
    const level = Number(item._level || 1);
    let indentHtml = "";
    for (let i = 1; i < level; i++) {
      indentHtml += `<span class="treeLine"></span>`;
    }

    const toggle = folder && hasChildren
      ? `<button class="treeToggle ${expanded ? "expanded" : ""}" type="button" data-toggle-id="${escapeHtml(item.id)}">
           <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="9 18 15 12 9 6"></polyline>
           </svg>
         </button>`
      : `<span class="treeSpacer"></span>`;

    const isQuestionBank = item.target_item_type === "question_bank";
    const iconClass = isQuestionBank ? "bank" : (folder ? "folder" : "file");
    const iconSvg = isQuestionBank ? SVG_BANK : (folder ? (expanded ? SVG_FOLDER_OPEN : SVG_FOLDER) : SVG_FILE);
    const iconHtml = `<span class="treeIcon ${iconClass}">${iconSvg}</span>`;

    const isChecked = state.selectedIds.has(item.id);
    const isIndeterminate = indeterminateSet.has(item.id);

    return `
      <tr class="${folder ? "row-folder" : "row-file"}" data-level="${level}">
        <td>
          <input data-item-check type="checkbox" value="${escapeHtml(item.id)}" 
                 ${isChecked ? "checked" : ""} 
                 ${isIndeterminate ? "data-indeterminate='true'" : ""}>
        </td>
        <td>
          <div class="treeCell">
            ${indentHtml}
            ${toggle}
            ${iconHtml}
            <span><strong>${escapeHtml(item.name || item.official_name || "(không tên)")}</strong>${item.target_item_type === "question_bank" ? ` <span style="color: var(--primary); font-weight: 600; font-size: 12px; margin-left: 6px;">(Iid: ${escapeHtml(item.target_item_iid)})</span>` : ""}<br><small>${escapeHtml(item.id)}</small></span>
          </div>
        </td>
        <td>${escapeHtml(item._path || "")}</td>
        <td>${escapeHtml(item.type || "")}</td>
        <td>
          <div class="inline-users-wrapper">
            ${users.length ? users.map((u) => renderSharedUser(u, item.id)).join("") : "<span class='empty'>Chưa có user_iids</span>"}
            <div class="inline-add-user">
              <div class="inline-add-input-row">
                <input type="text" placeholder="Nhập code/IID..." class="inline-add-input" data-item-id="${escapeHtml(item.id)}">
                <button type="button" class="inline-add-btn" data-item-id="${escapeHtml(item.id)}">Cập nhật</button>
              </div>
              <div class="inline-roles-container inline-add-roles" data-item-id="${escapeHtml(item.id)}">
                ${ALL_ROLES.map(role => {
                  const isChecked = ["viewer", "copy_editor"].includes(role.value);
                  return `
                    <label class="inline-role">
                      <input type="checkbox" data-role="${role.value}" ${isChecked ? "checked" : ""}>
                      ${role.label}
                    </label>
                  `;
                }).join("")}
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Post-render: Apply indeterminate state to checkbox elements
  document.querySelectorAll("[data-indeterminate='true']").forEach((checkbox) => {
    checkbox.indeterminate = true;
  });

  updateCheckAllState();
}

function getLoadedDescendants(parentId) {
  const descendants = [];
  const queue = [parentId];
  const byParent = new Map();
  state.items.forEach((item) => {
    const pId = item.parent_id || state.rootId;
    if (!byParent.has(pId)) byParent.set(pId, []);
    byParent.get(pId).push(item);
  });

  while (queue.length) {
    const currentId = queue.shift();
    const children = byParent.get(currentId) || [];
    children.forEach((child) => {
      descendants.push(child);
      queue.push(child.id);
    });
  }
  return descendants;
}

async function handleToggleFolder(id, toggleElement) {
  if (state.expandedIds.has(id)) {
    state.expandedIds.delete(id);
    renderItems(state.items);
    return;
  }

  // Check if we already loaded children
  const hasLoadedChildren = state.items.some((item) => item.parent_id === id);
  const folderItem = state.items.find((item) => item.id === id);
  const childCount = Number(folderItem?.stats?.child_count || 0);

  if (hasLoadedChildren || childCount === 0) {
    state.expandedIds.add(id);
    renderItems(state.items);
    return;
  }

  // Load from API/Mock
  toggleElement.classList.add("loading");
  const originalSvg = toggleElement.innerHTML;
  toggleElement.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="treeToggle loading">
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </svg>
  `;

  try {
    const config = getConfig();
    const currentLevel = folderItem ? Number(folderItem._level || 1) : 1;
    const currentPath = folderItem ? folderItem._path : "";
    log(`Đang tải item con cho: ${folderItem?.name || id}`);

    const children = await searchContent(config, id, currentPath, currentLevel + 1);

    const existingIds = new Set(state.items.map((item) => item.id));
    const newItems = children.filter((item) => !existingIds.has(item.id));

    // Check if we need to resolve shared users for new items
    const sharedIids = getAllSharingUserIids(newItems);
    const missingIids = sharedIids.filter((iid) => !state.sharedUsers.has(String(iid)));
    if (missingIids.length) {
      log(`Đang lấy thông tin cho ${missingIids.length} user có quyền...`);
      const newSharedUsers = await searchUsersByIids(config, missingIids);
      newSharedUsers.forEach((user) => {
        const userIid = user.iid || user.uiid;
        if (userIid) state.sharedUsers.set(String(userIid), user);
      });
    }

    state.items.push(...newItems);
    state.expandedIds.add(id);
    log(`Đã tải ${newItems.length} item con cho folder: ${folderItem?.name || id}`);

    // Also, if the parent was checked, cascade-check the children
    if (state.selectedIds.has(id)) {
      newItems.forEach((item) => state.selectedIds.add(item.id));
    }

    renderItems(state.items);
  } catch (error) {
    showError(error);
    // Reset toggle HTML
    toggleElement.innerHTML = originalSvg;
    toggleElement.classList.remove("loading");
  }
}

function handleCheckboxChange(checkbox) {
  const itemId = checkbox.value;
  const isChecked = checkbox.checked;

  if (isChecked) {
    state.selectedIds.add(itemId);
  } else {
    state.selectedIds.delete(itemId);
  }

  // Cascade to loaded descendants
  const descendants = getLoadedDescendants(itemId);
  descendants.forEach((desc) => {
    if (isChecked) {
      state.selectedIds.add(desc.id);
    } else {
      state.selectedIds.delete(desc.id);
    }
  });

  renderItems(state.items);
}

function buildTreeRows(items) {
  const byParent = new Map();
  const byId = new Map();
  items.forEach((item) => {
    item._children = [];
    byId.set(item.id, item);
    const parentId = item.parent_id || state.rootId;
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(item);
  });

  items.forEach((item) => {
    item._children = byParent.get(item.id) || [];
  });

  const rows = [];
  const visit = (parentId, fallbackLevel = 1) => {
    const children = byParent.get(parentId) || [];
    children.forEach((item) => {
      item._level = item._level || fallbackLevel;
      rows.push(item);
      if (state.expandedIds.has(item.id)) {
        visit(item.id, Number(item._level || fallbackLevel) + 1);
      }
    });
  };

  visit(state.rootId, 1);

  items.forEach((item) => {
    if (!rows.includes(item) && !byId.has(item.parent_id)) rows.push(item);
  });

  return rows;
}

function isFolder(item) {
  return item?.type === "folder";
}

function updateCheckAllState() {
  const visibleChecks = Array.from(document.querySelectorAll("[data-item-check]"));
  const checkedCount = visibleChecks.filter((checkbox) => checkbox.checked).length;
  fields.checkAll.checked = visibleChecks.length > 0 && checkedCount === visibleChecks.length;
  fields.checkAll.indeterminate = checkedCount > 0 && checkedCount < visibleChecks.length;
}

function getSharingUserIids(sharing = {}) {
  const set = new Set();
  (sharing.specific_sharing || []).forEach((entry) => {
    (entry.user_iids || []).forEach((iid) => set.add(String(iid)));
  });
  return Array.from(set);
}

function getAllSharingUserIids(items) {
  const set = new Set();
  items.forEach((item) => {
    getSharingUserIids(item.sharing).forEach((iid) => set.add(iid));
  });
  return Array.from(set);
}

function getSharingEntries(sharing = {}) {
  const entries = [];
  (sharing.specific_sharing || []).forEach((entry) => {
    if (!Array.isArray(entry.user_iids)) return;
    entry.user_iids.forEach((iid) => {
      entries.push({
        iid: String(iid),
        roles: Array.isArray(entry.roles) ? entry.roles : []
      });
    });
  });
  return entries;
}

function renderSharedUser(entry, itemId) {
  const user = state.sharedUsers.get(String(entry.iid));
  const title = user ? (user.name || user.fullname || user.mail || user.code || entry.iid) : entry.iid;
  const detail = user
    ? `${user.code || user.mail || ""}${user.code && user.mail ? " | " : ""}${user.mail || ""}`
    : "Chưa resolve được thông tin user";

  const rolesHtml = ALL_ROLES.map(role => {
    const isChecked = entry.roles.includes(role.value);
    return `
      <label class="inline-role">
        <input type="checkbox" data-role="${role.value}" data-user-iid="${entry.iid}" data-item-id="${itemId}" ${isChecked ? "checked" : ""}>
        ${role.label}
      </label>
    `;
  }).join("");

  return `
    <div class="sharedUser">
      <div class="sharedUserHeader">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <small>iid: ${escapeHtml(entry.iid)} ${detail ? `| ${escapeHtml(detail)}` : ""}</small>
        </div>
        <div class="sharedUserActions">
          <button type="button" class="inline-update-btn primary-mini-btn" data-user-iid="${entry.iid}" data-item-id="${itemId}" title="Cập nhật quyền">Cập nhật</button>
          <button type="button" class="inline-remove-user" data-user-iid="${entry.iid}" data-item-id="${itemId}" title="Xóa user khỏi item">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="inline-roles-container">
        ${rolesHtml}
      </div>
    </div>
  `;
}

function changeUserRolesInSharing(sharing, userIid, nextRoles) {
  // 1. Remove userIid from all user entries in specific_sharing
  if (Array.isArray(sharing.specific_sharing)) {
    sharing.specific_sharing.forEach(entry => {
      if (entry.target === "user" && Array.isArray(entry.user_iids)) {
        entry.user_iids = entry.user_iids.map(Number).filter(iid => iid !== userIid);
      }
    });
  } else {
    sharing.specific_sharing = [];
  }

  // 2. If nextRoles is not empty, find an entry with exactly these roles, or create one
  if (nextRoles.length > 0) {
    const signature = [...nextRoles].sort().join("|");
    let targetEntry = sharing.specific_sharing.find(entry => {
      const entryRolesSig = Array.isArray(entry.roles) ? [...entry.roles].sort().join("|") : "";
      return entry.target === "user" && entryRolesSig === signature && !entry.org_iids?.length;
    });

    if (!targetEntry) {
      targetEntry = {
        target: "user",
        roles: [...nextRoles],
        user_iids: [],
        include_sub_organizations: 1
      };
      sharing.specific_sharing.push(targetEntry);
    }
    targetEntry.user_iids.push(userIid);
  }

  // 3. Clean up specific_sharing to remove empty entries
  sharing.specific_sharing = sharing.specific_sharing.filter(entry => {
    if (entry.target === "user" && Array.isArray(entry.user_iids)) {
      return entry.user_iids.length > 0 || entry.org_iids?.length > 0;
    }
    return true;
  });

  return sharing;
}

async function handleInlineRoleChange(itemId, userIid, buttonElement) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const container = buttonElement.closest(".sharedUser");
  if (!container) return;

  const checkedCheckboxes = Array.from(container.querySelectorAll("input[data-role]:checked"));
  const nextRoles = checkedCheckboxes.map(cb => cb.dataset.role);

  const config = getConfig();
  try {
    assertConfig(config, { requireCodes: false });
    setBusy(true, "Đang cập nhật quyền...");

    const updates = new Map();

    // 1. Calculate parent sharing
    const sharing = cloneSharing(item.sharing);
    changeUserRolesInSharing(sharing, userIid, nextRoles);
    updates.set(item.id, sharing);

    // 2. Handle descendants to bypass server overwrite
    if (isFolder(item)) {
      const descendants = getLoadedDescendants(item.id);
      for (const desc of descendants) {
        const descSharing = updates.has(desc.id)
          ? cloneSharing(updates.get(desc.id))
          : cloneSharing(desc.sharing);
        
        let originalRoles = [];
        const existingDescEntry = desc.sharing?.specific_sharing?.find(
          e => e.target === "user" && e.user_iids?.map(Number).includes(userIid)
        );
        if (existingDescEntry) {
          originalRoles = existingDescEntry.roles || [];
        }

        // Additive: Union of originalRoles and nextRoles
        const mergedRoles = Array.from(new Set([...originalRoles, ...nextRoles]));
        changeUserRolesInSharing(descSharing, userIid, mergedRoles);
        updates.set(desc.id, descSharing);
      }
    }

    // 3. Save updates
    let count = 0;
    for (const [targetId, targetSharing] of updates) {
      const targetItem = state.items.find(i => i.id === targetId);
      await shareItem(config, targetId, targetSharing);
      if (targetItem) targetItem.sharing = targetSharing;
      count += 1;
      log(`Đồng bộ thành công (${count}/${updates.size}): ${targetItem ? (targetItem.name || targetItem.id) : targetId}`);
    }

    renderItems(state.items);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function handleInlineRemoveUser(itemId, userIid) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const config = getConfig();
  try {
    assertConfig(config, { requireCodes: false });
    setBusy(true, "Đang xóa quyền...");

    const updates = new Map();

    // 1. Parent sharing
    const sharing = cloneSharing(item.sharing);
    changeUserRolesInSharing(sharing, userIid, []);
    updates.set(item.id, sharing);

    // 2. Descendants
    if (isFolder(item)) {
      const descendants = getLoadedDescendants(item.id);
      for (const desc of descendants) {
        const descSharing = cloneSharing(desc.sharing);
        let originalRoles = [];
        const existingDescEntry = desc.sharing?.specific_sharing?.find(
          e => e.target === "user" && e.user_iids?.map(Number).includes(userIid)
        );
        if (existingDescEntry) {
          originalRoles = existingDescEntry.roles || [];
          // Re-apply originalRoles so they are not wiped by parent removal propagation
          changeUserRolesInSharing(descSharing, userIid, originalRoles);
          updates.set(desc.id, descSharing);
        }
      }
    }

    // 3. Save updates
    let count = 0;
    for (const [targetId, targetSharing] of updates) {
      const targetItem = state.items.find(i => i.id === targetId);
      await shareItem(config, targetId, targetSharing);
      if (targetItem) targetItem.sharing = targetSharing;
      count += 1;
      log(`Đồng bộ thành công (${count}/${updates.size}): ${targetItem ? (targetItem.name || targetItem.id) : targetId}`);
    }

    renderItems(state.items);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function handleInlineAddUser(itemId, query, inputElement, selectedRoles) {
  if (!query) return;
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const config = getConfig();
  try {
    assertConfig(config, { requireCodes: false });
    if (!selectedRoles || selectedRoles.length === 0) {
      throw new Error("Vui lòng chọn ít nhất 1 quyền cho người dùng mới.");
    }
    setBusy(true, "Đang tìm user...");

    let user = null;

    // Check if it is numeric iid first
    if (/^\d+$/.test(query)) {
      const iid = Number(query);
      const existing = state.sharedUsers.get(String(iid)) || state.users.find(u => Number(u.iid || u.uiid) === iid);
      if (existing) {
        user = existing;
      } else {
        log(`Tìm user theo IID: ${iid}...`);
        const found = await searchUsersByIids(config, [iid]);
        if (found.length) user = found[0];
      }
    } else {
      // Search by user code
      const existing = Array.from(state.sharedUsers.values()).find(u => String(u.code).toLowerCase() === query.toLowerCase()) ||
        state.users.find(u => String(u.code).toLowerCase() === query.toLowerCase());
      if (existing) {
        user = existing;
      } else {
        log(`Tìm user theo code: ${query}...`);
        const origCodes = config.codes;
        config.codes = [query];
        const found = await searchUsers(config);
        config.codes = origCodes; // restore
        if (found.length) user = found[0];
      }
    }

    if (!user) {
      throw new Error(`Không tìm thấy user nào khớp với: ${query}`);
    }

    const userIid = Number(user.iid || user.uiid);
    if (!userIid) {
      throw new Error("Không xác định được IID của user.");
    }

    // Add user to state.sharedUsers
    state.sharedUsers.set(String(userIid), user);

    const updates = new Map();
    const defaultRoles = selectedRoles; // roles for added user

    // 1. Parent sharing
    const sharing = cloneSharing(item.sharing);
    changeUserRolesInSharing(sharing, userIid, defaultRoles);
    updates.set(item.id, sharing);

    // 2. Descendants (additive merge)
    if (isFolder(item)) {
      const descendants = getLoadedDescendants(item.id);
      for (const desc of descendants) {
        const descSharing = cloneSharing(desc.sharing);
        let originalRoles = [];
        const existingDescEntry = desc.sharing?.specific_sharing?.find(
          e => e.target === "user" && e.user_iids?.map(Number).includes(userIid)
        );
        if (existingDescEntry) {
          originalRoles = existingDescEntry.roles || [];
        }
        const mergedRoles = Array.from(new Set([...originalRoles, ...defaultRoles]));
        changeUserRolesInSharing(descSharing, userIid, mergedRoles);
        updates.set(desc.id, descSharing);
      }
    }

    // 3. Save updates
    let count = 0;
    for (const [targetId, targetSharing] of updates) {
      const targetItem = state.items.find(i => i.id === targetId);
      log(`Đang gán quyền cho user: ${user.name || user.code} (IID: ${userIid}) ở mục: ${targetItem ? (targetItem.name || targetId) : targetId}...`);
      await shareItem(config, targetId, targetSharing);
      if (targetItem) targetItem.sharing = targetSharing;
      count += 1;
    }

    log(`Đã thêm user thành công.`);
    inputElement.value = ""; // clear input
    renderItems(state.items);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

function makeUserMap(users) {
  const map = new Map();
  users.forEach((user) => {
    const iid = user.iid || user.uiid;
    if (iid) map.set(String(iid), user);
  });
  return map;
}

function setBusy(isBusy, text) {
  fields.loadBtn.disabled = isBusy;
  if (fields.bulkAddBtn && fields.bulkRemoveBtn) {
    fields.bulkAddBtn.disabled = isBusy || !state.items.length;
    fields.bulkRemoveBtn.disabled = isBusy || !state.items.length;
  }
  if (text) setStatus(text);
}

function setStatus(text) {
  fields.status.textContent = text;
}

function log(message) {
  const time = new Date().toLocaleTimeString("vi-VN");
  fields.log.textContent += `[${time}] ${message}\n`;
  fields.log.scrollTop = fields.log.scrollHeight;
}

function clearLog() {
  fields.log.textContent = "";
}

function showError(error) {
  console.error(error);
  setStatus("Có lỗi");
  log(`LỖI: ${error.message}`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
