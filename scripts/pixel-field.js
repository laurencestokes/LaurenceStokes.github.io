(function () {
  "use strict";
  var field = document.querySelector(".pixel-field");
  if (!field) return;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)");
  var pixels = new Map(),
    frame = 0,
    previous = null,
    pending = null;
  function light(col, row) {
    var key = col + ":" + row;
    if (col < 0 || row < 0 || pixels.has(key) || pixels.size >= 100) return;
    var pixel = document.createElement("i");
    pixel.style.left = col * 30 + 1.5 + "px";
    pixel.style.top = row * 30 + 1.5 + "px";
    pixel.style.setProperty("--strength", ".26");
    pixels.set(key, pixel);
    field.appendChild(pixel);
    pixel.addEventListener(
      "animationend",
      function () {
        pixel.remove();
        pixels.delete(key);
      },
      { once: true },
    );
  }
  function paint() {
    frame = 0;
    if (!pending || reduced.matches) return;
    var current = pending,
      from = previous || current;
    var steps = Math.min(
      40,
      Math.max(
        1,
        Math.ceil(Math.hypot(current.x - from.x, current.y - from.y) / 15),
      ),
    );
    for (var i = 1; i <= steps; i++)
      light(
        Math.floor((from.x + ((current.x - from.x) * i) / steps) / 30),
        Math.floor((from.y + ((current.y - from.y) * i) / steps) / 30),
      );
    previous = current;
  }
  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = pending = null;
  }
  document.addEventListener(
    "pointermove",
    function (event) {
      if (event.pointerType !== "mouse" || reduced.matches) return;
      pending = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", reset);
  window.addEventListener("scroll", reset, { passive: true });
  reduced.addEventListener("change", function () {
    if (reduced.matches) {
      reset();
      field.replaceChildren();
      pixels.clear();
    }
  });
})();
