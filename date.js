// date.js

// 约会大作战App核心功能全局变量
let currentDatingScenes = []; // 存储所有已生成的约会场景
let isGeneratingScenes = false; // 标记是否正在生成场景
let currentDatingUISettings = null; // 存储约会界面设置

/**
 * 打开"约会大作战"App，快速显示已保存数据
 */
async function openDatingApp() {
    console.log("打开约会大作战App...");
    showScreen("date-a-live-screen");
    // 从数据库加载所有已保存的场景
    currentDatingScenes = await db.datingScenes.toArray();
    console.log(`从数据库加载了 ${currentDatingScenes.length} 个约会场景。`);
    // 渲染这些场景（只会先显示文字和加载动画）
    renderDatingScenes();
}

/**
 * 调用AI生成新的一批约会场景，并只保存场景数据
 */
async function refreshDatingScenes() {
    if (isGeneratingScenes) {
        alert("正在加载中，请不要着急哦~");
        return;
    }
    isGeneratingScenes = true;

    const contentEl = document.getElementById("dating-scene-content");
    const loadingIndicator = document.createElement("p");
    loadingIndicator.textContent = "AI正在构思新的约会方案...";
    loadingIndicator.style.textAlign = "center";
    loadingIndicator.style.color = "var(--text-secondary)";
    contentEl.innerHTML = ""; // 先清空旧场景
    contentEl.appendChild(loadingIndicator);

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        loadingIndicator.textContent = "API未配置，无法生成场景！";
        loadingIndicator.style.color = "red";
        isGeneratingScenes = false;
        return;
    }

    // Prompt保持不变
    const prompt = `
                        # 任务
                        你是一位顶级约会策划师，尤其擅长营造浪漫氛围。请为我策划 3-5 个适合情侣的、日常且极具浪漫情调的约会场景。

                        # 核心规则
                        1.  **场景风格**: 场景必须是现实生活中可以实现的，但要富有想象力和浪漫气息。**绝对禁止**任何黑暗、恐怖或令人不适的元素。
                        2.  **场景多样性**: 请包含多种类型的地点，例如：
                            -   **户外**: 公园、海边、路边小吃摊。
                            -   **室内**: 温馨的咖啡馆、艺术展、书店。
                            -   **住宿**: 普通的温馨酒店、电竞酒店、甚至可以来点新奇的情趣酒店。
                        3.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，直接以'['开头, 以']'结尾。
                        4.  **内容要求**: 每个场景对象【必须】包含以下三个字段:
                            -   \`"name"\`: (字符串) 一个充满浪漫想象的日常约会场景名称 (例如: "星空下的电竞双排夜", "微醺路边摊的夏日晚风", "私语书店的角落")。
                            -   \`"cost"\`: (数字) 一个代表浪漫程度的虚拟花费 (例如: 288, 520, 999)。
                            -   \`"imagePrompt"\`: (字符串) 一个用于文生图的、纯英文的、详细的【纯风景或静物】描述，用于生成场景图片。【绝对不能包含人物、情侣或任何人】。图片风格必须是【浪漫唯美的 (romantic, beautiful, aesthetic)】，可以使用 anime style, vibrant colors, soft lighting, masterpiece 等词汇来增强艺术感。

                        # JSON输出格式示例:
                        [
                            {
                                "name": "雨后公园的七彩霓虹",
                                "cost": 188,
                                "imagePrompt": "a peaceful park after rain, wet cobblestone path reflecting neon city lights, rainbow puddle, glowing lanterns on trees, beautiful, aesthetic, anime style, masterpiece, vibrant colors"
                            }
                        ]
                    `;

    try {
        const messagesForApi = [{ role: "user", content: prompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 1.1, response_format: { type: "json_object" } }),
            });

        if (!response.ok) throw new Error(`API请求失败: ${await response.text()}`);

        const data = await response.json();
        const rawContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
        const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
        const newScenes = JSON.parse(cleanedContent);

        if (Array.isArray(newScenes)) {
            // 核心修改：只添加uid和空的imageUrl，不再立即生成图片
            const scenesWithId = newScenes.map((scene, index) => ({
                ...scene,
                uid: "scene_" + Date.now() + index,
                imageUrl: "", // 初始化时图片链接为空
            }));

            await db.datingScenes.bulkAdd(scenesWithId);

            // 更新内存数据，并重新渲染（此时图片还是加载中状态）
            currentDatingScenes.push(...scenesWithId);
            renderDatingScenes();
        } else {
            throw new Error("AI返回的数据不是有效的数组。");
        }
    } catch (error) {
        console.error("生成约会场景失败:", error);
        contentEl.innerHTML = `<p style="text-align:center; color:red;">生成失败: ${error.message}</p>`;
    } finally {
        isGeneratingScenes = false;
    }
}

/**
 * 渲染所有约会场景卡片，并异步加载图片
 */
function renderDatingScenes() {
    const contentEl = document.getElementById("dating-scene-content");
    contentEl.innerHTML = ""; // 每次都清空再渲染

    if (currentDatingScenes.length === 0) {
        // 如果数据库是空的，显示提示并触发一次生成
        if (!isGeneratingScenes) {
            contentEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 50px 0;">正在为你构思浪漫的约会方案...</p>';
            refreshDatingScenes();
        }
        return;
    }

    // 核心修改：使用 forEach 立即渲染所有卡片
    currentDatingScenes.forEach((scene) => {
        const card = createDatingSceneCard(scene);
        contentEl.appendChild(card);
        // 核心修改：调用新的异步函数去处理图片
        loadAndDisplaySceneImage(scene);
    });
}

/**
 * 为单个场景加载或生成图片，并更新其卡片
 * @param {object} scene - 约会场景对象
 */
async function loadAndDisplaySceneImage(scene) {
    const card = document.querySelector(`.dating-scene-card[data-uid="${scene.uid}"]`);
    if (!card) return;
    const imageContainer = card.querySelector(".dating-scene-image-container");

    // 1. 如果数据库里已经有图片URL，直接使用它
    if (scene.imageUrl) {
        imageContainer.innerHTML = `<img src="${scene.imageUrl}" alt="${scene.name}">`;
        return;
    }

    // 2. 如果没有URL，说明需要生成
    try {
        const imageUrl = await generateAndLoadImage(scene.imagePrompt);
        // 生成成功后，更新UI
        if (document.body.contains(imageContainer)) {
            imageContainer.innerHTML = `<img src="${imageUrl}" alt="${scene.name}">`;
        }

        // 关键：将新生成的URL保存回数据库！
        scene.imageUrl = imageUrl;
        await db.datingScenes.update(scene.uid, { imageUrl: imageUrl });
        console.log(`为场景 "${scene.name}" 生成并保存了新图片。`);
    } catch (error) {
        console.error(`场景 "${scene.name}" 图片渲染失败:`, error);
        if (document.body.contains(imageContainer)) {
            imageContainer.innerHTML = `<span>图片加载失败</span>`;
        }
    }
}

/**
 * 根据唯一ID删除一个约会场景 (已添加数据库操作)
 * @param {string} sceneUid - 场景的唯一ID
 */
async function deleteDatingScene(sceneUid) {
    const cardToRemove = document.querySelector(`.dating-scene-card[data-uid="${sceneUid}"]`);
    if (cardToRemove) {
        cardToRemove.style.transition = "transform 0.3s, opacity 0.3s";
        cardToRemove.style.transform = "scale(0.9)";
        cardToRemove.style.opacity = "0";
        setTimeout(async () => {
            await db.datingScenes.delete(sceneUid);
            currentDatingScenes = currentDatingScenes.filter((scene) => scene.uid !== sceneUid);
            cardToRemove.remove();
        }, 300);
    }
}

// 处理场景图片生成和加载
async function processSceneImages(newScenes) {
    const contentEl = document.getElementById("dating-scene-content");

    for (const scene of newScenes) {
        const card = createDatingSceneCard(scene);
        contentEl.appendChild(card);

        try {
            const imageUrl = await generateAndLoadImage(scene.imagePrompt);
            const imageContainer = card.querySelector(".dating-scene-image-container");
            if (imageContainer) {
                imageContainer.innerHTML = `<img src="${imageUrl}" alt="${scene.name}">`;
            }
        } catch (error) {
            console.error(`场景 "${scene.name}" 图片生成失败:`, error);
            const imageContainer = card.querySelector(".dating-scene-image-container");
            if (imageContainer) {
                imageContainer.innerHTML = `<span>图片生成失败</span>`;
            }
        }
    }
}

// 创建约会场景卡片元素
function createDatingSceneCard(scene) {
    const card = document.createElement("div");
    card.className = "dating-scene-card";
    card.dataset.uid = scene.uid;

    card.innerHTML = `
                    <button class="dating-scene-delete-btn" title="删除此场景">×</button>
                    <div class="dating-scene-image-container">
                        <div class="loading-spinner"></div>
                    </div>
                    <div class="dating-scene-info">
                        <div class="name">${scene.name}</div>
                        <div class="cost">花费: ${scene.cost}金币</div>
                    </div>
                `;
    return card;
}

// 生成并加载图片
function generateAndLoadImage(prompt) {
    return new Promise((resolve, reject) => {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Math.floor(Math.random() * 100000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=640&seed=${seed}`;

        const img = new Image();
        img.src = imageUrl;

        img.onload = () => resolve(imageUrl);
        img.onerror = () => {
            console.warn(`主URL加载失败，尝试备用URL for: ${prompt}`);
            const fallbackUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=640&seed=${seed}`;
            img.src = fallbackUrl;
            img.onload = () => resolve(fallbackUrl);
            img.onerror = () => reject(new Error("主域名和备用域名均加载失败"));
        };
    });
}

/**
 * 当用户点击约会卡片时，打开角色选择器
 * @param {object} scene - 被选中的约会场景对象
 */
async function openDatingCharacterSelector(scene) {
    const modal = document.getElementById("dating-char-selector-modal");
    const listEl = document.getElementById("dating-char-selector-list");
    listEl.innerHTML = "";

    // 找出所有可约会的单聊角色
    const singleChats = Object.values(state.chats).filter((chat) => !chat.isGroup);

    // 检查是否存在可约会角色
    if (singleChats.length === 0) {
        alert("你还没有任何可以约会的角色哦，先去创建一个吧！");
        return;
    }

    // 为每个角色创建列表项
    singleChats.forEach((chat) => {
        const item = document.createElement("div");
        item.className = "character-select-item"; // 复用现有的样式
        item.dataset.charId = chat.id; // 将角色ID存起来
        item.innerHTML = `
                            <img src="${chat.settings.aiAvatar || defaultAvatar}" alt="${chat.name}">
                            <span class="name">${chat.name}</span>
                        `;
        // 为每个角色项绑定点击事件
        item.addEventListener("click", () => {
            modal.classList.remove("visible"); // 点击后先关闭选择器
            openDatingInvitationModal(scene, chat.id); // 然后带着场景和角色ID，打开支付弹窗
        });
        listEl.appendChild(item);
    });

    // 绑定取消按钮
    document.getElementById("dating-cancel-char-select-btn").onclick = () => modal.classList.remove("visible");

    // 显示角色选择弹窗
    modal.classList.add("visible");
}

/**
 * 打开支付方式选择的模态框
 * @param {object} scene - 约会场景对象
 * @param {string} targetCharId - 被邀请角色的ID
 */
async function openDatingInvitationModal(scene, targetCharId) {
    const modal = document.getElementById("dating-payment-modal");
    document.getElementById("dating-modal-scene-name").textContent = scene.name;
    document.getElementById("dating-modal-scene-cost").textContent = `预计花费: ${scene.cost}金币`;

    const optionsContainer = document.getElementById("dating-payment-options");
    optionsContainer.innerHTML = ""; // 清空旧按钮

    const chat = state.chats[targetCharId];
    if (!chat) return;

    // 创建"我来付全款"按钮
    const userPayBtn = document.createElement("button");
    userPayBtn.className = "form-button";
    userPayBtn.textContent = "我来付全款";
    userPayBtn.onclick = async () => {
        const userBalance = state.globalSettings.userBalance || 0;
        // 检查用户余额是否足够
        if (userBalance < scene.cost) {
            await showCustomAlert("余额不足", "你的钱包空空如也，无法支付这次约会的花费！");
            return;
        }
        // 扣除用户余额并记录交易
        await updateUserBalanceAndLogTransaction(-scene.cost, `约会支出: ${scene.name}`);
        await showCustomAlert("支付成功", `已成功支付 ${scene.cost}金币！`);
        modal.classList.remove("visible");
        startDatingScene(scene, targetCharId, "user"); // 记录由user支付
    };
    optionsContainer.appendChild(userPayBtn);

    // 创建"让对方付全款"按钮
    const charPayBtn = document.createElement("button");
    charPayBtn.className = "form-button";
    charPayBtn.textContent = `让 ${chat.name} 付全款`;
    charPayBtn.onclick = async () => {
        const charBalance = chat.characterPhoneData?.bank?.balance || 0;
        // 检查角色余额是否足够
        if (charBalance < scene.cost) {
            await showCustomAlert("对方余额不足", `"${chat.name}"的钱包好像不够支付这次约会的费用哦。`);
            return;
        }
        // 扣除角色余额并记录交易
        await updateCharacterPhoneBankBalance(targetCharId, -scene.cost, `约会支出: ${scene.name}`);
        await showCustomAlert("支付成功", `"${chat.name}"爽快地买单了！`);
        modal.classList.remove("visible");
        startDatingScene(scene, targetCharId, "char"); // 记录由char支付
    };
    optionsContainer.appendChild(charPayBtn);

    // 创建"AA制"按钮
    const aaPayBtn = document.createElement("button");
    aaPayBtn.className = "form-button";
    aaPayBtn.textContent = "我们AA制吧";
    aaPayBtn.onclick = async () => {
        const splitCost = scene.cost / 2;
        const userBalance = state.globalSettings.userBalance || 0;
        const charBalance = chat.characterPhoneData?.bank?.balance || 0;

        // 检查双方余额是否足够
        if (userBalance < splitCost) {
            await showCustomAlert("余额不足", "你的钱包不够支付AA的费用哦！");
            return;
        }
        if (charBalance < splitCost) {
            await showCustomAlert("对方余额不足", `"${chat.name}"的钱包不够支付AA的费用哦。`);
            return;
        }

        // 扣除双方余额并记录交易
        await updateUserBalanceAndLogTransaction(-splitCost, `约会AA支出: ${scene.name}`);
        await updateCharacterPhoneBankBalance(targetCharId, -splitCost, `约会AA支出: ${scene.name}`);

        await showCustomAlert("支付成功", `你们愉快地决定AA制！`);
        modal.classList.remove("visible");
        startDatingScene(scene, targetCharId, "aa"); // 记录为AA制
    };
    optionsContainer.appendChild(aaPayBtn);

    // 创建"找人借钱"按钮（如果存在其他角色）
    const otherChars = Object.values(state.chats).filter((c) => !c.isGroup && c.id !== targetCharId);
    if (otherChars.length > 0) {
        const borrowBtn = document.createElement("button");
        borrowBtn.className = "form-button";
        borrowBtn.textContent = "我钱不够，找别人借点...";
        borrowBtn.onclick = () => {
            modal.classList.remove("visible");
            openBorrowMoneyModal(scene, targetCharId);
        };
        optionsContainer.appendChild(borrowBtn);
    }

    // 绑定取消按钮
    document.getElementById("dating-cancel-btn").onclick = () => modal.classList.remove("visible");
    // 显示弹窗
    modal.classList.add("visible");
}

/**
                 * 处理用户付全款的逻辑
                 * @param {object} scene - 约会场景对象
                 * @param {string} targetCharId - 被邀请角色的ID
                 */
async function handleUserPaysForDate(scene, targetCharId) {
    const cost = scene.cost;
    const userBalance = state.globalSettings.userBalance || 0;

    // 检查用户余额是否足够
    if (userBalance < cost) {
        await showCustomAlert("余额不足", "你的钱包空空如也，无法支付这次约会的花费！");
        return;
    }

    // 扣除用户余额并记录交易
    await updateUserBalanceAndLogTransaction(-cost, `约会支出: ${scene.name}`);
    await showCustomAlert("支付成功", `已成功支付 ${cost}金币！现在可以开始你们的约会了。`);

    // 创建系统消息通知AI约会开始
    const hiddenMessage = {
        role: "system",
        content: `[系统提示：用户已为约会"${scene.name}"付款，花费${cost}金币。现在约会正式开始，请根据场景和人设，开启一段浪漫的约会对话。]`,
        timestamp: Date.now(),
        isHidden: true,
    };

    // 将消息添加到目标角色的聊天记录中
    const chat = state.chats[targetCharId];
    chat.history.push(hiddenMessage);
    await db.chats.put(chat);

    // 打开与该角色的聊天并触发回应
    openChat(targetCharId);
    triggerAiResponse();
}

/**
 * 向AI请求让它付全款
 * @param {object} scene - 约会场景对象
 * @param {string} targetCharId - 被邀请角色的ID
 */
async function requestCharToPay(scene, targetCharId) {
    const chat = state.chats[targetCharId];
    const cost = scene.cost;

    // 创建系统指令消息请求AI决定是否支付
    const hiddenMessage = {
        role: "system",
        content: `[系统指令：用户邀请你进行约会"${scene.name}"，并希望由你来支付全部费用（${cost}金币）。你的钱包余额是 ${chat.characterPhoneData.bank.balance.toFixed(2)} 金币。请根据你的人设、你与用户的关系以及你的钱包余额，决定是否同意。你【必须】使用 'dating_payment_response' 指令，并设置 "decision" 为 "accept" 或 "reject" 来回应。]`,
        timestamp: Date.now(),
        isHidden: true,
    };

    // 将消息添加到聊天记录
    chat.history.push(hiddenMessage);
    await db.chats.put(chat);

    // 通知用户请求已发送
    await showCustomAlert("请求已发送", `已向 ${chat.name} 发出请求，请到聊天中查看Ta的回应吧。`);
    openChat(targetCharId);
    triggerAiResponse();
}

/**
 * 向AI请求AA制
 * @param {object} scene - 约会场景对象
 * @param {string} targetCharId - 被邀请角色的ID
 */
async function requestAAsplit(scene, targetCharId) {
    const chat = state.chats[targetCharId];
    const splitCost = scene.cost / 2;

    const userBalance = state.globalSettings.userBalance || 0;
    // 检查用户余额是否足够支付AA费用
    if (userBalance < splitCost) {
        await showCustomAlert("余额不足", `你的余额不足以支付AA制的费用（${splitCost.toFixed(2)}金币）！`);
        return;
    }

    // 创建系统指令消息请求AI决定是否接受AA制
    const hiddenMessage = {
        role: "system",
        content: `[系统指令：用户邀请你进行约会"${scene.name}"，并提议AA制，即各自支付 ${splitCost.toFixed(2)} 金币。你的钱包余额是 ${chat.characterPhoneData.bank.balance.toFixed(2)} 金币。请根据你的人设和你与用户的关系，决定是否同意。你【必须】使用 'dating_aa_response' 指令，并设置 "decision" 为 "accept" 或 "reject" 来回应。]`,
        timestamp: Date.now(),
        isHidden: true,
    };

    // 将消息添加到聊天记录
    chat.history.push(hiddenMessage);
    await db.chats.put(chat);

    // 通知用户请求已发送
    await showCustomAlert("请求已发送", `已向 ${chat.name} 发出AA制的提议，请到聊天中查看Ta的回应吧。`);
    openChat(targetCharId);
    triggerAiResponse();
}

/**
 * 打开"找人借钱"的选择列表
 * @param {object} scene - 约会场景对象
 * @param {string} dateTargetCharId - 你的约会对象ID
 */
async function openBorrowMoneyModal(scene, dateTargetCharId) {
    const modal = document.getElementById("borrow-money-modal");
    const listEl = document.getElementById("borrow-money-char-list");
    listEl.innerHTML = "";

    // 获取除约会对象外的其他角色
    const otherChars = Object.values(state.chats).filter((c) => !c.isGroup && c.id !== dateTargetCharId);

    // 检查是否存在可借款角色
    if (otherChars.length === 0) {
        alert("没有其他可以借钱的朋友了。");
        return;
    }

    // 为每个可借款角色创建列表项
    otherChars.forEach((char) => {
        const item = document.createElement("div");
        item.className = "character-select-item"; // 复用样式
        item.dataset.charId = char.id;
        item.innerHTML = `
                            <img src="${char.settings.aiAvatar || defaultAvatar}" alt="${char.name}">
                            <span class="name">${char.name}</span>
                        `;
        item.addEventListener("click", async () => {
            modal.classList.remove("visible");
            // 获取用户输入的借款金额
            const borrowAmountStr = await showCustomPrompt("借多少？", "请输入你想借的金额", "", "number");
            const borrowAmount = parseFloat(borrowAmountStr);
            // 验证借款金额有效性
            if (borrowAmount > 0) {
                await requestToBorrowMoney(scene, dateTargetCharId, char.id, borrowAmount);
            } else if (borrowAmountStr !== null) {
                alert("请输入有效的借款金额！");
            }
        });
        listEl.appendChild(item);
    });

    // 绑定取消按钮
    document.getElementById("borrow-money-cancel-btn").onclick = () => modal.classList.remove("visible");
    modal.classList.add("visible");
}

/**
 * 向指定角色发送借款请求
 * @param {object} scene - 约会场景对象
 * @param {string} dateTargetCharId - 约会对象ID
 * @param {string} lenderChatId - 借款人角色ID
 * @param {number} amount - 借款金额
 */
async function requestToBorrowMoney(scene, dateTargetCharId, lenderChatId, amount) {
    const dateTargetChat = state.chats[dateTargetCharId];
    const lenderChat = state.chats[lenderChatId];
    if (!lenderChat || !dateTargetChat) return;

    const myNickname = dateTargetChat.settings.myNickname || "我";

    // 构建借款请求信息
    const reasonText = `用于和"${dateTargetChat.name}"在"${scene.name}"的约会。`;
    const payloadData = {
        lenderName: lenderChat.name,
        amount: amount,
        reason: reasonText,
    };
    // 创建文本消息内容
    const textContent = `向 ${lenderChat.name} 借钱 ${amount.toFixed(2)}元，${reasonText}`;

    // 创建借款请求消息对象
    const borrowRequestMessage = {
        role: "user",
        type: "borrow_money_request",
        timestamp: Date.now(),
        payload: payloadData, // payload 用于渲染借条卡片
        content: textContent, // content 用于显示为文本消息
    };

    // 将借条发到"债主"的聊天里
    lenderChat.history.push(borrowRequestMessage);

    // 创建给AI看的、带有详细信息的隐藏指令
    const hiddenMessage = {
        role: "system",
        content: `[系统指令：用户 "${myNickname}" 想向你借 ${amount.toFixed(2)} 金币，用于和 "${dateTargetChat.name}" 在 "${scene.name}" 约会。你的钱包余额是 ${lenderChat.characterPhoneData.bank.balance.toFixed(2)} 金币。请根据你的人设、你和用户的关系以及你的钱包余额，决定是否借钱。你【必须】使用 'lend_money_response' 指令，并设置 "decision" 为 "accept" 或 "reject" 来回应，并可以在文本消息中说明理由。]`,
        timestamp: Date.now() + 1, // 确保时间戳在后
        isHidden: true,
    };
    lenderChat.history.push(hiddenMessage);
    await db.chats.put(lenderChat);

    // 通知用户请求已发送
    await showCustomAlert("借钱请求已发送", `已向"${lenderChat.name}"发起了借款请求，请到和Ta的聊天中查看结果。`);

    // 打开与"债主"的聊天并触发回应
    openChat(lenderChatId);
    triggerAiResponse();
}

// 约会游戏状态管理对象
let datingGameState = {
    isActive: false,
    scene: null,
    characterId: null,
    storyHistory: [],
    romance: 0,
    lust: 0,
    currentStoryText: "",
    currentSentenceIndex: -1,
    sentences: [],
    isSwitchingSentence: false,
    isNsfwMode: false,
    completion: 0
};

let currentDatingSummary = null; // 用于暂存当前结算卡片的数据

/**
 * 渲染约会数值条（心形UI）
 * 使用SVG线性渐变实现动态填充效果
 */
function renderDatingValues() {
    const romanceContainer = document.getElementById("romance-value");
    const lustContainer = document.getElementById("lust-value");
    if (!romanceContainer || !lustContainer) return;

    // 清空旧的心形
    romanceContainer.innerHTML = "";
    lustContainer.innerHTML = "";

    // 渲染单个数值条的辅助函数
    const renderValueBar = (container, value, type) => {
        // 定义颜色：粉色代表浪漫，黄色代表性欲
        const fillColor = type === "romance" ? "#ff8fab" : "#ffde59";
        const emptyColor = "#ccc";
        const emptyOpacity = "0.3";

        for (let i = 0; i < 5; i++) {
            // 计算当前心形的填充百分比
            const fillPercentage = Math.max(0, Math.min(100, (value - i * 20) * 5));

            // 为每个SVG生成唯一的渐变ID
            const gradientId = `heart-gradient-${type}-${i}`;

            const heartSvg = `
                                <svg viewBox="0 0 24 24">
                                    <defs>
                                        <linearGradient id="${gradientId}" x1="0" x2="0" y1="1" y2="0">
                                            <stop offset="${fillPercentage}%" stop-color="${fillColor}" />
                                            <stop offset="${fillPercentage}%" stop-color="${emptyColor}" stop-opacity="${emptyOpacity}" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                                        fill="url(#${gradientId})"
                                        stroke="#aaa" 
                                        stroke-width="1.5"/>
                                </svg>
                            `;
            container.innerHTML += heartSvg;
        }
    };

    // 渲染浪漫值和性欲值两个数值条
    renderValueBar(romanceContainer, datingGameState.romance, "romance");
    renderValueBar(lustContainer, datingGameState.lust, "lust");
}

/**
 * 开始一场约会
 * @param {Object} scene - 约会场景对象
 * @param {string} targetCharId - 目标角色ID
 */
async function startDatingScene(scene, targetCharId) {
    console.log(`开始约会: 场景="${scene.name}", 角色ID=${targetCharId}`);

    // 初始化约会状态
    datingGameState = {
        isActive: true,
        scene: scene,
        characterId: targetCharId,
        storyHistory: [],
        romance: 0,
        lust: 0,
        currentStoryText: "",
        currentSentenceIndex: -1,
        sentences: [],
        isSwitchingSentence: false,
        isNsfwMode: false, // NSFW模式开关
        completion: 0, // 约会完成度
    };

    const chat = state.chats[targetCharId];
    if (!chat) return;

    // 准备UI元素
    const backgroundEl = document.getElementById("dating-game-background");
    const charNameEl = document.getElementById("dating-game-char-name");
    const textContentEl = document.getElementById("dating-game-text-content");
    const choicesEl = document.getElementById("dating-game-choices");

    // 重置UI到初始状态
    charNameEl.textContent = chat.name;
    backgroundEl.style.backgroundImage = "none";
    textContentEl.innerHTML = "<p>AI正在精心构筑你们的约会世界...</p>";
    textContentEl.parentElement.style.opacity = 1;
    choicesEl.innerHTML = "";

    // 显示游戏界面
    showScreen("dating-game-screen");

    // 加载背景图
    const uiSettings = chat.settings.datingUISettings || {};

    // 优先使用用户设置的背景
    if (uiSettings.backgroundUrl) {
        console.log("检测到自定义约会背景，正在加载...");
        backgroundEl.style.backgroundImage = `url(${uiSettings.backgroundUrl})`;
    } else {
        // 如果没有设置，调用AI生成
        console.log("未检测到自定义背景，将由AI生成...");
        const imagePrompt = scene.imagePrompt + ", vertical, phone wallpaper, cinematic lighting, masterpiece, best quality, beautiful anime style art";
        generateAndLoadImage(imagePrompt)
            .then((imageUrl) => {
                backgroundEl.style.backgroundImage = `url(${imageUrl})`;
            })
            .catch((error) => {
                console.error("约会背景图加载失败:", error);
                backgroundEl.style.backgroundColor = "#1c1e26"; // 失败时的备用背景
            });
    }

    // 重置并显示数值条和完成度进度条
    datingGameState.romance = 0;
    datingGameState.lust = 0;
    datingGameState.completion = 0;
    renderDatingCompletion();
    document.getElementById("dating-completion-bar-container").style.display = "block";
    renderDatingValues();
    document.getElementById("dating-values-container").style.display = "flex";

    // 触发初始剧情
    await triggerDatingStory("start");
}

/**
 * 渲染并更新约会完成度进度条的UI
 */
function renderDatingCompletion() {
    const container = document.getElementById("dating-completion-bar-container");
    const fill = document.getElementById("dating-completion-bar-fill");
    const text = document.getElementById("dating-completion-text");

    if (!container || !fill || !text) return;

    // 从游戏状态中获取完成度
    const completion = datingGameState.completion || 0;

    // 更新填充条的宽度和百分比文字
    fill.style.width = `${completion}%`;
    text.textContent = `${Math.round(completion)}%`;
}

/**
 * 触发约会剧情发展
 * @param {string} userAction - 用户的选择或行动
 */
async function triggerDatingStory(userAction) {
    datingGameState.isNsfwMode = false;
    if (!datingGameState.isActive) return;

    const { scene, characterId, storyHistory } = datingGameState;
    const chat = state.chats[characterId];
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("API未配置，无法继续约会。");
        return;
    }

    // 记录用户选择到历史中
    if (userAction !== "start") {
        storyHistory.push(`【你的选择】: ${userAction}`);
    }

    const textContentEl = document.getElementById("dating-game-text-content");
    const choicesEl = document.getElementById("dating-game-choices");

    // 显示等待状态
    textContentEl.innerHTML = "<p><i>对方正在思考...</i></p>";
    choicesEl.innerHTML = "";

    // 获取角色立绘信息
    const uiSettings = chat.settings.datingUISettings || {};
    const customPrompt = uiSettings.prompt || "";
    const customStyle = uiSettings.style || "你的回复必须是【第三人称】的旁白，详细描绘场景、角色的动作、神态、心理活动以及对话。让用户感觉像在看小说。";

    let spriteContext = "";
    let spriteChoiceInstruction = "";
    const spriteGroupId = uiSettings.spriteGroupId;

    if (spriteGroupId) {
        const sprites = await db.datingSprites.where("groupId").equals(spriteGroupId).toArray();
        if (sprites.length > 0) {
            spriteContext = `
                # 可用角色立绘
                你有一个立绘库，请根据当前情景选择一个最能表达角色“${chat.name}”心情和动作的立绘描述。
                - ${sprites.map((s) => `[描述: ${s.description}]`).join("\n- ")}
                `;
            spriteChoiceInstruction = `"sprite": "【从上方列表中选择一个最合适的描述，并填在这里】",`;
        }
    }

    // 构建系统提示词
    const systemPrompt = `
                        # 角色扮演：恋爱互动小说游戏引擎
                        你现在是一个顶级的恋爱互动小说游戏引擎。你的任务是根据用户选择，推动一个浪漫约会故事的发展。
                        ## 故事背景
                        - **你的角色**: 你将扮演角色“${chat.name}”。
                        - **你的角色人设**: ${chat.settings.aiPersona}\n${customPrompt}
                        - **用户的人设**: ${chat.settings.myPersona}
                        - **约会场景**: ${scene.name}
                        ${spriteContext}
                        ## 当前约会状态 (重要参考)
                        - **浪漫值**: ${datingGameState.romance}/100
                        - **性欲值**: ${datingGameState.lust}/100
                        - **约会完成度**: ${datingGameState.completion}%

                        ## 核心规则
                        1.  **沉浸式叙事**: ${customStyle}
                        2.  **提供选择**: 在每段叙事后，你【必须】提供 2-4 个供用户选择的行动或对话选项。
                        3.  **【【【智能评分铁律】】】**: 你【必须】根据当前的故事进展、用户的选择以及你的回应，对本次互动的“质量”进行评估，并给出三个数值的【增加值】。
                            - **"romance" (浪漫值)**: 如果互动是甜蜜、温馨或感人的，可以增加5-15分。
                            - **"lust" (性欲值)**: 如果互动包含挑逗、暗示或身体接触，可以增加5-15分。
                            - **"completion_increase" (完成度增加值)**:
                                -   这是一个【可正可负】的数值。
                                -   **正面互动**: 如果用户的选择让关系升温（例如，选择了更浪漫或大胆的选项），你应该给一个正数，范围在 **3到10** 之间。
                                -   **负面互动**: 如果用户的选择很煞风景、粗鲁或导致尴尬，你应该给一个【负数】，范围在 **-10到-1** 之间，表示约会进度倒退。
                                -   **平淡互动**: 如果互动很平淡或只是过渡，可以给 **0** 或 **1-2** 分。
                        4.  **【【【结束时机铁律】】】**: 当你认为故事已经发展到一个完美的、可以自然结束的节点时（例如：互相道别、回到家中），并且总完成度已接近100%，你【必须】将 \`"isDateOver"\` 字段设置为 \`true\`。
                        5.  **【【【格式铁律】】】**: 你的回复【必须且只能】是一个严格的JSON对象，格式如下:
                            {
                            ${spriteChoiceInstruction}
                            "story": "【这里是你的叙事内容...】",
                            "choices": [
                                "【选项1的文字描述】",
                                "【选项2的文字描述】"
                            ],
                            "valuesUpdate": {
                                "romance": 5,
                                "lust": 0,
                                "completion_increase": 8
                            },
                            "isDateOver": false
                            }
                        ## 故事历史 (供你参考)
                        ${storyHistory.join("\n")}
                        现在，请根据用户的最新选择“${userAction}”，生成下一段故事、新的选项和智能评分。
                    `;

    try {
        const messagesForApi = [{ role: "user", content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 0.9, response_format: { type: "json_object" } }),
            });

        if (!response.ok) throw new Error(`API 请求失败: ${await response.text()}`);

        const data = await response.json();
        const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(/^```json\s*|```$/g, "").trim();
        const gameData = JSON.parse(rawContent);

        // 处理AI返回的游戏数据
        if (gameData.story && Array.isArray(gameData.choices)) {
            // 更新数值
            if (gameData.valuesUpdate) {
                const romanceChange = gameData.valuesUpdate.romance || 0;
                const lustChange = gameData.valuesUpdate.lust || 0;
                const completionIncrease = gameData.valuesUpdate.completion_increase || 0;

                datingGameState.romance = Math.max(0, Math.min(100, datingGameState.romance + romanceChange));
                datingGameState.lust = Math.max(0, Math.min(100, datingGameState.lust + lustChange));
                datingGameState.completion = Math.max(0, Math.min(100, datingGameState.completion + completionIncrease));

                console.log(`数值更新 -> 浪漫: ${datingGameState.romance}/100, 性欲: ${datingGameState.lust}/100, 完成度: ${datingGameState.completion}% (本次变化: ${completionIncrease})`);

                renderDatingValues();
                renderDatingCompletion();
            }

            const isDateOver = gameData.isDateOver || false;
            // 检查约会是否结束且完成度达到100%
            if (isDateOver && datingGameState.completion >= 100) {
                // 显示结算卡片
                showDatingSummaryCard(gameData.story);
                return;
            }

            // 更新立绘
            const spriteContainer = document.getElementById("dating-game-sprite-container");
            const spriteImg = document.getElementById("dating-game-sprite");
            if (gameData.sprite && spriteGroupId) {
                const chosenSprite = await db.datingSprites.where({ groupId: spriteGroupId, description: gameData.sprite }).first();
                if (chosenSprite) {
                    spriteContainer.style.display = "block";
                    spriteContainer.style.left = `${chosenSprite.x}%`;
                    spriteContainer.style.bottom = `${100 - chosenSprite.y}%`;
                    spriteContainer.style.width = `${chosenSprite.size}%`;
                    spriteContainer.style.transform = `translateX(-50%) translateY(${100 - chosenSprite.y}%)`;
                    spriteImg.style.opacity = 0;
                    setTimeout(() => {
                        spriteImg.src = chosenSprite.url;
                        spriteImg.style.opacity = 1;
                    }, 300);
                } else {
                    if (spriteContainer) spriteContainer.style.display = "none";
                }
            } else {
                if (spriteContainer) spriteContainer.style.display = "none";
            }

            // 记录故事并显示
            datingGameState.storyHistory.push(`【旁白】: ${gameData.story}`);
            displayStoryText(gameData.story, gameData.choices);

            // 检查是否触发NSFW剧情
            if (datingGameState.lust >= 100 && !datingGameState.isNsfwMode) {
                await triggerNsfwScene();
            }
        } else {
            throw new Error("AI返回的数据格式不正确。");
        }
    } catch (error) {
        console.error("约会剧情生成失败:", error);
        textContentEl.innerHTML = `<p style="color: #ff8a80;">错误: 剧情加载失败，AI可能开小差了... \n(${error.message})</p>`;
    }
}

/**
 * 当欲望值满时，触发并推进NSFW剧情
 * @param {string} userAction - 用户的选择或自定义行动
 */
async function triggerNsfwScene(userAction = "故事自然发展") {
    // 设置并确认NSFW模式标志
    datingGameState.isNsfwMode = true;
    console.log("NSFW模式已激活，正在生成NSFW剧情...");

    if (!datingGameState.isActive) return;

    // 获取所需的所有数据
    const { scene, characterId, storyHistory } = datingGameState;
    const chat = state.chats[characterId];
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("API未配置，无法继续约会。");
        return;
    }

    storyHistory.push(`【你的选择】: ${userAction}`);

    // 更新UI为等待状态
    const textContentEl = document.getElementById("dating-game-text-content");
    const choicesEl = document.getElementById("dating-game-choices");
    textContentEl.innerHTML = "<p><i>气氛变得有些不一样了...</i></p>";
    choicesEl.innerHTML = "";

    // 读取约会场景的通用设置
    const uiSettings = chat.settings.datingUISettings || {};
    const customPrompt = uiSettings.prompt || "";
    const baseStyle = uiSettings.style || "你的回复必须是【第三人称】的旁白，详细描绘场景、角色的动作、神态、心理活动以及对话。让用户感觉像在看小说。";
    const nsfwStyleInstruction = `
                # NSFW剧情指令 (最高优先级)
                接下来的故事【必须】包含详细、露骨、毫不避讳的性爱场面描写。你需要大胆地描绘角色的身体接触、动作、喘息、对话和内心感受，让故事进入高潮。叙事必须连贯、自然，符合角色性格。`;
    const customStyleWithNsfw = `${baseStyle}\n${nsfwStyleInstruction}`;

    // 立绘逻辑
    let spriteContext = "";
    let spriteChoiceInstruction = "";
    const spriteGroupId = uiSettings.spriteGroupId;
    if (spriteGroupId) {
        const sprites = await db.datingSprites.where("groupId").equals(spriteGroupId).toArray();
        if (sprites.length > 0) {
            spriteContext = `\n# 可用角色立绘\n${sprites.map((s) => `- [描述: ${s.description}]`).join("\n")}`;
            spriteChoiceInstruction = `"sprite": "【从上方列表中选择一个最合适的描述，并填在这里】",`;
        }
    }

    // 构建NSFW系统提示词
    const systemPrompt = `
                        # 角色扮演：NSFW恋爱互动小说游戏引擎
                        你现在是一个顶级的成人小说游戏引擎。你的任务是根据用户选择，续写一段已经发展到高潮的浪漫约会故事。

                        ## 故事背景
                        - **你的角色**: 你将扮演角色“${chat.name}”。
                        - **你的角色人设**: ${chat.settings.aiPersona}\n${customPrompt}
                        - **用户的人设**: ${chat.settings.myPersona}
                        - **约会场景**: ${scene.name}
                        ${spriteContext}
                        ## 当前约会状态 (重要参考)
                        - **浪漫值**: ${datingGameState.romance}/100
                        - **性欲值**: ${datingGameState.lust}/100
                        - **约会完成度**: ${datingGameState.completion}%

                        ## 核心规则
                        1.  **沉浸式叙事**: ${customStyleWithNsfw}
                        2.  **提供选择**: 在每段NSFW叙事后，你【必须】提供 2-4 个供用户选择的、符合当前情景的行动或对话选项。
                        3.  **智能评分**: 你【必须】根据当前的故事进展、用户的选择以及你的回应，对本次互动的“质量”进行评估，并给出三个数值的【增加值】。
                            - "romance" (浪漫值): 如果互动是甜蜜、温馨或感人的，可以增加5-15分。
                            - "lust" (性欲值): 因为是NSFW剧情，此项应该持续增加，范围在10-25分之间。
                            - "completion_increase" (完成度增加值): 如果用户的选择让关系升温（例如，选择了更浪漫或大胆的选项），你应该给一个正数，范围在 3到10 之间。如果用户的选择很煞风景，你应该给一个负数，范围在 -10到-1 之间。
                        4.  **【【【结束时机铁律】】】**: 你的主要任务是推进剧情，但当故事发展到一个**自然且满足的结局**时（例如：激情后的温存、相拥而眠、约定下次再见等），你【必须】将 \`"isDateOver"\` 字段设置为 \`true\` 来结束本次约会。这是结束的唯一方式。**不要无限地进行下去。**
                        5.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON对象，格式如下:
                            {
                            ${spriteChoiceInstruction}
                            "story": "【这里是你的NSFW叙事内容...】",
                            "choices": [
                                "【选项1的文字描述】",
                                "【选项2的文字描述】"
                            ],
                            "valuesUpdate": {
                                "romance": 5,
                                "lust": 15,
                                "completion_increase": 7
                            },
                            "isDateOver": false
                            }
                        ## 故事历史 (供你参考)
                        ${storyHistory.join("\n")}

                        现在，请根据用户的最新选择“${userAction}”，生成下一段NSFW故事、新的选项和智能评分。
                    `;

    try {
        const messagesForApi = [{ role: "user", content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini);

        const response = await fetch(isGemini ? geminiConfig.url : `${proxyUrl}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 1.0, response_format: { type: "json_object" } }),
        });

        if (!response.ok) throw new Error(`API 请求失败: ${await response.text()}`);

        const data = await response.json();
        const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(/^```json\s*|```$/g, "").trim();
        const gameData = JSON.parse(rawContent);

        if (gameData.story && Array.isArray(gameData.choices)) {
            // 数值更新逻辑
            if (gameData.valuesUpdate) {
                const romanceChange = gameData.valuesUpdate.romance || 0;
                const lustChange = gameData.valuesUpdate.lust || 0;
                const completionIncrease = gameData.valuesUpdate.completion_increase || 1;
                datingGameState.romance = Math.max(0, Math.min(100, datingGameState.romance + romanceChange));
                datingGameState.lust = Math.max(0, Math.min(100, datingGameState.lust + lustChange));
                datingGameState.completion = Math.max(0, Math.min(100, datingGameState.completion + completionIncrease));
                renderDatingValues();
                renderDatingCompletion();
            }

            // 根据 AI 的 `isDateOver` 标志决定是否结束
            const isDateOver = gameData.isDateOver || false;
            if (isDateOver) {
                showDatingSummaryCard(gameData.story);
                return;
            }

            // 更新立绘
            const spriteContainer = document.getElementById("dating-game-sprite-container");
            const spriteImg = document.getElementById("dating-game-sprite");
            if (gameData.sprite && spriteGroupId) {
                const chosenSprite = await db.datingSprites.where({ groupId: spriteGroupId, description: gameData.sprite }).first();
                if (chosenSprite) {
                    spriteContainer.style.display = "block";
                    spriteContainer.style.left = `${chosenSprite.x}%`;
                    spriteContainer.style.bottom = `${100 - chosenSprite.y}%`;
                    spriteContainer.style.width = `${chosenSprite.size}%`;
                    spriteContainer.style.transform = `translateX(-50%) translateY(${100 - chosenSprite.y}%)`;
                    spriteImg.style.opacity = 0;
                    setTimeout(() => {
                        spriteImg.src = chosenSprite.url;
                        spriteImg.style.opacity = 1;
                    }, 300);
                } else {
                    if (spriteContainer) spriteContainer.style.display = "none";
                }
            } else {
                if (spriteContainer) spriteContainer.style.display = "none";
            }

            // 记录故事并显示
            datingGameState.storyHistory.push(`【旁白】: ${gameData.story}`);
            displayStoryText(gameData.story, gameData.choices);
        } else {
            throw new Error("AI返回的数据格式不正确。");
        }
    } catch (error) {
        console.error("NSFW剧情生成失败:", error);
        textContentEl.innerHTML = `<p style="color: #ff8a80;">错误: NSFW剧情加载失败... \n(${error.message})</p>`;
    }
}

/**
 * 处理剧情文本的逐句显示
 * @param {string} storyText - AI返回的完整剧情文本
 * @param {Array<string>} choices - AI返回的选项数组
 */
function displayStoryText(storyText, choices) {
    // 按标点符号分割句子
    const sentences = storyText.match(/[^。！？\s][^。！？]*[。！？]?/g) || [storyText];

    // 更新游戏状态
    datingGameState.sentences = sentences;
    datingGameState.currentSentenceIndex = -1; // 重置索引
    datingGameState.choices = choices; // 暂存选项

    // 准备UI，但不显示选项
    document.getElementById("dating-game-text-content").innerHTML = "";
    document.getElementById("dating-game-choices").innerHTML = "";

    // 显示第一句
    showNextSentence();
}

/**
 * 显示下一句剧情文本，或在结束后显示选项
 * - 修正了文本意外消失的bug (使用appendChild代替innerHTML)
 * - 增加了点击保护，防止跳过句子
 */
function showNextSentence() {
    // 如果正在切换句子，则阻止任何新的操作，防止用户快速点击跳过剧情
    if (datingGameState.isSwitchingSentence) return;
    datingGameState.isSwitchingSentence = true; // 加锁

    const { sentences, choices } = datingGameState;
    const textContentEl = document.getElementById("dating-game-text-content");
    const choicesEl = document.getElementById("dating-game-choices");
    const textboxEl = textContentEl.parentElement;

    // 获取进度条元素
    const progressBarContainer = document.getElementById("dating-completion-bar-container");

    // 句子索引+1
    datingGameState.currentSentenceIndex++;
    const nextIndex = datingGameState.currentSentenceIndex;

    // 用安全的方式移除旧的“点击继续”提示
    const oldIndicator = textboxEl.querySelector(".continue-indicator");
    if (oldIndicator) {
        oldIndicator.remove();
    }

    // 先让旧文本淡出
    textContentEl.classList.add("fade-out");

    // 设定一个延迟来执行文本替换和动画
    setTimeout(() => {
        if (nextIndex < sentences.length) {
            const nextSentence = sentences[nextIndex];

            // 使用textContent进行安全的文本替换，绝对不会累积
            textContentEl.textContent = nextSentence;

            // 如果这不是最后一句...
            if (nextIndex < sentences.length - 1) {
                // 显示进度条
                if (progressBarContainer) progressBarContainer.style.display = "block";

                // 创建并添加“点击继续”的提示
                const indicator = document.createElement("div");
                indicator.className = "continue-indicator";
                indicator.textContent = "▼";
                textboxEl.appendChild(indicator);
            } else {
                // 如果是最后一句了，准备显示选项，隐藏进度条
                if (progressBarContainer) progressBarContainer.style.display = "none";

                choices.forEach((choiceText) => {
                    const choiceBtn = document.createElement("button");
                    choiceBtn.className = "dating-game-choice-btn";
                    choiceBtn.textContent = choiceText;
                    choiceBtn.onclick = () => {
                        if (datingGameState.isNsfwMode) {
                            triggerNsfwScene(choiceText);
                        } else {
                            triggerDatingStory(choiceText);
                        }
                    };
                    choicesEl.appendChild(choiceBtn);
                });

                // 添加“自由输入”按钮
                const inputBtn = document.createElement("button");
                inputBtn.className = "dating-game-choice-btn input-action";
                inputBtn.textContent = "自定义行动...";
                inputBtn.onclick = async () => {
                    const userInput = await showCustomPrompt("你的行动", "请输入你想说的话或想做的事：");
                    if (userInput && userInput.trim()) {
                        if (datingGameState.isNsfwMode) {
                            triggerNsfwScene(userInput.trim());
                        } else {
                            triggerDatingStory(userInput.trim());
                        }
                    }
                };
                choicesEl.appendChild(inputBtn);
            }
        }

        // 让新文本淡入
        textContentEl.classList.remove("fade-out");

        // 所有操作完成后，解锁，允许下一次点击
        datingGameState.isSwitchingSentence = false;
    }, 250);
}

/**
 * 当用户点击“结束约会”时，弹出选择框
 */
async function endDate() {
    if (!datingGameState.isActive) return;

    // 弹出选择框，让用户决定如何结束
    const choice = await showChoiceModal("结束约会", [
        { text: "生成并记录约会", value: "record" },
        { text: "直接结束不记录", value: "discard" },
    ]);

    // 根据用户的选择执行不同操作
    if (choice === "record") {
        // 如果选择“记录”，就显示结算卡片
        showDatingSummaryCard();
    } else if (choice === "discard") {
        // 如果选择“不记录”，就直接结束并返回聊天列表
        finalizeAndExitDate();
    }
    // 如果用户点了取消，则什么也不做，约会继续
}

/**
 * 最终结束约会并重置状态的函数
 */
async function finalizeAndExitDate() {
    if (!datingGameState.isActive) return;

    const chat = state.chats[datingGameState.characterId];
    if (chat) {
        const endMessage = { role: "system", type: "pat_message", content: `你和“${chat.name}”在“${datingGameState.scene.name}”的约会结束了。`, timestamp: Date.now() };
        chat.history.push(endMessage);
        await db.chats.put(chat);
    }

    // 隐藏进度条
    document.getElementById("dating-completion-bar-container").style.display = "none";

    // 重置游戏状态
    datingGameState = {
        isActive: false,
        scene: null,
        characterId: null,
        storyHistory: [],
        romance: 0,
        lust: 0,
        completion: 0,
        currentStoryText: "",
        currentSentenceIndex: -1,
        sentences: [],
        isSwitchingSentence: false,
        isNsfwMode: false,
    };

    // 隐藏结算卡片（如果它还开着）
    document.getElementById("dating-summary-overlay").classList.remove("visible");

    // 返回聊天列表并刷新
    showScreen("chat-list-screen");
    await renderChatList();
}

/**
 * 打开约会场景设置弹窗
 */
async function openDatingSettingsModal() {
    const modal = document.getElementById("dating-game-settings-modal");
    const chat = state.chats[datingGameState.characterId];
    if (!chat) return;

    // 加载当前角色的约会UI设置
    currentDatingUISettings = JSON.parse(
        JSON.stringify(
            chat.settings.datingUISettings || {
                prompt: "",
                style: "",
                backgroundUrl: "",
                spriteGroupId: null,
                sprite: { url: "", x: 50, y: 100, size: 80 },
            }
        )
    );

    // 填充弹窗内容
    document.getElementById("dating-prompt-input").value = currentDatingUISettings.prompt;
    document.getElementById("dating-style-input").value = currentDatingUISettings.style;
    document.getElementById("dating-bg-url-input").value = currentDatingUISettings.backgroundUrl;

    // 调用渲染函数
    await renderDatingSpriteGroupSelector();
    await renderDatingPresetSelector();

    // 显示弹窗
    modal.classList.add("visible");
}

/**
 * 应用当前的UI设置到游戏界面
 */
function applyDatingUISettings() {
    if (!currentDatingUISettings) return;

    // 应用背景图
    const backgroundEl = document.getElementById("dating-game-background");
    if (currentDatingUISettings.backgroundUrl) {
        backgroundEl.style.backgroundImage = `url(${currentDatingUISettings.backgroundUrl})`;
    } else {
        // 如果没有设置，可以恢复到场景默认图或一个通用背景
        const imagePrompt = datingGameState.scene.imagePrompt + ", vertical, phone wallpaper, cinematic lighting, masterpiece, best quality, beautiful anime style art";
        generateAndLoadImage(imagePrompt)
            .then((imageUrl) => {
                backgroundEl.style.backgroundImage = `url(${imageUrl})`;
            })
            .catch(() => {
                backgroundEl.style.backgroundColor = "#1c1e26";
            });
    }

    // 应用立绘
    const spriteContainer = document.getElementById("dating-game-sprite-container");
    const spriteImg = document.getElementById("dating-game-sprite");
    const sprite = currentDatingUISettings.sprite;
    if (sprite.url) {
        spriteImg.src = sprite.url;
        spriteContainer.style.display = "block";
        spriteContainer.style.left = `${sprite.x}%`;
        spriteContainer.style.bottom = `${100 - sprite.y}%`;
        spriteContainer.style.width = `${sprite.size}%`;
        // 根据Y坐标调整transform，使立绘的“脚”能贴住设定的位置
        spriteContainer.style.transform = `translateX(-50%) translateY(${100 - sprite.y}%)`;
    } else {
        spriteImg.src = "";
        spriteContainer.style.display = "none";
    }
}

/**
 * 保存当前设置到角色数据中
 */
async function saveDatingSettings() {
    if (!datingGameState.characterId) return;
    const chat = state.chats[datingGameState.characterId];

    // 从UI读取所有设置值
    currentDatingUISettings.prompt = document.getElementById("dating-prompt-input").value.trim();
    currentDatingUISettings.style = document.getElementById("dating-style-input").value.trim();
    currentDatingUISettings.backgroundUrl = document.getElementById("dating-bg-url-input").value.trim();

    // 保存选中的立绘组ID
    const selectedSpriteGroupId = document.getElementById("dating-sprite-group-select").value;
    currentDatingUISettings.spriteGroupId = selectedSpriteGroupId ? parseInt(selectedSpriteGroupId) : null;

    // 立绘位置和大小的保存逻辑保持不变 (但我们现在不再在这里保存立绘URL了)
    currentDatingUISettings.sprite.x = 50;
    currentDatingUISettings.sprite.y = 100;
    currentDatingUISettings.sprite.size = 80;
    currentDatingUISettings.sprite.url = ""; // URL由AI动态决定，这里不保存

    // 确保角色的settings对象存在
    if (!chat.settings) chat.settings = {};
    // 保存
    chat.settings.datingUISettings = currentDatingUISettings;
    await db.chats.put(chat);

    // 应用并关闭弹窗
    applyDatingUISettings();
    document.getElementById("dating-game-settings-modal").classList.remove("visible");
    alert("场景设置已保存！");
}

/**
 * 处理图片上传
 * @param {'bg' | 'sprite'} type - 上传类型
 */
function handleDatingImageUpload(type) {
    const inputId = type === "bg" ? "dating-bg-upload-input" : "dating-sprite-upload-input";
    const urlInputId = type === "bg" ? "dating-bg-url-input" : "dating-sprite-url-input";
    document.getElementById(inputId).click();

    document.getElementById(inputId).onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
            document.getElementById(urlInputId).value = dataUrl;
            if (type === "bg") currentDatingUISettings.backgroundUrl = dataUrl;
            else currentDatingUISettings.sprite.url = dataUrl;
            applyDatingUISettings();
        }
        e.target.value = null; // 清空以便下次选择
    };
}

/**
 * 重Roll功能
 */
async function handleDatingReroll() {
    if (!datingGameState.isActive || datingGameState.storyHistory.length === 0) {
        alert("还没有可以重Roll的内容哦！");
        return;
    }

    // 找到最后一次用户的行动
    let lastUserActionIndex = -1;
    for (let i = datingGameState.storyHistory.length - 1; i >= 0; i--) {
        if (datingGameState.storyHistory[i].startsWith("【你的选择】")) {
            lastUserActionIndex = i;
            break;
        }
    }

    // 如果找不到用户的行动（比如刚开始），就重Roll第一段剧情
    if (lastUserActionIndex === -1) {
        datingGameState.storyHistory = [];
        await triggerDatingStory("start");
        return;
    }

    // 截取历史记录，回到用户做出选择之前的状态
    const lastUserAction = datingGameState.storyHistory[lastUserActionIndex].replace("【你的选择】: ", "");
    datingGameState.storyHistory = datingGameState.storyHistory.slice(0, lastUserActionIndex);

    // 重新触发AI，使用户的最后一次行动再次生效
    await triggerDatingStory(lastUserAction);
}

// --- 以下是预设管理功能 ---

async function renderDatingPresetSelector() {
    const select = document.getElementById("dating-preset-select");
    const presets = await db.datingPresets.toArray();
    select.innerHTML = '<option value="">-- 自定义 --</option>';
    presets.forEach((p) => {
        select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
}

/**
 * 处理约会预设选择
 */
async function handleDatingPresetSelect() {
    const select = document.getElementById("dating-preset-select");
    const presetId = parseInt(select.value);

    // 如果用户选择的是“-- 自定义 --”（即没有 presetId），则清空输入框
    if (!presetId) {
        document.getElementById("dating-prompt-input").value = "";
        document.getElementById("dating-style-input").value = "";
        document.getElementById("dating-bg-url-input").value = "";
        document.getElementById("dating-sprite-group-select").value = "";

        // 重置临时的设置对象
        if (currentDatingUISettings) {
            currentDatingUISettings.prompt = "";
            currentDatingUISettings.style = "";
            currentDatingUISettings.backgroundUrl = "";
            currentDatingUISettings.spriteGroupId = null;
        }
        // 应用空的背景进行预览
        applyDatingUISettings();
        return;
    }

    // 根据ID从数据库获取预设
    const preset = await db.datingPresets.get(presetId);
    if (preset && preset.settings) {
        const loadedSettings = preset.settings;

        // 确保临时的UI设置对象存在
        if (!currentDatingUISettings) {
            currentDatingUISettings = {
                prompt: "",
                style: "",
                backgroundUrl: "",
                spriteGroupId: null,
                sprite: { url: "", x: 50, y: 100, size: 80 },
            };
        }

        // 用加载的预设值更新当前设置对象
        currentDatingUISettings.prompt = loadedSettings.prompt || "";
        currentDatingUISettings.style = loadedSettings.style || "";
        currentDatingUISettings.backgroundUrl = loadedSettings.backgroundUrl || "";
        currentDatingUISettings.spriteGroupId = loadedSettings.spriteGroupId || null;

        // 将新值同步更新到弹窗的UI控件上
        document.getElementById("dating-prompt-input").value = currentDatingUISettings.prompt;
        document.getElementById("dating-style-input").value = currentDatingUISettings.style;
        document.getElementById("dating-bg-url-input").value = currentDatingUISettings.backgroundUrl;
        document.getElementById("dating-sprite-group-select").value = currentDatingUISettings.spriteGroupId || "";

        // 实时应用背景预览
        applyDatingUISettings();
    }
}

/**
 * 打开并管理约会场景预设
 */
async function openDatingPresetManager() {
    // 获取当前下拉框选中的预设ID
    const select = document.getElementById("dating-preset-select");
    if (!select) {
        alert("错误：在HTML中找不到ID为 'dating-preset-select' 的元素。");
        return;
    }
    const selectedId = select.value ? parseInt(select.value) : null;

    // 弹出操作选择菜单
    const choice = await showChoiceModal("管理场景预设", [
        { text: "💾 保存当前为新预设", value: "save" },
        { text: "🔄 更新选中预设", value: "update", disabled: !selectedId },
        { text: "🗑️ 删除选中预设", value: "delete", disabled: !selectedId },
    ]);

    hidePresetActions(); // 关闭选择菜单

    // 根据用户的选择，执行正确的操作
    if (choice === "save") {
        const name = await showCustomPrompt("保存预设", "请输入预设名称：");
        if (name && name.trim()) {
            // 从UI收集当前的设置
            const currentSettings = {
                prompt: document.getElementById("dating-prompt-input").value.trim(),
                style: document.getElementById("dating-style-input").value.trim(),
                backgroundUrl: document.getElementById("dating-bg-url-input").value.trim(),
                spriteGroupId: document.getElementById("dating-sprite-group-select").value ? parseInt(document.getElementById("dating-sprite-group-select").value) : null,
            };
            // 保存到数据库
            await db.datingPresets.add({ name: name.trim(), settings: currentSettings });
            await renderDatingPresetSelector(); // 刷新下拉框
            alert("预设已保存！");
        }
    } else if (choice === "update") {
        if (selectedId) {
            // 收集当前设置
            const currentSettings = {
                prompt: document.getElementById("dating-prompt-input").value.trim(),
                style: document.getElementById("dating-style-input").value.trim(),
                backgroundUrl: document.getElementById("dating-bg-url-input").value.trim(),
                spriteGroupId: document.getElementById("dating-sprite-group-select").value ? parseInt(document.getElementById("dating-sprite-group-select").value) : null,
            };
            // 更新数据库中的预设
            await db.datingPresets.update(selectedId, { settings: currentSettings });
            alert("预设已更新！");
        }
    } else if (choice === "delete") {
        if (selectedId) {
            const presetToDelete = await db.datingPresets.get(selectedId);
            const confirmed = await showCustomConfirm("确认删除", `确定要删除预设 "${presetToDelete.name}" 吗？`, { confirmButtonClass: "btn-danger" });
            if (confirmed) {
                await db.datingPresets.delete(selectedId);
                await renderDatingPresetSelector(); // 刷新下拉框
                // 删除后清空输入框
                document.getElementById("dating-prompt-input").value = "";
                document.getElementById("dating-style-input").value = "";
                document.getElementById("dating-bg-url-input").value = "";
                document.getElementById("dating-sprite-group-select").value = "";
                alert("预设已删除。");
            }
        }
    }
}

/* 约会立绘功能核心函数 */

/**
 * 渲染约会设置中"立绘组"的下拉选择器
 */
async function renderDatingSpriteGroupSelector() {
    const select = document.getElementById("dating-sprite-group-select");
    select.innerHTML = '<option value="">-- 不使用立绘 --</option>'; // 默认选项

    const groups = await db.datingSpriteGroups.toArray();
    groups.forEach((group) => {
        select.innerHTML += `<option value="${group.id}">${group.name}</option>`;
    });

    // 根据当前加载的预设，自动选中对应的立绘组
    if (currentDatingUISettings && currentDatingUISettings.spriteGroupId) {
        select.value = currentDatingUISettings.spriteGroupId;
    }
}

/**
 * 打开立绘组管理器
 */
async function openSpriteGroupManager() {
    await renderSpriteGroupManagerList();
    document.getElementById("sprite-group-manager-modal").classList.add("visible");
}

/**
 * 在管理器中渲染立绘组列表
 */
async function renderSpriteGroupManagerList() {
    const container = document.getElementById("sprite-group-list-container");
    container.innerHTML = "";
    const groups = await db.datingSpriteGroups.orderBy("name").toArray();

    if (groups.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">还没有任何立绘组，点击"新建"创建一个吧！</p>';
        return;
    }

    groups.forEach((group) => {
        const item = document.createElement("div");
        item.className = "sprite-group-list-item";
        item.innerHTML = `
                            <span class="group-name">${group.name}</span>
                            <div class="group-actions">
                                <button class="form-button-secondary" data-action="edit" data-id="${group.id}">编辑</button>
                                <button class="form-button-secondary" data-action="delete" data-id="${group.id}" style="color: #ff3b30;">删除</button>
                            </div>
                        `;
        container.appendChild(item);
    });
}

/**
 * 打开立绘组编辑器（用于新建或编辑）
 * @param {number|null} groupId - 如果是编辑，则传入ID；如果是新建，则为null
 */
async function openSpriteEditor(groupId = null) {
    editingSpriteGroupId = groupId;
    const modal = document.getElementById("sprite-editor-modal");
    const titleEl = document.getElementById("sprite-editor-title");
    const nameInput = document.getElementById("sprite-group-name-input");
    const listEditor = document.getElementById("sprite-list-editor");

    listEditor.innerHTML = ""; // 清空旧的立绘

    if (groupId) {
        // 编辑模式
        const group = await db.datingSpriteGroups.get(groupId);
        const sprites = await db.datingSprites.where("groupId").equals(groupId).toArray();
        titleEl.textContent = `编辑立绘组: ${group.name}`;
        nameInput.value = group.name;
        sprites.forEach((sprite) => {
            listEditor.appendChild(createSpriteEditCard(sprite));
        });
    } else {
        // 新建模式
        titleEl.textContent = "新建立绘组";
        nameInput.value = "";
        // 默认创建一个空的立绘卡片
        listEditor.appendChild(createSpriteEditCard());
    }

    modal.classList.add("visible");
}

/**
 * 创建一个立绘编辑卡片的DOM元素
 * @param {object} sprite - 可选的立绘数据对象
 * @returns {HTMLElement}
 */
function createSpriteEditCard(sprite = {}) {
    const card = document.createElement("div");
    card.className = "sprite-edit-card";
    card.dataset.spriteId = sprite.id || `new_${Date.now()}_${Math.random()}`;

    // 为 x, y, size 提供默认值
    const xPos = sprite.x ?? 50; // 默认水平居中
    const yPos = sprite.y ?? 100; // 默认垂直贴底
    const size = sprite.size ?? 80; // 默认大小为80%

    // 在HTML中加入了三个滑块和数值显示
    card.innerHTML = `
                        <div class="preview-container" style="background-image: url(${sprite.url || ""})"></div>
                        <div class="fields-container">
                            <div class="form-group" style="margin:0;">
                                <label>描述 (用于AI识别)</label>
                                <textarea class="sprite-desc-input" rows="2">${sprite.description || ""}</textarea>
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label>图片 (URL或本地上传)</label>
                                <div class="bg-upload-container">
                                    <button class="form-button-secondary upload-sprite-btn" style="margin-top:0;">上传</button>
                                    <input class="sprite-url-input" type="text" value="${sprite.url || ""}" placeholder="或粘贴URL">
                                </div>
                            </div>
                            
                            <!-- 立绘位置和大小控制滑块 -->
                            <div class="position-controls">
                                <label>X 位置: <span class="pos-value">${xPos}%</span></label>
                                <input type="range" class="sprite-x-slider" min="0" max="100" value="${xPos}">
                            </div>
                            <div class="position-controls">
                                <label>Y 位置: <span class="pos-value">${yPos}%</span></label>
                                <input type="range" class="sprite-y-slider" min="0" max="100" value="${yPos}">
                            </div>
                            <div class="position-controls">
                                <label>大小: <span class="pos-value">${size}%</span></label>
                                <input type="range" class="sprite-size-slider" min="10" max="150" value="${size}">
                            </div>

                        </div>
                        <button class="delete-sprite-btn">×</button>
                    `;

    // 为卡片内的按钮绑定事件
    card.querySelector(".delete-sprite-btn").onclick = () => card.remove();
    card.querySelector(".upload-sprite-btn").onclick = () => handleSpriteImageUpload(card);
    card.querySelector(".sprite-url-input").oninput = (e) => {
        card.querySelector(".preview-container").style.backgroundImage = `url(${e.target.value})`;
    };

    // 为新滑块绑定事件，实时更新旁边的数值显示
    card.querySelectorAll('.position-controls input[type="range"]').forEach((slider) => {
        slider.addEventListener("input", () => {
            const valueSpan = slider.previousElementSibling.querySelector(".pos-value");
            if (valueSpan) {
                valueSpan.textContent = `${slider.value}%`;
            }
        });
    });

    return card;
}

/**
 * 处理单个立绘的图片上传
 * @param {HTMLElement} cardElement - 对应的立绘编辑卡片
 */
function handleSpriteImageUpload(cardElement) {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (file) {
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
            cardElement.querySelector(".sprite-url-input").value = dataUrl;
            cardElement.querySelector(".preview-container").style.backgroundImage = `url(${dataUrl})`;
        }
    };
    fileInput.click();
}

/**
 * 保存整个立绘组（包括所有立绘）
 */
async function saveSpriteGroup() {
    const name = document.getElementById("sprite-group-name-input").value.trim();
    if (!name) {
        alert("立绘组名称不能为空！");
        return;
    }

    // 保存或更新立绘组的名称
    let groupId;
    if (editingSpriteGroupId) {
        await db.datingSpriteGroups.update(editingSpriteGroupId, { name });
        groupId = editingSpriteGroupId;
    } else {
        groupId = await db.datingSpriteGroups.add({ name });
    }

    // 准备更新的立绘数据
    const spriteCards = document.querySelectorAll("#sprite-list-editor .sprite-edit-card");
    const spritesToSave = [];
    let hasError = false;

    spriteCards.forEach((card) => {
        const description = card.querySelector(".sprite-desc-input").value.trim();
        const url = card.querySelector(".sprite-url-input").value.trim();

        // 从新增的滑块中读取 x, y, size 的值
        const x = parseInt(card.querySelector(".sprite-x-slider").value);
        const y = parseInt(card.querySelector(".sprite-y-slider").value);
        const size = parseInt(card.querySelector(".sprite-size-slider").value);

        if (!description || !url) {
            hasError = true;
        }

        spritesToSave.push({
            id: card.dataset.spriteId.startsWith("new_") ? undefined : parseInt(card.dataset.spriteId),
            groupId: groupId,
            description,
            url,
            // 将读取到的值添加到要保存的对象中
            x: x,
            y: y,
            size: size,
        });
    });

    if (hasError) {
        alert("存在描述或图片URL为空的立绘，请填写完整！");
        return;
    }

    // 使用事务，一次性更新所有数据
    await db.transaction("rw", db.datingSprites, async () => {
        await db.datingSprites.where("groupId").equals(groupId).delete();
        await db.datingSprites.bulkAdd(spritesToSave);
    });

    // 关闭弹窗并刷新UI
    document.getElementById("sprite-editor-modal").classList.remove("visible");
    await renderSpriteGroupManagerList();
    await renderDatingSpriteGroupSelector();

    if (document.getElementById("dating-game-settings-modal").classList.contains("visible")) {
        document.getElementById("dating-sprite-group-select").value = groupId;
    }

    alert("立绘组已保存！");
}

/**
 * 删除一个立绘组及其所有立绘
 * @param {number} groupId - 要删除的立绘组的ID
 */
async function deleteSpriteGroup(groupId) {
    const group = await db.datingSpriteGroups.get(groupId);
    const confirmed = await showCustomConfirm("删除立绘组", `确定要删除立绘组 "${group.name}" 吗？此操作不可恢复。`, { confirmButtonClass: "btn-danger" });
    if (confirmed) {
        await db.transaction("rw", db.datingSpriteGroups, db.datingSprites, db.datingPresets, async () => {
            // 删除该组下的所有立绘
            await db.datingSprites.where("groupId").equals(groupId).delete();
            // 删除立绘组本身
            await db.datingSpriteGroups.delete(groupId);
            // 找到所有引用了这个立绘组的约会预设，并将它们的引用清空
            const presetsToUpdate = await db.datingPresets.where("settings.spriteGroupId").equals(groupId).toArray();
            for (const preset of presetsToUpdate) {
                preset.settings.spriteGroupId = null;
                await db.datingPresets.put(preset);
            }
        });
        await renderSpriteGroupManagerList();
        await renderDatingSpriteGroupSelector();
        alert("立绘组已删除。");
    }
}
/* 约会立绘功能核心函数结束 */

/**
 * 当约会结束时，显示结算卡片，并自动保存到历史记录
 * @param {string} [finalStory=""] - 约会的最后一段剧情文本
 */
async function showDatingSummaryCard(finalStory = "") {
    const overlay = document.getElementById("dating-summary-overlay");
    const card = document.querySelector(".dating-summary-card");
    const cardInner = document.querySelector(".dating-summary-card-inner");
    const cardFront = document.querySelector(".card-front");
    const avatarEl = document.getElementById("summary-card-avatar");
    const ratingEl = document.getElementById("summary-card-rating");
    const historyEl = document.getElementById("summary-card-history");

    document.getElementById("summary-share-btn").style.display = "block";

    card.classList.remove("is-flipped");
    cardFront.classList.remove("romantic", "passionate", "perfect");

    const romance = datingGameState.romance;
    const lust = datingGameState.lust;
    const completion = datingGameState.completion;
    let ratingText = "";
    let cardClass = "";
    let finalRatingType = "anticipation";

    if (romance >= 100 && lust >= 100 && completion >= 100) {
        ratingText = "完美之夜 🎊";
        cardClass = "perfect";
        finalRatingType = "perfect";
    } else if (romance >= 100) {
        ratingText = "浪漫之夜 ❤️";
        cardClass = "romantic";
        finalRatingType = "romantic";
    } else if (lust >= 100) {
        ratingText = "激情之夜 ⭐";
        cardClass = "passionate";
        finalRatingType = "passionate";
    } else {
        ratingText = "期待之夜";
    }

    const character = state.chats[datingGameState.characterId];
    avatarEl.src = character.settings.aiAvatar || defaultAvatar;
    ratingEl.textContent = ratingText;
    if (cardClass) {
        cardFront.classList.add(cardClass);
    }

    const fullHistory = [...datingGameState.storyHistory, `【旁白】: ${finalStory}`].join("\n\n").replace(/\n/g, "<br>");
    historyEl.innerHTML = `<p>${fullHistory}</p>`;

    // 暂存数据，以便分享
    currentDatingSummary = {
        rating: ratingText,
        ratingType: finalRatingType,
        characterId: datingGameState.characterId,
        avatarUrl: avatarEl.src,
        storyHistory: datingGameState.storyHistory,
        finalStory: finalStory,
        sceneName: datingGameState.scene.name,
    };

    // 将约会结算卡片保存到历史库
    try {
        const historyRecord = {
            ...currentDatingSummary, // 将卡片的所有信息都复制过来
            timestamp: Date.now(), // 加上一个保存时的时间戳
        };
        await db.datingHistory.add(historyRecord);
        console.log("约会结算卡片已保存到历史库:", historyRecord);
    } catch (error) {
        console.error("保存约会结算卡片失败:", error);
    }

    overlay.classList.add("visible");
}

/**
 * 将结算卡片分享到与角色的聊天中 (包含完整记录用于编辑)
 */
async function shareDatingSummary() {
    // 安全检查，确保有结算数据
    if (!currentDatingSummary) return;

    const chat = state.chats[currentDatingSummary.characterId];
    if (!chat) return;


    const storyForEdit = [...currentDatingSummary.storyHistory, `【旁白】: ${currentDatingSummary.finalStory}`].join("\n");
    const contentForEditing = `
                        [约会记录]
                        约会场所: ${currentDatingSummary.sceneName}
                        约会评级: ${currentDatingSummary.rating}
                        --------------------
                        ${storyForEdit}
                    `.trim();

    // 创建一个特殊的消息对象，它将作为聊天记录被保存
    const summaryMessage = {
        role: "user", // 标记为用户发出的消息
        type: "dating_summary_card", // 自定义的新消息类型，用于识别
        timestamp: Date.now(),

        // 这个 content 字段就是你想要的，当编辑这条消息时，就会显示这里的文本
        content: contentForEditing,

        // payload 字段用于存储渲染UI所需的所有数据
        payload: {
            rating: currentDatingSummary.rating,
            ratingType: currentDatingSummary.ratingType,
            avatarUrl: currentDatingSummary.avatarUrl,
            storyHistory: currentDatingSummary.storyHistory,
            finalStory: currentDatingSummary.finalStory,
            sceneName: currentDatingSummary.sceneName,
            characterName: chat.name, // 把角色名字也存进去，方便卡片背面显示
        },
    };

    // 将这条新消息添加到聊天记录并保存到数据库
    chat.history.push(summaryMessage);
    await db.chats.put(chat);

    // 给出成功提示，并关闭结算卡片、结束约会
    await showCustomAlert("分享成功", "你们的约会记录已发送给Ta！");

    document.getElementById("dating-summary-overlay").classList.remove("visible");
    finalizeAndExitDate(); // 这个函数会处理后续的清理工作
    currentDatingSummary = null; // 清理临时数据
}

/**
 * 重新打开约会结算详情卡片
 * @param {object} payload - 从聊天记录消息中解析出的卡片数据
 */
function reopenDatingSummary(payload) {
    const overlay = document.getElementById("dating-summary-overlay");
    const card = document.querySelector(".dating-summary-card");
    const cardInner = document.querySelector(".dating-summary-card-inner");
    const cardFront = document.querySelector(".card-front");
    const avatarEl = document.getElementById("summary-card-avatar");
    const ratingEl = document.getElementById("summary-card-rating");
    const historyEl = document.getElementById("summary-card-history");

    // 重置卡片状态
    card.classList.remove("is-flipped");
    cardFront.classList.remove("romantic", "passionate", "perfect");
    cardFront.style.background = "";

    // 从 payload 中恢复数据并填充到UI元素中
    avatarEl.src = payload.avatarUrl;
    ratingEl.textContent = payload.rating;
    if (payload.ratingType && payload.ratingType !== "anticipation") {
        cardFront.classList.add(payload.ratingType);
    }

    const fullHistory = [...payload.storyHistory, `【旁白】: ${payload.finalStory}`].join("\n\n").replace(/\n/g, "<br>");
    historyEl.innerHTML = `<p>${fullHistory}</p>`;

    // 设置卡片背面的标题
    const cardBackHeader = document.querySelector(".card-back .card-back-header span");
    if (cardBackHeader) {
        cardBackHeader.textContent = `${payload.characterName} - ${payload.sceneName}`;
    }

    // 因为只是查看，所以隐藏"分享"按钮
    document.getElementById("summary-share-btn").style.display = "none";

    overlay.classList.add("visible");
}

/**
 * 打开历史约会界面
 */
async function openDatingHistory() {
    showScreen("dating-history-screen");
    await renderDatingHistory();
}

/**
 * 渲染历史约会列表
 */
async function renderDatingHistory() {
    const listEl = document.getElementById("dating-history-list");
    listEl.innerHTML = "";

    // 从数据库读取所有记录，并按时间倒序排列
    const records = await db.datingHistory.orderBy("timestamp").reverse().toArray();

    if (records.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">还没有任何约会记录哦</p>';
        return;
    }

    // 遍历每一条记录，创建对应的卡片并添加到列表中
    records.forEach((record) => {
        const card = createDatingHistoryCard(record);
        listEl.appendChild(card);
    });
}

/**
 * 根据单条历史记录，创建一张可翻转的卡片
 * @param {object} record - 历史记录对象
 * @returns {HTMLElement} - 创建好的卡片DOM元素
 */
function createDatingHistoryCard(record) {
    const cardContainer = document.createElement("div");
    cardContainer.className = "dating-summary-card"; // 复用结算卡片的样式，很方便！

    // 根据评级类型设置卡片正面的颜色
    let cardClass = "";
    if (record.ratingType === "romantic") cardClass = "romantic";
    else if (record.ratingType === "passionate") cardClass = "passionate";
    else if (record.ratingType === "perfect") cardClass = "perfect";

    // 拼接卡片背面的完整约会记录HTML
    const fullHistoryHtml = [...record.storyHistory, `【旁白】: ${record.finalStory}`].join("\n\n").replace(/\n/g, "<br>");

    // 获取角色名字，如果角色被删了，就显示"未知角色"
    const charName = state.chats[record.characterId]?.name || "未知角色";

    // 最终拼接成一个完整的、包含正反两面的卡片HTML
    cardContainer.innerHTML = `
                        <div class="dating-summary-card-inner">
                            <!-- 卡片正面 -->
                            <div class="card-front ${cardClass}">
                                <img src="${record.avatarUrl}" alt="角色头像">
                                <h2>${record.rating}</h2>
                                <p>${new Date(record.timestamp).toLocaleDateString()}</p>
                                <p class="summary-card-tip">点击查看详情</p>
                            </div>
                            <!-- 卡片背面 -->
                            <div class="card-back">
                                <div class="card-back-header">
                                    <span>${charName} - ${record.sceneName}</span>
                                </div>
                                <div class="card-back-content">
                                    <p>${fullHistoryHtml}</p>
                                </div>
                            </div>
                        </div>
                    `;
    return cardContainer;
}

/**
 * 根据场景名称，智能判断并返回重写后的场景描述和风格关键词
 * @param {string} sceneName - 用户输入的场景名称
 * @returns {{scenePrompt: string, styleKeywords: string}} - 返回包含场景描述和风格词的对象
 */
function getSceneTypeKeywords(sceneName) {
    const name = sceneName.toLowerCase(); // 转换为小写，方便匹配

    const outdoorKeywords = ["公园", "海滩", "山", "森林", "湖", "花园", "夜市", "路边", "街头", "park", "beach", "mountain", "forest", "lake", "garden", "street"];
    const indoorPublicKeywords = ["咖啡", "书店", "博物馆", "美术馆", "水族馆", "影院", "酒吧", "cafe", "bookstore", "museum", "gallery", "aquarium", "cinema", "bar"];
    const loveHotelKeywords = ["情趣", "love hotel", "主题酒店", "lovers hotel", "成人旅馆"];

    // 优先判断是否为特殊的情趣酒店
    if (loveHotelKeywords.some((keyword) => name.includes(keyword))) {
        console.log("场景识别为：情趣酒店（已激活特殊重写模式）");
        // 将"情趣酒店"翻译成纯粹的、描述性的场景
        return {
            scenePrompt: "an empty luxurious romantic hotel room interior, with a heart-shaped bed or a round bed, mirrors on the ceiling, neon mood lighting, Jacuzzi in room, sensual and intimate atmosphere",
            styleKeywords: "romantic, luxurious, intimate, playful",
        };
    }

    // 判断是否为户外场景
    if (outdoorKeywords.some((keyword) => name.includes(keyword))) {
        console.log("场景识别为：户外");
        return {
            scenePrompt: sceneName,
            styleKeywords: "natural lighting, golden hour, beautiful scenery, serene atmosphere, epic sky, wide angle",
        };
    }

    // 判断是否为室内公共场所
    if (indoorPublicKeywords.some((keyword) => name.includes(keyword))) {
        console.log("场景识别为：室内公共场所");
        return {
            scenePrompt: sceneName,
            styleKeywords: "cozy interior, ambient lighting, warm and inviting, charming decor, detailed background",
        };
    }

    // 默认情况，使用用户输入的名称
    console.log("场景识别为：通用/现代酒店");
    return {
        scenePrompt: sceneName,
        styleKeywords: "modern aesthetic, elegant decor, luxurious interior, clean, bright",
    };
}

/**
 * 保存用户自定义的约会场景
 */
async function handleSaveCustomDatingScene() {
    const name = document.getElementById("scene-name-input").value.trim();
    const imageUrl = document.getElementById("scene-image-url-input").value.trim();
    const costStr = document.getElementById("scene-cost-input").value.trim();

    if (!name || !costStr) {
        alert("场景名称和花费为必填项！");
        return;
    }

    const cost = parseInt(costStr, 10);
    if (isNaN(cost) || cost < 0) {
        alert("请输入有效的花费金额！");
        return;
    }

    const newScene = {
        name: name,
        cost: cost,
        uid: "scene_user_" + Date.now(),
    };

    if (imageUrl) {
        if (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image")) {
            alert("请输入一个有效的网络图片URL！");
            return;
        }
        newScene.imageUrl = imageUrl;
        newScene.imagePrompt = "User-provided image";
    } else {
        // 生成AI图像的提示词
        const universalStyle = "photorealistic, 4k, hyperrealistic, cinematic lighting, masterpiece, best quality, ultra detailed, no dark elements, romantic, (no humans:1.5), no people, no characters, empty room, no one";
        const promptParts = getSceneTypeKeywords(name);
        newScene.imageUrl = "";
        newScene.imagePrompt = `${promptParts.scenePrompt}, ${promptParts.styleKeywords}, ${universalStyle}`;

        console.log("【终极版】生成的Image Prompt:", newScene.imagePrompt);
    }

    try {
        await db.datingScenes.add(newScene);
        currentDatingScenes.push(newScene);
        document.getElementById("create-dating-scene-modal").classList.remove("visible");
        renderDatingScenes();
        alert("自定义约会场景已成功创建！");
    } catch (error) {
        console.error("保存自定义约会场景失败:", error);
        alert(`保存失败: ${error.message}`);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // 约会大作战功能事件监听器
    document.getElementById("date-a-live-app-icon").addEventListener("click", openDatingApp);
    document.getElementById("refresh-dating-scene-btn").addEventListener("click", refreshDatingScenes);
    document.getElementById("end-date-btn").addEventListener("click", endDate);

    // 使用事件委托处理约会场景卡片的删除和点击事件
    document.getElementById("dating-scene-content").addEventListener("click", (e) => {
        const card = e.target.closest(".dating-scene-card");
        if (!card) return;

        const sceneUid = card.dataset.uid;
        const scene = currentDatingScenes.find((s) => s.uid === sceneUid);
        if (!scene) return;

        // 如果点击的是删除按钮
        if (e.target.classList.contains("dating-scene-delete-btn")) {
            deleteDatingScene(sceneUid);
        } else {
            // 否则点击卡片本身，打开角色选择器
            openDatingCharacterSelector(scene);
        }
    });

    // 为文游文本框绑定点击切换下一句的事件
    document.querySelector(".dating-game-textbox").addEventListener("click", () => {
        if (datingGameState.isActive && !datingGameState.isSwitchingSentence && datingGameState.currentSentenceIndex < datingGameState.sentences.length - 1) {
            showNextSentence();
        }
    });

    // 约会大作战-文游模式UI事件绑定
    document.getElementById("dating-game-settings-btn").addEventListener("click", openDatingSettingsModal);
    document.getElementById("dating-game-reroll-btn").addEventListener("click", handleDatingReroll);

    // 设置弹窗内的按钮事件
    document.getElementById("cancel-dating-settings-btn").addEventListener("click", () => {
        document.getElementById("dating-game-settings-modal").classList.remove("visible");
        // 取消时恢复到角色已保存的设置
        const chat = state.chats[datingGameState.characterId];
        currentDatingUISettings = JSON.parse(JSON.stringify(chat.settings.datingUISettings || {}));
        applyDatingUISettings();
    });
    document.getElementById("save-dating-settings-btn").addEventListener("click", saveDatingSettings);

    // 图片上传按钮事件
    document.querySelector("#dating-game-settings-modal .bg-upload-container button").addEventListener("click", () => handleDatingImageUpload("bg"));
    document.querySelector("#dating-game-settings-modal .form-group:nth-of-type(5) .bg-upload-container button").addEventListener("click", () => handleDatingImageUpload("sprite"));

    // 图片URL输入实时更新
    document.getElementById("dating-bg-url-input").addEventListener("input", (e) => {
        currentDatingUISettings.backgroundUrl = e.target.value.trim();
        applyDatingUISettings();
    });

    // 约会立绘功能事件监听器
    document.getElementById("manage-sprite-groups-btn").addEventListener("click", openSpriteGroupManager);
    document.getElementById("close-sprite-group-manager-btn").addEventListener("click", () => {
        document.getElementById("sprite-group-manager-modal").classList.remove("visible");
    });

    document.getElementById("sprite-group-list-container").addEventListener("click", (e) => {
        const target = e.target;
        if (target.tagName === "BUTTON" && target.dataset.id) {
            const action = target.dataset.action;
            const groupId = parseInt(target.dataset.id);
            if (action === "edit") {
                openSpriteEditor(groupId);
            } else if (action === "delete") {
                deleteSpriteGroup(groupId);
            }
        }
    });

    document.getElementById("create-new-sprite-group-btn").addEventListener("click", () => openSpriteEditor());

    document.getElementById("cancel-sprite-editor-btn").addEventListener("click", () => {
        document.getElementById("sprite-editor-modal").classList.remove("visible");
    });

    document.getElementById("save-sprite-editor-btn").addEventListener("click", saveSpriteGroup);

    document.getElementById("add-new-sprite-btn").addEventListener("click", () => {
        document.getElementById("sprite-list-editor").appendChild(createSpriteEditCard());
    });

    // 约会预设功能按钮事件
    document.getElementById("dating-preset-select").addEventListener("change", handleDatingPresetSelect);
    document.getElementById("manage-dating-presets-btn").addEventListener("click", openDatingPresetManager);

    // 约会结算卡片事件绑定
    const summaryCard = document.querySelector(".dating-summary-card");
    const summaryCardBackBtn = document.getElementById("summary-flip-back-btn");

    // 点击卡片正面或背面的返回按钮触发翻转
    summaryCard.addEventListener("click", (e) => {
        // 确保点击的不是分享或关闭按钮
        if (!e.target.closest("button")) {
            summaryCard.classList.toggle("is-flipped");
        }
    });
    summaryCardBackBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // 阻止事件冒泡到父元素
        summaryCard.classList.remove("is-flipped");
    });

    // 分享按钮事件
    document.getElementById("summary-share-btn").addEventListener("click", shareDatingSummary);

    // 关闭按钮事件（支持不同场景）
    document.getElementById("summary-close-btn").addEventListener("click", async () => {
        if (datingGameState.isActive) {
            // 如果在约会中，确认并结束约会
            const confirmed = await showCustomConfirm("确认关闭", "确定要关闭结算卡片吗？关闭后约会即告结束。", { confirmButtonClass: "btn-danger" });
            if (confirmed) {
                finalizeAndExitDate();
            }
        } else {
            // 如果只是在单聊里查看分享，直接关闭弹窗
            document.getElementById("dating-summary-overlay").classList.remove("visible");
            // 重置卡片翻转状态
            const card = document.querySelector(".dating-summary-card");
            if (card) {
                card.classList.remove("is-flipped");
            }
        }
    });

    // 聊天记录中的卡片点击事件（事件委托）
    document.getElementById("chat-messages").addEventListener("click", (e) => {
        const chatCard = e.target.closest(".dating-summary-chat-card");
        // 检查 data-timestamp
        if (chatCard && chatCard.dataset.timestamp) {
            try {
                const timestamp = parseInt(chatCard.dataset.timestamp);
                const chat = state.chats[state.activeChatId];

                // 用时间戳从聊天记录里找到那条原始消息
                const message = chat.history.find((m) => m.timestamp === timestamp);

                // 如果找到了，直接用它的 payload
                if (message && message.payload) {
                    reopenDatingSummary(message.payload);
                } else {
                    // 如果因为某种原因没找到，给提示
                    alert("无法找到对应的约会记录数据。");
                }
            } catch (error) {
                console.error("打开分享的约会记录失败:", error);
                alert("打开约会记录时发生未知错误。");
            }
        }
    });

    // 约会历史记录功能事件绑定
    document.getElementById("dating-history-btn").addEventListener("click", openDatingHistory);
    document.getElementById("dating-history-back-btn").addEventListener("click", () => showScreen("date-a-live-screen"));

    // 使用事件委托为历史列表中的所有卡片绑定翻转事件
    document.getElementById("dating-history-list").addEventListener("click", (e) => {
        // 找到被点击的卡片
        const card = e.target.closest(".dating-summary-card");
        if (card) {
            // 切换 is-flipped 类触发CSS动画
            card.classList.toggle("is-flipped");
        }
    });

    // 约会大作战-创建场景功能事件绑定
    document.getElementById("create-dating-scene-btn").addEventListener("click", () => {
        // 打开创建弹窗并清空输入框
        document.getElementById("scene-name-input").value = "";
        document.getElementById("scene-image-url-input").value = "";
        document.getElementById("scene-cost-input").value = "";
        document.getElementById("create-dating-scene-modal").classList.add("visible");
    });

    document.getElementById("cancel-create-scene-btn").addEventListener("click", () => {
        document.getElementById("create-dating-scene-modal").classList.remove("visible");
    });

    document.getElementById("save-custom-scene-btn").addEventListener("click", handleSaveCustomDatingScene);
});
