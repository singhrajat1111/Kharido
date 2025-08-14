(() => {
  const STORAGE_KEY = "kharido_cart_v2";
  const CART_ANIMATION_DURATION = 700;

  // Utility functions
  const parsePrice = (text) => parseFloat((text || "").replace(/[^0-9.]/g, "")) || 0;
  
  const formatCurrency = (n) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(n);

  const escapeHtml = (s) => (s + "").replace(/[&<>"']/g, m => 
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  // Cart management
  const loadCart = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const saveCart = (cart) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateCartCountUI(cart);
    if (window.location.pathname.includes('cart.html')) renderCartPage();
  };

  const addToCart = (product) => {
    const cart = loadCart();
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({ 
        ...product, 
        quantity: 1,
        addedAt: new Date().toISOString()
      });
    }
    
    saveCart(cart);
    if (product.imgEl) flyToCartAnimation(product.imgEl);
  };

  const removeFromCart = (id) => {
    const cart = loadCart().filter(item => item.id !== id);
    saveCart(cart);
    renderCartModal();
  };

  const updateQuantity = (id, quantity) => {
    const cart = loadCart();
    const item = cart.find(item => item.id === id);
    if (!item) return;
    
    item.quantity = Math.max(1, quantity);
    saveCart(cart);
    renderCartModal();
  };

  const calculateTotal = (cart) => cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  // UI Functions
  const createCartIcon = () => {
    const navbar = document.querySelector(".navbar");
    if (!navbar || document.querySelector(".kharido-cart-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "kharido-cart-wrapper";
    wrapper.innerHTML = `
      <button id="kharido-cart-btn" aria-label="Cart" aria-expanded="false">
        <span id="kharido-cart-icon">🛒</span>
        <span id="kharido-cart-count" aria-live="polite">0</span>
      </button>
    `;
    
    navbar.appendChild(wrapper);
    document.getElementById("kharido-cart-btn").addEventListener("click", toggleCartModal);
  };

  const updateCartCountUI = (cart) => {
    const countEl = document.getElementById("kharido-cart-count");
    if (!countEl) return;
    
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    countEl.textContent = count;

    // Animation
    countEl.classList.remove("kharido-pulse");
    void countEl.offsetWidth;
    countEl.classList.add("kharido-pulse");
  };

  const flyToCartAnimation = (imgEl) => {
    const cartIcon = document.getElementById("kharido-cart-icon");
    if (!imgEl || !cartIcon) return;

    const imgRect = imgEl.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();
    const clone = imgEl.cloneNode(true);

    Object.assign(clone.style, {
      position: "fixed",
      left: `${imgRect.left}px`,
      top: `${imgRect.top}px`,
      width: `${imgRect.width}px`,
      height: `${imgRect.height}px`,
      transition: `all ${CART_ANIMATION_DURATION}ms cubic-bezier(.4,.8,.2,1)`,
      zIndex: 9999,
      pointerEvents: "none",
      borderRadius: "8px",
      objectFit: "cover"
    });

    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      const dx = cartRect.left - imgRect.left + cartRect.width/2 - imgRect.width/2;
      const dy = cartRect.top - imgRect.top + cartRect.height/2 - imgRect.height/2;
      
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`;
      clone.style.opacity = "0.5";
    });

    setTimeout(() => clone.remove(), CART_ANIMATION_DURATION);
  };

  const createCartModal = () => {
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
            <div>Subtotal: <strong id="kharido-cart-subtotal">₹0.00</strong></div>
          </div>
          <div class="kharido-cart-actions">
            <button id="kharido-clear-cart" class="kharido-btn-secondary">Clear Cart</button>
            <button id="kharido-checkout" class="kharido-btn-primary">Checkout</button>
          </div>
        </footer>
      </aside>
    `;
    document.body.appendChild(modal);

    // Event listeners
    document.getElementById("kharido-cart-close").addEventListener("click", () => toggleCartModal(false));
    document.getElementById("kharido-cart-backdrop").addEventListener("click", () => toggleCartModal(false));
    document.getElementById("kharido-clear-cart").addEventListener("click", clearCart);
    document.getElementById("kharido-checkout").addEventListener("click", handleCheckout);

    renderCartModal();
  };

  const renderCartModal = () => {
    const itemsEl = document.getElementById("kharido-cart-items");
    const subtotalEl = document.getElementById("kharido-cart-subtotal");
    if (!itemsEl || !subtotalEl) return;

    const cart = loadCart();
    itemsEl.innerHTML = cart.length === 0 
      ? `<div class="kharido-empty">Your cart is empty. Add some items!</div>`
      : cart.map(item => `
          <div class="kharido-cart-row" data-id="${item.id}">
            <img class="kharido-cart-thumb" src="${item.img}" alt="${escapeHtml(item.name)}" />
            <div class="kharido-cart-meta">
              <div class="kharido-cart-name">${escapeHtml(item.name)}</div>
              <div class="kharido-cart-price">${formatCurrency(item.price)}</div>
              <div class="kharido-qty-row">
                <button class="kharido-qty-decr" data-id="${item.id}" aria-label="Decrease quantity">−</button>
                <input class="kharido-qty-input" data-id="${item.id}" type="number" min="1" value="${item.quantity}" 
                  aria-label="Quantity for ${escapeHtml(item.name)}" />
                <button class="kharido-qty-incr" data-id="${item.id}" aria-label="Increase quantity">+</button>
                <button class="kharido-remove-item" data-id="${item.id}" 
                  aria-label="Remove ${escapeHtml(item.name)} from cart">Remove</button>
              </div>
            </div>
          </div>
        `).join("");

    subtotalEl.textContent = formatCurrency(calculateTotal(cart));

    // Event delegation for dynamic elements
    itemsEl.addEventListener("click", (e) => {
      const target = e.target;
      const id = target.closest("[data-id]")?.dataset.id;
      if (!id) return;

      if (target.classList.contains("kharido-qty-decr")) {
        updateQuantity(id, loadCart().find(item => item.id === id).quantity - 1);
      } else if (target.classList.contains("kharido-qty-incr")) {
        updateQuantity(id, loadCart().find(item => item.id === id).quantity + 1);
      } else if (target.classList.contains("kharido-remove-item")) {
        removeFromCart(id);
      }
    });

    itemsEl.addEventListener("change", (e) => {
      if (e.target.classList.contains("kharido-qty-input")) {
        updateQuantity(e.target.dataset.id, Math.max(1, parseInt(e.target.value) || 1));
      }
    });
  };

  const toggleCartModal = (show) => {
    const modal = document.getElementById("kharido-cart-modal");
    const cartBtn = document.getElementById("kharido-cart-btn");
    if (!modal) return;

    if (show) {
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      cartBtn?.setAttribute("aria-expanded", "true");
      renderCartModal();
    } else {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      cartBtn?.setAttribute("aria-expanded", "false");
    }
  };

  const handleCheckout = () => {
    const cart = loadCart();
    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }
    alert("Checkout - this is a demo. Cart will be cleared.");
    clearCart();
    toggleCartModal(false);
  };

  const clearCart = () => {
    localStorage.removeItem(STORAGE_KEY);
    updateCartCountUI([]);
    renderCartModal();
  };

  const enhanceExistingProducts = () => {
    document.querySelectorAll(".products .product").forEach((el, idx) => {
      if (el.querySelector(".kharido-add-btn")) return;

      const nameEl = el.querySelector("h4, h3, p");
      const name = nameEl?.textContent.trim() || `Product ${idx + 1}`;
      
      const priceEl = Array.from(el.querySelectorAll("p")).find(p => /[\d]+(?:[.,]\d{1,2})?/.test(p.textContent));
      const price = parsePrice(priceEl?.textContent);
      
      const imgEl = el.querySelector("img");
      const pid = `p-${Date.now() % 100000 + idx}`;
      
      el.dataset.kharidoId = pid;

      const btn = document.createElement("button");
      btn.className = "kharido-add-btn";
      btn.type = "button";
      btn.textContent = "Add to Cart";
      btn.addEventListener("click", () => {
        addToCart({ id: pid, name, price, img: imgEl?.src || "", imgEl });
      });
      
      el.appendChild(btn);
    });
  };

  const initHamburger = () => {
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    if (!hamburger || !navMenu) return;

    hamburger.addEventListener("click", () => {
      const isExpanded = hamburger.getAttribute("aria-expanded") === "true";
      hamburger.setAttribute("aria-expanded", String(!isExpanded));
      hamburger.classList.toggle("active");
      navMenu.classList.toggle("active");
      document.body.style.overflow = navMenu.classList.contains("active") ? "hidden" : "";
    });
  };

  // Initialize the app
  const init = () => {
    createCartIcon();
    enhanceExistingProducts();
    createCartModal();
    initHamburger();
    updateCartCountUI(loadCart());
  };

  // Public API
  window.kharidoCart = {
    addItem: addToCart,
    getCart: loadCart,
    updateCart: saveCart,
    clearCart,
    toggleCartModal,
    renderCartModal
  };

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
