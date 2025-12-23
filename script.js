import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, serverTimestamp, deleteDoc,
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/************ 1) FIREBASE CONFIG ************/
const firebaseConfig = {
  apiKey: "PASTE",
  authDomain: "PASTE",
  projectId: "PASTE",
  storageBucket: "PASTE",
  messagingSenderId: "PASTE",
  appId: "PASTE"
};
/********************************************/

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/************ 2) APP RULES (client-side UX) ************/
const allowedNames = [
  "muhammed rasim can","muhammed","muhammed rasim",
  "bersu göynük","bersu",
  "şevval honca","şevval","balım",
  "samet öztürk","samet",
  "görkem","görkem daimi","görkem daimi demirel",
  "zehra","zehra akar"
];

const SETTINGS_DOC = doc(db, "settings", "public");
/********************************************************/

/* ====== Helpers ====== */
const $ = (id) => document.getElementById(id);

function normalizeName(s) {
  return (s || "").trim().toLowerCase();
}

/* ====== Public: Watch unlocked flag ====== */
async function ensureSettingsExists() {
  const snap = await getDoc(SETTINGS_DOC);
  if (!snap.exists()) {
    // ilk kurulumda bir kez admin'den setlenebilir.
    // burada otomatik setlemiyoruz (rules admin ister).
  }
}

function watchUnlockStatus(onChange) {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    const unlocked = !!snap.data()?.unlocked;
    onChange(unlocked);
  }, () => {
    // settings doc yoksa vs
    onChange(false);
  });
}

/* ====== User Page ====== */
function isUserPage() {
  return !!$("submitBtn");
}

function renderWishes(wishes, unlocked) {
  const wrap = $("wishes");
  if (!wrap) return;

  wrap.innerHTML = "";
  wishes.forEach(w => {
    const el = document.createElement("div");
    el.className = "wish" + (unlocked ? " open" : " locked");
    el.style.top = Math.random() * 65 + 20 + "%";
    el.style.left = Math.random() * 60 + 20 + "%";
    el.innerText = unlocked ? `${w.name}: ${w.wish}` : "🎁";
    wrap.appendChild(el);
  });
}

async function fetchAllWishesIfUnlocked(unlocked) {
  if (!unlocked) {
    renderWishes([], false);
    return;
  }
  const snap = await getDocs(collection(db, "wishes"));
  const wishes = snap.docs.map(d => d.data());
  renderWishes(wishes, true);
}

async function submitWish() {
  const nameInput = $("name");
  const wishInput = $("wish");
  const error = $("error");
  const hint = $("hint");

  if (!nameInput || !wishInput || !error) return;

  error.innerText = "";
  hint && (hint.innerText = "");

  const name = normalizeName(nameInput.value);
  const wish = (wishInput.value || "").trim();

  if (!name || !wish) {
    error.innerText = "İsim ve dilek zorunlu.";
    return;
  }
  if (!allowedNames.includes(name)) {
    error.innerText = "Bu isim liste dışı.";
    return;
  }
  if (wish.length > 280) {
    error.innerText = "Dilek max 280 karakter.";
    return;
  }

  // 1 isim = 1 doc → doc id = name
  const wishRef = doc(db, "wishes", name);

  try {
    await setDoc(wishRef, {
      name,
      wish,
      createdAt: serverTimestamp()
    }, { merge: false });

    nameInput.disabled = true;
    wishInput.disabled = true;
    $("submitBtn").disabled = true;
    hint && (hint.innerText = "Dileğin kaydedildi 🎄 Yılbaşında açılacak.");

  } catch (e) {
    // doc already exists => rules reddeder
    error.innerText = "Bu isim için zaten dilek var 🎄";
    nameInput.disabled = true;
    wishInput.disabled = true;
    $("submitBtn").disabled = true;
  }
}

function wireUserPage() {
  $("submitBtn")?.addEventListener("click", submitWish);

  // unlock durumuna göre listeyi çek
  watchUnlockStatus(async (unlocked) => {
    const hint = $("hint");
    if (!unlocked) {
      hint && (hint.innerText = "Dilekler kilitli. Yılbaşında açılacak ✨");
      // kilitliyken dilekleri okumuyoruz
      renderWishes([], false);
      return;
    }
    hint && (hint.innerText = "Dilekler açıldı 🎉");
    await fetchAllWishesIfUnlocked(true);
  });
}

/* ====== Admin Page ====== */
function isAdminPage() {
  return !!$("adminLoginBtn");
}

function setAdminStatus(msg) {
  const s = $("adminStatus");
  if (s) s.innerText = msg || "";
}

async function adminLogin() {
  const email = $("adminEmail")?.value?.trim();
  const pass = $("adminPass")?.value;

  const err = $("adminError");
  if (err) err.innerText = "";

  if (!email || !pass) {
    if (err) err.innerText = "Email + şifre gir.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    setAdminStatus("Giriş tamam ✅");
  } catch (e) {
    if (err) err.innerText = "Giriş başarısız. Email/şifre kontrol et.";
  }
}

async function setUnlocked(value) {
  const err = $("adminError");
  if (err) err.innerText = "";

  try {
    await setDoc(SETTINGS_DOC, { unlocked: !!value }, { merge: true });
    setAdminStatus(value ? "Dilekler AÇIK 🎉" : "Dilekler KİLİTLİ 🔒");
  } catch (e) {
    if (err) err.innerText = "Yetki yok. Admin login gerekli.";
  }
}

async function resetAllWishes() {
  const ok = confirm("TÜM DİLEKLER SİLİNECEK. Geri dönüş yok. Emin misin?");
  if (!ok) return;

  const err = $("adminError");
  if (err) err.innerText = "";

  try {
    // önce kilitle
    await setUnlocked(false);

    // tüm dilekleri sil
    const snap = await getDocs(collection(db, "wishes"));
    const deletions = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletions);

    setAdminStatus("Sıfırlandı ✅ Herkes tekrar dilek yazabilir.");
  } catch (e) {
    if (err) err.innerText = "Reset için admin yetkisi lazım.";
  }
}

function wireAdminPage() {
  $("adminLoginBtn")?.addEventListener("click", adminLogin);
  $("unlockBtn")?.addEventListener("click", () => setUnlocked(true));
  $("lockBtn")?.addEventListener("click", () => setUnlocked(false));
  $("resetBtn")?.addEventListener("click", resetAllWishes);

  // auth state
  onAuthStateChanged(auth, (user) => {
    setAdminStatus(user ? "Admin online ✅" : "Admin login gerekli 🔐");
  });

  // unlock durumunu göster
  watchUnlockStatus((unlocked) => {
    setAdminStatus(unlocked ? "Dilekler AÇIK 🎉" : "Dilekler KİLİTLİ 🔒");
  });
}

/* ====== INIT ====== */
await ensureSettingsExists();

if (isUserPage()) wireUserPage();
if (isAdminPage()) wireAdminPage();
