/* CareerPick — paylasim karti: PNG (Canvas) + panoya metin — bagimliliksiz */
(function (global) {
  "use strict";

  var W = 1200;
  var H = 630;

  function wrapText(ctx, text, maxWidth) {
    var words = String(text || "").split(/\s+/).filter(Boolean);
    var lines = [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawCard(payload) {
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background atmosphere (gradient — not flat)
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0f1419");
    g.addColorStop(0.45, "#152028");
    g.addColorStop(1, "#1a2830");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Soft accent wash
    var radial = ctx.createRadialGradient(980, 80, 20, 1000, 100, 420);
    radial.addColorStop(0, "rgba(232, 168, 96, 0.22)");
    radial.addColorStop(1, "rgba(232, 168, 96, 0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);

    // Brand
    ctx.fillStyle = "#e8a860";
    ctx.font = "700 28px 'Space Grotesk', 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(payload.brand || "Career Pick", 64, 72);

    var y = 130;
    if (payload.display_name) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "500 22px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(payload.display_name, 64, y);
      y += 40;
    }

    // Goal
    if (payload.goal) {
      ctx.fillStyle = "#f2f4f6";
      ctx.font = "600 36px 'Space Grotesk', sans-serif";
      var goalLines = wrapText(ctx, payload.goal, W - 128);
      for (var gi = 0; gi < Math.min(goalLines.length, 2); gi++) {
        ctx.fillText(goalLines[gi], 64, y);
        y += 46;
      }
      y += 18;
    } else {
      ctx.fillStyle = "#f2f4f6";
      ctx.font = "600 34px 'Space Grotesk', sans-serif";
      ctx.fillText(
        payload.locale === "en" ? "My career focus" : "Kariyer odağım",
        64,
        y
      );
      y += 50;
    }

    // Skills
    var skills = payload.skills || [];
    if (skills.length) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 18px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(
        payload.locale === "en" ? "Signals" : "Sinyaller",
        64,
        y
      );
      y += 36;
      var x = 64;
      ctx.font = "600 20px 'Plus Jakarta Sans', sans-serif";
      for (var si = 0; si < skills.length; si++) {
        var sk = skills[si];
        var label = sk.name + " · " + sk.label;
        var tw = ctx.measureText(label).width + 36;
        if (x + tw > W - 64) {
          x = 64;
          y += 52;
        }
        ctx.fillStyle = sk.strong ? "rgba(110, 196, 160, 0.18)" : "rgba(232, 168, 96, 0.14)";
        roundRect(ctx, x, y - 28, tw, 40, 20);
        ctx.fill();
        ctx.fillStyle = sk.strong ? "#8fd4b4" : "#e8a860";
        ctx.fillText(label, x + 18, y);
        x += tw + 12;
      }
      y += 56;
    }

    // Path
    var steps = payload.steps || [];
    if (steps.length) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 18px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(payload.locale === "en" ? "Path" : "Yol", 64, y);
      y += 36;
      ctx.fillStyle = "#e8eef2";
      ctx.font = "500 24px 'Plus Jakarta Sans', sans-serif";
      var pathText = steps.map(function (s, i) {
        return (i + 1) + ". " + s.title;
      }).join("   →   ");
      var pathLines = wrapText(ctx, pathText, W - 128);
      for (var pi = 0; pi < Math.min(pathLines.length, 2); pi++) {
        ctx.fillText(pathLines[pi], 64, y);
        y += 34;
      }
    }

    // Disclaimer + URL
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = "400 16px 'Plus Jakarta Sans', sans-serif";
    var disc = wrapText(ctx, payload.disclaimer || "", W - 128);
    var dy = H - 56 - (disc.length - 1) * 20;
    for (var di = 0; di < disc.length; di++) {
      ctx.fillText(disc[di], 64, dy + di * 20);
    }
    ctx.fillStyle = "#e8a860";
    ctx.font = "600 18px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(payload.app_url || "careerpick.vercel.app", W - 64 - ctx.measureText(payload.app_url || "careerpick.vercel.app").width, H - 36);

    return canvas;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function downloadPng(payload, filename) {
    var canvas = drawCard(payload);
    if (!canvas) return Promise.reject(new Error("canvas"));
    return new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(function (blob) {
          if (!blob) {
            reject(new Error("blob"));
            return;
          }
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = filename || "careerpick-ozet.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
          resolve(true);
        }, "image/png");
      } catch (e) {
        reject(e);
      }
    });
  }

  async function copyText(text) {
    var t = String(text || "");
    if (!t) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(t);
        return true;
      }
    } catch (e) { /* fall through */ }
    try {
      var ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      ta.remove();
      return !!ok;
    } catch (e2) {
      return false;
    }
  }

  function linkedInText(payload) {
    if (global.CPAuth && typeof global.CPAuth.shareCardLinkedInText === "function") {
      return global.CPAuth.shareCardLinkedInText(payload);
    }
    return "";
  }

  global.CPShareCard = {
    drawCard: drawCard,
    downloadPng: downloadPng,
    copyText: copyText,
    linkedInText: linkedInText,
    WIDTH: W,
    HEIGHT: H,
  };
})(typeof window !== "undefined" ? window : globalThis);
