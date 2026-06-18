import { auth, db, googleProvider } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const signupForm = document.getElementById('signupForm'); const loginForm = document.getElementById('loginForm'); const googleLoginBtn = document.getElementById('googleLoginBtn'); const completeProfileModal = document.getElementById('completeProfileModal'); const completeProfileForm = document.getElementById('completeProfileForm');
let currentUserData = null; let pendingGoogleUser = null; 

function getAvatarIcon(gender) {
    if (gender === 'Female') return 'fa-person-dress';
    if (gender === 'Male') return 'fa-person';
    return 'fa-user-astronaut';
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists() && docSnap.data().phone !== "Pending") {
            currentUserData = docSnap.data();
            if (currentUserData.banStatus === "hard") { await signOut(auth); localStorage.removeItem('depressDoomerUser'); alert("🚨 Your account has been permanently banned."); window.location.href = "login.html"; return; }
            let adminRoles = null;
            if (user.email === 'mentalistwuwi@gmail.com') adminRoles = { view_reports: true, view_identities: true, isSuperAdmin: true };
            else { const adminDocEmail = await getDoc(doc(db, "admins", user.email)); if (adminDocEmail.exists()) adminRoles = adminDocEmail.data(); }

            localStorage.setItem('depressDoomerUser', JSON.stringify({
                uid: user.uid, email: user.email, nickname: currentUserData.nickname,
                avatar: getAvatarIcon(currentUserData.gender),
                avatarBase64: currentUserData.avatarBase64 || null, // Saves the new string
                bio: currentUserData.bio || "", banStatus: currentUserData.banStatus || "none", adminRoles: adminRoles
            }));
            
            if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
                if (!completeProfileModal || completeProfileModal.style.display === 'none') window.location.href = "index.html";
            }
        }
    } else { currentUserData = null; localStorage.removeItem('depressDoomerUser'); }
});

if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault(); const submitBtn = signupForm.querySelector('button[type="submit"]'); submitBtn.disabled = true;
        const nickname = document.getElementById('nickname').value;
        if (nickname.includes(' ')) { alert("Nicknames cannot contain spaces!"); submitBtn.disabled = false; return; }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            await setDoc(doc(db, "users", userCredential.user.uid), { realName: document.getElementById('realName').value, age: document.getElementById('age').value, phone: document.getElementById('phone').value, gender: document.getElementById('gender').value, email: document.getElementById('email').value, nickname, banStatus: "none", bio: "", avatarBase64: null, createdAt: new Date().toISOString() });
            window.location.href = "index.html";
        } catch (error) { alert("Error: " + error.message); submitBtn.disabled = false; }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); const submitBtn = loginForm.querySelector('button[type="submit"]'); submitBtn.disabled = true;
        try { await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); } 
        catch (error) { alert("Error: " + error.message); submitBtn.disabled = false; }
    });
}

if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider); const docSnap = await getDoc(doc(db, "users", result.user.uid));
            if (!docSnap.exists() || docSnap.data().phone === "Pending") { pendingGoogleUser = result.user; document.getElementById('cpName').value = result.user.displayName || ""; document.getElementById('cpNickname').value = "Anon_" + Math.floor(Math.random() * 10000); document.querySelector('.auth-wrapper').style.display = 'none'; completeProfileModal.classList.add('active'); } 
            else window.location.href = "index.html";
        } catch (error) { alert("Error: " + error.message); }
    });
}

if (completeProfileForm) {
    completeProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault(); const submitBtn = completeProfileForm.querySelector('button[type="submit"]'); submitBtn.disabled = true;
        const nickname = document.getElementById('cpNickname').value;
        if (nickname.includes(' ')) { alert("Nicknames cannot contain spaces!"); submitBtn.disabled = false; return; }
        try {
            await setDoc(doc(db, "users", pendingGoogleUser.uid), { realName: document.getElementById('cpName').value, email: pendingGoogleUser.email, nickname, phone: document.getElementById('cpPhone').value, gender: document.getElementById('cpGender').value, age: document.getElementById('cpAge').value, banStatus: "none", bio: "", avatarBase64: null, createdAt: new Date().toISOString() });
            window.location.href = "index.html";
        } catch (error) { alert("Error: " + error.message); submitBtn.disabled = false; }
    });
}
