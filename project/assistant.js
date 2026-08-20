(function () {
  var fab = document.getElementById('aiFab');
  var panel = document.getElementById('aiPanel');
  var closeBtn = document.getElementById('aiClose');
  var messages = document.getElementById('aiMessages');
  var questionsEl = document.getElementById('aiQuestions');
  var hint = document.querySelector('.ai-hint');

  if (!fab || !panel || !closeBtn || !messages || !questionsEl) return;

  panel.hidden = true;

  var FAQ = [
    {
      q: 'Çalışma saatleriniz nedir?',
      a: 'Pazartesi–Cumartesi 09:00–20:00 arası açığız. Pazar günleri kapalıyız.'
    },
    {
      q: 'Adresiniz nerede?',
      a: 'Şehit Mustafa Gündoğdu Mah. Bayındır Cad. Filiz Sk. No:147/A, Uydukent, 12000 Merkez / Bingöl. Tel: 0533 779 96 31.'
    },
    {
      q: 'Lazer epilasyon acıtır mı?',
      a: 'Soğutmalı cihazımızla çoğu misafir kısa bir ısı hissi tarif eder. Fatma Hanım hassas bölgelerde enerjiyi düşürür; ilk seans endişeyi genelde azaltır.'
    },
    {
      q: 'Kaç seans gerekir?',
      a: 'Bölge ve kıl yapısına göre 4–8 seans tipiktir. Kemer üstü, bacak veya tüm vücut için ön görüşmede plan çıkarılır.'
    },
    {
      q: 'Hangi hizmetleri sunuyorsunuz?',
      a: 'Lazer epilasyon, cilt & peeling, manikür & pedikür ve incelme (EMS & LipoSlim) hizmetlerimiz mevcuttur.'
    },
    {
      q: 'Randevu nasıl alınır?',
      a: 'Sitedeki randevu formunu doldurun veya 0533 779 96 31 numaradan arayın / WhatsApp yazın. Saatiniz onaylandığında size dönüş yapılır.'
    },
    {
      q: 'Fiyatlar ne kadar?',
      a: 'Fiyatlar hizmet ve bölgeye göre değişir. Güncel fiyat için 0533 779 96 31 numaradan bizi arayabilir veya WhatsApp yazabilirsiniz.'
    }
  ];

  function addBubble(text, who) {
    var el = document.createElement('div');
    el.className = 'ai-msg ai-msg--' + who;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderQuestions() {
    questionsEl.innerHTML = '';
    FAQ.forEach(function (item, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-q';
      btn.textContent = item.q;
      btn.addEventListener('click', function () {
        addBubble(item.q, 'user');
        btn.disabled = true;
        setTimeout(function () {
          addBubble(item.a, 'bot');
          btn.disabled = false;
        }, 300);
      });
      questionsEl.appendChild(btn);
    });
  }

  function openPanel() {
    panel.hidden = false;
    fab.classList.add('is-active');
    if (hint) hint.classList.add('is-hidden');
    if (!messages.childElementCount) {
      addBubble('Merhaba! Aşağıdaki sorulardan birini seçin, hemen yanıtlayayım.', 'bot');
    }
  }

  function closePanel() {
    panel.hidden = true;
    fab.classList.remove('is-active');
    if (hint) hint.classList.remove('is-hidden');
  }

  renderQuestions();

  fab.addEventListener('click', function () {
    if (panel.hidden) openPanel();
    else closePanel();
  });
  closeBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    closePanel();
  });
})();
