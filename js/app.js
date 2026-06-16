import { db } from './firebase-config.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Utility to get current user from local storage (set by auth.js)
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('depressDoomerUser'));
}

// Feed Logic
const createPostForm = document.getElementById('createPostForm');
const postsContainer = document.getElementById('postsContainer');

if (createPostForm && postsContainer) {
    // Listen to real-time posts
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        postsContainer.innerHTML = '';
        snapshot.forEach((doc) => {
            const post = doc.data();
            const timeString = post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : "Just now";
            
            const newPost = document.createElement('div');
            newPost.className = 'post-card';
            newPost.innerHTML = `
                <div class="post-header">
                    <div class="avatar"><i class="fa-solid fa-user-secret"></i></div>
                    <div class="post-meta">
                        <span class="post-author">${escapeHTML(post.authorNickname)}</span>
                        <span class="post-time">${timeString}</span>
                    </div>
                </div>
                <div class="post-content">
                    <p>${escapeHTML(post.content)}</p>
                </div>
                <div class="post-actions">
                    <button class="action-btn"><i class="fa-regular fa-comment"></i> <span data-i18n="feed.reply">Reply</span></button>
                </div>
            `;
            postsContainer.appendChild(newPost);
        });
        // Re-apply translations for new dynamic content if i18n is available
        if (typeof applyTranslations === 'function') applyTranslations();
    });

    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) {
            alert("Please login to post anonymously.");
            window.location.href = "login.html";
            return;
        }

        const submitBtn = createPostForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const content = document.getElementById('postContent').value;
        try {
            await addDoc(collection(db, "posts"), {
                content: content,
                authorUid: user.uid,
                authorNickname: user.nickname,
                createdAt: serverTimestamp()
            });
            document.getElementById('postContent').value = '';
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Failed to post.");
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// Chat Logic
const chatForm = document.getElementById('chatForm');
const chatBox = document.getElementById('chatBox');

if (chatForm && chatBox) {
    const user = getCurrentUser();
    if (!user) {
        document.getElementById('chatMsg').disabled = true;
        document.getElementById('chatMsg').placeholder = "Please login to chat...";
    }

    // Listen to real-time chat messages
    const q = query(collection(db, "chats"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = '';
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isMine = user && msg.authorUid === user.uid;
            
            const newMsg = document.createElement('div');
            newMsg.className = \`message \${isMine ? 'mine' : ''}\`;
            newMsg.innerHTML = \`
                <div class="msg-author">\${isMine ? 'You (' + escapeHTML(msg.authorNickname) + ')' : escapeHTML(msg.authorNickname)}</div>
                <div>\${escapeHTML(msg.content)}</div>
            \`;
            chatBox.appendChild(newMsg);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) {
            window.location.href = "login.html";
            return;
        }

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
            console.error("Error sending message: ", error);
            alert("Failed to send message.");
        }
    });
}

// Admin Dashboard Logic
const adminData = document.getElementById('adminData');
if (adminData) {
    const loadAdminData = async () => {
        const user = getCurrentUser();
        if (!user) {
            adminData.innerHTML = "<p>Please login first.</p>";
            return;
        }
        
        // In a real scenario, this would be guarded by Firebase Security Rules allowing only admins.
        // For demonstration, we just fetch all users and all posts.
        try {
            const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const postsSnapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
            
            // We need to fetch user details separately since they are in 'users' collection
            let tableHTML = \`
            <table style="width: 100%; text-align: left; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <th style="padding: 1rem;">Post Snippet</th>
                        <th style="padding: 1rem;">Public Nickname</th>
                        <th style="padding: 1rem; color: #fca5a5;">Real Name</th>
                        <th style="padding: 1rem; color: #fca5a5;">Phone</th>
                        <th style="padding: 1rem; color: #fca5a5;">Age</th>
                    </tr>
                </thead>
                <tbody>
            \`;

            // Cache for user docs to avoid multiple reads
            const userCache = {};

            for (const docSnapshot of postsSnapshot.docs) {
                const post = docSnapshot.data();
                let realData = { realName: "Unknown", phone: "Unknown", age: "Unknown" };
                
                if (post.authorUid) {
                    if (!userCache[post.authorUid]) {
                        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        const userDoc = await getDoc(doc(db, "users", post.authorUid));
                        if (userDoc.exists()) {
                            userCache[post.authorUid] = userDoc.data();
                        }
                    }
                    if (userCache[post.authorUid]) {
                        realData = userCache[post.authorUid];
                    }
                }

                tableHTML += \`
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 1rem;">\${escapeHTML(post.content.substring(0, 50))}...</td>
                        <td style="padding: 1rem;">\${escapeHTML(post.authorNickname)}</td>
                        <td style="padding: 1rem;">\${escapeHTML(realData.realName || 'N/A')}</td>
                        <td style="padding: 1rem;">\${escapeHTML(realData.phone || 'N/A')}</td>
                        <td style="padding: 1rem;">\${escapeHTML(realData.age || 'N/A')}</td>
                    </tr>
                \`;
            }

            tableHTML += "</tbody></table>";
            adminData.innerHTML = tableHTML;
        } catch (error) {
            adminData.innerHTML = \`<p style="color:red;">Error loading admin data: \${error.message}</p>\`;
        }
    };
    loadAdminData();
}

// Simple HTML escaper to prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
