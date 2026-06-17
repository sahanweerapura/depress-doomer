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

function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

if (user && user.adminRoles) {
    if (typeof window.injectAdminLink === 'function') {
        window.injectAdminLink();
    }
}

// TOTAL USER COUNTER
const totalUserCountEl = document.getElementById('totalUserCount');
if (totalUserCountEl) {
    async function fetchUserCount() {
        try {
            const snapshot = await getCountFromServer(collection(db, "users"));
            totalUserCountEl.textContent = snapshot.data().count;
        } catch(e) {
            totalUserCountEl.textContent = "?";
        }
    }
    fetchUserCount();
}

// NOTIFICATION SYSTEM LOGIC
const notifBadge = document.getElementById('notifBadge');
if (user && notifBadge) {
    const qNotif = query(collection(db, "notifications"), where("recipientUid", "==", user.uid));
    onSnapshot(qNotif, (snap) => {
        let unreadCount = 0;
        snap.forEach(d => { if(!d.data().read) unreadCount++; });
        
        if (unreadCount > 0) {
            notifBadge.style.display = 'inline-block';
            notifBadge.textContent = unreadCount;
        } else {
            notifBadge.style.display = 'none';
        }
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
        
        if (snap.empty) {
            notifList.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No new notifications.</p>';
            return;
        }

        const notifs = [];
        snap.forEach(d => notifs.push({ id: d.id, ...d.data() }));
        
        notifs.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt ? b.createdAt.toMillis() : 0;
            return tB - tA;
        });

        notifList.innerHTML = '';
        notifs.forEach(n => {
            const bg = n.read ? 'transparent' : 'rgba(99, 102, 241, 0.1)';
            const border = n.read ? 'var(--glass-border)' : 'var(--primary)';
            
            // Differentiate message based on tag vs normal reply
            const actionText = n.type === 'mention' ? 'mentioned you in a comment:' : 'commented on your post:';

            notifList.innerHTML += `
                <div style="padding: 1rem; background: ${bg}; border-left: 3px solid ${border}; border-radius: 4px; margin-bottom: 0.5rem;">
                    <strong style="color: var(--primary);">${escapeHTML(n.senderNickname)}</strong> ${actionText}
                    <br><span style="color: var(--text-muted); font-size: 0.9rem;">"${escapeHTML(n.replySnippet)}"</span>
                </div>
            `;
            if (!n.read) {
                updateDoc(doc(db, "notifications", n.id), { read: true });
            }
        });
    } catch (error) {
        notifList.innerHTML = '<p style="color: var(--danger);">Error loading notifications.</p>';
    }
};

window.closeNotifications = () => {
    document.getElementById('notifModal').classList.remove('active');
};

// FEED LOGIC WITH REPLY SYSTEM & MENTIONS
const createPostForm = document.getElementById('createPostForm');
const postsContainer = document.getElementById('postsContainer');

if (createPostForm && postsContainer) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        postsContainer.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const postId = docSnap.id;
            
            let timeString = "Just now";
            if (post.createdAt && typeof post.createdAt.toDate === 'function') {
                timeString = new Date(post.createdAt.toDate()).toLocaleString();
            } else if (post.createdAt) {
                timeString = new Date(post.createdAt).toLocaleString();
            }

            const likesCount = post.likes || 0;
            const hasLiked = post.likedBy && user ? post.likedBy.includes(user.uid) : false;
            
            const isMyPost = user && post.authorUid === user.uid;
            const canDeletePost = isMyPost || isAdmin;

            // Render Replies with Mention Highlighting
            const replies = post.replies || [];
            let repliesHtml = '';
            if (replies.length > 0) {
                replies.forEach(reply => {
                    let replyTime = new Date(reply.createdAt).toLocaleString();
                    
                    // Highlight @Mentions in the UI
                    let safeReplyContent = escapeHTML(reply.content);
                    safeReplyContent = safeReplyContent.replace(/@([a-zA-Z0-9_]+)/g, '<strong style="color: var(--accent);">@$1</strong>');

                    repliesHtml += `
                        <div class="reply" style="margin-top: 0.8rem; padding: 0.8rem; background: rgba(255,255,255,0.03); border-radius: 8px; border-left: 3px solid var(--primary);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong style="color: var(--primary); font-size: 0.85rem;"><i class="fa-solid fa-reply fa-xs"></i> ${escapeHTML(reply.authorNickname)}</strong>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">${replyTime}</span>
                            </div>
                            <p style="font-size: 0.9rem; margin-top: 0.3rem; color: #e7e9ea;">${safeReplyContent}</p>
                        </div>
                    `;
                });
            }
            
            const newPost = document.createElement('div');
            newPost.className = 'post-card glass-panel';
            newPost.innerHTML = `
                <div class="post-header">
                    <div class="post-author-info">
                        <div class="avatar"><i class="fa-solid fa-user-astronaut"></i></div>
                        <div class="post-meta">
                            <h4>${escapeHTML(post.authorNickname)}</h4>
                            <span>${timeString}</span>
                        </div>
                    </div>
                </div>
                <div class="post-content">
                    <p style="font-size: 1.05rem; line-height: 1.6;">${escapeHTML(post.content)}</p>
                </div>
                
                <div class="post-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
                    <button class="action-btn like ${hasLiked ? 'active' : ''}" onclick="window.toggleLike('${postId}', ${hasLiked})" style="color: ${hasLiked ? 'var(--accent)' : ''}">
                        <i class="${hasLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> <span id="like-count-${postId}">${likesCount}</span>
                    </button>
                    <button class="action-btn report" onclick="window.openReportModal('${postId}', 'post')">
                        <i class="fa-regular fa-flag"></i> Report
                    </button>
                    ${canDeletePost ? `
                    <button class="action-btn" onclick="window.deletePost('${postId}')" style="color: var(--danger); margin-left: auto;">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>` : ''}
                </div>

                <div class="post-replies" style="margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                    <div style="max-height: 300px; overflow-y: auto; margin-bottom: 1rem;">
                        ${repliesHtml}
                    </div>
                    <form onsubmit="window.submitReply(event, '${postId}', '${post.authorUid}')" style="display: flex; gap: 0.5rem;">
                        <input type="text" id="reply-input-${postId}" placeholder="Write a reply (use @Nickname to tag)..." style="flex-grow: 1; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.3); color: white;" required>
                        <button type="submit" class="btn-primary" style="padding: 0 1.2rem; border-radius: 8px;"><i class="fa-solid fa-paper-plane"></i></button>
                    </form>
                </div>
            `;
            postsContainer.appendChild(newPost);
        });
    });

    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) { window.location.href = "login.html"; return; }
        const submitBtn = createPostForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const content = document.getElementById('postContent').value;
        try {
            await addDoc(collection(db, "posts"), {
                content: content,
                authorUid: user.uid,
                authorNickname: user.nickname,
                likes: 0,
                likedBy: [],
                replies: [],
                createdAt: serverTimestamp()
            });
            document.getElementById('postContent').value = '';
        } catch (error) {
            console.error("Error adding post: ", error);
            alert("Failed to post: " + error.message);
        } finally {
            submitBtn.disabled = false;
        }
    });

    window.toggleLike = async (postId, currentlyLiked) => {
        if (!user) return alert("Please login.");
        const postRef = doc(db, "posts", postId);
        if (currentlyLiked) {
            await updateDoc(postRef, { likes: increment(-1), likedBy: arrayRemove(user.uid) });
        } else {
            await updateDoc(postRef, { likes: increment(1), likedBy: arrayUnion(user.uid) });
        }
    };

    window.deletePost = async (postId) => {
        if(confirm("Are you sure you want to permanently delete this post?")) {
            try { await deleteDoc(doc(db, "posts", postId)); } 
            catch(e) { alert("Error deleting post: " + e.message); }
        }
    };

    window.submitReply = async (event, postId, postAuthorUid) => {
        event.preventDefault();
        if (!user) return alert("Please login to reply.");

        const inputField = document.getElementById(`reply-input-${postId}`);
        const replyContent = inputField.value;
        const submitBtn = event.target.querySelector('button');
        submitBtn.disabled = true;

        try {
            // Find any @mentions in the text
            const mentions = replyContent.match(/@([a-zA-Z0-9_]+)/g);
            let mentionedUids = [];

            if (mentions) {
                for (const mention of mentions) {
                    const nick = mention.substring(1); // Remove the @ symbol
                    // Query the database to find the user with this nickname
                    const userQ = query(collection(db, "users"), where("nickname", "==", nick));
                    const userSnap = await getDocs(userQ);
                    if (!userSnap.empty) {
                        mentionedUids.push(userSnap.docs[0].id); // Save the matching user's UID
                    }
                }
            }

            // Save the reply to the post
            await updateDoc(doc(db, "posts", postId), {
                replies: arrayUnion({
                    content: replyContent,
                    authorUid: user.uid,
                    authorNickname: user.nickname,
                    createdAt: new Date().toISOString()
                })
            });
            inputField.value = '';

            // 1. Notify the original post author (if it's not the person commenting)
            if (postAuthorUid !== user.uid) {
                await addDoc(collection(db, "notifications"), {
                    recipientUid: postAuthorUid,
                    senderNickname: user.nickname,
                    replySnippet: replyContent.substring(0, 40) + '...',
                    postId: postId,
                    type: 'comment',
                    read: false,
                    createdAt: serverTimestamp()
                });
            }

            // 2. Notify anyone who was explicitly @mentioned
            for (const mUid of mentionedUids) {
                // Prevent sending them 2 notifications if they are also the post owner
                // Also prevent sending a notification to yourself if you mention yourself
                if (mUid !== user.uid && mUid !== postAuthorUid) {
                    await addDoc(collection(db, "notifications"), {
                        recipientUid: mUid,
                        senderNickname: user.nickname,
                        replySnippet: replyContent.substring(0, 40) + '...',
                        postId: postId,
                        type: 'mention',
                        read: false,
                        createdAt: serverTimestamp()
                    });
                }
            }

        } catch (error) {
            console.error(error);
            alert("Failed to send reply: " + error.message);
        } finally {
            submitBtn.disabled = false;
        }
    };
}

// CHAT LOGIC
const chatForm = document.getElementById('chatForm');
const chatBox = document.getElementById('chatBox');

if (chatForm && chatBox) {
    if (!user) {
        document.getElementById('chatMsg').disabled = true;
        document.getElementById('chatMsg').placeholder = "Please login to chat...";
    }

    const q = query(collection(db, "chats"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            const msgId = docSnap.id;
            const isMine = user && msg.authorUid === user.uid;
            const canDeleteChat = isMine || isAdmin;
            
            const newMsg = document.createElement('div');
            newMsg.className = `msg-bubble ${isMine ? 'mine' : ''}`;
            newMsg.innerHTML = `
                <div class="msg-author">${isMine ? 'You (' + escapeHTML(msg.authorNickname) + ')' : escapeHTML(msg.authorNickname)}</div>
                <div class="msg-content">${escapeHTML(msg.content)}</div>
                <div class="msg-actions" style="margin-top: 5px;">
                    ${!isMine ? `<button class="action-btn report" onclick="window.openReportModal('${msgId}', 'chat')" style="color: var(--danger);"><i class="fa-solid fa-flag"></i></button>` : ''}
                    ${canDeleteChat ? `<button class="action-btn" onclick="window.deleteChat('${msgId}')" style="color: #666; margin-left: 10px;"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            `;
            chatBox.appendChild(newMsg);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) return window.location.href = "login.html";
        const msgInput = document.getElementById('chatMsg');
        try {
            await addDoc(collection(db, "chats"), {
                content: msgInput.value,
                authorUid: user.uid,
                authorNickname: user.nickname,
                createdAt: serverTimestamp()
            });
            msgInput.value = '';
        } catch (error) { alert("Failed to send message."); }
    });

    window.deleteChat = async (chatId) => {
        if(confirm("Delete this message?")) {
            try { await deleteDoc(doc(db, "chats", chatId)); } 
            catch(e) { alert("Error deleting chat: " + e.message); }
        }
    };
}

// REPORT MODAL LOGIC
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

// ADMIN DASHBOARD LOGIC
const adminData = document.getElementById('adminData');
if (adminData) {
    if (!user || !user.adminRoles) {
        adminData.innerHTML = "<p>Unauthorized.</p>";
    } else {
        window.loadAdminTab = async (tabName) => {
            adminData.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top: 1rem;">Fetching Secure Data...</p></div>';
            
            if (tabName === 'identities') {
                if (!user.adminRoles.view_identities) return adminData.innerHTML = '<p style="color:var(--danger);">Unauthorized</p>';
                try {
                    const postsSnapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
                    let html = `<table class="admin-table"><thead><tr><th>Post Snippet</th><th>Nickname</th><th>Real Name</th><th>Phone</th><th>Gender</th></tr></thead><tbody>`;
                    const uCache = {};
                    for (const docS of postsSnapshot.docs) {
                        const p = docS.data();
                        let r = { realName: "?", phone: "?", gender: "?" };
                        if (p.authorUid) {
                            if (!uCache[p.authorUid]) {
                                const uDoc = await getDoc(doc(db, "users", p.authorUid));
                                if (uDoc.exists()) uCache[p.authorUid] = uDoc.data();
                            }
                            if (uCache[p.authorUid]) r = uCache[p.authorUid];
                        }
                        html += `<tr><td>${escapeHTML(p.content.substring(0, 30))}...</td><td>${escapeHTML(p.authorNickname)}</td><td class="sensitive-data">${escapeHTML(r.realName || 'N/A')}</td><td class="sensitive-data">${escapeHTML(r.phone || 'N/A')}</td><td class="sensitive-data">${escapeHTML(r.gender || 'N/A')}</td></tr>`;
                    }
                    html += "</tbody></table>";
                    adminData.innerHTML = html;
                } catch (e) { adminData.innerHTML = `<p>Error: ${e.message}</p>`; }
            } 
            else if (tabName === 'reports') {
                if (!user.adminRoles.view_reports) return adminData.innerHTML = '<p style="color:var(--danger);">Unauthorized</p>';
                try {
                    const repSnap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
                    let html = `<table class="admin-table"><thead><tr><th>Target Type</th><th>Reason</th><th>Context</th><th>Status</th><th>Action</th></tr></thead><tbody>`;
                    repSnap.forEach(d => {
                        const r = d.data();
                        html += `<tr><td><span style="background: rgba(255,255,255,0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">${escapeHTML(r.targetType)}</span></td><td>${escapeHTML(r.reason)}</td><td>${escapeHTML(r.context)}</td><td style="color: ${r.status === 'Pending' ? 'var(--accent)' : 'var(--success)'};">${escapeHTML(r.status)}</td><td>${r.status === 'Pending' ? `<button onclick="window.resolveReport('${d.id}')" style="background:var(--success); color:white; border:none; padding:0.5rem; border-radius:4px; cursor:pointer;">Resolve</button>` : 'Resolved'}</td></tr>`;
                    });
                    html += "</tbody></table>";
                    adminData.innerHTML = html;
                } catch (e) { adminData.innerHTML = `<p>Error: ${e.message}</p>`; }
            }
            else if (tabName === 'manage_admins') {
                if (!user.adminRoles.isSuperAdmin) return adminData.innerHTML = '<p style="color:var(--danger);">Unauthorized</p>';
                adminData.innerHTML = `
                    <div style="max-width: 500px; margin: 0 auto; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--glass-border);">
                        <h3 style="margin-bottom: 1rem;">Add New Admin</h3>
                        <form id="addAdminForm">
                            <div style="margin-bottom: 1rem;"><label style="display:block; margin-bottom: 0.5rem;">Admin Email</label><input type="email" id="newAdminEmail" style="width: 100%; padding: 0.8rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: white; border-radius: 4px;" required></div>
                            <div style="margin-bottom: 1rem;"><label><input type="checkbox" id="chkViewReports" checked> Can View & Resolve Reports</label><br><br><label><input type="checkbox" id="chkViewIdentities"> Can View Real Identities <span style="color:var(--danger); font-size:0.8rem;">(High Risk)</span></label></div>
                            <button type="submit" style="background: var(--primary); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 4px; cursor: pointer;">Grant Admin Access</button>
                        </form>
                    </div>
                `;
                document.getElementById('addAdminForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    try {
                        await setDoc(doc(db, "admins", document.getElementById('newAdminEmail').value), {
                            view_reports: document.getElementById('chkViewReports').checked,
                            view_identities: document.getElementById('chkViewIdentities').checked,
                            isSuperAdmin: false
                        });
                        alert("Admin access granted!");
                    } catch (error) { alert("Error: " + error.message); }
                });
            }
        };

        window.resolveReport = async (reportId) => {
            if(confirm("Mark this report as resolved?")) {
                try {
                    await updateDoc(doc(db, "reports", reportId), { status: "Resolved" });
                    window.loadAdminTab('reports');
                } catch (e) { alert(e.message); }
            }
        };

        window.loadAdminTab('identities');
    }
}
