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
            
            // --- BUG FIX: Safe Timestamp Parsing ---
            let timeString = "Just now";
            if (post.createdAt && typeof post.createdAt.toDate === 'function') {
                timeString = new Date(post.createdAt.toDate()).toLocaleString();
            } else if (post.createdAt) {
                timeString = new Date(post.createdAt).toLocaleString();
            }
            // ---------------------------------------

            const likesCount = post.likes || 0;
            const hasLiked = post.likedBy && user ? post.likedBy.includes(user.uid) : false;
            
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
                    <p>${escapeHTML(post.content)}</p>
                </div>
                <div class="post-actions">
                    <button class="action-btn like ${hasLiked ? 'active' : ''}" onclick="window.toggleLike('${postId}', ${hasLiked})" style="color: ${hasLiked ? 'var(--accent)' : ''}">
                        <i class="${hasLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> <span id="like-count-${postId}">${likesCount}</span>
                    </button>
                    <button class="action-btn report" onclick="window.openReportModal('${postId}', 'post')">
                        <i class="fa-regular fa-flag"></i> Report
                    </button>
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
            newMsg.className = `msg-bubble ${isMine ? 'mine' : ''}`;
            newMsg.innerHTML = `
                <div class="msg-author">${isMine ? 'You (' + escapeHTML(msg.authorNickname) + ')' : escapeHTML(msg.authorNickname)}</div>
                <div class="msg-content">${escapeHTML(msg.content)}</div>
                ${!isMine ? `<div class="msg-actions">
                    <button class="action-btn report" onclick="window.openReportModal('${msgId}', 'chat')" style="color: var(--danger);"><i class="fa-solid fa-flag"></i></button>
                </div>` : ''}
            `;
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
const reportForm = document.getElementById('
