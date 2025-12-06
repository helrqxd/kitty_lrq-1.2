
let ACCOUNT_STRUCTURE = {
    普通账户: {
        isAsset: true,
        types: [
            { name: '现金', iconUrl: 'https://i.postimg.cc/Vs99GyjW/现金钞票.png' },
            { name: '储蓄卡', iconUrl: 'https://i.postimg.cc/G3PP70kJ/储蓄卡.png' },
            {
                name: '微信钱包',
                iconUrl: 'https://i.postimg.cc/FFbbWtjb/微信钱包.png',
            },
            {
                name: '支付宝',
                iconUrl: 'https://i.postimg.cc/2jddcp4Q/支付宝.png',
            },
            { name: '其他', iconUrl: 'https://i.postimg.cc/MZ00Pkyy/报销_已选中.png' },
        ],
    },
    信用账户: {
        isAsset: false,
        types: [
            {
                name: '信用卡',
                iconUrl: 'https://i.postimg.cc/nVKKR8vq/信用卡.png',
            },
            {
                name: '花呗',
                iconUrl: 'https://i.postimg.cc/kMNN1rxS/花呗.png',
            },
            {
                name: '白条',
                iconUrl: 'https://i.postimg.cc/wx55fKhm/京东_白条.png',
            },
            {
                name: '其他',
                iconUrl: 'https://i.postimg.cc/2jddcp4B/7.png',
            },
        ],
    },
    投资理财: {
        isAsset: true,
        types: [
            {
                name: '股票',
                iconUrl: 'https://i.postimg.cc/sfPP6FpB/股票分析.pngg',
            },
            {
                name: '基金',
                iconUrl: 'https://i.postimg.cc/44vvLCz7/基金点击.png',
            },
            { name: '其他', iconUrl: 'https://i.postimg.cc/wx55fKh1/投资.png' },
        ],
    },
    充值账户: {
        isAsset: true,
        types: [
            {
                name: '饭卡',
                iconUrl: 'https://i.postimg.cc/gcyyS9vn/饭卡2.png',
            },
            {
                name: '公交卡',
                iconUrl: 'https://i.postimg.cc/G3PP70k9/公交卡.png',
            },
            {
                name: '其他',
                iconUrl: 'https://i.postimg.cc/05GGWgpj/补卡.png',
            },
        ],
    },
    其他账户: {
        isAsset: null,
        types: [
            {
                name: '借入',
                iconUrl: 'https://i.postimg.cc/7P11svgL/借入.png',
            },
            {
                name: '借出',
                iconUrl: 'https://i.postimg.cc/dQRRHM8s/借出登记.png',
            },
        ],
    },
};


let ACCOUNTING_CATEGORIES = {
    expense: [
        { name: '餐饮', icon: 'https://s3plus.meituan.net/opapisdk/op_ticket_1_5673241091_1763966898357_qdqqd_q6gypk.png' },
        { name: '购物', icon: 'https://static.eeo.cn/upload/images/20251124/286655c4437163e96279.png' },
        { name: '交通', icon: 'https://static.eeo.cn/upload/images/20251124/83e440191818e2208623.png' },
        {
            name: '娱乐',
            icon: 'https://zkaicc.huilan.com/aicc/api/aicc-file/miniofile/preViewPicture/aicc/qdqqd_1763967070965.png',
        },
        { name: '住房', icon: 'https://yfupload.hebccw.cn/images/08zygs/wqbs/2025/11/24/1763967177_wqbs.png' },
        {
            name: '医疗',
            icon: 'https://xiaoiwg.dongfeng-nissan.com.cn/aicc-workbench/res/download/default/temp/images/20251124/21f586446548ec0b99bdd1e7c08adec359069046.png',
        },
        { name: '其他', icon: 'https://image.uglycat.cc/yfneo8.png' },
    ],
    income: [
        { name: '工资', icon: 'https://image.uglycat.cc/abn2a9.png' },
        { name: '红包', icon: 'https://image.uglycat.cc/k4zlkz.png' },
        {
            name: '理财',
            icon: 'https://xiaoiwg.dongfeng-nissan.com.cn/aicc-workbench/res/download/default/temp/images/20251124/bb17bb33337885d0a579889b1cb8499d37a15de9.png',
        },
        { name: '其他', icon: 'https://image.uglycat.cc/3la2dz.png' },
    ],
};

/**
 * 切换“兔k记账”App内部的页面视图
 * @param {string} viewId - 要显示的目标视图的ID
 */
function switchTukeyView(viewId) {
    // 隐藏所有视图
    document.querySelectorAll('.tukey-view').forEach(view => {
        view.style.display = 'none';
    });

    // 显示目标视图
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
    }

    // 更新底部导航栏高亮状态
    document.querySelectorAll('#tukey-bottom-nav .tukey-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewId);
    });

    // 根据视图ID更新头部标题
    const headerTitle = document.getElementById('tukey-header-title');
    const navItem = document.querySelector(`.tukey-nav-item[data-view="${viewId}"]`);
    if (headerTitle && navItem) {
        headerTitle.textContent = navItem.querySelector('span').textContent;
    }

    if (viewId === 'tukey-reports-view') {
        renderTukeyReportsView(); // 调用我们即将创建的主渲染函数
    }

}
/* --- 兔k记账-用户设置功能核心函数 --- */
let tukeyUserSettings = {
    // 全局变量，用于缓存用户设置
    id: 'main_user',
    avatar: 'https://i.postimg.cc/PxZrFFFL/o-o-1.jpg',
    username: '我',
    profession: '',
    syncWithTaobao: false,
};

/**
 * 加载兔k记账的用户设置并渲染到设置页面
 */
async function loadAndRenderTukeyUserSettings() {
    const settings = await db.tukeyUserSettings.get('main_user');
    if (settings) {
        tukeyUserSettings = settings;
    }

    // 填充UI
    document.getElementById('tukey-user-avatar-preview').src = tukeyUserSettings.avatar;
    document.getElementById('tukey-user-name-input').value = tukeyUserSettings.username;
    document.getElementById('tukey-user-profession-input').value = tukeyUserSettings.profession || '';
    document.getElementById('sync-to-taobao-toggle').checked = tukeyUserSettings.syncWithTaobao || false;
}

/**
 * 保存兔k记账的用户设置
 */
async function saveTukeyUserSettings() {
    tukeyUserSettings.avatar = document.getElementById('tukey-user-avatar-preview').src;
    tukeyUserSettings.username = document.getElementById('tukey-user-name-input').value.trim() || '我';
    tukeyUserSettings.profession = document.getElementById('tukey-user-profession-input').value.trim();
    tukeyUserSettings.syncWithTaobao = document.getElementById('sync-to-taobao-toggle').checked;

    await db.tukeyUserSettings.put(tukeyUserSettings);
    alert('记账设置已保存！');
}

// 兔k记账 - 自定义配置核心函数

/**
 * 加载自定义配置并合并到全局变量中
 */
async function loadTukeyCustomConfig() {
    try {
        const config = await db.tukeyCustomConfig.get('main');
        if (config) {
            // 1. 合并自定义收支分类
            if (config.customCategories) {
                // 我们将自定义的追加到默认列表后面，或者完全覆盖（这里选择追加去重，或者简单替换）
                // 为了简单起见，我们假设 config 里存的是“最新的完整列表”
                // 如果你想保留默认项不可删除，可以做合并逻辑。这里我们假设用户配置是最终结果。
                // 但为了防止第一次覆盖掉默认值，我们在保存时会保存完整列表。
                ACCOUNTING_CATEGORIES = config.customCategories;
            }

            // 2. 合并自定义账户结构
            if (config.customAccountStructure) {
                ACCOUNT_STRUCTURE = config.customAccountStructure;
            }
        }
    } catch (e) {
        console.error('加载兔k记账自定义配置失败:', e);
    }
}

/**
 * 保存当前的全局配置到数据库
 */
async function saveTukeyCustomConfig() {
    await db.tukeyCustomConfig.put({
        id: 'main',
        customCategories: ACCOUNTING_CATEGORIES,
        customAccountStructure: ACCOUNT_STRUCTURE,
    });
    // console.log("自定义配置已保存");
}

/**
 * 处理添加自定义收支分类
 * @param {string} type - 'expense' (支出) 或 'income' (收入)
 */
async function handleAddCustomCategory(type) {
    const typeName = type === 'expense' ? '支出' : '收入';

    // 1. 输入名称
    const name = await showCustomPrompt(`添加${typeName}分类`, '请输入分类名称 (例如: 奶茶, 游戏)');
    if (!name || !name.trim()) return;

    // 2. 选择图标来源
    const choice = await showChoiceModal('选择图标', [
        { text: '📁 从本地上传', value: 'local' },
        { text: '🌐 使用网络URL', value: 'url' },
        { text: '🎲 使用默认图标', value: 'default' },
    ]);

    if (!choice) return;

    let iconUrl = '';

    if (choice === 'local') {
        iconUrl = await uploadImageLocally();
    } else if (choice === 'url') {
        iconUrl = await showCustomPrompt('图标URL', '请输入图片链接', '', 'url');
    } else {
        // 默认图标
        iconUrl = 'https://i.postimg.cc/y88P16yW/default-icon.png';
    }

    if (!iconUrl) {
        alert('图标无效，添加取消。');
        return;
    }

    // 3. 更新数据
    const newCategory = { name: name.trim(), icon: iconUrl };
    ACCOUNTING_CATEGORIES[type].push(newCategory);

    // 4. 保存并刷新
    await saveTukeyCustomConfig();

    // 重新渲染分类列表 (如果在记账弹窗中)
    const card = document.getElementById('tukey-record-input-card');
    if (card.classList.contains('visible')) {
        // 只有当前是在对应类型的标签页下才刷新
        const activeBtn = card.querySelector('.type-selector .type-btn.active');
        if (activeBtn && activeBtn.dataset.type === type) {
            renderRecordCategories(type); // 重新渲染分类网格
        }
    }

    alert(`分类 "${newCategory.name}" 添加成功！`);
}

/**
 * 处理添加自定义账户类型
 * @param {string} categoryName - 账户大类名称 (例如 "普通账户", "信用账户")
 */
async function handleAddCustomAccountType(categoryName) {
    // 1. 输入名称
    const name = await showCustomPrompt(`添加${categoryName}类型`, '请输入类型名称 (例如: 招商银行, 京东金条)');
    if (!name || !name.trim()) return;

    // 2. 选择图标
    const choice = await showChoiceModal('选择图标', [
        { text: '📁 从本地上传', value: 'local' },
        { text: '🌐 使用网络URL', value: 'url' },
        { text: '🎲 使用默认图标', value: 'default' },
    ]);

    if (!choice) return;

    let iconUrl = '';
    if (choice === 'local') {
        iconUrl = await uploadImageLocally();
    } else if (choice === 'url') {
        iconUrl = await showCustomPrompt('图标URL', '请输入图片链接', '', 'url');
    } else {
        iconUrl = 'https://i.postimg.cc/y88P16yW/default-icon.png';
    }

    if (!iconUrl) return;

    // 3. 更新数据
    if (ACCOUNT_STRUCTURE[categoryName]) {
        ACCOUNT_STRUCTURE[categoryName].types.push({
            name: name.trim(),
            iconUrl: iconUrl,
        });

        // 4. 保存并刷新
        await saveTukeyCustomConfig();
        openAccountTypeSelector(); // 重新渲染类型选择界面
        alert(`账户类型 "${name.trim()}" 添加成功！`);
    }
}

/**
 * 渲染记账弹窗中的分类网格（带添加按钮）
 * 替换掉 switchRecordType 中的简单 innerHTML 生成逻辑
 */
function renderRecordCategories(type) {
    const card = document.getElementById('tukey-record-input-card');
    const grid = card.querySelector('.category-grid');
    grid.innerHTML = '';

    // 渲染现有分类
    ACCOUNTING_CATEGORIES[type].forEach(cat => {
        grid.innerHTML += `
        <div class="tukey-category-item" data-type="${type}" data-category="${cat.name}">
            <img src="${cat.icon}" alt="${cat.name}">
            <span>${cat.name}</span>
        </div>
    `;
    });

    // ★★★ 添加“自定义”按钮 ★★★
    const addBtn = document.createElement('div');
    addBtn.className = 'tukey-category-item add-custom-btn';
    addBtn.innerHTML = `
      <div style="width:40px; height:40px; border-radius:50%; background:#f0f2f5; display:flex; align-items:center; justify-content:center; font-size:24px; color:#999;">+</div>
      <span>自定义</span>
  `;
    addBtn.addEventListener('click', e => {
        e.stopPropagation(); // 防止触发选择事件
        handleAddCustomCategory(type);
    });
    grid.appendChild(addBtn);
}
/* --- 兔k记账-钱包功能核心函数 --- */

let editingAccountId = null; // 用于追踪正在编辑的账户ID


async function renderTukeyWalletView() {
    const listEl = document.getElementById('wallet-accounts-list');
    listEl.innerHTML = '';

    const allAccounts = await db.tukeyAccounts.toArray();

    // --- 1. 计算并显示资产总览 (这部分逻辑不变) ---
    let totalAssets = 0;
    let totalLiabilities = 0;
    allAccounts.forEach(acc => {
        const balance = parseFloat(acc.balance) || 0;
        const categoryInfo = ACCOUNT_STRUCTURE[acc.category];
        if (!categoryInfo) return;

        if (categoryInfo.isAsset === true) {
            totalAssets += balance;
        } else if (categoryInfo.isAsset === false) {
            totalLiabilities += balance;
        } else {
            if (acc.type === '借出') totalAssets += balance;
            if (acc.type === '借入') totalLiabilities += balance;
        }
    });

    const netAssets = totalAssets - totalLiabilities;
    document.getElementById('net-assets-value').textContent = `¥ ${netAssets.toFixed(2)}`;
    document.getElementById('total-assets-value').textContent = `¥ ${totalAssets.toFixed(2)}`;
    document.getElementById('total-liabilities-value').textContent = `¥ ${totalLiabilities.toFixed(2)}`;

    // --- 2. 按分类渲染账户列表 ---
    for (const categoryName in ACCOUNT_STRUCTURE) {
        const accountsInCategory = allAccounts.filter(acc => acc.category === categoryName);
        if (accountsInCategory.length === 0) continue;

        const categoryCard = document.createElement('div');
        categoryCard.className = 'tukey-account-category-card';

        let categoryTotal = 0;
        accountsInCategory.forEach(acc => (categoryTotal += parseFloat(acc.balance) || 0));


        let accountsHtml = '';
        accountsInCategory.forEach(acc => {
            // 1. 根据账户的分类和类型，找到对应的图标URL
            const categoryInfo = ACCOUNT_STRUCTURE[acc.category];
            const typeInfo = categoryInfo?.types.find(t => t.name === acc.type);
            // 2. 如果找到了就用它的图标，找不到就用一个备用图标或空字符串
            const iconUrl = typeInfo ? typeInfo.iconUrl : 'https://i.postimg.cc/y88P16yW/default-icon.png';

            // 3. 在HTML结构中，添加 <img> 标签来显示图标
            accountsHtml += `
                <div class="tukey-account-item" data-account-id="${acc.id}">
                    <div class="account-info">
                        <img src="${iconUrl}" class="account-icon" alt="${acc.type}">
                        <span class="account-name">${acc.name}</span>
                    </div>
                    <div class="account-balance-and-type">
                        <span class="account-balance">¥ ${parseFloat(acc.balance).toFixed(2)}</span>
                        <span class="account-type-name">${acc.type}</span>
                    </div>
                </div>
            `;
        });


        // 渲染大类标题和总额
        categoryCard.innerHTML = `
            <div class="category-header">
                <div class="category-title">
                    <span class="name">${categoryName}</span>
                    <span class="total">¥ ${categoryTotal.toFixed(2)}</span>
                </div>
            </div>
            <div class="category-accounts-list">
                ${accountsHtml}
            </div>
        `;
        listEl.appendChild(categoryCard);
    }
}

// 添加自定义账户类型按钮
function openAccountTypeSelector() {
    editingAccountId = null;
    const modal = document.getElementById('account-editor-modal');
    const titleEl = document.getElementById('account-editor-title');
    const selectionView = document.getElementById('account-type-selection-view');
    const formView = document.getElementById('account-editor-form');
    const saveBtn = document.getElementById('save-account-btn');

    titleEl.textContent = '选择账户类型';
    formView.style.display = 'none';
    selectionView.style.display = 'block';
    saveBtn.style.display = 'none';
    selectionView.innerHTML = '';

    for (const categoryName in ACCOUNT_STRUCTURE) {
        const categoryInfo = ACCOUNT_STRUCTURE[categoryName];
        const groupEl = document.createElement('div');
        groupEl.className = 'category-group';

        let typesHtml = '';
        categoryInfo.types.forEach(type => {
            typesHtml += `
                <div class="type-item" data-category="${categoryName}" data-type="${type.name}">
                    <img src="${type.iconUrl}" class="type-icon">
                    <span class="type-name">${type.name}</span>
                </div>
            `;
        });

        typesHtml += `
        <div class="type-item add-custom-type-btn" data-category="${categoryName}">
             <div style="width:40px; height:40px; border-radius:50%; background:#f0f2f5; display:flex; align-items:center; justify-content:center; font-size:20px; color:#999; margin-bottom:5px;">+</div>
             <span class="type-name">自定义</span>
        </div>
    `;

        groupEl.innerHTML = `
            <div class="category-group-title">${categoryName}</div>
            <div class="type-grid">${typesHtml}</div>
        `;
        selectionView.appendChild(groupEl);
    }
    modal.classList.add('visible');
}


/**
 * 打开账户编辑器表单（用于添加或编辑）
 */
async function openAccountEditor(accountId = null, preselectedCategory = null, preselectedType = null) {
    editingAccountId = accountId;
    const modal = document.getElementById('account-editor-modal');
    const titleEl = document.getElementById('account-editor-title');
    const selectionView = document.getElementById('account-type-selection-view');
    const formView = document.getElementById('account-editor-form');
    const saveBtn = document.getElementById('save-account-btn');

    // 获取表单元素
    const categorySelect = document.getElementById('account-category-select');
    const typeSelect = document.getElementById('account-type-select');
    const nameInput = document.getElementById('account-name-input');
    const balanceInput = document.getElementById('account-balance-input');
    const remarksInput = document.getElementById('account-remarks-input');

    // 切换视图
    selectionView.style.display = 'none';
    formView.style.display = 'block';
    saveBtn.style.display = 'inline-block';

    if (accountId) {
        // --- 编辑模式 ---
        titleEl.textContent = '编辑账户';
        const account = await db.tukeyAccounts.get(accountId);
        if (account) {
            // 填充并选中已保存的数据
            categorySelect.innerHTML = `<option value="${account.category}">${account.category}</option>`;
            typeSelect.innerHTML = `<option value="${account.type}">${account.type}</option>`;
            categorySelect.value = account.category;
            typeSelect.value = account.type;
            nameInput.value = account.name;
            balanceInput.value = account.balance;
            remarksInput.value = account.remarks || '';
            // 编辑时不允许修改分类和类型
            categorySelect.disabled = true;
            typeSelect.disabled = true;
        }
    } else {
        // --- 添加模式 (已选定类型) ---
        titleEl.textContent = '添加新账户';
        // 填充并锁定预选的分类和类型
        categorySelect.innerHTML = `<option value="${preselectedCategory}">${preselectedCategory}</option>`;
        typeSelect.innerHTML = `<option value="${preselectedType}">${preselectedType}</option>`;
        categorySelect.value = preselectedCategory;
        typeSelect.value = preselectedType;
        categorySelect.disabled = true;
        typeSelect.disabled = true;

        // 清空其他输入框
        nameInput.value = '';
        balanceInput.value = '';
        remarksInput.value = '';

        // 自动聚焦到账户名称输入框
        nameInput.focus();
    }
    modal.classList.add('visible');
}

/**
 * 保存账户信息的核心函数
 */
async function saveTukeyAccount() {
    const category = document.getElementById('account-category-select').value;
    const typeName = document.getElementById('account-type-select').value;
    const name = document.getElementById('account-name-input').value.trim();
    const balance = document.getElementById('account-balance-input').value;
    const remarks = document.getElementById('account-remarks-input').value.trim();

    if (!name) {
        alert('账户名称不能为空！');
        return;
    }
    if (balance === '' || isNaN(parseFloat(balance))) {
        alert('请输入有效的账户余额！');
        return;
    }

    const selectedType = ACCOUNT_STRUCTURE[category]?.types.find(t => t.name === typeName);
    const iconUrl = selectedType ? selectedType.iconUrl : '';

    const accountData = { category, type: typeName, name, balance: parseFloat(balance), remarks, iconUrl };

    try {
        if (editingAccountId) {
            await db.tukeyAccounts.update(editingAccountId, accountData);
            alert('账户已更新！');
        } else {
            await db.tukeyAccounts.add(accountData);
            alert('新账户已添加！');
        }
        document.getElementById('account-editor-modal').classList.remove('visible');
        await renderTukeyWalletView();
    } catch (error) {
        console.error('保存账户失败:', error);
        alert(`保存失败: ${error.message}`);
    }
}


/**
 * 删除一个账户
 * @param {number} accountId - 要删除的账户ID
 */
async function deleteTukeyAccount(accountId) {
    const confirmed = await showCustomConfirm('删除账户', '确定要删除这个账户吗？此操作不可恢复。', {
        confirmButtonClass: 'btn-danger',
    });
    if (confirmed) {
        await db.tukeyAccounts.delete(accountId);
        await renderTukeyWalletView(); // 刷新钱包界面
        alert('账户已删除。');
    }
}

/* --- 兔k记账-Excel导出功能 --- */

/**
 * 打开导出选项模态框
 */
async function openTukeyExportModal() {
    const modal = document.getElementById('tukey-export-modal');
    const listEl = document.getElementById('tukey-export-account-list');
    listEl.innerHTML = '';

    const accounts = await db.tukeyAccounts.toArray();

    // 添加“所有账户”选项
    listEl.innerHTML += `<label><input type="checkbox" value="all" id="tukey-export-select-all"> <strong>所有账户</strong></label>`;

    // 添加各个单独账户的选项
    accounts.forEach(acc => {
        listEl.innerHTML += `<label><input type="checkbox" class="tukey-export-account-cb" value="${acc.id}"> ${acc.name} (${acc.type})</label>`;
    });

    // 为“所有账户”复选框添加联动逻辑
    document.getElementById('tukey-export-select-all').addEventListener('change', e => {
        document.querySelectorAll('.tukey-export-account-cb').forEach(cb => {
            cb.checked = e.target.checked;
        });
    });

    modal.classList.add('visible');
}

/**
 * 执行导出为Excel的核心函数
 */
async function exportTukeyReportToExcel() {
    const selectedAccountIds = Array.from(document.querySelectorAll('.tukey-export-account-cb:checked')).map(cb =>
        parseInt(cb.value),
    );

    if (selectedAccountIds.length === 0) {
        alert('请至少选择一个要导出的账户！');
        return;
    }

    document.getElementById('tukey-export-modal').classList.remove('visible');
    await showCustomAlert('请稍候...', '正在生成Excel文件...');

    try {
        // 1. 根据选择的账户ID从数据库获取记录
        const records = await db.tukeyAccountingRecords.where('accountId').anyOf(selectedAccountIds).sortBy('timestamp');

        if (records.length === 0) {
            await showCustomAlert('无数据', '选中的账户没有任何记账记录可供导出。');
            return;
        }

        // 2. 将数据格式化为适合Excel的数组
        const dataForSheet = records.map(rec => ({
            日期: new Date(rec.timestamp).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            }),
            类型: rec.type === 'expense' ? '支出' : '收入',
            分类: rec.category,
            金额: rec.type === 'expense' ? -rec.amount : rec.amount,
            账户: rec.accountName,
            备注: rec.remarks || '',
        }));

        // 3. 使用SheetJS创建工作簿和工作表
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '账单明细');

        // (可选) 调整列宽
        worksheet['!cols'] = [
            { wch: 20 }, // 日期
            { wch: 8 }, // 类型
            { wch: 15 }, // 分类
            { wch: 12 }, // 金额
            { wch: 20 }, // 账户
            { wch: 30 }, // 备注
        ];

        // 4. 生成并下载Excel文件
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `兔k记账报表-${dateStr}.xlsx`);
    } catch (error) {
        console.error('导出Excel失败:', error);
        await showCustomAlert('导出失败', `发生错误: ${error.message}`);
    }
}

/* --- Excel导出功能结束 --- */


/* --- 兔k记账功能 V2.0 (记账群聊版) --- */
let activeTukeyGroup = null; // 用于存储当前激活的记账群聊数据

/**
 * 初始化兔k记账App的所有功能和事件监听
 */
async function initTukeyAccounting() {
    await loadAndRenderTukeyUserSettings();
    await loadTukeyCustomConfig();
    // 1. 绑定主屏幕图标点击事件
    document.getElementById('tukey-accounting-app-icon').addEventListener('click', async () => {
        // 打开App时，总是先尝试加载群聊数据
        await loadTukeyGroupData();
        showScreen('tukey-accounting-screen');
    });

    // 2. 绑定底部导航栏事件
    document.getElementById('tukey-bottom-nav').addEventListener('click', e => {
        const navItem = e.target.closest('.tukey-nav-item');
        if (navItem && navItem.dataset.view) {
            const viewId = navItem.dataset.view;
            switchTukeyView(viewId); // 切换视图
            // 如果切换到钱包或群聊视图，则刷新其内容
            if (viewId === 'tukey-wallet-view') renderTukeyWalletView();
            if (viewId === 'tukey-group-chat-view') loadTukeyGroupData();
        }
    });

    // 3. 绑定“创建群聊”按钮
    document.getElementById('tukey-create-group-btn').addEventListener('click', () => {
        openGroupManagerModal();
    });

    // 4. 绑定群聊管理弹窗的“保存”和“取消”按钮
    document.getElementById('tukey-cancel-group-manager-btn').addEventListener('click', () => {
        document.getElementById('tukey-group-manager-modal').classList.remove('visible');
    });
    document.getElementById('tukey-save-group-btn').addEventListener('click', saveTukeyGroup);

    // 5. 绑定群聊内部的“设置”按钮 -> 改为弹出选项菜单
    document.getElementById('tukey-group-settings-btn').addEventListener('click', async () => {
        // 使用现有的 showChoiceModal 弹出一个菜单
        const choice = await showChoiceModal('记账群聊设置', [
            { text: '👥 管理成员 (拉人/踢人)', value: 'manage_members' },
            { text: '🤖 AI回复设置', value: 'ai_settings' },
            { text: '⚠️ 解散群聊', value: 'dissolve_group' },
        ]);

        if (choice === 'manage_members') {
            openGroupManagerModal(); // 打开成员选择弹窗（支持勾选添加/取消勾选踢人）
        } else if (choice === 'ai_settings') {
            openReplySettingsModal(); // 打开AI设置
        } else if (choice === 'dissolve_group') {
            dissolveTukeyGroup(); // 执行解散逻辑
        }
    });

    // 6. 绑定回复设置弹窗的按钮
    document.getElementById('tukey-cancel-reply-settings-btn').addEventListener('click', () => {
        document.getElementById('tukey-reply-settings-modal').classList.remove('visible');
    });
    document.getElementById('tukey-save-reply-settings-btn').addEventListener('click', saveReplySettings);

    // 7. 绑定回复设置弹窗内的模式切换逻辑
    document.querySelectorAll('input[name="tukey-reply-mode"]').forEach(radio => {
        radio.addEventListener('change', e => {
            const mode = e.target.value;
            document.getElementById('tukey-specific-reply-options').style.display =
                mode === 'random' || mode === 'specific' ? 'block' : 'none';
        });
    });

    // 这是正确的代码
    // 9. 记一笔相关按钮
    document.getElementById('tukey-add-record-btn').addEventListener('click', openRecordEditor);

    // 9. 记一笔弹窗内的“支出/收入”切换
    document.querySelector('.tukey-type-selector').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('.tukey-type-selector .type-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderRecordCategories(e.target.dataset.type);
        }
    });

    // 10.【不要动！】你原有的钱包账户功能事件监听，保持不变
    document.getElementById('add-new-account-fab').addEventListener('click', openAccountTypeSelector);
    document.getElementById('account-type-selection-view').addEventListener('click', e => {
        // 检查是否点击了“自定义”按钮
        const customBtn = e.target.closest('.add-custom-type-btn');
        if (customBtn) {
            const category = customBtn.dataset.category;
            handleAddCustomAccountType(category);
            return;
        }

        // 检查是否点击了普通类型
        const typeItem = e.target.closest('.type-item');
        if (typeItem && !typeItem.classList.contains('add-custom-type-btn')) {
            const category = typeItem.dataset.category;
            const type = typeItem.dataset.type;
            openAccountEditor(null, category, type);
        }
    });
    const accountListEl = document.getElementById('wallet-accounts-list');
    accountListEl.addEventListener('click', e => {
        const item = e.target.closest('.tukey-account-item');
        if (item && item.dataset.accountId) {
            openAccountEditor(parseInt(item.dataset.accountId));
        }
    });
    accountListEl.addEventListener('contextmenu', e => {
        const item = e.target.closest('.tukey-account-item');
        if (item && item.dataset.accountId) {
            e.preventDefault();
            deleteTukeyAccount(parseInt(item.dataset.accountId));
        }
    });
    document.getElementById('cancel-account-editor-btn').addEventListener('click', () => {
        document.getElementById('account-editor-modal').classList.remove('visible');
    });
    document.getElementById('save-account-btn').addEventListener('click', saveTukeyAccount);
    // 11. 绑定设置页面的保存和头像上传
    document.getElementById('save-tukey-settings-btn').addEventListener('click', saveTukeyUserSettings);

    document.getElementById('tukey-user-avatar-input').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (file) {
            const dataUrl = await handleImageUploadAndCompress(file); // 复用图片压缩函数
            document.getElementById('tukey-user-avatar-preview').src = dataUrl;
        }
        event.target.value = null;
    });
    // 12. 绑定Excel导出功能相关按钮
    document.getElementById('export-tukey-report-btn').addEventListener('click', openTukeyExportModal);

    document.getElementById('cancel-tukey-export-btn').addEventListener('click', () => {
        document.getElementById('tukey-export-modal').classList.remove('visible');
    });

    document.getElementById('confirm-tukey-export-btn').addEventListener('click', exportTukeyReportToExcel);

}

/**
 * 加载群聊数据并渲染主界面
 */
async function loadTukeyGroupData() {
    activeTukeyGroup = await db.tukeyAccountingGroups.get('main_group');
    if (activeTukeyGroup) {
        document.getElementById('tukey-no-group-placeholder').style.display = 'none';
        document.getElementById('tukey-group-chat-container').style.display = 'flex';
        document.getElementById('tukey-group-name').textContent = activeTukeyGroup.name;
        await renderTukeyRecordsList();
    } else {
        document.getElementById('tukey-no-group-placeholder').style.display = 'flex';
        document.getElementById('tukey-group-chat-container').style.display = 'none';
    }
}

/**
 * 打开群聊创建/管理模态框
 */
async function openGroupManagerModal() {
    const modal = document.getElementById('tukey-group-manager-modal');
    const pickerList = document.getElementById('tukey-member-picker-list');
    pickerList.innerHTML = '';

    // 加载所有单聊角色作为备选成员
    const allChars = Object.values(state.chats).filter(c => !c.isGroup);

    if (activeTukeyGroup) {
        // 编辑模式
        document.getElementById('tukey-group-manager-title').textContent = '管理群成员';
        document.getElementById('tukey-group-name-input').value = activeTukeyGroup.name;
        const currentMemberIds = new Set(activeTukeyGroup.members.map(m => m.id));
        allChars.forEach(char => {
            const isChecked = currentMemberIds.has(char.id) ? 'checked' : '';
            pickerList.innerHTML += `
                <label>
                    <input type="checkbox" value="${char.id}" ${isChecked}> ${char.name}
                </label>`;
        });
    } else {
        // 创建模式
        document.getElementById('tukey-group-manager-title').textContent = '创建记账群聊';
        document.getElementById('tukey-group-name-input').value = '';
        allChars.forEach(char => {
            pickerList.innerHTML += `<label><input type="checkbox" value="${char.id}"> ${char.name}</label>`;
        });
    }

    modal.classList.add('visible');
}

/**
 * 保存群聊设置
 */
async function saveTukeyGroup() {
    const name = document.getElementById('tukey-group-name-input').value.trim();
    if (!name) {
        alert('群聊名称不能为空！');
        return;
    }

    const selectedCheckboxes = document.querySelectorAll('#tukey-member-picker-list input:checked');
    if (selectedCheckboxes.length === 0) {
        alert('请至少选择一位群成员！');
        return;
    }

    const members = Array.from(selectedCheckboxes).map(cb => {
        const char = state.chats[cb.value];
        return {
            id: char.id,
            name: char.name,
            persona: char.settings.aiPersona,
            avatar: char.settings.aiAvatar,
        };
    });

    const groupData = {
        id: 'main_group',
        name: name,
        members: members,
        replySettings: activeTukeyGroup?.replySettings || {
            // 保留旧设置或使用默认值
            threshold: 1,
            mode: 'all',
            randomCount: 1,
            specificMemberIds: [],
        },
    };

    await db.tukeyAccountingGroups.put(groupData);
    activeTukeyGroup = groupData;

    document.getElementById('tukey-group-manager-modal').classList.remove('visible');
    await loadTukeyGroupData(); // 重新加载并渲染主界面
}

/**
 * 打开AI回复设置模态框
 */
function openReplySettingsModal() {
    if (!activeTukeyGroup) return;

    const settings = activeTukeyGroup.replySettings;
    document.getElementById('tukey-reply-threshold-input').value = settings.threshold;
    document.querySelector(`input[name="tukey-reply-mode"][value="${settings.mode}"]`).checked = true;

    const specificOptions = document.getElementById('tukey-specific-reply-options');
    specificOptions.style.display = settings.mode === 'random' || settings.mode === 'specific' ? 'block' : 'none';

    document.getElementById('tukey-random-count-input').value = settings.randomCount;

    // 渲染指定成员选择列表
    const specificMemberList = document.getElementById('tukey-specific-member-picker-list');
    specificMemberList.innerHTML = '';
    activeTukeyGroup.members.forEach(member => {
        const isChecked = settings.specificMemberIds.includes(member.id) ? 'checked' : '';
        specificMemberList.innerHTML += `<label><input type="checkbox" value="${member.id}" ${isChecked}> ${member.name}</label>`;
    });

    document.getElementById('tukey-reply-settings-modal').classList.add('visible');
}

/**
 * 保存AI回复设置
 */
async function saveReplySettings() {
    const threshold = parseInt(document.getElementById('tukey-reply-threshold-input').value);
    const mode = document.querySelector('input[name="tukey-reply-mode"]:checked').value;
    const randomCount = parseInt(document.getElementById('tukey-random-count-input').value);
    const specificMemberIds = Array.from(
        document.querySelectorAll('#tukey-specific-member-picker-list input:checked'),
    ).map(cb => cb.value);

    activeTukeyGroup.replySettings = { threshold, mode, randomCount, specificMemberIds };
    await db.tukeyAccountingGroups.put(activeTukeyGroup);

    document.getElementById('tukey-reply-settings-modal').classList.remove('visible');
    alert('回复设置已保存！');
}

/**
 * 解散记账群聊
 */
async function dissolveTukeyGroup() {
    if (!activeTukeyGroup) return;

    // 1. 弹出红色警告确认框
    const confirmed = await showCustomConfirm(
        '确认解散',
        '确定要解散记账群聊吗？\n\n注意：\n1. 之前的记账记录**不会**被删除，依然可以在报表中查看。\n2. 解散后您可以重新创建一个新的记账群。',
        { confirmButtonClass: 'btn-danger' },
    );

    if (confirmed) {
        try {
            // 2. 从数据库删除群组配置
            await db.tukeyAccountingGroups.delete('main_group');

            // 3. 重置内存状态
            activeTukeyGroup = null;

            // 4. 刷新界面（会自动显示回“创建群聊”的空状态页面）
            await loadTukeyGroupData();

            alert('记账群聊已解散。');
        } catch (error) {
            console.error('解散群聊失败:', error);
            alert('解散失败，请重试。');
        }
    }
}

/**
 * 打开浮动记账卡片并初始化
 */
async function openRecordEditor() {
    const card = document.getElementById('tukey-record-input-card');
    if (!card) return;

    // 清空旧数据
    document.getElementById('tukey-card-amount-input').value = '';
    document.getElementById('tukey-card-remarks-input').value = '';

    // 设置时间默认为当前时间
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('tukey-card-time-input').value = now.toISOString().slice(0, 16);

    // 渲染账户下拉列表
    const accountSelect = document.getElementById('tukey-card-account-select');
    accountSelect.innerHTML = '';
    const accounts = await db.tukeyAccounts.toArray();
    if (accounts.length === 0) {
        alert('请先在“钱包”页面添加一个账户！');
        return;
    }
    accounts.forEach(acc => {
        accountSelect.innerHTML += `<option value="${acc.id}" data-name="${acc.name}">${acc.name}</option>`;
    });

    // 默认显示支出分类，并重置已选分类
    switchRecordType('expense');
    updateSelectedCategoryDisplay();

    // ---- 事件绑定 (使用克隆节点防止重复绑定) ----
    const typeSelector = card.querySelector('.type-selector');
    const newTypeSelector = typeSelector.cloneNode(true);
    typeSelector.parentNode.replaceChild(newTypeSelector, typeSelector);
    newTypeSelector.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            switchRecordType(e.target.dataset.type);
        }
    });

    const categoryGrid = card.querySelector('.category-grid');
    const newCategoryGrid = categoryGrid.cloneNode(true);
    categoryGrid.parentNode.replaceChild(newCategoryGrid, categoryGrid);

    newCategoryGrid.addEventListener('click', e => {
        // 1. 找到被点击的项
        const item = e.target.closest('.tukey-category-item');

        // 2. 检查：如果点到了，并且它不是“添加自定义”按钮
        if (item && !item.classList.contains('add-custom-btn')) {
            newCategoryGrid.querySelectorAll('.tukey-category-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            // 3. 现在可以安全地读取 img.src 了
            updateSelectedCategoryDisplay(item.dataset.category, item.querySelector('img').src);
        }
    });

    const closeBtn = card.querySelector('.close-card-btn');
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    newCloseBtn.addEventListener('click', () => card.classList.remove('visible'));

    const saveBtn = card.querySelector('#tukey-save-from-card-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.addEventListener('click', saveTukeyRecordFromCard);

    // 显示卡片
    card.classList.add('visible');
    document.getElementById('tukey-card-amount-input').focus();
}

// 使用新的渲染函数，支持自定义按钮
function switchRecordType(type) {
    const card = document.getElementById('tukey-record-input-card');
    card.querySelectorAll('.type-selector .type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // 使用新函数来渲染，包含那个“+”号
    renderRecordCategories(type);

    // 切换后清空已选分类
    updateSelectedCategoryDisplay();
}


/**
 * 更新金额输入框旁边已选分类的显示
 */
function updateSelectedCategoryDisplay(categoryName = '请选择分类', iconSrc = '') {
    const displayEl = document.getElementById('tukey-card-selected-category');
    const imgEl = displayEl.querySelector('img');
    const spanEl = displayEl.querySelector('span');

    if (iconSrc) {
        imgEl.src = iconSrc;
        imgEl.style.display = 'inline';
    } else {
        imgEl.style.display = 'none';
    }
    spanEl.textContent = categoryName;
}

/**
 * 从记账卡片中读取数据并保存
 */
async function saveTukeyRecordFromCard() {
    const card = document.getElementById('tukey-record-input-card');

    const type = card.querySelector('.type-selector .type-btn.active').dataset.type;
    const selectedCategoryItem = card.querySelector('.tukey-category-item.selected');
    const amount = parseFloat(document.getElementById('tukey-card-amount-input').value);
    const remarks = document.getElementById('tukey-card-remarks-input').value.trim();

    // 从对应的选择器读取账户和时间
    const accountSelect = document.getElementById('tukey-card-account-select');
    const accountId = parseInt(accountSelect.value);
    const accountName = accountSelect.options[accountSelect.selectedIndex].dataset.name;
    const timeValue = document.getElementById('tukey-card-time-input').value;
    const timestamp = timeValue ? new Date(timeValue).getTime() : Date.now();

    if (!selectedCategoryItem) {
        alert('请选择一个分类！');
        return;
    }
    const category = selectedCategoryItem.dataset.category;

    if (isNaN(amount) || amount <= 0) {
        alert('请输入有效的金额！');
        return;
    }

    const newRecord = {
        groupId: activeTukeyGroup.id,
        timestamp,
        type,
        amount,
        category,
        remarks,
        accountId,
        accountName,
        isRepliedTo: false,
    };

    // 更新正确的账户余额
    const account = await db.tukeyAccounts.get(accountId);
    if (account) {
        const currentBalance = parseFloat(account.balance);
        const change = type === 'expense' ? -amount : amount;

        // 特殊处理信用账户和借贷
        const categoryInfo = ACCOUNT_STRUCTURE[account.category];
        if (categoryInfo.isAsset === false) {
            // 信用账户
            account.balance = currentBalance + (type === 'expense' ? amount : -amount);
        } else if (account.type === '借入') {
            account.balance = currentBalance + (type === 'expense' ? -amount : amount);
        } else {
            // 资产账户
            account.balance = currentBalance + change;
        }

        await db.tukeyAccounts.put(account);
    }

    await db.tukeyAccountingRecords.add(newRecord);

    // 检查同步开关，如果开启，则更新桃宝余额
    if (tukeyUserSettings.syncWithTaobao) {
        const syncAmount = newRecord.type === 'expense' ? -newRecord.amount : newRecord.amount;
        const syncDescription = `[兔k记账同步] ${newRecord.category} - ${newRecord.remarks || '无备注'}`;
        await updateUserBalanceAndLogTransaction(syncAmount, syncDescription);
        console.log(`桃宝余额已同步: ${syncAmount > 0 ? '+' : ''}${syncAmount.toFixed(2)}`);
    }


    card.classList.remove('visible'); // 保存后隐藏卡片
    await renderTukeyRecordsList(); // 刷新列表
    await checkAndTriggerAiReply(); // 检查AI回复
}

/**
 * 渲染记账记录和AI回复列表（气泡模式）
 */
async function renderTukeyRecordsList() {
    const listEl = document.getElementById('tukey-records-list');
    listEl.innerHTML = ''; // 清空
    if (!activeTukeyGroup) return;

    // 获取所有记录并按时间升序排列（旧的在前，新的在后）
    const records = await db.tukeyAccountingRecords.where('groupId').equals(activeTukeyGroup.id).sortBy('timestamp');

    if (records.length === 0) {
        listEl.innerHTML =
            '<p style="text-align:center;color:grey;padding:20px;">还没有记账记录哦，点击右下角“+”开始第一笔吧！</p>';
        return;
    }

    for (const record of records) {
        const recordTime = new Date(record.timestamp);
        const timeString = `${recordTime.getMonth() + 1}-${recordTime.getDate()} ${String(recordTime.getHours()).padStart(
            2,
            '0',
        )}:${String(recordTime.getMinutes()).padStart(2, '0')}`;

        // 找到对应分类的图标
        const categoryData = ACCOUNTING_CATEGORIES[record.type].find(c => c.name === record.category);
        const categoryIcon = categoryData ? categoryData.icon : '';

        // 创建一个新的外层包裹容器
        const userRecordWrapper = document.createElement('div');
        userRecordWrapper.className = 'tukey-record-wrapper user-record'; // 使用新的 wrapper class

        // 创建记账气泡本身
        const recordBubble = document.createElement('div');
        recordBubble.className = `tukey-record-bubble ${record.type}`; // 这里不再需要 user-record class
        recordBubble.innerHTML = `
            <div class="record-header">
                <img src="${categoryIcon}" class="record-category-icon" alt="${record.category}">
                <span class="record-category-name">${record.category}</span>
            </div>
            <div class="record-body">
                <span class="record-remarks">${record.remarks || '无备注'}</span>
                <span class="record-amount">${record.type === 'expense' ? '-' : '+'} ¥${record.amount.toFixed(2)}</span>
            </div>
            <div class="record-footer">
                <span>${record.accountName}</span> · <span>${timeString}</span>
            </div>
        `;

        // 创建头像
        const userAvatarImg = document.createElement('img');
        userAvatarImg.src = tukeyUserSettings.avatar;
        userAvatarImg.className = 'record-user-avatar';
        userAvatarImg.title = tukeyUserSettings.username;

        // 将气泡和头像都添加到新的包裹容器中
        userRecordWrapper.appendChild(recordBubble);
        userRecordWrapper.appendChild(userAvatarImg);

        // 最后将整个包裹容器添加到列表
        listEl.appendChild(userRecordWrapper);

        // 查询并渲染对应的AI回复
        const replies = await db.tukeyAccountingReplies.where('recordId').equals(record.id).toArray();
        if (replies.length > 0) {
            const repliesContainer = document.createElement('div');
            repliesContainer.className = 'tukey-replies-container';

            replies.forEach(reply => {
                const member = activeTukeyGroup.members.find(m => m.id === reply.charId);
                if (member) {
                    const replyEl = document.createElement('div');
                    replyEl.className = 'tukey-reply-item';
                    replyEl.innerHTML = `
                        <img src="${member.avatar}" class="reply-avatar" alt="${member.name}">
                        <div class="reply-content">
                            <div class="reply-sender-name">${member.name}</div>
                            <div class="reply-bubble">${reply.content}</div>
                        </div>
                    `;
                    repliesContainer.appendChild(replyEl);
                }
            });
            listEl.appendChild(repliesContainer);
        }
    }
    // 滚动到底部
    listEl.scrollTop = listEl.scrollHeight;
}

/**
 * 检查是否达到阈值，并触发AI回复
 */
async function checkAndTriggerAiReply() {
    if (!activeTukeyGroup) return;

    const settings = activeTukeyGroup.replySettings;
    // 使用 .filter() 来正确查找未回复的记录
    const unrepliedRecords = await db.tukeyAccountingRecords
        .where('groupId')
        .equals(activeTukeyGroup.id)
        .filter(record => !record.isRepliedTo) // 这会匹配 isRepliedTo 为 false, undefined 或 null 的所有情况
        .toArray();


    console.log(`[记账AI检查] 未回复记录数: ${unrepliedRecords.length}, 阈值: ${settings.threshold}`);

    // 如果未回复的记录数达到了阈值
    if (unrepliedRecords.length >= settings.threshold) {
        console.log(`[记账AI触发] 达到阈值，准备生成回复...`);
        await triggerAccountingAiResponse(unrepliedRecords);
    }
}

/**
 * 触发记账群聊的AI回复
 * @param {Array} recordsToReply - 需要AI进行评论的账单记录数组
 */
async function triggerAccountingAiResponse(recordsToReply) {
    if (!activeTukeyGroup) return;

    // 显示一个加载提示
    const listEl = document.getElementById('tukey-records-list');
    const loadingEl = document.createElement('div');
    loadingEl.className = 'tukey-reply-item';
    loadingEl.innerHTML = `<div class="reply-bubble">成员们正在赶来的路上...</div>`;
    listEl.appendChild(loadingEl);
    listEl.scrollTop = listEl.scrollHeight;

    const { proxyUrl, apiKey, model, temperature } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        loadingEl.remove();
        alert('请先在API设置中配置好才能触发AI回复哦！');
        return;
    }

    const settings = activeTukeyGroup.replySettings;
    let membersToReply = [];

    // 根据设置决定哪些成员需要回复
    switch (settings.mode) {
        case 'all':
            membersToReply = activeTukeyGroup.members;
            break;
        case 'random':
            const shuffled = [...activeTukeyGroup.members].sort(() => 0.5 - Math.random());
            membersToReply = shuffled.slice(0, settings.randomCount || 1);
            break;
        case 'specific':
            membersToReply = activeTukeyGroup.members.filter(m => settings.specificMemberIds.includes(m.id));
            break;
    }

    if (membersToReply.length === 0) {
        loadingEl.remove();
        console.warn('[记账AI] 没有找到需要回复的成员。');
        return;
    }

    // 构建给AI的指令 (Prompt)
    const recordsText = recordsToReply
        .map(
            r =>
                `- [${new Date(r.timestamp).toLocaleString()}] ${r.type === 'expense' ? '支出' : '收入'} ${r.amount.toFixed(
                    2,
                )}元, 分类: ${r.category}, 备注: ${r.remarks || '无'}`,
        )
        .join('\n');

    // ... 在 triggerAccountingAiResponse 函数内部 ...

    const membersText = membersToReply.map(m => `- ${m.name} (人设: ${m.persona})`).join('\n');


    const systemPrompt = `
# 角色
你是一个多角色扮演AI，在一个记账群聊中。

# 用户信息 (这是账单的记录者)
- 用户名: ${tukeyUserSettings.username}
- 职业: ${tukeyUserSettings.profession || '未设定'}

# 任务
群里的用户刚刚记录了以下几笔账单。请你根据下方指定的角色列表及其人设，以及用户的职业信息，为他们每个人生成对这些账单的评论。

# 待评论的账单
${recordsText}

# 你需要扮演的角色 (及人设)
${membersText}

# 回复规则
1.  你的回复【必须严格符合】每个角色的人设。
2.  你的回复可以结合用户的【职业】进行评论，让对话更真实。例如，如果用户是学生，可以说“学生党花钱真大方呀”；如果是白领，可以说“看来这个月工资不错嘛”。
3.  你的回复【必须】是一个JSON数组，每个对象代表一个角色的评论。
4.  【格式铁律】: \`[{"charName": "角色A的名字", "comment": "角色A的评论内容"}, {"charName": "角色B的名字", "comment": "角色B的评论内容"}]\`
5.  评论内容要简短、口语化，像真实的群聊一样。

现在，请开始生成评论。
`;

    try {
        const messagesForApi = [{ role: 'user', content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini, temperature);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: model,
                    messages: messagesForApi,
                    temperature: parseFloat(temperature) || 0.8,
                    response_format: { type: 'json_object' },
                }),
            });

        if (!response.ok) throw new Error(await response.text());

        const data = await response.json();
        const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content)
            .replace(/^```json\s*|```$/g, '')
            .trim();
        const replies = JSON.parse(rawContent);

        if (Array.isArray(replies)) {
            // 为所有被评论的账单都添加这些回复
            for (const record of recordsToReply) {
                for (const reply of replies) {
                    const member = activeTukeyGroup.members.find(m => m.name === reply.charName);
                    if (member && reply.comment) {
                        await db.tukeyAccountingReplies.add({
                            recordId: record.id,
                            charId: member.id,
                            charName: member.name,
                            content: reply.comment,
                            timestamp: Date.now(),
                        });
                    }
                }
            }

            // 将所有已回复的记录标记为 isRepliedTo: true
            const recordIdsToUpdate = recordsToReply.map(r => r.id);
            await db.tukeyAccountingRecords.where('id').anyOf(recordIdsToUpdate).modify({ isRepliedTo: true });

            await renderTukeyRecordsList(); // 重新渲染，显示新回复
        }
    } catch (error) {
        console.error('生成记账回复失败:', error);
        await showCustomAlert('回复生成失败', `发生错误: ${error.message}`);
    } finally {
        // 无论成功失败，都移除加载提示
        loadingEl.remove();
    }
}

/**
 * 渲染报表主视图，填充筛选器并显示默认报表
 */
async function renderTukeyReportsView() {
    await populateReportFilters();
    // 默认显示“每日明细”
    document.getElementById('report-type-filter').value = 'daily_details';
    handleReportFilterChange(); // 触发一次渲染
}

/**
 * 填充报表的筛选器（账户、月份）
 */
async function populateReportFilters() {
    // 填充账户筛选器
    const accountSelect = document.getElementById('report-account-filter');
    const accounts = await db.tukeyAccounts.toArray();
    accountSelect.innerHTML = '<option value="all">所有账户</option>';
    accounts.forEach(acc => {
        accountSelect.innerHTML += `<option value="${acc.id}">${acc.name}</option>`;
    });

    // 填充月份筛选器
    const monthSelect = document.getElementById('report-month-filter');
    const records = await db.tukeyAccountingRecords.orderBy('timestamp').reverse().toArray();
    const months = new Set();
    records.forEach(rec => {
        const date = new Date(rec.timestamp);
        months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });

    monthSelect.innerHTML = '';
    months.forEach(month => {
        monthSelect.innerHTML += `<option value="${month}">${month}</option>`;
    });
    // 如果没有记录，给一个默认当前月份
    if (months.size === 0) {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        monthSelect.innerHTML = `<option value="${currentMonth}">${currentMonth}</option>`;
    }
}

/**
 * 处理筛选条件变化，并调用相应的报表渲染函数
 */
function handleReportFilterChange() {
    const reportType = document.getElementById('report-type-filter').value;
    const accountId = document.getElementById('report-account-filter').value;
    const monthValue = document.getElementById('report-month-filter').value;

    const dailyView = document.getElementById('daily-report-view');
    const monthlyView = document.getElementById('monthly-report-view');

    if (reportType === 'daily_details') {
        dailyView.style.display = 'block';
        monthlyView.style.display = 'none';
        renderDailyDetailView(accountId === 'all' ? null : parseInt(accountId));
    } else if (reportType === 'monthly_summary') {
        dailyView.style.display = 'none';
        monthlyView.style.display = 'block';
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            renderMonthlySummaryView(parseInt(year), parseInt(month), accountId === 'all' ? null : parseInt(accountId));
        }
    }
}

/**
 * 每日明细视图
 */
async function renderDailyDetailView(accountId) {
    const view = document.getElementById('daily-report-view');
    view.innerHTML = '<p class="report-placeholder">正在加载每日明细...</p>';

    let records;
    if (accountId) {
        records = await db.tukeyAccountingRecords.where({ accountId: accountId }).reverse().sortBy('timestamp');
    } else {
        records = await db.tukeyAccountingRecords.reverse().sortBy('timestamp');
    }

    if (records.length === 0) {
        view.innerHTML = '<p class="report-placeholder">没有找到任何记账记录。</p>';
        return;
    }

    const recordsByDay = records.reduce((acc, rec) => {
        const day = new Date(rec.timestamp).toISOString().split('T')[0];
        if (!acc[day]) acc[day] = [];
        acc[day].push(rec);
        return acc;
    }, {});

    view.innerHTML = '';

    for (const day in recordsByDay) {
        const dayRecords = recordsByDay[day];
        let dailyIncome = 0;
        let dailyExpense = 0;

        let transactionsHtml = '';
        dayRecords.forEach(rec => {
            if (rec.type === 'income') dailyIncome += rec.amount;
            else dailyExpense += rec.amount;

            const categoryData = ACCOUNTING_CATEGORIES[rec.type].find(c => c.name === rec.category);
            const categoryIcon = categoryData ? categoryData.icon : '';
            const recordTime = new Date(rec.timestamp);
            const timeString = `${String(recordTime.getHours()).padStart(2, '0')}:${String(recordTime.getMinutes()).padStart(
                2,
                '0',
            )}`;


            transactionsHtml += `
                <div class="report-record-item" style="display: flex; align-items: center; margin-bottom: 12px;">
                    <!-- 气泡主体，设置 flex-grow: 1 让它占满剩余空间 -->
                    <div class="tukey-record-bubble ${rec.type
                }" style="flex-grow: 1; margin-right: 10px; margin-bottom: 0;"> 
                        <div class="record-header">
                            <img src="${categoryIcon}" class="record-category-icon" alt="${rec.category}">
                            <span class="record-category-name">${rec.category}</span>
                        </div>
                        <div class="record-body">
                            <span class="record-remarks">${rec.remarks || '无备注'}</span>
                            <span class="record-amount">${rec.type === 'expense' ? '-' : '+'} ¥${rec.amount.toFixed(
                    2,
                )}</span>
                        </div>
                        <div class="record-footer">
                            <span>${rec.accountName}</span> · <span>${timeString}</span>
                        </div>
                    </div>
                    
                    <!-- 美化后的删除按钮 -->
                    <button class="delete-record-btn" data-id="${rec.id}" title="删除"
                            style="flex-shrink: 0; width: 36px; height: 36px; border: none; 
                                   background-color: rgba(255, 59, 48, 0.08); border-radius: 10px; 
                                   display: flex; align-items: center; justify-content: center; 
                                   color: #ff3b30; cursor: pointer; transition: all 0.2s;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            `;

        });

        const dayGroup = document.createElement('div');
        dayGroup.className = 'report-day-group';
        dayGroup.innerHTML = `
            <div class="day-header">
                <span class="date">${day}</span>
                <span class="day-summary">
                    <span class="expense">支出: ${dailyExpense.toFixed(2)}</span>
                    <span class="income">收入: ${dailyIncome.toFixed(2)}</span>
                </span>
            </div>
            <div class="transaction-list">${transactionsHtml}</div>
        `;
        view.appendChild(dayGroup);
    }
}

/**
 * 删除一条记账记录并回滚账户余额
 * @param {number} recordId - 要删除的记录ID
 */
async function deleteTukeyAccountingRecord(recordId) {
    // 1. 获取记录详情
    const record = await db.tukeyAccountingRecords.get(recordId);
    if (!record) {
        alert('找不到该记录，可能已被删除。');
        return;
    }

    // 2. 弹出确认框
    const confirmed = await showCustomConfirm(
        '确认删除',
        `确定要删除这笔 ${record.type === 'expense' ? '支出' : '收入'} (¥${record.amount
        }) 吗？\n删除后，关联账户的余额将自动回滚。`,
        { confirmButtonClass: 'btn-danger' },
    );
    if (!confirmed) return;

    try {
        // 3. 回滚账户余额
        const account = await db.tukeyAccounts.get(record.accountId);
        if (account) {
            let currentBalance = parseFloat(account.balance);

            // 核心回滚逻辑：
            // 如果删的是支出(expense)，余额应该加回去 (+ amount)
            // 如果删的是收入(income)，余额应该减出来 (- amount)
            if (record.type === 'expense') {
                // 特殊处理：如果是借入/信用账户，支出意味着欠款增加，删除支出意味着欠款减少（数值逻辑取决于您是如何存储的）
                // 根据您之前的 saveTukeyRecordFromCard 逻辑：
                // 资产账户：余额 = 余额 - 支出。 回滚：余额 + 支出
                // 信用账户：余额 = 余额 + 支出 (欠款变多)。 回滚：余额 - 支出

                const categoryInfo = ACCOUNT_STRUCTURE[account.category];
                // 检查是否是信用账户(isAsset === false) 或 借入账户
                if ((categoryInfo && categoryInfo.isAsset === false) || account.type === '借入') {
                    // 信用账户之前是加了金额，现在要减去
                    account.balance = currentBalance - record.amount;
                } else {
                    // 普通资产账户之前是减了金额，现在要加回
                    account.balance = currentBalance + record.amount;
                }
            } else {
                // 如果删的是收入/还款
                // 资产账户：余额 = 余额 + 收入。 回滚：余额 - 收入
                // 信用账户：余额 = 余额 - 收入 (还款)。 回滚：余额 + 收入
                const categoryInfo = ACCOUNT_STRUCTURE[account.category];
                if ((categoryInfo && categoryInfo.isAsset === false) || account.type === '借入') {
                    account.balance = currentBalance + record.amount;
                } else {
                    account.balance = currentBalance - record.amount;
                }
            }

            // 保存账户余额更新
            await db.tukeyAccounts.put(account);
        }

        // 4. 如果开启了桃宝同步，也要回滚桃宝余额
        if (tukeyUserSettings.syncWithTaobao) {
            // 逻辑取反：删支出=加钱，删收入=扣钱
            const reverseAmount = record.type === 'expense' ? record.amount : -record.amount;
            await updateUserBalanceAndLogTransaction(reverseAmount, `[撤销记账] ${record.category}`);
        }

        // 5. 删除记录本身
        await db.tukeyAccountingRecords.delete(recordId);

        // 6. 删除关联的AI回复 (如果有)
        const replies = await db.tukeyAccountingReplies.where('recordId').equals(recordId).toArray();
        if (replies.length > 0) {
            const replyIds = replies.map(r => r.id);
            await db.tukeyAccountingReplies.bulkDelete(replyIds);
        }

        // 7. 刷新界面
        await renderTukeyReportsView(); // 刷新报表
        // 如果记账群聊界面也在后台，可能需要标记刷新，这里暂只刷新当前报表

        alert('记录已删除，余额已回滚。');
    } catch (error) {
        console.error('删除账单失败:', error);
        alert(`删除失败: ${error.message}`);
    }
}

/**
 * 月度统计视图
 */
async function renderMonthlySummaryView(year, month, accountId) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    let query = db.tukeyAccountingRecords.where('timestamp').between(startDate.getTime(), endDate.getTime());
    if (accountId) {
        query = query.and(record => record.accountId === accountId);
    }
    const records = await query.toArray();

    // 1. 计算月度总收支
    let totalIncome = 0;
    let totalExpense = 0;
    const expenseByCategory = {};
    const expenseByDay = {};

    records.forEach(rec => {
        if (rec.type === 'income') {
            totalIncome += rec.amount;
        } else {
            totalExpense += rec.amount;
            // 为饼图准备数据
            expenseByCategory[rec.category] = (expenseByCategory[rec.category] || 0) + rec.amount;
            // 为折线图准备数据
            const day = new Date(rec.timestamp).getDate();
            expenseByDay[day] = (expenseByDay[day] || 0) + rec.amount;
        }
    });

    document.getElementById('monthly-summary-card').innerHTML = `
        <div class="summary-item">
            <span class="label">总支出</span>
            <span class="value expense">¥ ${totalExpense.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span class="label">总收入</span>
            <span class="value income">¥ ${totalIncome.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span class="label">结余</span>
            <span class="value">¥ ${(totalIncome - totalExpense).toFixed(2)}</span>
        </div>
    `;

    // 2. 渲染饼图
    createCategoryPieChart(expenseByCategory);

    // 3. 渲染折线图
    createExpenditureLineChart(expenseByDay, endDate.getDate());
}

/**
 * 创建支出分类饼图
 */
function createCategoryPieChart(data) {
    const ctx = document.getElementById('category-pie-chart').getContext('2d');
    if (pieChartInstance) {
        pieChartInstance.destroy(); // 销毁旧图表实例
    }
    pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [
                {
                    data: Object.values(data),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'],
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(context.parsed);
                            }
                            return label;
                        },
                    },
                },
            },
        },
    });
}

/**
 * 创建月度支出折线图
 */
function createExpenditureLineChart(data, daysInMonth) {
    const ctx = document.getElementById('expenditure-line-chart').getContext('2d');
    const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const chartData = labels.map(day => data[day] || 0);

    if (lineChartInstance) {
        lineChartInstance.destroy();
    }
    lineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '每日支出',
                    data: chartData,
                    borderColor: '#F44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    fill: true,
                    tension: 0.1,
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '¥' + value;
                        },
                    },
                },
            },
        },
    });
}


/* --- 兔k记账功能函数结束 --- */
