import { db } from './firebase-config.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
    doc, updateDoc, increment, arrayUnion, arrayRemove, getDoc, getDocs, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Utility to get current user from local storage
function getCurrentUser() {
    const u = JSON.parse(localStorage.getItem('depressDoomerUser'));
    if (u && u.email === 'mentalistwuwi@gmail.com' && !u.adminRoles) {
        u.adminRoles = { view_reports: true, view_identities: true, isSuperAdmin: true };
    }
    return u;
}

const user = getCurrentUser();

// Simple HTML escaper
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ----------------------------------------------------
// GLOBAL INJECTIONS (Admin Link)
// ----------------------------------------------------
if (user && user.adminRoles) {
    if (typeof window.injectAdminLink === 'function') {
        window.injectAdminLink();
    }
}

// ----------------------------------------------------
// FEED LOGIC
// ----------------------------------------------------
const createPostForm = document.getElementById('createPostForm');
const postsContainer = document.getElementById('postsContainer');

if (createPostForm && postsContainer) {
    // Listen to real-time posts
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        postsContainer.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const postId = docSnap.id;
            const timeString = post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : "Just now";
            const likesCount = post.likes || 0;
            const hasLiked = post.likedBy && user ? post.likedBy.includes(user.uid) : false;
            
            const newPost = document.createElement('div');
            newPost.className = 'post-card glass-panel';
            newPost.innerHTML = \`
                <div class="post-header">
                    <div class="post-author-info">
                        <div class="avatar"><i class="fa-solid fa-user-astronaut"></i></div>
                        <div class="post-meta">
                            <h4>\${escapeHTML(post.authorNickname)}</h4>
                            <span>\${timeString}</span>
                        </div>
                    </div>
                </div>
                <div class="post-content">
                    <p>\${escapeHTML(post.content)}</p>
                </div>
                <div class="post-actions">
                    <button class="action-btn like \${hasLiked ? 'active' : ''}" onclick="window.toggleLike('\${postId}', \${hasLiked})" style="color: \${hasLiked ? 'var(--accent)' : ''}">
                        <i class="\${hasLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> <span id="like-count-\${postId}">\${likesCount}</span>
                    </button>
                    <button class="action-btn report" onclick="window.openReportModal('\${postId}', 'post')">
                        <i class="fa-regular fa-flag"></i> Report
                    </button>
                </div>
            \`;
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
                createdAt: serverTimestamp()
            });
            document.getElementById('postContent').value = '';
        } catch (error) {
            console.error("Error adding post: ", error);
            alert("Failed to post.");
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Global Like Toggle
    window.toggleLike = async (postId, currentlyLiked) => {
        if (!user) return alert("Please login.");
        const postRef = doc(db, "posts", postId);
        if (currentlyLiked) {
            await updateDoc(postRef, {
                likes: increment(-1),
                likedBy: arrayRemove(user.uid)
            });
        } else {
            await updateDoc(postRef, {
                likes: increment(1),
                likedBy: arrayUnion(user.uid)
            });
        }
    };
}

// ----------------------------------------------------
// CHAT LOGIC
// ----------------------------------------------------
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
            
            const newMsg = document.createElement('div');
            newMsg.className = \`msg-bubble \${isMine ? 'mine' : ''}\`;
            newMsg.innerHTML = \`
                <div class="msg-author">\${isMine ? 'You (' + escapeHTML(msg.authorNickname) + ')' : escapeHTML(msg.authorNickname)}</div>
                <div class="msg-content">\${escapeHTML(msg.content)}</div>
                \${!isMine ? \`<div class="msg-actions">
                    <button class="action-btn report" onclick="window.openReportModal('\${msgId}', 'chat')" style="color: var(--danger);"><i class="fa-solid fa-flag"></i></button>
                </div>\` : ''}
            \`;
            chatBox.appendChild(newMsg);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) return window.location.href = "login.html";

        const msgInput = document.getElementById('chatMsg');
        const content = msgInput.value;
        
        try {
            await addDoc(collection(db, "chats"), {
                content: content,
                authorUid: user.uid,
                authorNickname: user.nickname,
                createdAt: serverTimestamp()
            });
            msgInput.value = '';
        } catch (error) {
            console.error(error);
        }
    });
}

// ----------------------------------------------------
// REPORT MODAL LOGIC
// ----------------------------------------------------
const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) return alert("Please login.");

        const targetId = document.getElementById('reportTargetId').value;
        const targetType = document.getElementById('reportTargetType').value;
        const reason = document.getElementById('reportReason').value;
        const context = document.getElementById('reportContext').value;

        try {
            await addDoc(collection(db, "reports"), {
                targetId,
                targetType,
                reason,
                context,
                reporterUid: user.uid,
                status: "Pending",
                createdAt: serverTimestamp()
            });
            alert("Report submitted successfully.");
            window.closeReportModal();
            document.getElementById('reportContext').value = '';
        } catch (error) {
            console.error(error);
            alert("Failed to submit report.");
        }
    });
}

// ----------------------------------------------------
// ADMIN DASHBOARD LOGIC
// ----------------------------------------------------
const adminData = document.getElementById('adminData');
if (adminData) {
    // Only load if user has adminRoles
    if (!user || !user.adminRoles) {
        adminData.innerHTML = "<p>Unauthorized.</p>";
    } else {
        window.loadAdminTab = async (tabName) => {
            adminData.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top: 1rem;">Fetching Secure Data...</p></div>';
            
            if (tabName === 'identities') {
                if (!user.adminRoles.view_identities) {
                    adminData.innerHTML = '<p style="color:var(--danger);">You do not have permission to view real identities.</p>';
                    return;
                }
                // Fetch Identities
                try {
                    const postsSnapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
                    
                    let html = \`<table class="admin-table">
                        <thead><tr><th>Post Snippet</th><th>Nickname</th><th>Real Name</th><th>Phone</th><th>Gender</th></tr></thead><tbody>\`;
                    
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
                        html += \`<tr>
                            <td>\${escapeHTML(p.content.substring(0, 30))}...</td>
                            <td>\${escapeHTML(p.authorNickname)}</td>
                            <td class="sensitive-data">\${escapeHTML(r.realName || 'N/A')}</td>
                            <td class="sensitive-data">\${escapeHTML(r.phone || 'N/A')}</td>
                            <td class="sensitive-data">\${escapeHTML(r.gender || 'N/A')}</td>
                        </tr>\`;
                    }
                    html += "</tbody></table>";
                    adminData.innerHTML = html;
                } catch (e) { adminData.innerHTML = \`<p>Error: \${e.message}</p>\`; }
            } 
            else if (tabName === 'reports') {
                if (!user.adminRoles.view_reports) {
                    adminData.innerHTML = '<p style="color:var(--danger);">You do not have permission to view reports.</p>';
                    return;
                }
                // Fetch Reports
                try {
                    const repSnap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
                    
                    let html = \`<table class="admin-table">
                        <thead><tr><th>Target Type</th><th>Reason</th><th>Context</th><th>Status</th><th>Action</th></tr></thead><tbody>\`;
                    
                    repSnap.forEach(d => {
                        const r = d.data();
                        html += \`<tr>
                            <td><span style="background: rgba(255,255,255,0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">\${escapeHTML(r.targetType)}</span></td>
                            <td>\${escapeHTML(r.reason)}</td>
                            <td>\${escapeHTML(r.context)}</td>
                            <td style="color: \${r.status === 'Pending' ? 'var(--accent)' : 'var(--success)'};">\${escapeHTML(r.status)}</td>
                            <td>
                                \${r.status === 'Pending' ? \`<button onclick="window.resolveReport('\${d.id}')" style="background:var(--success); color:white; border:none; padding:0.5rem; border-radius:4px; cursor:pointer;">Resolve</button>\` : 'Resolved'}
                            </td>
                        </tr>\`;
                    });
                    html += "</tbody></table>";
                    adminData.innerHTML = html;
                } catch (e) { adminData.innerHTML = \`<p>Error: \${e.message}</p>\`; }
            }
            else if (tabName === 'manage_admins') {
                if (!user.adminRoles.isSuperAdmin) {
                    adminData.innerHTML = '<p style="color:var(--danger);">Only the Super Admin can manage other admins.</p>';
                    return;
                }
                
                adminData.innerHTML = \`
                    <div style="max-width: 500px; margin: 0 auto; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--glass-border);">
                        <h3 style="margin-bottom: 1rem;">Add New Admin</h3>
                        <form id="addAdminForm">
                            <div style="margin-bottom: 1rem;">
                                <label style="display:block; margin-bottom: 0.5rem;">Admin Email</label>
                                <input type="email" id="newAdminEmail" style="width: 100%; padding: 0.8rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: white; border-radius: 4px;" required>
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label><input type="checkbox" id="chkViewReports" checked> Can View & Resolve Reports</label><br><br>
                                <label><input type="checkbox" id="chkViewIdentities"> Can View Real Identities <span style="color:var(--danger); font-size:0.8rem;">(High Risk)</span></label>
                            </div>
                            <button type="submit" style="background: var(--primary); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 4px; cursor: pointer;">Grant Admin Access</button>
                        </form>
                    </div>
                \`;

                document.getElementById('addAdminForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const email = document.getElementById('newAdminEmail').value;
                    const vRep = document.getElementById('chkViewReports').checked;
                    const vIden = document.getElementById('chkViewIdentities').checked;
                    
                    try {
                        await setDoc(doc(db, "admins", email), {
                            view_reports: vRep,
                            view_identities: vIden,
                            isSuperAdmin: false
                        });
                        alert("Admin access granted to " + email);
                        document.getElementById('newAdminEmail').value = '';
                    } catch (error) {
                        alert("Error: " + error.message);
                    }
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

        // Initially load identities tab
        window.loadAdminTab('identities');
    }
}
