// ==UserScript==
// @name               巴哈姆特動畫瘋 威力加強版
// @name:en            Animate-Gamer Enhancement
// @name:zh-TW         巴哈姆特動畫瘋 威力加強版
// @namespace          https://github.com/rod24574575
// @description        一些巴哈姆特動畫瘋的 UX 改善和小功能
// @description:en     Some user experience enhancement and small features for Animate-Gamer.
// @description:zh-TW  一些巴哈姆特動畫瘋的 UX 改善和小功能
// @version            1.0.3
// @license            MIT
// @author             rod24574575
// @homepage           https://github.com/rod24574575/monorepo
// @homepageURL        https://github.com/rod24574575/monorepo
// @supportURL         https://github.com/rod24574575/monorepo/issues
// @updateURL          https://github.com/rod24574575/monorepo/raw/main/packages/animate-gamer-enhancement/animate-gamer-enhancement.user.js
// @downloadURL        https://github.com/rod24574575/monorepo/raw/main/packages/animate-gamer-enhancement/animate-gamer-enhancement.user.js
// @match              *://ani.gamer.com.tw/animeVideo.php*
// @run-at             document-idle
// @grant              GM.getValue
// @grant              GM.setValue
// ==/UserScript==

// @ts-check
'use strict';

(function() {
  /**
   * I18n
   */

  const i18n = {
    settings_tab_name: '動畫瘋加強版',
    play_settings: '播放設定',
    auto_agree_content_rating: '自動同意分級確認',
    auto_play_next_episode: '自動播放下一集',
    auto_play_next_episode_tip: '此功能和動畫瘋內建提供的自動播放功能衝突，如果沒有自訂延遲時間的需求，可以直接使用內建的自動播放功能即可',
    auto_play_next_episode_delay: '自動播放延遲時間',
    auto_play_countdown: '倒數{0}秒繼續播放',
    second: '秒',
  };

  /**
   * @param {keyof typeof i18n} key
   * @returns {string}
   */
  function getI18n(key) {
    return i18n[key] ?? key;
  }

  /**
   * @param {string} str
   * @param {unknown[]} args
   * @returns {string}
   */
  function formatString(str, ...args) {
    return str.replace(/\{(\d+)\}/g, (_, index) => {
      return String(args[+index]);
    });
  }

  /**
   * Settings
   */

  /**
   * @typedef {'previous_episode' | 'next_episode'} ShortcutAction
   */

  /**
   * @typedef {[name: string, action: ShortcutAction]} CustomShortcut
   */

  /**
   * @typedef {object} Settings
   * @property {boolean} autoAgreeContentRating
   * @property {boolean} autoPlayNextEpisode
   * @property {number} autoPlayNextEpisodeDelay
   * @property {CustomShortcut[]} customShortcuts
   */

  /**
   * @returns {Promise<Settings>}
   */
  async function loadSettings() {
    /** @type {Settings} */
    const settings = {
      autoAgreeContentRating: false,
      autoPlayNextEpisode: false,
      autoPlayNextEpisodeDelay: 5,
      customShortcuts: [
        ['PageUp', 'previous_episode'],
        ['PageDown', 'next_episode'],
      ],
    };

    const entries = await Promise.all(
      Object.entries(settings).map(async ([key, value]) => {
        try {
          value = await GM.getValue(key, value);
        } catch (e) {
          console.warn(e);
        }
        return /** @type {[string, any]} */ ([key, value]);
      }),
    );
    return /** @type {Settings} */ (Object.fromEntries(entries));
  }

  /**
   * @param {Partial<Settings>} settings
   */
  async function saveSettings(settings) {
    await Promise.allSettled(
      Object.entries(settings).map(async ([name, value]) => {
        return GM.setValue(name, value);
      }),
    );
  }

  /**
   * Store
   */

  /**
   * @typedef {HTMLElement} VjsPlayerElement
   */

  /**
   * @param {VjsPlayerElement} vjsPlayer
   */
  function useContentRating(vjsPlayer) {
    let enabled = false;

    function agreeContentRating() {
      /** @type {HTMLButtonElement | null} */
      const button = vjsPlayer.querySelector('button.choose-btn-agree');
      button?.click();
    }

    /** @type {MutationObserver | undefined} */
    let contentRatingMutationObserver;

    function onAutoAgreeContentRatingChange() {
      contentRatingMutationObserver?.disconnect();

      if (enabled) {
        agreeContentRating();

        contentRatingMutationObserver = new MutationObserver(() => {
          agreeContentRating();
        });
        contentRatingMutationObserver.observe(vjsPlayer, {
          childList: true,
        });
      }
    }

    /**
     * @param {boolean} value
     */
    function enableAutoAgreeContentRating(value) {
      if (enabled === value) {
        return;
      }
      enabled = value;
      onAutoAgreeContentRatingChange();
    }

    return {
      enableAutoAgreeContentRating,
    };
  }

  /**
   * @param {VjsPlayerElement} vjsPlayer
   */
  function useNextEpisode(vjsPlayer) {
    let enabled = false;
    let delayTime = 0;
    /** @type {{ countdownTimer: number, finishTimer: number } | null} */
    let countdownData = null;

    const videoEl = /** @type {HTMLVideoElement | null} */ (vjsPlayer.querySelector('video'));
    const stopEl = /** @type {HTMLElement | null} */ (vjsPlayer.querySelector('.stop'));
    const titleEl = /** @type {HTMLElement | null | undefined} */ (stopEl?.querySelector('#countDownTitle'));
    const nextEpisodeEl = /** @type {HTMLAnchorElement | null | undefined} */ (stopEl?.querySelector('a#nextEpisode'));
    const stopAutoPlayEl = /** @type {HTMLAnchorElement | null | undefined} */ (stopEl?.querySelector('a#stopAutoPlay'));
    const nextEpisodeSvgEl = /** @type {SVGElement | null | undefined} */ (nextEpisodeEl?.querySelector('svg'));
    const nextEpisodeCountdownEl = /** @type {SVGElement | null | undefined} */ (nextEpisodeEl?.querySelector('#countDownCircle'));

    if (!videoEl || !stopEl || !titleEl || !nextEpisodeEl || !stopAutoPlayEl || !nextEpisodeSvgEl || !nextEpisodeCountdownEl) {
      console.warn('Missing elements for next episode auto play.');
    }

    /**
     * @returns {boolean}
     */
    function isStopElShown() {
      return !!stopEl && !stopEl.classList.contains('vjs-hidden');
    }

    /**
     * @param {boolean} display
     */
    function setCountdownUiDisplay(display) {
      if (nextEpisodeEl) {
        if (display) {
          nextEpisodeEl.classList.add('center-btn');
        } else {
          nextEpisodeEl.classList.remove('center-btn');
        }
      }
      if (nextEpisodeSvgEl) {
        if (display) {
          nextEpisodeSvgEl.classList.remove('is-hide');
        } else {
          nextEpisodeSvgEl.classList.add('is-hide');
        }
      }
      if (nextEpisodeCountdownEl) {
        if (display) {
          nextEpisodeCountdownEl.classList.add('is-countdown');
          nextEpisodeCountdownEl.style.animation = `circle-offset ${delayTime}s linear 1 forwards`;
        } else {
          nextEpisodeCountdownEl.classList.remove('is-countdown');
          nextEpisodeCountdownEl.style.animation = '';
        }
      }
      if (stopAutoPlayEl) {
        if (display) {
          stopAutoPlayEl.classList.remove('vjs-hidden');
        } else {
          stopAutoPlayEl.classList.add('vjs-hidden');
        }
      }
      updateCountdownUi(delayTime);
    }

    /**
     * @param {number} countdownValue
     */
    function updateCountdownUi(countdownValue) {
      if (titleEl) {
        titleEl.textContent = formatString(getI18n('auto_play_countdown'), countdownValue);
      }
    }

    /**
     * @returns {Promise<void>}
     */
    async function countdown() {
      clearCountdown();

      let countdownValue = delayTime;
      const countdownTimer = window.setInterval(() => {
        --countdownValue;
        updateCountdownUi(countdownValue);
      }, 1000);

      const { promise, resolve } = Promise.withResolvers();
      const finishTimer = window.setTimeout(resolve, delayTime * 1000);
      countdownData = {
        countdownTimer,
        finishTimer,
      };

      await promise;
    }

    /**
     * @returns {Promise<void>}
     */
    async function clearCountdown() {
      if (!countdownData) {
        return;
      }
      window.clearInterval(countdownData.countdownTimer);
      window.clearTimeout(countdownData.finishTimer);
      countdownData = null;
    }

    /**
     * @returns {Promise<void>}
     */
    async function maybePlayNextEpisode() {
      if (!isStopElShown()) {
        return;
      }

      if (delayTime) {
        setCountdownUiDisplay(true);
        await countdown();
        setCountdownUiDisplay(false);

        // Check again whether the stop element is still shown after the countdown.
        if (!isStopElShown()) {
          return;
        }
      }

      nextEpisodeEl?.click();
    }

    /** @type {MutationObserver | undefined} */
    let nextEpisodeMutationObserver;

    function onAutoPlayNextEpisodeChange() {
      if (!stopEl) {
        return;
      }

      nextEpisodeMutationObserver?.disconnect();
      if (enabled) {
        nextEpisodeMutationObserver = new MutationObserver((records) => {
          for (const { type, target, oldValue } of records) {
            // Only handle the class attribute change of the stop element when
            // it becomes visible.
            if (type !== 'attributes' || target !== stopEl || oldValue === null || !oldValue.split(' ').includes('vjs-hidden')) {
              continue;
            }
            maybePlayNextEpisode();
          }
        });
        nextEpisodeMutationObserver.observe(stopEl, {
          attributes: true,
          attributeFilter: ['class'],
          attributeOldValue: true,
        });

        maybePlayNextEpisode();
      }

      if (videoEl) {
        if (enabled) {
          videoEl.addEventListener('emptied', clearCountdown);
        } else {
          videoEl.removeEventListener('emptied', clearCountdown);
        }
      }
    }

    /**
     * @param {boolean} value
     */
    function enableAutoPlayNextEpisode(value) {
      if (enabled === value) {
        return;
      }
      enabled = value;
      onAutoPlayNextEpisodeChange();
    }

    /**
     * @param {number} value
     */
    function setAutoPlayNextEpisodeDelay(value) {
      if (!isFinite(value)) {
        return;
      }

      value = Math.round(value);
      if (delayTime === value) {
        return;
      }
      delayTime = value;
    }

    return {
      enableAutoPlayNextEpisode,
      setAutoPlayNextEpisodeDelay,
    };
  }

  /**
   * @param {VjsPlayerElement} vjsPlayer
   */
  function useCustomShortcuts(vjsPlayer) {
    /** @type {Map<string, ShortcutAction>} */
    const shortcutMap = new Map();

    /**
     * @param {KeyboardEvent} e
     * @returns {string}
     */
    function getKeyValue(e) {
      return e.key;
    }

    /**
     * @param {KeyboardEvent} e
     */
    function getKeyModifier(e) {
      /** @type {string} */
      let str = '';
      if (e.shiftKey) {
        str = 'Shift-' + str;
      }
      if (e.ctrlKey) {
        str = 'Ctrl-' + str;
      }
      if (e.metaKey) {
        str = 'Meta-' + str;
      }
      if (e.altKey) {
        str = 'Alt-' + str;
      }
      return str;
    }

    /**
     * @param {KeyboardEvent} e
     * @returns {string}
     */
    function getKeyFullValue(e) {
      return getKeyModifier(e) + getKeyValue(e);
    }

    /**
     * @param {KeyboardEvent} e
     */
    function switchPreviousVideo(e) {
      /** @type {HTMLButtonElement | null} */
      const button = vjsPlayer.querySelector('button.vjs-pre-button');
      button?.click();
    }

    /**
     * @param {KeyboardEvent} e
     */
    function switchNextVideo(e) {
      /** @type {HTMLButtonElement | null} */
      const button = vjsPlayer.querySelector('button.vjs-next-button');
      button?.click();
    }

    /**
     * @param {KeyboardEvent} e
     */
    function onKeyDown(e) {
      const action = shortcutMap.get(getKeyFullValue(e));
      if (!action) {
        return;
      }

      switch (action) {
        case 'previous_episode':
          switchPreviousVideo(e);
          break;
        case 'next_episode':
          switchNextVideo(e);
          break;
      }
      e.preventDefault();
    }

    /**
     * @param {readonly CustomShortcut[]} value
     */
    function setCustomShortcuts(value) {
      shortcutMap.clear();
      for (const [name, action] of value) {
        shortcutMap.set(name, action);
      }
    }

    vjsPlayer.addEventListener('keydown', onKeyDown);

    return {
      setCustomShortcuts,
    };
  }

  /**
   * @param {VjsPlayerElement} vjsPlayer
   * @param {(settings: Partial<Settings>) => void} callback
   */
  function useSettingUi(vjsPlayer, callback) {
    const subtitleFrame = vjsPlayer.closest('.player')?.querySelector('.subtitle');

    const tabContentId = 'ani-tab-content-enhancement';
    const inputIds = {
      autoAgreeContentRating: 'enhancement-auto-agree-content-rating',
      autoPlayNextEpisode: 'enhancement-auto-play-next-episode',
      autoPlayNextEpisodeDelay: 'enhancement-auto-play-next-episode-delay',
    };

    function attachTabUi() {
      if (!subtitleFrame) {
        return;
      }

      const tabsEl = subtitleFrame.querySelector('.ani-tabs');
      if (!tabsEl) {
        return;
      }

      const tabItemEl = document.createElement('div');
      tabItemEl.classList.add('ani-tabs__item');

      const tabLinkEl = document.createElement('a');
      tabLinkEl.href = '#' + tabContentId;
      tabLinkEl.classList.add('ani-tabs-link');
      tabLinkEl.textContent = getI18n('settings_tab_name');
      tabLinkEl.addEventListener('click', function(e) {
        e.preventDefault();

        // The pure-js implementation of the same logic from the original site.

        // HACK: workaround for Plus-Ani.
        for (const el of subtitleFrame.querySelectorAll('.ani-tabs-link.is-active, .plus_ani-tabs-link.is-active')) {
          el.classList.remove('is-active');
        }
        this.classList.add('is-active');

        for (const el of /** @type {NodeListOf<HTMLElement>} */ (subtitleFrame.querySelectorAll('.ani-tab-content__item'))) {
          el.style.display = 'none';
        }

        // Must use `getAttribute` to only get the id rather than the full url.
        const targetContentEl = document.getElementById((this.getAttribute('href') ?? '').slice(1));
        if (targetContentEl) {
          targetContentEl.style.display = targetContentEl.classList.contains('setting-program') ? 'flex' : 'block';
        }
      });

      tabItemEl.appendChild(tabLinkEl);
      tabsEl.appendChild(tabItemEl);
    }

    function attachTabContentUi() {
      if (!subtitleFrame) {
        return;
      }

      const tabContentEl = subtitleFrame.querySelector('.ani-tab-content');
      if (!tabContentEl) {
        return;
      }

      const tabContentItemEl = document.createElement('div');
      tabContentItemEl.id = tabContentId;
      tabContentItemEl.classList.add('ani-tab-content__item');

      tabContentItemEl.appendChild(
        createSettingElements([
          {
            title: getI18n('play_settings'),
            items: [
              {
                type: 'checkbox',
                id: inputIds.autoAgreeContentRating,
                label: getI18n('auto_agree_content_rating'),
                value: false,
              },
              {
                type: 'checkbox',
                id: inputIds.autoPlayNextEpisode,
                label: getI18n('auto_play_next_episode'),
                labelTip: getI18n('auto_play_next_episode_tip'),
                value: false,
              },
              {
                type: 'number',
                id: inputIds.autoPlayNextEpisodeDelay,
                label: getI18n('auto_play_next_episode_delay'),
                value: 5,
                max: 10,
                min: 0,
                placeholder: getI18n('second'),
              },
            ],
          },
        ]),
      );
      tabContentEl.appendChild(tabContentItemEl);
    }

    /**
     * @typedef {object} SettingCheckboxConfig
     * @property {'checkbox'} type
     * @property {string} id
     * @property {string} [label]
     * @property {string} [labelTip]
     * @property {boolean} [value]
     */

    /**
     * @typedef {object} SettingNumberConfig
     * @property {'number'} type
     * @property {string} id
     * @property {string} [label]
     * @property {string} [labelTip]
     * @property {number} [value]
     * @property {number} [max]
     * @property {number} [min]
     * @property {string} [placeholder]
     */

    /**
     * @typedef {SettingCheckboxConfig | SettingNumberConfig} SettingItemConfig
     */

    /**
     * @typedef {object} SettingSectionConfig
     * @property {string} title
     * @property {SettingItemConfig[]} items
     */

    /**
     * @param {SettingItemConfig} config
     * @returns {DocumentFragment}
     */
    function createSettingItemLabel(config) {
      const fragment = document.createDocumentFragment();
      if (config.label) {
        const dummyEl = document.createElement('div');
        dummyEl.innerHTML = `
          <div class="ani-setting-label">
            <span class="ani-setting-label__mian"></span>
          </div>
        `;

        const labelEl = dummyEl.querySelector('.ani-setting-label');
        if (labelEl) {
          labelEl.textContent = config.label;
        }

        fragment.append(...dummyEl.childNodes);

        if (config.labelTip) {
          dummyEl.innerHTML = `
            <div class="qa-icon" style="display:inline-block;top:1px;">
              <img src="https://i2.bahamut.com.tw/anime/smallQAicon.svg">
            </div>
          `;

          const tipEl = dummyEl.firstElementChild;
          if (tipEl) {
            tipEl.setAttribute('tip-content', config.labelTip);
          }

          fragment.append(...dummyEl.childNodes);
        }
      }
      return fragment;
    }

    /**
     * @param {SettingItemConfig} config
     * @returns {HTMLElement}
     */
    function createSettingItemElement(config) {
      if (config.type === 'checkbox') {
        const dummyEl = document.createElement('div');
        dummyEl.innerHTML = `
          <div class="ani-setting-item ani-flex">
            <div class="ani-setting-value ani-set-flex-right">
              <div class="ani-checkbox">
                <label class="ani-checkbox__label">
                <input type="checkbox" name="ani-checkbox">
                  <div class="ani-checkbox__button"></div>
                </label>
              </div>
            </div>
          </div>
        `;

        const itemEl = /** @type {HTMLDivElement} */ (dummyEl.firstElementChild);
        itemEl.prepend(createSettingItemLabel(config));

        const inputEl = itemEl.querySelector('input');
        if (inputEl) {
          inputEl.id = config.id;
          inputEl.checked = config.value ?? false;
        }

        return itemEl;
      } else if (config.type === 'number') {
        const dummyEl = document.createElement('div');
        dummyEl.innerHTML = `
          <div class="ani-setting-item ani-flex">
            <div class="ani-setting-value ani-set-flex-right">
              <input type="number" class="ani-input ani-input--keyword">
            </div>
          </div>
        `;

        const itemEl = /** @type {HTMLDivElement} */ (dummyEl.firstElementChild);
        itemEl.prepend(createSettingItemLabel(config));

        const inputEl = dummyEl.querySelector('input');
        if (inputEl) {
          inputEl.id = config.id;
          inputEl.value = config.value !== undefined ? String(config.value) : '';
          if (config.max !== undefined) {
            inputEl.max = String(config.max);
          }
          if (config.min !== undefined) {
            inputEl.min = String(config.min);
          }
          if (config.placeholder !== undefined) {
            inputEl.placeholder = config.placeholder;
          }
        }

        return itemEl;
      } else {
        throw new Error(`Unknown setting item: ${config}`);
      }
    }

    /**
     * @param {SettingSectionConfig} config
     * @returns {HTMLElement}
     */
    function createSettingSectionElement(config) {
      const sectionEl = document.createElement('div');
      sectionEl.classList.add('ani-setting-section');

      const titleEl = document.createElement('h4');
      titleEl.classList.add('ani-setting-title');
      titleEl.textContent = config.title;

      sectionEl.appendChild(titleEl);
      sectionEl.append(...config.items.map((item) => createSettingItemElement(item)));
      return sectionEl;
    }

    /**
     * @param {readonly SettingSectionConfig[]} configs
     * @returns {DocumentFragment}
     */
    function createSettingElements(configs) {
      const fragment = document.createDocumentFragment();
      fragment.append(...configs.map((config) => createSettingSectionElement(config)));
      return fragment;
    }

    /**
     * @param {string} id
     * @returns {HTMLInputElement | null}
     */
    function getSettingInput(id) {
      const inputEl = document.getElementById(id);
      if (!inputEl || inputEl.tagName !== 'INPUT') {
        console.warn(`invalid setting id: ${id}`);
        return null;
      }
      return /** @type {HTMLInputElement} */ (inputEl);
    }

    function initUiEvents() {
      /** @type {Array<[string, (inputEl: HTMLInputElement, e: Event) => Partial<Settings>]>} */
      const settingList = [
        [inputIds.autoAgreeContentRating, (inputEl) => ({ autoAgreeContentRating: inputEl.checked })],
        [inputIds.autoPlayNextEpisode, (inputEl) => ({ autoPlayNextEpisode: inputEl.checked })],
        [inputIds.autoPlayNextEpisodeDelay, (inputEl) => ({ autoPlayNextEpisodeDelay: +inputEl.value })],
      ];
      for (const [id, handler] of settingList) {
        const inputEl = getSettingInput(id);
        if (!inputEl) {
          continue;
        }

        inputEl.addEventListener('change', (e) => {
          const settings = handler(inputEl, e);
          applySettings(settings);
          callback(settings);
        });
      }
    }

    /**
     * @param {Partial<Settings>} settings
     */
    function applySettings(settings) {
      /** @type {Array<[string, unknown | undefined]>} */
      const settingList = [
        [inputIds.autoAgreeContentRating, settings.autoAgreeContentRating],
        [inputIds.autoPlayNextEpisode, settings.autoPlayNextEpisode],
        [inputIds.autoPlayNextEpisodeDelay, settings.autoPlayNextEpisodeDelay],
      ];
      for (const [id, value] of settingList) {
        if (value === undefined) {
          continue;
        }

        const inputEl = getSettingInput(id);
        if (!inputEl) {
          continue;
        }

        const inputType = inputEl.type;
        if (inputType === 'checkbox') {
          inputEl.checked = !!value;
        } else if (inputType === 'number' || inputType === 'text') {
          inputEl.value = String(value);
        } else {
          console.warn(`invalid setting input type: ${inputEl.type}`);
        }
      }
    }

    attachTabUi();
    attachTabContentUi();
    initUiEvents();

    return {
      applySettings,
    };
  }

  /**
   * @returns {Promise<VjsPlayerElement>}
   */
  async function waitVjsPlayerElementInit() {
    /**
     * @returns {VjsPlayerElement | null}
     */
    function queryVjsPlayerElement() {
      return document.querySelector('.video-js');
    }

    /**
     * @param {VjsPlayerElement} vjsPlyer
     * @returns {boolean}
     */
    function checkVjsPlayerElementReady(vjsPlyer) {
      return !!vjsPlyer.querySelector('.stop');
    }

    let vjsPlyer = queryVjsPlayerElement();
    if (vjsPlyer && checkVjsPlayerElementReady(vjsPlyer)) {
      return vjsPlyer;
    }

    /** @type {MutationObserver | undefined} */
    let mutationObserver;
    return new Promise((resolve) => {
      mutationObserver = new MutationObserver(async () => {
        if (!vjsPlyer) {
          vjsPlyer = queryVjsPlayerElement();
        }
        if (vjsPlyer && checkVjsPlayerElementReady(vjsPlyer)) {
          resolve(vjsPlyer);
        }
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }).finally(() => {
      mutationObserver?.disconnect();
    });
  }

  async function main() {
    const settings = await loadSettings();
    const vjsPlayerElement = await waitVjsPlayerElementInit();

    const contentRatingStore = useContentRating(vjsPlayerElement);
    const nextEpisodeStore = useNextEpisode(vjsPlayerElement);
    const customShortcutsStore = useCustomShortcuts(vjsPlayerElement);
    const settingUiStore = useSettingUi(vjsPlayerElement, (settings) => {
      saveSettings(settings);
      applySettings(settings);
    });

    /**
     * @param {Partial<Settings>} settings
     */
    function applySettings(settings) {
      if (settings.autoAgreeContentRating !== undefined) {
        contentRatingStore.enableAutoAgreeContentRating(settings.autoAgreeContentRating);
      }
      if (settings.autoPlayNextEpisode !== undefined) {
        nextEpisodeStore.enableAutoPlayNextEpisode(settings.autoPlayNextEpisode);
      }
      if (settings.autoPlayNextEpisodeDelay !== undefined) {
        nextEpisodeStore.setAutoPlayNextEpisodeDelay(settings.autoPlayNextEpisodeDelay);
      }
      if (settings.customShortcuts !== undefined) {
        customShortcutsStore.setCustomShortcuts(settings.customShortcuts);
      }
    }

    applySettings(settings);
    settingUiStore.applySettings(settings);
  }

  main();
})();
