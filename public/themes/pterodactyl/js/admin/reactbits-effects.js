/*
 * Interactions adapted from the SpotlightCard, MagicBento, and Magnet patterns
 * in React Bits by David Haz. MIT + Commons Clause; see THIRD_PARTY_NOTICES.md.
 */
(function () {
    'use strict';

    function moveModalToBody(modal) {
        if (modal && modal.parentNode !== document.body) {
            document.body.appendChild(modal);
        }
    }

    function init() {
        document.querySelectorAll('.modal').forEach(moveModalToBody);

        // AdminLTE keeps page content in an overflow-constrained wrapper. Bootstrap
        // modals must be direct body children or their controls can sit behind the
        // backdrop and become impossible to click. Handle dynamically-added modals,
        // too, immediately before Bootstrap opens them.
        if (window.jQuery) {
            window.jQuery(document)
                .off('show.bs.modal.rockTheme', '.modal')
                .on('show.bs.modal.rockTheme', '.modal', function () {
                    moveModalToBody(this);
                });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
