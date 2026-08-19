// Click Spark: small particle burst when a WhatsApp/CTA button is clicked.
// Pure vanilla JS/CSS port of the React Bits "Click Spark" idea (reactbits.dev) -
// no dependency on React or the original animation library.
(function () {
  var PARTICLE_COUNT = 6;

  function colorFor(btn) {
    if (btn.classList.contains('btn-accent')) {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f9bf0';
    }
    return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#e2402e';
  }

  function burst(x, y, color) {
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var el = document.createElement('span');
      el.className = 'click-spark';
      var angle = (360 / PARTICLE_COUNT) * i;
      el.style.setProperty('--x', x + 'px');
      el.style.setProperty('--y', y + 'px');
      el.style.setProperty('--spark-angle', angle + 'deg');
      el.style.background = i % 2 === 0 ? color : '#fff';
      document.body.appendChild(el);
      var cleanup = function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      };
      el.addEventListener('animationend', cleanup);
      // Fallback in case the animationend event doesn't fire (e.g. a
      // backgrounded/throttled tab) so particles never pile up in the DOM.
      setTimeout(cleanup, 700);
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-primary, .btn-accent');
    if (!btn) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    burst(e.clientX, e.clientY, colorFor(btn));
  });
})();
