/* Read only the local address that the browser chooses to expose. */
(function (window) {
  "use strict";

  function isAddress(address) {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(address)) {
      return (
        address !== "0.0.0.0" &&
        address.split(".").every(function (part) {
          return Number(part) <= 255;
        })
      );
    }
    if (address.includes(":") && /^[a-f\d.:]+$/i.test(address)) {
      try {
        return new URL("http://[" + address + "]/").hostname !== "[::]";
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  window.LozLocalAddress = function (onResult) {
    var Peer = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    var peer,
      timer,
      finished = false,
      sawMdns = false;

    function finish(value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (peer) {
        peer.onicecandidate = peer.onicegatheringstatechange = null;
        peer.close();
      }
      onResult(
        sawMdns
          ? "Hidden by browser (mDNS)"
          : value || "Unavailable (no address exposed)",
      );
    }

    if (!Peer) {
      finish("Unavailable (WebRTC not supported)");
      return;
    }
    try {
      peer = new Peer({ iceServers: [] });
      peer.onicecandidate = function (event) {
        if (finished) return;
        var candidate = event.candidate;
        if (!candidate || candidate.candidate === "") {
          finish();
          return;
        }
        // Prefer the standard properties, with a fallback for older browsers.
        var parts = (candidate.candidate || "").trim().split(/\s+/);
        var type = candidate.type || parts[7];
        var address = candidate.address || parts[4] || "";
        if (type !== "host") return;
        if (/\.local\.?$/i.test(address)) {
          // Keep gathering: another interface might expose a numeric address.
          sawMdns = true;
        } else if (isAddress(address)) {
          sawMdns = false;
          finish(address);
        }
      };
      peer.onicegatheringstatechange = function () {
        if (peer.iceGatheringState === "complete") finish();
      };
      timer = setTimeout(function () {
        finish("Unavailable (lookup timed out)");
      }, 3000);
      peer.createDataChannel("local-address");
      peer
        .createOffer()
        .then(function (offer) {
          if (!finished) return peer.setLocalDescription(offer);
        })
        .catch(function () {
          finish("Unavailable (WebRTC error)");
        });
    } catch (_) {
      finish("Unavailable (WebRTC error)");
    }
  };
})(window);
