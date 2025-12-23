/* =========================
   ONE FILE: script.js
   - Works for index.html + admin.html
   - GitHub Pages friendly (no npm)
   ========================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  deleteDoc,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB7r0bhg-yTWJQCvMs7-1PbuClIDC0DGFg",
  authDomain: "wish-e4fb8.firebaseapp.com",
  projectId: "wish-e4fb8",
  storageBucket: "wish-e4fb8.firebasestorage.app",
  messagingSenderId: "387741708014",
  appId: "1:387741708014:web:a8bfda73f7ef7ba69dcdff",
  measurementId: "G-2J3NN1F60Q"
};
/********************************************/

const allowedNames = [
  "muhammed rasim can", "muhammed", "muhammed rasim",
  "bersu göynük", "bersu",
  "şevval honca", "şevval", "balım",
  "samet öztürk", "samet",
  "görkem", "görkem daimi", "görkem daimi demirel",
  "zehra", "zehra akar"
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const SETTINGS_DOC = doc(db, "settings", "public");
const WISHES_COL = collection(db, "wishes");

const $ = (id) => document.getElementById(id);
const norm = (s) => (s || "").trim().toLowerCase();

const isUserPage = () => !!$("submitBtn");
const isAdminPage = () => !!$("adminLoginBtn");

/* ========== GLOBAL STATE ========== */
let unlocked = false;
let wishesCache = []; // [{name,wish,createdAt}]
/* ================================= */

/* ========== UI HELPERS ========== */
function setText(id, msg) {
  const el = $(id);
  if (el) el.innerText = msg || "";
}

function lockUserForm() {
  const name = $("name");
  const wish = $("wish");
  const btn = $("submitBtn");
  if (name) name.disabled = true;
  if (wish) wish.disabled = true;
  if (btn) btn.disabled = true;
}

function unlockUserForm() {
  const name = $("name");
  const wish = $("wish");
  const btn = $("submitBtn");
  if (name) name.disabled = false;
  if (wish) wish.disabled = false;
  if (btn) btn.disabled = false;
}

function renderWishes() {
  const wrap = $("wishes");
  if (!wrap) return;

  wrap.innerHTML = "";

  // locked: show gifts; unlocked: show text
  wishesCache.forEach((w) => {
    const el = document.createElement("div");
    el.className = "wish" + (unlocked ? " open" : " locked");

    // random positions (keeps it dynamic)
    el.style.top = (Math.random() * 65 + 20) + "%";
    el.style.left = (Math.random() * 60 + 20) + "%";

    el.innerText = unlocked ? `${w.name}: ${w.wish}` : "🎁";
    wrap.appendChild(el);
  });
}
/* ================================ */

/* ========== FIRESTORE WATCHERS ========== */
function watchUnlocked() {
  return onSnapshot(
    SETTINGS_DOC,
    (snap) => {
      unlocked = !!snap.data()?.unlocked;

      if (isUserPage()) {
        setText("hint", unlocked ? "Dilekler açıldı 🎉" : "Dilekler kilitli. Yılbaşında açılacak ✨");
      }
      renderWishes();
    },
    () => {
      unlocked = false;
      if (isUserPage()) setText("hint", "Dilekler kilitli. (Settings okunamadı)");
      renderWishes();
    }
  );
}

function watchWishes() {
  // IMPORTANT: this requires rules to allow read for wishes (at least for gifts view)
  return onSnapshot(
    WISHES_COL,
    (snap) => {
      wishesCache = snap.docs.map((d) => d.data());
      renderWishes();
    },
    (e) => {
      // If rules block reads, you'll see it here
      if (isUserPage()) setText("error", "Dilekler okunamadı: " + (e?.code || e?.message || "unknown"));
      wishesCache = [];
      renderWishes();
    }
  );
}
/* ======================================= */

/* ========== USER ACTIONS ========== */
async function submitWish() {
  const nameInput = $("name");
  const wishInput = $("wish");

  if (!nameInput || !wishInput) return;

  setText("error", "");

  const name = norm(nameInput.value);
  const wish = (wishInput.value || "").trim();

  if (!name || !wish) {
    setText("error", "İsim ve dilek zorunlu.");
    return;
  }
  if (!allowedNames.includes(name)) {
    setText("error", "Bu isim liste dışı.");
    return;
  }
  if (wish.length > 280) {
    setText("error", "Dilek max 280 karakter.");
    return;
  }

  // 1 name = 1 doc (doc id = name)
  const wishRef = doc(db, "wishes", name);

  try {
    await setDoc(wishRef, {
      name,
      wish,
      createdAt: Timestamp.now()
    }, { merge: false });

    lockUserForm();
    setText("hint", "Dileğin kaydedildi 🎄 Yılbaşında açılacak.");
  } catch (e) {
    // If doc exists or permission denied, show real error
    const code = e?.code || "";
    if (code.includes("already-exists") || code.includes("permission-denied")) {
      setText("error", code.includes("already-exists")
        ? "Bu isim için zaten dilek var 🎄"
        : "Gönderilemedi: permission-denied (Rules kontrol et)");
      lockUserForm();
      return;
    }
    setText("error", "Gönderilemedi: " + (code || e?.message || "unknown"));
  }
}
/* ================================= */

/* ========== ADMIN ACTIONS ========== */
async function adminLogin() {
  setText("adminError", "");

  const email = $("adminEmail")?.value?.trim();
  const pass = $("adminPass")?.value;

  if (!email || !pass) {
    setText("adminError", "Email + şifre gir.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    setText("adminStatus", "Admin online ✅");
  } catch (e) {
    setText("adminError", "Giriş başarısız: " + (e?.code || "unknown"));
  }
}

async function setUnlocked(value) {
  setText("adminError", "");
  try {
    await setDoc(SETTINGS_DOC, { unlocked: !!value }, { merge: true });
    setText("adminStatus", value ? "Dilekler AÇIK 🎉" : "Dilekler KİLİTLİ 🔒");
  } catch (e) {
    setText("adminError", "Yetki yok: " + (e?.code || "unknown"));
  }
}

async function resetAllWishes() {
  const ok = confirm("TÜM DİLEKLER SİLİNECEK. Geri dönüş yok. Emin misin?");
  if (!ok) return;

  setText("adminError", "");

  try {
    // first lock
    await setUnlocked(false);

    // delete all wishes
    const snap = await getDocs(WISHES_COL);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));

    setText("adminStatus", "Sıfırlandı ✅ Herkes tekrar dilek yazabilir.");

  } catch (e) {
    setText("adminError", "Reset hata: " + (e?.code || "unknown"));
  }
}
/* ================================= */

/* ========== WIRING ========== */
function wireUser() {
  $("submitBtn")?.addEventListener("click", submitWish);

  // Optional: if user types a name that already exists, auto-lock
  $("name")?.addEventListener("blur", () => {
    const name = norm($("name")?.value);
    if (!name) return;

    // If wish exists for that name in cache, lock UX-side
    if (wishesCache.some((w) => w.name === name)) {
      lockUserForm();
      setText("error", "Bu isim için dilek zaten bırakılmış 🎄");
    }
  });

  setText("hint", "Dilekler kilitli. Yılbaşında açılacak ✨");
}

function wireAdmin() {
  $("adminLoginBtn")?.addEventListener("click", adminLogin);
  $("unlockBtn")?.addEventListener("click", () => setUnlocked(true));
  $("lockBtn")?.addEventListener("click", () => setUnlocked(false));
  $("resetBtn")?.addEventListener("click", resetAllWishes);

  onAuthStateChanged(auth, (user) => {
    setText("adminStatus", user ? "Admin online ✅" : "Admin login gerekli 🔐");
  });
}

function init() {
  // Start watchers (shared)
  watchUnlocked();
  watchWishes();

  if (isUserPage()) wireUser();
  if (isAdminPage()) wireAdmin();
}

init();

/* =========================
   NOTE (Rules reminder):
   - If wishes read is blocked, locked view can't show gifts.
   - Recommended for your UX:
       match /wishes/{id} { allow read: if true; ... }
   - Keep secret by showing only 🎁 when unlocked=false in UI.
   ========================= */
