(function (app) {
    'use strict';

    const dom = app.dom = app.dom || {};

    dom.qs = function (selector) {
        return document.querySelector(selector);
    };

    dom.qsa = function (selector) {
        return Array.from(document.querySelectorAll(selector));
    };

    dom.show = function (element, shouldShow) {
        if (!element) {
            return;
        }
        element.hidden = !shouldShow;
    };
})(window.transmittalApp);
