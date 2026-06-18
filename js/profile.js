import { db } from './firebase-config.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function getCurrentUser() { return JSON.parse(localStorage.getItem('depressDoomerUser')); }
const user = getCurrentUser();
if (!user) window.location.href = "login.html";

function escapeHTML(str) { return !str ? '' : str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

// Global UI Setup
const nameEl = document.getElementById('currentUserName');
if (nameEl) nameEl.textContent = user.nickname;
const currentUserAvatarEl = document.getElementById('currentUserAvatar');
if (currentUserAvatarEl && user) {
    currentUserAvatarEl.innerHTML = user.avatarBase64 
        ? `<img src="${user.avatarBase64}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` 
        : `<i class="fa-solid ${escapeHTML(user.avatar || 'fa-user-astronaut')}"></i>`;
}

// Profile Logic
const urlParams = new URLSearchParams(window.location.search);
const targetUid = urlParams.get('uid') || user.uid;
const isMyProfile = (targetUid === user.uid);

const profileHeaderBox = document.getElementById('profileHeaderBox');
const userPostsContainer = document.getElementById('userPostsContainer');

async function loadProfile() {
    try {
        const userDoc = await getDoc(doc(db, "users", targetUid));
        if (!userDoc.exists()) {
            profileHeaderBox.innerHTML = `<h3>User not found.</h3>`;
            return;
        }
        
        const uData = userDoc.data();
        const joinDate = new Date(uData.createdAt).toLocaleDateString();
        const avatarDisplay = uData.avatarBase64 
            ? `<img src="${uData.avatarBase64}" alt="Avatar">`
            : `<i class="fa-solid ${escapeHTML(uData.gender === 'Female' ? 'fa-person-dress' : (uData.gender === 'Male' ? 'fa-person' : 'fa-user-astronaut'))}"></i>`;

        profileHeaderBox.innerHTML = `
            <div class="profile-avatar-large">${avatarDisplay}</div>
            <h2 style="color: white; font-size: 2rem; margin-bottom: 0.5rem;">${escapeHTML(uData.nickname)}</h2>
            <p style="color: var(--primary); font-size: 0.9rem; margin-bottom: 1rem;"><i class="fa-solid fa-calendar-days"></i> Joined ${joinDate}</p>
            <p class="bio-text">"${escapeHTML(uData.bio || 'This user prefers to remain mysterious in the void.')}"</p>
            ${isMyProfile ? `<button class="btn-primary" style="margin-top: 1rem; background: transparent; border: 1px solid var(--primary);" onclick="document.getElementById('editProfileModal').classList.add('active')"><i class="fa-solid fa-pen"></i> Edit Profile</button>` : ''}
        `;

        if (isMyProfile) document.getElementById('profileBioInput').value = uData.bio || "";

        const q = query(collection(db, "posts"), where("authorUid", "==", targetUid), orderBy("createdAt", "desc"));
        const postSnaps = await getDocs(q);
        userPostsContainer.innerHTML = '';
        
        if (postSnaps.empty) {
            userPostsContainer.innerHTML = `<p style="text-align:center; color:var(--text-muted);">No public posts yet.</p>`;
        } else {
            postSnaps.forEach(docSnap => {
                const post = docSnap.data();
                if(post.isVoid && post.authorUid !== user.uid) return; 
                
                const timeStr = new Date(post.createdAt).toLocaleString();
                userPostsContainer.innerHTML += `
                    <div class="post-card glass-panel" style="${post.isVoid ? 'background: rgba(0,0,0,0.6);' : ''}">
                        <div style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.5rem;">${timeStr} ${post.isVoid ? '🕳️ (Void)' : ''}</div>
                        <p style="color: white; line-height: 1.5;">${escapeHTML(post.content)}</p>
                        <div style="margin-top: 1rem; color: var(--primary); font-size: 0.85rem;"><i class="fa-solid fa-heart"></i> ${post.likes || 0} Likes</div>
                    </div>
                `;
            });
        }
    } catch(e) { console.error(e); profileHeaderBox.innerHTML = `<p style="color:var(--danger);">Error loading profile.</p>`; }
}

loadProfile();

// --- THE BASE64 HACK: Compress image to string ---
function compressImageToBase64(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 150; // Extremely small to save database space
            let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            // Convert back to string (JPEG format at 70% quality)
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
}

const editProfileForm = document.getElementById('editProfileForm');
if (editProfileForm) {
    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveProfileBtn');
        btn.disabled = true; btn.textContent = "Saving...";

        try {
            let updateData = { bio: document.getElementById('profileBioInput').value };
            const fileInput = document.getElementById('profileImageInput');
            
            // If they picked an image, compress it and save the string
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                compressImageToBase64(file, async (base64String) => {
                    updateData.avatarBase64 = base64String;
                    await updateDoc(doc(db, "users", user.uid), updateData);
                    
                    let lData = getCurrentUser();
                    lData.bio = updateData.bio;
                    lData.avatarBase64 = base64String;
                    localStorage.setItem('depressDoomerUser', JSON.stringify(lData));
                    
                    document.getElementById('editProfileModal').classList.remove('active');
                    loadProfile(); 
                    btn.disabled = false; btn.textContent = "Save Changes";
                });
            } else {
                await updateDoc(doc(db, "users", user.uid), updateData);
                let lData = getCurrentUser();
                lData.bio = updateData.bio;
                localStorage.setItem('depressDoomerUser', JSON.stringify(lData));
                
                document.getElementById('editProfileModal').classList.remove('active');
                loadProfile(); 
                btn.disabled = false; btn.textContent = "Save Changes";
            }
        } catch(err) {
            alert("Error updating profile: " + err.message);
            btn.disabled = false; btn.textContent = "Save Changes";
        }
    });
}