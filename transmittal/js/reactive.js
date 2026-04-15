(function (app) {
    'use strict';

    /**
     * Creates a reactive state object using Proxy.
     * When properties change, all registered subscribers are notified.
     * 
     * @param {Object} initialState - Initial state values
     * @returns {Object} Reactive state proxy with subscribe/unsubscribe methods
     */
    function createReactiveState(initialState) {
        const subscribers = new Set();
        const state = { ...initialState };
        
        const handler = {
            get(target, property) {
                // Expose subscription methods
                if (property === 'subscribe') {
                    return function(callback) {
                        if (typeof callback === 'function') {
                            subscribers.add(callback);
                        }
                        return function unsubscribe() {
                            subscribers.delete(callback);
                        };
                    };
                }
                
                if (property === 'unsubscribeAll') {
                    return function() {
                        subscribers.clear();
                    };
                }
                
                // Return the actual property value
                return target[property];
            },
            
            set(target, property, value) {
                const oldValue = target[property];
                
                // Only notify if value actually changed
                if (oldValue !== value) {
                    target[property] = value;
                    
                    // Notify all subscribers
                    subscribers.forEach(function(callback) {
                        try {
                            callback(property, value, oldValue);
                        } catch (err) {
                            console.error('[reactive] Subscriber error:', err);
                        }
                    });
                }
                
                return true;
            }
        };
        
        return new Proxy(state, handler);
    }

    app.createReactiveState = createReactiveState;
})(window.transmittalApp);
