/* SoftNest Cleaners — front-end behaviour ("Dark Nest" redesign)
   Single IIFE, vanilla JS, no libraries. */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var form = document.getElementById('quoteForm');
  if (!form) return;

  var msg = document.getElementById('formMsg');
  var btn = form.querySelector('button[type="submit"]');
  var photos = document.getElementById('photos');
  var phone = document.getElementById('phone');
  var dateInput = document.getElementById('date');

  var MAX_FILES = 5;
  var MAX_FILE_MB = 5;

  /* ---- preferred date cannot be in the past ---- */
  if (dateInput) {
    dateInput.min = new Date().toISOString().split('T')[0];
  }

  /* ---- phone formatting as you type ---- */
  if (phone) {
    phone.addEventListener('input', function (e) {
      var v = e.target.value.replace(/\D/g, '').slice(0, 10);
      if (v.length >= 6)      v = '(' + v.slice(0, 3) + ') ' + v.slice(3, 6) + '-' + v.slice(6);
      else if (v.length >= 3) v = '(' + v.slice(0, 3) + ') ' + v.slice(3);
      e.target.value = v;
    });
  }

  function show(text, kind) {
    msg.textContent = text;
    msg.className = 'form-msg show ' + kind;
  }

  /* ---- client-side file limits ---- */
  if (photos) {
    photos.addEventListener('change', function () {
      if (photos.files.length > MAX_FILES) {
        show('Please attach no more than ' + MAX_FILES + ' photos.', 'err');
        photos.value = '';
        return;
      }
      for (var i = 0; i < photos.files.length; i++) {
        if (photos.files[i].size > MAX_FILE_MB * 1024 * 1024) {
          show('Each photo must be under ' + MAX_FILE_MB + ' MB.', 'err');
          photos.value = '';
          return;
        }
      }
      msg.className = 'form-msg';
    });
  }

  var consentEl = document.getElementById('consent');
  var consentLabel = document.querySelector('label[for="consent"]');
  if (consentEl && consentLabel) {
    consentEl.addEventListener('change', function () {
      if (consentEl.checked) consentLabel.style.color = '';
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // trim leading/trailing/whitespace-only entries before validating
    ['firstName', 'lastName'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = el.value.trim();
    });

    // native validation first
    if (!form.checkValidity()) {
      Array.prototype.forEach.call(form.elements, function (el) { el.classList.add('touched'); });
      if (consentEl && consentLabel) {
        consentLabel.style.color = consentEl.checked ? '' : '#9A2C1E';
      }

      var bad = form.querySelector(':invalid');
      if (bad) bad.focus();
      show('Please fill in the required fields.', 'err');
      return;
    }

    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    msg.className = 'form-msg';

    fetch(form.action, { method: 'POST', body: new FormData(form) })
      .then(function (res) {
        return res.json().catch(function () { return { ok: res.ok }; })
          .then(function (data) { return { status: res.status, data: data }; });
      })
      .then(function (r) {
        if (r.status === 200 && r.data && r.data.ok) {
          form.reset();
          show('Thanks — your request is in. We usually reply the same day.', 'ok');
        } else {
          // The request did NOT go through. Never claim success here.
          var detail = (r.data && r.data.error) ? ' (' + r.data.error + ')' : '';
          show('We could not send your request' + detail +
               '. Please call (331) 302-2234 or email softnestcleaners@gmail.com.', 'err');
        }
      })
      .catch(function () {
        show('Network error — your request was not sent. Please call (331) 302-2234 ' +
             'or email softnestcleaners@gmail.com.', 'err');
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = original;
      });
  });

  /* ---- photo lightbox for the real-work gallery ---- */
  var galleryImgs = Array.prototype.slice.call(document.querySelectorAll('img.gallery-img'));
  var lightbox = document.getElementById('lightbox');
  if (lightbox && galleryImgs.length) {
    var lbImg = lightbox.querySelector('.lb-img');
    var lbCap = lightbox.querySelector('.lb-cap');
    var curIdx = 0;

    function showImg() {
      var el = galleryImgs[curIdx];
      var full = el.getAttribute('data-full');
      lbImg.src = full || el.currentSrc || el.src;
      lbImg.alt = el.alt || '';
      lbCap.textContent = el.getAttribute('data-cap') || el.alt || '';
    }
    function openLightbox(i) {
      curIdx = i;
      showImg();
      lightbox.classList.add('show');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
      lightbox.classList.remove('show');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    function nextImg() { curIdx = (curIdx + 1) % galleryImgs.length; showImg(); }
    function prevImg() { curIdx = (curIdx - 1 + galleryImgs.length) % galleryImgs.length; showImg(); }

    galleryImgs.forEach(function (img, i) {
      img.addEventListener('click', function () { openLightbox(i); });
    });
    lightbox.querySelector('.lb-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.lb-next').addEventListener('click', nextImg);
    lightbox.querySelector('.lb-prev').addEventListener('click', prevImg);
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('show')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImg();
      if (e.key === 'ArrowLeft') prevImg();
    });

    /* basic swipe support on mobile */
    var touchX = null;
    lightbox.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; });
    lightbox.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) { dx < 0 ? nextImg() : prevImg(); }
      touchX = null;
    });
  }

  /* ---- back to top ---- */
  var toTop = document.getElementById('toTop');
  if (toTop) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 500) toTop.classList.add('show');
      else toTop.classList.remove('show');
    }, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---- fill in prices from prices.js ---- */
  if (typeof PRICES !== 'undefined') {
    var esc = function (s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    document.querySelectorAll('[data-service]').forEach(function (article) {
      var data = PRICES[article.getAttribute('data-service')];
      var box = article.querySelector('[data-prices]');
      if (!data || !box) return;
      var html = '';
      data.rows.forEach(function (row) {
        html += '<div class="p-row"><span class="nm">' + esc(row[0]) + '</span><span class="dots"></span><span class="pr">' + esc(row[1]) + '</span></div>';
      });
      if (data.note) html += '<p class="p-note">' + esc(data.note) + '</p>';
      box.innerHTML = html;
    });
  }

  /* ===================== NEW: topbar background on scroll ===================== */
  var topbar = document.getElementById('topbar');
  if (topbar) {
    var onScrollTopbar = function () {
      if (window.scrollY > 40) topbar.classList.add('scrolled');
      else topbar.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScrollTopbar, { passive: true });
    onScrollTopbar();
  }

  /* ===================== NEW: smooth anchor scrolling ===================== */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', id);
    });
  });

  /* ===================== NEW: scroll reveal animations ===================== */
  var revealEls = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else if (revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ===================== NEW: before / after comparators ===================== */
  /* Both images are static, full-frame and stacked. Dragging only moves the
     divider line and the clip edge of the "after" layer — the <img> elements
     themselves are never translated or resized. Left of handle = before. */
  document.querySelectorAll('[data-ba]').forEach(function (stage) {
    var afterImg = stage.querySelector('.ba-after');
    var handle = stage.querySelector('.ba-handle');
    if (!afterImg || !handle) return;

    var pct = 50;

    function apply() {
      var clip = 'inset(0 0 0 ' + pct + '%)';
      afterImg.style.clipPath = clip;
      afterImg.style.webkitClipPath = clip;
      handle.style.left = pct + '%';
      handle.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    function setFromClientX(clientX) {
      var rect = stage.getBoundingClientRect();
      var x = clientX - rect.left;
      pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      apply();
    }

    /* pointer events cover mouse + touch + pen */
    var dragging = false;
    stage.addEventListener('pointerdown', function (e) {
      dragging = true;
      if (stage.setPointerCapture) {
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      }
      setFromClientX(e.clientX);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      setFromClientX(e.clientX);
    });
    var stop = function () { dragging = false; };
    stage.addEventListener('pointerup', stop);
    stage.addEventListener('pointercancel', stop);

    /* keyboard support on the slider handle */
    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 2;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        pct = Math.max(0, pct - step);
        apply();
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        pct = Math.min(100, pct + step);
        apply();
        e.preventDefault();
      } else if (e.key === 'Home') {
        pct = 0; apply(); e.preventDefault();
      } else if (e.key === 'End') {
        pct = 100; apply(); e.preventDefault();
      }
    });

    apply();
  });

  /* ===================== NEW: gallery scroll-in stagger ===================== */
  /* Each photo starts hidden/shifted (.g-pre) and cascades in with a per-item
     delay based on its order within the batch entering the viewport. Once per
     item. Fully disabled under prefers-reduced-motion (items never hidden). */
  var galItems = Array.prototype.slice.call(document.querySelectorAll('#work .gallery-img'));
  if (!reducedMotion && 'IntersectionObserver' in window && galItems.length) {
    galItems.forEach(function (img) { img.classList.add('g-pre'); });
    var gio = new IntersectionObserver(function (entries) {
      var batch = [];
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          batch.push(entry.target);
          gio.unobserve(entry.target);
        }
      });
      /* order the batch by position in the grid for a clean cascade */
      batch.sort(function (a, b) { return galItems.indexOf(a) - galItems.indexOf(b); });
      batch.forEach(function (el, i) {
        el.style.transitionDelay = (i * 75) + 'ms';
        el.classList.add('g-in');
        setTimeout(function () { el.style.transitionDelay = ''; }, i * 75 + 900);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
    galItems.forEach(function (img) { gio.observe(img); });
  }

  /* ===================== NEW: interactive 3D room estimator ===================== */
  var roomStage = document.getElementById('roomStage');
  if (roomStage && typeof PRICES !== 'undefined') {
    var roomImg = document.getElementById('roomImg');
    var roomLayer = document.getElementById('roomHotspots');
    var roomModal = document.getElementById('roomModal');
    var roomModalTitle = document.getElementById('roomModalTitle');
    var roomModalPrices = document.getElementById('roomModalPrices');
    var roomModalNote = document.getElementById('roomModalNote');
    var roomModalClose = document.getElementById('roomModalClose');
    var cartBtn = document.getElementById('cartBtn');
    var cartCount = document.getElementById('cartCount');
    var cartOverlay = document.getElementById('cartOverlay');
    var cartDrawer = document.getElementById('cartDrawer');
    var cartClose = document.getElementById('cartClose');
    var cartItemsEl = document.getElementById('cartItems');
    var cartEmpty = document.getElementById('cartEmpty');
    var cartTotalEl = document.getElementById('cartTotal');
    var cartNote = document.getElementById('cartNote');
    var cartBook = document.getElementById('cartBook');
    var roomForm = document.getElementById('roomForm');
    var roomFormMsg = document.getElementById('roomFormMsg');
    var lastFocus = null;

    var escHtml = function (s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    /* ---- subtle mouse parallax (desktop, fine pointers, motion allowed) ---- */
    var finePointer = window.matchMedia &&
      window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    if (!reducedMotion && finePointer && roomImg && roomLayer) {
      var px = 0, py = 0, parallaxRaf = null;
      var applyParallax = function () {
        parallaxRaf = null;
        var ix = -px * 16, iy = -py * 10;          /* image moves opposite the cursor */
        roomImg.style.transform = 'translate(' + ix.toFixed(1) + 'px,' + iy.toFixed(1) + 'px) scale(1.06)';
        /* hotspots move less (same direction) so they stay glued to the furniture */
        roomLayer.style.transform = 'translate(' + (ix * 0.35).toFixed(1) + 'px,' + (iy * 0.35).toFixed(1) + 'px)';
      };
      var queueParallax = function () {
        if (!parallaxRaf) parallaxRaf = requestAnimationFrame(applyParallax);
      };
      roomStage.addEventListener('pointermove', function (e) {
        var r = roomStage.getBoundingClientRect();
        px = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
        py = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
        queueParallax();
      });
      roomStage.addEventListener('pointerleave', function () {
        px = 0; py = 0; queueParallax();
      });
    }

    /* ---- cart state (persists for the browser session) ---- */
    var cart = [];
    try {
      var savedCart = sessionStorage.getItem('snc-room-cart');
      if (savedCart) cart = JSON.parse(savedCart) || [];
    } catch (e) { cart = []; }

    function saveCart() {
      try { sessionStorage.setItem('snc-room-cart', JSON.stringify(cart)); } catch (e) {}
    }
    function inCart(name, price) {
      for (var i = 0; i < cart.length; i++) {
        if (cart[i].name === name && cart[i].price === price) return true;
      }
      return false;
    }

    /* ---- price parsing: "$140" exact; "from $60"/"on request" → approximate ---- */
    function priceNumber(price) {
      var m = String(price).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : null;
    }
    function priceIsExact(price) { return /^\s*\$\s*[\d,]+\s*$/.test(String(price)); }
    function totals() {
      var sum = 0, approx = false;
      cart.forEach(function (it) {
        var n = priceNumber(it.price);
        if (n !== null) sum += n;
        if (!priceIsExact(it.price)) approx = true;
      });
      return { sum: sum, approx: approx };
    }
    function totalText() {
      if (!cart.length) return '$0';
      var t = totals();
      if (t.sum === 0) return 'on request';
      return (t.approx ? '~$' : '$') + t.sum;
    }

    function renderCart() {
      cartCount.textContent = String(cart.length);
      cartCount.className = 'cart-count' + (cart.length ? ' on' : '');
      if (!cart.length) {
        cartItemsEl.innerHTML = '';
        cartEmpty.style.display = '';
        cartTotalEl.textContent = '$0';
        cartNote.style.display = 'none';
        cartBook.disabled = true;
        roomForm.classList.remove('open');
        return;
      }
      cartEmpty.style.display = 'none';
      cartBook.disabled = false;
      var html = '';
      cart.forEach(function (it, i) {
        html += '<div class="cart-item">' +
          '<span class="ci-nm">' + escHtml(it.name) + '</span>' +
          '<span class="ci-pr">' + escHtml(it.price) + '</span>' +
          '<button type="button" class="ci-rm" data-i="' + i + '" aria-label="Remove ' +
          escHtml(it.name) + '">&times;</button></div>';
      });
      cartItemsEl.innerHTML = html;
      cartTotalEl.textContent = totalText();
      cartNote.style.display = totals().approx ? '' : 'none';
    }

    cartItemsEl.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.ci-rm') : null;
      if (!b) return;
      cart.splice(parseInt(b.getAttribute('data-i'), 10), 1);
      saveCart();
      renderCart();
    });

    /* ---- item modal ---- */
    function openModal(key, label, srcBtn) {
      var data = PRICES[key];
      if (!data) return;
      lastFocus = srcBtn || document.activeElement;
      roomModalTitle.textContent = label;
      var html = '';
      data.rows.forEach(function (row) {
        var added = inCart(row[0], row[1]);
        html += '<div class="p-row rm-row">' +
          '<span class="nm">' + escHtml(row[0]) + '</span>' +
          '<span class="dots"></span>' +
          '<span class="pr">' + escHtml(row[1]) + '</span>' +
          '<button type="button" class="rm-add' + (added ? ' added' : '') + '"' +
          ' data-name="' + escHtml(row[0]) + '" data-price="' + escHtml(row[1]) + '"' +
          (added ? ' disabled' : '') + '>' + (added ? 'Added' : 'Add') + '</button></div>';
      });
      roomModalPrices.innerHTML = html;
      roomModalNote.textContent = data.note || '';
      roomModalNote.style.display = data.note ? '' : 'none';
      roomModal.classList.add('show');
      roomModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      roomModalClose.focus();
    }
    function closeModal() {
      roomModal.classList.remove('show');
      roomModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    roomModalClose.addEventListener('click', closeModal);
    roomModal.addEventListener('click', function (e) {
      if (e.target === roomModal) closeModal();
    });

    roomModalPrices.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.rm-add') : null;
      if (!b || b.disabled) return;
      var name = b.getAttribute('data-name');
      var price = b.getAttribute('data-price');
      if (!inCart(name, price)) {
        cart.push({ name: name, price: price });
        saveCart();
        renderCart();
        cartCount.classList.add('bump');
        setTimeout(function () { cartCount.classList.remove('bump'); }, 350);
      }
      b.textContent = 'Added';
      b.classList.add('added');
      b.disabled = true;
    });

    roomLayer.querySelectorAll('.hotspot').forEach(function (hs) {
      hs.addEventListener('click', function () {
        openModal(hs.getAttribute('data-key'), hs.getAttribute('data-label'), hs);
      });
    });

    /* ---- cart drawer ---- */
    function openDrawer() {
      lastFocus = document.activeElement;
      cartDrawer.classList.add('show');
      cartOverlay.classList.add('show');
      cartDrawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      cartClose.focus();
    }
    function closeDrawer() {
      cartDrawer.classList.remove('show');
      cartOverlay.classList.remove('show');
      cartDrawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    cartBtn.addEventListener('click', openDrawer);
    cartClose.addEventListener('click', closeDrawer);
    cartOverlay.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (roomModal.classList.contains('show')) closeModal();
      else if (cartDrawer.classList.contains('show')) closeDrawer();
    });

    /* ---- "Book the cleaning" reveals the compact checkout form ---- */
    function showRoomMsg(text, kind) {
      roomFormMsg.textContent = text;
      roomFormMsg.className = 'form-msg show ' + kind;
    }
    cartBook.addEventListener('click', function () {
      roomForm.classList.add('open');
      roomFormMsg.className = 'form-msg';
      var f = document.getElementById('rmFirstName');
      if (f) f.focus();
    });

    /* same phone mask as the main form */
    var rmPhone = document.getElementById('rmPhone');
    if (rmPhone) {
      rmPhone.addEventListener('input', function (e) {
        var v = e.target.value.replace(/\D/g, '').slice(0, 10);
        if (v.length >= 6)      v = '(' + v.slice(0, 3) + ') ' + v.slice(3, 6) + '-' + v.slice(6);
        else if (v.length >= 3) v = '(' + v.slice(0, 3) + ') ' + v.slice(3);
        e.target.value = v;
      });
    }
    var rmDate = document.getElementById('rmDate');
    if (rmDate) rmDate.min = new Date().toISOString().split('T')[0];

    roomForm.addEventListener('submit', function (e) {
      e.preventDefault();

      ['rmFirstName', 'rmLastName'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = el.value.trim();
      });

      if (!roomForm.checkValidity()) {
        Array.prototype.forEach.call(roomForm.elements, function (el) { el.classList.add('touched'); });
        var bad = roomForm.querySelector(':invalid');
        if (bad) bad.focus();
        showRoomMsg('Please fill in the required fields.', 'err');
        return;
      }
      if (!cart.length) {
        showRoomMsg('Add at least one item from the room first.', 'err');
        return;
      }

      var submitBtn = roomForm.querySelector('button[type="submit"]');
      var original = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      roomFormMsg.className = 'form-msg';

      var fd = new FormData(roomForm);
      var itemsStr = cart.map(function (it) { return it.name + ' ' + it.price; }).join('; ');
      var userMsg = (document.getElementById('rmMessage').value || '').trim();
      fd.set('message', 'ROOM ESTIMATE — items: ' + itemsStr +
        ' — est. total ' + totalText() + '\n\n' + userMsg);

      fetch(roomForm.action, { method: 'POST', body: fd })
        .then(function (res) {
          return res.json().catch(function () { return { ok: res.ok }; })
            .then(function (data) { return { status: res.status, data: data }; });
        })
        .then(function (r) {
          if (r.status === 200 && r.data && r.data.ok) {
            roomForm.reset();
            cart = [];
            saveCart();
            renderCart();
            roomForm.classList.add('open');
            showRoomMsg('Thanks — your request is in. We usually reply the same day.', 'ok');
          } else {
            // The request did NOT go through. Never claim success here.
            var detail = (r.data && r.data.error) ? ' (' + r.data.error + ')' : '';
            showRoomMsg('We could not send your request' + detail +
              '. Please call (331) 302-2234 or email softnestcleaners@gmail.com.', 'err');
          }
        })
        .catch(function () {
          showRoomMsg('Network error — your request was not sent. Please call (331) 302-2234 ' +
            'or email softnestcleaners@gmail.com.', 'err');
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = original;
        });
    });

    renderCart();
    cartBtn.classList.add('ready');
  }

  /* ===================== NEW: reviews carousel arrows ===================== */
  var strip = document.getElementById('reviewStrip');
  var revPrev = document.getElementById('revPrev');
  var revNext = document.getElementById('revNext');
  if (strip && revPrev && revNext) {
    var page = function (dir) {
      var card = strip.querySelector('.rev-card');
      var w = card ? card.getBoundingClientRect().width + 14 : 320;
      strip.scrollBy({ left: dir * w * 1.05, behavior: reducedMotion ? 'auto' : 'smooth' });
    };
    revPrev.addEventListener('click', function () { page(-1); });
    revNext.addEventListener('click', function () { page(1); });
  }

  /* ===================== NEW: burger menu / mobile nav drawer ===================== */
  var navBurger = document.getElementById('navBurger');
  var navDrawer = document.getElementById('navDrawer');
  if (navBurger && navDrawer) {
    var navOpen = false;

    var navFocusables = function () {
      return Array.prototype.slice.call(navDrawer.querySelectorAll('a[href]'));
    };

    function openNav() {
      navOpen = true;
      navDrawer.classList.add('show');
      navDrawer.setAttribute('aria-hidden', 'false');
      navBurger.classList.add('open');
      navBurger.setAttribute('aria-expanded', 'true');
      navBurger.setAttribute('aria-label', 'Close menu');
      document.body.classList.add('nav-open');
      var f = navFocusables();
      if (f.length) f[0].focus();
    }

    function closeNav(restoreFocus) {
      navOpen = false;
      navDrawer.classList.remove('show');
      navDrawer.setAttribute('aria-hidden', 'true');
      navBurger.classList.remove('open');
      navBurger.setAttribute('aria-expanded', 'false');
      navBurger.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('nav-open');
      if (restoreFocus !== false) navBurger.focus();
    }

    navBurger.addEventListener('click', function () {
      if (navOpen) closeNav();
      else openNav();
    });

    /* Capture phase: closes the drawer (lifting the body scroll lock) BEFORE the
       generic smooth-anchor handler on the link itself scrolls the page.
       Focus is not sent back to the burger when navigating via a link. */
    navDrawer.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (a) closeNav(false);
    }, true);

    document.addEventListener('keydown', function (e) {
      if (!navOpen) return;
      if (e.key === 'Escape') { closeNav(); return; }
      if (e.key === 'Tab') {
        /* minimal tab cycling: burger + drawer links, wrapping around */
        var f = [navBurger].concat(navFocusables());
        var idx = f.indexOf(document.activeElement);
        var next = (idx === -1) ? 0
          : (e.shiftKey ? (idx - 1 + f.length) % f.length : (idx + 1) % f.length);
        f[next].focus();
        e.preventDefault();
      }
    });

    /* reset if the viewport grows past the breakpoint while the drawer is open */
    window.addEventListener('resize', function () {
      if (navOpen && window.innerWidth >= 960) closeNav(false);
    });
  }

})();
