(() => {
  const STORAGE_KEY = "kharido_cart_v1";

  // Utility functions
  function parsePrice(text) {
    if (!text) return 0;
    const num = text.replace(/[^0-9.]/g, "");
    return parseFloat(num) || 0;
  }

  function formatCurrency(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function escapeHtml(s) {
    return (s + "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
    );
  }

  // Cart management
  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateCartCountUI(cart);
  }

  function addToCart(product) {
    const cart = loadCart();
    const found = cart.find((i) => i.id === product.id);
    if (found) {
      found.quantity += 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }
    saveCart(cart);
  }

  function removeFromCart(id) {
    let cart = loadCart();
    cart = cart.filter((i) => i.id !== id);
    saveCart(cart);
    renderCartModal();
  }

  function changeQuantity(id, qty) {
    const cart = loadCart();
    const item = cart.find((i) => i.id === id);
    if (!item) return;
    item.quantity = Math.max(1, qty);
    saveCart(cart);
    renderCartModal();
  }

  function cartTotal(cart) {
    return cart.reduce((s, it) => s + it.price * it.quantity, 0);
  }

  // UI: Cart Icon in navbar
  function createCartIcon() {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;

    // Prevent duplicate icon insertion
    if(document.querySelector(".kharido-cart-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "kharido-cart-wrapper";
    wrapper.innerHTML = `
      <button id="kharido-cart-btn" aria-label="Open cart" aria-expanded="false" aria-controls="kharido-cart-modal">
        <span id="kharido-cart-icon" aria-hidden="true">🛒</span>
        <span id="kharido-cart-count" aria-live="polite">0</span>
      </button>
    `;
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.marginLeft = "12px";

    navbar.appendChild(wrapper);

    const cartBtn = document.getElementById("kharido-cart-btn");
    cartBtn.addEventListener("click", () => {
      const expanded = cartBtn.getAttribute("aria-expanded") === "true";
      toggleCartModal(!expanded);
      cartBtn.setAttribute("aria-expanded", String(!expanded));
    });

    updateCartCountUI(loadCart());
  }

  function updateCartCountUI(cartOrArray) {
    const countEl = document.getElementById("kharido-cart-count");
    if (!countEl) return;
    // Accept either array or cart object
    const cart = Array.isArray(cartOrArray) ? cartOrArray : loadCart();
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    countEl.textContent = count;

    // Animation pulse effect
    countEl.classList.remove("kharido-pulse");
    void countEl.offsetWidth; // trigger reflow for animation
    countEl.classList.add("kharido-pulse");
  }

 // Enhance existing product elements with add-to-cart buttons if missing
function enhanceExistingProducts() {
  const productEls = document.querySelectorAll(".products .product");
  let nextId = Date.now() % 100000;

  productEls.forEach((el, idx) => {
    const nameEl = el.querySelector("h4, h3, p");
    const name = nameEl ? nameEl.textContent.trim() : `Product ${idx + 1}`;

    let price = 0;
    const priceCandidate = Array.from(el.querySelectorAll("p")).find((p) =>
      /[\d]+(?:[.,]\d{1,2})?/.test(p.textContent)
    );
    if (priceCandidate) price = parsePrice(priceCandidate.textContent);

    const imgEl = el.querySelector("img");
    const imgSrc = imgEl ? imgEl.getAttribute("src") : "";

    const pid = `p-${nextId + idx}`;
    el.dataset.kharidoId = pid;

    // Check if product already has an "Add to Cart" button
    if (!el.querySelector(".kharido-add-btn") && !el.querySelector(".add-to-cart")) {
      const btn = document.createElement("button");
      btn.className = "kharido-add-btn";
      btn.type = "button";
      btn.innerHTML = `Add to Cart`;
      btn.style.cursor = "pointer";
      btn.style.marginTop = "8px";
      btn.addEventListener("click", () => {
        if (imgEl) flyToCartAnimation(imgEl);
        addToCart({ id: pid, name, price, img: imgSrc });
      });
      el.appendChild(btn);
    }
  });
}


  // Cart Modal creation and rendering
  function createCartModal() {
    if (document.getElementById("kharido-cart-modal")) return;

    const modal = document.createElement("div");
    modal.id = "kharido-cart-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="kharido-cart-backdrop" id="kharido-cart-backdrop" tabindex="-1"></div>
      <aside class="kharido-cart-panel" aria-labelledby="kharido-cart-header">
        <header class="kharido-cart-header" id="kharido-cart-header">
          <h3>Your Cart</h3>
          <button id="kharido-cart-close" aria-label="Close cart">×</button>
        </header>
        <div id="kharido-cart-items" class="kharido-cart-items" tabindex="0"></div>
        <footer class="kharido-cart-footer">
          <div class="kharido-cart-summary">
            <div>Subtotal: <strong id="kharido-cart-subtotal">$0.00</strong></div>
          </div>
          <div class="kharido-cart-actions">
            <button id="kharido-clear-cart" class="kharido-btn-secondary">Clear Cart</button>
            <button id="kharido-checkout" class="kharido-btn-primary">Checkout</button>
          </div>
        </footer>
      </aside>
    `;
    document.body.appendChild(modal);

    // Close handlers
    document.getElementById("kharido-cart-close").addEventListener("click", () => toggleCartModal(false));
    document.getElementById("kharido-cart-backdrop").addEventListener("click", () => toggleCartModal(false));

    // Clear cart
    document.getElementById("kharido-clear-cart").addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      updateCartCountUI([]);
      renderCartModal();
    });

    // Checkout (demo)
    document.getElementById("kharido-checkout").addEventListener("click", () => {
      const cart = loadCart();
      if (cart.length === 0) {
        alert("Your cart is empty.");
        return;
      }
      alert("Checkout - this is a demo. Cart will be cleared.");
      localStorage.removeItem(STORAGE_KEY);
      updateCartCountUI([]);
      renderCartModal();
      toggleCartModal(false);
    });

    renderCartModal();
  }

  // Render cart modal contents
  function renderCartModal() {
    const itemsEl = document.getElementById("kharido-cart-items");
    const subtotalEl = document.getElementById("kharido-cart-subtotal");
    if (!itemsEl || !subtotalEl) return;

    const cart = loadCart();
    itemsEl.innerHTML = "";

    if (cart.length === 0) {
      itemsEl.innerHTML = `<div class="kharido-empty">Your cart is empty. Add some items!</div>`;
      subtotalEl.textContent = formatCurrency(0);
      return;
    }

    cart.forEach((it) => {
      const row = document.createElement("div");
      row.className = "kharido-cart-row";
      row.innerHTML = `
        <img class="kharido-cart-thumb" src="${it.img}" alt="${escapeHtml(it.name)}" />
        <div class="kharido-cart-meta">
          <div class="kharido-cart-name">${escapeHtml(it.name)}</div>
          <div class="kharido-cart-price">${formatCurrency(it.price)}</div>
          <div class="kharido-qty-row">
            <button class="kharido-qty-decr" data-id="${it.id}" aria-label="Decrease quantity">−</button>
            <input class="kharido-qty-input" data-id="${it.id}" type="number" min="1" value="${it.quantity}" aria-label="Quantity for ${escapeHtml(it.name)}" />
            <button class="kharido-qty-incr" data-id="${it.id}" aria-label="Increase quantity">+</button>
            <button class="kharido-remove-item" data-id="${it.id}" aria-label="Remove ${escapeHtml(it.name)} from cart">Remove</button>
          </div>
        </div>
      `;
      itemsEl.appendChild(row);
    });

    subtotalEl.textContent = formatCurrency(cartTotal(cart));

    // Remove previous listeners to avoid duplicates
    const qtyDecrBtns = itemsEl.querySelectorAll(".kharido-qty-decr");
    const qtyIncrBtns = itemsEl.querySelectorAll(".kharido-qty-incr");
    const qtyInputs = itemsEl.querySelectorAll(".kharido-qty-input");
    const removeBtns = itemsEl.querySelectorAll(".kharido-remove-item");

    qtyDecrBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const cart = loadCart();
        const it = cart.find((x) => x.id === id);
        if (!it) return;
        changeQuantity(id, Math.max(1, it.quantity - 1));
      })
    );

    qtyIncrBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const cart = loadCart();
        const it = cart.find((x) => x.id === id);
        if (!it) return;
        changeQuantity(id, it.quantity + 1);
      })
    );

    qtyInputs.forEach((input) =>
      input.addEventListener("change", () => {
        const id = input.dataset.id;
        const val = parseInt(input.value) || 1;
        changeQuantity(id, val);
      })
    );

    removeBtns.forEach((btn) =>
      btn.addEventListener("click", () => removeFromCart(btn.dataset.id))
    );
  }

  // Show or hide cart modal
  function toggleCartModal(show) {
    const modal = document.getElementById("kharido-cart-modal");
    const cartBtn = document.getElementById("kharido-cart-btn");
    if (!modal) return;
    if (show) {
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      renderCartModal();
      document.body.style.overflow = "hidden";
      if(cartBtn) cartBtn.setAttribute("aria-expanded", "true");
    } else {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if(cartBtn) cartBtn.setAttribute("aria-expanded", "false");
    }
  }

  // Fly-to-cart animation on add
  function flyToCartAnimation(imgEl) {
    const cartIcon = document.getElementById("kharido-cart-icon");
    if (!imgEl || !cartIcon) return;

    const imgRect = imgEl.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();

    const clone = imgEl.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.left = `${imgRect.left}px`;
    clone.style.top = `${imgRect.top}px`;
    clone.style.width = `${imgRect.width}px`;
    clone.style.height = `${imgRect.height}px`;
    clone.style.transition = "transform 700ms cubic-bezier(.2,.8,.2,1), opacity 700ms";
    clone.style.zIndex = "9999";
    clone.style.pointerEvents = "none";
    clone.style.borderRadius = "8px";
    document.body.appendChild(clone);

    const dx = cartRect.left + cartRect.width / 2 - (imgRect.left + imgRect.width / 2);
    const dy = cartRect.top + cartRect.height / 2 - (imgRect.top + imgRect.height / 2);

    requestAnimationFrame(() => {
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`;
      clone.style.opacity = "0.6";
    });

    setTimeout(() => {
      clone.remove();
    }, 800);
  }

  // Hamburger menu toggle
  function initHamburger() {
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.getElementById("nav-menu");
    if (!hamburger || !navMenu) return;

    hamburger.addEventListener("click", () => {
      const expanded = hamburger.getAttribute("aria-expanded") === "true" || false;
      hamburger.setAttribute("aria-expanded", !expanded);
      navMenu.classList.toggle("active");
      hamburger.classList.toggle("active");
    });
  }

  // Optional: Search & Filter feature placeholder
  function initSearchAndFilter() {
    const searchInput = document.getElementById("search-input");
    const categorySelect = document.getElementById("category-filter");
    const products = document.querySelectorAll(".product");

    function filterProducts() {
      const searchVal = searchInput?.value.toLowerCase() || "";
      const categoryVal = categorySelect?.value || "all";

      products.forEach(product => {
        const name = product.textContent.toLowerCase();
        const category = product.getAttribute("data-category") || "";
        const matchesSearch = name.includes(searchVal);
        const matchesCategory = categoryVal === "all" || category === categoryVal;
        product.style.display = (matchesSearch && matchesCategory) ? "" : "none";
      });
    }

    searchInput?.addEventListener("input", filterProducts);
    categorySelect?.addEventListener("change", filterProducts);
  }

  // Initialization
  function init() {
    createCartIcon();
    enhanceExistingProducts();
    createCartModal();
    initHamburger();
    initSearchAndFilter();
  }

  // Expose some functions globally if needed
  window.kharidoCart = {
    addItem: addToCart,
    loadCart,
    saveCart,
    toggleCartModal,
    renderCartModal,
    clearCart: () => {
      localStorage.removeItem(STORAGE_KEY);
      updateCartCountUI([]);
      renderCartModal();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
