// studio.js

document.addEventListener('DOMContentLoaded', () => {

    // ===================================================================
    // 1. 全局变量
    // ===================================================================
    let activeStudioScriptId = null; // 记录当前正在编辑或查看的剧本ID
    let activeStudioPlay = null; // 记录当前正在进行的演绎会话 { script, userRole, aiRole, aiChatId, history }


    // ===================================================================
    // 2. DOM 元素获取 (为提高性能，一次性获取)
    // ===================================================================
    const studioAppIcon = document.getElementById('studio-app-icon');
    const addScriptBtn = document.getElementById('add-studio-script-btn');
    const backFromEditorBtn = document.getElementById('back-from-studio-editor');
    const saveScriptBtn = document.getElementById('save-studio-script-btn');
    const scriptListEl = document.getElementById('studio-script-list');
    const editorScreen = document.getElementById('studio-editor-screen');
    const editorTitle = document.getElementById('studio-editor-title');
    const nameInput = document.getElementById('studio-name-input');
    const bgInput = document.getElementById('studio-background-input');
    const goalInput = document.getElementById('studio-goal-input');
    const char1Input = document.getElementById('studio-char1-identity-input');
    const char2Input = document.getElementById('studio-char2-identity-input');
    const roleSelectionModal = document.getElementById('studio-role-selection-modal');
    const playScreen = document.getElementById('studio-play-screen');
    const playMessagesEl = document.getElementById('studio-play-messages');
    const playInput = document.getElementById('studio-play-input');
    const sendPlayActionBtn = document.getElementById('send-studio-play-action-btn');
    const exitPlayBtn = document.getElementById('exit-studio-play-btn');
    const rerollPlayBtn = document.getElementById('reroll-studio-play-btn');
    const summaryModal = document.getElementById('studio-summary-modal');
    const novelModal = document.getElementById('studio-novel-share-modal');
    const aiGenerateScriptBtn = document.getElementById('ai-generate-script-btn');

    // ===================================================================
    // 3. 核心功能函数
    // ===================================================================

    /**
     * 显示小剧场主屏幕并渲染剧本列表
     */
    async function showStudioScreen() {
        await renderStudioScriptList();
        showScreen('studio-screen');
    }

    /**
     * 从数据库读取剧本并渲染到主列表
     */
    async function renderStudioScriptList() {
        if (!scriptListEl) return;
        const scripts = await db.studioScripts.toArray();
        scriptListEl.innerHTML = "";

        if (scripts.length === 0) {
            scriptListEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">还没有剧本，点击右上角创建一个吧！</p>';
            return;
        }

        scripts.forEach(script => {
            const item = document.createElement("div");
            item.className = "studio-script-item";
            item.innerHTML = `
                <div class="title">${script.name || '未命名剧本'}</div>
                <div class="goal">🎯 ${script.storyGoal || '暂无目标'}</div>
            `;
            item.addEventListener('click', () => openRoleSelection(script.id));

            // 添加长按删除功能
            addLongPressListener(item, () => {
                openStudioEditor(script.id);
            });

            scriptListEl.appendChild(item);
        });
    }

    /**
     * 打开剧本编辑器（新建或编辑）
     * @param {number|null} scriptId - 如果是编辑则传入ID，新建则为null
     */
    async function openStudioEditor(scriptId = null) {
        activeStudioScriptId = scriptId;
        const deleteBtn = document.getElementById('delete-studio-script-btn');
        const openingRemarkInput = document.getElementById('studio-opening-remark-input'); // 获取开场白输入框

        if (scriptId) {
            editorTitle.textContent = "编辑剧本";
            const script = await db.studioScripts.get(scriptId);
            nameInput.value = script.name || '';
            bgInput.value = script.storyBackground || '';
            goalInput.value = script.storyGoal || '';
            openingRemarkInput.value = script.openingRemark || ''; // 加载开场白
            char1Input.value = script.character1_identity || '';
            char2Input.value = script.character2_identity || '';
            deleteBtn.style.display = 'block';
        } else {
            editorTitle.textContent = "新增剧本";
            [nameInput, bgInput, goalInput, openingRemarkInput, char1Input, char2Input].forEach(input => input.value = ''); // 清空所有输入框
            deleteBtn.style.display = 'none';
        }

        showScreen('studio-editor-screen');
    }

    /**
     * [全新] 使用AI辅助生成或补完剧本内容
     */
    async function generateScriptWithAI() {
        await showCustomAlert("请稍候", "AI剧本娘正在奋笔疾书中...");

        // 1. 收集所有已填写的信息
        const existingData = {
            name: document.getElementById('studio-name-input').value.trim(),
            background: document.getElementById('studio-background-input').value.trim(),
            goal: document.getElementById('studio-goal-input').value.trim(),
            openingRemark: document.getElementById('studio-opening-remark-input').value.trim(),
            char1: document.getElementById('studio-char1-identity-input').value.trim(),
            char2: document.getElementById('studio-char2-identity-input').value.trim()
        };

        // 2. 构建给AI的详细指令 (Prompt)
        const systemPrompt = `
    # 你的角色
    你是一位才华横溢、想象力丰富的剧本创作大师。

    # 你的任务
    根据下方用户提供的【已有信息】，创作或补完一个引人入胜的戏剧剧本。
    你需要在【已有信息】的基础上进行构思，并生成所有标记为【(待生成)】的空白部分。

    # 已有信息
    - 剧本名称: ${existingData.name || '(待生成)'}
    - 故事背景: ${existingData.background || '(待生成)'}
    - 故事目标: ${existingData.goal || '(待生成)'}
    - 开场白: ${existingData.openingRemark || '(待生成)'}
    - 人物1身份背景: ${existingData.char1 || '(待生成)'}
    - 人物2身份背景: ${existingData.char2 || '(待生成)'}

    # 输出要求 (【【【最高指令，必须严格遵守】】】)
    1.  你的回复【必须且只能】是一个完整的、严格的JSON对象，绝不能包含任何解释性文字或Markdown标记。
    2.  这个JSON对象必须包含以下六个键: "name", "background", "goal", "openingRemark", "char1", "char2"。
    3.  你需要为所有标记为【(待生成)】的字段生成内容，并保持与已有信息的一致性和逻辑性。
    4.  生成的内容需要有创造性、戏剧性，并符合剧本创作的基本要求。人物和背景要鲜明、包含动机和潜在的秘密。
    5.  不能给人物1和人物2起名字，生成的全部内容，如背景、目标等，都不允许出现人物姓名，可以用身份指代。
    6.  生成人物时重点在身份和背景，尽量不要包含人物性格。

    # JSON输出格式示例:
    {
    "name": "失落的星图",
    "background": "在一个蒸汽朋克与魔法共存的世界里，传说中的星图被盗，这件神器据说能指引通往失落天空城的道路。",
    "goal": "在皇家飞艇启航前，找回星图，并揭露盗贼的真实身份。",
    "openingRemark": "锈蚀的齿轮在雨夜中呻吟，一封染血的密信滑入了侦探社的门缝...",
    "char1": "一位负债累累、但观察力敏锐的私家侦探，曾是皇家护卫队的一员，因一次意外被开除。",
    "char2": "一位神秘的贵族千金，星图失窃案的委托人，但她似乎对星图本身比对找回它更感兴趣。"
    }

    现在，请开始你的创作。`;

        try {
            const responseText = await getApiResponse(systemPrompt);

            // 3. 解析AI返回的JSON数据
            const sanitizedText = responseText.replace(/^```json\s*|```$/g, "").trim();
            const parsedData = JSON.parse(sanitizedText);

            // 4. 将生成的内容填充回输入框 (只填充原本为空的)
            if (!existingData.name && parsedData.name) {
                document.getElementById('studio-name-input').value = parsedData.name;
            }
            if (!existingData.background && parsedData.background) {
                document.getElementById('studio-background-input').value = parsedData.background;
            }
            if (!existingData.goal && parsedData.goal) {
                document.getElementById('studio-goal-input').value = parsedData.goal;
            }
            if (!existingData.openingRemark && parsedData.openingRemark) {
                document.getElementById('studio-opening-remark-input').value = parsedData.openingRemark;
            }
            if (!existingData.char1 && parsedData.char1) {
                document.getElementById('studio-char1-identity-input').value = parsedData.char1;
            }
            if (!existingData.char2 && parsedData.char2) {
                document.getElementById('studio-char2-identity-input').value = parsedData.char2;
            }

            await showCustomAlert("完成！", "剧本已由AI填充完毕！");

        } catch (error) {
            console.error("AI生成剧本失败:", error);
            await showCustomAlert("生成失败", `发生错误: ${error.message}\n\nAI返回的原始数据可能不是有效的JSON格式，请在控制台查看详情。`);
            console.error("AI原始返回内容:", error.rawResponse || "无"); // 假设错误对象可能包含原始响应
        }
    }

    /**
     * 保存当前编辑的剧本到数据库
     */
    async function saveStudioScript() {
        const scriptData = {
            name: nameInput.value.trim() || '未命名剧本',
            storyBackground: bgInput.value.trim(),
            storyGoal: goalInput.value.trim(),
            openingRemark: document.getElementById('studio-opening-remark-input').value.trim(), // 新增
            character1_identity: char1Input.value.trim(),
            character2_identity: char2Input.value.trim()
        };

        if (!scriptData.name || !scriptData.storyBackground || !scriptData.storyGoal || !scriptData.character1_identity || !scriptData.character2_identity) {
            alert('除了开场白，所有字段均为必填项哦！');
            return;
        }

        if (activeStudioScriptId) {
            await db.studioScripts.update(activeStudioScriptId, scriptData);
        } else {
            await db.studioScripts.add(scriptData);
        }

        alert('剧本已保存！');
        showStudioScreen();
    }

    /**
     * 打开角色选择模态框
     * @param {number} scriptId - 被选中的剧本ID
     */
    async function openRoleSelection(scriptId) {
        const script = await db.studioScripts.get(scriptId);
        if (!script) return;

        activeStudioScriptId = scriptId;

        const role1Desc = document.getElementById('studio-role1-desc');
        const role2Desc = document.getElementById('studio-role2-desc');
        const role1IdentitySelect = document.getElementById('studio-role1-identity-select');
        const role2IdentitySelect = document.getElementById('studio-role2-identity-select');

        role1Desc.textContent = script.character1_identity || '暂无描述';
        role2Desc.textContent = script.character2_identity || '暂无描述';

        // 1. 获取用户（你）的微博昵称和人设
        if (!window.state || !window.state.qzoneSettings) {
            alert('错误：无法加载用户信息。请确保主应用已正确加载。');
            return;
        }
        const userNickname = window.state.qzoneSettings.nickname || '我';
        const userPersona = window.state.qzoneSettings.weiboUserPersona || '一个普通的用户。';

        // 2. 填充下拉框选项（现在是身份列表）
        const characters = Object.values(window.state.chats).filter(chat => !chat.isGroup);
        let optionsHtml = `<option value="user" data-persona="${escape(userPersona)}">${userNickname}</option>`;
        optionsHtml += characters.map(char => {
            const persona = char.settings.aiPersona || '';
            return `<option value="${char.id}" data-persona="${escape(persona)}">${char.name}</option>`;
        }).join('');

        role1IdentitySelect.innerHTML = optionsHtml;
        role2IdentitySelect.innerHTML = optionsHtml;

        // 3. 设置默认的【身份】分配
        role1IdentitySelect.value = 'user'; // 人物1默认使用你的身份
        if (characters.length > 0) {
            role2IdentitySelect.value = characters[0].id; // 人物2默认使用第一个AI的身份
        } else {
            // 如果没有AI，需要禁用另一个下拉框或给出提示
            role2IdentitySelect.innerHTML = '<option value="">没有可用的AI角色身份</option>';
        }

        // 4. 设置默认的【扮演者】分配
        const radiosRole1 = document.querySelectorAll('input[name="player-role1"]');
        const radiosRole2 = document.querySelectorAll('input[name="player-role2"]');
        radiosRole1.forEach(r => { if (r.value === 'user') r.checked = true; }); // 人物1默认由你扮演
        radiosRole2.forEach(r => { if (r.value === 'ai') r.checked = true; });   // 人物2默认由AI扮演

        // 5. 绑定单选框的联动事件
        const playerSelectionGroups = document.querySelectorAll('.player-selection-group');
        playerSelectionGroups.forEach((group, index) => {
            group.addEventListener('change', (e) => {
                const selectedPlayer = e.target.value;
                const otherIndex = index === 0 ? 1 : 0; // 找到另一个角色组
                const otherGroupRadios = playerSelectionGroups[otherIndex].querySelectorAll('input[type="radio"]');

                if (selectedPlayer === 'user') {
                    // 如果当前角色选了“我扮演”，另一个角色必须是“AI扮演”
                    otherGroupRadios.forEach(radio => {
                        if (radio.value === 'ai') radio.checked = true;
                    });
                } else { // selectedPlayer === 'ai'
                    // 如果当前角色选了“AI扮演”，另一个角色必须是“我扮演”
                    otherGroupRadios.forEach(radio => {
                        if (radio.value === 'user') radio.checked = true;
                    });
                }
            });
        });

        roleSelectionModal.classList.add('visible');
    }

    /**
     * 开始演绎
     */
    async function startStudioPlay() {
        const script = await db.studioScripts.get(activeStudioScriptId);

        // 1. 获取【扮演者】信息
        const role1Player = document.querySelector('input[name="player-role1"]:checked').value;
        const role2Player = document.querySelector('input[name="player-role2"]:checked').value;

        // 2. 获取【身份】信息
        const role1IdentitySelect = document.getElementById('studio-role1-identity-select');
        const role2IdentitySelect = document.getElementById('studio-role2-identity-select');
        const role1IdentityValue = role1IdentitySelect.value;
        const role2IdentityValue = role2IdentitySelect.value;

        // 从<option>的data属性获取人设
        const role1Persona = unescape(role1IdentitySelect.options[role1IdentitySelect.selectedIndex].dataset.persona);
        const role2Persona = unescape(role2IdentitySelect.options[role2IdentitySelect.selectedIndex].dataset.persona);

        // 3. 验证
        if (role1Player === 'ai' && role2Player === 'ai') {
            alert('必须有一个角色由你扮演！'); // 理论上不会发生，但作为安全校验
            return;
        }
        if (role1IdentityValue === role2IdentityValue) {
            alert('两个角色的身份不能是同一个人！');
            return;
        }

        const userRoleNumber = role1Player === 'user' ? 1 : 2;
        const aiRoleNumber = role1Player === 'ai' ? 1 : 2;

        const aiIdentityValue = aiRoleNumber === 1 ? role1IdentityValue : role2IdentityValue;
        const aiChatId = aiIdentityValue !== 'user' ? aiIdentityValue : (userRoleNumber === 1 ? role2IdentityValue : role1IdentityValue);

        // 如果AI扮演的角色选择了“user”身份，这是无效的
        // if (aiIdentityValue === 'user') {
        //     alert('AI不能扮演“你”的身份，请为AI扮演的角色选择一个AI身份。');
        //     return;
        // }

        // 4. 初始化演绎会话
        activeStudioPlay = {
            script: script,
            userRole: userRoleNumber,
            aiRole: aiRoleNumber,
            aiChatId: aiChatId,
            // ★★★ 核心新增：存储AI和用户的临时身份 ★★★
            aiIdentity: aiRoleNumber === 1 ? script.character1_identity : script.character2_identity,
            userPersona: userRoleNumber === 1 ? script.character1_identity : script.character2_identity,
            history: [],
        };

        // 1. 如果有开场白，先把它作为第一条消息
        if (script.openingRemark) {
            const openingMessage = {
                role: 'system',
                content: `【开场白】\n${script.openingRemark}`
            };
            activeStudioPlay.history.push(openingMessage);
        }

        // 2. 然后将故事背景作为第二条消息
        const backgroundMessage = {
            role: 'system',
            content: `【故事背景】\n${script.storyBackground}`
        };
        activeStudioPlay.history.push(backgroundMessage);

        // 将用户扮演的角色任务附加在后面
        // const userInitialIdentity = userRoleNumber === 1 ? script.character1_identity : script.character2_identity;
        // initialContent += `\n\n【你的任务】\n${userInitialIdentity}`;

        // const initialMessage = {
        //     role: 'system',
        //     content: initialContent
        // };
        // activeStudioPlay.history.push(initialMessage);

        roleSelectionModal.classList.remove('visible');
        renderStudioPlayScreen();
        showScreen('studio-play-screen');

        // 如果是AI先行动，触发AI
        // 可以在这里添加逻辑，例如判断剧本设定谁先开始
    }

    /**
     * 渲染演绎界面
     */
    function renderStudioPlayScreen() {
        if (!activeStudioPlay) return;

        document.getElementById('studio-play-title').textContent = activeStudioPlay.script.name;
        playMessagesEl.innerHTML = '';

        activeStudioPlay.history.forEach(msg => {
            const bubble = createPlayMessageElement(msg);
            playMessagesEl.appendChild(bubble);
        });

        playMessagesEl.scrollTop = playMessagesEl.scrollHeight;
    }

    /**
     * 创建一条演绎消息气泡 (已修复AI气泡的class名)
     * @param {object} msg - 消息对象
     */
    function createPlayMessageElement(msg) {
        const wrapper = document.createElement("div");

        // ★★★ 核心修复：在这里判断角色并使用正确的class名 ★★★
        const roleClass = msg.role === 'assistant' ? 'ai' : msg.role;

        if (msg.role === 'system') {
            wrapper.className = 'message-wrapper studio-system';
            wrapper.innerHTML = `<div class="message-bubble studio-system-bubble">${msg.content.replace(/\n/g, '<br>')}</div>`;
        } else {
            // ★★★ 使用我们新定义的 roleClass，它会将 'assistant' 转换为 'ai' ★★★
            wrapper.className = `message-wrapper ${roleClass}`;
            const bubble = document.createElement("div");
            bubble.className = `message-bubble ${roleClass}`;

            const chat = window.state.chats[activeStudioPlay.aiChatId];
            let avatarSrc = 'https://i.postimg.cc/PxZrFFFL/o-o-1.jpg'; // 默认头像

            // 根据角色获取正确的头像
            if (msg.role === 'user') {
                const userNickname = window.state.qzoneSettings.weiboNickname || '我';
                const userIdentityValue = activeStudioPlay.userRole === 1 ? document.getElementById('studio-role1-identity-select').value : document.getElementById('studio-role2-identity-select').value;
                if (userIdentityValue !== 'user' && window.state.chats[userIdentityValue]) {
                    avatarSrc = window.state.chats[userIdentityValue].settings.aiAvatar;
                } else {
                    avatarSrc = window.state.qzoneSettings.avatar || avatarSrc;
                }
            } else { // assistant
                avatarSrc = chat?.settings?.aiAvatar || avatarSrc;
            }

            bubble.innerHTML = `<img src="${avatarSrc}" class="avatar"><div class="content">${msg.content.replace(/\n/g, '<br>')}</div>`;
            wrapper.appendChild(bubble);
        }

        return wrapper;
    }

    /**
     * [全新] 处理用户点击“刷新”按钮，重新生成AI的上一轮回应
     */
    async function handleRerollPlay() {
        if (!activeStudioPlay || activeStudioPlay.history.length < 2) {
            alert("还没有足够的内容来刷新哦。");
            return;
        }

        // 撤销上一步操作
        // 通常，最后一条是旁白(system)，倒数第二条是AI的回复(assistant)
        const lastMsg = activeStudioPlay.history[activeStudioPlay.history.length - 1];
        if (lastMsg && lastMsg.role === 'system' && lastMsg.content.includes('【旁白】')) {
            activeStudioPlay.history.pop();
        }

        const secondLastMsg = activeStudioPlay.history[activeStudioPlay.history.length - 1];
        if (secondLastMsg && secondLastMsg.role === 'assistant') {
            activeStudioPlay.history.pop();
        } else {
            // 如果AI回复后，旁白生成失败，这里可能只有AI的回复
            if (lastMsg && lastMsg.role === 'assistant') {
                activeStudioPlay.history.pop();
            }
        }

        // 重新渲染界面，移除被撤销的消息
        renderStudioPlayScreen();

        // 重新触发AI回应
        await triggerAiStudioResponse();
    }

    /**
     * 处理用户在演绎中发送行动
     */
    async function handleUserPlayAction() {
        const content = playInput.value.trim();
        if (!content) return;

        const userMessage = { role: 'user', content: content };
        activeStudioPlay.history.push(userMessage);

        // 清空输入框并刷新界面
        playInput.value = '';
        playInput.style.height = 'auto';
        playMessagesEl.appendChild(createPlayMessageElement(userMessage));
        playMessagesEl.scrollTop = playMessagesEl.scrollHeight;

        // 触发AI回应
        await triggerAiStudioResponse();
    }

    /**
     * 触发AI在演绎中的回应
     */
    async function triggerAiStudioResponse() {
        const { script, aiRole, aiChatId, history, aiIdentity, userPersona } = activeStudioPlay;
        const chat = window.state.chats[aiChatId];

        // 1. 显示“角色正在行动”的提示
        const actionTypingIndicator = createTypingIndicator(`${chat.name} 正在行动...`);
        playMessagesEl.appendChild(actionTypingIndicator);
        playMessagesEl.scrollTop = playMessagesEl.scrollHeight;

        // ★★★ 核心修改：构建新的、层次更分明的Prompt ★★★
        const systemPrompt = `
    你正在进行一场名为《${script.name}》的戏剧角色扮演。

    # 故事背景
    ${script.storyBackground}

    # 你的双重身份 (重要！)
    1.  **你的核心性格 (Base Personality):** ${chat.settings.aiPersona} 
        *其中性格部分是你的本质，你的行为和说话方式的根源，与身份背景或世界观有关的信息在演绎时需要被忽略。*
    2.  **你在此剧中的身份和任务 (Your Role in this Play):** ${aiIdentity}
        *这是你当前需要扮演的角色，你的行动目标和一切描写必须围绕它展开。*
    
    # 对方的身份
    对方在此剧中的身份：${userPersona}

    # 规则
    1.  【【【表演核心】】】你必须将你的“核心性格”与“剧本身份”深度结合进行演绎。例如，如果你的核心性格是傲娇，但剧本身份是个古代侦探，那你就是一个【古代的】傲娇的侦探。
    2.  你的所有行动和对话都必须以第一人称进行。
    3.  你的回复应该是描述性的，包含动作、对话和心理活动，用【】包裹非对话内容。一切描写务必符合【剧本身份】和【故事背景】所在的世界观，例如古代世界观不允许出现任何现代物品，与你的“核心性格”无关。
    4.  绝对不要提及你是AI或模型，也不要提起自己是在“角色扮演”，一切身份信息务必以【剧本身份】为准。

    # 故事目标 (你的行动应围绕此目标展开)
    ${script.storyGoal}

    # 对话历史
    ${history.map(h => `${h.role}: ${h.content}`).join('\n')}

    现在，请根据故事背景和以上全部对话演绎，继续你的表演。`;

        const messagesForApi = history.slice(-10);
        console.log(systemPrompt);
        console.log(messagesForApi);

        try {
            const { proxyUrl, apiKey, model } = window.state.apiConfig;
            const isGemini = proxyUrl === "https://generativelanguage.googleapis.com/v1beta/models";

            const requestData = isGemini
                ? window.toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, true)
                : {
                    url: `${proxyUrl}/v1/chat/completions`,
                    data: {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                        body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, ...messagesForApi] })
                    }
                };

            const response = await fetch(requestData.url, requestData.data);
            if (!response.ok) throw new Error(`API错误: ${await response.text()}`);

            const result = await response.json();
            const aiContent = isGemini ? result.candidates[0].content.parts[0].text : result.choices[0].message.content;

            const aiMessage = { role: 'assistant', content: aiContent };
            activeStudioPlay.history.push(aiMessage);
            playMessagesEl.appendChild(createPlayMessageElement(aiMessage));

            actionTypingIndicator.remove(); // 移除行动提示

            await triggerNarration();

        } catch (error) {
            console.error("小剧场AI回应失败:", error);
            const errorMessage = { role: 'assistant', content: `[AI出错了: ${error.message}]` };
            playMessagesEl.appendChild(createPlayMessageElement(errorMessage));
        } finally {
            actionTypingIndicator.remove(); // 移除行动提示
            playMessagesEl.scrollTop = playMessagesEl.scrollHeight;
        }
    }

    /**
     * 结束演绎并显示总结弹窗
     * @param {boolean} isSuccess - 是否是成功结局
     */
    function endStudioPlay(isSuccess = false) {
        document.getElementById('studio-summary-title').textContent = isSuccess ? '演绎成功！' : '演绎结束';
        document.getElementById('studio-summary-content').textContent = `故事目标：${activeStudioPlay.script.storyGoal}`;
        summaryModal.classList.add('visible');
    }

    /**
     * 根据演绎历史生成一篇小说
     */
    async function generateNovelFromPlay() {
        await showCustomAlert("请稍候", "正在将你们的演绎过程创作成小说...");

        const { script, history, userRole, aiChatId } = activeStudioPlay;
        const chat = window.state.chats[aiChatId];

        const systemPrompt = `
    # 你的任务
    你是一位出色的小说家。请根据下面的剧本设定和对话历史，将这段角色扮演的过程改编成一篇引人入胜的短篇小说。

    # 剧本设定
    - 剧本名: ${script.name}
    - 故事背景: ${script.storyBackground}
    - 人物1身份: ${script.character1_identity}
    - 人物2身份: ${script.character2_identity}
    - 故事目标: ${script.storyGoal}

    # 对话历史
    ${history.map(h => `${h.role}: ${h.content}`).join('\n')}

    # 写作要求
    1. 使用第三人称叙事。
    2. 保持故事的连贯性和逻辑性。
    3. 丰富人物的心理活动和环境描写，将对话无缝融入到叙事中。
    4. 最终得出一个清晰的结局，并点明故事目标是否达成。
    5. 小说内容要完整、精彩，字数在5000字以上。
    `;

        try {
            const { proxyUrl, apiKey, model } = window.state.apiConfig;
            const isGemini = proxyUrl === "https://generativelanguage.googleapis.com/v1beta/models";
            const requestData = isGemini
                ? window.toGeminiRequestData(model, apiKey, systemPrompt, [{ role: 'user', content: '请开始创作' }], true)
                : {
                    url: `${proxyUrl}/v1/chat/completions`,
                    data: {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                        body: JSON.stringify({ model, messages: [{ role: "user", content: systemPrompt }], temperature: 0.7 })
                    }
                };

            const response = await fetch(requestData.url, requestData.data);
            if (!response.ok) throw new Error(`API错误: ${await response.text()}`);

            const result = await response.json();
            const novelText = isGemini ? result.candidates[0].content.parts[0].text : result.choices[0].message.content;

            // ★★★ 核心新增：在这里保存故事记录 ★★★
            const myNickname = window.state.qzoneSettings.nickname || '我';
            const historyRecord = {
                scriptName: script.name,
                storyGoal: script.storyGoal,
                novelContent: novelText,
                timestamp: Date.now(),
                participants: {
                    role1: userRole === 1 ? myNickname : chat.name,
                    role2: userRole === 2 ? myNickname : chat.name
                }
            };
            await db.studioHistory.add(historyRecord);
            console.log('故事记录已成功保存到数据库！');
            // ★★★ 新增结束 ★★★

            document.getElementById('studio-novel-content').textContent = novelText;
            novelModal.classList.add('visible');
            summaryModal.classList.remove('visible');

        } catch (error) {
            console.error("生成小说失败:", error);
            await showCustomAlert("生成失败", `发生错误: ${error.message}`);
        }
    }

    /**
     * 将生成的小说分享给参与的角色
     */
    async function shareNovel() {
        const novelText = document.getElementById('studio-novel-content').textContent;
        if (!novelText) return;

        const { aiChatId } = activeStudioPlay;
        const chat = window.state.chats[aiChatId];

        const confirmed = await showCustomConfirm("确认分享", `确定要将这篇小说分享给“${chat.name}”吗？`);

        if (confirmed) {
            const shareMessage = {
                role: 'user',
                type: 'share_link',
                title: `我们共同演绎的小说：《${activeStudioPlay.script.name}》`,
                description: '点击查看我们共同创作的故事！',
                source_name: '小剧场',
                content: novelText,
                timestamp: Date.now()
            };

            chat.history.push(shareMessage);
            await db.chats.put(chat);

            novelModal.classList.remove('visible');
            alert('分享成功！');
            // 可以选择跳转回聊天界面
            openChat(aiChatId);
        }
    }


    // ===================================================================
    // 4. 事件监听器
    // ===================================================================
    if (studioAppIcon) {
        studioAppIcon.addEventListener('click', showStudioScreen);
    }

    const studioHistoryBtn = document.getElementById('studio-history-btn');
    if (studioHistoryBtn) {
        studioHistoryBtn.addEventListener('click', openStudioHistoryScreen);
    }

    const backFromHistoryBtn = document.getElementById('back-from-studio-history');
    if (backFromHistoryBtn) {
        backFromHistoryBtn.addEventListener('click', showStudioScreen);
    }

    if (addScriptBtn) {
        addScriptBtn.addEventListener('click', () => openStudioEditor(null));
    }

    if (addScriptBtn) {
        addScriptBtn.addEventListener('click', () => openStudioEditor(null));
    }

    if (backFromEditorBtn) {
        backFromEditorBtn.addEventListener('click', showStudioScreen);
    }

    if (saveScriptBtn) {
        saveScriptBtn.addEventListener('click', saveStudioScript);
    }

    if (aiGenerateScriptBtn) {
        aiGenerateScriptBtn.addEventListener('click', generateScriptWithAI);
    }

    if (roleSelectionModal) {
        document.getElementById('cancel-role-selection-btn').addEventListener('click', () => {
            roleSelectionModal.classList.remove('visible');
        });
        document.getElementById('confirm-role-selection-btn').addEventListener('click', startStudioPlay);
    }

    if (exitPlayBtn) {
        exitPlayBtn.addEventListener('click', async () => {
            const confirmed = await showCustomConfirm("确认退出", "确定要中途退出这次演绎吗？", { confirmButtonClass: "btn-danger" });
            if (confirmed) {
                endStudioPlay(false);
            }
        });
    }

    if (rerollPlayBtn) {
        rerollPlayBtn.addEventListener('click', handleRerollPlay);
    }

    if (sendPlayActionBtn) {
        sendPlayActionBtn.addEventListener('click', handleUserPlayAction);
        playInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleUserPlayAction();
            }
        });
    }

    if (summaryModal) {
        document.getElementById('generate-novel-btn').addEventListener('click', generateNovelFromPlay);
        document.getElementById('close-studio-summary-btn').addEventListener('click', () => {
            summaryModal.classList.remove('visible');
            showStudioScreen(); // 返回剧本列表
        });
    }

    if (novelModal) {
        document.getElementById('share-novel-btn').addEventListener('click', shareNovel);
        document.getElementById('close-novel-share-btn').addEventListener('click', () => {
            novelModal.classList.remove('visible');
            showStudioScreen();
        });
    }

    /**
     * 打开故事记录屏幕
     */
    async function openStudioHistoryScreen() {
        await renderStudioHistoryList();
        showScreen('studio-history-screen');
    }

    /**
     * 渲染故事记录列表
     */
    async function renderStudioHistoryList() {
        const listEl = document.getElementById('studio-history-list');
        if (!listEl) return;

        // 按时间倒序获取所有记录
        const records = await db.studioHistory.orderBy('timestamp').reverse().toArray();
        listEl.innerHTML = "";

        if (records.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">还没有完成过任何故事哦。</p>';
            return;
        }

        records.forEach(record => {
            const item = document.createElement("div");
            item.className = "studio-script-item"; // 复用剧本列表的样式
            const recordDate = new Date(record.timestamp);

            item.innerHTML = `
                <div class="title">${record.scriptName}</div>
                <div class="goal" style="margin-top: 5px;">🎭 参与者: ${record.participants.role1}, ${record.participants.role2}</div>
                <div class="goal" style="font-size: 12px; margin-top: 8px;">记录于: ${recordDate.toLocaleString()}</div>
            `;

            item.addEventListener('click', () => viewStudioHistoryDetail(record.id));

            // 添加长按删除
            addLongPressListener(item, async () => {
                const confirmed = await showCustomConfirm("删除记录", "确定要删除这条故事记录吗？此操作不可撤销。", { confirmButtonClass: "btn-danger" });
                if (confirmed) {
                    await deleteStudioHistory(record.id);
                }
            });
            listEl.appendChild(item);
        });
    }

    /**
     * 查看指定的故事记录详情（小说内容）
     * @param {number} recordId - 记录的ID
     */
    async function viewStudioHistoryDetail(recordId) {
        const record = await db.studioHistory.get(recordId);
        if (!record) {
            alert("找不到该条记录！");
            return;
        }

        // 复用小说分享弹窗来显示内容
        const novelContentEl = document.getElementById('studio-novel-content');
        novelContentEl.textContent = record.novelContent;

        // 修改弹窗按钮，只保留“关闭”
        const footer = novelModal.querySelector('.modal-footer');
        footer.innerHTML = `<button class="save" id="close-history-view-btn" style="width:100%">关闭</button>`;
        document.getElementById('close-history-view-btn').addEventListener('click', () => {
            novelModal.classList.remove('visible');
        });

        novelModal.classList.add('visible');
    }

    /**
     * 删除一条故事记录
     * @param {number} recordId - 记录的ID
     */
    async function deleteStudioHistory(recordId) {
        await db.studioHistory.delete(recordId);
        await renderStudioHistoryList(); // 刷新列表
        alert('故事记录已删除。');
    }

    const deleteScriptBtn = document.getElementById('delete-studio-script-btn');
    if (deleteScriptBtn) {
        deleteScriptBtn.addEventListener('click', async () => {
            if (!activeStudioScriptId) return;

            const script = await db.studioScripts.get(activeStudioScriptId);
            const scriptName = script ? script.name : "此剧本";

            const confirmed = await showCustomConfirm("确认删除", `确定要永久删除剧本《${scriptName}》吗？此操作不可恢复。`, { confirmButtonClass: "btn-danger" });

            if (confirmed) {
                await db.studioScripts.delete(activeStudioScriptId);
                activeStudioScriptId = null; // 清空当前编辑ID
                alert('剧本已删除。');
                showStudioScreen(); // 返回剧本列表界面
            }
        });
    }

    /**
     * [新] 创建一个通用的“正在输入”提示元素 (已添加专属class)
     * @param {string} text - 要显示的提示文本
     * @returns {HTMLElement}
     */
    function createTypingIndicator(text) {
        const indicator = document.createElement("div");
        // ★★★ 核心修改：使用专属的 'studio-indicator' 类名，方便CSS精确定位 ★★★
        indicator.className = "message-wrapper studio-indicator";
        // 同时，为了外观统一，我们让它使用和旁白一样的气泡样式
        indicator.innerHTML = `<div class="message-bubble studio-system-bubble" style="opacity: 0.8;">${text}</div>`;
        return indicator;
    }

    /**
     * [新] 触发旁白生成 (已集成结局判定功能)
     */
    async function triggerNarration() {
        const { script, history } = activeStudioPlay;

        const narrationTypingIndicator = createTypingIndicator("故事发展中...");
        playMessagesEl.appendChild(narrationTypingIndicator);
        playMessagesEl.scrollTop = playMessagesEl.scrollHeight;

        // ★★★ 核心修改：为旁白Prompt增加结局判定的最高优先级任务 ★★★
        const narrationPrompt = `
    # 你的任务
    你是一个掌控故事节奏的“地下城主”(DM)或“旁白”。你的主要任务是根据剧本设定和已发生的对话，推动情节发展。

    # 剧本设定
    - 剧本名: ${script.name}
    - 故事背景: ${script.storyBackground}
    - 故事目标: ${script.storyGoal}

    # 已发生的对话历史
    ${history.map(h => `${h.role}: ${h.content}`).join('\n')}

    # 【第一任务：结局判定 (最高优先级)】
    1.  首先，请仔细阅读上方的【故事目标】。
    2.  然后，审视【已发生的对话历史】，判断角色的行动和对话是否已经明确达成了【故事目标】。
    3.  如果【故事目标已达成】且剧情已完整，你的回复【必须且只能】是一个JSON对象，格式如下：
        {"isEnd": true, "narration": "在这里写下总结性的结局旁白，例如：随着真相大白，这场风波终于落下帷幕..."}
    4.  如果【故事目标未达成】或剧情尚在发展中，请继续执行你的第二任务。

    # 【第二任务：旁白生成 (当结局未达成时执行)】
    1.  **保持中立**: 以第三人称客观视角进行描述，不要带有任何角色的主观情绪，也不可以包含任何角色的行动或感受。
    2.  **推进剧情**: 你的旁白应该引入新的事件、新的线索、环境的变化或意想不到的转折。
    3.  **控制节奏**: 不要过快地让角色达成最终目标。你的任务是制造波折和悬念，让故事更有趣。
    4.  **简短精悍**: 旁白内容不宜过长，几句话即可。
    5.  **禁止对话**: 你的回复【只能是旁白描述】，绝对不能包含任何角色的对话。

    现在，请根据以上所有信息，开始你的工作。`;

        try {
            const responseText = await getApiResponse(narrationPrompt);

            // ★★★ 核心修改：尝试解析AI的回复，判断是否为结束信号 ★★★
            try {
                const parsedResponse = JSON.parse(responseText);
                if (parsedResponse.isEnd === true && parsedResponse.narration) {
                    // AI确认结局已达成
                    const finalNarration = { role: 'system', content: `【结局】\n${parsedResponse.narration}` };
                    activeStudioPlay.history.push(finalNarration);
                    playMessagesEl.appendChild(createPlayMessageElement(finalNarration));

                    // 延迟一小会儿，然后弹出成功结算窗口
                    setTimeout(() => {
                        endStudioPlay(true);
                    }, 1500);

                    return; // 结束函数，不再执行后续逻辑
                }
            } catch (e) {
                // 解析失败，说明AI返回的是普通的旁白文本，不是JSON结束信号
                // 我们什么都不做，让程序继续往下走
            }

            // 如果程序能走到这里，说明结局未达成，正常处理旁白
            if (responseText) {
                const narrationMessage = { role: 'system', content: `【旁白】\n${responseText}` };
                activeStudioPlay.history.push(narrationMessage);
                playMessagesEl.appendChild(createPlayMessageElement(narrationMessage));
            }

        } catch (error) {
            console.error("旁白生成失败:", error);
            const errorMessage = { role: 'system', content: `[旁白生成失败: ${error.message}]` };
            playMessagesEl.appendChild(createPlayMessageElement(errorMessage));
        } finally {
            narrationTypingIndicator.remove();
            playMessagesEl.scrollTop = playMessagesEl.scrollHeight;
        }
    }

    /**
     * [新] 通用的AI API请求函数
     * @param {string} systemPrompt - 发送给AI的系统指令
     * @returns {Promise<string>} AI返回的文本内容
     */
    async function getApiResponse(systemPrompt) {
        const { proxyUrl, apiKey, model } = window.state.apiConfig;
        const isGemini = proxyUrl === "https://generativelanguage.googleapis.com/v1beta/models";

        const temperature = parseFloat(window.state.apiConfig.temperature) || 0.8;

        // ★★★ 核心修改：为OpenAI兼容的API请求体中增加一个 user 角色消息，构成合法对话 ★★★
        const messagesForApi = [
            { role: "system", content: systemPrompt },
            { role: "user", content: "请开始你的表演。" } // Gemini API也需要一个用户消息，所以我们统一添加
        ];

        const requestData = isGemini
            ? window.toGeminiRequestData(model, apiKey, systemPrompt, [{ role: 'user', content: '请开始你的表演。' }], true, temperature)
            : {
                url: `${proxyUrl}/v1/chat/completions`,
                data: {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                    // ★★★ 使用我们新创建的、包含user角色的 messagesForApi 变量 ★★★
                    body: JSON.stringify({ model, messages: messagesForApi, temperature })
                }
            };

        const response = await fetch(requestData.url, requestData.data);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        // 增加对返回结果的健壮性检查
        const aiContent = isGemini ? result?.candidates?.[0]?.content?.parts?.[0]?.text : result?.choices?.[0]?.message?.content;

        if (!aiContent) {
            throw new Error("API返回了空内容，可能是因为触发了安全策略。");
        }

        return aiContent.trim();
    }
});
