import { auth, db, googleProvider } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const completeProfileModal = document.getElementById('completeProfileModal');
const completeProfileForm = document.getElementById('completeProfileForm');

let currentUserData = null;
let pendingGoogleUser = null; 

// Helper to pick avatar based on gender
function getAvatarIcon(gender) {
    if (gender === 'Female') return 'fa-person-dress';
    if (gender === 'Male') return 'fa-person';
    return 'fa-user-astronaut';
}

// Listen to Auth State
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().phone !== "Pending") {
            currentUserData = docSnap.data();
            
            // --- ENFORCE HARD BAN ---
            if (currentUserData.banStatus === "hard") {
                await signOut(auth);
                localStorage.removeItem('depressDoomerUser');
                alert("🚨 Your account has been permanently banned from the platform.");
                window.location.href = "login.html";
                return;
            }

            let adminRoles = null;
            if (user.email === 'mentalistwuwi@gmail.com') {
                adminRoles = { view_reports: true, view_identities: true, isSuperAdmin: true };
            } else {
                const adminDocEmail = await getDoc(doc(db, "admins", user.email));
                if (adminDocEmail.exists()) adminRoles = adminDocEmail.data();
            }

            localStorage.setItem('depressDoomerUser', JSON.stringify({
                uid: user.uid,
                email: user.email,
                nickname: currentUserData.nickname,
                avatar: getAvatarIcon(currentUserData.gender),
                banStatus: currentUserData.banStatus || "none",
                adminRoles: adminRoles
            }));
            
            if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
                if (!completeProfileModal || completeProfileModal.style.display === 'none') {
                    window.location.href = "index.html";
                }
            }
        }
    } else {
        currentUserData = null;
        localStorage.removeItem('depressDoomerUser');
    }
});

// Handle Signup
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const nickname = document.getElementById('nickname').value;
        if (nickname.includes(' ')) {
            alert("Nicknames cannot contain spaces! Please use an underscore or join the words together.");
            submitBtn.disabled = false;
            return;
        }

        try {
            const realName = document.getElementById('realName').value;
            const age = document.getElementById('age').value;
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const gender = document.getElementById('gender').value;

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                realName,
                age,
                phone,
                gender,
                email,
                nickname,
                banStatus: "none", // Default is active
                createdAt: new Date().toISOString()
            });

            window.location.href = "index.html";
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
            submitBtn.disabled = false;
        }
    });
}

// Handle Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await signInWithEmailAndPassword(auth, email, password);
            // Redirection happens in onAuthStateChanged
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
            submitBtn.disabled = false;
        }
    });
}

// Handle Google Login
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists() || docSnap.data().phone === "Pending") {
                pendingGoogleUser = user;
                document.getElementById('cpName').value = user.displayName || "";
                document.getElementById('cpNickname').value = "Anon_" + Math.floor(Math.random() * 10000);
                document.querySelector('.auth-wrapper').style.display = 'none';
                completeProfileModal.classList.add('active');
            } else {
                window.location.href = "index.html";
            }
        } catch (error) { alert("Error: " + error.message); }
    });
}

// Handle Complete Profile Form
if (completeProfileForm) {
    completeProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = completeProfileForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const nickname = document.getElementById('cpNickname').value;
        if (nickname.includes(' ')) {
            alert("Nicknames cannot contain spaces! Please use an underscore.");
            submitBtn.disabled = false;
            return;
        }

        try {
            const realName = document.getElementById('cpName').value;
            const phone = document.getElementById('cpPhone').value;
            const gender = document.getElementById('cpGender').value;
            const age = document.getElementById('cpAge').value;

            await setDoc(doc(db, "users", pendingGoogleUser.uid), {
                realName, email: pendingGoogleUser.email, nickname, phone, gender, age,
                banStatus: "none",
                createdAt: new Date().toISOString()
            });

            window.location.href = "index.html";
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
            submitBtn.disabled = false;
        }
    });
}
