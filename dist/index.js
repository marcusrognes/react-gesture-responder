import * as React from "react";
import { isMouseEnabled } from "./mouse-enabled";
const initialState = {
    time: Date.now(),
    xy: [0, 0],
    delta: [0, 0],
    initial: [0, 0],
    previous: [0, 0],
    direction: [0, 0],
    initialDirection: [0, 0],
    local: [0, 0],
    lastLocal: [0, 0],
    velocity: 0,
    distance: 0
};
const defaultConfig = {
    enableMouse: true
};
let grantedTouch = null;
export function useGestureResponder(options = {}, config = {}) {
    const state = React.useRef(initialState);
    const { uid, enableMouse } = Object.assign(Object.assign({}, defaultConfig), config);
    const id = React.useRef(uid || Math.random());
    const pressed = React.useRef(false);
    // update our callbacks when they change
    const callbackRefs = React.useRef(options);
    React.useEffect(() => {
        callbackRefs.current = options;
    }, [options]);
    /**
     * Attempt to claim the active touch
     */
    function claimTouch(e) {
        if (grantedTouch && grantedTouch.onTerminationRequest(e)) {
            grantedTouch.onTerminate(e);
            grantedTouch = null;
        }
        attemptGrant(e);
    }
    /**
     * Attempt to claim the active touch
     * @param e
     */
    function attemptGrant(e) {
        // if a touch is already active we won't register
        if (grantedTouch) {
            return;
        }
        grantedTouch = {
            id: id.current,
            onTerminate,
            onTerminationRequest
        };
        onGrant(e);
    }
    function bindGlobalMouseEvents() {
        window.addEventListener("mousemove", handleMoveMouse, false);
        window.addEventListener("mousemove", handleMoveMouseCapture, true);
        window.addEventListener("mouseup", handleEndMouse);
    }
    function unbindGlobalMouseEvents() {
        window.removeEventListener("mousemove", handleMoveMouse, false);
        window.removeEventListener("mousemove", handleMoveMouseCapture, true);
        window.removeEventListener("mouseup", handleEndMouse);
    }
    function handleStartCapture(e) {
        updateStartState(e);
        pressed.current = true;
        const granted = onStartShouldSetCapture(e);
        if (granted) {
            attemptGrant(e);
        }
    }
    function handleStart(e) {
        updateStartState(e);
        pressed.current = true;
        bindGlobalMouseEvents();
        const granted = onStartShouldSet(e);
        if (granted) {
            attemptGrant(e);
        }
    }
    function isGrantedTouch() {
        return grantedTouch && grantedTouch.id === id.current;
    }
    /**
     * Handle touchend / mouseup events
     * @param e
     */
    function handleEnd(e) {
        pressed.current = false;
        unbindGlobalMouseEvents();
        if (!isGrantedTouch()) {
            return;
        }
        // remove touch
        grantedTouch = null;
        onRelease(e);
    }
    /**
     * Handle touchmove / mousemove capture events
     * @param e
     */
    function handleMoveCapture(e) {
        updateMoveState(e);
        if (isGrantedTouch()) {
            return;
        }
        if (onMoveShouldSetCapture(e)) {
            claimTouch(e);
        }
    }
    /**
     * Handle touchmove / mousemove events
     * @param e
     */
    function handleMove(e) {
        if (isGrantedTouch()) {
            onMove(e);
            return;
        }
        if (onMoveShouldSet(e)) {
            claimTouch(e);
        }
    }
    /**
     * When our gesture starts, should we become the responder?
     */
    function onStartShouldSet(e) {
        return callbackRefs.current.onStartShouldSet
            ? callbackRefs.current.onStartShouldSet(state.current, e)
            : false;
    }
    /**
     * Same as onStartShouldSet, except using capture.
     */
    function onStartShouldSetCapture(e) {
        return callbackRefs.current.onStartShouldSetCapture
            ? callbackRefs.current.onStartShouldSetCapture(state.current, e)
            : false;
    }
    /**
     * When our gesture moves, should we become the responder?
     */
    function onMoveShouldSet(e) {
        return callbackRefs.current.onMoveShouldSet
            ? callbackRefs.current.onMoveShouldSet(state.current, e)
            : false;
    }
    /**
     * Same as onMoveShouldSet, but using capture instead
     * of bubbling.
     */
    function onMoveShouldSetCapture(e) {
        return callbackRefs.current.onMoveShouldSetCapture
            ? callbackRefs.current.onMoveShouldSetCapture(state.current, e)
            : false;
    }
    /**
     * The view is responding to gestures. Typically corresponds
     * with mousedown or touchstart.
     * @param e
     */
    function onGrant(e) {
        if (callbackRefs.current.onGrant) {
            callbackRefs.current.onGrant(state.current, e);
        }
    }
    /**
     * Update our kinematics for start events
     * @param e
     */
    function updateStartState(e) {
        const { pageX, pageY } = e.touches && e.touches[0] ? e.touches[0] : e;
        const s = state.current;
        state.current = Object.assign(Object.assign({}, initialState), { lastLocal: s.lastLocal || initialState.lastLocal, xy: [pageX, pageY], initial: [pageX, pageY], previous: [pageX, pageY], time: Date.now() });
    }
    /**
     * Update our kinematics when moving
     * @param e
     */
    function updateMoveState(e) {
        const { pageX, pageY } = e.touches && e.touches[0] ? e.touches[0] : e;
        const s = state.current;
        const time = Date.now();
        const x_dist = pageX - s.xy[0];
        const y_dist = pageY - s.xy[1];
        const delta_x = pageX - s.initial[0];
        const delta_y = pageY - s.initial[1];
        const distance = Math.sqrt(delta_x * delta_x + delta_y * delta_y);
        const len = Math.sqrt(x_dist * x_dist + y_dist * y_dist);
        const scaler = 1 / (len || 1);
        const velocity = len / (time - s.time);
        const initialDirection = s.initialDirection[0] !== 0 || s.initialDirection[1] !== 0
            ? s.initialDirection
            : [delta_x * scaler, delta_y * scaler];
        state.current = Object.assign(Object.assign({}, state.current), { time, xy: [pageX, pageY], initialDirection, delta: [delta_x, delta_y], local: [
                s.lastLocal[0] + pageX - s.initial[0],
                s.lastLocal[1] + pageY - s.initial[1]
            ], velocity: time - s.time === 0 ? s.velocity : velocity, distance, direction: [x_dist * scaler, y_dist * scaler], previous: s.xy });
    }
    /**
     * The user is moving their touch / mouse.
     * @param e
     */
    function onMove(e) {
        if (pressed.current && callbackRefs.current.onMove) {
            callbackRefs.current.onMove(state.current, e);
        }
    }
    /**
     * The responder has been released. Typically mouse-up or
     * touchend events.
     * @param e
     */
    function onRelease(e) {
        const s = state.current;
        state.current = Object.assign(Object.assign({}, state.current), { lastLocal: s.local });
        if (callbackRefs.current.onRelease) {
            callbackRefs.current.onRelease(state.current, e);
        }
        grantedTouch = null;
    }
    /**
     * Check with the current responder to see if it can
     * be terminated. This is currently only triggered when returns true
     * from onMoveShouldSet. I can't really envision much of a
     * use-case for doing this with a standard onStartShouldSet.
     *
     * By default, returns true.
     */
    function onTerminationRequest(e) {
        return callbackRefs.current.onTerminationRequest
            ? callbackRefs.current.onTerminationRequest(state.current, e)
            : true;
    }
    /**
     * The responder has been taken by another view
     */
    function onTerminate(e) {
        const s = state.current;
        state.current = Object.assign(Object.assign({}, state.current), { lastLocal: s.local });
        if (callbackRefs.current.onTerminate) {
            callbackRefs.current.onTerminate(state.current, e);
        }
    }
    /**
     * Use window mousemove events instead of binding to the
     * element itself to better emulate how touchmove works.
     */
    function handleMoveMouse(e) {
        if (isMouseEnabled()) {
            handleMove(e);
        }
    }
    function handleMoveMouseCapture(e) {
        if (isMouseEnabled()) {
            handleMoveCapture(e);
        }
    }
    function handleEndMouse(e) {
        if (isMouseEnabled()) {
            handleEnd(e);
        }
    }
    React.useEffect(() => unbindGlobalMouseEvents, []);
    /**
     * Imperatively terminate the current responder
     */
    function terminateCurrentResponder() {
        if (grantedTouch) {
            grantedTouch.onTerminate();
            grantedTouch = null;
        }
    }
    /**
     * A getter for returning the current
     * responder, if it exists
     */
    function getCurrentResponder() {
        return grantedTouch;
    }
    /**
     * Required touch / mouse events
     */
    const touchEvents = {
        onTouchStart: handleStart,
        onTouchEnd: handleEnd,
        onTouchMove: handleMove,
        onTouchStartCapture: handleStartCapture,
        onTouchMoveCapture: handleMoveCapture
    };
    const mouseEvents = enableMouse
        ? {
            onMouseDown: (e) => {
                if (isMouseEnabled()) {
                    handleStart(e);
                }
            },
            onMouseDownCapture: (e) => {
                if (isMouseEnabled()) {
                    handleStartCapture(e);
                }
            }
        }
        : {};
    return {
        bind: Object.assign(Object.assign({}, touchEvents), mouseEvents),
        terminateCurrentResponder,
        getCurrentResponder
    };
}
//# sourceMappingURL=index.js.map