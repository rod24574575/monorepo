// ==UserScript==
// @name               DLsite Return Tags Back
// @name:en            DLsite Return Tags Back
// @name:zh-TW         DLsite還我標籤
// @namespace          https://github.com/rod24574575
// @description        Return back self-censoring tags in DLsite.
// @description:en     Return back self-censoring tags in DLsite.
// @description:zh-TW  恢復 DLsite 被自主規制的標籤
// @version            1.0.1
// @license            MIT
// @author             rod24574575
// @homepage           https://github.com/rod24574575/monorepo
// @homepageURL        https://github.com/rod24574575/monorepo
// @supportURL         https://github.com/rod24574575/monorepo/issues
// @updateURL          https://github.com/rod24574575/monorepo/raw/main/packages/dlsite-return-tags-back/dlsite-return-tags-back.user.js
// @downloadURL        https://github.com/rod24574575/monorepo/raw/main/packages/dlsite-return-tags-back/dlsite-return-tags-back.user.js
// @match              *://www.dlsite.com/*
// @run-at             document-idle
// @resource           maps/zh_TW https://github.com/rod24574575/monorepo/raw/dlsite-return-tags-back-v1.0.1/packages/dlsite-return-tags-back/maps/zh_TW.json
// @resource           maps/ja_JP https://github.com/rod24574575/monorepo/raw/dlsite-return-tags-back-v1.0.1/packages/dlsite-return-tags-back/maps/ja_JP.json
// @grant              GM.getResourceUrl
// ==/UserScript==

// @ts-check
'use strict';

(function() {
  /**
   * Locale
   */

  /**
   * @param {string} search
   * @returns {string | null}
   */
  function parseLocaleFromSearch(search) {
    try {
      return (new URLSearchParams(search)).get('locale');
    } catch {
      console.warn('Failed to parse locale from search:', search);
      return null;
    }
  }

  /**
   * @returns {string | null}
   */
  function detectLocaleFromLocation() {
    return parseLocaleFromSearch(location.search);
  }

  /**
   * @returns {string | null}
   */
  function detectLocaleFromLanguage() {
    const languageItemAnchor = document.querySelector('.header_dropdown_list_item.is-selected > a[href]');
    if (!languageItemAnchor) {
      return null;
    }

    const href = languageItemAnchor.getAttribute('href');
    if (!href) {
      return null;
    }

    /** @type {string} */
    let search;
    try {
      search = (new URL(href)).search;
    } catch {
      console.warn('Failed to parse search from url:', href);
      return null;
    }

    return parseLocaleFromSearch(search);
  }

  /**
   * @returns {string}
   */
  function detectLocale() {
    return detectLocaleFromLocation() ?? detectLocaleFromLanguage() ?? 'ja_JP';
  }

  /**
   * Tag Map
   */

  /** @type {Map<string, string>} */
  const tagMap = new Map();

  /**
   * @param {string} locale
   */
  async function loadTagMap(locale) {
    const url = await GM.getResourceUrl(`maps/${locale}`);
    const resp = await fetch(url);
    const map = await resp.json();
    for (const [key, value] of Object.entries(map)) {
      tagMap.set(key, value);
    }
  }

  /**
   * @param {string} tag
   * @returns {string}
   */
  function transformTag(tag) {
    return tagMap.get(tag) ?? tag;
  }

  /**
   * Handler
   */

  /** @type {WeakSet<Element>} */
  const cacheSet = new WeakSet();

  /**
   * @param {Element} el
   * @returns {boolean}
   */
  function checkCache(el) {
    if (cacheSet.has(el)) {
      return false;
    }
    cacheSet.add(el);
    return true;
  }

  /**
   * @param {Element} el
   */
  function processElementWithSimpleTag(el) {
    for (const child of el.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE) {
        continue;
      }

      const textNode = /** @type {Text} */ (child);
      const text = textNode.data;
      if (text.length === 0) {
        continue;
      }

      const oldTag = text.trim();
      const newTag = transformTag(oldTag);
      if (newTag === oldTag) {
        continue;
      }

      const prefixLength = text.length - text.trimStart().length;
      const suffixLength = text.length - text.trimEnd().length;
      textNode.data = text.slice(0, prefixLength) + newTag + text.slice(text.length - suffixLength);
    }
  }

  /**
   * @param {Element} el
   */
  function processElementWithWrappedTag(el) {
    for (const child of el.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE) {
        continue;
      }

      const textNode = /** @type {Text} */ (child);
      const text = textNode.data;
      if (text.length === 0) {
        continue;
      }

      const startIndex = text.indexOf('「');
      if (startIndex < 0) {
        continue;
      }

      const endIndex = text.indexOf('」', startIndex);
      if (endIndex < 0) {
        continue;
      }

      const oldTag = text.slice(startIndex + 1, endIndex);
      const newTag = transformTag(oldTag);
      if (newTag === oldTag) {
        continue;
      }

      textNode.data = text.slice(0, startIndex + 1) + newTag + text.slice(endIndex);
    }
  }

  function handleUserReviewHeader() {
    for (const el of document.querySelectorAll('.meny_selected_item > a[href]')) {
      if (!checkCache(el)) {
        continue;
      }

      const text = (el.textContent ?? '').trim();
      const spaceIndex = text.lastIndexOf(' ');
      if (spaceIndex < 0) {
        processElementWithSimpleTag(el);
        continue;
      }

      const oldTag = text.slice(0, spaceIndex);
      const newTag = transformTag(oldTag);
      if (newTag !== oldTag) {
        el.textContent = newTag + text.slice(spaceIndex);
      }
    }
  }

  function handleWrappedTag() {
    const selectors = [
      'title', // title
      '.topicpath_item > a[href] > span', // topic path
    ];

    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (!checkCache(el)) {
          continue;
        }
        processElementWithWrappedTag(el);
      }
    }
  }

  function handleSimpleTag() {
    const selectors = [
      '.search_tag_items > li > a[href]', // search tag
      '.left_refine_list_item.refine_checkbox > a[href]', // genre list
      'a[href*="/=/genre/"]', // general
    ];

    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (!checkCache(el)) {
          continue;
        }
        processElementWithSimpleTag(el);
      }
    }
  }

  function run() {
    handleUserReviewHeader();
    handleWrappedTag();
    handleSimpleTag();
  }

  async function main() {
    try {
      await loadTagMap(detectLocale());
    } catch (err) {
      console.error('Failed to load tag map:', err);
      return;
    }

    const mutationObserver = new MutationObserver(run);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    run();
  }

  main();
})();
