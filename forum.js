document.addEventListener('DOMContentLoaded', () => {
    let currentFilterContext = { type: 'global', id: null }; // 记录当前打开筛选的是哪个页面
    let activeGroupId = null; // 记录当前打开的小组ID
    let activeForumPostId = null; // 记录当前打开的帖子ID
    let editingGroupId = null; // 用于追踪正在编辑的小组ID

    let activeForumFilters = {
        global: [], // 用于主页小组列表的筛选
        group: {}, // 用于存储每个小组内部帖子的筛选, e.g., { 1: ['科幻'], 2: ['剧情'] }
    };
    let isSelectionMode = false;
    let weiboHotSearchCache = [];
    /**
     * 从一个数组中随机获取一个元素
     * @param {Array} arr - 目标数组
     * @returns {*} - 数组中的一个随机元素
     */
    function getRandomItem(arr) {
        // 安全检查，如果数组为空或不存在，返回空字符串
        if (!arr || arr.length === 0) return '';
        // 返回一个随机索引对应的元素
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function resetCreatePostModal() {
        document.getElementById('post-public-text').value = '';
        document.getElementById('post-image-preview').src = '';
        document.getElementById('post-image-description').value = '';
        document.getElementById('post-image-preview-container').classList.remove('visible');
        document.getElementById('post-image-desc-group').style.display = 'none';
        document.getElementById('post-local-image-input').value = '';
        document.getElementById('post-hidden-text').value = '';


        const imageModeBtn = document.getElementById('switch-to-image-mode');
        const textImageModeBtn = document.getElementById('switch-to-text-image-mode');
        const imageModeContent = document.getElementById('image-mode-content');
        const textImageModeContent = document.getElementById('text-image-mode-content');

        imageModeBtn.classList.add('active');
        textImageModeBtn.classList.remove('active');
        imageModeContent.classList.add('active');
        textImageModeContent.classList.remove('active');
    }


    function addLongPressListener(element, callback) {
        let pressTimer;
        const startPress = e => {
            if (isSelectionMode) return;
            e.preventDefault();
            pressTimer = window.setTimeout(() => callback(e), 500);
        };
        const cancelPress = () => clearTimeout(pressTimer);
        element.addEventListener('mousedown', startPress);
        element.addEventListener('mouseup', cancelPress);
        element.addEventListener('mouseleave', cancelPress);
        element.addEventListener('touchstart', startPress, { passive: true });
        element.addEventListener('touchend', cancelPress);
        element.addEventListener('touchmove', cancelPress);
    }
    /**
     * 渲染论坛主屏幕
     * 逻辑：内置小组显示SVG，用户小组显示自定义图片
     */
    async function renderForumScreen() {
        const listEl = document.getElementById('forum-group-list');
        const allGroups = await db.forumGroups.toArray();
        listEl.innerHTML = '';

        // --- 筛选逻辑 ---
        const globalFilters = activeForumFilters.global;
        let groupsToRender = allGroups;
        if (globalFilters && globalFilters.length > 0) {
            groupsToRender = allGroups.filter(
                group => group.categories && group.categories.some(cat => globalFilters.includes(cat)),
            );
        }

        if (groupsToRender.length === 0) {
            const message =
                globalFilters.length > 0 ? '没有找到符合筛选条件的小组哦' : '还没有任何小组，点击右上角“+”创建一个吧！';
            listEl.innerHTML = `<p style="text-align:center; color: #8a8a8a; padding: 50px 0;">${message}</p>`;
            return;
        }

        // --- 核心：图标生成器 (优先显示自定义图片) ---
        const renderGroupIcon = group => {
            const name = group.name;
            const iconInput = group.icon || ''; // 可能是emoji 或 URL

            // 1. 检查是否是图片URL (http开头 或 data:开头)
            // 只要用户填了链接，不管它叫什么名字，都强制显示图片！
            if (iconInput.startsWith('http') || iconInput.startsWith('data:')) {
                return `<img src="${iconInput}" class="forum-group-custom-img">`;
            }

            // 2. 如果没有图片URL，再检查是否是【内置小组】，使用精美SVG
            const svgStyle = `width="24" height="24" fill="currentColor" viewBox="0 0 24 24"`;

            if (name.includes('娱乐') || name.includes('瓜')) {
                return `<div class="forum-group-icon-wrapper style-pink"><svg ${svgStyle}><path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></div>`;
            }
            if (name.includes('灵异') || name.includes('鬼')) {
                return `<div class="forum-group-icon-wrapper style-purple"><svg ${svgStyle}><path d="M9 22v-2c0-1.1.9-2 2-2s2 .9 2 2v2M6 22v-4c0-1.1.9-2 2-2s2 .9 2 2v4M18 22v-4c0-1.1-.9-2-2-2s-2 .9-2 2v4M12 2a8 8 0 0 0-8 8v7a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5v-7a8 8 0 0 0-8-8z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/></svg></div>`;
            }
            if (name.includes('crush') || name.includes('梦') || name.includes('恋') || name.includes('心动')) {
                return `<div class="forum-group-icon-wrapper style-red"><svg ${svgStyle}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>`;
            }
            if (name.includes('同人') || name.includes('文') || name.includes('写')) {
                return `<div class="forum-group-icon-wrapper style-blue"><svg ${svgStyle}><path d="M12 19l7-7 3 3-7 7-3-3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 2l7.586 7.586" stroke="currentColor" stroke-width="2"/><circle cx="11" cy="11" r="2" fill="currentColor"/></svg></div>`;
            }
            if (name.includes('帮') || name.includes('选') || name.includes('助')) {
                return `<div class="forum-group-icon-wrapper style-orange"><svg ${svgStyle}><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2"/></svg></div>`;
            }

            // 3. 如果既不是URL，名字也没匹配到内置风格，就检查是不是 Emoji
            if (iconInput) {
                // 这里简单处理，直接显示输入的字符作为图标（用于Emoji）
                return `<div class="forum-group-icon-wrapper style-default" style="font-size: 24px; display: flex; align-items: center; justify-content: center;">${iconInput}</div>`;
            }

            // 4. 最后的默认 SVG (兜底)
            return `<div class="forum-group-icon-wrapper style-default"><svg ${svgStyle}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>`;
        };

        // --- 渲染列表 ---
        groupsToRender.forEach(group => {
            const item = document.createElement('div');
            item.className = 'forum-group-item';

            let categoriesHtml = '';
            if (group.categories && group.categories.length > 0) {
                categoriesHtml = `
                <div class="category-tag-container">
                    ${group.categories.map(cat => `<span class="category-tag">#${cat}</span>`).join('')}
                </div>
            `;
            }

            item.innerHTML = `
            ${renderGroupIcon(group)}
            <div class="forum-group-info">
                <div class="forum-group-name">${group.name}</div>
                <div class="forum-group-desc">${group.description || '暂无简介'}</div>
                ${categoriesHtml}
            </div>
            <div class="forum-group-arrow">›</div>
        `;
            item.addEventListener('click', () => openGroup(group.id, group.name));
            addLongPressListener(item, () => showGroupActions(group.id, group.name));
            listEl.appendChild(item);
        });

        // 更新筛选按钮状态
        const filterBtn = document.getElementById('forum-filter-btn');
        if (filterBtn) {
            filterBtn.classList.toggle('active', globalFilters && globalFilters.length > 0);
        }
    }

    /**
     * 长按小组时显示操作菜单（编辑或删除）
     * @param {number} groupId - 小组的ID
     * @param {string} groupName - 小组的名称
     */
    async function showGroupActions(groupId, groupName) {
        // 调用你现有的弹窗函数，显示两个选项
        const choice = await showChoiceModal(`操作小组 "${groupName}"`, [
            { text: '✏️ 编辑小组信息', value: 'edit' },
            { text: '🗑️ 删除小组', value: 'delete' },
        ]);

        // 根据用户的选择，执行不同的操作
        if (choice === 'edit') {
            // 如果用户选择“编辑”，就调用你原来的编辑函数
            openGroupEditor(groupId);
        } else if (choice === 'delete') {
            // 如果用户选择“删除”，就调用你原来的删除函数
            deleteGroupAndPosts(groupId);
        }
    }

    async function openGroup(groupId, groupName) {
        window.activeGroupId = groupId;
        document.getElementById('group-screen-title').textContent = groupName;
        const fanficBar = document.getElementById('fanfic-preference-bar');

        // 根据小组名显示或隐藏特定UI
        if (groupName === '同人文小组') {
            fanficBar.style.display = 'block';
            await populateFanficSelectors();
            await loadFanficPresets();

            // 默认折叠起来，不占用空间
            document.getElementById('fanfic-bar-content').classList.add('collapsed');
            document.getElementById('fanfic-bar-toggle-icon').classList.add('collapsed');
        } else {
            fanficBar.style.display = 'none';
        }
        await renderGroupPosts(groupId);
        showScreen('group-screen');
    }

    /**
     * 将一个新创建的帖子元素添加到列表的顶部
     * @param {object} post - 包含ID的完整帖子对象
     */
    function prependNewPostElement(post) {
        const listEl = document.getElementById('group-post-list');

        // 检查列表当前是否显示“空空如也”的消息，如果是，就清空它
        const emptyMessage = listEl.querySelector('p');
        if (
            emptyMessage &&
            (emptyMessage.textContent.includes('还没有帖子') || emptyMessage.textContent.includes('没有找到符合'))
        ) {
            listEl.innerHTML = '';
        }

        // 创建新帖子的DOM元素（这段代码与renderGroupPosts中的逻辑几乎一样）
        const commentCount = 0; // 新帖子的评论数永远是0
        const item = document.createElement('div');
        item.className = 'forum-post-item';
        item.dataset.postId = post.id;

        let categoriesHtml = '';
        if (post.categories && post.categories.length > 0) {
            categoriesHtml = `
      <div class="category-tag-container">
          ${post.categories.map(cat => `<span class="category-tag">#${cat}</span>`).join('')}
      </div>
    `;
        }

        item.innerHTML = `
      <div class="post-item-title">${post.title}</div>
      ${categoriesHtml}
      <div class="post-item-meta">
          <span>作者: ${post.author}</span>
          <span>评论: ${commentCount}</span>
      </div>
      <button class="forum-post-delete-btn" title="删除帖子">×</button>
  `;

        // 使用 prepend() 将新帖子添加到列表的【最前面】
        listEl.prepend(item);
    }

    // forum.js

    /**
     * 渲染小组内的帖子列表及其分类（支持筛选）
     */
    async function renderGroupPosts(groupId) {
        const listEl = document.getElementById('group-post-list');
        const allPosts = await db.forumPosts.where('groupId').equals(groupId).reverse().sortBy('timestamp');
        listEl.innerHTML = '';

        const groupFilters = activeForumFilters.group[groupId];
        let postsToRender = allPosts;

        if (groupFilters && groupFilters.length > 0) {
            postsToRender = allPosts.filter(
                post => post.categories && post.categories.some(cat => groupFilters.includes(cat)),
            );
        }

        if (postsToRender.length === 0) {
            const message = groupFilters && groupFilters.length > 0 ? '没有找到符合筛选条件的帖子哦' : '这个小组还没有帖子哦';
            listEl.innerHTML = `<p style="text-align:center; color: #8a8a8a; padding: 50px 0;">${message}</p>`;
            return;
        }

        for (const post of postsToRender) {
            // 在使用 post.id 查询前，先用 parseInt() 确保它一定是数字类型。
            const commentCount = await db.forumComments.where('postId').equals(parseInt(post.id)).count();

            const item = document.createElement('div');
            item.className = 'forum-post-item';
            item.dataset.postId = post.id;

            let categoriesHtml = '';
            if (post.categories && post.categories.length > 0) {
                categoriesHtml = `
                <div class="category-tag-container">
                    ${post.categories.map(cat => `<span class="category-tag">#${cat}</span>`).join('')}
                </div>
            `;
            }

            item.innerHTML = `
            <div class="post-item-title">${post.title}</div>
            ${categoriesHtml}
            <div class="post-item-meta">
                <span>作者: ${post.author}</span>
                <span>评论: ${commentCount}</span>
            </div>
            <button class="forum-post-delete-btn" title="删除帖子">×</button>
        `;
            listEl.appendChild(item);
        }

        // 更新筛选按钮状态
        const filterBtn = document.getElementById('group-filter-btn');
        if (filterBtn) {
            filterBtn.classList.toggle('active', groupFilters && groupFilters.length > 0);
        }
    }

    /**
     * 打开一个帖子，显示详情和评论
     */
    async function openPost(postId) {
        activeForumPostId = postId;
        await renderPostDetails(postId);
        showScreen('post-screen');
    }


    /**
     * 渲染帖子详情和评论
     */
    async function renderPostDetails(postId) {
        const contentEl = document.getElementById('post-detail-content');
        const post = await db.forumPosts.get(postId);
        const comments = await db.forumComments.where('postId').equals(postId).sortBy('timestamp');

        if (!post) {
            contentEl.innerHTML = '<p>帖子不存在或已被删除</p>';
            return;
        }

        // --- 1. 获取作者头像 ---
        let authorAvatarUrl = 'https://i.postimg.cc/PxZrFFFL/o-o-1.jpg'; // 默认路人头像
        const userNickname = state.qzoneSettings.nickname || '我';

        if (post.author === userNickname) {
            authorAvatarUrl = state.qzoneSettings.avatar; // 如果是用户自己
        } else {
            const authorChar = Object.values(state.chats).find(c => c.name === post.author);
            if (authorChar) {
                authorAvatarUrl = authorChar.settings.aiAvatar; // 如果是角色
            }
        }

        // --- 2. 拼接评论区HTML ---
        let commentsHtml = `
        <div class="post-comments-section">
            <h3>评论 (${comments.length})</h3>
    `;
        if (comments.length > 0) {
            comments.forEach((comment, index) => {
                // --- 2a. 获取评论者头像 ---
                let commenterAvatarUrl = 'https://i.postimg.cc/PxZrFFFL/o-o-1.jpg'; // 默认路人头像
                if (comment.author === userNickname) {
                    commenterAvatarUrl = state.qzoneSettings.avatar;
                } else {
                    const commenterChar = Object.values(state.chats).find(c => c.name === comment.author);
                    if (commenterChar) {
                        commenterAvatarUrl = commenterChar.settings.aiAvatar;
                    }
                }

                // --- 2b. 处理回复 ---
                let replyHtml = '';
                if (comment.replyTo) {
                    replyHtml = `<span class="reply-text">回复</span> <span class="reply-target-name">${comment.replyTo}</span>`;
                }

                // --- 2c. 拼接单条评论的完整HTML ---
                commentsHtml += `
                <div class="post-comment-item" data-commenter-name="${comment.author}">
                    <img src="${commenterAvatarUrl}" class="comment-avatar-small">
                    <div class="comment-details">
                        <div class="comment-header-line">
                            <span class="comment-author">${comment.author}</span>
                            <span class="comment-floor">${index + 1}楼</span>
                        </div>
                        <div class="comment-content">
                            ${replyHtml}
                            <span class="comment-text">${(comment.content || '').replace(/\n/g, '<br>')}</span>
                        </div>
                    </div>
                </div>
            `;
            });
        } else {
            commentsHtml += '<p style="color: var(--text-secondary); font-size: 14px;">还没有评论，快来抢沙发！</p>';
        }
        commentsHtml += '</div>';

        // --- 3. 拼接帖子详情页的完整HTML ---
        contentEl.innerHTML = `
        <div class="post-detail-header">
            <img src="${authorAvatarUrl}" class="post-author-avatar">
            <div class="post-author-info">
                <h1>${post.title}</h1>
                <div class="post-detail-meta">
                    <span>作者: ${post.author}</span> | <span>发布于: ${new Date(
            post.timestamp,
        ).toLocaleString()}</span>
                </div>
            </div>
        </div>
        <div class="post-detail-body">${post.content.replace(/\n/g, '<br>')}</div>
        <div class="generate-comments-container">
            <button id="generate-forum-comments-btn">✨ 生成评论</button>
        </div>
        ${commentsHtml}
    `;

        // --- 4. 重新绑定评论的点击回复事件 (这部分逻辑保持不变) ---
        contentEl.querySelectorAll('.post-comment-item').forEach(item => {
            item.addEventListener('click', () => {
                const commenterName = item.dataset.commenterName;
                const myNickname = state.qzoneSettings.nickname || '我';
                if (commenterName !== myNickname) {
                    const commentInput = document.getElementById('post-comment-input');
                    commentInput.placeholder = `回复 ${commenterName}:`;
                    commentInput.dataset.replyTo = commenterName;
                    commentInput.focus();
                }
            });
        });
    }


    /**
     * 为论坛帖子生成“豆瓣风格”的评论
     */
    async function generateForumComments() {
        const postIdToCommentOn = activeForumPostId;
        if (!postIdToCommentOn) return;

        await showCustomAlert('请稍候...', '正在召唤资深豆友前来围观...');

        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) {
            alert('请先在API设置中配置好才能生成内容哦！');
            return;
        }

        const post = await db.forumPosts.get(postIdToCommentOn);
        const existingComments = await db.forumComments.where('postId').equals(postIdToCommentOn).toArray();
        const group = await db.forumGroups.get(post.groupId);


        const prompt = `
# 任务
你是一个专业的“豆瓣小组资深用户模拟器”。你的任务是为名为“${group.name
            }”的论坛小组里的一个帖子，生成5条全新的、非常“豆瓣风格”的评论。

# 帖子信息
- 标题: ${post.title}
- 内容: ${post.content.substring(0, 300)}...
- 已有评论:
${existingComments.map(c => `- ${c.author}: ${c.content}`).join('\n') || '(暂无评论)'}

# 【【【评论生成核心规则】】】
1.  **豆瓣风格**: 评论的语言风格必须非常地道，符合真实豆瓣网友的习惯。大量使用豆瓣黑话和网络用语，例如：
    - "同意楼上姐妹！"
    - "马了，感谢楼主分享"
    - "蹲一个后续"
    - "哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈" (大量的“哈”)
    - "这是可以说的吗？"
    - "码住"
    - "笑死，你是什么互联网嘴替"
    - "插眼"
    - "我先来，楼主好人一生平安"
2.  **互动性**: 生成的评论必须互相之间有互动。你可以回复楼主（作者: ${post.author}），也可以回复评论区的其他网友。
3.  **【【【昵称生成铁律】】】**: 评论者的昵称 ("author") 【必须】是你自己虚构的、随机的、生活化的、符合小组氛围的路人网友昵称。【绝对禁止】使用下方“公众人物列表”中的任何一个名字作为评论者。
4.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，数组中包含5个对象。每个对象【必须】包含 "author" 和 "content" 两个字段，如果需要回复别人，可以加上 "replyTo" 字段。

# 公众人物列表 (他们是讨论的对象，但不是发帖人)
${Object.values(state.chats)
                .filter(c => !c.isGroup)
                .map(c => `- ${c.name}`)
                .join('\n')}

# JSON输出格式示例:
[
  {
    "author": "早睡早起身体好",
    "content": "同意楼上哥哥的，这个确实是这样！"
  },
  {
    "author": "momo",
    "content": "哈哈哈哈哈哈哈哈哈哈这是可以说的吗",
    "replyTo": "早睡早起身体好"
  }
]
`;


        const messagesForApi = [{ role: 'user', content: prompt }];

        try {
            let isGemini = proxyUrl === GEMINI_API_URL;
            let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);
            const response = isGemini
                ? await fetch(geminiConfig.url, geminiConfig.data)
                : await fetch(`${proxyUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: model,
                        messages: messagesForApi,
                        temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                        response_format: { type: 'json_object' },
                    }),
                });
            if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
            const data = await response.json();
            const rawContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
            const cleanedContent = rawContent.replace(/^```json\s*|```$/g, '').trim();
            const newCommentsData = JSON.parse(cleanedContent);
            if (Array.isArray(newCommentsData) && newCommentsData.length > 0) {
                const commentsToAdd = newCommentsData.map((comment, index) => ({
                    postId: postIdToCommentOn,
                    author: comment.author || '路人',
                    content: comment.content,
                    replyTo: comment.replyTo || null,
                    timestamp: Date.now() + index,
                }));
                await db.forumComments.bulkAdd(commentsToAdd);
                await showCustomAlert('召唤成功！', `已成功召唤 ${commentsToAdd.length} 位豆友前来围观。`);
            } else {
                throw new Error('AI返回的数据格式不正确。');
            }
        } catch (error) {
            console.error('生成小组评论失败:', error);
            await showCustomAlert('生成失败', `发生了一个错误：\n${error.message}`);
        } finally {
            await renderPostDetails(postIdToCommentOn);
        }
    }

    /**
     * 为帖子添加新评论 (支持回复)
     */
    async function handleAddComment() {
        if (!activeForumPostId) return;
        const input = document.getElementById('post-comment-input');
        const content = input.value.trim();
        if (!content) {
            alert('评论内容不能为空！');
            return;
        }
        const newComment = {
            postId: activeForumPostId,
            author: state.qzoneSettings.nickname || '我',
            content: content,
            timestamp: Date.now(),
        };
        if (input.dataset.replyTo) {
            newComment.replyTo = input.dataset.replyTo;
        }
        await db.forumComments.add(newComment);
        input.value = '';
        input.placeholder = '发布你的评论...';
        delete input.dataset.replyTo;
        await renderPostDetails(activeForumPostId);
    }

    /**
     * 获取所有可用于同人创作的角色列表
     */
    function getAvailableCharacters() {
        const user = { id: 'user', name: state.qzoneSettings.nickname || '我' };
        const chars = Object.values(state.chats)
            .filter(c => !c.isGroup)
            .map(c => ({ id: c.id, name: c.name }));
        return [user, ...chars];
    }

    /**
     * 填充同人文小组的CP选择器
     */
    async function populateFanficSelectors() {
        const charList = getAvailableCharacters();
        const select1 = document.getElementById('fanfic-char1-select');
        const select2 = document.getElementById('fanfic-char2-select');
        select1.innerHTML = '';
        select2.innerHTML = '';
        charList.forEach(char => {
            const option1 = document.createElement('option');
            option1.value = char.name;
            option1.textContent = char.name;
            select1.appendChild(option1);
            const option2 = document.createElement('option');
            option2.value = char.name;
            option2.textContent = char.name;
            select2.appendChild(option2);
        });
        if (charList.length > 1) {
            select1.selectedIndex = 0;
            select2.selectedIndex = 1;
        }
    }


    async function handleGenerateGroupContent() {
        const groupIdToGenerateFor = window.activeGroupId;
        if (!groupIdToGenerateFor) return;

        const group = await db.forumGroups.get(groupIdToGenerateFor);
        if (!group) return;

        if (group.name === '梦角小组') {
            await generateDreamPost(groupIdToGenerateFor);
        } else if (group.name === '娱乐小组') {
            await generateEntertainmentGroupContent(groupIdToGenerateFor);
        } else if (group.name === '同人文小组') {
            await generateFanfic(groupIdToGenerateFor);
        } else {
            await generateForumContentWithAPI(groupIdToGenerateFor, group.name);
        }
    }

    /**
     * 为通用小组生成内容
     */
    async function generateForumContentWithAPI(groupId, groupName) {
        if (!groupId) return;

        // --- 1. 获取小组的世界观 ---
        const group = await db.forumGroups.get(groupId);
        if (!group) {
            alert('错误：找不到该小组！');
            return;
        }
        const worldview = group.worldview || '';

        await showCustomAlert('请稍候...', `AI正在为“${groupName}”小组寻找灵感...`);

        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) {
            alert('请先在API设置中配置好才能生成内容哦！');
            return;
        }

        let worldviewContext = '';
        if (worldview.trim()) {
            worldviewContext = `
# 小组专属世界观 (你必须严格遵守)
${worldview}
`;
        }

        const passerbyPostCount = 5;


        const prompt = `
# 任务
你是一个专业的“论坛内容生成器”。你的任务是为名为“${groupName}”的论坛小组，生成【${passerbyPostCount}条】全新的、有趣的、符合小组主题的帖子，并为每条帖子生成2-3条符合情景的评论。

${worldviewContext}

# 核心规则
1.  **主题相关**: 所有帖子的标题、内容和评论都必须与小组主题“${groupName}”高度相关。
2.  **【【【分类铁律】】】**: 你【必须】为每一条帖子，根据其【具体内容】，原创1-2个高度相关的分类标签。绝对不要使用任何预设的、固定的分类列表。
    - 例如，如果帖子是讨论设定的，分类可以是 ["设定讨论"]。
    - 如果帖子是分析剧情的，分类可以是 ["剧情分析"]。
    - 如果帖子是闲聊，分类可以是 ["闲聊水"]。
3.  **作者随机**: 每条帖子的作者都必须是你虚构的、符合小组氛围的路人网友。
4.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，数组中包含【${passerbyPostCount}个】帖子对象。每个对象【必须】包含 "author", "title", "content", "categories", 和 "comments" 字段。
    - "categories" 字段【必须】是你为这条帖子原创的分类数组。
    - "comments" 字段的值【必须】是一个对象数组，每个对象包含 "author" 和 "content" 字段。

# JSON输出格式示例:
[
  {
    "author": "早睡早起身体好",
    "title": "关于世界观里XX设定的一个疑问",
    "content": "我刚刚在看世界观设定，里面提到XX是蓝色的，但是在另一处又说是绿色的...",
    "categories": ["设定讨论", "剧情分析"],
    "comments": [
      {"author": "路人甲", "content": "我也发现了！蹲一个解答。"}
    ]
  }
]
`;


        const messagesForApi = [{ role: 'user', content: prompt }];

        try {
            let isGemini = proxyUrl === GEMINI_API_URL;
            let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);
            const response = isGemini
                ? await fetch(geminiConfig.url, geminiConfig.data)
                : await fetch(`${proxyUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: model,
                        messages: messagesForApi,
                        temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                        response_format: { type: 'json_object' },
                    }),
                });

            if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

            const data = await response.json();
            const rawContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
            const cleanedContent = rawContent.replace(/^```json\s*|```$/g, '').trim();
            const newPostsData = JSON.parse(cleanedContent);

            if (Array.isArray(newPostsData) && newPostsData.length > 0) {
                let totalPosts = 0;
                let totalComments = 0;
                for (const postData of newPostsData) {
                    // --- 3. 保存帖子时，也保存AI原创的分类 ---
                    const newPost = {
                        groupId: groupId,
                        title: postData.title,
                        content: postData.content,
                        author: postData.author,
                        timestamp: Date.now() + totalPosts,
                        categories: postData.categories || [], // 保存原创分类
                    };
                    const postId = await db.forumPosts.add(newPost);
                    totalPosts++;

                    if (postData.comments && Array.isArray(postData.comments)) {
                        const commentsToAdd = postData.comments
                            .map(comment => {
                                if (typeof comment === 'object' && comment !== null && comment.author && comment.content) {
                                    return {
                                        postId: postId,
                                        author: comment.author,
                                        content: comment.content,
                                        timestamp: Date.now() + totalPosts + totalComments++,
                                    };
                                }
                                return null;
                            })
                            .filter(Boolean);

                        if (commentsToAdd.length > 0) {
                            await db.forumComments.bulkAdd(commentsToAdd);
                        }
                    }
                }
                await showCustomAlert(
                    '生成成功！',
                    `已为“${groupName}”小组生成了 ${totalPosts} 条新帖子和 ${totalComments} 条评论。`,
                );
                await renderGroupPosts(groupId);
            } else {
                throw new Error('AI没有返回任何有效的数据。');
            }
        } catch (error) {
            console.error('生成小组内容失败:', error);
            await showCustomAlert('生成失败', `发生了一个错误：\n${error.message}`);
        }
    }

    async function generateFanfic(groupId) {
        if (!groupId) {
            console.error('generateFanfic called without a groupId!');
            alert('发生内部错误：生成同人时未能指定小组ID。');
            return;
        }
        const char1Name = document.getElementById('fanfic-char1-select').value;
        const char2Name = document.getElementById('fanfic-char2-select').value;

        // 获取分离后的参数
        const wordCountReq = document.getElementById('fanfic-wordcount-input').value.trim();
        const typeReq = document.getElementById('fanfic-type-input').value.trim(); // 类型：ABO, 甜文
        const styleReq = document.getElementById('fanfic-style-input').value.trim(); // 文风：细腻, 华丽
        const worldviewPreference = document.getElementById('fanfic-worldview-input').value.trim();

        if (char1Name === char2Name) {
            alert('请选择两个不同的角色！');
            return;
        }

        await showCustomAlert('正在创作...', `粉丝正在为【${char1Name}x${char2Name}】奋笔疾书中...`);

        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) {
            alert('请先配置API！');
            return;
        }

        const allChars = getAvailableCharacters();
        const char1Data = allChars.find(c => c.name === char1Name);
        const char2Data = allChars.find(c => c.name === char2Name);

        let char1Persona = '';
        let char2Persona = '';

        if (char1Name === state.qzoneSettings.nickname) {
            char1Persona = state.qzoneSettings.weiboUserPersona || '一个普通人';
        } else {
            char1Persona = state.chats[char1Data.id]?.settings.aiPersona || '一个普通人';
        }

        if (char2Name === state.qzoneSettings.nickname) {
            char2Persona = state.qzoneSettings.weiboUserPersona || '一个普通人';
        } else {
            char2Persona = state.chats[char2Data.id]?.settings.aiPersona || '一个普通人';
        }

        // 构建 Prompt
        let contextInstructions = '';

        if (typeReq) contextInstructions += `\n**【题材类型要求】**: 文章必须属于【${typeReq}】题材。`;
        if (styleReq) contextInstructions += `\n**【文风/写作规范】**: 请严格模仿【${styleReq}】的笔触和叙事风格。`;
        if (worldviewPreference) contextInstructions += `\n**【剧情/世界观设定】**: ${worldviewPreference}`;

        let lengthInstruction = wordCountReq ? `每篇故事字数需接近【${wordCountReq}】。` : '每篇故事不少于800字。';

        const prompt = `
你是一位专业的同人文写手。请根据以下要求，创作【三篇】关于角色A和角色B的同人故事。

# 角色信息
- 角色A (${char1Name}): ${char1Persona}
- 角色B (${char2Name}): ${char2Persona}

# 核心创作指令
${contextInstructions}
${lengthInstruction}

# 任务要求
1.  **创作三篇故事**: 必须符合上述的题材类型和文风规范。
2.  **原创分类**: 为每篇故事打上1-2个标签（例如：${typeReq || '甜文'}）。
3.  **生成评论**: 为每篇故事模拟3-5条读者评论。
4.  **JSON格式**: 你的回复【必须且只能】是一个纯净的JSON数组。

# JSON结构
[
  {
    "title": "故事标题1",
    "story": "故事内容1...",
    "categories": ["分类1", "分类2"],
    "comments": [
      {"author": "读者A", "content": "评论内容A..."},
      {"author": "读者B", "content": "评论内容B..."}
    ]
  },
  ...
]
`;

        const messagesForApi = [{ role: 'user', content: prompt }];
        try {
            let isGemini = proxyUrl === GEMINI_API_URL;
            let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);
            const response = isGemini
                ? await fetch(geminiConfig.url, geminiConfig.data)
                : await fetch(`${proxyUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: model,
                        messages: messagesForApi,
                        temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                        response_format: { type: 'json_object' },
                    }),
                });
            if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
            const data = await response.json();
            const rawContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
            let stories = [];
            try {
                const cleanedContent = rawContent.replace(/^```json\s*|```$/g, '').trim();
                stories = JSON.parse(cleanedContent);
                if (!Array.isArray(stories)) throw new Error('AI未返回数组格式。');
            } catch (e) {
                console.error('JSON解析失败！', e);
                throw new Error('AI返回了无效的JSON格式。');
            }
            for (let i = 0; i < stories.length; i++) {
                const storyData = stories[i];
                const newPost = {
                    groupId: groupId,
                    title: `【${char1Name}x${char2Name}】${storyData.title || `无题`}`,
                    content: storyData.story || '内容生成失败',
                    author: getRandomItem(['为爱发电的太太', '圈地自萌', 'CP是真的', '嗑拉了', '咕咕咕']),
                    timestamp: Date.now() + i,
                    categories: storyData.categories || [],
                };
                const postId = await db.forumPosts.add(newPost);
                if (storyData.comments && Array.isArray(storyData.comments)) {
                    const commentsToAdd = storyData.comments.map((c, idx) => ({
                        postId,
                        author: c.author || '匿名',
                        content: c.content,
                        timestamp: Date.now() + i + idx + 1,
                    }));
                    await db.forumComments.bulkAdd(commentsToAdd);
                }
            }
            await renderGroupPosts(groupId);
            await showCustomAlert('创作完成！', `已成功为你创作了 ${stories.length} 篇新的同人故事。`);
        } catch (error) {
            console.error('生成同人文失败:', error);
            await showCustomAlert('创作失败', `发生了一个错误：\n${error.message}`);
        }
    }


    /**
     * 打开创建帖子的模态框
     */
    async function openCreateForumPostModal() {
        resetCreatePostModal();
        const modal = document.getElementById('create-post-modal');
        modal.dataset.mode = 'forum';
        document.getElementById('create-post-modal-title').textContent = '发布新帖子';
        document.getElementById('post-public-text').placeholder = '请输入帖子内容...';

        // 隐藏所有不需要的控件
        modal.querySelector('.post-mode-switcher').style.display = 'none';
        modal.querySelector('#image-mode-content').style.display = 'none';
        modal.querySelector('#text-image-mode-content').style.display = 'none';
        modal.querySelector('#post-comments-toggle-group').style.display = 'none';
        modal.querySelector('#post-visibility-group').style.display = 'none';

        const publicTextGroup = document.getElementById('post-public-text').parentElement;

        // --- 动态添加或显示“标题”输入框 ---
        let titleGroup = document.getElementById('forum-post-title-group');
        if (!titleGroup) {
            titleGroup = document.createElement('div');
            titleGroup.className = 'form-group';
            titleGroup.id = 'forum-post-title-group';
            titleGroup.innerHTML = `
            <label for="forum-post-title-input">标题</label>
            <input type="text" id="forum-post-title-input" placeholder="请输入帖子标题...">
        `;
            publicTextGroup.parentNode.insertBefore(titleGroup, publicTextGroup);
        }
        document.getElementById('forum-post-title-input').value = '';


        let categoryGroup = document.getElementById('forum-post-category-group');
        if (!categoryGroup) {
            categoryGroup = document.createElement('div');
            categoryGroup.className = 'form-group';
            categoryGroup.id = 'forum-post-category-group';
            categoryGroup.innerHTML = `
            <label for="forum-post-category-input">帖子分类 (用#号分隔)</label>
            <input type="text" id="forum-post-category-input" placeholder="例如: #剧情讨论 #角色分析">
        `;
            // 将分类输入框插入到“内容”输入框之后
            publicTextGroup.parentNode.insertBefore(categoryGroup, publicTextGroup.nextSibling);
        }
        document.getElementById('forum-post-category-input').value = '';


        modal.classList.add('visible');
    }

    async function handleCreateForumPost() {
        const title = document.getElementById('forum-post-title-input').value.trim();
        const content = document.getElementById('post-public-text').value.trim();
        if (!title || !content) {
            alert('帖子标题和内容都不能为空哦！');
            return;
        }

        const categoryInput = document.getElementById('forum-post-category-input').value.trim();
        const categories = categoryInput ? categoryInput.match(/#(\S+)/g)?.map(tag => tag.substring(1)) || [] : [];

        const newPost = {
            groupId: window.activeGroupId,
            title: title,
            content: content,
            author: state.qzoneSettings.nickname || '我',
            timestamp: Date.now(),
            categories: categories,
        };


        const postId = await db.forumPosts.add(newPost);
        // 2. 将这个ID赋值回我们的 newPost 对象
        newPost.id = postId;

        // 3. 关闭发帖弹窗。
        document.getElementById('create-post-modal').classList.remove('visible');

        // 4. 将新帖子显示在列表顶部
        prependNewPostElement(newPost);

        // 5. 给出成功提示。
        alert('帖子发布成功！');
    }

    /**
     * 删除一个小组及其所有内容
     */
    async function deleteGroupAndPosts(groupId) {
        const group = await db.forumGroups.get(groupId);
        if (!group) return;
        const confirmed = await showCustomConfirm(
            '确认删除',
            `确定要删除小组“${group.name}”吗？此操作将同时删除该小组内的【所有帖子和评论】，且无法恢复！`,
            { confirmButtonClass: 'btn-danger' },
        );
        if (confirmed) {
            try {
                const postsToDelete = await db.forumPosts.where('groupId').equals(groupId).toArray();
                const postIds = postsToDelete.map(p => p.id);
                if (postIds.length > 0) {
                    await db.forumComments.where('postId').anyOf(postIds).delete();
                }
                await db.forumPosts.where('groupId').equals(groupId).delete();
                await db.forumGroups.delete(groupId);
                await renderForumScreen();
                alert(`小组“${group.name}”及其所有内容已删除。`);
            } catch (error) {
                console.error('删除小组时出错:', error);
                alert(`删除失败: ${error.message}`);
            }
        }
    }

    /**
     * "转载"功能：将帖子内容分享到单聊或群聊
     */
    async function repostToChat() {
        if (!activeForumPostId) return;
        const post = await db.forumPosts.get(activeForumPostId);
        if (!post) {
            alert('找不到要转载的帖子！');
            return;
        }

        // 打开分享目标选择弹窗
        const modal = document.getElementById('share-target-modal');
        const listEl = document.getElementById('share-target-list');
        listEl.innerHTML = '';

        const allChats = Object.values(state.chats);

        if (allChats.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">暂无聊天对象</p>';
        } else {
            allChats.forEach(chat => {
                const item = document.createElement('div');
                item.className = 'contact-picker-item'; // 复用联系人选择器的样式

                // 根据是群聊还是单聊，显示不同的头像和标签
                const avatarUrl = chat.isGroup
                    ? chat.settings.groupAvatar || defaultGroupAvatar
                    : chat.settings.aiAvatar || defaultAvatar;

                const typeLabel = chat.isGroup
                    ? '<span style="font-size:10px; color:white; background:#007bff; padding:1px 4px; border-radius:4px; margin-left:5px;">群聊</span>'
                    : '';

                item.innerHTML = `
            <input type="radio" name="repost-target" value="${chat.id}" id="target-${chat.id}" style="margin-right: 15px;">
            <label for="target-${chat.id}" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                <img src="${avatarUrl}" class="avatar">
                <span class="name">${chat.name} ${typeLabel}</span>
            </label>
        `;
                listEl.appendChild(item);
            });
        }

        document.getElementById('share-target-modal-title').textContent = '转载帖子到...';
        modal.classList.add('visible');

        // 确认按钮的事件监听
        const confirmBtn = document.getElementById('confirm-share-target-btn');
        // 使用克隆节点技巧清除旧监听器
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        newConfirmBtn.onclick = async () => {
            const selectedRadio = document.querySelector('input[name="repost-target"]:checked');
            if (!selectedRadio) {
                alert('请选择一个要转载到的聊天！');
                return;
            }

            const targetChatId = selectedRadio.value;
            const targetChat = state.chats[targetChatId];
            if (!targetChat) return;

            const myNickname = targetChat.isGroup ? targetChat.settings.myNickname || '我' : '我';

            // 1. 创建对用户可见的转载卡片消息
            const repostMessage = {
                role: 'user',
                senderName: myNickname, // 确保群聊里显示正确的发送者名字
                type: 'repost_forum_post',
                timestamp: Date.now(),
                content: `[转载的帖子]\nID为${post.id}\n标题: 《${post.title}》\n作者: ${post.author}\n内容: ${post.content}\n请对这个帖子发表评论。`,
                payload: {
                    postId: post.id,
                    title: post.title,
                    author: post.author,
                    content: post.content.substring(0, 100) + '...',
                },
            };
            targetChat.history.push(repostMessage);


            // 修改提示词以适应群聊场景（群聊AI会自动决定谁来回复）
            const instructionContent = targetChat.isGroup
                ? `[系统指令：用户(${myNickname})刚刚向群里转载了一个ID为【${post.id}】的小组帖子，内容如下。群里的成员们【必须】阅读该帖子，并根据各自的人设，使用 'forum_comment' 指令对帖子发表评论或讨论。]\n\n--- 帖子开始 ---\n标题: ${post.title}\n作者: ${post.author}\n内容: ${post.content}\n--- 帖子结束 ---`
                : `[系统指令：用户刚刚向你分享了一个ID为【${post.id}】的小组帖子，内容如下。你的任务是【必须】对这个帖子发表评论。请【立刻】使用 'forum_comment' 指令完成此任务，并确保在指令中包含正确的 "postId": ${post.id}。]\n\n--- 帖子开始 ---\n标题: ${post.title}\n作者: ${post.author}\n内容: ${post.content}\n--- 帖子结束 ---`;

            const hiddenInstructionMessage = {
                role: 'system',
                content: instructionContent,
                timestamp: Date.now() + 1,
                isHidden: true,
            };
            targetChat.history.push(hiddenInstructionMessage);

            // 3. 保存、关闭弹窗、跳转
            await db.chats.put(targetChat);
            modal.classList.remove('visible');

            await showCustomAlert('转载成功', `已成功将帖子转载给“${targetChat.name}”！`);

            // 跳转到对应的聊天界面
            openChat(targetChatId);
            // 自动触发AI响应（对于群聊，这会触发群友讨论帖子）
            triggerAiResponse();
        };
    }
    // --- 同人文预设与UI逻辑 ---

    // 初始化/加载同人文预设
    async function loadFanficPresets() {
        const select = document.getElementById('fanfic-preset-select');
        select.innerHTML = '<option value="">-- 选择预设 --</option>';

        // 确保全局设置里有这个字段
        if (!state.globalSettings.fanficPresets) {
            state.globalSettings.fanficPresets = [];
        }

        state.globalSettings.fanficPresets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = index; // 使用索引作为 value
            option.textContent = preset.name;
            select.appendChild(option);
        });
    }

    async function saveCurrentFanficPreset() {
        const name = await showCustomPrompt('保存预设', '请为当前配置起个名字：');
        if (!name) return;

        const preset = {
            name: name.trim(),
            char1: document.getElementById('fanfic-char1-select').value,
            char2: document.getElementById('fanfic-char2-select').value,
            wordCount: document.getElementById('fanfic-wordcount-input').value,
            type: document.getElementById('fanfic-type-input').value, // 新增：类型
            style: document.getElementById('fanfic-style-input').value, // 新增：文风
            worldview: document.getElementById('fanfic-worldview-input').value,
        };

        if (!state.globalSettings.fanficPresets) state.globalSettings.fanficPresets = [];
        state.globalSettings.fanficPresets.push(preset);

        await db.globalSettings.put(state.globalSettings);
        await loadFanficPresets();

        document.getElementById('fanfic-preset-select').value = state.globalSettings.fanficPresets.length - 1;
        alert('预设保存成功！');
    }

    function applyFanficPreset() {
        const index = document.getElementById('fanfic-preset-select').value;
        if (index === '') return;

        const preset = state.globalSettings.fanficPresets[index];
        if (preset) {
            document.getElementById('fanfic-char1-select').value = preset.char1;
            document.getElementById('fanfic-char2-select').value = preset.char2;
            document.getElementById('fanfic-wordcount-input').value = preset.wordCount || '';
            document.getElementById('fanfic-type-input').value = preset.type || ''; // 回填类型
            document.getElementById('fanfic-style-input').value = preset.style || ''; // 回填文风
            document.getElementById('fanfic-worldview-input').value = preset.worldview || '';
        }
    }

    // 删除选中的预设
    async function deleteFanficPreset() {
        const index = document.getElementById('fanfic-preset-select').value;
        if (index === '') return;

        const confirmed = await showCustomConfirm('确认删除', '确定要删除这个预设吗？');
        if (confirmed) {
            state.globalSettings.fanficPresets.splice(index, 1);
            await db.globalSettings.put(state.globalSettings);
            await loadFanficPresets();

            // 清空输入框
            document.getElementById('fanfic-wordcount-input').value = '';
            document.getElementById('fanfic-style-input').value = '';
            document.getElementById('fanfic-worldview-input').value = '';
        }
    }

    // 切换折叠状态
    function toggleFanficBar() {
        const content = document.getElementById('fanfic-bar-content');
        const icon = document.getElementById('fanfic-bar-toggle-icon');

        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            icon.classList.remove('collapsed');
        } else {
            content.classList.add('collapsed');
            icon.classList.add('collapsed');
        }
    }

    /**
     * 打开小组编辑器 (支持图片URL)
     */
    async function openGroupEditor(groupId) {
        editingGroupId = groupId;
        const group = await db.forumGroups.get(groupId);
        if (!group) return;

        document.getElementById('group-editor-name-input').value = group.name;
        document.getElementById('group-editor-desc-input').value = group.description;

        const iconInput = document.getElementById('group-editor-icon-input');
        iconInput.value = group.icon;
        // 修改输入框上方的 label 文字（通过修改 DOM 或设置 placeholder）
        iconInput.placeholder = '输入图片链接(URL) 或 Emoji';
        // 找到它前面的 label 元素并修改文字
        const iconLabel = document.querySelector('label[for="group-editor-icon-input"]');
        if (iconLabel) iconLabel.textContent = '小组封面 (图片URL / Emoji)';

        document.getElementById('group-editor-worldview-input').value = group.worldview || '';

        const categoriesString = (group.categories || []).map(c => `#${c}`).join(' ');
        document.getElementById('group-editor-categories-input').value = categoriesString;

        document.getElementById('forum-group-editor-modal').classList.add('visible');
    }

    /**
     * 保存对小组信息的修改
     */
    async function saveGroupSettings() {
        if (!editingGroupId) return;

        const name = document.getElementById('group-editor-name-input').value.trim();
        if (!name) {
            alert('小组名称不能为空！');
            return;
        }

        const description = document.getElementById('group-editor-desc-input').value.trim();
        const icon = document.getElementById('group-editor-icon-input').value.trim();
        const worldview = document.getElementById('group-editor-worldview-input').value.trim();
        const categoriesInput = document.getElementById('group-editor-categories-input').value.trim();
        // 解析分类字符串
        const categories = categoriesInput ? categoriesInput.match(/#(\S+)/g)?.map(tag => tag.substring(1)) || [] : [];

        await db.forumGroups.update(editingGroupId, { name, description, icon, worldview, categories });

        document.getElementById('forum-group-editor-modal').classList.remove('visible');
        await renderForumScreen();
        alert('小组信息已更新！');
    }

    /**
     * 打开分类管理弹窗
     */
    async function openForumCategoryManager() {
        await renderForumCategoryList();
        document.getElementById('forum-category-manager-modal').classList.add('visible');
    }

    /**
     * 在弹窗中渲染分类列表
     */
    async function renderForumCategoryList() {
        const listEl = document.getElementById('existing-forum-categories-list');
        const categories = await db.forumCategories.toArray();
        listEl.innerHTML = '';
        if (categories.length === 0) {
            listEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">还没有任何分类</p>';
        }
        categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'existing-group-item';
            item.innerHTML = `
            <span class="group-name">${cat.name}</span>
            <span class="delete-group-btn" data-id="${cat.id}">×</span>
        `;
            listEl.appendChild(item);
        });
    }

    /**
     * 添加一个新的圈子分类
     */
    async function addNewForumCategory() {
        const input = document.getElementById('new-forum-category-name-input');
        const name = input.value.trim();
        if (!name) {
            alert('分类名不能为空！');
            return;
        }
        const existing = await db.forumCategories.where('name').equals(name).first();
        if (existing) {
            alert(`分类 "${name}" 已经存在了！`);
            return;
        }
        await db.forumCategories.add({ name });
        input.value = '';
        await renderForumCategoryList();
    }

    /**
     * 删除一个圈子分类
     */
    async function deleteForumCategory(categoryId) {
        const confirmed = await showCustomConfirm('确认删除', '确定要删除这个分类吗？', {
            confirmButtonClass: 'btn-danger',
        });
        if (confirmed) {
            await db.forumCategories.delete(categoryId);
            await renderForumCategoryList();
        }
    }
    async function openGroupCreator() {
        const name = await showCustomPrompt('创建新小组', '请输入小组名称：');
        if (!name || !name.trim()) {
            if (name !== null) alert('小组名称不能为空！');
            return;
        }

        const desc = await showCustomPrompt('小组描述', '为你的小组写一句简介吧：');
        if (desc === null) return;

        // ★★★ 修改：提示输入 URL ★★★
        const icon = await showCustomPrompt('小组封面', '请输入图片链接 (URL)：\n(留空则使用默认图标)', '', 'url');
        if (icon === null) return;

        try {
            const newGroup = {
                name: name.trim(),
                description: desc.trim(),
                icon: icon.trim(), // 存入URL
            };
            await db.forumGroups.add(newGroup);
            await renderForumScreen();
            alert(`小组“${name.trim()}”创建成功！`);
        } catch (error) {
            console.error('创建小组失败:', error);
            alert(`创建失败: ${error.message}`);
        }
    }

    /**
     * 删除一个小组
     * @param {number} groupId - 要删除的小组的ID
     */
    async function deleteGroupAndPosts(groupId) {
        const group = await db.forumGroups.get(groupId);
        if (!group) return;

        const confirmed = await showCustomConfirm(
            '确认删除',
            `确定要删除小组“${group.name}”吗？此操作将同时删除该小组内的【所有帖子和评论】，且无法恢复！`,
            { confirmButtonClass: 'btn-danger' },
        );

        if (confirmed) {
            try {
                // 1. 找到该小组下的所有帖子
                const postsToDelete = await db.forumPosts.where('groupId').equals(groupId).toArray();
                const postIds = postsToDelete.map(p => p.id);

                // 2. 如果有帖子，就找到这些帖子下的所有评论并删除
                if (postIds.length > 0) {
                    await db.forumComments.where('postId').anyOf(postIds).delete();
                }

                // 3. 删除所有帖子
                await db.forumPosts.where('groupId').equals(groupId).delete();

                // 4. 最后删除小组本身
                await db.forumGroups.delete(groupId);

                await renderForumScreen(); // 刷新列表
                alert(`小组“${group.name}”及其所有内容已删除。`);
            } catch (error) {
                console.error('删除小组时出错:', error);
                alert(`删除失败: ${error.message}`);
            }
        }
    }

    async function generateEntertainmentGroupContent(groupId) {
        if (!groupId) return;

        await showCustomAlert('请稍候...', '娱乐小组正在紧急开会讨论最新热点...');

        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) {
            alert('请先在API设置中配置好才能生成内容哦！');
            return;
        }

        const publicFigures = Object.values(state.chats)
            .filter(c => !c.isGroup)
            .map(c => ({
                name: c.name,
                profession: c.settings.weiboProfession || '艺人',
                persona: (c.settings.weiboInstruction || c.settings.aiPersona).substring(0, 150),
            }));

        let topicsContext = '';
        if (weiboHotSearchCache && weiboHotSearchCache.length > 0) {
            topicsContext = `请围绕以下【当前最新的微博热搜话题】展开讨论：\n${weiboHotSearchCache
                .map(t => `- ${t.topic}`)
                .join('\n')}`;
        } else {
            topicsContext = `请你根据下方“公众人物列表”中各个角色的【职业和人设】，为他们创造一些符合身份的、可能引发讨论的娱乐新闻或八卦事件作为讨论主题。`;
        }


        const prompt = `
# 任务
你是一个专业的“豆瓣娱乐小组资深用户模拟器”。你的任务是根据一个热门娱乐主题，生成5个帖子和对应的评论，模拟小组内的真实讨论氛围。

# 当前讨论主题
${topicsContext}

# 核心规则
1.  **豆瓣风格铁律**: 所有帖子的标题、内容和评论都【必须】是地道的“豆瓣小组”风格。
2.  **【【【分类铁律】】】**: 你【必须】为每一个帖子，根据其八卦内容，【原创】1-2个高度相关的分类标签。绝对不要使用任何预设列表。例如，如果帖子是关于恋情的，分类可以是 ["恋情瓜"]。
3.  **角色扮演铁律**: 你生成的帖子内容可以【讨论或提及】下方的公众人物，但【不能扮演他们】亲自发帖。所有帖子都必须是路人视角。
4.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON数组，包含5个帖子对象。每个对象【必须】包含 "author", "title", "content", "categories", 和 "comments" 字段。
    - "categories" 字段【必须】是你为这篇帖子原创的分类数组。

# 公众人物列表 (他们是讨论的对象，但不是发帖人)
${JSON.stringify(publicFigures, null, 2)}

# JSON输出格式示例:
[
  {
    "author": "momo",
    "title": "不懂就问，最近那个热搜上的剧真的好看吗？",
    "content": "首页天天刷到，有点好奇但又怕踩雷...",
    "categories": ["新剧讨论"],
    "comments": [
      {"author": "已注销", "content": "不好看，别去。"}
    ]
  }
]
`;


        const messagesForApi = [{ role: 'user', content: prompt }];

        try {
            let isGemini = proxyUrl === GEMINI_API_URL;
            let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

            const response = isGemini
                ? await fetch(geminiConfig.url, geminiConfig.data)
                : await fetch(`${proxyUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: model,
                        messages: messagesForApi,
                        temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                        response_format: { type: 'json_object' },
                    }),
                });

            if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

            const data = await response.json();
            const rawContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
            const cleanedContent = rawContent.replace(/^```json\s*|```$/g, '').trim();
            const newPostsData = JSON.parse(cleanedContent);

            if (Array.isArray(newPostsData) && newPostsData.length > 0) {
                let totalPosts = 0;
                let totalComments = 0;
                for (const postData of newPostsData) {

                    const newPost = {
                        groupId: groupId,
                        title: postData.title,
                        content: postData.content,
                        author: postData.author,
                        timestamp: Date.now() + totalPosts,
                        categories: postData.categories || [], // 保存分类
                    };


                    const postId = await db.forumPosts.add(newPost);
                    totalPosts++;

                    if (postData.comments && Array.isArray(postData.comments)) {
                        const commentsToAdd = postData.comments.map(comment => ({
                            postId: postId,
                            author: comment.author,
                            content: comment.content,
                            timestamp: Date.now() + totalPosts + totalComments++,
                        }));
                        if (commentsToAdd.length > 0) {
                            await db.forumComments.bulkAdd(commentsToAdd);
                        }
                    }
                }
                await renderGroupPosts(groupId);
                await showCustomAlert('生成成功！', `已为娱乐小组生成了 ${totalPosts} 条新帖子和 ${totalComments} 条评论。`);
            } else {
                throw new Error('AI返回的数据格式不正确。');
            }
        } catch (error) {
            console.error('生成娱乐小组内容失败:', error);
            await showCustomAlert('生成失败', `发生了一个错误：\n${error.message}`);
        }
    }

    /**
     * 为“梦角小组”生成专属帖子的核心函数
     */
    async function generateDreamPost(groupId) {
        await showCustomAlert('请稍候...', '正在为user编织一个甜蜜的梦境...');

        const { proxyUrl, apiKey, model } = state.apiConfig;
        if (!proxyUrl || !apiKey || !model) {
            alert('请先在API设置中配置好才能生成内容哦！');
            return;
        }

        const allChars = Object.values(state.chats).filter(c => !c.isGroup);
        if (allChars.length === 0) {
            alert('还没有任何角色，无法发布梦境哦。');
            return;
        }

        const postingChar = allChars[Math.floor(Math.random() * allChars.length)];
        const userPersona = state.qzoneSettings.persona || '一个普通的、温柔的人。';
        const userNickname = state.qzoneSettings.nickname || '{{user}}';


        const prompt = `
# 任务：角色扮演与帖子创作（带评论和分类）
你现在【就是】角色“${postingChar.name}”。你正在一个名为“梦角小组”的秘密论坛里。
这个小组是你们这些角色，偷偷向彼此炫耀、倾诉对你们的共同爱人——用户“${userNickname}”——的爱意和幻想的地方。

# 核心规则
1.  **第一人称视角**: 你【必须】使用角色“${postingChar.name}”的第一人称视角来写作帖子正文。
2.  **帖子主题**: 你的帖子内容是你对你的爱人“${userNickname}”的爱意表达或幻想。
3.  **【【【分类铁律】】】**: 你【必须】根据梦境的具体内容，为这篇帖子【原创】1-2个高度相关的分类标签。绝对不要使用任何预设列表。例如，如果内容是甜蜜的日常，分类可以是 ["甜蜜日常"]。
4.  **评论生成**: 在创作完帖子后，你还需要立刻切换到“其他小组成员”的视角，为这篇帖子生成【2-3条】符合情景的评论。
5.  **格式铁律**: 你的回复【必须且只能】是一个严格的JSON对象，包含 "title", "content", "categories", 和 "comments" 字段。
    - "categories" 字段【必须】是你为这篇帖子原创的分类数组。

# 你的信息
-   你的名字: ${postingChar.name}
-   你的人设: ${postingChar.settings.aiPersona}

# 你的爱人信息
-   爱人的名字: ${userNickname}
-   爱人的人设: ${userPersona}

# JSON输出格式示例:
{
  "title": "关于他睡觉时的小习惯",
  "content": "偷偷告诉你们，${userNickname}睡觉的时候喜欢抱着枕头的一角...",
  "categories": ["甜蜜日常", "小习惯"],
  "comments": [
    {"author": "路人A", "content": "哇，好甜！"}
  ]
}
`;


        const messagesForApi = [{ role: 'user', content: prompt }];

        try {
            let isGemini = proxyUrl === GEMINI_API_URL;
            let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

            const response = isGemini
                ? await fetch(geminiConfig.url, geminiConfig.data)
                : await fetch(`${proxyUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: model,
                        messages: messagesForApi,
                        temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                        response_format: { type: 'json_object' },
                    }),
                });

            if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

            const data = await response.json();
            const rawContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
            const cleanedContent = rawContent.replace(/^```json\s*|```$/g, '').trim();
            const postData = JSON.parse(cleanedContent);

            if (postData.title && postData.content) {

                const newPost = {
                    groupId: groupId,
                    title: postData.title,
                    content: postData.content,
                    author: postingChar.name,
                    timestamp: Date.now(),
                    categories: postData.categories || [], // 保存分类
                };


                const postId = await db.forumPosts.add(newPost);

                if (postData.comments && Array.isArray(postData.comments)) {
                    const commentsToAdd = postData.comments.map((c, i) => ({
                        postId,
                        author: c.author,
                        content: c.content,
                        timestamp: Date.now() + i + 1,
                    }));
                    await db.forumComments.bulkAdd(commentsToAdd);
                }

                await renderGroupPosts(groupId);
                await showCustomAlert('发布成功！', `“${postingChar.name}”发布了一条新的梦境。`);
            } else {
                throw new Error('AI返回的数据格式不正确。');
            }
        } catch (error) {
            console.error('生成梦角帖子失败:', error);
            await showCustomAlert('生成失败', `发生了一个错误：\n${error.message}`);
        }
    }


    /**
     * 打开分类筛选模态框
     * @param {'global' | 'group'} type - 筛选类型：'global'为主页筛选小组，'group'为小组内筛选帖子
     * @param {number|null} id - 如果是小组内筛选，则为小组的ID
     */
    async function openForumFilterModal(type, id = null) {
        currentFilterContext = { type, id };
        const modal = document.getElementById('forum-filter-modal');
        const listEl = document.getElementById('forum-filter-category-list');
        listEl.innerHTML = '';


        let availableCategories = new Set(); // 使用Set来自动去重

        try {
            if (type === 'global') {

                console.log('正在为小组列表收集分类...');
                const allGroups = await db.forumGroups.toArray();
                allGroups.forEach(group => {
                    if (group.categories) {
                        group.categories.forEach(cat => availableCategories.add(cat));
                    }
                });
            } else if (type === 'group' && id) {

                console.log(`正在为小组 ID: ${id} 的帖子列表收集分类...`);
                const postsInGroup = await db.forumPosts.where('groupId').equals(id).toArray();
                postsInGroup.forEach(post => {
                    if (post.categories) {
                        post.categories.forEach(cat => availableCategories.add(cat));
                    }
                });
            }
        } catch (error) {
            console.error('收集分类标签时出错:', error);
        }


        const categoryArray = Array.from(availableCategories).sort(); // 转换为数组并排序

        if (categoryArray.length === 0) {
            listEl.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">当前没有任何可用的分类标签。</p>';
        } else {
            const activeFilters = type === 'global' ? activeForumFilters.global : activeForumFilters.group[id] || [];

            categoryArray.forEach((catName, index) => {
                const isChecked = activeFilters.includes(catName);
                const label = document.createElement('label');
                const inputId = `filter-cat-${type}-${index}`; // 创建唯一的ID
                label.setAttribute('for', inputId);
                label.innerHTML = `
                <input type="checkbox" id="${inputId}" value="${catName}" ${isChecked ? 'checked' : ''}>
                <span>${catName}</span>
            `;
                listEl.appendChild(label);
            });
        }

        modal.classList.add('visible');
    }


    /**
     * 应用筛选条件并刷新列表
     */
    async function applyForumFilter() {
        const { type, id } = currentFilterContext;
        const selectedCategories = Array.from(document.querySelectorAll('#forum-filter-category-list input:checked')).map(
            cb => cb.value,
        );

        const filterBtnId = type === 'global' ? 'forum-filter-btn' : 'group-filter-btn';
        const filterBtn = document.getElementById(filterBtnId);

        if (type === 'global') {
            activeForumFilters.global = selectedCategories;
            await renderForumScreen();
        } else if (type === 'group' && id) {
            if (!activeForumFilters.group[id]) activeForumFilters.group[id] = [];
            activeForumFilters.group[id] = selectedCategories;
            await renderGroupPosts(id);
        }

        // 根据是否应用了筛选，更新图标状态
        if (selectedCategories.length > 0) {
            filterBtn.classList.add('active');
        } else {
            filterBtn.classList.remove('active');
        }

        document.getElementById('forum-filter-modal').classList.remove('visible');
    }

    // 论坛功能事件监听器

    // 2. 当用户点击“圈子”App图标时，渲染小组列表
    document
        .querySelector('.desktop-app-icon[onclick="showScreen(\'forum-screen\')"]')
        .addEventListener('click', renderForumScreen);

    // 3. 绑定小组页和帖子页的返回按钮
    document.getElementById('back-to-forum-list').addEventListener('click', () => showScreen('forum-screen'));
    document
        .getElementById('back-to-group-screen')
        .addEventListener('click', () =>
            openGroup(window.activeGroupId, document.getElementById('group-screen-title').textContent),
        );

    // 4. 绑定帖子评论区的发送按钮
    document.getElementById('send-post-comment-btn').addEventListener('click', handleAddComment);

    // 绑定所有小组头部通用的“生成”按钮
    document.getElementById('generate-group-content-btn').addEventListener('click', handleGenerateGroupContent);


    // 6. 绑定帖子详情页的“转载”按钮
    document.getElementById('repost-to-chat-btn').addEventListener('click', repostToChat);


    document.getElementById('create-group-btn').addEventListener('click', openGroupCreator);

    document.getElementById('create-forum-post-btn').addEventListener('click', () => {

        openCreateForumPostModal();
    });

    // 使用事件委托，为帖子详情页的“生成评论”按钮绑定事件
    document.getElementById('post-detail-content').addEventListener('click', e => {
        if (e.target.id === 'generate-forum-comments-btn') {
            generateForumComments();
        }
    });

    // 在用户手动输入评论后，如果输入框为空就失去焦点时，自动取消回复状态
    document.getElementById('post-comment-input').addEventListener('blur', e => {
        const input = e.target;
        if (input.value.trim() === '') {
            input.placeholder = '发布你的评论...';
            delete input.dataset.replyTo;
        }
    });

    document.getElementById('chat-messages').addEventListener('click', e => {
        const repostCard = e.target.closest('.link-share-card[data-post-id]');
        if (repostCard) {
            const postId = parseInt(repostCard.dataset.postId);
            if (!isNaN(postId)) {
                // 调用你已经写好的“打开帖子”函数
                openPost(postId);
            }
        }
    });

    // 【全新】论坛帖子列表事件委托
    document.getElementById('group-post-list').addEventListener('click', async e => {
        const postItem = e.target.closest('.forum-post-item');
        if (!postItem) return;

        // 检查点击的是否是删除按钮
        if (e.target.classList.contains('forum-post-delete-btn')) {
            const postId = postItem.dataset.postId;
            if (!postId) return;

            const post = await db.forumPosts.get(parseInt(postId));
            if (!post) return;

            const confirmed = await showCustomConfirm(
                '删除帖子',
                `确定要删除帖子《${post.title}》吗？此操作将同时删除帖子下的所有评论，且无法恢复。`,
                { confirmButtonClass: 'btn-danger' },
            );

            if (confirmed) {
                try {
                    // 使用数据库事务来确保帖子和评论被同时删除
                    await db.transaction('rw', db.forumPosts, db.forumComments, async () => {
                        // 1. 删除所有与该帖子关联的评论
                        await db.forumComments.where('postId').equals(parseInt(postId)).delete();
                        // 2. 删除帖子本身
                        await db.forumPosts.delete(parseInt(postId));
                    });

                    await showCustomAlert('删除成功', '帖子及其所有评论已被删除。');
                    // 刷新帖子列表
                    await renderGroupPosts(activeGroupId);
                } catch (error) {
                    console.error('删除帖子失败:', error);
                    await showCustomAlert('删除失败', `操作失败: ${error.message}`);
                }
            }
        } else {
            // 如果点击的不是删除按钮，那就是点击了帖子本身，执行跳转逻辑
            const postId = postItem.dataset.postId;
            if (postId) {
                openPost(parseInt(postId));
            }
        }
    });

    // 圈子/小组高级功能事件监听

    // 1. 为“圈子”主页右上角的“+”按钮，绑定创建小组的事件
    document.getElementById('create-group-btn').addEventListener('click', openGroupCreator);

    // 2. 为小组编辑器弹窗的“保存”和“取消”按钮绑定事件
    document.getElementById('save-group-editor-btn').addEventListener('click', saveGroupSettings);
    document.getElementById('cancel-group-editor-btn').addEventListener('click', () => {
        document.getElementById('forum-group-editor-modal').classList.remove('visible');
    });

    // 3. 为分类管理弹窗的按钮绑定事件
    document.getElementById('add-new-forum-category-btn').addEventListener('click', addNewForumCategory);
    document.getElementById('close-forum-category-manager-btn').addEventListener('click', () => {
        document.getElementById('forum-category-manager-modal').classList.remove('visible');
    });

    // 4. 使用事件委托，为分类列表中的“删除”按钮绑定事件
    document.getElementById('existing-forum-categories-list').addEventListener('click', e => {
        if (e.target.classList.contains('delete-group-btn')) {
            // 复用样式
            const categoryId = parseInt(e.target.dataset.id);
            deleteForumCategory(categoryId);
        }
    });

    // 圈子/小组分类筛选功能事件监听
    // 1. 绑定主页和小组页的筛选按钮
    document.getElementById('forum-filter-btn').addEventListener('click', () => openForumFilterModal('global'));
    // 筛选按钮
    document.getElementById('group-filter-btn').addEventListener('click', () => {
        openForumFilterModal('group', window.activeGroupId);
    });

    // 2. 绑定筛选弹窗内的按钮
    document.getElementById('apply-forum-filter-btn').addEventListener('click', applyForumFilter);
    document.getElementById('cancel-forum-filter-btn').addEventListener('click', () => {
        document.getElementById('forum-filter-modal').classList.remove('visible');
    });
    document.getElementById('reset-forum-filter-btn').addEventListener('click', async () => {
        // 清空复选框并应用
        document.querySelectorAll('#forum-filter-category-list input:checked').forEach(cb => (cb.checked = false));
        await applyForumFilter();
    });

    // --- 同人文控制台事件绑定 ---
    document.getElementById('fanfic-bar-header').addEventListener('click', toggleFanficBar);

    document.getElementById('save-fanfic-preset-btn').addEventListener('click', saveCurrentFanficPreset);

    document.getElementById('delete-fanfic-preset-btn').addEventListener('click', deleteFanficPreset);

    document.getElementById('fanfic-preset-select').addEventListener('change', applyFanficPreset);


});
