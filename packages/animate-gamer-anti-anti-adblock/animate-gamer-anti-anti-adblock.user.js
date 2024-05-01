// ==UserScript==
// @name               巴哈姆特動畫瘋 付費版反反AdBlock
// @name:en            Animate-Gamer Anti-Anti-AdBlock for the Payed
// @name:zh-TW         巴哈姆特動畫瘋 付費版反反AdBlock
// @namespace          https://github.com/rod24574575
// @description        隱藏付費版巴哈姆特動畫瘋的反AdBlock彈出視窗
// @description:en     Suppress the anti-AdBlock alert dialog in Animate-Gamer for the payed.
// @description:zh-TW  隱藏付費版巴哈姆特動畫瘋的反AdBlock彈出視窗
// @version            1.0.0
// @license            MIT
// @author             rod24574575
// @homepage           https://github.com/rod24574575/monorepo
// @homepageURL        https://github.com/rod24574575/monorepo
// @supportURL         https://github.com/rod24574575/monorepo/issues
// @updateURL          https://github.com/rod24574575/monorepo/raw/main/packages/animate-gamer-anti-anti-adblock/animate-gamer-anti-anti-adblock.user.js
// @downloadURL        https://github.com/rod24574575/monorepo/raw/main/packages/animate-gamer-anti-anti-adblock/animate-gamer-anti-anti-adblock.user.js
// @match              *://ani.gamer.com.tw/*
// @run-at             document-start
// @grant              unsafeWindow
// ==/UserScript==

// @ts-check
'use strict';

(function() {
  /**
   * @param {string} msg
   * @returns {boolean}
   */
  function isAntiAdBlockMessage(msg) {
    return typeof msg === 'string' && msg.startsWith('由於擋廣告');
  }

  function patchWindowAlert() {
    const alert = unsafeWindow.alert;
    unsafeWindow.alert = function(msg) {
      if (isAntiAdBlockMessage(msg)) {
        console.log('Anti-AdBlock message detected:', msg);
        return;
      }
      return alert.call(this, msg);
    };
  }

  // XXX: Add other anti-AdBlock mechanisms here if necessary

  function main() {
    patchWindowAlert();
  }

  main();
})();
