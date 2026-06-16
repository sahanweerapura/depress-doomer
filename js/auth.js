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
const logoutBtn = document.getElementById('logoutBtn');
const loginBtn = document.getElementById('loginBtn');

let currentUserData = null;

// Listen to Auth State
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Fetch user metadata from Firestore
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            localStorage.setItem('depressDoomerUser', JSON.stringify({
                uid: user.uid,
                email: user.email,
                nickname: currentUserData.nickname,
                avatar: "fa-user-secret"
            }));
        }
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
        currentUserData = null;
        localStorage.removeItem('depressDoomerUser');
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
});

// Handle Signup
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating Account...";

        try {
            const realName = document.getElementById('realName').value;
            const age = document.getElementById('age').value;
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('email').value;
            const nickname = document.getElementById('nickname').value;
            const password = document.getElementById('password').value;

            // Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save Real Details to Firestore (Admin only via Security Rules)
            await setDoc(doc(db, "users", user.uid), {
                realName,
                age,
                phone,
                email,
                nickname,
                createdAt: new Date().toISOString()
            });

            alert("Account created successfully! Welcome to Depress Doomer.");
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
            
            // Check if user exists in Firestore
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                // First time Google Login - we need them to provide Nickname, Age, Phone.
                // For simplicity in this demo, we'll assign a random nickname and ask them to update later,
                // but strictly speaking they should provide age and phone.
                const randomNickname = "Anon_" + Math.floor(Math.random() * 10000);
                await setDoc(doc(db, "users", user.uid), {
                    realName: user.displayName || "Google User",
                    email: user.email,
                    nickname: randomNickname,
                    phone: "Pending",
                    age: "Pending",
                    createdAt: new Date().toISOString()
                });
                alert("Please note: Your nickname is " + randomNickname + ". You can change this later.");
            }
            
            window.location.href = "index.html";
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        }
    });
}

// Handle Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = "login.html";
        } catch (error) {
            console.error(error);
            alert("Error logging out.");
        }
    });
}
