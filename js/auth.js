import { auth, db, googleProvider } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// UI Elements
const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');
const googleLoginBtn = document.getElementById('googleLoginBtn');

// Complete Profile Modal Elements
const completeProfileModal = document.getElementById('completeProfileModal');
const completeProfileForm = document.getElementById('completeProfileForm');

let currentUserData = null;
let pendingGoogleUser = null; // Temp hold user if profile is incomplete

// Listen to Auth State
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().phone !== "Pending") {
            currentUserData = docSnap.data();
            
            // Check if user is an admin
            let adminRoles = null;
            if (user.email === 'mentalistwuwi@gmail.com') {
                adminRoles = { view_reports: true, view_identities: true, isSuperAdmin: true };
            } else {
                const adminDocEmail = await getDoc(doc(db, "admins", user.email));
                if (adminDocEmail.exists()) {
                    adminRoles = adminDocEmail.data();
                }
            }

            localStorage.setItem('depressDoomerUser', JSON.stringify({
                uid: user.uid,
                email: user.email,
                nickname: currentUserData.nickname,
                avatar: "fa-user-secret",
                adminRoles: adminRoles
            }));
            
            // If we are on login or signup page, redirect to home
            if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
                // Don't redirect if we are showing the complete profile modal
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
        submitBtn.textContent = "Creating Account...";

        const nickname = document.getElementById('nickname').value;
        
        // --- NEW: Block Spaces in Nickname ---
        if (nickname.includes(' ')) {
            alert("Nicknames cannot contain spaces! Please use an underscore or join the words together (e.g., Sad_Doomer).");
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Anonymous Account";
            return;
        }

        try {
            const realName = document.getElementById('realName').value;
            const age = document.getElementById('age').value;
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const gender = document.getElementById('gender').value;

            // Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save Real Details to Firestore
            await setDoc(doc(db, "users", user.uid), {
                realName,
                age,
                phone,
                gender,
                email,
                nickname,
                createdAt: new Date().toISOString()
            });

            window.location.href = "index.html";
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Anonymous Account";
        }
    });
}

// Handle Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Logging in...";

        try {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "index.html";
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = "Login";
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
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        }
    });
}

// Handle Complete Profile Form
if (completeProfileForm) {
    completeProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = completeProfileForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        const nickname = document.getElementById('cpNickname').value;

        // --- NEW: Block Spaces in Nickname ---
        if (nickname.includes(' ')) {
            alert("Nicknames cannot contain spaces! Please use an underscore or join the words together.");
            submitBtn.disabled = false;
            submitBtn.textContent = "Save & Continue";
            return;
        }

        try {
            const realName = document.getElementById('cpName').value;
            const phone = document.getElementById('cpPhone').value;
            const gender = document.getElementById('cpGender').value;
            const age = document.getElementById('cpAge').value;

            await setDoc(doc(db, "users", pendingGoogleUser.uid), {
                realName: realName,
                email: pendingGoogleUser.email,
                nickname: nickname,
                phone: phone,
                gender: gender,
                age: age,
                createdAt: new Date().toISOString()
            });

            localStorage.setItem('depressDoomerUser', JSON.stringify({
                uid: pendingGoogleUser.uid,
                email: pendingGoogleUser.email,
                nickname: nickname,
                avatar: "fa-user-secret"
            }));

            window.location.href = "index.html";
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = "Save & Continue";
        }
    });
}
