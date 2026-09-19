/* SoftNest Cleaners — front-end behaviour */
(function () {
  'use strict';

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

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // native validation first
    if (!form.checkValidity()) {
      Array.prototype.forEach.call(form.elements, function (el) { el.classList.add('touched'); });
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
               '. Please call (331) 274-9415 or email softnestcleaners@gmail.com.', 'err');
        }
      })
      .catch(function () {
        show('Network error — your request was not sent. Please call (331) 274-9415 ' +
             'or email softnestcleaners@gmail.com.', 'err');
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = original;
      });
  });
  /* ---- photo lightbox for "what we clean" thumbnails ---- */
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
    });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

})();
