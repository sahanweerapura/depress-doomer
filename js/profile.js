import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function getCurrentUser() { return JSON.parse(localStorage.getItem('depressDoomerUser')); }
const user = getCurrentUser();

if (!user) {
    window.location.href = "login.html";
} else {
    function escapeHTML(str) { return !str ? '' : str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

    const nameEl = document.getElementById('currentUserName');
    if (nameEl) nameEl.textContent = user.nickname;
    
    const currentUserAvatarEl = document.getElementById('currentUserAvatar');
    if (currentUserAvatarEl) {
        currentUserAvatarEl.innerHTML = user.avatarBase64 
            ? `<img src="${user.avatarBase64}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` 
            : `<i class="fa-solid ${escapeHTML(user.avatar || 'fa-user-astronaut')}"></i>`;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const targetUid = urlParams.get('uid') || user.uid;
    const isMyProfile = (targetUid === user.uid);

    const profileHeaderBox = document.getElementById('profileHeaderBox');
    const userPostsContainer = document.getElementById('userPostsContainer');

    async function loadProfile() {
        try {
            if (!targetUid) throw new Error("User ID is missing.");

            const userDoc = await getDoc(doc(db, "users", targetUid));
            if (!userDoc.exists()) {
                if (profileHeaderBox) profileHeaderBox.innerHTML = `<h3>User not found.</h3>`;
                return;
            }
            
            const uData = userDoc.data();
            const joinDate = uData.createdAt ? new Date(uData.createdAt).toLocaleDateString() : "Unknown Date";
            const avatarDisplay = uData.avatarBase64 
                ? `<img src="${uData.avatarBase64}" alt="Avatar">`
                : `<i class="fa-solid ${escapeHTML(uData.gender === 'Female' ? 'fa-person-dress' : (uData.gender === 'Male' ? 'fa-person' : 'fa-user-astronaut'))}"></i>`;

            let moodAnalyticsHtml = '';
            let chartData = null;

            if (isMyProfile && uData.moodHistory) {
                let moodArray = Object.values(uData.moodHistory);
                if (moodArray.length > 0) {
                    let counts = {1:0, 2:0, 3:0, 4:0, 5:0};
                    let totalScore = 0;
                    
                    moodArray.forEach(level => {
                        counts[level] = (counts[level] || 0) + 1;
                        totalScore += level;
                    });
                    
                    let totalLogs = moodArray.length;
                    let avgMood = Math.round(totalScore / totalLogs);
                    
                    let climateText = "";
                    let climateIcon = "";
                    let climateColor = "";
                    
                    if(avgMood === 1) { climateText = "Clear & Sunny"; climateIcon = "fa-sun"; climateColor = "#10b981"; }
                    else if(avgMood === 2) { climateText = "Mostly Manageable"; climateIcon = "fa-cloud-sun"; climateColor = "#3b82f6"; }
                    else if(avgMood === 3) { climateText = "A Bit Heavy"; climateIcon = "fa-cloud"; climateColor = "#6366f1"; }
                    else if(avgMood === 4) { climateText = "Dark & Stormy"; climateIcon = "fa-cloud-showers-heavy"; climateColor = "#f59e0b"; }
                    else { climateText = "Complete Storm"; climateIcon = "fa-bolt"; climateColor = "#ef4444"; }

                    chartData = counts;

                    moodAnalyticsHtml = `
                    <div class="glass-panel" style="margin-top: 1.5rem; padding: 1.5rem; border-radius: 12px; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border);">
                        <h4 style="color: white; margin-bottom: 1.5rem; font-size: 1.1rem;"><i class="fa-solid fa-chart-pie" style="color: var(--primary);"></i> Your Mind's Climate Analytics</h4>
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 2rem; align-items: center; justify-content: center;">
                            <div style="flex: 1; min-width: 150px; text-align: center; display: flex; flex-direction: column; align-items: center;">
                                <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 50%; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; border: 2px solid ${climateColor};">
                                    <i class="fa-solid ${climateIcon} fa-3x" style="color: ${climateColor};"></i>
                                </div>
                                <h3 style="color: white; margin: 0; font-size: 1.3rem;">${climateText}</h3>
                                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.5rem;">Overall vibe based on ${totalLogs} check-ins</p>
                            </div>
                            
                            <div style="flex: 1; min-width: 200px; max-width: 250px; position: relative;">
                                <canvas id="moodChart" width="200" height="200"></canvas>
                            </div>
                        </div>
                    </div>`;
                }
            }

            if (profileHeaderBox) {
                profileHeaderBox.innerHTML = `
                    <div class="profile-avatar-large">${avatarDisplay}</div>
                    <h2 style="color: white; font-size: 2rem; margin-bottom: 0.5rem;">${escapeHTML(uData.nickname)}</h2>
                    <p style="color: var(--primary); font-size: 0.9rem; margin-bottom: 1rem;"><i class="fa-solid fa-calendar-days"></i> Joined ${joinDate}</p>
                    <p class="bio-text">"${escapeHTML(uData.bio || 'This user prefers to remain mysterious in the void.')}"</p>
                    
                    ${moodAnalyticsHtml}
                    
                    ${isMyProfile ? `<button class="btn-primary" style="margin-top: 1.5rem; background: transparent; border: 1px solid var(--primary);" onclick="document.getElementById('editProfileModal').classList.add('active')"><i class="fa-solid fa-pen"></i> Edit Profile</button>` : ''}
                `;

                // Draw the chart if data exists
                if (chartData && document.getElementById('moodChart')) {
                    setTimeout(() => {
                        const ctx = document.getElementById('moodChart').getContext('2d');
                        new Chart(ctx, {
                            type: 'doughnut',
                            data: {
                                labels: ['Light & Clear', 'Manageable', 'A Bit Heavy', 'Very Dark', 'Complete Storm'],
                                datasets: [{
                                    data: [chartData[1], chartData[2], chartData[3], chartData[4], chartData[5]],
                                    backgroundColor: [
                                        '#10b981', // Level 1 (Green)
                                        '#3b82f6', // Level 2 (Blue)
                                        '#6366f1', // Level 3 (Indigo)
                                        '#f59e0b', // Level 4 (Amber)
                                        '#ef4444'  // Level 5 (Red)
                                    ],
                                    borderWidth: 0,
                                    hoverOffset: 5
                                }]
                            },
                            options: {
                                responsive: true,
                                cutout: '75%',
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        backgroundColor: 'rgba(0,0,0,0.8)',
                                        titleFont: { size: 14 },
                                        bodyFont: { size: 14 },
                                        padding: 10,
                                        cornerRadius: 8,
                                        callbacks: {
                                            label: function(context) { return ' ' + context.label + ': ' + context.raw + ' days'; }
                                        }
                                    }
                                }
                            }
                        });
                    }, 100);
                }
            }

            const bioInput = document.getElementById('profileBioInput');
            if (isMyProfile && bioInput) bioInput.value = uData.bio || "";

            const q = query(collection(db, "posts"), where("authorUid", "==", targetUid));
            const postSnaps = await getDocs(q);
            
            if (userPostsContainer) userPostsContainer.innerHTML = '';
            
            if (postSnaps.empty) {
                if (userPostsContainer) userPostsContainer.innerHTML = `<p style="text-align:center; color:var(--text-muted);">No public posts yet.</p>`;
            } else {
                let postsArray = [];
                postSnaps.forEach(docSnap => {
                    let p = docSnap.data();
                    p.id = docSnap.id;
                    postsArray.push(p);
                });

                postsArray.sort((a, b) => {
                    const tA = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                    const tB = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                    return tB - tA;
                });

                postsArray.forEach(post => {
                    if(post.isVoid && post.authorUid !== user.uid) return; 
                    
                    const timeStr = post.createdAt && typeof post.createdAt.toDate === 'function' ? new Date(post.createdAt.toDate()).toLocaleString() : "Just now";
                    if (userPostsContainer) {
                        userPostsContainer.innerHTML += `
                            <div class="post-card glass-panel" style="${post.isVoid ? 'background: rgba(0,0,0,0.6);' : ''}">
                                <div style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.5rem;">${timeStr} ${post.isVoid ? '🕳️ (Void)' : ''}</div>
                                <p style="color: white; line-height: 1.5;">${escapeHTML(post.content)}</p>
                                <div style="margin-top: 1rem; color: var(--primary); font-size: 0.85rem;"><i class="fa-solid fa-heart"></i> ${post.likes || 0} Likes</div>
                            </div>
                        `;
                    }
                });
            }
        } catch(e) { 
            console.error(e); 
            if (profileHeaderBox) profileHeaderBox.innerHTML = `<p style="color:var(--danger); font-size:1.2rem; font-weight:bold;">CRASH: ${escapeHTML(e.message)}</p>`; 
        }
    }

    loadProfile();

    function compressImageToBase64(file, callback) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 150; 
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
                else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
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
}