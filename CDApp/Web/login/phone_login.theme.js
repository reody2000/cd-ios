
  (function () {
    try {
      if (/[?&]theme=dark(?:&|$)/.test(location.search)) {
        document.documentElement.classList.add('cd-dark');
      }
    } catch (e) {}
  })();
