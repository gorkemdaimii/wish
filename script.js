import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  Timestamp,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ====== FIREBASE CONFIG (PASTE YOURS) ====== */
const firebaseConfig = {
  apiKey: "PASTE",
  authDomain: "PASTE",
  projectId: "PASTE",
  storageBucket: "PASTE",
  messagingSenderId: "PASTE",
  appId: "PASTE"
};
/* ========================================= */

const allowedNames = [
  "muhammed rasim can","muhammed","muhammed rasim",
  "bersu göynük","bersu",
  "şevval honca","şevval","balım",
  "samet öztürk","samet",
  "görkem","görkem daimi","görkem daimi demirel",
  "zehra","zehra akar"
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

let unlocked = false;
let isAdminLoggedIn = false;
let wishesCache = [];

/* ---------- UI helpers ---------- */
function setText(id, msg) {
  const el = $(id);
  if (el) el.innerText = msg || "";
}

function lockUserForm() {
  $("name") && ($("name").disabled = true);
  $("wish") && ($("wish").disabled = true);
  $("submitBtn") && ($("submitBtn").disabled = true);
}

function renderFakeOrnaments(count = 10) {
  // locked & cannot read real wishes -> show fake gifts
  wishesCache = Array.from({ length: count }).map(() => ({ name: "", wish: "" }));
  renderWishes(false);
}

function renderWishes(canSeeText) {
  const wrap = $("wishes");
  if (!wrap) return;

  wrap.innerHTML = "";

  wishesCache.forEach((w) => {
    const el = document.createElement("div");
    const showText = canSeeText;

    el.className = "wish" + (showText ? "" : " locked");

    el.style.top = (Math.random() * 62 + 22) + "%";
    el.style.left = (Math.random() * 58 + 21) + "%";

    el.innerText = showText ? `${w.name}: ${w.wish}` : "🎁";
    wrap.appendChild(el);
  });
}

/* ---------- WATCH SETTINGS ---------- */
function watchUnlocked() {
  return onSnapshot(
    SETTINGS_DOC,
    (snap) => {
      unlocked = !!snap.data()?.unlocked;

      if (isUserPage()) {
        setText("hint", unlocked ? "Dilekler açıldı 🎉" : "Dilekler kilitli. Yılbaşında açılacak ✨");
      }
      if (isAdminPage()) {
        setText("adminStatus", unlocked ? "Dilekler AÇIK 🎉" : "Dilekler KİLİTLİ 🔒");
      }

      // user locked -> fake ornaments (because rules deny read)
      if (isUserPage() && !unlocked) {
        renderFakeOrnaments(12);
      }
    },
    (e) => {
      unlocked = false;
      if (isUserPage()) setText("hint", "Settings okunamadı: " + (e?.code || "unknown"));
      if (isUserPage()) renderFakeOrnaments(10);
    }
  );
}

/* ---------- WATCH WISHES (only when allowed) ---------- */
let unsubscribeWishes = null;

function startWatchingWishes() {
  if (unsubscribeWishes) unsubscribeWishes();

  unsubscribeWishes = onSnapshot(
    WISHES_COL,
    (snap) => {
      wishesCache = snap.docs.map(d => d.data());

      const canSeeText = unlocked || (isAdminPage() && isAdminLoggedIn);
      renderWishes(canSeeText);
    },
    (e) => {
      // index locked -> permission denied expected (rules)
      if (isUserPage() && !unlocked) {
        renderFakeOrnaments(12);
        return;
      }
      // admin not logged -> permission denied expected
      if (isAdminPage() && !isAdminLoggedIn && !unlocked) {
        renderFakeOrnaments(10);
        return;
      }
      // otherwise show error
      if (isUserPage()) setText("error", "Dilekler okunamadı: " + (e?.code || e?.message || "unknown"));
      if (isAdminPage()) setText("adminError", "Dilekler okunamadı: " + (e?.code || e?.message || "unknown"));
    }
  );
}

/* ---------- USER SUBMIT ---------- */
async function submitWish() {
  setText("error", "");

  const nameInput = $("name");
  const wishInput = $("wish");
  if (!nameInput || !wishInput) return;

  const name = norm(nameInput.value);
  const wish = (wishInput.value || "").trim();

  if (!name || !wish) return setText("error", "İsim ve dilek zorunlu.");
  if (!allowedNames.includes(name)) return setText("error", "Bu isim liste dışı.");
  if (wish.length > 280) return setText("error", "Dilek max 280 karakter.");

  const wishRef = doc(db, "wishes", name);

  try {
    await setDoc(wishRef, { name, wish, createdAt: Timestamp.now() }, { merge: false });
    lockUserForm();
    setText("hint", "Dileğin kaydedildi 🎄 Yılbaşında açılacak.");
  } catch (e) {
    setText("error", "Gönderilemedi: " + (e?.code || e?.message || "unknown"));
    // doc exists -> lock UX
    lockUserForm();
  }
}

/* ---------- ADMIN ---------- */
async function adminLogin() {
  setText("adminError", "");
  const email = $("adminEmail")?.value?.trim();
  const pass = $("adminPass")?.value;

  if (!email || !pass) return setText("adminError", "Email + şifre gir.");

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
  } catch (e) {
    setText("adminError", "Yetki yok: " + (e?.code || "unknown"));
  }
}

async function resetAllWishes() {
  const ok = confirm("TÜM DİLEKLER SİLİNECEK. Geri dönüş yok. Emin misin?");
  if (!ok) return;

  setText("adminError", "");
  try {
    await setUnlocked(false);

    const snap = await getDocs(WISHES_COL);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));

    setText("adminStatus", "Sıfırlandı ✅");
  } catch (e) {
    setText("adminError", "Reset hata: " + (e?.code || "unknown"));
  }
}

/* ---------- WIRING ---------- */
function wireUser() {
  $("submitBtn")?.addEventListener("click", submitWish);

  $("name")?.addEventListener("blur", () => {
    const name = norm($("name")?.value);
    if (!name) return;
    if (wishesCache.some(w => w.name === name)) {
      lockUserForm();
      setText("error", "Bu isim için zaten dilek var 🎄");
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
    isAdminLoggedIn = !!user;
    setText("adminStatus", user ? "Admin online ✅" : "Admin login gerekli 🔐");
    startWatchingWishes(); // login olunca permission kalkar
  });
}

/* ---------- INIT ---------- */
watchUnlocked();
startWatchingWishes();

if (isUserPage()) wireUser();
if (isAdminPage()) wireAdmin();
