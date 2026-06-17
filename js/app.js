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

// ----------------------------------------------------
// FEED LOGIC
// ----------------------------------------------------
const createPostForm = document.getElementById('createPostForm');
const postsContainer = document.getElementById('postsContainer');

if (createPostForm && postsContainer) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    
    // WE ADDED AN ERROR CATCHER HERE
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
            `;
            postsContainer.appendChild(newPost);
        });
    }, (error) => {
        // THIS WILL POP UP IF THE DATABASE IS LOCKED
        alert("🚨 DATABASE READ ERROR: " + error.message + "\n\nYour Firebase Security Rules are likely blocking the website from loading posts.");
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
            // SUCCESS POPUP
            alert("✅ Post successfully saved to the database!"); 
        } catch (error) {
            // FAILURE POPUP
            alert("🚨 FAILED TO POST: " + error.message);
        } finally {
            submitBtn.disabled = false;
        }
    });
}
