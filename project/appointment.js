(function () {
  var form = document.getElementById('bookingForm');
  var done = document.getElementById('bookingDone');
  var summary = document.getElementById('bookingSummary');
  var resetBtn = document.getElementById('bookingReset');
  var dateInput = document.getElementById('bookingDate');
  var timeSelect = document.getElementById('bookingTime');
  var serviceSelect = document.getElementById('serviceSelect');

  var SERVICE_LABELS = {
    lazer: 'Lazer Epilasyon',
    cilt: 'Cilt & Peeling',
    manikur: 'Manikür & Pedikür',
    incelme: 'İncelme (EMS & LipoSlim)'
  };

  var OPEN_HOUR = 9;
  var CLOSE_HOUR = 20;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function isSunday(d) { return d.getDay() === 0; }

  function minDate() {
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }

  if (dateInput) {
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = tomorrow.toISOString().slice(0, 10);
  }

  function fillTimes() {
    if (!timeSelect || !dateInput) return;
    timeSelect.innerHTML = '';
    var val = dateInput.value;
    if (!val) {
      timeSelect.innerHTML = '<option value="">Önce tarih seçin</option>';
      return;
    }
    var d = new Date(val + 'T12:00:00');
    if (isSunday(d)) {
      timeSelect.innerHTML = '<option value="">Pazar kapalı</option>';
      return;
    }
    var frag = document.createDocumentFragment();
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Saat seçin';
    frag.appendChild(ph);
    for (var h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      for (var m = 0; m < 60; m += 30) {
        var label = pad(h) + ':' + pad(m);
        var opt = document.createElement('option');
        opt.value = label;
        opt.textContent = label;
        frag.appendChild(opt);
      }
    }
    timeSelect.appendChild(frag);
  }

  if (dateInput) dateInput.addEventListener('change', fillTimes);

  document.querySelectorAll('[data-service]').forEach(function (el) {
    el.addEventListener('click', function () {
      var v = el.getAttribute('data-service');
      if (serviceSelect && v) serviceSelect.value = v;
    });
  });

  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var name = (fd.get('name') || '').toString().trim();
    var phone = (fd.get('phone') || '').toString().trim();
    var service = (fd.get('service') || '').toString();
    var date = (fd.get('date') || '').toString();
    var time = (fd.get('time') || '').toString();

    if (!name || !phone || !service || !date || !time) {
      alert('Lütfen zorunlu alanları doldurun.');
      return;
    }
    if (isSunday(new Date(date + 'T12:00:00'))) {
      alert('Pazar günleri kapalıyız. Lütfen başka bir gün seçin.');
      return;
    }

    var serviceLabel = SERVICE_LABELS[service] || service;
    var dateFormatted = date.split('-').reverse().join('.');

    var msg = 'Merhaba, ben ' + name + '.\n\n' +
      dateFormatted + ' tarihinde saat ' + time +
      ' randevu almak istiyorum. Uygun mudur?\n\n' +
      'Telefon: ' + phone + '\n' +
      'Not: ' + serviceLabel;

    summary.textContent = serviceLabel + ' · ' + dateFormatted + ' · ' + time +
      '. WhatsApp sohbeti açıldı — mesajı göndererek randevunuzu iletin.';

    var waUrl = 'https://wa.me/905337799631?text=' + encodeURIComponent(msg);

    var wa = document.querySelector('.wa-btn');
    if (wa) wa.href = waUrl;

    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    window.open(waUrl, '_blank', 'noopener');
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      form.reset();
      form.hidden = false;
      done.hidden = true;
      fillTimes();
    });
  }
})();
