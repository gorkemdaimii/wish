/************ CONFIG ************/
const allowedNames = [
  "muhammed rasim can","muhammed","muhammed rasim",
  "bersu göynük","bersu",
  "şevval honca","şevval","balım",
  "samet öztürk","samet",
  "görkem","görkem daimi","görkem daimi demirel",
  "zehra","zehra akar"
];

const ADMIN_PASSWORD = "2025"; // değiştir
/********************************/

const wishesContainer = document.getElementById("wishes");
const error = document.getElementById("error");
const adminError = document.getElementById("adminError");

let unlocked = localStorage.getItem("unlocked") === "true";

/* ===== HELPERS ===== */
function getWishes() {
  return JSON.parse(localStorage.getItem("wishes") || "[]");
}

function saveWishes(data) {
  localStorage.setItem("wishes", JSON.stringify(data));
}

/* ===== ADD WISH ===== */
function addWish() {
  const nameInput = document.getElementById("name");
  const wishInput = document.getElementById("wish");

  const name = nameInput.value.trim().toLowerCase();
  const wish = wishInput.value.trim();

  error.innerText = "";

  if (!name || !wish) {
    error.innerText = "İsim ve dilek zorunlu.";
    return;
  }

  if (!allowedNames.includes(name)) {
    error.innerText = "Bu isim dilek listesinde yok.";
    return;
  }

  let wishes = getWishes();

  if (wishes.some(w => w.name === name)) {
    error.innerText = "Bu isim için zaten bir dilek var 🎄";
    lockForm();
    return;
  }

  wishes.push({
    name,
    wish,
    date: new Date().toISOString()
  });

  saveWishes(wishes);
  lockForm();
  renderWishes();
}

/* ===== LOCK FORM ===== */
function lockForm() {
  const nameInput = document.getElementById("name");
  const wishInput = document.getElementById("wish");

  if (!nameInput) return;

  nameInput.disabled = true;
  wishInput.disabled = true;
}

/* ===== AUTO LOCK ON LOAD ===== */
function autoLockIfExists() {
  const nameInput = document.getElementById("name");
  if (!nameInput) return;

  const name = nameInput.value.trim().toLowerCase();
  const wishes = getWishes();

  if (wishes.some(w => w.name === name)) {
    lockForm();
    error.innerText = "Bu isim için dilek zaten bırakılmış 🎄";
  }
}

/* ===== RENDER WISHES ===== */
function renderWishes() {
  if (!wishesContainer) return;

  wishesContainer.innerHTML = "";
  const wishes = getWishes();

  wishes.forEach(w => {
    const el = document.createElement("div");
    el.className = "wish" + (unlocked ? " open" : " locked");

    el.style.top = Math.random() * 65 + 20 + "%";
    el.style.left = Math.random() * 60 + 20 + "%";

    el.innerText = unlocked ? `${w.name}: ${w.wish}` : "🎁";
    wishesContainer.appendChild(el);
  });
}

/* ===== ADMIN ===== */
function unlockWishes() {
  const pass = document.getElementById("adminPass").value;
  if (pass !== ADMIN_PASSWORD) {
    adminError.innerText = "Şifre yanlış.";
    return;
  }
  localStorage.setItem("unlocked", "true");
  alert("🎉 Dilekler açıldı");
}

function lockWishes() {
  localStorage.setItem("unlocked", "false");
  alert("🔒 Dilekler tekrar kilitlendi");
}

/* ===== INIT ===== */
renderWishes();
/* ===== RESET ALL ===== */
function resetAllWishes() {
  const confirmReset = confirm(
    "TÜM DİLEKLER SİLİNECEK!\nBu işlem geri alınamaz.\nDevam edilsin mi?"
  );

  if (!confirmReset) return;

  localStorage.removeItem("wishes");
  localStorage.removeItem("unlocked");

  alert("🎄 Tüm dilekler sıfırlandı");

  // Admin paneldeysek inputları da temizle
  if (document.getElementById("adminPass")) {
    document.getElementById("adminPass").value = "";
  }

  // Kullanıcı sayfasındaysak formu tekrar aç
  const nameInput = document.getElementById("name");
  const wishInput = document.getElementById("wish");

  if (nameInput && wishInput) {
    nameInput.disabled = false;
    wishInput.disabled = false;
    nameInput.value = "";
    wishInput.value = "";
    error.innerText = "";
  }

  renderWishes();
}
