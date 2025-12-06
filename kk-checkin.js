let activeKkCharId = null; // 用于追踪正在查看哪个角色的房屋

/**
 * 【总入口】打开“查岗”功能，显示角色选择列表
 */
async function openKkCheckin() {
    const listEl = document.getElementById('kk-char-selection-list');
    listEl.innerHTML = '';
    const characters = Object.values(state.chats).filter(chat => !chat.isGroup);

    if (characters.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">还没有可以查岗的角色</p>';
    } else {
        characters.forEach(char => {
            const item = document.createElement('div');
            item.className = 'character-select-item'; // 复用“查手机”的样式
            item.dataset.chatId = char.id;
            item.innerHTML = `
                                <img src="${char.settings.aiAvatar || defaultAvatar}" alt="${char.name}">
                                <span class="name">${char.name}</span>
                            `;
            listEl.appendChild(item);
        });
    }
    showScreen('kk-char-selection-screen');
}

/**
 * 选择一个角色后，打开他/她的房屋视图
 * @param {string} charId - 被选择角色的ID
 */
async function openKkHouseView(charId) {
    activeKkCharId = charId;
    const chat = state.chats[charId];
    if (!chat) return;

    // 检查是否已经生成过房屋数据
    if (!chat.houseData) {
        // 如果没有，就调用AI生成
        const generatedData = await generateHouseData(charId);
        if (!generatedData) return; // 如果生成失败，则中止
        chat.houseData = generatedData;
        await db.chats.put(chat); // 保存到数据库
    }

    // 渲染房屋视图
    renderKkHouseView(chat.houseData);
    showScreen('kk-house-view-screen');
}

/**
 * 为指定角色一次性生成所有房屋、区域和物品数据
 * @param {string} charId - 角色ID
 * @returns {Promise<object|null>} - 返回生成的房屋数据对象，或在失败时返回null
 */
async function generateHouseData(charId) {
    const chat = state.chats[charId];
    showGenerationOverlay('正在努力寻找中...');

    try {
        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) throw new Error('API未配置');

        let worldBookContext = '';
        if (chat.settings.linkedWorldBookIds && chat.settings.linkedWorldBookIds.length > 0) {
            worldBookContext =
                '--- 世界观设定 (必须严格遵守) ---\n' +
                chat.settings.linkedWorldBookIds
                    .map(id => {
                        const book = state.worldBooks.find(b => b.id === id);
                        return book ? `[${book.name}]: ${book.content}` : '';
                    })
                    .join('\n\n');
        }
        const userNickname = chat.settings.myNickname || '我';

        const recentHistory = chat.history
            .slice(-chat.settings.maxMemory || 20)
            .map(msg => {
                const sender = msg.role === 'user' ? userNickname : chat.name;
                return `${sender}: ${msg.content}`;
            })
            .join('\n');

        let linkedMemoryContext = '';
        if (chat.settings.linkedMemories && chat.settings.linkedMemories.length > 0) {
            const contextPromises = chat.settings.linkedMemories.map(async link => {
                const linkedChat = state.chats[link.chatId];
                if (!linkedChat) return '';

                const freshLinkedChat = await db.chats.get(link.chatId);
                if (!freshLinkedChat) return '';

                const recentHistory = freshLinkedChat.history.filter(msg => !msg.isHidden).slice(-link.depth);

                if (recentHistory.length === 0) return '';

                const formattedMessages = recentHistory
                    .map(msg => `  - ${formatMessageForContext(msg, freshLinkedChat)}`)
                    .join('\n');

                return `\n## 附加上下文：来自与“${linkedChat.name}”的最近对话内容 (仅你可见)\n${formattedMessages}`;
            });

            const allContexts = await Promise.all(contextPromises);
            linkedMemoryContext = allContexts.filter(Boolean).join('\n');
        }

        const npcLibrary = chat.npcLibrary || [];
        let npcContext = '';
        if (npcLibrary.length > 0) {
            npcContext = '# 你的专属NPC好友列表' + npcLibrary.map(npc => `- **${npc.name}**: ${npc.persona}`).join('\n');
        }

        const systemPrompt = `
			# 任务
			你是一个顶级的、充满想象力的场景设计师。请根据角色的人设和最近的聊天记录，为角色“${chat.name}”设计一个充满细节、符合其身份的住所。你的任务是【一次性】生成所有数据。

			# 角色信息
			- 角色名: ${chat.name}
			- 角色人设: ${chat.settings.aiPersona}
			${worldBookContext}
			- 最近的聊天记录 (供你参考情景):
			${recentHistory}
			${linkedMemoryContext}
			${npcContext}

			# 核心规则 (必须严格遵守)
			1.  **情景一致性**: 住所的设计、找到的物品都必须严格符合角色的人设、世界观和最近的聊天情景。例如，一个贫穷的角色不应住在豪宅，一个刚失恋的角色可能会找到相关物品。
			2.  **区域划分**: 住所必须至少包含【客厅】和【卧室】。你可以根据人设添加其他有趣的区域（如书房、厨房、阳台、地下室等）。
			3.  **可翻找物品 (最重要!)**:
			    -   每个区域内必须包含3-5个符合该区域特点、且可以被“翻找”的具体地点。例如：客厅可以有“沙发底下”、“茶几抽屉”、“电视柜后面”、“垃圾桶”；卧室可以有“枕头底下”、“衣柜深处”、“床头柜抽屉”。
			    -   你【必须】为【每一个】可翻找的物品预设好翻找后能找到的内容("content")。
			    -   找到的内容必须充满细节和想象力，可以是普通的物品，也可以是触发剧情的关键线索。**不要总是“什么都没找到”**。
			4.  **电脑设定**:
			    -   角色必须有一台电脑。
			    -   "browser_history": 虚构3-5条【除B站外】的普通浏览器搜索/浏览记录。
			    -   【movies】: 虚构2-3个在电脑D盘里下载的电影或剧集的文件名 (例如: 电影A.mkv)。
			-   【secret_folder】: 虚构一个加密的隐藏文件夹。**必须**包含 "fileName" 和 "content" 两个字段。
    "fileName" 要看起来很可疑但又像是伪装过的（例如：“学习资料.zip”、“系统备份”、“新建文件夹”）。
    "content" **必须根据角色的人设（${chat.settings.aiPersona}）**来决定里面具体是什么私密内容。**不要千篇一律地生成AV**。
    例如：
    - 如果角色是老司机/普通男性，可以是成人影片；
    - 如果角色是二次元宅，可以是里番、本子或Galgame；
    - 如果角色是清纯少女/少年，可能是羞耻的中二病日记、暗恋对象的偷拍照片、或者写了一半的玛丽苏小说；
    - 如果角色是特工/反派，可能是犯罪计划或机密档案。
    请发挥想象力，生成最符合该角色“不可告人秘密”的内容。
			    -   【local_files】: 虚构2-4个符合其性格的本地文件名，并为【每一个文件】都编写一段具体内容("content")。内容可以是日记、小说片段、代码、学习笔记等。
			5.  **图片Prompt**: 你必须为住所的【整体外观】以及【每个独立区域】都生成一个用于文生图的、纯英文的、详细的【纯风景或静物】描述。**绝对不能包含人物**。图片风格必须是【唯美的动漫风格 (beautiful anime style art, cinematic lighting, masterpiece)】。

			# JSON输出格式 (必须严格遵守，不要添加任何额外说明)
			{
			  "location": "【例如：市中心的高级公寓顶层】",
			  "description": "【对这个住所的整体氛围和风格的简短描述】",
			  "locationImagePrompt": "【整体住所外观的英文图片prompt】",
			  "areas": {
			    "客厅": {
			      "description": "【对客厅的详细描述】",
			      "imagePrompt": "【客厅的英文图片prompt】",
			      "items": [
			        {"name": "沙发底下", "content": "找到了一些零食碎屑和一枚遗落的硬币。"},
			        {"name": "电脑", "content": "这是一台性能不错的笔记本电脑，屏幕还亮着。"}
			      ]
			    },
			    "卧室": { ... }
			  },
			  "computer": {
			    "browser_history": [ "知乎-如何看待XX事件", "学习网站-Python入门教程" ],
			    "local_files": [
			      {"fileName": "秘密日记.txt", "content": "今天又见到了那个人，心情很复杂..."},
			      {"fileName": "学习计划.docx", "content": "下周要完成的论文提纲：1. ... 2. ..."}
			    ],
			    "movies": ["电影A.mkv", "动漫剧场版B.mp4"],
			    "secret_folder": {
			        "fileName": "加密的-学习资料(请勿打开).zip",
			        "content": "解压后发现里面是几部日本成人影片(AV)，文件名分别是 [FC2-PPV-123456]和[SIV-001]，成人影片内容为"
			    }
			    "steam_games": [
			      {"name": "赛博朋克 2077", "playtime": "150 小时"},
			      {"name": "艾尔登法环", "playtime": "300 小时"},
			      {"name": "博德之门3", "playtime": "200 小时"}
			    ]
			  }
			}
			`;

        const messagesForApi = [{ role: 'user', content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 0.8 }),
            });

        if (!response.ok) throw new Error(await response.text());

        const data = await response.json();
        const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
            /^```json\s*|```$/g,
            '',
        );
        const houseData = JSON.parse(rawContent);

        // 逐张生成 + 失败重试 + 即时刷新屏幕背景
        (async () => {
            // 1. 定义“死磕”生成函数
            const generateWithRetry = async (prompt, description) => {
                let attempt = 1;
                while (true) {
                    try {
                        console.log(`[${attempt}次尝试] 正在为“${description}”生成图片...`);
                        // 调用文生图API
                        const url = await generateAndLoadImage(prompt);

                        if (url && url.length > 100) {
                            console.log(`✅ “${description}”生成成功！`);
                            return url;
                        } else {
                            throw new Error('生成的图片URL无效');
                        }
                    } catch (e) {
                        console.warn(`❌ “${description}”生成失败: ${e.message}。3秒后自动重试...`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        attempt++;
                    }
                }
            };

            try {
                // 获取当前的聊天对象，用于实时更新内存数据
                const currentChat = state.chats[charId];

                console.log('🚀 开始队列式生成房屋图片...');

                // 2. 先生成【整体外观】(房屋总览界面的背景)
                if (houseData.locationImagePrompt) {
                    const locationUrl = await generateWithRetry(houseData.locationImagePrompt, '住所整体外观');

                    // A. 保存到数据库
                    const chatToUpdate = await db.chats.get(charId);
                    if (chatToUpdate && chatToUpdate.houseData) {
                        chatToUpdate.houseData.locationImageUrl = locationUrl;
                        await db.chats.put(chatToUpdate);
                    }

                    // B. 更新内存数据 (防止切换页面后变回白色)
                    if (currentChat && currentChat.houseData) {
                        currentChat.houseData.locationImageUrl = locationUrl;
                    }

                    // C. 如果当前正停留在"房屋总览"界面，立刻把背景换上去
                    const houseScreen = document.getElementById('kk-house-view-screen');
                    if (houseScreen && houseScreen.classList.contains('active') && activeKkCharId === charId) {
                        document.getElementById('kk-house-background').style.backgroundImage = `url(${locationUrl})`;
                        console.log('🎨 已实时刷新房屋总览背景');
                    }
                }

                // 3. 逐个生成【区域】图片 (点进某个房间后的背景)
                const areaNames = Object.keys(houseData.areas);
                for (const areaName of areaNames) {
                    const area = houseData.areas[areaName];
                    if (area.imagePrompt) {
                        const areaUrl = await generateWithRetry(area.imagePrompt, `区域：${areaName}`);

                        // A. 保存到数据库
                        const chatToUpdate = await db.chats.get(charId);
                        if (chatToUpdate && chatToUpdate.houseData && chatToUpdate.houseData.areas[areaName]) {
                            chatToUpdate.houseData.areas[areaName].imageUrl = areaUrl;
                            await db.chats.put(chatToUpdate);
                        }

                        // B. 更新内存数据
                        if (currentChat && currentChat.houseData && currentChat.houseData.areas[areaName]) {
                            currentChat.houseData.areas[areaName].imageUrl = areaUrl;
                        }

                        // C. 如果当前正停留在"区域探索"界面，且正好是这个区域，立刻换背景
                        const areaScreen = document.getElementById('kk-area-view-screen');
                        const currentAreaNameTitle = document.getElementById('kk-area-name').textContent;

                        if (
                            areaScreen &&
                            areaScreen.classList.contains('active') &&
                            activeKkCharId === charId &&
                            currentAreaNameTitle === areaName
                        ) {
                            document.getElementById('kk-area-background').style.backgroundImage = `url(${areaUrl})`;
                            console.log(`🎨 已实时刷新区域[${areaName}]背景`);
                        }
                    }
                }

                console.log('🎉 所有房屋图片生成完毕！');
            } catch (imgError) {
                console.error('后台图片生成流程发生不可恢复的错误:', imgError);
            }
        })();


        return houseData;
    } catch (error) {
        console.error('生成房屋数据失败:', error);
        await showCustomAlert('生成失败', `发生错误: ${error.message}`);
        return null;
    } finally {
        document.getElementById('generation-overlay').classList.remove('visible');
    }
}

/**
 * 渲染房屋总览视图
 * @param {object} houseData - 角色的房屋数据
 */
function renderKkHouseView(houseData) {
    document.getElementById('kk-house-owner-name').textContent = `${state.chats[activeKkCharId].name}的家`;
    document.getElementById('kk-house-background').style.backgroundImage = `url(${houseData.locationImageUrl})`;
    document.getElementById('kk-house-location').textContent = houseData.location;
    document.getElementById('kk-house-description').textContent = houseData.description;

    const areasContainer = document.getElementById('kk-house-areas');
    areasContainer.innerHTML = '';
    for (const areaName in houseData.areas) {
        const areaBtn = document.createElement('button');
        areaBtn.className = 'kk-area-button';
        areaBtn.textContent = areaName;
        areaBtn.onclick = () => openKkAreaView(areaName);
        areasContainer.appendChild(areaBtn);
    }
}


/**
 * 打开并渲染指定区域的探索视图
 * @param {string} areaName - 区域名称, e.g., "客厅"
 */
function openKkAreaView(areaName) {
    const chat = state.chats[activeKkCharId];
    const areaData = chat.houseData.areas[areaName];
    if (!areaData) return;

    document.getElementById('kk-area-name').textContent = areaName;
    document.getElementById('kk-area-background').style.backgroundImage = `url(${areaData.imageUrl})`;
    document.getElementById('kk-area-description').textContent = areaData.description;

    const itemsGrid = document.getElementById('kk-area-items-grid');
    itemsGrid.innerHTML = '';

    // ★★★★★ 核心修复在这里 ★★★★★
    // 我们现在遍历的是对象数组，所以要使用 item.name
    areaData.items.forEach(item => {
        const itemBtn = document.createElement('button');
        itemBtn.className = 'kk-item-button';
        // 1. 修复：按钮上显示的文字应该是对象的 name 属性
        itemBtn.textContent = item.name;

        // 2. 修复：点击时传递给 handleRummage 的也应该是 name 字符串
        itemBtn.onclick = () => handleRummage(areaName, item.name);

        itemsGrid.appendChild(itemBtn);
    });
    // ★★★★★ 修复结束 ★★★★★

    showScreen('kk-area-view-screen');
}

/**
 * 处理“翻找”动作 (不再调用AI，直接读取已生成的数据)
 * @param {string} areaName - 区域名
 * @param {string} itemName - 物品名
 */
function handleRummage(areaName, itemName) {
    // 核心修改：如果是电脑，就调用新函数
    if (itemName.toLowerCase() === '电脑' || itemName.toLowerCase() === 'computer') {
        openComputer();
        return;
    }

    const chat = state.chats[activeKkCharId];
    const area = chat.houseData.areas[areaName];
    // 在物品数组中查找被点击的那一项
    const item = area.items.find(i => i.name === itemName);

    if (item && item.content) {
        // 如果找到了，就显示预设好的内容
        showCustomAlert(`在“${itemName}”里`, item.content.replace(/\n/g, '<br>'));
    } else {
        // 如果因为某些原因没找到（理论上不应该发生），给一个备用提示
        showCustomAlert(`在“${itemName}”里`, '仔细翻了翻，但什么特别的东西都没发现...');
    }
}

/**
 * 处理“重新翻找”按钮的点击事件
 * 这会清空旧数据，并调用AI重新生成一个全新的家。
 */
async function handleResetKkHouse() {
    if (!activeKkCharId) return;

    const confirmed = await showCustomConfirm(
        '确认重新生成',
        '你确定要重新生成这个家吗？所有现有的区域和物品都将被覆盖，此操作不可撤销。',
        { confirmButtonClass: 'btn-danger' },
    );

    if (confirmed) {
        const chat = state.chats[activeKkCharId];
        // 直接调用你已有的房屋生成函数
        const generatedData = await generateHouseData(activeKkCharId);
        if (generatedData) {
            chat.houseData = generatedData; // 用新数据覆盖旧数据
            await db.chats.put(chat); // 保存到数据库
            renderKkHouseView(chat.houseData); // 重新渲染界面
            alert('一个全新的家已经生成！');
        }
    }
}

/**
 * 处理“继续翻找”按钮的点击事件
 * 这会保留现有房屋结构，只让AI为每个区域或电脑添加新的可翻找物品/发现。
 */
async function handleContinueKkSearch() {
    if (!activeKkCharId) return;
    const chat = state.chats[activeKkCharId];
    if (!chat || !chat.houseData) {
        alert('还没有为这个角色生成家，请先“重新翻找”一次。');
        return;
    }

    showGenerationOverlay('正在努力寻找中...');

    try {
        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) throw new Error('API未配置');

        // 准备一个只包含现有物品名的上下文，告诉AI不要重复
        let existingItemsContext = '# 已有物品 (请生成与之不同的新物品或发现)\n';
        for (const areaName in chat.houseData.areas) {
            const area = chat.houseData.areas[areaName];
            existingItemsContext += `## ${areaName}:\n`;
            existingItemsContext += area.items.map(item => `- ${item.name}`).join('\n') + '\n';
        }

        const systemPrompt = `
			# 任务
			你是一个场景补充设计师。用户正在对角色“${chat.name}”的住所进行【补充翻找】。
			你的任务是在【不改变现有结构】的基础上，为【指定的区域】或【电脑】添加2-3个全新的、有趣的、符合人设的可翻找物品或新发现。

			# 角色信息
			- 人设: ${chat.settings.aiPersona}
			- 已有房屋数据:
			${JSON.stringify(chat.houseData, null, 2)}
			${existingItemsContext}

			# 核心规则
			1.  **只添加，不修改**: 你只能添加新物品/发现，绝对不能修改或删除已有的数据。
			2.  **内容丰富**: 新发现的物品/文件/记录的 "content" 必须充满细节和想象力，不要总是“什么都没找到”。
			3.  **格式铁律**: 你的回复【必须且只能】是一个JSON对象，其结构与下方示例完全一致。键是区域名或"computer"，值是一个包含新物品/发现的数组或对象。

			# JSON输出格式示例 (只返回【新增】的物品/发现)
			{
			  "客厅": [
			    {"name": "书架顶层", "content": "发现一本被遗忘的旧相册。"}
			  ],
			  "computer": {
			    "local_files": [{"fileName": "一封未发送的邮件.eml", "content": "邮件内容..."}],
			    "browser_history": ["P站-插画欣赏"],
			    "movies": ["经典电影C.rmvb"],
			    "steam_games": [
			      {"name": "赛博朋克 2077", "playtime": "150 小时"},
			      {"name": "艾尔登法环", "playtime": "300 小时"},
			      {"name": "博德之门3", "playtime": "200 小时"}
			    ]
			  }
			}
			`;
        const messagesForApi = [{ role: 'user', content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 0.9 }),
            });

        if (!response.ok) throw new Error(await response.text());

        const data = await response.json();
        const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
            /^```json\s*|```$/g,
            '',
        );
        const newItemsData = JSON.parse(rawContent);

        // 将AI返回的新物品/发现合并到旧数据中
        for (const key in newItemsData) {
            // 如果是电脑数据
            if (key === 'computer') {
                const computerUpdates = newItemsData.computer;
                for (const subKey in computerUpdates) {

                    // 确保原始数据里有这个数组，如果没有就创建一个
                    if (!chat.houseData.computer[subKey]) {
                        chat.houseData.computer[subKey] = [];
                    }
                    // 确保两个都是数组再合并
                    if (Array.isArray(chat.houseData.computer[subKey]) && Array.isArray(computerUpdates[subKey])) {
                        chat.houseData.computer[subKey].push(...computerUpdates[subKey]);
                    }
                }
            }
            // 如果是区域物品数据
            else if (chat.houseData.areas[key] && Array.isArray(newItemsData[key])) {
                chat.houseData.areas[key].items.push(...newItemsData[key]);
            }
        }

        await db.chats.put(chat);
        alert('翻找出了更多新东西！现在可以进入区域或电脑查看了。');
    } catch (error) {
        console.error('继续翻找失败:', error);
        await showCustomAlert('操作失败', `发生错误: ${error.message}`);
    } finally {
        document.getElementById('generation-overlay').classList.remove('visible');
    }
}

function openComputer() {
    const chat = state.chats[activeKkCharId];
    document.getElementById('kk-computer-header').querySelector('span').textContent = `${chat.name}的电脑`;

    const desktop = document.getElementById('kk-computer-desktop');
    // 使用Flexbox布局来更好地排列图标
    desktop.style.display = 'flex';
    desktop.style.flexWrap = 'wrap';
    desktop.style.gap = '20px';
    desktop.style.padding = '20px';
    desktop.style.alignContent = 'flex-start';

    // 获取电脑数据，用于动态显示文件名
    const computerData = chat.houseData?.computer || {};
    const secretFolderName = computerData.secret_folder?.fileName || '加密文件夹';

    desktop.innerHTML = `
			        <div class="kk-desktop-icon" id="kk-browser-icon" title="浏览器">
			            <img src="https://i.postimg.cc/gc7tpbwp/浏览器图标.png" alt="Browser">
			            <span>浏览器</span>
			        </div>

			        <div class="kk-desktop-icon" id="kk-movies-icon" title="电影">
			            <img src="https://i.postimg.cc/gc7tpbwd/电影.png" alt="Movies">
			            <span>电影</span>
			        </div>
			        <div class="kk-desktop-icon" id="kk-files-icon" title="私人文件">
			            <img src="https://i.postimg.cc/9Xkg2H4h/48.png" alt="Files">
			            <span>私人文件</span>
			        </div>
			        <div class="kk-desktop-icon" id="kk-secret-folder-icon" title="隐秘文件夹">
			            <img src="https://i.postimg.cc/SQP14bXp/File_Dead_Big_Thumb.png" alt="Secret Folder">
			            <span>${secretFolderName}</span>
			        </div>
			        <div class="kk-desktop-icon" id="kk-steam-icon" title="Steam">
			            <img src="https://i.postimg.cc/xjZpQVkD/steam.png" alt="Steam">
			            <span>Steam</span>
			        </div>
			    `;

    document.getElementById('kk-computer-modal').classList.add('visible');
}

/**
 * 打开文件浏览器，为每个文件项添加data-*属性以便后续点击处理。
 */
function openFileExplorer() {
    const computerData = state.chats[activeKkCharId]?.houseData?.computer;
    const files = computerData?.local_files || [];
    const listEl = document.getElementById('kk-file-list');
    listEl.innerHTML = '';

    if (files.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">这个文件夹是空的</p>';
    } else {
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'kk-file-item';
            item.textContent = file.fileName;

            // 1. 让鼠标悬浮时显示为可点击的手指形状
            item.style.cursor = 'pointer';
            // 2. 将文件名和文件内容存储到元素的 data-* 属性中，方便之后读取
            item.dataset.fileName = file.fileName;
            item.dataset.fileContent = encodeURIComponent(file.content || '（文件内容为空）');

            listEl.appendChild(item);
        });
    }

    document.getElementById('kk-file-explorer-modal').classList.add('visible');
}

/**
 * 【全新】打开专用的文件内容查看器
 * @param {string} fileName - 文件名，用于显示在弹窗标题
 * @param {string} fileContent - 文件内容，用于显示在弹窗主体
 */
function openFileViewer(fileName, fileContent) {
    document.getElementById('kk-file-viewer-title').textContent = fileName;
    // 使用 decodeURIComponent 解码之前存储的内容，并显示出来
    document.getElementById('kk-file-viewer-content').textContent = decodeURIComponent(fileContent);
    document.getElementById('kk-file-viewer-modal').classList.add('visible');
}

/**
 * 【全新】关闭文件内容查看器
 */
function closeFileViewer() {
    document.getElementById('kk-file-viewer-modal').classList.remove('visible');
}


/**
 * 打开Steam游戏库弹窗并渲染内容
 */
function openSteamScreen() {
    renderSteamScreen();
    document.getElementById('kk-steam-modal').classList.add('visible');
}

/**
 * 渲染Steam游戏库列表
 */
function renderSteamScreen() {
    if (!activeKkCharId) return;
    const computerData = state.chats[activeKkCharId]?.houseData?.computer;
    const games = computerData?.steam_games || [];
    const listEl = document.getElementById('kk-steam-games-list');
    listEl.innerHTML = '';

    if (games.length === 0) {
        listEl.innerHTML =
            '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">游戏库是空的，试着点击右上角“+”生成一些游戏吧！</p>';
    } else {
        // 让游戏按时长倒序排列
        games.sort((a, b) => {
            const timeA = parseFloat(a.playtime) || 0;
            const timeB = parseFloat(b.playtime) || 0;
            return timeB - timeA;
        });

        games.forEach((game, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'character-data-item'; // 复用现有样式
            itemEl.innerHTML = `
			                <div class="title">${game.name}</div>
			                <div class="content">总游玩时长: ${game.playtime}</div>
			                <button class="item-delete-btn" data-type="computer.steam_games" data-index="${index}" title="删除这个游戏记录">×</button>
			            `;
            listEl.appendChild(itemEl);
        });
    }
}

/**
 * 为Steam游戏库生成更多游戏
 */
async function generateMoreSteamGames() {
    if (!activeKkCharId) return;
    const chat = state.chats[activeKkCharId];
    if (!chat.houseData?.computer) {
        alert('请先为角色生成一次完整的房屋数据。');
        return;
    }

    document.getElementById('generation-overlay').classList.add('visible');

    try {
        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) throw new Error('API未配置');

        const existingGames = (chat.houseData.computer.steam_games || []).map(g => g.name).join(', ');
        const prompt = `
			# 任务
			你是一个游戏数据生成器。请根据角色“${chat.name}”的人设，为他/她的Steam游戏库生成2-3款【全新的】PC游戏记录。

			# 角色人设
			${chat.settings.aiPersona}

			# 已有游戏 (请不要重复生成以下游戏)
			${existingGames || '无'}

			# JSON输出格式 (必须严格遵守)
			{
			  "steam_games": [
			    {"name": "【新游戏名1】", "playtime": "【游玩时长，例如：50 小时】"},
			    {"name": "【新游戏名2】", "playtime": "【游玩时长】"}
			  ]
			}
			`;
        const messagesForApi = [{ role: 'user', content: prompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 0.9 }),
            });

        if (!response.ok) throw new Error(await response.text());

        const data = await response.json();
        const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
            /^```json\s*|```$/g,
            '',
        );
        const newData = JSON.parse(rawContent);

        if (newData.steam_games && Array.isArray(newData.steam_games)) {
            if (!chat.houseData.computer.steam_games) {
                chat.houseData.computer.steam_games = [];
            }
            chat.houseData.computer.steam_games.push(...newData.steam_games);
            await db.chats.put(chat);
            renderSteamScreen();
            alert('已添加新的游戏记录！');
        } else {
            throw new Error('AI返回的数据格式不正确。');
        }
    } catch (error) {
        console.error('生成更多游戏失败:', error);
        await showCustomAlert('生成失败', `发生错误: ${error.message}`);
    } finally {
        document.getElementById('generation-overlay').classList.remove('visible');
    }
}

/**
 * 打开监控视图，并处理数据获取和渲染
 * @param {string} charId - 当前查看的角色ID
 */
async function openSurveillanceView(charId) {
    if (!charId) return;
    const chat = state.chats[charId];
    if (!chat || !chat.houseData) {
        alert('找不到角色的房屋数据，请先生成房屋。');
        return;
    }

    document.getElementById('kk-monitor-title').textContent = `${chat.name}的监控中心`;

    const fiveMinutes = 5 * 60 * 1000;
    const surveillance = chat.houseData.surveillanceData;

    if (!surveillance || !surveillance.feeds || Date.now() - (surveillance.timestamp || 0) > fiveMinutes) {
        try {
            const newSurveillanceData = await generateInitialSurveillanceFeeds(charId);
            if (newSurveillanceData) {
                // 保存完整的对象，包含时间戳、位置和画面数据
                chat.houseData.surveillanceData = {
                    timestamp: Date.now(),
                    characterLocation: newSurveillanceData.characterLocation,
                    feeds: newSurveillanceData.feeds,
                };
                await db.chats.put(chat);
                renderSurveillanceView(chat.houseData.surveillanceData); // 渲染新数据
            } else {
                document.getElementById('kk-monitor-grid').innerHTML =
                    '<p style="text-align:center; color: #8a8a8a;">无法生成监控画面。</p>';
            }
        } catch (error) {
            await showCustomAlert('生成失败', `生成监控画面时出错: ${error.message}`);
            return;
        }
    } else {
        console.log('从缓存加载监控画面。');
        // 直接将保存的完整对象传给渲染函数
        renderSurveillanceView(surveillance);
    }

    showScreen('kk-monitor-screen');
}

/**
 * 调用AI为指定角色生成所有区域的初次监控画面
 * @param {string} charId - 角色ID
 * @returns {Promise<object|null>} - 包含角色位置和各区域画面的对象，或在失败时返回null
 */
async function generateInitialSurveillanceFeeds(charId) {
    const chat = state.chats[charId];
    showGenerationOverlay('正在接入监控信号...');

    try {
        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) throw new Error('API未配置');

        // 提取世界书、聊天记录和用户人设作为上下文
        const worldBookContext = (
            await Promise.all(
                (chat.settings.linkedWorldBookIds || []).map(async id => {
                    const book = await db.worldBooks.get(id);
                    return book ? `\n## 世界书: ${book.name}\n${book.content}` : '';
                }),
            )
        ).join('');

        const recentHistory = chat.history
            .slice(-10)
            .map(msg => {
                const sender = msg.role === 'user' ? chat.settings.myNickname || '我' : chat.name;
                return `${sender}: ${msg.content}`;
            })
            .join('\n');

        const userPersona = state.chats[charId]?.settings?.myPersona || '一个普通的观察者。';

        const areaNames = Object.keys(chat.houseData.areas);

        const systemPrompt = `
			# 任务
			你是一个全知的监控系统AI。你的任务是根据角色的人设和近期活动，为他家中的【每一个区域】生成实时监控画面描述，并明确指出角色【当前所在】的区域。

			# 角色与观察者信息
			- 角色名: ${chat.name}
			- 角色人设: ${chat.settings.aiPersona}
			- 观察者(用户)人设: ${userPersona}
			${worldBookContext || ''}
			- 最近的聊天记录 (供你参考情景):
			${recentHistory}

			# 住所布局
			角色当前的住所包含以下区域: ${areaNames.join('、 ')}

			# 核心规则
			1.  **视角**: 你的描述必须是【客观、冷静的第三人称视角】，就像一个真正的监控摄像头记录的画面。
			2.  **内容**: 描述【此时此刻】角色可能正在每个区域做什么。如果角色不在某个区域，就描述该区域的静态环境。
			3.  **实时性**: 描述必须体现“现在正在发生”的感觉。
			4.  **【【【格式铁律】】】**: 你的回复【必须且只能】是一个严格的JSON对象。
			    -   该JSON对象必须包含一个顶级键 \`characterLocation\`，其值必须是角色当前所在的区域名字符串 (例如: "卧室")。
			    -   该JSON对象还必须包含一个顶级键 \`feeds\`，其值是一个JSON对象，其中每个键是区域名，每个值是**另一个**JSON对象，包含以下两个字段:
			        -   \`"description"\`: (字符串) 该区域的监控画面描述。
			        -   \`"isCharacterPresent"\`: (布尔值) 角色当前是否在该区域内（true 或 false）。

			# JSON输出格式示例 (必须严格遵守):
			{
			  "characterLocation": "卧室",
			  "feeds": {
			    "客厅": {
			      "description": "客厅里很安静，角色并不在这里。电视屏幕是黑的，沙发上随意搭着一件外套。",
			      "isCharacterPresent": false
			    },
			    "卧室": {
			      "description": "角色正坐在床边，低头看着手机，手指快速地在屏幕上滑动，嘴角似乎带着一丝微笑。",
			      "isCharacterPresent": true
			    }
			  }
			}
			`;

        const messagesForApi = [{ role: 'user', content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 0.8 }),
            });

        if (!response.ok) throw new Error(`API请求失败: ${await response.text()}`);

        const data = await response.json();
        const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
            /^```json\s*|```$/g,
            '',
        );
        const surveillanceData = JSON.parse(rawContent);

        return surveillanceData;
    } catch (error) {
        console.error('生成监控画面失败:', error);
        throw error;
    } finally {
        document.getElementById('generation-overlay').classList.remove('visible');
    }
}

/**
 * 将监控数据渲染到屏幕上
 * @param {object} surveillanceData - 包含角色位置和画面的完整对象
 */
function renderSurveillanceView(surveillanceData) {
    const gridEl = document.getElementById('kk-monitor-grid');
    gridEl.innerHTML = '';
    const chat = state.chats[activeKkCharId];
    if (!chat) return;

    const { characterLocation, feeds } = surveillanceData;

    if (!feeds || Object.keys(feeds).length === 0) {
        gridEl.innerHTML = '<p style="text-align:center; color: #8a8a8a;">无法加载监控画面。</p>';
        return;
    }

    for (const areaName in feeds) {
        const feedData = feeds[areaName];
        const area = chat.houseData.areas[areaName];
        const isCharacterPresent = feedData.isCharacterPresent;

        const feedEl = document.createElement('div');
        feedEl.className = 'kk-monitor-item';
        // 将区域名存到 data-* 属性中，方便事件委托时获取
        feedEl.dataset.areaName = areaName;

        if (area && area.imageUrl) {
            feedEl.style.backgroundImage = `url(${area.imageUrl})`;
        } else {
            feedEl.style.backgroundColor = '#333';
        }

        if (areaName === characterLocation) {
            feedEl.classList.add('active-character-location');
        }

        // 只有当角色在该区域时，才显示互动按钮
        const interactionControlsHtml = isCharacterPresent
            ? `
			            <div class="monitor-interaction-controls">
			                <button class="monitor-btn" data-action="reroll" title="重Roll">🔄</button>
			                <button class="monitor-btn" data-action="continue" title="继续监控">➡️</button>
			                <button class="monitor-btn" data-action="speak" title="对话">🎤</button>
			            </div>`
            : '';

        feedEl.innerHTML = `
			            <div class="monitor-header">
			                <span>${areaName}</span>
			                <div class="rec-dot"></div>
			            </div>
			            <div class="frosted-glass-panel">
			                <div class="monitor-content-text">${feedData.description}</div>
			                ${interactionControlsHtml}
			            </div>
			        `;

        gridEl.appendChild(feedEl);
    }
}

/**
 * 处理监控画面中所有互动按钮点击的事件委托
 * 增加了变声器设置面板
 */
async function handleMonitorInteraction(areaName, action, feedElement) {
    const contentTextElement = feedElement.querySelector('.monitor-content-text');
    const currentContent = contentTextElement.textContent; // 获取当前画面内容

    if (action === 'speak') {
        // ... (变声器HTML定义部分保持不变) ...
        const extraHtml = `
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #eee; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 14px; color: #333; font-weight: 500;">🕵️ 使用变声器</span>
                <label class="toggle-switch" style="transform: scale(0.8);">
                    <input type="checkbox" id="monitor-voice-toggle">
                    <span class="slider"></span>
                </label>
            </div>
            <div id="monitor-voice-input-container" style="display: none; animation: fadeIn 0.3s;">
                <label style="font-size: 12px; color: #666;">伪装身份:</label>
                <input type="text" id="monitor-voice-identity" placeholder="例如: 外卖员, 幽灵 (留空默认为陌生人)" 
                       style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 6px; font-size: 13px;">
            </div>
        </div>
        `;

        let tempVoiceSettings = { enabled: false, identity: '' };

        const promptPromise = showCustomPrompt(`对【${areaName}】喊话`, '请输入你想说的话：', '', 'text', extraHtml);

        setTimeout(() => {
            const toggle = document.getElementById('monitor-voice-toggle');
            const container = document.getElementById('monitor-voice-input-container');
            const identityInput = document.getElementById('monitor-voice-identity');

            if (toggle && container && identityInput) {
                toggle.addEventListener('change', e => {
                    tempVoiceSettings.enabled = e.target.checked;
                    container.style.display = e.target.checked ? 'block' : 'none';
                    if (e.target.checked) identityInput.focus();
                });
                identityInput.addEventListener('input', e => {
                    tempVoiceSettings.identity = e.target.value;
                });
            }
        }, 50);

        const userInput = await promptPromise;

        if (userInput && userInput.trim()) {
            // 在最后增加传入 currentContent
            await generateMonitorDialogue(areaName, userInput, contentTextElement, tempVoiceSettings, currentContent);
        }
    } else {
        // Reroll 和 Continue 逻辑
        const newContent = await generateMonitorUpdate(
            areaName,
            action === 'continue' ? currentContent : null, // Continue会传入当前内容
            contentTextElement,
        );
        if (newContent) {
            contentTextElement.innerHTML = newContent;
        }
    }
}

/**
 * 生成监控画面的“下一帧”或“重Roll”
 * @param {string} areaName - 区域名
 * @param {string|null} context - 上一帧的内容（如果是重Roll则为null）
 * @param {HTMLElement} textElement - 用于显示加载状态的文本元素
 * @returns {Promise<string|null>} - 新的画面描述
 */
async function generateMonitorUpdate(areaName, context, textElement) {
    const chat = state.chats[activeKkCharId];
    if (!chat) return null;

    textElement.innerHTML = '<i>正在刷新信号...</i>';

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        textElement.innerHTML = '<i style="color: #ff8a80;">API未配置</i>';
        return null;
    }

    // 优化Prompt，区分“继续”和“重Roll”
    let promptInstructions = '';
    if (context) {
        // 这种情况是点击了“继续”箭头
        promptInstructions = `
        # 上一秒的画面 (Context)
        “${context}”
        
        # 任务
        请基于“上一秒的画面”，**顺延时间线**描述下一秒发生了什么。
        行为必须连贯。例如：如果刚才拿起了杯子，现在可能是正在喝水；如果刚才在看手机，现在可能是看到了好笑的消息。
        不要跳跃到完全不相关的动作。
    `;
    } else {
        // 这种情况是点击了“重Roll”刷新
        promptInstructions = `
        # 任务
        请忽略之前的状态，**重新生成**一个该角色在【${areaName}】里的全新随机状态/事件。
    `;
    }

    const prompt = `
			你是一个监控系统AI，正在观察角色“${chat.name}”在【${areaName}】区域的活动。
            角色人设：${chat.settings.aiPersona}
            
            ${promptInstructions}

			你的描述必须是客观的第三人称视角，就像摄像头记录的一样。
			如果角色说话，请用引号包裹。
			你的回复只能是纯文本，不要包含任何JSON或额外说明。
			`;

    try {
        let isGemini = proxyUrl === GEMINI_API_URL;
        let messagesForApi = [{ role: 'user', content: prompt }];
        let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 0.9 }),
            });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        return (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).trim();
    } catch (error) {
        textElement.innerHTML = `<i style="color: #ff8a80;">信号中断: ${error.message}</i>`;
        return null;
    }
}

/**
 * 处理通过监控进行的对话 (支持变声器 + 用户人设注入 + 上下文感知)
 * @param {string} areaName - 区域名
 * @param {string} userInput - 用户说的话
 * @param {HTMLElement} textElement - 用于显示加载状态的文本元素
 * @param {object} voiceSettings - 变声器设置
 * @param {string} currentContext - ★新增参数：对话发生前的画面描述
 */
async function generateMonitorDialogue(areaName, userInput, textElement, voiceSettings, currentContext) {
    const chat = state.chats[activeKkCharId];
    if (!chat) return;

    textElement.innerHTML = '<i>等待对方回应...</i>';

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        textElement.innerHTML = '<i style="color: #ff8a80;">麦克风故障: API未配置</i>';
        return;
    }

    const userNickname = chat.settings.myNickname || state.qzoneSettings.nickname || '我';
    const userPersona = chat.settings.myPersona || '没有特定人设，普通用户。';

    let soundSourceDescription = '';
    let uiSourceLabel = '';

    if (voiceSettings && voiceSettings.enabled) {
        const identity = voiceSettings.identity ? voiceSettings.identity.trim() : '陌生人';
        soundSourceDescription = `监控扬声器里传来一个**经过变声处理的、陌生的声音**。这个声音听起来像是一个【${identity}】。那个声音对你说：“${userInput}”。\n【重要指令】：你完全没有听出这是${userNickname}的声音。`;
        uiSourceLabel = `(伪装成: ${identity})`;
    } else {
        soundSourceDescription = `监控扬声器里传来了你非常熟悉的、用户（${userNickname}）的声音。${userNickname}通过监控对你说：“${userInput}”。\n# 说话人（${userNickname}）的人设：${userPersona}\n【重要指令】：你立刻就听出了这是${userNickname}的声音，请自然互动。`;
        uiSourceLabel = `(你)`;
    }

    // 在Prompt中加入当前上下文
    const prompt = `
    # 角色扮演任务
    你现在是角色“${chat.name}”，你正在【${areaName}】里。
    
    # 此时此刻的状态 (上下文)
    就在刚才，**${currentContext || '你在房间里发呆'}**。
    
    # 突发事件
    突然，${soundSourceDescription}

    # 你的角色人设
    ${chat.settings.aiPersona}

    # 你的任务
    请以【第一人称】，**紧接着刚才的状态**，对这句突如其来的话做出【反应】。
    如果刚才你在睡觉，你现在可能被吵醒；如果刚才你在看书，你可能会放下书。
    你的回复应该包含你的【心理活动、动作、以及说出的话】。
    你的回复只能是纯文本。
    `;

    try {
        let isGemini = proxyUrl === GEMINI_API_URL;
        let messagesForApi = [{ role: 'user', content: prompt }];
        let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 0.8 }),
            });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        const aiResponse = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).trim();

        textElement.innerHTML = `“${userInput}” <i style="font-size:12px; opacity:0.8;">${uiSourceLabel}</i><br><br>${aiResponse}`;
    } catch (error) {
        textElement.innerHTML = `<i style="color: #ff8a80;">通讯失败: ${error.message}</i>`;
    }
}

/**
 * 当用户点击“刷新”时，生成所有区域的新状态
 * @param {string} charId - 角色ID
 * @returns {Promise<object|null>} - 新的完整监控数据
 */
async function generateSurveillanceUpdate(charId) {
    const chat = state.chats[charId];
    if (!chat || !chat.houseData) return null;

    showGenerationOverlay('正在刷新所有监控...');

    const lastSurveillance = chat.houseData.surveillanceData;

    try {
        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) throw new Error('API未配置');

        const systemPrompt = `
			# 任务
			你是一个全知的监控系统AI。你的任务是基于角色“${chat.name
            }”的【上一个状态】，推断出【下一秒钟】他可能做的行动，并更新所有监控区域的画面。他可能会从一个房间移动到另一个房间。

			# 角色信息
			- 人设: ${chat.settings.aiPersona}

			# 上一秒的监控状态 (重要参考)
			${JSON.stringify(lastSurveillance, null, 2)}

			# 核心规则
			1.  **逻辑连贯**: 你的更新必须基于上一秒的状态，做出合乎逻辑的推断。例如，如果上一秒在卧室看手机，下一秒可能是继续看、放下手机准备睡觉，或是走出卧室去客厅。
			2.  **角色移动**: 角色【有可能】移动到新的区域。你【必须】在 \`characterLocation\` 字段中准确指出他的新位置。
			3.  **状态更新**: 【所有】区域的画面描述都必须更新。如果角色进入了新区域，该区域的 \`isCharacterPresent\` 必须变为 \`true\`，旧区域的必须变为 \`false\`。
			4.  **格式铁律**: 你的回复【必须】严格遵守与初始生成时完全相同的JSON格式。

			现在，请生成下一秒的完整监控数据。
			`;

        const messagesForApi = [{ role: 'user', content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 0.8 }),
            });

        if (!response.ok) throw new Error(await response.text());

        const data = await response.json();
        const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
            /^```json\s*|```$/g,
            '',
        );
        return JSON.parse(rawContent);
    } catch (error) {
        console.error('刷新监控画面失败:', error);
        await showCustomAlert('刷新失败', `发生错误: ${error.message}`);
        return null;
    } finally {
        document.getElementById('generation-overlay').classList.remove('visible');
    }
}
/**
 * 显示加载动画并设置指定的文字
 * @param {string} text - 要显示的加载提示文字
 */
function showGenerationOverlay(text) {
    const overlay = document.getElementById('generation-overlay');
    const textElement = document.getElementById('generation-text');
    if (textElement) {
        textElement.textContent = text;
    }
    overlay.classList.add('visible');
}
