import { db } from './firebase-config.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
    doc, updateDoc, increment, arrayUnion, arrayRemove, getDoc, getDocs, setDoc, deleteDoc,
    where, getCountFromServer 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function getCurrentUser() {
    const u = JSON.parse(localStorage.getItem('depressDoomerUser'));
    if (u && u.email === 'mentalistwuwi@gmail.com' && !u.adminRoles) {
        u.adminRoles = { view_reports: true, view_identities: true, isSuperAdmin: true };
    }
    return u;
}

const user = getCurrentUser();
const isAdmin = user && user.adminRoles;
const isReadOnly = user && user.banStatus === "read_only";

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

if (user && user.adminRoles) {
    if (typeof window.injectAdminLink === 'function') window.injectAdminLink();
}

// ----------------------------------------------------
// MENTION AUTO-SUGGEST POPUP LOGIC
// ----------------------------------------------------
const mentionStyle = document.createElement('style');
mentionStyle.innerHTML = `
    .mention-suggestions { background: #1a1a2e; border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); overflow-y: auto; z-index: 1000; }
    .mention-suggestions::-webkit-scrollbar { width: 5px; }
    .mention-suggestions::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 5px; }
    .mention-item { padding: 0.8rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); color: #e7e9ea; font-size: 0.95rem; display: flex; align-items: center; gap: 10px; }
    .mention-item:hover { background: rgba(99,102,241,0.2); color: white; }
    .mention-item:last-child { border-bottom: none; }
`;
document.head.appendChild(mentionStyle);

let mentionTimeout;
async function handleMentionInput(inputElement, suggestionBoxElement) {
    const val = inputElement.value;
    const cursorPosition = inputElement.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPosition);
    
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]+)$/);
    
    if (match) {
        const searchTerm = match[1];
        clearTimeout(mentionTimeout);
        
        mentionTimeout = setTimeout(async () => {
            try {
                const usersRef = collection(db, "users");
                const q = query(usersRef, 
                    where("nickname", ">=", searchTerm), 
                    where("nickname", "<=", searchTerm + '\uf8ff')
                );
                
                const snap = await getDocs(q);
                suggestionBoxElement.innerHTML = '';
                
                if (!snap.empty) {
                    suggestionBoxElement.style.display = 'block';
                    snap.forEach(docSnap => {
                        const nick = docSnap.data().nickname;
                        const avatar = docSnap.data().gender === 'Female' ? 'fa-person-dress' : (docSnap.data().gender === 'Male' ? 'fa-person' : 'fa-user-astronaut');
                        
                        const div = document.createElement('div');
                        div.className = 'mention-item';
                        div.innerHTML = `<i class="fa-solid ${avatar}" style="color:var(--primary);"></i> ${nick}`;
                        
                        div.onmousedown = (e) => {
                            e.preventDefault();
                            const before = val.substring(0, match.index);
                            const after = val.substring(cursorPosition);
                            inputElement.value = before + "@" + nick + " " + after;
                            suggestionBoxElement.style.display = 'none';
                            inputElement.focus();
                        };
                        suggestionBoxElement.appendChild(div);
                    });
                } else {
                    suggestionBoxElement.style.display = 'none';
                }
            } catch(e) { console.error(e); }
        }, 300);
    } else {
        suggestionBoxElement.style.display = 'none';
    }
}

// ----------------------------------------------------
// NOTIFICATIONS & USER COUNTER
// ----------------------------------------------------
const totalUserCountEl = document.getElementById('totalUserCount');
if (totalUserCountEl) {
    async function fetchUserCount() {
        try {
            const snapshot = await getCountFromServer(collection(db, "users"));
            totalUserCountEl.textContent = snapshot.data().count;
        } catch(e) { totalUserCountEl.textContent = "?"; }
    }
    fetchUserCount();
}

const notifBadge = document.getElementById('notifBadge');
if (user && notifBadge) {
    const qNotif = query(collection(db, "notifications"), where("recipientUid", "==", user.uid));
    onSnapshot(qNotif, (snap) => {
        let unreadCount = 0;
        snap.forEach(d => { if(!d.data().read) unreadCount++; });
        if (unreadCount > 0) {
            notifBadge.style.display = 'inline-block';
            notifBadge.textContent = unreadCount;
        } else { notifBadge.style.display = 'none'; }
    });
}

window.openNotifications = async () => {
    document.getElementById('notifModal').classList.add('active');
    const notifList = document.getElementById('notifList');
    notifList.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Loading...</p>';
    if (!user) return;

    try {
        const q = query(collection(db, "notifications"), where("recipientUid", "==", user.uid));
        const snap = await getDocs(q);
        if (snap.empty) return notifList.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No new notifications.</p>';

        const notifs = [];
        snap.forEach(d => notifs.push({ id: d.id, ...d.data() }));
        notifs.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));

        notifList.innerHTML = '';
        notifs.forEach(n => {
            const bg = n.read ? 'transparent' : 'rgba(99, 102, 241, 0.1)';
            const border = n.read ? 'var(--glass-border)' : 'var(--primary)';
            const actionText = n.type === 'mention' ? 'mentioned you:' : 'commented on your post:';
            notifList.innerHTML += `
                <div style="padding: 1rem; background: ${bg}; border-left: 3px solid ${border}; border-radius: 4px; margin-bottom: 0.5rem;">
                    <strong style="color: var(--primary);">${escapeHTML(n.senderNickname)}</strong> ${actionText}
                    <br><span style="color: var(--text-muted); font-size: 0.9rem;">"${escapeHTML(n.replySnippet)}"</span>
                </div>
            `;
            if (!n.read) updateDoc(doc(db, "notifications", n.id), { read: true });
        });
    } catch (error) { notifList.innerHTML = '<p style="color: var(--danger);">Error loading notifications.</p>'; }
};

window.closeNotifications = () => document.getElementById('notifModal').classList.remove('active');

// ----------------------------------------------------
// CRISIS INTERVENTION BOT LOGIC
// ----------------------------------------------------
// These words will trigger the automated bot response
const crisisKeywords = [
    "suicide", "kill myself", "end it", "want to die", 
    "give up", "no reason to live", "ending it all", "end my life"
];

function checkForCrisis(text) {
    const lowerText = text.toLowerCase();
    return crisisKeywords.some(keyword => lowerText.includes(keyword));
}

const crisisBotReply = {
    content: "You are not alone. Please, if you are feeling overwhelmed and considering ending things, reach out for help right now. In Sri Lanka, you can call 1333 for free, confidential, 24/7 crisis support. We care about you and we want you here.",
    authorUid: "system_bot",
    authorNickname: "Haven Support Bot 🛡️",
    createdAt: new Date().toISOString()
};

// ----------------------------------------------------
// FEED LOGIC
// ----------------------------------------------------
const createPostForm = document.getElementById('createPostForm');
const postsContainer = document.getElementById('postsContainer');

if (createPostForm && postsContainer) {
    
    if (isReadOnly) {
        document.getElementById('postContent').disabled = true;
        document.getElementById('postContent').placeholder = "Your account is restricted. You can read, but cannot post.";
        createPostForm.querySelector('button').disabled = true;
    }

    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        postsContainer.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const postId = docSnap.id;
            
            let timeString = post.createdAt && typeof post.createdAt.toDate === 'function' ? new Date(post.createdAt.toDate()).toLocaleString() : "Just now";
            const likesCount = post.likes || 0;
            const hasLiked = post.likedBy && user ? post.likedBy.includes(user.uid) : false;
            const isMyPost = user && post.authorUid === user.uid;
            const canDeletePost = isMyPost || isAdmin;
            
            const authorAvatar = post.authorAvatar || 'fa-user-astronaut';

            const replies = post.replies || [];
            let repliesHtml = '';
            replies.forEach(reply => {
                let safeContent = escapeHTML(reply.content).replace(/@([a-zA-Z0-9_]+)/g, '<strong style="color: var(--accent);">@$1</strong>');
                
                // Style the bot reply differently so it stands out
                let isBot = reply.authorUid === "system_bot";
                let replyBg = isBot ? "rgba(239, 68, 68, 0.1)" : "rgba(255,255,255,0.03)";
                let replyBorder = isBot ? "3px solid var(--danger)" : "3px solid var(--primary)";
                let authorColor = isBot ? "var(--danger)" : "var(--primary)";

                repliesHtml += `
                    <div class="reply" style="margin-top: 0.8rem; padding: 0.8rem; background: ${replyBg}; border-radius: 8px; border-left: ${replyBorder};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <strong style="color: ${authorColor}; font-size: 0.85rem;"><i class="fa-solid fa-reply fa-xs"></i> ${escapeHTML(reply.authorNickname)}</strong>
                        </div>
                        <p style="font-size: 0.9rem; margin-top: 0.3rem; color: #e7e9ea;">${safeContent}</p>
                    </div>
                `;
            });
            
            const newPost = document.createElement('div');
            newPost.className = 'post-card glass-panel';
            newPost.innerHTML = `
                <div class="post-header">
                    <div class="post-author-info">
                        <div class="avatar"><i class="fa-solid ${authorAvatar}"></i></div>
                        <div class="post-meta">
                            <h4>${escapeHTML(post.authorNickname)}</h4>
                            <span>${timeString}</span>
                        </div>
                    </div>
                </div>
                <div class="post-content"><p style="font-size: 1.05rem; line-height: 1.6;">${escapeHTML(post.content)}</p></div>
                
                <div class="post-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
                    <button class="action-btn like ${hasLiked ? 'active' : ''}" onclick="window.toggleLike('${postId}', ${hasLiked})" style="color: ${hasLiked ? 'var(--accent)' : ''}">
                        <i class="${hasLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> <span id="like-count-${postId}">${likesCount}</span>
                    </button>
                    <button class="action-btn report" onclick="window.openReportModal('${postId}', 'post')"><i class="fa-regular fa-flag"></i> Report</button>
                    ${canDeletePost ? `<button class="action-btn" onclick="window.deletePost('${postId}')" style="color: var(--danger); margin-left: auto;"><i class="fa-solid fa-trash"></i> Delete</button>` : ''}
                </div>

                <div class="post-replies" style="margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                    <div style="max-height: 300px; overflow-y: auto; margin-bottom: 1rem;">${repliesHtml}</div>
                    ${!isReadOnly ? `
                    <form onsubmit="window.submitReply(event, '${postId}', '${post.authorUid}')" style="display: flex; gap: 0.5rem; position: relative;">
                        <input type="text" id="reply-input-${postId}" autocomplete="off" placeholder="Use @Nickname to tag..." style="flex-grow: 1; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.3); color: white;" required>
                        <div id="sugg-${postId}" class="mention-suggestions" style="display:none; position:absolute; bottom:100%; left:0; width:250px; max-height:150px; margin-bottom:5px;"></div>
                        <button type="submit" class="btn-primary" style="padding: 0 1.2rem; border-radius: 8px;"><i class="fa-solid fa-paper-plane"></i></button>
                    </form>` : '<p style="color:var(--danger); font-size:0.85rem;">Your account is restricted. You cannot reply.</p>'}
                </div>
            `;
            postsContainer.appendChild(newPost);

            if (!isReadOnly) {
                const replyInp = document.getElementById(`reply-input-${postId}`);
                const suggBox = document.getElementById(`sugg-${postId}`);
                if(replyInp && suggBox) {
                    replyInp.addEventListener('input', () => handleMentionInput(replyInp, suggBox));
                    replyInp.addEventListener('blur', () => setTimeout(() => suggBox.style.display='none', 200));
                }
            }
        });
    });

    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isReadOnly) return alert("You are banned from posting.");
        const submitBtn = createPostForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        
        const content = document.getElementById('postContent').value;
        
        // --- CRISIS BOT CHECK ---
        let initialReplies = [];
        if (checkForCrisis(content)) {
            initialReplies.push(crisisBotReply);
        }
        
        try {
            await addDoc(collection(db, "posts"), {
                content: content,
                authorUid: user.uid,
                authorNickname: user.nickname,
                authorAvatar: user.avatar,
                likes: 0, 
                likedBy: [], 
                replies: initialReplies, // Will contain the bot reply if triggered
                createdAt: serverTimestamp()
            });
            document.getElementById('postContent').value = '';
        } catch (error) { alert("Failed to post."); } 
        finally { submitBtn.disabled = false; }
    });

    window.toggleLike = async (postId, currentlyLiked) => {
        if (!user) return;
        const postRef = doc(db, "posts", postId);
        if (currentlyLiked) await updateDoc(postRef, { likes: increment(-1), likedBy: arrayRemove(user.uid) });
        else await updateDoc(postRef, { likes: increment(1), likedBy: arrayUnion(user.uid) });
    };

    window.deletePost = async (postId) => {
        if(confirm("Permanently delete this post?")) await deleteDoc(doc(db, "posts", postId));
    };

    window.submitReply = async (event, postId, postAuthorUid) => {
        event.preventDefault();
        if (isReadOnly) return alert("You are restricted from replying.");
        const inputField = document.getElementById(`reply-input-${postId}`);
        const replyContent = inputField.value;
        const submitBtn = event.target.querySelector('button');
        submitBtn.disabled = true;

        try {
            const mentions = replyContent.match(/@([a-zA-Z0-9_]+)/g);
            let mentionedUids = [];
            if (mentions) {
                for (const mention of mentions) {
                    const nick = mention.substring(1);
                    const userSnap = await getDocs(query(collection(db, "users"), where("nickname", "==", nick)));
                    if (!userSnap.empty) mentionedUids.push(userSnap.docs[0].id);
                }
            }

            await updateDoc(doc(db, "posts", postId), {
                replies: arrayUnion({ content: replyContent, authorUid: user.uid, authorNickname: user.nickname, createdAt: new Date().toISOString() })
            });
            inputField.value = '';

            if (postAuthorUid !== user.uid) {
                await addDoc(collection(db, "notifications"), { recipientUid: postAuthorUid, senderNickname: user.nickname, replySnippet: replyContent.substring(0, 40) + '...', postId: postId, type: 'comment', read: false, createdAt: serverTimestamp() });
            }

            for (const mUid of mentionedUids) {
                if (mUid !== user.uid && mUid !== postAuthorUid) {
                    await addDoc(collection(db, "notifications"), { recipientUid: mUid, senderNickname: user.nickname, replySnippet: replyContent.substring(0, 40) + '...', postId: postId, type: 'mention', read: false, createdAt: serverTimestamp() });
                }
            }
        } catch (error) { alert("Failed to reply."); } 
        finally { submitBtn.disabled = false; }
    };
}

// ----------------------------------------------------
// CHAT LOGIC
// ----------------------------------------------------
const chatForm = document.getElementById('chatForm');
const chatBox = document.getElementById('chatBox');

if (chatForm && chatBox) {
    if (isReadOnly) {
        document.getElementById('chatMsg').disabled = true;
        document.getElementById('chatMsg').placeholder = "Restricted from chatting.";
        chatForm.querySelector('button').disabled = true;
    } else {
        const msgInput = document.getElementById('chatMsg');
        msgInput.setAttribute('autocomplete', 'off');
        
        const suggBoxChat = document.createElement('div');
        suggBoxChat.id = 'sugg-chat';
        suggBoxChat.className = 'mention-suggestions';
        suggBoxChat.style.display = 'none';
        suggBoxChat.style.position = 'absolute';
        suggBoxChat.style.bottom = '100%';
        suggBoxChat.style.left = '0';
        suggBoxChat.style.width = '250px';
        suggBoxChat.style.maxHeight = '150px';
        suggBoxChat.style.marginBottom = '5px';

        chatForm.style.position = 'relative';
        chatForm.appendChild(suggBoxChat);

        msgInput.addEventListener('input', () => handleMentionInput(msgInput, suggBoxChat));
        msgInput.addEventListener('blur', () => setTimeout(() => suggBoxChat.style.display='none', 200));
    }

    const q = query(collection(db, "chats"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            const msgId = docSnap.id;
            const isMine = user && msg.authorUid === user.uid;
            
            let safeContent = escapeHTML(msg.content).replace(/@([a-zA-Z0-9_]+)/g, '<strong style="color: var(--accent);">@$1</strong>');

            const newMsg = document.createElement('div');
            newMsg.className = `msg-bubble ${isMine ? 'mine' : ''}`;
            newMsg.innerHTML = `
                <div class="msg-author">${escapeHTML(msg.authorNickname)}</div>
                <div class="msg-content">${safeContent}</div>
                <div class="msg-actions" style="margin-top: 5px;">
                    ${!isMine ? `<button class="action-btn report" onclick="window.openReportModal('${msgId}', 'chat')" style="color: var(--danger);"><i class="fa-solid fa-flag"></i></button>` : ''}
                    ${isMine || isAdmin ? `<button class="action-btn" onclick="window.deleteChat('${msgId}')" style="color: #666; margin-left: 10px;"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            `;
            chatBox.appendChild(newMsg);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isReadOnly) return;
        const msgInput = document.getElementById('chatMsg');
        try {
            await addDoc(collection(db, "chats"), { content: msgInput.value, authorUid: user.uid, authorNickname: user.nickname, createdAt: serverTimestamp() });
            msgInput.value = '';
        } catch (error) {}
    });

    window.deleteChat = async (chatId) => {
        if(confirm("Delete this message?")) await deleteDoc(doc(db, "chats", chatId));
    };
}

// ----------------------------------------------------
// REPORT MODAL LOGIC
// ----------------------------------------------------
const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) return alert("Please login.");
        try {
            await addDoc(collection(db, "reports"), {
                targetId: document.getElementById('reportTargetId').value,
                targetType: document.getElementById('reportTargetType').value,
                reason: document.getElementById('reportReason').value,
                context: document.getElementById('reportContext').value,
                reporterUid: user.uid,
                status: "Pending",
                createdAt: serverTimestamp()
            });
            alert("Report submitted successfully.");
            window.closeReportModal();
            document.getElementById('reportContext').value = '';
        } catch (error) { alert("Failed to submit report."); }
    });
}

// ----------------------------------------------------
// ADMIN DASHBOARD LOGIC
// ----------------------------------------------------
const adminData = document.getElementById('adminData');
if (adminData) {
    if (!user || !user.adminRoles) {
        adminData.innerHTML = "<p>Unauthorized.</p>";
    } else {
        window.updateBanStatus = async (userUid, newStatus) => {
            try {
                await updateDoc(doc(db, "users", userUid), { banStatus: newStatus });
                alert("User ban status updated to: " + newStatus);
            } catch (error) { alert("Failed to ban: " + error.message); }
        };

        window.loadAdminTab = async (tabName) => {
            adminData.innerHTML = '<div style="padding: 2rem; text-align: center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';
            
            if (tabName === 'identities') {
                if (!user.adminRoles.view_identities) return adminData.innerHTML = '<p style="color:var(--danger);">Unauthorized</p>';
                try {
                    const usersSnapshot = await getDocs(collection(db, "users"));
                    let html = `<table class="admin-table"><thead><tr><th>Nickname</th><th>Real Name</th><th>Phone</th><th>Gender</th><th>Ban Action</th></tr></thead><tbody>`;
                    
                    usersSnapshot.forEach((docS) => {
                        const u = docS.data();
                        const uId = docS.id;
                        html += `<tr>
                            <td>${escapeHTML(u.nickname)}</td>
                            <td class="sensitive-data">${escapeHTML(u.realName || 'N/A')}</td>
                            <td class="sensitive-data">${escapeHTML(u.phone || 'N/A')}</td>
                            <td>${escapeHTML(u.gender || 'N/A')}</td>
                            <td>
                                <select onchange="window.updateBanStatus('${uId}', this.value)" style="padding: 0.3rem; background: var(--bg-dark); color: white; border: 1px solid var(--danger);">
                                    <option value="none" ${u.banStatus === 'none' || !u.banStatus ? 'selected' : ''}>Active</option>
                                    <option value="read_only" ${u.banStatus === 'read_only' ? 'selected' : ''}>Read-Only Ban</option>
                                    <option value="hard" ${u.banStatus === 'hard' ? 'selected' : ''}>HARD BAN</option>
                                </select>
                            </td>
                        </tr>`;
                    });
                    html += "</tbody></table>";
                    adminData.innerHTML = html;
                } catch (e) { adminData.innerHTML = `<p>Error: ${e.message}</p>`; }
            } 
            else if (tabName === 'reports') {
                if (!user.adminRoles.view_reports) return adminData.innerHTML = '<p style="color:var(--danger);">Unauthorized</p>';
                try {
                    const repSnap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
                    let html = `<table class="admin-table"><thead><tr><th>Target</th><th>Reason</th><th>Context</th><th>Status</th><th>Action</th></tr></thead><tbody>`;
                    repSnap.forEach(d => {
                        const r = d.data();
                        html += `<tr><td>${escapeHTML(r.targetType)}</td><td>${escapeHTML(r.reason)}</td><td>${escapeHTML(r.context)}</td><td style="color: ${r.status === 'Pending' ? 'var(--accent)' : 'var(--success)'};">${escapeHTML(r.status)}</td><td>${r.status === 'Pending' ? `<button onclick="window.resolveReport('${d.id}')" style="background:var(--success); color:white; border:none; padding:0.5rem; border-radius:4px; cursor:pointer;">Resolve</button>` : 'Resolved'}</td></tr>`;
                    });
                    html += "</tbody></table>";
                    adminData.innerHTML = html;
                } catch (e) { adminData.innerHTML = `<p>Error: ${e.message}</p>`; }
            }
        };

        window.resolveReport = async (reportId) => {
            if(confirm("Mark resolved?")) {
                await updateDoc(doc(db, "reports", reportId), { status: "Resolved" });
                window.loadAdminTab('reports');
            }
        };
        window.loadAdminTab('identities');
    }
}
