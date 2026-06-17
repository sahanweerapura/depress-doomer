// Translations for English and Sinhala
const translations = {
    en: {
        nav: {
            liveChat: "Live Chat",
            login: "Login",
            logout: "Logout",
            feed: "Home"
        },
        feed: {
            sharePrompt: "Share what's on your mind...",
            postButton: "Post Anonymously",
            reply: "Reply"
        },
        sidebar: {
            about: "About Us",
            description: "Depress Doomer is a safe haven. Share your mental struggles anonymously and find people who understand.",
            privacy: "100% Anonymous public front."
        },
        auth: {
            loginTitle: "Welcome Back",
            signupTitle: "Join Depress Doomer",
            email: "Email Address",
            password: "Password",
            loginBtn: "Login",
            googleLogin: "Sign in with Google",
            noAccount: "Don't have an account?",
            haveAccount: "Already have an account?",
            signupBtn: "Create Anonymous Account",
            privacyDisclaimerTitle: "Privacy Guarantee:",
            privacyDisclaimer: "Your real identity (Name, Email, Phone, Age) is strictly collected to prevent spam and for internal identity verification. It will NEVER be shared publicly. You will post and chat completely anonymously using a Nickname.",
            realName: "Real Full Name",
            age: "Age",
            phone: "Contact Number",
            nickname: "Public Nickname (This is what others will see)"
        },
        chat: {
            title: "General Anonymous Chat",
            warning: "WARNING: Please avoid sharing your personal information with anyone. Stay completely anonymous.",
            send: "Send"
        }
    },
    si: {
        nav: {
            liveChat: "සජීවී චැට්",
            login: "ඇතුල් වන්න",
            logout: "පිටවෙන්න",
            feed: "මුල් පිටුව"
        },
        feed: {
            sharePrompt: "ඔබගේ සිතුවිලි බෙදාගන්න...",
            postButton: "නිර්නාමිකව පළ කරන්න",
            reply: "පිළිතුරු"
        },
        sidebar: {
            about: "අප ගැන",
            description: "Depress Doomer යනු සුරක්ෂිත ස්ථානයකි. ඔබගේ මානසික ගැටළු නිර්නාමිකව බෙදාගෙන ඔබව තේරුම් ගන්නා අය සොයාගන්න.",
            privacy: "100% නිර්නාමිකයි."
        },
        auth: {
            loginTitle: "නැවත සාදරයෙන් පිළිගනිමු",
            signupTitle: "Depress Doomer හා සම්බන්ධ වන්න",
            email: "විද්‍යුත් තැපෑල",
            password: "මුරපදය",
            loginBtn: "ඇතුල් වන්න",
            googleLogin: "Google හරහා ඇතුල් වන්න",
            noAccount: "ගිණුමක් නැද්ද?",
            haveAccount: "දැනටමත් ගිණුමක් තිබේද?",
            signupBtn: "නිර්නාමික ගිණුම සාදන්න",
            privacyDisclaimerTitle: "පෞද්ගලිකත්ව සහතිකය:",
            privacyDisclaimer: "ඔබගේ සැබෑ තොරතුරු (නම, විද්‍යුත් තැපෑල, දුරකථන, වයස) එකතු කරනු ලබන්නේ අනන්‍යතාවය තහවුරු කිරීමට පමණි. ඒවා කිසිවිටෙක ප්‍රසිද්ධ නොකෙරේ. ඔබ සැමවිටම අන්වර්ථ නාමයකින් (Nickname) නිර්නාමිකව පෙනී සිටිනු ඇත.",
            realName: "සැබෑ සම්පූර්ණ නම",
            age: "වයස",
            phone: "දුරකථන අංකය",
            nickname: "අන්වර්ථ නාමය (අන් අයට පෙනෙන නම)"
        },
        chat: {
            title: "පොදු නිර්නාමික චැට්",
            warning: "අවවාදයයි: කරුණාකර ඔබගේ පෞද්ගලික තොරතුරු කිසිවෙකු සමඟ බෙදාගැනීමෙන් වළකින්න. සම්පූර්ණයෙන්ම නිර්නාමිකව සිටින්න.",
            send: "යවන්න"
        }
    }
};

let currentLang = localStorage.getItem('lang') || 'en';

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const keyPath = el.getAttribute('data-i18n');
        const keys = keyPath.split('.');
        let translation = translations[currentLang];
        for (const k of keys) {
            translation = translation[k];
        }
        if (translation) {
            if (el.querySelector('i')) {
                const icon = el.querySelector('i').outerHTML;
                el.innerHTML = translation + ' ' + icon;
            } else {
                el.textContent = translation;
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const switcher = document.getElementById('langSwitcher');
    if (switcher) {
        switcher.value = currentLang;
        switcher.addEventListener('change', (e) => {
            currentLang = e.target.value;
            localStorage.setItem('lang', currentLang);
            applyTranslations();
        });
    }
    applyTranslations();
});
