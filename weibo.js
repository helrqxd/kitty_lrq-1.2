// file: weibo.js
// ===================================================================
// 微博功能相关的变量和函数
// ===================================================================

// 存储当前正在查看的热搜话题
let currentHotTopic = "";
// 缓存已生成的热搜话题内容
let hotTopicFeedCache = {};
// 缓存微博热搜数据
let weiboHotSearchCache = [];
// 微博操作相关功能
let currentWeiboActionTarget = {}; // 用于存储被操作的目标信息
// 当前查看私信的角色ID
let currentViewingDmsFor = null;
// 当前查看的粉丝私信索引
let currentUserDmFanIndex = null;
let currentViewingWeiboProfileId = null; // 全局变量，记录正在查看哪个角色的主页

/**
 * 根据当前激活的视图，渲染对应的微博Feed
 * @param {string} viewId - 视图ID
 */
async function renderWeiboFeeds(viewId) {
    if (viewId === "weibo-my-profile-view") {
        await renderMyWeiboFeed();
    } else if (viewId === "weibo-following-view") {
        await renderFollowingWeiboFeed();
    }
}

/**
 * 渲染"我的主页"上的微博列表
 */
async function renderMyWeiboFeed() {
    const feedEl = document.getElementById("my-weibo-feed-list");
    const posts = await db.weiboPosts.where("authorId").equals("user").reverse().toArray();
    feedEl.innerHTML = "";
    if (posts.length === 0) {
        feedEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">你还没有发过微博哦，点击右上角"+"试试吧！</p>';
        return;
    }
    posts.forEach((post) => {
        // 调用创建微博元素的函数
        feedEl.appendChild(createWeiboPostElement(post));
    });
}

/**
 * 渲染"关注的人"的微博Feed (已优化性能)
 */
async function renderFollowingWeiboFeed() {
    const feedEl = document.getElementById("weibo-following-feed-list");

    // 优化数据库查询，直接筛选和排序
    const posts = await db.weiboPosts
        .where("authorId")
        .notEqual("user") // 筛选作者不是'user'的帖子
        .reverse() // 倒序排列
        .sortBy("timestamp"); // 根据时间戳排序

    // 渲染逻辑
    feedEl.innerHTML = "";
    if (posts.length === 0) {
        feedEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">你关注的人还没有发布任何动态哦。</p>';
        return;
    }
    posts.forEach((post) => {
        feedEl.appendChild(createWeiboPostElement(post));
    });
}

/**
 * 创建微博帖子元素
 * @param {object} post - 微博帖子数据
 * @returns {HTMLElement} - 微博帖子DOM元素
 */
function createWeiboPostElement(post) {
    const postEl = document.createElement("div");
    postEl.className = "weibo-post-item";

    let contentHtml = "";
    if (post.content) {
        contentHtml += `<div class="weibo-post-content">${post.content.replace(/\n/g, "<br>")}</div>`;
    }

    if (post.imageUrl) {
        if (post.postType === "text_image") {
            contentHtml += `<img src="${post.imageUrl}" class="weibo-post-image" style="cursor: pointer;" data-hidden-text="${post.hiddenContent || ""}">`;
        } else {
            contentHtml += `<img src="${post.imageUrl}" class="weibo-post-image">`;
        }
    }

    let commentsHtml = "";
    if (post.comments && Array.isArray(post.comments) && post.comments.length > 0) {
        commentsHtml += '<div class="weibo-comments-container">';
        post.comments.forEach((comment) => {
            if (typeof comment !== "object" || comment === null) return;
            let replyHtml = "";

            // 为被回复者添加专属的 class 和 data 属性，方便精确点击
            if (comment.replyToNickname) {
                replyHtml = `<span class="weibo-comment-reply-tag">回复</span><span class="reply-target-name" data-reply-to-name="${comment.replyToNickname}">${comment.replyToNickname}</span>`;
            }

            commentsHtml += `
                    <div class="weibo-comment-item" data-comment-id="${comment.commentId}" data-commenter-name="${comment.authorNickname}">
                        <span class="weibo-commenter-name">${comment.authorNickname}</span>
                        ${replyHtml}:
                        <span class="weibo-comment-text">${comment.commentText}</span>
                        <button class="comment-delete-btn" title="删除此条评论">×</button>
                    </div>`;
        });
        commentsHtml += "</div>";
    }

    const myNickname = state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "我";
    const isLiked = post.likes && post.likes.includes(myNickname);

    let finalAuthorAvatar, finalAuthorNickname, finalAuthorAvatarFrame;
    if (post.authorId === "user") {
        finalAuthorAvatar = state.qzoneSettings.weiboAvatar || state.qzoneSettings.avatar || defaultAvatar;
        finalAuthorNickname = state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "我";
        finalAuthorAvatarFrame = state.qzoneSettings.weiboAvatarFrame || "";
    } else if (state.chats[post.authorId]) {
        const authorChat = state.chats[post.authorId];
        finalAuthorNickname = authorChat.settings.weiboNickname || authorChat.name;
        finalAuthorAvatar = authorChat.settings.weiboAvatar || authorChat.settings.aiAvatar || defaultAvatar;
        finalAuthorAvatarFrame = authorChat.settings.weiboAvatarFrame || authorChat.settings.aiAvatarFrame || "";
    } else {
        finalAuthorAvatar = defaultAvatar;
        finalAuthorNickname = post.authorNickname || "未知用户";
        finalAuthorAvatarFrame = "";
    }

    let avatarHtml = "";
    if (finalAuthorAvatarFrame) {
        avatarHtml = `
                            <div class="avatar-with-frame">
                                <img src="${finalAuthorAvatar}" class="avatar-img weibo-post-avatar">
                                <img src="${finalAuthorAvatarFrame}" class="avatar-frame">
                            </div>`;
    } else {
        avatarHtml = `<img src="${finalAuthorAvatar}" class="weibo-post-avatar">`;
    }

    const clickableAvatarWrapper = `
                        <div class="weibo-post-avatar-clickable" data-char-id="${post.authorId}">
                            ${avatarHtml}
                        </div>
                    `;

    postEl.innerHTML = `
                        <div class="weibo-post-header">
                            ${clickableAvatarWrapper} 
                            <div class="weibo-post-info">
                                <span class="weibo-post-nickname">${finalAuthorNickname}</span>
                                <span class="weibo-post-timestamp">${formatPostTimestamp(post.timestamp)}</span>
                            </div>
                            <div class="post-actions-btn" data-post-id="${post.id}" data-author-id="${post.authorId}">…</div>
                        </div>
                        ${contentHtml}
                        <div class="weibo-post-footer">
                            <div class="weibo-post-actions">
                                <span class="weibo-action-btn like-btn ${isLiked ? "liked" : ""}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                    <span>${(post.baseLikesCount || 0) + (post.likes || []).length}</span>
                                </span>
                                <span class="weibo-action-btn comment-btn">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>           
                                    <span>${(post.comments || []).length}</span>
                                </span>
                                <span class="weibo-action-btn generate-comments-btn" title="AI生成评论">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                                    </svg>
                                    <span>生成评论</span>
                                </span>
                            </div>
                            ${commentsHtml}
                            <div class="weibo-comment-input-area">
                                <input type="text" class="weibo-comment-input" placeholder="留下你的精彩评论吧...">
                                <button class="weibo-comment-send-btn">发送</button>
                            </div>
                        </div>
                    `;

    // 绑定发送评论按钮
    const sendBtn = postEl.querySelector(".weibo-comment-send-btn");
    if (sendBtn) {
        sendBtn.addEventListener("click", () => {
            const input = postEl.querySelector(".weibo-comment-input");
            handleWeiboComment(post.id, input);
        });
    }

    // 绑定AI生成评论按钮
    const generateBtn = postEl.querySelector(".generate-comments-btn");
    if (generateBtn) {
        generateBtn.addEventListener("click", () => generateWeiboComments(post.id));
    }

    // 绑定点赞按钮
    const likeBtn = postEl.querySelector(".like-btn");
    if (likeBtn) {
        likeBtn.addEventListener("click", () => handleWeiboLike(post.id));
    }

    // 为评论区绑定点击事件监听器
    const commentSection = postEl.querySelector(".weibo-comments-container");
    if (commentSection) {
        commentSection.addEventListener("click", (e) => {
            // 阻止事件冒泡
            e.stopPropagation();

            const target = e.target;
            const commentItem = target.closest(".weibo-comment-item");
            if (!commentItem) return; // 如果点击的不是评论区，就什么也不做

            const input = postEl.querySelector(".weibo-comment-input");

            // 检查点击的是否是删除按钮
            if (target.closest(".comment-delete-btn")) {
                deleteWeiboComment(post.id, commentItem.dataset.commentId);
                return; // 删除后结束
            }

            let replyToName = "";
            const replyToId = commentItem.dataset.commentId;

            // 判断你点击的是谁
            if (target.classList.contains("reply-target-name")) {
                // 如果点击了"被回复者"的名字
                replyToName = target.dataset.replyToName;
            } else {
                // 否则，默认回复这条评论的作者
                replyToName = commentItem.dataset.commenterName;
            }

            // 优化回复逻辑
            // 如果正在回复同一个人，则取消回复
            if (input.dataset.replyToId === replyToId && input.placeholder.includes(`@${replyToName}`)) {
                input.placeholder = "留下你的精彩评论吧...";
                delete input.dataset.replyToId;
                delete input.dataset.replyToNickname;
            } else {
                // 否则，设置为新的回复目标
                input.placeholder = `回复 @${replyToName}:`;
                input.dataset.replyToId = replyToId;
                input.dataset.replyToNickname = replyToName;
                input.focus();
            }
        });
    }

    return postEl;
}

/**
 * 打开微博发布/编辑模态框
 */
async function openWeiboPublisher() {
    const modal = document.getElementById("create-post-modal");

    modal.dataset.mode = "weibo"; // 标记为微博模式

    document.getElementById("create-post-modal-title").textContent = "发微博";
    document.getElementById("post-public-text").placeholder = "有什么新鲜事想分享给大家？";

    // 隐藏动态专属的控件
    document.getElementById("post-image-desc-group").style.display = "none";
    document.getElementById("post-comments-toggle-group").style.display = "none";

    document.getElementById("post-mode-switcher").style.display = "flex"; // 微博也需要模式切换

    resetCreatePostModal();
    modal.classList.add("visible");
}

/**
 * 智能解析带"万"或"亿"的数字字符串
 * @param {string} str - 包含数字的字符串，例如 "30000", "3万", "1.5万"
 * @returns {number} - 解析后的纯数字
 */
function parseChineseNumber(str) {
    if (!str) return 0; // 安全检查

    str = String(str).trim().toLowerCase(); // 转换为小写字符串并去除空格

    let num = parseFloat(str); // 先尝试直接解析数字部分

    if (str.includes("万") || str.includes("w")) {
        // 如果包含"万"或"w"，则将数字部分乘以10000
        num = parseFloat(str) * 10000;
    } else if (str.includes("亿")) {
        // 如果包含"亿"，则乘以100000000
        num = parseFloat(str) * 100000000;
    }

    // 如果解析失败 (比如输入了纯文字)，返回0
    return isNaN(num) ? 0 : Math.floor(num); // 返回整数，确保结果干净
}

/**
 * 处理发布微博的核心函数
 */
async function handlePublishWeibo() {
    const modal = document.getElementById("create-post-modal");

    const mainContent = document.getElementById("post-public-text").value.trim();
    let imageUrl = "",
        hiddenContent = "",
        postType = "text_only",
        imageDescription = "";

    const isImageModeActive = document.getElementById("image-mode-content").classList.contains("active");

    if (isImageModeActive) {
        // 通过检查预览容器是否可见，来判断用户是否真的上传了图片
        const hasImage = document.getElementById("post-image-preview-container").classList.contains("visible");

        if (hasImage) {
            imageUrl = document.getElementById("post-image-preview").src;
            postType = "image";
            imageDescription = document.getElementById("post-image-description").value.trim();
            // 图片描述的检查逻辑
            if (!imageDescription) {
                alert("为了让AI能看懂图片，请务必填写图片描述哦！");
                return;
            }
        }
        // 如果 hasImage 是 false (即用户只想发纯文字)，这段代码就会被跳过，imageUrl 保持为空，postType 保持为 text_only
    } else {
        // 文字图模式的逻辑
        hiddenContent = document.getElementById("post-hidden-text").value.trim();
        if (hiddenContent) {
            imageUrl = "https://i.postimg.cc/KYr2qRCK/1.jpg";
            postType = "text_image";
        }
    }

    if (!mainContent && !imageUrl) {
        alert("微博内容不能为空哦！");
        return;
    }

    const fansCount = parseChineseNumber(state.qzoneSettings.weiboFansCount) || 0;
    const baseLikes = Math.floor(fansCount * (Math.random() * 0.1 + 0.1));
    const baseComments = Math.floor(baseLikes * (Math.random() * 0.1 + 0.05));

    const newPost = {
        authorId: "user",
        authorType: "user",
        authorNickname: state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "我",
        authorAvatar: state.qzoneSettings.weiboAvatar || state.qzoneSettings.avatar || defaultAvatar,
        content: mainContent,
        imageUrl: imageUrl,
        authorAvatarFrame: state.qzoneSettings.weiboAvatarFrame || "",
        imageDescription: imageDescription, // 把获取到的描述保存到新字段里！
        hiddenContent: hiddenContent,
        postType: postType,
        timestamp: Date.now(),
        likes: [],
        comments: [],
        baseLikesCount: baseLikes,
        baseCommentsCount: baseComments,
    };

    await db.weiboPosts.add(newPost);
    await renderMyWeiboFeed();
    await renderWeiboProfile();

    modal.classList.remove("visible");
    alert("微博发布成功！");
}
/**
 * 处理点赞/取消点赞
 * @param {number} postId - 帖子ID
 */
async function handleWeiboLike(postId) {
    const post = await db.weiboPosts.get(postId);
    if (!post) return;

    const myNickname = state.qzoneSettings.nickname || "我";
    if (!post.likes) post.likes = [];

    const likeIndex = post.likes.indexOf(myNickname);
    if (likeIndex > -1) {
        post.likes.splice(likeIndex, 1); // 取消点赞
    } else {
        post.likes.push(myNickname); // 点赞
    }

    await db.weiboPosts.put(post);
    // 重新渲染两个Feed，确保数据同步
    await renderMyWeiboFeed();
    await renderFollowingWeiboFeed();
}

/**
 * 处理发布评论或回复
 * @param {number} postId - 帖子ID
 * @param {HTMLInputElement} inputElement - 评论输入框元素
 */
async function handleWeiboComment(postId, inputElement) {
    const commentText = inputElement.value.trim();
    if (!commentText) {
        alert("评论内容不能为空！");
        return;
    }

    const post = await db.weiboPosts.get(postId);
    if (!post) return;

    if (!post.comments) post.comments = [];

    const newComment = {
        commentId: "comment_" + Date.now(),
        authorId: "user",
        authorNickname: state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "我",
        commentText: commentText,
        timestamp: Date.now(),
    };

    // 检查是否是回复
    if (inputElement.dataset.replyToId) {
        newComment.replyToId = inputElement.dataset.replyToId;
        newComment.replyToNickname = inputElement.dataset.replyToNickname;
    }

    post.comments.push(newComment);
    await db.weiboPosts.put(post);

    // 清空输入框并重置状态
    inputElement.value = "";
    inputElement.placeholder = "留下你的精彩评论吧...";
    delete inputElement.dataset.replyToId;
    delete inputElement.dataset.replyToNickname;

    // 重新渲染两个Feed
    await renderMyWeiboFeed();
    await renderFollowingWeiboFeed();
}

// 微博用户人设与职业设置核心功能 - 打开设置模态框
function openWeiboUserSettingsModal() {
    const modal = document.getElementById("weibo-user-settings-modal");
    const settings = state.qzoneSettings;

    // 加载当前数据到输入框
    document.getElementById("weibo-user-profession-modal-input").value = settings.weiboUserProfession === "点击设置职业" ? "" : settings.weiboUserProfession;
    document.getElementById("weibo-user-persona-modal-input").value = settings.weiboUserPersona;

    renderWeiboUserPresetSelector(); // 渲染预设下拉框
    modal.classList.add("visible");
}

// 保存微博用户设置
async function saveWeiboUserSettings() {
    const profession = document.getElementById("weibo-user-profession-modal-input").value.trim();
    const persona = document.getElementById("weibo-user-persona-modal-input").value.trim();

    state.qzoneSettings.weiboUserProfession = profession || "点击设置职业";
    state.qzoneSettings.weiboUserPersona = persona || "一个普通的微博用户。";

    await saveQzoneSettings(); // 保存到数据库
    await renderWeiboProfile(); // 刷新主页显示
    document.getElementById("weibo-user-settings-modal").classList.remove("visible");
    alert("微博设定已保存！");
}

// 渲染微博用户预设选择器
function renderWeiboUserPresetSelector() {
    const select = document.getElementById("weibo-user-preset-select");
    const presets = state.qzoneSettings.weiboUserPersonaPresets || [];
    select.innerHTML = '<option value="">-- 选择预设 --</option>';
    presets.forEach((preset, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = preset.name;
        select.appendChild(option);
    });
}

// 处理微博用户预设选择
function handleWeiboUserPresetSelection() {
    const select = document.getElementById("weibo-user-preset-select");
    const presets = state.qzoneSettings.weiboUserPersonaPresets || [];
    const selectedIndex = select.value;

    if (selectedIndex !== "") {
        const preset = presets[parseInt(selectedIndex)];
        document.getElementById("weibo-user-profession-modal-input").value = preset.profession;
        document.getElementById("weibo-user-persona-modal-input").value = preset.persona;
    }
}
// 打开微博用户预设管理器
async function openWeiboUserPresetManager() {
    const choice = await showChoiceModal("管理预设", [
        { text: "💾 保存当前为新预设", value: "save" },
        { text: "🗑️ 删除已选预设", value: "delete" },
    ]);

    if (choice === "save") {
        const name = await showCustomPrompt("保存预设", "请输入预设名称");
        if (name && name.trim()) {
            const newPreset = {
                name: name.trim(),
                profession: document.getElementById("weibo-user-profession-modal-input").value.trim(),
                persona: document.getElementById("weibo-user-persona-modal-input").value.trim(),
            };
            state.qzoneSettings.weiboUserPersonaPresets.push(newPreset);
            await saveQzoneSettings();
            renderWeiboUserPresetSelector();
            alert(`预设 "${name.trim()}" 已保存！`);
        }
    } else if (choice === "delete") {
        const select = document.getElementById("weibo-user-preset-select");
        const selectedIndex = select.value;
        if (selectedIndex === "") {
            alert("请先从下拉框中选择一个要删除的预设。");
            return;
        }
        const presets = state.qzoneSettings.weiboUserPersonaPresets;
        const presetName = presets[parseInt(selectedIndex)].name;
        const confirmed = await showCustomConfirm("确认删除", `确定要删除预设 "${presetName}" 吗？`, { confirmButtonClass: "btn-danger" });
        if (confirmed) {
            presets.splice(parseInt(selectedIndex), 1);
            await saveQzoneSettings();
            renderWeiboUserPresetSelector();
            alert("预设已删除。");
        }
    }
}

/**
 * 生成微博热搜列表
 * @param {Array|string} targets - 目标角色ID数组或字符串'all'
 */
async function generateHotSearch(targets = "all") {
    await showCustomAlert("请稍候...", "正在结合角色人设生成微博热搜...");

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("请先配置API！");
        return;
    }

    let publicFiguresContext = "";
    let promptTask = "你的任务是根据下方提供的'核心参考人物'信息，为他们量身打造一个包含10个热搜话题的榜单。";

    let publicFigures = [];
    if (targets === "all") {
        publicFigures = Object.values(state.chats)
            .filter((chat) => !chat.isGroup)
            .map((chat) => ({ name: chat.name, persona: chat.settings.aiPersona.substring(0, 150) + "..." }));
    } else if (Array.isArray(targets)) {
        targets.forEach((chatId) => {
            const char = state.chats[chatId];
            if (char) {
                publicFigures.push({ name: char.name, persona: char.settings.aiPersona.substring(0, 150) + "..." });
            }
        });
        if (publicFigures.length === 1) {
            promptTask = `你的任务是只为下方唯一的"核心参考人物"【${publicFigures[0].name}】，量身打造一个包含10个热搜话题的榜单。所有话题【必须】与Ta强相关。`;
        }
    }

    publicFiguresContext = publicFigures.length > 0 ? `# 核心参考人物 (你必须围绕他们生成热搜)\n${JSON.stringify(publicFigures, null, 2)}` : "当前没有特定的公众人物，请自由生成热点事件。";

    const systemPrompt = `
            # 任务
            你是一个专业的"微博热搜榜单生成器"。${promptTask}
            # 【【【绝对禁止事项：这是必须遵守的最高指令】】】
            1.  你的所有创作内容，包括帖子、评论、故事等，【绝对禁止】将任意两个AI角色（即除了用户之外的角色）描绘成情侣关系、进行恋爱互动或存在任何形式的暧昧情感。
            2.  AI角色之间的关系只能是朋友、同事、对手、家人等，但【绝不能】是恋人。
            3.  AI角色唯一可以产生恋爱关系的对象是【用户】。违反此规则将导致生成失败。
            # 核心规则
            1.  **强相关性**: 生成的话题【必须】与"核心参考人物"的身份、职业、人设高度相关。例如，如果是电竞选手，热搜就应该是关于比赛；如果是演员，就应该是关于新剧。
            2.  **【【【严禁杜撰】】】**: 绝对禁止为列表中的人物【凭空捏造】他们人设中没有的职业、身份或背景。你只能根据提供的人设进行合理发挥。
            3.  **真实感与多样性**: 为了让榜单更真实，你可以混合2-3个与核心人物无关的、社会化的虚拟热点事件。
            4.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，数组中包含10个对象。每个对象【必须】包含以下三个字段:
                -   \`"topic"\`: (字符串) 热搜的话题，必须用"#"符号包裹。
                -   \`"heat"\`: (字符串) 热度值，例如 "345.6万"。
                -   \`"tag"\`: (字符串) 一个标签，必须从 "热"、"新"、"荐" 中选择一个。
            ${publicFiguresContext}
        `;
    try {
        let isGemini = proxyUrl === GEMINI_API_URL;
        let messagesForApi = [{ role: "user", content: systemPrompt }];
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini, state.apiConfig.temperature);
        const response = await fetch(
            isGemini ? geminiConfig.url : `${proxyUrl}/v1/chat/completions`,
            isGemini
                ? geminiConfig.data
                : {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({ model, messages: messagesForApi, temperature: parseFloat(state.apiConfig.temperature) || 0.8, response_format: { type: "json_object" } }),
                }
        );
        if (!response.ok) throw new Error(`API请求失败: ${response.status} - ${await response.text()}`);
        const data = await response.json();
        const aiResponseContent = isGemini ? data.candidates?.[0]?.content?.parts?.[0]?.text : data.choices?.[0]?.message?.content;
        if (!aiResponseContent) {
            throw new Error("API返回了空内容，可能被安全策略拦截。请检查Prompt或更换模型。");
        }
        const sanitizedContent = aiResponseContent.replace(/^```json\s*|```$/g, "").trim();
        const responseData = JSON.parse(sanitizedContent);
        const hotSearchData = responseData.hot_searches || responseData;
        weiboHotSearchCache = hotSearchData;
        await generatePlazaFeed(hotSearchData, targets);
        renderHotSearchList(hotSearchData);
        await showCustomAlert("操作成功", "热搜榜和广场均已生成完毕！");
    } catch (error) {
        console.error("生成热搜失败:", error);
        await showCustomAlert("生成失败", `发生了一个错误：\n${error.message}`);
    }
}

/**
 * 根据AI返回的数据渲染热搜列表
 * @param {Array} hotSearchData - 热搜数据数组
 */
function renderHotSearchList(hotSearchData) {
    const listEl = document.getElementById("weibo-hot-search-list");
    listEl.innerHTML = "";

    if (!hotSearchData || !Array.isArray(hotSearchData)) {
        listEl.innerHTML = '<p style="text-align:center; color: #8a8a8a;">AI返回的数据格式不正确，无法渲染。</p>';
        return;
    }

    hotSearchData.forEach((item, index) => {
        const rank = index + 1;
        const tagClass = { 热: "hot", 新: "new", 荐: "rec" }[item.tag] || "rec";

        const itemEl = document.createElement("div");
        itemEl.className = "hot-search-item";
        itemEl.dataset.rank = rank;
        itemEl.innerHTML = `
                <span class="hot-search-rank">${rank}</span>
                <div class="hot-search-content">
                    <span class="hot-search-topic">${item.topic}</span>
                    <span class="hot-search-tag ${tagClass}">${item.tag}</span>
                </div>
                <span class="hot-search-heat" style="color: var(--text-secondary); font-size: 13px;">${item.heat}</span>
            `;
        itemEl.addEventListener("click", () => showHotTopicFeedScreen(item.topic));
        listEl.appendChild(itemEl);
    });
}

/**
 * 显示并生成指定热搜话题的微博Feed
 * @param {string} topic - 热搜话题
 */
async function showHotTopicFeedScreen(topic) {
    currentHotTopic = topic;
    document.getElementById("weibo-hottopic-title").textContent = topic;
    switchToWeiboView("weibo-hottopic-feed-view");

    // 检查缓存中是否已有该话题内容
    if (hotTopicFeedCache[topic]) {
        console.log(`从缓存加载话题: ${topic}`);
        const feedEl = document.getElementById("weibo-hottopic-feed-list");
        renderWeiboFeed(feedEl, hotTopicFeedCache[topic], true);
    } else {
        // 如果没有缓存，则生成新内容
        await generateHotSearchFeed(topic);
    }
}

/**
 * 调用API为指定话题生成微博Feed
 * @param {string} topic - 热搜话题
 */
async function generateHotSearchFeed(topic) {
    const feedEl = document.getElementById("weibo-hottopic-feed-list");
    feedEl.innerHTML = '<p style="text-align:center; color: #8a8a8a; margin-top: 50px;">正在生成内容，请稍候...</p>';

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("请先配置API！");
        return;
    }

    const allChars = Object.values(state.chats)
        .filter((c) => !c.isGroup)
        .map((c) => ({ name: c.name, persona: c.settings.aiPersona.substring(0, 100) }));
    const allNpcs = Object.values(state.chats)
        .flatMap((c) => c.npcLibrary || [])
        .map((npc) => ({ name: npc.name, persona: npc.persona.substring(0, 100) }));
    const allPeople = [...allChars, ...allNpcs];

    const systemPrompt = `
            # 任务
            你是一个"微博内容生成器"。你的任务是围绕一个给定的热搜话题，生成一批相关的微博帖子。

            # 当前热搜话题
            **${topic}**
            # 【【【绝对禁止事项：这是必须遵守的最高指令】】】
            1.  你的所有创作内容，包括帖子、评论、故事等，【绝对禁止】将任意两个AI角色（即除了用户之外的角色）描绘成情侣关系、进行恋爱互动或存在任何形式的暧昧情感。
            2.  AI角色之间的关系只能是朋友、同事、对手、家人等，但【绝不能】是恋人。
            3.  AI角色唯一可以产生恋爱关系的对象是【用户】。违反此规则将导致生成失败。

            # 核心规则
            1.  **数量**: 生成 5 到 10 条微博。
            2.  **相关性**: 所有微博内容【必须】与话题 **"${topic}"** 强相关，并且【必须】在内容中包含 **${topic}** 这个话题标签。
            3.  **高热度**: 生成的微博必须看起来像是热搜里的内容，所以它们的 "likes" (点赞数) 和 "comments" (评论数) 【必须】非常高。点赞数应在 10000 到 500000 之间，评论数应在 800 到 20000 之间。
            4.  **评论生成**: 为每条微博生成 8 到 10 条真实感的路人评论。评论内容应与微博内容相关，风格多样。
            5.  **作者多样性**: 微博的作者可以是下方"可用人物列表"中的角色，也可以是你虚构的路人、大V或官方媒体。如果让列表中的角色发言，内容必须符合他的人设。
            6.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，数组中包含多条微博对象。每个对象【必须】包含以下字段:
                -   \`"author"\`: (字符串) 作者昵称。
                -   \`"content"\`: (字符串) 微博正文，必须包含话题标签 ${topic}。
                -   \`"likes"\`: (数字) 10000到500000之间的随机高赞数。
                -   \`"comments"\`: (数字) 800到20000之间的随机高评论数。
                -   \`"comments_list"\`: (数组) 包含8-10个评论对象的数组，每个对象格式为 \`{"author": "评论者昵称", "text": "评论内容"}\`。

            # 可用人物列表 (你可以让他们发言)
            ${JSON.stringify(allPeople, null, 2)}
        `;
    try {
        let isGemini = proxyUrl === GEMINI_API_URL;
        let messagesForApi = [{ role: "user", content: systemPrompt }];
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini, state.apiConfig.temperature);

        const response = await fetch(
            isGemini ? geminiConfig.url : `${proxyUrl}/v1/chat/completions`,
            isGemini
                ? geminiConfig.data
                : {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({ model, messages: messagesForApi, temperature: parseFloat(state.apiConfig.temperature) || 0.8, response_format: { type: "json_object" } }),
                }
        );
        if (!response.ok) throw new Error(`API请求失败: ${response.status} - ${await response.text()}`);

        const data = await response.json();
        const aiResponseContent = isGemini ? data.candidates?.[0]?.content?.parts?.[0]?.text : data.choices?.[0]?.message?.content;
        if (!aiResponseContent) {
            throw new Error("API返回了空内容，可能被安全策略拦截。");
        }

        const sanitizedContent = aiResponseContent.replace(/^```json\s*|```$/g, "").trim();
        const responseData = JSON.parse(sanitizedContent);
        const feedData = responseData.posts || responseData;

        // 将新生成的内容缓存起来
        hotTopicFeedCache[topic] = feedData;

        renderWeiboFeed(feedEl, feedData, true);
    } catch (error) {
        console.error("生成热搜Feed失败:", error);
        feedEl.innerHTML = `<p style="text-align:center; color: #ff3b30; padding: 20px;">生成失败: ${error.message}</p>`;
    }
}

/**
 * 生成微博广场Feed
 * @param {Array} hotTopics - (可选) 从热搜生成函数传过来的话题数组
 * @param {Array|string} targets - (新增) 目标角色ID数组或字符串'all'
 */
async function generatePlazaFeed(hotTopics = null, targets = "all") {
    if (!hotTopics) {
        await showCustomAlert("请稍候...", "正在生成广场动态...");
    }
    const feedEl = document.getElementById("weibo-plaza-feed-list");
    feedEl.innerHTML = '<p style="text-align:center; color: #8a8a8a; margin-top: 50px;">正在加载内容，请稍候...</p>';

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("请先配置API！");
        return;
    }

    let publicFiguresContext = "";
    let taskInstruction = "你的任务是模拟一个真实的社交媒体广场，生成10条由不同路人发布的微博帖子。";

    let publicFigures = [];
    if (targets === "all") {
        publicFigures = Object.values(state.chats)
            .filter((chat) => !chat.isGroup)
            .map((chat) => ({
                name: chat.name,
                persona: chat.settings.aiPersona.substring(0, 150) + "...",
                weibo_profession: chat.settings.weiboProfession || "未设定",
                weibo_instruction: chat.settings.weiboInstruction || "无",
            }));
    } else if (Array.isArray(targets)) {
        targets.forEach((chatId) => {
            const char = state.chats[chatId];
            if (char) {
                publicFigures.push({
                    name: char.name,
                    persona: char.settings.aiPersona.substring(0, 150) + "...",
                    weibo_profession: char.settings.weiboProfession || "未设定",
                    weibo_instruction: char.settings.weiboInstruction || "无",
                });
            }
        });
        if (publicFigures.length === 1) {
            taskInstruction = `你的任务是模拟一个真实的社交媒体广场，生成10条与角色"${publicFigures[0].name}"相关的、由不同路人发布的微博帖子。`;
        } else {
            taskInstruction = `你的任务是模拟一个真实的社交媒体广场，生成10条与角色 ${publicFigures.map((p) => `"${p.name}"`).join("、")} 相关的、由不同路人发布的微博帖子。`;
        }
    }

    publicFiguresContext = publicFigures.length > 0 ? `# 核心参考人物 (你生成的内容【必须】围绕他们展开)\n${JSON.stringify(publicFigures, null, 2)}` : "";

    const topicsContext = hotTopics && Array.isArray(hotTopics) && hotTopics.length > 0 ? `请围绕以下热门话题生成内容：${hotTopics.map((t) => t.topic).join("、 ")}` : "请随机生成一些生活化的日常内容。";

    const systemPrompt = `
            # 任务
            你是一个"微博广场内容生成器"。${taskInstruction}
            # 【【【绝对禁止事项：这是必须遵守的最高指令】】】
            1.  你的所有创作内容，包括帖子、评论、故事等，【绝对禁止】将任意两个AI角色（即除了用户之外的角色）描绘成情侣关系、进行恋爱互动或存在任何形式的暧昧情感。
            2.  AI角色之间的关系只能是朋友、同事、对手、家人等，但【绝不能】是恋人。
            3.  AI角色唯一可以产生恋爱关系的对象是【用户】。违反此规则将导致生成失败。
            # 核心规则
            1.  **身份**: 发帖者都是普通人，昵称要生活化。
            2.  **内容**: 帖子内容应是生活化的日常。${topicsContext}
            3.  **热度**: 赞和评论数可高可低，模拟真实世界的随机性。
            4.  **【【【严禁杜撰】】】**: 如果你生成的内容提到了上方"核心参考人物"列表中的任何角色，你【绝对禁止】为他们【凭空捏造】人设中没有的职业、身份或背景。你只能根据提供的人设进行合理发挥。
            5.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，包含10个微博对象。每个对象的格式与"热搜Feed"的格式完全相同（包含 author, content, likes, comments, comments_list 字段）。
                - \`"comments_list"\`: (数组) 包含2-5条评论对象的数组，每个对象格式为 \`{"author": "评论者昵称", "text": "评论内容"}\`。
            ${publicFiguresContext}
        `;
    try {
        let isGemini = proxyUrl === GEMINI_API_URL;
        let messagesForApi = [{ role: "user", content: systemPrompt }];
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini, state.apiConfig.temperature);
        const response = await fetch(
            isGemini ? geminiConfig.url : `${proxyUrl}/v1/chat/completions`,
            isGemini
                ? geminiConfig.data
                : {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({ model, messages: messagesForApi, temperature: parseFloat(state.apiConfig.temperature) || 0.8, response_format: { type: "json_object" } }),
                }
        );
        if (!response.ok) throw new Error(`API请求失败: ${response.status} - ${await response.text()}`);
        const data = await response.json();
        const aiResponseContent = isGemini ? data.candidates?.[0]?.content?.parts?.[0]?.text : data.choices?.[0]?.message?.content;
        if (!aiResponseContent) {
            throw new Error("API返回了空内容，可能被安全策略拦截。");
        }
        const sanitizedContent = aiResponseContent.replace(/^```json\s*|```$/g, "").trim();
        const responseData = JSON.parse(sanitizedContent);
        const feedData = responseData.posts || responseData;
        renderWeiboFeed(feedEl, feedData, false);
        if (!hotTopics) {
            await showCustomAlert("操作成功", "广场生成完毕！");
        }
    } catch (error) {
        console.error("生成广场Feed失败:", error);
        feedEl.innerHTML = `<p style="text-align:center; color: #ff3b30; padding: 20px;">生成失败: ${error.message}</p>`;
    }
}
/**
 * 通用函数，用于渲染微博Feed列表
 * @param {HTMLElement} containerEl - 容器元素
 * @param {Array} feedData - 微博数据数组
 * @param {boolean} isHotSearch - 是否为热搜内容
 */
function renderWeiboFeed(containerEl, feedData, isHotSearch) {
    containerEl.innerHTML = "";

    if (!feedData || !Array.isArray(feedData)) {
        containerEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">AI返回的数据格式不正确，无法渲染。</p>';
        return;
    }

    feedData.forEach((post, index) => {
        const postEl = document.createElement("div");
        postEl.className = "weibo-post-item";
        // 给帖子加上一个独一无二的ID，方便删除
        postEl.dataset.postId = `temp_${index}`;

        // 头像查找逻辑
        let finalAvatar = "https://i.postimg.cc/PxZrFFFL/o-o-1.jpg"; // 默认路人头像
        const potentialChar = Object.values(state.chats).find((c) => c.name === post.author);
        if (potentialChar) {
            finalAvatar = potentialChar.settings.aiAvatar; // 如果作者是角色，就用他的头像
        }

        // 评论渲染逻辑
        let commentsHtml = "";
        if (post.comments_list && post.comments_list.length > 0) {
            commentsHtml += '<div class="weibo-comments-container">';
            post.comments_list.forEach((comment) => {
                // 确保我们能正确访问评论者昵称和内容
                const commenterName = comment.author || "匿名用户"; // 优先用 author，没有就用匿名
                const commentText = comment.text || ""; // 确保 text 存在
                commentsHtml += `
                        <div class="weibo-comment-item">
                            <span class="weibo-commenter-name">${commenterName}:</span>
                            <span class="weibo-comment-text">${commentText}</span>
                        </div>`;
            });
            commentsHtml += "</div>";
        }

        postEl.innerHTML = `
                <div class="weibo-post-header">
                    <img src="${finalAvatar}" class="weibo-post-avatar">
                    <div class="weibo-post-info">
                        <span class="weibo-post-nickname">${post.author}</span>
                        <span class="weibo-post-timestamp">${isHotSearch ? "热搜内容" : "刚刚"}</span>
                    </div>
                    <!-- 添加删除按钮 -->
                    <button class="weibo-post-delete-btn" title="删除这条动态">×</button>
                </div>
                <div class="weibo-post-content">${(post.content || "").replace(/\n/g, "<br>")}</div>
                <div class="weibo-post-footer">
                    <div class="weibo-post-actions">
                        <span class="weibo-action-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                            <span>${post.likes || 0}</span>
                        </span>
                        <span class="weibo-action-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            <span>${post.comments || 0}</span>
                        </span>
                    </div>
                    ${commentsHtml}
                </div>
            `;
        containerEl.appendChild(postEl);
    });
}

/**
 * 显示微博主页并渲染数据
 */
async function showWeiboScreen() {
    // 计算关注数
    const allSingleChats = Object.values(state.chats).filter((chat) => !chat.isGroup);
    let totalNpcCount = 0;
    allSingleChats.forEach((chat) => {
        if (chat.npcLibrary && chat.npcLibrary.length > 0) {
            totalNpcCount += chat.npcLibrary.length;
        }
    });
    const followingCount = allSingleChats.length + totalNpcCount;

    // 更新页面上的元素
    // 从你的"动态(QZone)"设置里获取头像和昵称，保持统一
    document.getElementById("weibo-avatar-img").src = state.qzoneSettings.avatar || defaultAvatar;
    document.getElementById("weibo-nickname").textContent = state.qzoneSettings.nickname || "你的昵称";
    document.getElementById("weibo-following-count").textContent = followingCount;

    // 显示微博页面
    showScreen("weibo-screen");
}

/**
 * 显示关注列表弹窗
 */
function showFollowingList() { }
/**
 * 显示微博关注列表
 */
function showFollowingList() {
    console.log("显示微博关注列表");

    const modal = document.getElementById("weibo-following-modal");
    if (!modal) {
        alert("诊断错误：在HTML中找不到ID为 'weibo-following-modal' 的弹窗元素！请检查HTML代码。");
        return;
    }

    const listContainer = document.getElementById("weibo-following-list-container");
    listContainer.innerHTML = "";

    const allSingleChats = Object.values(state.chats).filter((chat) => !chat.isGroup);

    if (allSingleChats.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:grey; padding: 20px;">还没有关注任何人哦</p>';
    } else {
        allSingleChats.forEach((chat) => {
            // 渲染角色本人
            const charItem = document.createElement("div");
            charItem.className = "weibo-following-item";
            // 在这里加入了"查看主页"和"AI操作"按钮
            charItem.innerHTML = `
                    <img src="${chat.settings.aiAvatar || defaultAvatar}" class="weibo-following-avatar">
                    <span class="weibo-following-name">${chat.name}</span>
                    <!-- 这是我们新增的"查看主页"按钮 -->
                    <button class="view-profile-btn" data-char-id="${chat.id}">主页</button>
                    <span class="weibo-action-trigger-btn" data-target-id="${chat.id}" data-target-name="${chat.name}" data-is-npc="false" title="为Ta执行操作">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
                    </span>
                `;
            listContainer.appendChild(charItem);

            // 渲染该角色下的NPC
            if (chat.npcLibrary && chat.npcLibrary.length > 0) {
                chat.npcLibrary.forEach((npc) => {
                    const npcItem = document.createElement("div");
                    npcItem.className = "weibo-following-item";
                    npcItem.style.paddingLeft = "30px";
                    // NPC暂时没有独立主页，所以不加"主页"按钮
                    npcItem.innerHTML = `
                            <img src="${npc.avatar || defaultGroupMemberAvatar}" class="weibo-following-avatar">
                            <span class="weibo-following-name">${npc.name} (NPC)</span>
                            <span class="weibo-action-trigger-btn" data-target-id="${npc.id}" data-target-name="${npc.name}" data-is-npc="true" data-owner-id="${chat.id}" title="为Ta执行操作">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
                            </span>
                        `;
                    listContainer.appendChild(npcItem);
                });
            }
        });
    }

    modal.classList.add("visible");
}

/**
 * 渲染微博个人主页的所有数据
 */
async function renderWeiboProfile() {
    const settings = state.qzoneSettings || {};
    // 所有数据都从 weibo... 字段读取！
    document.getElementById("weibo-avatar-img").src = settings.weiboAvatar;
    document.getElementById("weibo-nickname").textContent = settings.weiboNickname;
    document.getElementById("weibo-fans-count").textContent = settings.weiboFansCount;
    document.getElementById("weibo-background-img").src = settings.weiboBackground;

    // 动态计算关注数
    const allSingleChats = Object.values(state.chats).filter((chat) => !chat.isGroup);
    let totalNpcCount = 0;
    allSingleChats.forEach((chat) => {
        if (chat.npcLibrary && chat.npcLibrary.length > 0) {
            totalNpcCount += chat.npcLibrary.length;
        }
    });
    document.getElementById("weibo-following-count").textContent = allSingleChats.length + totalNpcCount;

    // 动态计算微博数
    const postsCount = await db.weiboPosts.where("authorId").equals("user").count();
    document.getElementById("weibo-posts-count").textContent = postsCount;

    const professionEl = document.getElementById("weibo-user-profession-display");
    if (professionEl) {
        professionEl.textContent = settings.weiboUserProfession || "点击设置职业";
    }

    // 获取保存的头像框URL
    const frameUrl = settings.weiboAvatarFrame || "";
    // 找到头像框的img元素
    const frameImg = document.getElementById("weibo-avatar-frame");
    if (frameImg) {
        // 如果URL存在，就显示它
        if (frameUrl) {
            frameImg.src = frameUrl;
            frameImg.style.display = "block";
        } else {
            // 如果URL为空（即选择了"无"），就隐藏它
            frameImg.src = "";
            frameImg.style.display = "none";
        }
    }
}

/**
 * 编辑微博头像
 */
async function editWeiboAvatar() {
    const newAvatarUrl = await getNewImageUrl("更换微博头像", state.qzoneSettings.weiboAvatar);
    if (newAvatarUrl) {
        state.qzoneSettings.weiboAvatar = newAvatarUrl; // 只修改微博头像
        await saveQzoneSettings();
        await renderWeiboProfile(); // 用专属函数刷新
    }
}

/**
 * 编辑用户微博背景图
 */
async function editWeiboBackground() { }
/**
 * 编辑微博背景图
 */
async function editWeiboBackground() {
    const newBgUrl = await getNewImageUrl("更换微博背景", state.qzoneSettings.weiboBackground);
    if (newBgUrl) {
        state.qzoneSettings.weiboBackground = newBgUrl; // 只修改微博背景
        await saveQzoneSettings();
        await renderWeiboProfile();
    }
}

/**
 * 编辑微博昵称
 */
async function editWeiboNickname() {
    const newNickname = await showCustomPrompt("编辑微博昵称", "请输入新的昵称", state.qzoneSettings.weiboNickname);
    if (newNickname !== null) {
        state.qzoneSettings.weiboNickname = newNickname.trim() || "你的昵称"; // 只修改微博昵称
        await saveQzoneSettings();
        await renderWeiboProfile();
    }
}

/**
 * 编辑微博粉丝数 (已修复，支持汉字)
 */
async function editWeiboFansCount() {
    // 确保这里的第四个参数是 "text"，而不是 "number"
    const newFans = await showCustomPrompt("编辑粉丝数", "请输入新的粉丝数", state.qzoneSettings.weiboFansCount, "text");

    if (newFans !== null) {
        state.qzoneSettings.weiboFansCount = newFans.trim() || "0"; // 只修改微博粉丝数
        await saveQzoneSettings();
        await renderWeiboProfile();
    }
}
/**
 * 切换微博主界面中的不同页面视图
 * @param {string} viewId - 要切换到的视图的ID
 */
async function switchToWeiboView(viewId) {
    // 隐藏所有微博页面
    document.querySelectorAll(".weibo-view").forEach((view) => {
        view.style.display = "none"; // 使用 style.display 确保隐藏
    });

    // 显示目标页面
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = "flex"; // 使用 flex 显示
    }

    // 更新底部导航栏的高亮状态
    document.querySelectorAll(".weibo-nav-item").forEach((item) => {
        item.classList.remove("active");
    });
    const targetNavItem = document.querySelector(`.weibo-nav-item[data-view="${viewId}"]`);
    if (targetNavItem) {
        targetNavItem.classList.add("active");
    }

    // 根据你点击的页签，去加载并显示对应的微博内容
    if (viewId === "weibo-following-view") {
        // 如果是"关注的人"页，就调用渲染关注列表的函数
        await renderFollowingWeiboFeed();
    } else if (viewId === "weibo-my-profile-view") {
        // 如果是"我的微博"页，就调用渲染"我"的微博的函数
        await renderMyWeiboFeed();
    }
}

/**
 * AI生成微博评论的核心函数
 * @param {number} postId - 需要生成评论的微博ID
 */
async function generateWeiboComments(postId) {
    const post = await db.weiboPosts.get(postId);
    if (!post) {
        alert("错误：找不到这条微博！");
        return;
    }

    await showCustomAlert("请稍候...", "正在召唤高质量网友...");

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("请先配置API！");
        return;
    }

    // 获取用户的微博昵称
    const userNickname = state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "我";

    let authorPersona = "一个普通用户。";
    let authorProfession = "未设定";
    const authorName = post.authorId === "user" ? userNickname : post.authorNickname;

    if (post.authorId === "user") {
        authorPersona = state.qzoneSettings.weiboUserPersona || "一个普通的微博用户。";
        authorProfession = state.qzoneSettings.weiboUserProfession || "未设定";
    } else {
        const authorChat = state.chats[post.authorId];
        if (authorChat) {
            authorPersona = authorChat.settings.aiPersona || "无";
            authorProfession = authorChat.settings.weiboProfession || "未设定";
        }
    }
    const truncatedPersona = authorPersona.substring(0, 400);
    const postContent = (post.content || "").substring(0, 200);
    const existingComments = (post.comments || [])
        .slice(-5)
        .map((c) => `${c.authorNickname}: ${c.commentText}`)
        .join("\n");

    let imageContext = "";
    if (post.imageUrl && post.imageDescription) {
        imageContext = `
                - **图片内容**: 这条微博配有一张图片，描述为："${post.imageDescription}"`;
    } else if (post.postType === "text_image" && post.hiddenContent) {
        imageContext = `
                - **图片内容**: 这是一张文字图，上面的内容是："${post.hiddenContent}"`;
    }

    const commenterPersonas = new Map();
    commenterPersonas.set(authorName, `[职业: ${authorProfession}] [人设: ${truncatedPersona}]`);

    if (post.comments && post.comments.length > 0) {
        post.comments.forEach((comment) => {
            const commenterName = comment.authorNickname;
            if (!commenterPersonas.has(commenterName)) {
                const commenterChat = Object.values(state.chats).find((c) => c.name === commenterName);
                if (commenterChat && !commenterChat.isGroup) {
                    const profession = commenterChat.settings.weiboProfession || "未设定";
                    const persona = (commenterChat.settings.aiPersona || "无").substring(0, 200);
                    commenterPersonas.set(commenterName, `[职业: ${profession}] [人设: ${persona}]`);
                }
            }
        });
    }

    let commenterContext = "";
    if (commenterPersonas.size > 0) {
        commenterContext += "\n# 评论区已有角色人设 (供你回复时参考)\n";
        commenterPersonas.forEach((persona, name) => {
            commenterContext += `- **${name}**: ${persona}\n`;
        });
    }

    // 系统指令，明确禁止回复用户
    const systemPrompt = `
            # 任务
            你是一个专业的"社交媒体模拟器"。你的任务是根据一个特定角色的"人设"，为他/她发布的一条微博生成一批真实的、符合情景的网友评论。

            # 微博情景
            - **作者**: ${authorName}
            - **微博文字**: ${postContent || "(该微博没有配文)"}
            ${imageContext}
            - **已有评论 (你可以回复他们)**:
            ${existingComments || "(暂无评论)"}

            ${commenterContext}

            # 【【【评论生成核心规则】】】
            1.  **【【【回复禁令】】】**: 绝对禁止回复昵称为"**${userNickname}**"的任何评论。这是最高优先级的规则，因为用户会自己回复。你可以回复其他任何人的评论。
            2.  **【【【严禁使用】】】**: 绝对禁止使用 "路人甲"、"网友A"、"粉丝B" 这类代号作为评论者昵称。
            3.  **昵称多样化**: 评论者的昵称必须非常真实、多样化且符合微博生态。例如："今天也要早睡"、"可乐加冰块"、"是小王不是小张"、"理性吃瓜第一线"。
            4.  **内容与人设强相关**: 评论内容必须与【微博内容(包括文字和图片)】和【作者以及被回复者的人设】高度相关。思考：什么样的粉丝会关注这样的人？他们会怎么说话？当回复一个有特定人设的角色时，你的回复必须考虑到对方的身份。
            5.  **风格多样化**: 生成的评论应包含不同立场和风格，例如：
                -   **粉丝**: "哥哥太帅了！新剧什么时候播？"
                -   **路人**: "这个地方看起来不错，求地址！"
                -   **黑粉/质疑者**: "就这？感觉p图有点过了吧..."
                -   **玩梗**: "楼上是不是XX派来的间谍（狗头）"
            6.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，每个对象代表一条评论。
                -   发表新评论, 使用格式: \`{"author": "不吃香菜的仙女", "comment": "哇，这个好好看！"}\`
                -   回复已有评论, 使用格式: \`{"author": "爱吃瓜的猹", "comment": "我也觉得！", "replyTo": "不吃香菜的仙女"}\`

            现在，请开始你的表演。
        `;

    try {
        let isGemini = proxyUrl === GEMINI_API_URL;
        let messagesForApi = [{ role: "user", content: systemPrompt }];
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini, state.apiConfig.temperature);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: model,
                    messages: messagesForApi,
                    temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                    response_format: { type: "json_object" },
                }),
            });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const aiResponseContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(/^```json\s*|```$/g, "").trim();

        const newComments = JSON.parse(aiResponseContent);

        if (Array.isArray(newComments) && newComments.length > 0) {
            const postToUpdate = await db.weiboPosts.get(post.id);
            if (!postToUpdate) throw new Error("在数据库中找不到要更新的帖子！");

            if (!postToUpdate.comments) postToUpdate.comments = [];

            newComments.forEach((comment) => {
                if (comment.author && comment.comment) {
                    const newCommentObject = {
                        commentId: "comment_" + Date.now() + Math.random(),
                        authorNickname: comment.author,
                        commentText: comment.comment,
                        timestamp: Date.now(),
                    };
                    if (comment.replyTo) {
                        newCommentObject.replyToNickname = comment.replyTo;
                    }
                    postToUpdate.comments.push(newCommentObject);
                }
            });

            postToUpdate.baseLikesCount = (postToUpdate.baseLikesCount || 0) + Math.floor(Math.random() * newComments.length * 3 + 5);

            await db.weiboPosts.put(postToUpdate);

            await renderMyWeiboFeed();
            await renderFollowingWeiboFeed();

            alert(`成功生成了 ${newComments.length} 条新评论！`);
        } else {
            alert("AI没有生成有效的评论。");
        }
    } catch (error) {
        console.error("生成微博评论失败:", error);
        await showCustomAlert("生成失败", `发生了一个错误：\n${error.message}`);
    }
}

/**
 * 删除一条微博评论
 * @param {number} postId - 评论所在的微博ID
 * @param {string} commentId - 要删除的评论的ID
 */
async function deleteWeiboComment(postId, commentId) {
    const post = await db.weiboPosts.get(postId);
    if (!post || !post.comments) return;

    const commentIndex = post.comments.findIndex((c) => c.commentId === commentId);
    if (commentIndex === -1) return;

    const commentText = post.comments[commentIndex].commentText;

    const confirmed = await showCustomConfirm("删除评论", `确定要删除这条评论吗？\n\n"${commentText.substring(0, 50)}..."`, { confirmButtonClass: "btn-danger" });

    if (confirmed) {
        post.comments.splice(commentIndex, 1);
        await db.weiboPosts.put(post);
        await renderMyWeiboFeed();
        await renderFollowingWeiboFeed();
        alert("评论已删除。");
    }
}

/**
 * 一键清空所有单人聊天背景
 */
async function clearAllSingleChatBackgrounds() {
    // 弹出确认框，防止误操作
    const confirmed = await showCustomConfirm("确认操作", "此操作将移除所有角色单独设置的聊天背景，统一使用全局背景。确定要继续吗？", { confirmButtonClass: "btn-danger" });

    if (confirmed) {
        let updatedCount = 0;
        const chatsToUpdate = [];

        // 遍历所有聊天
        for (const chatId in state.chats) {
            const chat = state.chats[chatId];
            // 如果这个聊天设置了单人背景
            if (chat.settings && chat.settings.background) {
                chat.settings.background = ""; // 清空它
                chatsToUpdate.push(chat);
                updatedCount++;
            }
        }

        // 如果有需要更新的聊天，就批量写入数据库
        if (chatsToUpdate.length > 0) {
            await db.chats.bulkPut(chatsToUpdate);
        }

        await showCustomAlert("操作成功", `已成功清空 ${updatedCount} 个角色的单人聊天背景！`);
    }
}

/**
 * 打开微博操作模态框
 * @param {object} targetInfo - 包含被操作角色信息的对象
 */
function openWeiboActionModal(targetInfo) {
    currentWeiboActionTarget = targetInfo; // 保存目标信息
    const modal = document.getElementById("weibo-action-modal");

    // 标题直接显示为谁行动，不再有"操作者"
    document.getElementById("weibo-action-modal-title").textContent = `为 "${targetInfo.name}" 触发行动`;

    // 彻底移除并隐藏"选择操作者"的下拉框
    const actorSelectGroup = document.getElementById("weibo-action-actor-select").parentElement;
    if (actorSelectGroup) {
        actorSelectGroup.style.display = "none";
    }

    // 清空上次的输入并重置选项
    document.getElementById("weibo-action-prompt-input").value = "";
    document.querySelector('input[name="weibo_action_type"][value="post"]').checked = true;

    modal.classList.add("visible");
}

/**
 * 执行AI操作（发微博/评论）
 */
async function handleWeiboAiAction() {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("请先配置API！");
        return;
    }

    document.getElementById("weibo-action-modal").classList.remove("visible");
    document.getElementById("weibo-following-modal").classList.remove("visible");
    await showCustomAlert("请稍候...", "正在请求AI生成内容，请耐心等待...");

    const actionType = document.querySelector('input[name="weibo_action_type"]:checked').value;
    const userInputPrompt = document.getElementById("weibo-action-prompt-input").value.trim();

    let target = {
        id: currentWeiboActionTarget.id,
        name: currentWeiboActionTarget.name,
        persona: "一个普通的微博用户。",
        profession: "",
        instruction: "",
    };

    if (currentWeiboActionTarget.isNpc) {
        const owner = state.chats[currentWeiboActionTarget.ownerId];
        const npc = owner.npcLibrary.find((n) => n.id === currentWeiboActionTarget.id);
        if (npc) {
            target.persona = npc.persona;
            target.profession = owner.settings.weiboProfession || "";
            target.instruction = owner.settings.weiboInstruction || "";
        }
    } else {
        const char = state.chats[currentWeiboActionTarget.id];
        if (char) {
            target.persona = char.settings.aiPersona;
            target.profession = char.settings.weiboProfession || "";
            target.instruction = char.settings.weiboInstruction || "";
        }
    }

    let systemPrompt = "";
    let messagesForApi = [];

    try {
        if (actionType === "post") {
            systemPrompt = `
                    # 任务: 角色扮演与微博创作
                    你现在【就是】角色"${target.name}"。
                    你的任务是根据你的身份信息，创作一条全新的微博。
                    # 你的身份信息
                    - **你的名字**: ${target.name}
                    - **你的职业**: ${target.profession || "未设定"}
                    - **你的人设**: ${target.persona}
                    - **你的微博指令 (必须遵守)**: ${target.instruction || "无"}
                    - **用户给你的提示 (可选参考)**: ${userInputPrompt || "无"}
                    # 【【【评论生成核心规则】】】
                    1.  **【【【严禁使用】】】**: 绝对禁止使用 "路人甲"、"网友A"、"粉丝B" 这类代号作为评论者昵称。
                    2.  **昵称多样化**: 评论者的昵称必须非常真实、多样化且符合微博生态。例如："今天也要早睡"、"可乐加冰块"、"是小王不是小张"、"理性吃瓜第一线"。
                    3.  **内容与人设强相关**: 评论内容必须与【你即将创作的微博内容】和【你自己的人设】高度相关。
                    4.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON对象，格式如下:
                    \`{"content": "微博正文内容...", "baseLikesCount": 随机生成的点赞数, "baseCommentsCount": 随机生成的评论数, "comments": "今天也要早睡: 评论1...\\n可乐加冰块: 评论2..."}\`
                    - 点赞和评论数要符合你的身份地位。
                    - "comments"字段是一个【字符串】，里面包含5-10条真实感的路人评论，每条评论用换行符'\\n'分隔。
                `;
            messagesForApi.push({ role: "user", content: systemPrompt });
        } else {
            let targetPost;
            let taskDescription;
            let extraContext = "";

            if (actionType === "comment_plaza") {
                targetPost = await db.weiboPosts.orderBy("timestamp").last();
                if (!targetPost) throw new Error("广场上还没有任何微博可以评论！");
                taskDescription = `你的任务是根据你的身份信息，去评论下面这条最新的【广场微博】。`;
            } else if (actionType === "comment_user") {
                targetPost = await db.weiboPosts.where("authorId").equals("user").reverse().first();
                if (!targetPost) throw new Error("用户还没有发布任何微博，无法评论！");
                taskDescription = `你的任务是根据你的身份信息，去评论下面这条由【用户】发布的最新微博。`;
            }

            let postAuthorName = targetPost.authorNickname;
            if (postAuthorName === "{{user}}") {
                postAuthorName = "我";
            }

            systemPrompt = `
                    # 任务: 角色扮演与微博评论
                    你现在【就是】角色"${target.name}"。
                    ${taskDescription}
                    # 你的身份信息
                    - **你的名字**: ${target.name}
                    - **你的职业**: ${target.profession || "未设定"}
                    - **你的人设**: ${target.persona}
                    - **你的微博指令 (必须遵守)**: ${target.instruction || "无"}
                    - **用户给你的提示 (可选参考)**: ${userInputPrompt || "无"}
                    # 被评论的微博
                    - 作者: ${postAuthorName}
                    - 内容: ${targetPost.content}
                    ${extraContext}
                    # 核心规则
                    1. **深度扮演**: 你的评论【必须】完全符合你的职业、人设和微博指令。
                    2. **格式铁律**: 你的回复【必须且只能】是一个严格的JSON对象，格式如下:
                    \`{"commentText": "你的评论内容..."}\`
                `;
            messagesForApi.push({ role: "user", content: systemPrompt });
        }

        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini, state.apiConfig.temperature);

        const response = await fetch(
            isGemini ? geminiConfig.url : `${proxyUrl}/v1/chat/completions`,
            isGemini
                ? geminiConfig.data
                : {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: model,
                        messages: messagesForApi,
                        temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                        // 已修复：删除了导致500错误的 response_format 参数
                    }),
                }
        );

        if (!response.ok) {
            let errorBody = "";
            try {
                errorBody = await response.text();
            } catch (e) {
                errorBody = "无法读取错误响应体。";
            }
            throw new Error(`API请求失败: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();

        // 检查API是否返回错误信息
        if (data.error) {
            throw new Error(`API返回错误: ${data.error.message || JSON.stringify(data.error)}`);
        }

        const aiResponseContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(/^```json\s*|```$/g, "").trim();

        const result = JSON.parse(aiResponseContent);

        if (actionType === "post") {
            const newPost = {
                authorId: target.id,
                authorType: currentWeiboActionTarget.isNpc ? "npc" : "char",
                authorNickname: target.name,
                authorAvatar: currentWeiboActionTarget.isNpc ? state.chats[currentWeiboActionTarget.ownerId].npcLibrary.find((n) => n.id === target.id).avatar || defaultGroupMemberAvatar : state.chats[target.id].settings.aiAvatar || defaultAvatar,
                content: result.content,
                timestamp: Date.now(),
                likes: [],
                comments: [],
                baseLikesCount: result.baseLikesCount || 0,
                baseCommentsCount: result.baseCommentsCount || 0,
            };
            if (result.comments) {
                newPost.comments = result.comments
                    .split("\n")
                    .map((c) => {
                        const parts = c.split(/[:：]/);
                        const commenter = parts.shift() || "路人";
                        const commentText = parts.join(":").trim();
                        return { commentId: "comment_" + Date.now() + Math.random(), authorNickname: commenter, commentText: commentText };
                    })
                    .filter((c) => c.commentText);
            }
            await db.weiboPosts.add(newPost);
        } else {
            let postToUpdate;
            if (actionType === "comment_plaza") {
                postToUpdate = await db.weiboPosts.orderBy("timestamp").last();
            } else {
                postToUpdate = await db.weiboPosts.where("authorId").equals("user").reverse().first();
            }

            if (postToUpdate) {
                if (!postToUpdate.comments) postToUpdate.comments = [];
                postToUpdate.comments.push({
                    commentId: "comment_" + Date.now(),
                    authorId: target.id,
                    authorNickname: target.name,
                    commentText: result.commentText,
                    timestamp: Date.now(),
                });
                await db.weiboPosts.put(postToUpdate);
            }
        }

        await renderMyWeiboFeed();
        await renderFollowingWeiboFeed();
        await showCustomAlert("操作成功", `"${target.name}"已成功执行操作！`);
    } catch (error) {
        console.error("微博AI操作失败:", error);
        await showCustomAlert("操作失败", `发生了一个错误：\n${error.message}`);
    }
}
/**
 * 显示微博内容生成的目标角色选择器（单选版本）
 * @returns {Promise<object|string|null>} - 返回选中的角色对象, 'all'(随机), 或 null(取消选择)
 */
async function showCharacterSelectorForWeibo() {
    // 获取所有单聊角色
    const singleChats = Object.values(state.chats).filter((chat) => !chat.isGroup);

    if (singleChats.length === 0) {
        alert("还没有任何角色可以生成内容哦。");
        return null;
    }

    // 构建选择选项：随机选项 + 所有角色选项
    const options = [
        { text: "✨ 随机 (所有角色)", value: "all" },
        ...singleChats.map((chat) => ({
            text: `👤 ${chat.name}`,
            value: chat.id,
        })),
    ];

    // 显示选择弹窗并等待用户选择
    const selectedId = await showChoiceModal("请选择本次生成的主角", options);

    // 根据用户选择返回相应结果
    if (selectedId === null) {
        return null; // 用户取消选择
    }
    if (selectedId === "all") {
        return "all"; // 用户选择随机
    }

    // 返回选中角色的完整数据
    return state.chats[selectedId];
}
/**
 * 显示微博内容生成的目标角色选择器（多选版本）
 * @returns {Promise<Array|string|null>} - 返回选中的角色ID数组, 'all'(随机), 或 null(取消选择)
 */
async function showMultiCharacterSelectorForWeibo() {
    return new Promise((resolve) => {
        const modal = document.getElementById("weibo-char-selector-modal");
        const listEl = document.getElementById("weibo-char-selector-list");
        const confirmBtn = document.getElementById("weibo-confirm-char-select-btn");
        const cancelBtn = document.getElementById("weibo-cancel-char-select-btn");
        const selectAllBtn = document.getElementById("weibo-select-all-btn");
        const deselectAllBtn = document.getElementById("weibo-deselect-all-btn");

        listEl.innerHTML = "";
        const singleChats = Object.values(state.chats).filter((chat) => !chat.isGroup);

        if (singleChats.length === 0) {
            alert("还没有任何角色可以生成内容哦。");
            resolve(null);
            return;
        }

        // 添加"随机"选项
        const randomOption = document.createElement("div");
        randomOption.className = "player-selection-item";
        randomOption.innerHTML = `
                <input type="radio" name="weibo-char-choice" value="all" id="weibo-char-random" checked style="margin-right: 15px;">
                <label for="weibo-char-random" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                    <span class="name">✨ 随机选择 (所有角色)</span>
                </label>
            `;
        listEl.appendChild(randomOption);

        // 添加"指定角色"选项标题
        const specificOptionHeader = document.createElement("div");
        specificOptionHeader.className = "player-selection-item";
        specificOptionHeader.innerHTML = `
                <input type="radio" name="weibo-char-choice" value="specific" id="weibo-char-specific" style="margin-right: 15px;">
                <label for="weibo-char-specific" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                    <span class="name">👤 指定以下角色</span>
                </label>
            `;
        listEl.appendChild(specificOptionHeader);

        // 为每个角色创建选择项
        singleChats.forEach((chat) => {
            const item = document.createElement("div");
            item.className = "player-selection-item";
            item.style.paddingLeft = "50px"; // 缩进显示为子选项
            item.innerHTML = `
                    <input type="checkbox" class="weibo-char-checkbox" value="${chat.id}" id="weibo-char-${chat.id}">
                    <label for="weibo-char-${chat.id}" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                        <img src="${chat.settings.aiAvatar || defaultAvatar}" alt="${chat.name}">
                        <span class="name">${chat.name}</span>
                    </label>
                `;
            listEl.appendChild(item);
        });

        // 清理函数：关闭模态框并移除事件监听器
        const cleanup = () => {
            modal.classList.remove("visible");
            newConfirmBtn.removeEventListener("click", onConfirm);
            cancelBtn.removeEventListener("click", onCancel);
            selectAllBtn.removeEventListener("click", onSelectAll);
            deselectAllBtn.removeEventListener("click", onDeselectAll);
        };

        // 确认按钮处理函数
        const onConfirm = () => {
            const choice = document.querySelector('input[name="weibo-char-choice"]:checked').value;
            if (choice === "all") {
                cleanup();
                resolve("all");
            } else {
                const selectedIds = Array.from(document.querySelectorAll(".weibo-char-checkbox:checked")).map((cb) => cb.value);
                if (selectedIds.length === 0) {
                    alert("请至少选择一个指定的角色！");
                    return;
                }
                cleanup();
                resolve(selectedIds);
            }
        };

        // 取消按钮处理函数
        const onCancel = () => {
            cleanup();
            resolve(null);
        };

        // 全选按钮处理函数
        const onSelectAll = () => document.querySelectorAll(".weibo-char-checkbox").forEach((cb) => (cb.checked = true));

        // 取消全选按钮处理函数
        const onDeselectAll = () => document.querySelectorAll(".weibo-char-checkbox").forEach((cb) => (cb.checked = false));

        // 使用克隆节点确保事件只绑定一次
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        newConfirmBtn.addEventListener("click", onConfirm);
        cancelBtn.addEventListener("click", onCancel);
        selectAllBtn.addEventListener("click", onSelectAll);
        deselectAllBtn.addEventListener("click", onDeselectAll);

        modal.classList.add("visible");
    });
}

/**
 * 打开微博私信界面
 * @param {object} targetInfo - 包含被点击角色/NPC信息的对象
 */
async function openWeiboDms(targetInfo) {
    currentViewingDmsFor = targetInfo;
    const charId = targetInfo.isNpc ? targetInfo.ownerId : targetInfo.id;
    const chat = state.chats[charId];
    if (!chat) return;

    // 检查并生成粉丝私信数据
    const dmsData = await generateAndCacheFanDms(chat);

    // 渲染私信列表并显示界面
    renderDmList(dmsData, targetInfo.name);
    showScreen("weibo-dm-list-screen");
}

/**
 * 检查或生成角色的粉丝私信数据
 * @param {object} characterChat - 角色/NPC的聊天对象
 * @param {boolean} addMore - 是否为继续生成更多私信
 * @returns {Promise<Array>} - 粉丝私信对话数组
 */
async function generateAndCacheFanDms(characterChat, addMore = false) {
    // 如果不是继续生成且缓存存在，则直接返回缓存数据
    if (!addMore && characterChat.weiboDms && characterChat.weiboDms.length > 0) {
        console.log(`从缓存加载 "${characterChat.name}" 的粉丝私信。`);
        return characterChat.weiboDms;
    }

    const alertMessage = addMore ? "正在生成更多私信内容..." : `正在为“${characterChat.name}”生成粉丝私信内容...`;
    await showCustomAlert("请稍候...", alertMessage);

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("请先配置API！");
        return [];
    }

    const truncatedMainPersona = (characterChat.settings.aiPersona || "一个普通的角色").substring(0, 500);
    const truncatedWeiboInstruction = (characterChat.settings.weiboInstruction || "无特殊指令").substring(0, 400);

    // 构建已有私信上下文（用于继续生成）
    const existingDmsContext = addMore
        ? `
                # 已有私信记录 (供你参考，你可以选择延续对话或开启新对话):
                ${JSON.stringify(characterChat.weiboDms, null, 2)}
                            `
        : "";

    // 构建AI指令提示
    const systemPrompt = `
            # 任务
            你现在是角色“${characterChat.name}”的社交媒体运营助理。
            你的任务是根据该角色的【所有信息】，虚构一个包含${addMore ? "2-3" : "3-5"}位不同粉丝的私信列表，并为每位粉丝创作一段生动、真实的对话历史。
            ${existingDmsContext}

            # 角色信息 (你必须综合参考以下所有信息)
            - 角色名: ${characterChat.name}
            - 公开职业: ${characterChat.settings.weiboProfession || "未设定"}
            - 核心人设 (最高优先级): ${truncatedMainPersona}
            - 微博互动准则 (处理私信时需遵守): ${truncatedWeiboInstruction}

            # 核心规则
            1.  **粉丝多样性**: 创作${addMore ? "2-3" : "3-5"}位不同类型的粉丝（例如：狂热粉、事业粉、CP粉、黑粉、路人粉、广告商等）。
            2.  **【【【对话鲜活度铁律】】】**: 为了让对话更真实，你必须：
                -   **避免机械问答**：不要生成"你好"-"你好"之类的无意义对话。让对话像一个正在进行的真实互动片段。
                -   **注入情绪和语气**：粉丝的语气可以是兴奋的、担忧的、质疑的、开玩笑的。角色的回应也要符合人设，可能是冷淡的、温柔的、官方的，或者干脆已读不回。
                -   **使用网络语言**: 适当加入符合粉丝圈文化的网络用语、emoji或颜文字，让对话更接地气。
                -   **内容多样化**: 私信内容不应只局限于工作，也可以是粉丝分享自己的日常、表达关心、提出一些私人问题等。
            3.  **角色回应**: 根据角色的【微博互动准则】和【核心人设】，决定角色是否会回复私信以及如何回复。例如，一个高冷的角色可能只会回复重要信息，或者干脆不回复。
            4.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，直接以 '[' 开头，以 ']' 结尾。

            # JSON对象结构 (注意：你不再需要提供头像URL)
            {
            "fanName": "粉丝的微博昵称",
            "fanPersona": "对这位粉丝的简单描述 (例如: '一个担心哥哥事业的妈妈粉')",
            "messages": [
                { "sender": "fan", "text": "粉丝发的第一条消息..." },
                { "sender": "char", "text": "角色回复的消息..." }
            ]
            }

            现在，请开始生成私信列表。`;

    try {
        const messagesForApi = [{ role: "user", content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini, state.apiConfig.temperature);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: parseFloat(state.apiConfig.temperature) || 0.8, response_format: { type: "json_object" } }),
            });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        const rawContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
        const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
        const newDmsData = JSON.parse(cleanedContent);

        // 为AI生成的数据手动添加随机头像
        if (Array.isArray(newDmsData)) {
            const fanAvatars = ["https://i.postimg.cc/PxZrFFFL/o-o-1.jpg", "https://i.postimg.cc/Qd0Y537F/com-xingin-xhs-20251011153800.png"];

            newDmsData.forEach((convo, index) => {
                convo.fanAvatarUrl = fanAvatars[index % fanAvatars.length];
            });
        }

        if (Array.isArray(newDmsData)) {
            if (addMore) {
                characterChat.weiboDms.push(...newDmsData);
            } else {
                characterChat.weiboDms = newDmsData;
            }
            await db.chats.put(characterChat);
            return characterChat.weiboDms;
        }
        throw new Error("AI返回的数据不是一个有效的数组。");
    } catch (error) {
        console.error("生成粉丝私信失败:", error);
        await showCustomAlert("生成失败", `抱歉，生成私信时发生了一个错误。\n\n详细信息:\n${error.message}`);
        return characterChat.weiboDms || [];
    }
}

/**
 * 渲染粉丝私信列表
 * @param {Array} dmsData - 私信对话数组
 * @param {string} charName - 角色名
 */
function renderDmList(dmsData, charName) {
    const listEl = document.getElementById("weibo-dm-list");
    const titleEl = document.getElementById("weibo-dm-list-title");
    listEl.innerHTML = "";
    titleEl.textContent = `${charName}的私信`;

    if (!dmsData || dmsData.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">还没有收到任何私信哦</p>';
        return;
    }

    // 为每个私信对话创建列表项
    dmsData.forEach((convo, index) => {
        const lastMsg = convo.messages[convo.messages.length - 1];
        const item = document.createElement("div");
        item.className = "dm-list-item";
        item.dataset.fanIndex = index;
        item.innerHTML = `
                            <img src="${convo.fanAvatarUrl}" class="dm-avatar">
                            <div class="dm-info">
                                <div class="dm-name">${convo.fanName}</div>
                                <div class="dm-last-msg">${lastMsg.text}</div>
                            </div>
                        `;
        listEl.appendChild(item);
    });
}

/**
 * 打开私信详情页
 * @param {number} fanIndex - 粉丝在私信数组中的索引
 */
function openDmDetail(fanIndex) {
    const charId = currentViewingDmsFor.isNpc ? currentViewingDmsFor.ownerId : currentViewingDmsFor.id;
    const chat = state.chats[charId];
    const conversation = chat.weiboDms[fanIndex];

    if (conversation) {
        renderDmDetail(conversation, chat);
        showScreen("weibo-dm-detail-screen");
    }
}

/**
 * 渲染私信详情页的聊天气泡
 * @param {object} conversation - 单个粉丝的对话对象
 * @param {object} characterChat - 角色的聊天对象
 */
function renderDmDetail(conversation, characterChat) {
    const messagesEl = document.getElementById("weibo-dm-messages");
    const titleEl = document.getElementById("weibo-dm-detail-title");
    messagesEl.innerHTML = "";
    titleEl.textContent = conversation.fanName;

    const charAvatar = characterChat.settings.aiAvatar || defaultAvatar;

    // 渲染每条消息
    conversation.messages.forEach((msg, index) => {
        const isFan = msg.sender === "fan";
        const wrapper = document.createElement("div");
        wrapper.className = `message-wrapper ${isFan ? "fan" : "char"}`;

        const bubble = document.createElement("div");
        bubble.className = `message-bubble`;

        const avatarHtml = `<img src="${isFan ? conversation.fanAvatarUrl : charAvatar}" class="avatar">`;
        const contentHtml = `<div class="content">${msg.text.replace(/\n/g, "<br>")}</div>`;

        // 仅为粉丝消息添加删除按钮
        const deleteBtnHtml = isFan ? `<button class="dm-message-delete-btn" data-message-index="${index}">×</button>` : "";

        bubble.innerHTML = `${avatarHtml}${contentHtml}`;
        wrapper.innerHTML = deleteBtnHtml;
        wrapper.appendChild(bubble);

        messagesEl.appendChild(wrapper);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * 清空当前角色的所有粉丝私信
 */
async function handleClearAllDms() {
    if (!currentViewingDmsFor) return;

    const charId = currentViewingDmsFor.isNpc ? currentViewingDmsFor.ownerId : currentViewingDmsFor.id;
    const chat = state.chats[charId];
    if (!chat || !chat.weiboDms || chat.weiboDms.length === 0) {
        alert("没有可以清空的私信。");
        return;
    }

    const confirmed = await showCustomConfirm("确认清空", `确定要清空"${currentViewingDmsFor.name}"收到的所有粉丝私信吗？此操作不可恢复。`, { confirmButtonClass: "btn-danger" });

    if (confirmed) {
        chat.weiboDms = [];
        await db.chats.put(chat);
        renderDmList(chat.weiboDms, currentViewingDmsFor.name);
        alert("所有私信已清空。");
    }
}

/**
 * 处理删除单条私信的逻辑
 * @param {number} fanIndex - 粉丝对话的索引
 * @param {number} messageIndex - 要删除的消息的索引
 */
async function handleDeleteWeiboDm(fanIndex, messageIndex) {
    const charId = currentViewingDmsFor.isNpc ? currentViewingDmsFor.ownerId : currentViewingDmsFor.id;
    const chat = state.chats[charId];
    if (!chat || !chat.weiboDms[fanIndex]) return;

    const conversation = chat.weiboDms[fanIndex];
    const messageText = conversation.messages[messageIndex].text.substring(0, 30);

    const confirmed = await showCustomConfirm("删除私信", `确定要删除这条私信吗？\n\n"${messageText}..."`, { confirmButtonClass: "btn-danger" });

    if (confirmed) {
        conversation.messages.splice(messageIndex, 1);

        // 如果对话中所有消息都被删除，则删除整个对话
        if (conversation.messages.length === 0) {
            chat.weiboDms.splice(fanIndex, 1);
            await db.chats.put(chat);
            renderDmList(chat.weiboDms, currentViewingDmsFor.name);
            showScreen("weibo-dm-list-screen");
        } else {
            await db.chats.put(chat);
            renderDmDetail(conversation, chat);
        }
        alert("私信已删除。");
    }
}

/**
 * 处理点击"继续生成"按钮的逻辑
 */
async function handleGenerateMoreDms() {
    const charId = currentViewingDmsFor.isNpc ? currentViewingDmsFor.ownerId : currentViewingDmsFor.id;
    const chat = state.chats[charId];
    if (!chat) return;

    // 调用核心AI函数继续生成私信
    const newDmsData = await generateAndCacheFanDms(chat, true);

    // 渲染更新后的私信列表
    renderDmList(newDmsData, currentViewingDmsFor.name);
}

let isSummarizing = false; // 全局锁，防止重复触发总结

/**
 * 检查是否需要触发总结或提醒
 * @param {string} chatId - 当前聊天的ID
 */
async function checkAndTriggerSummary(chatId) {
    if (isSummarizing) return;

    const chat = state.chats[chatId];
    if (!chat || !chat.settings.summary || !chat.settings.summary.enabled) return;

    const summarySettings = chat.settings.summary;
    // 从上次总结的位置开始计算
    const lastSummaryIndex = summarySettings.lastSummaryIndex;
    const messagesSinceLastSummary = chat.history.slice(lastSummaryIndex + 1);

    if (messagesSinceLastSummary.length >= summarySettings.count) {
        isSummarizing = true;
        if (summarySettings.mode === "auto") {
            await performAutomaticSummary(chatId);
        } else {
            // 对于手动模式，只弹提醒
            await notifyForManualSummary(chatId);
        }
        isSummarizing = false;
    }
}

/**
 * 打开指定角色的微博主页
 * @param {string} charId - 要查看的角色的ID
 */
async function openWeiboCharProfile(charId) {
    currentViewingWeiboProfileId = charId;
    const chat = state.chats[charId];
    if (!chat) return;

    // 渲染角色主页内容
    await renderWeiboCharProfile(charId);

    // 渲染该角色的微博Feed
    await renderCharSpecificFeed(charId);

    // 切换到角色主页屏幕
    showScreen("weibo-char-profile-screen");

    // 隐藏关注列表弹窗（如果它还开着）
    document.getElementById("weibo-following-modal").classList.remove("visible");
}

/**
 * 渲染角色微博主页的个人资料部分 (V2 - 支持粉丝/关注数)
 * @param {string} charId - 角色的ID
 */
async function renderWeiboCharProfile(charId) {
    const chat = state.chats[charId];
    if (!chat) return;

    // 渲染基础信息
    document.getElementById("weibo-char-profile-title").textContent = `${chat.name}的主页`;
    document.getElementById("weibo-char-avatar-img").src = chat.settings.weiboAvatar || chat.settings.aiAvatar;
    document.getElementById("weibo-char-nickname").textContent = chat.settings.weiboNickname || chat.name;
    document.getElementById("weibo-char-background-img").src = chat.settings.weiboBackground;
    document.getElementById("weibo-char-profession-display").textContent = chat.settings.weiboProfession || "职业未设定";

    // 渲染关注数、粉丝数和微博数
    document.getElementById("weibo-char-following-count").textContent = chat.settings.weiboFollowingCount || "0";
    document.getElementById("weibo-char-fans-count").textContent = chat.settings.weiboFansCount || "0";

    // 动态计算并显示微博数
    const postCount = await db.weiboPosts.where("authorId").equals(charId).count();
    document.getElementById("weibo-char-posts-count").textContent = postCount;

    // 渲染头像框
    const frameImg = document.getElementById("weibo-char-avatar-frame");
    const frameUrl = chat.settings.weiboAvatarFrame || "";
    if (frameUrl) {
        frameImg.src = frameUrl;
        frameImg.style.display = "block";
    } else {
        frameImg.style.display = "none";
    }
}
/**
 * 渲染指定角色的微博Feed
 * @param {string} charId - 角色的ID
 */
async function renderCharSpecificFeed(charId) {
    const feedEl = document.getElementById("char-weibo-feed-list");
    feedEl.innerHTML = "";

    const posts = await db.weiboPosts.where("authorId").equals(charId).reverse().sortBy("timestamp");

    if (posts.length === 0) {
        feedEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Ta 还没有发过微博哦。</p>';
        return;
    }

    posts.forEach((post) => {
        // 复用我们强大的微博帖子创建函数
        feedEl.appendChild(createWeiboPostElement(post));
    });
}

/**
 * 打开角色微博资料的编辑器
 */
async function openCharWeiboEditor() {
    if (!currentViewingWeiboProfileId) return;
    const chat = state.chats[currentViewingWeiboProfileId];
    if (!chat) return;

    // 填充当前数据到编辑器
    document.getElementById("char-weibo-editor-avatar-preview").src = chat.settings.weiboAvatar || chat.settings.aiAvatar;
    document.getElementById("char-weibo-editor-nickname-input").value = chat.settings.weiboNickname || chat.name;
    document.getElementById("char-weibo-editor-bg-preview").src = chat.settings.weiboBackground;

    // 显示弹窗
    document.getElementById("char-weibo-editor-modal").classList.add("visible");
}

/**
 * 保存对角色微博资料的修改
 */
async function saveCharWeiboProfile() {
    if (!currentViewingWeiboProfileId) return;
    const chat = state.chats[currentViewingWeiboProfileId];
    if (!chat) return;

    // 从编辑器获取新数据
    chat.settings.weiboAvatar = document.getElementById("char-weibo-editor-avatar-preview").src;
    chat.settings.weiboNickname = document.getElementById("char-weibo-editor-nickname-input").value.trim();
    chat.settings.weiboBackground = document.getElementById("char-weibo-editor-bg-preview").src;

    // 保存到数据库
    await db.chats.put(chat);

    // 刷新主页显示
    await renderWeiboCharProfile(currentViewingWeiboProfileId);

    document.getElementById("char-weibo-editor-modal").classList.remove("visible");
    alert("角色微博资料已保存！");
}

/**
             * 根据角色人设和职业，生成初始的微博关注数和粉丝数
             * @param {object} chat - 角色的聊天对象
             * @returns {{following: string, fans: string}}
             */
function getInitialWeiboStats(chat) {
    const persona = (chat.settings.aiPersona || "") + (chat.settings.weiboProfession || "");
    const keywords = ["偶像", "明星", "演员", "歌手", "博主", "网红", "UP主", "主播", "选手", "画家", "作家"];
    const isPublicFigure = keywords.some((keyword) => persona.includes(keyword));

    let fansCount, followingCount;

    if (isPublicFigure) {
        fansCount = Math.floor(100000 + Math.random() * 9900000); // 10万 - 1000万
        followingCount = Math.floor(50 + Math.random() * 450); // 50 - 500
    } else {
        fansCount = Math.floor(100 + Math.random() * 4900); // 100 - 5000
        followingCount = Math.floor(50 + Math.random() * 250); // 50 - 300
    }

    return {
        fans: formatNumberToChinese(fansCount),
        following: formatNumberToChinese(followingCount),
    };
}

/**
             * 将数字格式化为带"万"或"亿"的字符串
             * @param {number} num - 原始数字
             * @returns {string} - 格式化后的字符串
             */
function formatNumberToChinese(num) {
    if (num >= 100000000) {
        return (num / 100000000).toFixed(1).replace(/\.0$/, "") + "亿";
    }
    if (num >= 10000) {
        return (num / 10000).toFixed(1).replace(/\.0$/, "") + "万";
    }
    return String(num);
}

/**
             * 打开User的私信列表
             */
async function openUserDmListScreen() {
    const settings = state.qzoneSettings || {};
    // 如果还没有生成过私信，就先让AI生成
    if (!settings.userDms || settings.userDms.length === 0) {
        await generateUserDms();
    } else {
        // 如果已经有了，就直接渲染
        renderUserDmList(settings.userDms);
    }
    showScreen("user-dm-list-screen");
}

/**
             * 调用AI为User生成一批粉丝私信
             */
async function generateUserDms(isAddingMore = false) {
    const settings = state.qzoneSettings;
    const { proxyUrl, apiKey, model } = state.apiConfig;

    if (!proxyUrl || !apiKey || !model) {
        alert("请先配置API！");
        return;
    }

    if (!isAddingMore && settings.userDms && settings.userDms.length > 0) {
        const confirmed = await showCustomConfirm("重新生成", "已有私信记录。重新生成将覆盖现有所有私信，确定吗？", { confirmButtonClass: "btn-danger" });
        if (!confirmed) return;
    }

    const alertMessage = isAddingMore ? "正在召唤新粉丝..." : "AI正在为你模拟粉丝私信...";
    await showCustomAlert("请稍候...", alertMessage);

    const userPersona = `
            # 用户信息 (这是你私信的对象，请仔细阅读)
            - 你的微博昵称: ${settings.weiboNickname || settings.nickname}
            - 你的微博职业: ${settings.weiboUserProfession || "未设定"}
            - 你的隐藏人设 (粉丝看不到，但会影响他们对你的态度): ${settings.weiboUserPersona || "一个普通的微博用户。"}
            `;

    const existingDmsContext = isAddingMore && settings.userDms ? `# 已有私信 (供你参考，请生成全新的对话)\n${JSON.stringify(settings.userDms.slice(-5))}` : "";

    // 增加粉丝数量
    const systemPrompt = `
            # 任务
            你是一个专业的"微博生态模拟器"。你的任务是根据用户的微博人设，虚构一个包含${isAddingMore ? "3-4" : "5-8"}位不同粉丝/路人的私信列表，并为每位粉丝创作一段【他们单方面发送给用户的】私信内容。
            ${userPersona}
            ${existingDmsContext}

            # 核心规则
            1.  **粉丝多样性**: 创作${isAddingMore ? "3-4" : "5-8"}位不同类型的粉丝。他们的私信内容和语气【必须】与他们的身份以及【用户的微博人设】高度相关。
            2.  **【【【对话单向性铁律】】】**: 你生成的对话【只能包含粉丝发送给用户的消息】。绝对不要模拟用户的回复。
            3.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，直接以 '[' 开头，以 ']' 结尾。
            4.  **随机头像**: 为每位粉丝从下方头像池中随机挑选一个URL。

            # JSON对象结构 (重要：messages数组里只能有sender为"fan"的对象！)
            {
            "fanName": "粉丝的微博昵称",
            "fanPersona": "对这位粉丝的简单描述 (例如: '一个担心哥哥事业的妈妈粉')",
            "fanAvatarUrl": "从头像池中选择的URL",
            "messages": [
                { "sender": "fan", "text": "这是粉丝发来的第一条消息..." },
                { "sender": "fan", "text": "这是粉丝紧接着发的第二条消息，因为还没收到回复..." }
            ]
            }

            # 头像池 (fanAvatarUrl 必须从以下链接中选择一个)
            - https://i.postimg.cc/PxZrFFFL/o-o-1.jpg
            - https://i.postimg.cc/Qd0Y537F/com-xingin-xhs-20251011153800.png
            现在，请开始生成【只有粉丝发言】的私信列表。`;

    try {
        const messagesForApi = [{ role: "user", content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini, state.apiConfig.temperature);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: parseFloat(state.apiConfig.temperature) || 0.8, response_format: { type: "json_object" } }),
            });

        if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

        const data = await response.json();
        const rawContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
        const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
        const newDmsData = JSON.parse(cleanedContent);

        if (Array.isArray(newDmsData)) {
            newDmsData.forEach((convo, index) => {
                if (!convo.fanAvatarUrl) {
                    const fanAvatars = ["https://i.postimg.cc/PxZrFFFL/o-o-1.jpg", "https://i.postimg.cc/Qd0Y537F/com-xingin-xhs-20251011153800.png"];
                    convo.fanAvatarUrl = fanAvatars[index % fanAvatars.length];
                }
            });

            if (isAddingMore) {
                settings.userDms.push(...newDmsData);
            } else {
                settings.userDms = newDmsData;
            }
            await saveQzoneSettings();
            renderUserDmList(settings.userDms);

            await showCustomAlert("生成成功", `${isAddingMore ? "新的私信已添加！" : "粉丝私信已生成！"}`);
        } else {
            throw new Error("AI返回的数据不是一个有效的数组。");
        }
    } catch (error) {
        console.error("生成User私信失败:", error);
        await showCustomAlert("生成失败", `发生错误: ${error.message}`);
    }
}

/**
             * 处理用户点击"触发AI回应"按钮
             */
async function handleTriggerUserDmAiReply() {
    if (currentUserDmFanIndex === null) return;

    const convo = state.qzoneSettings.userDms[currentUserDmFanIndex];
    if (!convo) return;

    const inputEl = document.getElementById("user-dm-input");
    inputEl.placeholder = "等待对方回复中...";
    inputEl.disabled = true;

    const aiResponse = await triggerUserDmAiReply(convo);
    if (aiResponse && aiResponse.length > 0) {
        // 使用 ... 展开数组
        convo.messages.push(...aiResponse);
        await saveQzoneSettings();
        renderUserDmDetail(convo);
        renderUserDmList(state.qzoneSettings.userDms);
    }

    inputEl.placeholder = "和粉丝聊点什么...";
    inputEl.disabled = false;
    inputEl.focus();
}

/**
             * 处理用户点击"重Roll"按钮
             */
async function handleUserDmReroll() {
    if (currentUserDmFanIndex === null) return;

    const convo = state.qzoneSettings.userDms[currentUserDmFanIndex];
    if (!convo || convo.messages.length === 0) return;

    let lastMessageIndex = convo.messages.length - 1;

    // 循环向前查找，直到找到第一个不是自己发的消息
    while (lastMessageIndex >= 0 && convo.messages[lastMessageIndex].sender === "char") {
        lastMessageIndex--;
    }

    // 如果没找到粉丝的消息，或者全是自己的消息，则提示
    if (lastMessageIndex < 0 || convo.messages[lastMessageIndex].sender !== "fan") {
        alert("只能对粉丝的最新回复使用重Roll功能哦。");
        return;
    }

    // 从找到的第一个粉丝消息开始，删除之后的所有消息
    convo.messages.splice(lastMessageIndex);

    renderUserDmDetail(convo);

    const inputEl = document.getElementById("user-dm-input");
    inputEl.placeholder = "正在重新生成回复...";
    inputEl.disabled = true;

    const aiResponse = await triggerUserDmAiReply(convo);
    if (aiResponse && aiResponse.length > 0) {
        // 使用 ... 展开数组
        convo.messages.push(...aiResponse);
        renderUserDmDetail(convo);
    }

    await saveQzoneSettings();
    renderUserDmList(state.qzoneSettings.userDms);

    inputEl.placeholder = "和粉丝聊点什么...";
    inputEl.disabled = false;
    inputEl.focus();
}

/**
             * 渲染User的私信列表
             */
function renderUserDmList(dmsData) {
    const listEl = document.getElementById("user-dm-list-container");
    listEl.innerHTML = "";

    if (!dmsData || dmsData.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">还没有收到任何私信哦</p>';
        return;
    }

    dmsData.forEach((convo, index) => {
        const lastMsg = convo.messages[convo.messages.length - 1];

        // 创建滑动容器和操作按钮
        const swipeContainer = document.createElement("div");
        swipeContainer.className = "user-dm-list-item-swipe-container";

        const contentWrapper = document.createElement("div");
        contentWrapper.className = "user-dm-list-item-content";
        contentWrapper.innerHTML = `
                <div class="dm-list-item" data-fan-index="${index}">
                    <img src="${convo.fanAvatarUrl}" class="dm-avatar">
                    <div class="dm-info">
                        <div class="dm-name-line">
                            <span class="dm-name">${convo.fanName}</span>
                            <span class="dm-persona-tag">${convo.fanPersona}</span>
                        </div>
                        <div class="dm-last-msg">${lastMsg.sender === "char" ? "你: " : ""}${lastMsg.text}</div>
                    </div>
                </div>
            `;

        const actionsWrapper = document.createElement("div");
        actionsWrapper.className = "user-dm-swipe-actions";
        actionsWrapper.innerHTML = `<button class="swipe-action-btn delete" data-fan-index="${index}">删除</button>`;

        swipeContainer.appendChild(contentWrapper);
        swipeContainer.appendChild(actionsWrapper);
        listEl.appendChild(swipeContainer);
    });
}

/**
             * 处理删除单条用户私信的逻辑
             */
async function handleDeleteUserDmMessage(fanIndex, messageIndex) {
    if (fanIndex === null || messageIndex === null) return;

    const settings = state.qzoneSettings;
    const conversation = settings.userDms[fanIndex];
    if (!conversation) return;

    const messageText = conversation.messages[messageIndex].text.substring(0, 30);
    const confirmed = await showCustomConfirm("删除私信", `确定要删除这条私信吗？\n\n"${messageText}..."`, { confirmButtonClass: "btn-danger" });

    if (confirmed) {
        conversation.messages.splice(messageIndex, 1);

        if (conversation.messages.length === 0) {
            // 如果这是最后一条消息，则删除整个对话
            settings.userDms.splice(fanIndex, 1);
            await saveQzoneSettings();
            renderUserDmList(settings.userDms);
            showScreen("user-dm-list-screen"); // 返回到列表页
        } else {
            // 否则只更新当前对话
            await saveQzoneSettings();
            renderUserDmDetail(conversation);
        }
        alert("私信已删除。");
    }
}

/**
             * 处理删除整个用户私信对话的逻辑
             */
async function handleDeleteUserDmConversation(fanIndex) {
    const settings = state.qzoneSettings;
    const conversation = settings.userDms[fanIndex];
    if (!conversation) return;

    const confirmed = await showCustomConfirm("删除对话", `确定要删除与"${conversation.fanName}"的全部对话吗？`, { confirmButtonClass: "btn-danger" });
    if (confirmed) {
        settings.userDms.splice(fanIndex, 1);
        await saveQzoneSettings();
        renderUserDmList(settings.userDms);
        alert("对话已删除。");
    } else {
        // 如果取消，则把滑块收回去
        const swipedContent = document.querySelector(`.user-dm-list-item-content.swiped`);
        if (swipedContent) swipedContent.classList.remove("swiped");
    }
}

/**
 * 打开与某个粉丝的私信详情页
 */
function openUserDmDetail(fanIndex) {
    currentUserDmFanIndex = fanIndex;
    const convo = state.qzoneSettings.userDms[fanIndex];
    if (!convo) return;

    renderUserDmDetail(convo);
    showScreen("user-dm-detail-screen");
}

/**
             * 渲染私信详情页的具体内容
             */
function renderUserDmDetail(conversation) {
    const messagesEl = document.getElementById("user-dm-messages-container");
    const titleEl = document.getElementById("user-dm-detail-title");
    messagesEl.innerHTML = "";
    titleEl.textContent = conversation.fanName;

    const userAvatar = state.qzoneSettings.avatar || defaultAvatar;

    conversation.messages.forEach((msg, index) => {
        const isFan = msg.sender === "fan";
        const wrapper = document.createElement("div");
        wrapper.className = `message-wrapper ${isFan ? "fan" : "user-self"}`;

        const bubble = document.createElement("div");
        bubble.className = `message-bubble`;

        const avatarHtml = `<img src="${isFan ? conversation.fanAvatarUrl : userAvatar}" class="avatar">`;
        const contentHtml = `<div class="content">${msg.text.replace(/\n/g, "<br>")}</div>`;

        // 创建删除按钮的HTML
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "user-dm-message-delete-btn";
        deleteBtn.dataset.messageIndex = index; // 用索引来标识是哪条消息
        deleteBtn.title = "删除";
        deleteBtn.innerHTML = "×";

        bubble.innerHTML = `${avatarHtml}${contentHtml}`;

        // 将气泡和删除按钮都添加到容器中
        wrapper.appendChild(bubble);
        wrapper.appendChild(deleteBtn);

        messagesEl.appendChild(wrapper);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
             * 处理用户在私信详情页发送消息 (仅发送，不触发AI)
             */
async function handleSendUserDm() {
    const inputEl = document.getElementById("user-dm-input");
    const messageText = inputEl.value.trim();
    if (!messageText || currentUserDmFanIndex === null) return;

    const convo = state.qzoneSettings.userDms[currentUserDmFanIndex];

    // 1. 创建你的消息对象
    const newMessage = { sender: "char", text: messageText };

    // 2. 将你的消息添加到对话历史中
    convo.messages.push(newMessage);

    // 3. 清空输入框并重置样式
    inputEl.value = "";
    inputEl.style.height = "auto";

    // 4. 重新渲染对话详情和左侧列表，以显示你的新消息
    renderUserDmDetail(convo);
    renderUserDmList(state.qzoneSettings.userDms);

    // 5. 保存状态
    await saveQzoneSettings();

    // 6. 重新聚焦输入框，方便你继续输入或等待操作
    inputEl.focus();

    // 注意：此处已移除所有自动触发AI回复的代码
}

/**
             * 调用AI生成粉丝的回复 (可以生成多条)
             */
async function triggerUserDmAiReply(conversation) {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        console.error("API配置不完整");
        return null;
    }

    const settings = state.qzoneSettings;

    // 全新的、更丰富的AI指令
    const systemPrompt = `
            # 角色扮演任务
            你将扮演一个正在和偶像或博主私信的粉丝。

            # 你的粉丝人设
            - 你的昵称: "${conversation.fanName}"
            - 你的性格和背景: "${conversation.fanPersona}"

            # 博主信息 (你正在和他/她聊天)
            - 微博昵称: ${settings.weiboNickname || settings.nickname}
            - 微博职业: ${settings.weiboUserProfession || "未设定"}
            - 博主的隐藏人设: ${settings.weiboUserPersona || "一个普通的微博用户。"}

            # 对话历史 (最近的5条)
            ${conversation.messages
            .slice(-5)
            .map((m) => `- ${m.sender === "fan" ? conversation.fanName : "我"}: ${m.text}`)
            .join("\n")}

            # 你的任务
            根据以上人设和对话历史，生成你接下来的回复。

            # 回复规则
            1.  **深度扮演**: 你的回复必须【极度符合】你的粉丝人设。语气、用词、情绪都要到位。
            2.  **内容丰富**: 不要只回复一句话。你的回复应该包含情绪(激动、失望、好奇等)、思考，或者向博主提出新的问题来推动对话。
            3.  **【【【格式铁律】】】**: 你的回复必须是一个【JSON数组】，即使只有一条消息。这个数组可以包含3到8条消息对象，模拟真实聊天中连续发消息的场景。
            4.  **对象结构**: 数组中的每个对象都必须是 {"sender": "fan", "text": "你的单条回复内容"}.

            现在，请以JSON数组的格式，生成你接下来要发送的1-3条消息。`;

    try {
        const messagesForApi = [{ role: "user", content: systemPrompt }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini, state.apiConfig.temperature);

        const response = isGemini
            ? await fetch(geminiConfig.url, geminiConfig.data)
            : await fetch(`${proxyUrl}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model, messages: messagesForApi, temperature: 1.0, response_format: { type: "json_object" } }),
            });

        if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

        const data = await response.json();
        const rawContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
        const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();

        // AI现在返回的是一个数组，我们直接解析并返回它
        const newMessages = JSON.parse(cleanedContent);

        // 做一个兼容性检查，如果AI意外返回了单个对象，我们把它包装成数组
        return Array.isArray(newMessages) ? newMessages : [newMessages];
    } catch (error) {
        console.error("触发粉丝回复失败:", error);
        await showCustomAlert("回复生成失败", `发生错误: ${error.message}`);
        // 返回一个包含错误信息的数组，以便界面能显示出来
        return [{ sender: "fan", text: `(AI生成回复时出错了: ${error.message})` }];
    }
}

/**
             * 清空所有User的私信
             */
async function handleClearAllUserDms() {
    const confirmed = await showCustomConfirm("确认清空", "确定要清空所有粉丝私信吗？此操作不可恢复。", { confirmButtonClass: "btn-danger" });
    if (confirmed) {
        state.qzoneSettings.userDms = [];
        await saveQzoneSettings();
        renderUserDmList([]);
        alert("所有私信已清空。");
    }
}

function initWeiboEventListeners() {

    // 微博页面内的各种点击事件处理(使用事件委托)
    document.getElementById("weibo-screen").addEventListener("click", async (e) => {
        // 处理微博帖子中头像点击的逻辑
        const avatarWrapper = e.target.closest(".weibo-post-avatar-clickable");
        if (avatarWrapper) {
            const charId = avatarWrapper.dataset.charId;
            // 如果点击的不是用户自己，就打开TA的主页
            if (charId && charId !== "user") {
                openWeiboCharProfile(charId);
            }
            return; // 处理完就结束，不再执行后面的逻辑
        }

        const target = e.target;

        // 处理热搜和广场帖子的删除按钮
        const deleteBtn = target.closest(".weibo-post-delete-btn");
        if (deleteBtn) {
            const postItem = deleteBtn.closest(".weibo-post-item");
            if (postItem) {
                // 先给用户一个确认的机会，防止误删
                const confirmed = await showCustomConfirm("删除动态", "确定要删除这条动态吗？（此操作仅在本页面生效）", { confirmButtonClass: "btn-danger" });

                if (confirmed) {
                    // 播放消失动画，然后移除帖子
                    postItem.style.transition = "opacity 0.3s, transform 0.3s";
                    postItem.style.opacity = "0";
                    postItem.style.transform = "scale(0.95)";
                    setTimeout(() => {
                        postItem.remove();
                    }, 300); // 等动画播放完再彻底删除
                }
            }
            return; // 处理完删除后，必须立刻结束，防止触发下面的其他点击事件
        }

        // 处理微博中的"文字图"点击事件
        if (target.classList.contains("weibo-post-image") && target.dataset.hiddenText) {
            showCustomAlert("图片内容", target.dataset.hiddenText.replace(/<br>/g, "\n"));
            return; // 处理完后，立刻退出，避免触发其他逻辑
        }

        const postItem = target.closest(".weibo-post-item");
        const postId = postItem ? parseInt(postItem.dataset.postId) : null;

        // 处理"删除评论"按钮
        const deleteCommentBtn = target.closest(".comment-delete-btn");
        if (deleteCommentBtn) {
            const commentItem = deleteCommentBtn.closest(".weibo-comment-item");
            if (postId && commentItem && commentItem.dataset.commentId) {
                deleteWeiboComment(postId, commentItem.dataset.commentId);
            }
            return;
        }

        // 处理"生成评论"按钮
        const generateBtn = target.closest(".generate-comments-btn");
        if (generateBtn) {
            if (postId) {
                generateWeiboComments(postId);
            }
            return;
        }

        // 处理底部导航栏切换
        const navItem = target.closest(".weibo-nav-item");
        if (navItem && navItem.dataset.view) {
            switchToWeiboView(navItem.dataset.view);
            return;
        }

        // 处理微博删除按钮
        const actionsBtn = target.closest(".post-actions-btn");
        if (actionsBtn) {
            // 从按钮本身获取正确的 postId
            const postId = parseInt(actionsBtn.dataset.postId);

            const confirmed = await showCustomConfirm("删除微博", "确定要永久删除这条微博吗？此操作不可恢复。", { confirmButtonClass: "btn-danger" });

            // 检查 postId 是否是一个有效的数字
            if (confirmed && !isNaN(postId)) {
                await db.weiboPosts.delete(postId);
                // 删除后，刷新所有相关的微博列表和个人资料
                await renderMyWeiboFeed();
                await renderFollowingWeiboFeed();
                await renderWeiboProfile();
                alert("微博已删除。");
            }
            return;
        }

        // 处理点赞、评论、回复
        if (target.closest(".like-btn")) {
            if (postId) handleWeiboLike(postId);
            return;
        }
        if (target.closest(".weibo-comment-send-btn")) {
            const input = postItem.querySelector(".weibo-comment-input");
            if (postId && input) handleWeiboComment(postId, input);
            return;
        }

        const commentItem = target.closest(".weibo-comment-item");
        if (commentItem) {
            const commenterName = commentItem.dataset.commenterName;
            const commentId = commentItem.dataset.commentId;
            const input = postItem.querySelector(".weibo-comment-input");
            if (input.dataset.replyToId === commentId) {
                input.placeholder = "留下你的精彩评论吧...";
                delete input.dataset.replyToId;
                delete input.dataset.replyToNickname;
            } else {
                input.placeholder = `回复 @${commenterName}:`;
                input.dataset.replyToId = commentId;
                input.dataset.replyToNickname = commenterName;
                input.focus();
            }
            return;
        }
    });

    // 为微博个人主页的所有可编辑元素，绑定专属的编辑函数
    document.getElementById("weibo-profile-page").addEventListener("click", async (e) => {
        const target = e.target;

        // 处理微博头像点击事件
        if (target.id === "weibo-avatar-img" || target.closest(".weibo-avatar-container")) {
            // 弹出一个选择菜单，让用户决定是换头像还是换框
            const choice = await showChoiceModal("编辑头像", [
                { text: "更换头像图片", value: "avatar" },
                { text: "更换头像框", value: "frame" },
            ]);

            // 根据用户的选择，执行不同的操作
            if (choice === "avatar") {
                editWeiboAvatar(); // 调用原来的更换头像函数
            } else if (choice === "frame") {
                openFrameSelectorModal("weibo_profile"); // 调用更换头像框函数
            }
            return; // 处理完后直接退出
        }
        // 处理其他可编辑元素
        else if (target.id === "weibo-nickname") {
            editWeiboNickname();
        } else if (target.id === "weibo-user-profession-display") {
            openWeiboUserSettingsModal();
        } else if (target.id === "weibo-background-img") {
            editWeiboBackground();
        } else if (target.closest("#weibo-fans-item")) {
            editWeiboFansCount();
        }
    });

    // 微博APP图标点击事件处理
    document.getElementById("weibo-app-icon").addEventListener("click", () => {
        renderWeiboProfile(); // 渲染个人资料
        renderMyWeiboFeed(); // 主动渲染"我的微博"列表
        switchToWeiboView("weibo-my-profile-view"); // 默认显示"我的微博"
        showScreen("weibo-screen");
    });

    // 为"关注"数字和"发布微博"按钮绑定事件
    document.getElementById("weibo-following-btn").addEventListener("click", showFollowingList);
    document.getElementById("create-weibo-post-btn").addEventListener("click", openWeiboPublisherClean);
    document.getElementById("close-following-list-btn").addEventListener("click", () => {
        document.getElementById("weibo-following-modal").classList.remove("visible");
    });
    document.getElementById("clear-following-feed-btn").addEventListener("click", clearFollowingFeed);

    // 微博用户人设设置功能事件绑定
    document.getElementById("edit-weibo-profile-btn").addEventListener("click", openWeiboUserSettingsModal);
    document.getElementById("cancel-weibo-user-settings-btn").addEventListener("click", () => {
        document.getElementById("weibo-user-settings-modal").classList.remove("visible");
    });
    document.getElementById("save-weibo-user-settings-btn").addEventListener("click", saveWeiboUserSettings);
    document.getElementById("weibo-user-preset-select").addEventListener("change", handleWeiboUserPresetSelection);
    document.getElementById("manage-weibo-user-presets-btn").addEventListener("click", openWeiboUserPresetManager);

    // 返回微博主屏幕并默认显示“我的微博”页签
    document.getElementById("back-from-dm-list").addEventListener("click", () => {
        showScreen("weibo-screen");
        switchToWeiboView("weibo-my-profile-view");
    });

    // 从私信详情返回私信列表
    document.getElementById("back-from-dm-detail").addEventListener("click", () => {
        showScreen("weibo-dm-list-screen");
    });

    // 绑定“继续生成”按钮，用于生成更多私信
    document.getElementById("generate-more-dms-btn").addEventListener("click", handleGenerateMoreDms);

    // 使用事件委托处理私信列表的点击事件，打开私信详情
    document.getElementById("weibo-dm-list").addEventListener("click", (e) => {
        const item = e.target.closest(".dm-list-item");
        if (item && item.dataset.fanIndex) {
            openDmDetail(parseInt(item.dataset.fanIndex));
        }
    });

    // 使用事件委托处理私信详情页的删除按钮点击
    document.getElementById("weibo-dm-messages").addEventListener("click", (e) => {
        const deleteBtn = e.target.closest(".dm-message-delete-btn");
        if (deleteBtn) {
            const fanIndex = parseInt(document.querySelector(".dm-list-item.active")?.dataset.fanIndex ?? document.getElementById("weibo-dm-detail-screen").dataset.currentFanIndex);
            const messageIndex = parseInt(deleteBtn.dataset.messageIndex);

            const conversation = state.chats[currentViewingDmsFor.isNpc ? currentViewingDmsFor.ownerId : currentViewingDmsFor.id].weiboDms.find((convo) => convo.fanName === document.getElementById("weibo-dm-detail-title").textContent);
            const fanIdx = state.chats[currentViewingDmsFor.isNpc ? currentViewingDmsFor.ownerId : currentViewingDmsFor.id].weiboDms.indexOf(conversation);

            if (!isNaN(fanIdx) && !isNaN(messageIndex)) {
                handleDeleteWeiboDm(fanIdx, messageIndex);
            }
        }
    });

    // 清空所有微博私信
    document.getElementById("clear-all-dms-btn").addEventListener("click", handleClearAllDms);

    // 角色微博主页关注和粉丝数编辑功能
    document.getElementById("weibo-char-profile-page").addEventListener("click", async (e) => {
        if (!currentViewingWeiboProfileId) return;
        const chat = state.chats[currentViewingWeiboProfileId];
        if (!chat) return;

        if (e.target.closest("#weibo-char-following-item")) {
            const newFollowing = await showCustomPrompt("编辑关注数", "请输入新的关注数:", chat.settings.weiboFollowingCount);
            if (newFollowing !== null) {
                chat.settings.weiboFollowingCount = newFollowing.trim() || "0";
                await db.chats.put(chat);
                await renderWeiboCharProfile(currentViewingWeiboProfileId);
            }
        } else if (e.target.closest("#weibo-char-fans-item")) {
            const newFans = await showCustomPrompt("编辑粉丝数", "请输入新的粉丝数 (支持'万'/'亿'):", chat.settings.weiboFansCount);
            if (newFans !== null) {
                chat.settings.weiboFansCount = newFans.trim() || "0";
                await db.chats.put(chat);
                await renderWeiboCharProfile(currentViewingWeiboProfileId);
            }
        }
    });

    // 返回微博主屏幕
    document.getElementById("back-from-char-profile").addEventListener("click", () => {
        showScreen("weibo-screen");
    });

    // 打开角色微博资料编辑器
    document.getElementById("edit-char-weibo-profile-btn").addEventListener("click", openCharWeiboEditor);

    // 关闭角色微博资料编辑器
    document.getElementById("cancel-char-weibo-editor-btn").addEventListener("click", () => {
        document.getElementById("char-weibo-editor-modal").classList.remove("visible");
    });

    // 保存角色微博资料
    document.getElementById("save-char-weibo-editor-btn").addEventListener("click", saveCharWeiboProfile);

    // 设置角色微博头像和背景上传
    setupFileUpload("char-weibo-editor-avatar-input", (base64) => {
        document.getElementById("char-weibo-editor-avatar-preview").src = base64;
    });
    setupFileUpload("char-weibo-editor-bg-input", (base64) => {
        document.getElementById("char-weibo-editor-bg-preview").src = base64;
    });

    // 使用事件委托处理角色微博关注列表的点击
    document.getElementById("weibo-following-list-container").addEventListener("click", (e) => {
        const viewProfileBtn = e.target.closest(".view-profile-btn");
        if (viewProfileBtn && viewProfileBtn.dataset.charId) {
            openWeiboCharProfile(viewProfileBtn.dataset.charId);
        }
    });

    // 角色微博资料编辑器事件绑定
    document.getElementById("char-weibo-editor-modal").addEventListener("click", (e) => {
        if (e.target.classList.contains("change-frame-btn")) {
            const type = e.target.dataset.type;
            const targetId = currentViewingWeiboProfileId;
            openFrameSelectorModal(type, targetId);
        } else if (e.target.id === "cancel-char-weibo-editor-btn") {
            document.getElementById("char-weibo-editor-modal").classList.remove("visible");
        } else if (e.target.id === "save-char-weibo-editor-btn") {
            saveCharWeiboProfile();
        }
    });

    // User微博私信功能事件监听器
    const userDmBtn = document.getElementById("weibo-my-dms-btn");
    if (userDmBtn) {
        userDmBtn.addEventListener("click", openUserDmListScreen);
    }

    // 返回微博主页
    document.getElementById("back-from-user-dm-list").addEventListener("click", () => {
        showScreen("weibo-screen");
        switchToWeiboView("weibo-my-profile-view");
    });

    // 生成新私信和清空私信
    document.getElementById("generate-new-user-dms-btn").addEventListener("click", () => generateUserDms(true));
    document.getElementById("clear-all-user-dms-btn").addEventListener("click", handleClearAllUserDms);

    // 使用事件委托处理私信列表点击，打开私信详情
    document.getElementById("user-dm-list-container").addEventListener("click", (e) => {
        const item = e.target.closest(".dm-list-item");
        if (item && item.dataset.fanIndex) {
            openUserDmDetail(parseInt(item.dataset.fanIndex));
        }
    });

    // 返回私信列表
    document.getElementById("back-from-user-dm-detail").addEventListener("click", () => {
        showScreen("user-dm-list-screen");
    });

    // 发送私信
    document.getElementById("user-dm-send-btn").addEventListener("click", handleSendUserDm);

    // 回车发送私信
    document.getElementById("user-dm-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            document.getElementById("user-dm-send-btn").click();
        }
    });

    // 触发AI回复和重新生成
    document.getElementById("user-dm-trigger-ai-btn").addEventListener("click", handleTriggerUserDmAiReply);
    document.getElementById("user-dm-reroll-btn").addEventListener("click", handleUserDmReroll);

    // User私信删除功能
    document.getElementById("user-dm-messages-container").addEventListener("click", (e) => {
        const deleteBtn = e.target.closest(".user-dm-message-delete-btn");
        if (deleteBtn) {
            const messageIndex = parseInt(deleteBtn.dataset.messageIndex);
            if (currentUserDmFanIndex !== null && !isNaN(messageIndex)) {
                handleDeleteUserDmMessage(currentUserDmFanIndex, messageIndex);
            }
        }
    });

    // 私信列表滑动删除功能
    const userDmListEl = document.getElementById("user-dm-list-container");
    let userDmSwipeState = { isDragging: false, startX: 0, activeContent: null };

    function resetAllUserDmSwipes(exceptThisOne = null) {
        document.querySelectorAll(".user-dm-list-item-content.swiped").forEach((content) => {
            if (content !== exceptThisOne) {
                content.classList.remove("swiped");
            }
        });
    }

    userDmListEl.addEventListener("mousedown", (e) => {
        const content = e.target.closest(".user-dm-list-item-content");
        if (content) {
            resetAllUserDmSwipes(content);
            userDmSwipeState = { isDragging: true, startX: e.pageX, activeContent: content };
            e.preventDefault();
        }
    });

    userDmListEl.addEventListener(
        "touchstart",
        (e) => {
            const content = e.target.closest(".user-dm-list-item-content");
            if (content) {
                resetAllUserDmSwipes(content);
                userDmSwipeState = { isDragging: true, startX: e.touches[0].pageX, activeContent: content };
            }
        },
        { passive: true }
    );

    document.addEventListener("mousemove", (e) => {
        if (!userDmSwipeState.isDragging || !userDmSwipeState.activeContent) return;
        const diffX = e.pageX - userDmSwipeState.startX;
        if (diffX < 0 && diffX > -90) {
            userDmSwipeState.activeContent.style.transition = "none";
            userDmSwipeState.activeContent.style.transform = `translateX(${diffX}px)`;
        }
    });

    document.addEventListener(
        "touchmove",
        (e) => {
            if (!userDmSwipeState.isDragging || !userDmSwipeState.activeContent) return;
            const diffX = e.touches[0].pageX - userDmSwipeState.startX;
            if (diffX < 0 && diffX > -90) {
                userDmSwipeState.activeContent.style.transition = "none";
                userDmSwipeState.activeContent.style.transform = `translateX(${diffX}px)`;
            }
        },
        { passive: true }
    );

    const handleUserDmSwipeEnd = (e) => {
        if (!userDmSwipeState.isDragging || !userDmSwipeState.activeContent) return;

        const content = userDmSwipeState.activeContent;
        content.style.transition = "transform 0.3s ease";
        const transformStyle = window.getComputedStyle(content).transform;
        const currentTranslateX = new DOMMatrix(transformStyle).m41;

        if (currentTranslateX < -40) {
            content.classList.add("swiped");
        } else {
            content.classList.remove("swiped");
        }
        content.style.transform = "";

        userDmSwipeState = { isDragging: false, activeContent: null };
    };

    document.addEventListener("mouseup", handleUserDmSwipeEnd);
    document.addEventListener("touchend", handleUserDmSwipeEnd);

    // 为微博关注列表容器绑定点击事件
    document.getElementById("weibo-following-list-container").addEventListener("click", (e) => {
        const item = e.target.closest(".weibo-following-item");
        if (!item) return;

        // 检查点击的是否是操作按钮
        const triggerBtn = e.target.closest(".weibo-action-trigger-btn");
        if (triggerBtn) {
            const targetInfo = {
                id: triggerBtn.dataset.targetId,
                name: triggerBtn.dataset.targetName,
                isNpc: triggerBtn.dataset.isNpc === "true",
                ownerId: triggerBtn.dataset.ownerId || null,
            };
            openWeiboActionModal(targetInfo);
        }
        // 如果点击的不是操作按钮，就视为点击了整行，触发查看私信
        else {
            // 隐藏当前的关注列表弹窗
            document.getElementById("weibo-following-modal").classList.remove("visible");

            // 从整行item上获取角色信息
            const actionBtn = item.querySelector(".weibo-action-trigger-btn");
            if (actionBtn) {
                const targetInfo = {
                    id: actionBtn.dataset.targetId,
                    name: actionBtn.dataset.targetName,
                    isNpc: actionBtn.dataset.isNpc === "true",
                    ownerId: actionBtn.dataset.ownerId || null,
                };
                // 调用打开微博私信函数
                openWeiboDms(targetInfo);
            }
        }
    });

    // 微博发布功能
    document.getElementById("create-weibo-post-btn").addEventListener("click", openWeiboPublisherClean);

    // 为取消微博操作按钮绑定事件
    document.getElementById("cancel-weibo-action-btn").addEventListener("click", () => {
        document.getElementById("weibo-action-modal").classList.remove("visible");
    });

    // 为确认微博AI操作按钮绑定事件
    document.getElementById("confirm-weibo-action-btn").addEventListener("click", handleWeiboAiAction);

    // 为生成热搜按钮绑定事件（支持多角色选择）
    document.getElementById("generate-hot-search-btn").addEventListener("click", async () => {
        const targets = await showMultiCharacterSelectorForWeibo();
        if (targets) {
            await generateHotSearch(targets);
        }
    });

    // 为生成广场动态按钮绑定事件（支持多角色选择）
    document.getElementById("generate-plaza-feed-btn").addEventListener("click", async () => {
        const targets = await showMultiCharacterSelectorForWeibo();
        if (targets) {
            await generatePlazaFeed(null, targets);
        }
    });

    // 为微博热搜详情页的返回按钮绑定事件
    document.getElementById("back-from-hottopic-btn").addEventListener("click", () => {
        switchToWeiboView("weibo-hot-search-view");
    });

    // 为热搜详情页的刷新按钮绑定事件
    document.getElementById("refresh-hottopic-feed-btn").addEventListener("click", () => {
        if (currentHotTopic) {
            generateHotSearchFeed(currentHotTopic);
        }
    });
}
