
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\components\ServiceForm.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1 } = globals;
    const file$3 = "src\\components\\ServiceForm.svelte";

    // (35:8) {#if errors.name}
    function create_if_block_2(ctx) {
    	let span;
    	let t_value = /*errors*/ ctx[3].name + "";
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			attr_dev(span, "class", "error svelte-1aiohy9");
    			add_location(span, file$3, 35, 12, 1032);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*errors*/ 8 && t_value !== (t_value = /*errors*/ ctx[3].name + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(35:8) {#if errors.name}",
    		ctx
    	});

    	return block;
    }

    // (42:8) {#if errors.description}
    function create_if_block_1(ctx) {
    	let span;
    	let t_value = /*errors*/ ctx[3].description + "";
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			attr_dev(span, "class", "error svelte-1aiohy9");
    			add_location(span, file$3, 42, 12, 1286);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*errors*/ 8 && t_value !== (t_value = /*errors*/ ctx[3].description + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(42:8) {#if errors.description}",
    		ctx
    	});

    	return block;
    }

    // (49:8) {#if errors.price}
    function create_if_block$2(ctx) {
    	let span;
    	let t_value = /*errors*/ ctx[3].price + "";
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			attr_dev(span, "class", "error svelte-1aiohy9");
    			add_location(span, file$3, 49, 12, 1525);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*errors*/ 8 && t_value !== (t_value = /*errors*/ ctx[3].price + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(49:8) {#if errors.price}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let form;
    	let div0;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let t3;
    	let div1;
    	let label1;
    	let t5;
    	let textarea;
    	let t6;
    	let t7;
    	let div2;
    	let label2;
    	let t9;
    	let input1;
    	let t10;
    	let t11;
    	let button;
    	let mounted;
    	let dispose;
    	let if_block0 = /*errors*/ ctx[3].name && create_if_block_2(ctx);
    	let if_block1 = /*errors*/ ctx[3].description && create_if_block_1(ctx);
    	let if_block2 = /*errors*/ ctx[3].price && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Service Name:";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			if (if_block0) if_block0.c();
    			t3 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Description:";
    			t5 = space();
    			textarea = element("textarea");
    			t6 = space();
    			if (if_block1) if_block1.c();
    			t7 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Price (INR):";
    			t9 = space();
    			input1 = element("input");
    			t10 = space();
    			if (if_block2) if_block2.c();
    			t11 = space();
    			button = element("button");
    			button.textContent = "Add Service";
    			attr_dev(label0, "for", "name");
    			attr_dev(label0, "class", "svelte-1aiohy9");
    			add_location(label0, file$3, 32, 8, 905);
    			attr_dev(input0, "id", "name");
    			attr_dev(input0, "class", "svelte-1aiohy9");
    			add_location(input0, file$3, 33, 8, 954);
    			attr_dev(div0, "class", "svelte-1aiohy9");
    			add_location(div0, file$3, 31, 4, 890);
    			attr_dev(label1, "for", "description");
    			attr_dev(label1, "class", "svelte-1aiohy9");
    			add_location(label1, file$3, 39, 8, 1120);
    			attr_dev(textarea, "id", "description");
    			attr_dev(textarea, "class", "svelte-1aiohy9");
    			add_location(textarea, file$3, 40, 8, 1175);
    			attr_dev(div1, "class", "svelte-1aiohy9");
    			add_location(div1, file$3, 38, 4, 1105);
    			attr_dev(label2, "for", "price");
    			attr_dev(label2, "class", "svelte-1aiohy9");
    			add_location(label2, file$3, 46, 8, 1381);
    			attr_dev(input1, "id", "price");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "class", "svelte-1aiohy9");
    			add_location(input1, file$3, 47, 8, 1430);
    			attr_dev(div2, "class", "svelte-1aiohy9");
    			add_location(div2, file$3, 45, 4, 1366);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "svelte-1aiohy9");
    			add_location(button, file$3, 52, 4, 1599);
    			attr_dev(form, "class", "svelte-1aiohy9");
    			add_location(form, file$3, 30, 0, 838);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t1);
    			append_dev(div0, input0);
    			set_input_value(input0, /*name*/ ctx[0]);
    			append_dev(div0, t2);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(form, t3);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t5);
    			append_dev(div1, textarea);
    			set_input_value(textarea, /*description*/ ctx[1]);
    			append_dev(div1, t6);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(form, t7);
    			append_dev(form, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t9);
    			append_dev(div2, input1);
    			set_input_value(input1, /*price*/ ctx[2]);
    			append_dev(div2, t10);
    			if (if_block2) if_block2.m(div2, null);
    			append_dev(form, t11);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[5]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[6]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[7]),
    					listen_dev(form, "submit", prevent_default(/*handleSubmit*/ ctx[4]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1 && input0.value !== /*name*/ ctx[0]) {
    				set_input_value(input0, /*name*/ ctx[0]);
    			}

    			if (/*errors*/ ctx[3].name) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*description*/ 2) {
    				set_input_value(textarea, /*description*/ ctx[1]);
    			}

    			if (/*errors*/ ctx[3].description) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*price*/ 4 && to_number(input1.value) !== /*price*/ ctx[2]) {
    				set_input_value(input1, /*price*/ ctx[2]);
    			}

    			if (/*errors*/ ctx[3].price) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$2(ctx);
    					if_block2.c();
    					if_block2.m(div2, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ServiceForm', slots, []);
    	const dispatch = createEventDispatcher();
    	let name = '';
    	let description = '';
    	let price = '';
    	let errors = {};

    	function validate() {
    		$$invalidate(3, errors = {});
    		if (!name.trim()) $$invalidate(3, errors.name = 'Name is required.', errors);
    		if (!description.trim()) $$invalidate(3, errors.description = 'Description is required.', errors);

    		if (!price || isNaN(price) || Number(price) <= 0) {
    			$$invalidate(3, errors.price = 'Valid price is required.', errors);
    		}

    		return Object.keys(errors).length === 0;
    	}

    	function handleSubmit() {
    		if (validate()) {
    			dispatch('addService', { name, description, price: Number(price) });
    			$$invalidate(0, name = '');
    			$$invalidate(1, description = '');
    			$$invalidate(2, price = '');
    		}
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ServiceForm> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	function textarea_input_handler() {
    		description = this.value;
    		$$invalidate(1, description);
    	}

    	function input1_input_handler() {
    		price = to_number(this.value);
    		$$invalidate(2, price);
    	}

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		name,
    		description,
    		price,
    		errors,
    		validate,
    		handleSubmit
    	});

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('description' in $$props) $$invalidate(1, description = $$props.description);
    		if ('price' in $$props) $$invalidate(2, price = $$props.price);
    		if ('errors' in $$props) $$invalidate(3, errors = $$props.errors);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		description,
    		price,
    		errors,
    		handleSubmit,
    		input0_input_handler,
    		textarea_input_handler,
    		input1_input_handler
    	];
    }

    class ServiceForm extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ServiceForm",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\components\ServiceItem.svelte generated by Svelte v3.59.2 */
    const file$2 = "src\\components\\ServiceItem.svelte";

    // (46:4) {:else}
    function create_else_block$1(ctx) {
    	let div;
    	let h3;
    	let t0_value = /*service*/ ctx[0].name + "";
    	let t0;
    	let t1;
    	let p0;
    	let t2_value = /*service*/ ctx[0].description + "";
    	let t2;
    	let t3;
    	let p1;
    	let strong;
    	let t5;
    	let t6_value = /*service*/ ctx[0].price.toFixed(2) + "";
    	let t6;
    	let t7;
    	let button0;
    	let t9;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			p0 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			p1 = element("p");
    			strong = element("strong");
    			strong.textContent = "Price:";
    			t5 = text(" $");
    			t6 = text(t6_value);
    			t7 = space();
    			button0 = element("button");
    			button0.textContent = "Edit";
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "Delete";
    			attr_dev(h3, "class", "svelte-1nasqp9");
    			add_location(h3, file$2, 47, 12, 1526);
    			attr_dev(p0, "class", "svelte-1nasqp9");
    			add_location(p0, file$2, 48, 12, 1563);
    			add_location(strong, file$2, 49, 15, 1608);
    			attr_dev(p1, "class", "svelte-1nasqp9");
    			add_location(p1, file$2, 49, 12, 1605);
    			attr_dev(button0, "class", "svelte-1nasqp9");
    			add_location(button0, file$2, 50, 12, 1677);
    			attr_dev(button1, "class", "svelte-1nasqp9");
    			add_location(button1, file$2, 51, 12, 1734);
    			attr_dev(div, "class", "service-details svelte-1nasqp9");
    			add_location(div, file$2, 46, 8, 1483);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, p0);
    			append_dev(p0, t2);
    			append_dev(div, t3);
    			append_dev(div, p1);
    			append_dev(p1, strong);
    			append_dev(p1, t5);
    			append_dev(p1, t6);
    			append_dev(div, t7);
    			append_dev(div, button0);
    			append_dev(div, t9);
    			append_dev(div, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*toggleEdit*/ ctx[5], false, false, false, false),
    					listen_dev(button1, "click", /*handleDelete*/ ctx[7], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*service*/ 1 && t0_value !== (t0_value = /*service*/ ctx[0].name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*service*/ 1 && t2_value !== (t2_value = /*service*/ ctx[0].description + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*service*/ 1 && t6_value !== (t6_value = /*service*/ ctx[0].price.toFixed(2) + "")) set_data_dev(t6, t6_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(46:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (38:4) {#if isEditing}
    function create_if_block$1(ctx) {
    	let div;
    	let input0;
    	let t0;
    	let textarea;
    	let t1;
    	let input1;
    	let t2;
    	let button0;
    	let t4;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input0 = element("input");
    			t0 = space();
    			textarea = element("textarea");
    			t1 = space();
    			input1 = element("input");
    			t2 = space();
    			button0 = element("button");
    			button0.textContent = "Save";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "Cancel";
    			attr_dev(input0, "placeholder", "Service Name");
    			attr_dev(input0, "class", "svelte-1nasqp9");
    			add_location(input0, file$2, 39, 12, 1098);
    			attr_dev(textarea, "placeholder", "Description");
    			attr_dev(textarea, "class", "svelte-1nasqp9");
    			add_location(textarea, file$2, 40, 12, 1170);
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "placeholder", "Price");
    			attr_dev(input1, "class", "svelte-1nasqp9");
    			add_location(input1, file$2, 41, 12, 1260);
    			attr_dev(button0, "class", "svelte-1nasqp9");
    			add_location(button0, file$2, 42, 12, 1340);
    			attr_dev(button1, "class", "svelte-1nasqp9");
    			add_location(button1, file$2, 43, 12, 1399);
    			attr_dev(div, "class", "edit-form svelte-1nasqp9");
    			add_location(div, file$2, 38, 8, 1061);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input0);
    			set_input_value(input0, /*editName*/ ctx[2]);
    			append_dev(div, t0);
    			append_dev(div, textarea);
    			set_input_value(textarea, /*editDescription*/ ctx[3]);
    			append_dev(div, t1);
    			append_dev(div, input1);
    			set_input_value(input1, /*editPrice*/ ctx[4]);
    			append_dev(div, t2);
    			append_dev(div, button0);
    			append_dev(div, t4);
    			append_dev(div, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[9]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[10]),
    					listen_dev(button0, "click", /*handleUpdate*/ ctx[6], false, false, false, false),
    					listen_dev(button1, "click", /*toggleEdit*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*editName*/ 4 && input0.value !== /*editName*/ ctx[2]) {
    				set_input_value(input0, /*editName*/ ctx[2]);
    			}

    			if (dirty & /*editDescription*/ 8) {
    				set_input_value(textarea, /*editDescription*/ ctx[3]);
    			}

    			if (dirty & /*editPrice*/ 16 && to_number(input1.value) !== /*editPrice*/ ctx[4]) {
    				set_input_value(input1, /*editPrice*/ ctx[4]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(38:4) {#if isEditing}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let li;

    	function select_block_type(ctx, dirty) {
    		if (/*isEditing*/ ctx[1]) return create_if_block$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			li = element("li");
    			if_block.c();
    			attr_dev(li, "class", "service-item svelte-1nasqp9");
    			add_location(li, file$2, 36, 0, 1005);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			if_block.m(li, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(li, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ServiceItem', slots, []);
    	let { service } = $$props;
    	let isEditing = false;
    	let editName = service.name;
    	let editDescription = service.description;
    	let editPrice = service.price;
    	const dispatch = createEventDispatcher();

    	function toggleEdit() {
    		$$invalidate(1, isEditing = !isEditing);
    	}

    	function handleUpdate() {
    		if (editName.trim() && editDescription.trim() && editPrice > 0) {
    			dispatch('updateService', {
    				id: service.id,
    				name: editName,
    				description: editDescription,
    				price: Number(editPrice)
    			});

    			$$invalidate(1, isEditing = false);
    		} else {
    			alert('Please fill in all fields with valid data.');
    		}
    	}

    	function handleDelete() {
    		if (confirm(`Are you sure you want to delete "${service.name}"?`)) {
    			dispatch('deleteService', service.id);
    		}
    	}

    	$$self.$$.on_mount.push(function () {
    		if (service === undefined && !('service' in $$props || $$self.$$.bound[$$self.$$.props['service']])) {
    			console.warn("<ServiceItem> was created without expected prop 'service'");
    		}
    	});

    	const writable_props = ['service'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ServiceItem> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		editName = this.value;
    		$$invalidate(2, editName);
    	}

    	function textarea_input_handler() {
    		editDescription = this.value;
    		$$invalidate(3, editDescription);
    	}

    	function input1_input_handler() {
    		editPrice = to_number(this.value);
    		$$invalidate(4, editPrice);
    	}

    	$$self.$$set = $$props => {
    		if ('service' in $$props) $$invalidate(0, service = $$props.service);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		service,
    		isEditing,
    		editName,
    		editDescription,
    		editPrice,
    		dispatch,
    		toggleEdit,
    		handleUpdate,
    		handleDelete
    	});

    	$$self.$inject_state = $$props => {
    		if ('service' in $$props) $$invalidate(0, service = $$props.service);
    		if ('isEditing' in $$props) $$invalidate(1, isEditing = $$props.isEditing);
    		if ('editName' in $$props) $$invalidate(2, editName = $$props.editName);
    		if ('editDescription' in $$props) $$invalidate(3, editDescription = $$props.editDescription);
    		if ('editPrice' in $$props) $$invalidate(4, editPrice = $$props.editPrice);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		service,
    		isEditing,
    		editName,
    		editDescription,
    		editPrice,
    		toggleEdit,
    		handleUpdate,
    		handleDelete,
    		input0_input_handler,
    		textarea_input_handler,
    		input1_input_handler
    	];
    }

    class ServiceItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { service: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ServiceItem",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get service() {
    		throw new Error("<ServiceItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set service(value) {
    		throw new Error("<ServiceItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\ServiceList.svelte generated by Svelte v3.59.2 */

    const { console: console_1$1 } = globals;
    const file$1 = "src\\components\\ServiceList.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (32:4) {:else}
    function create_else_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "No services available. Please add a new service.";
    			add_location(p, file$1, 32, 8, 973);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(32:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (22:4) {#if services.length > 0}
    function create_if_block(ctx) {
    	let ul;
    	let current;
    	let each_value = /*services*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "svelte-14ovctj");
    			add_location(ul, file$1, 22, 8, 678);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(ul, null);
    				}
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*services, handleUpdate, handleDelete*/ 7) {
    				each_value = /*services*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ul, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(22:4) {#if services.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (24:12) {#each services as service}
    function create_each_block(ctx) {
    	let serviceitem;
    	let current;

    	serviceitem = new ServiceItem({
    			props: { service: /*service*/ ctx[4] },
    			$$inline: true
    		});

    	serviceitem.$on("updateService", /*handleUpdate*/ ctx[1]);
    	serviceitem.$on("deleteService", /*handleDelete*/ ctx[2]);

    	const block = {
    		c: function create() {
    			create_component(serviceitem.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(serviceitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const serviceitem_changes = {};
    			if (dirty & /*services*/ 1) serviceitem_changes.service = /*service*/ ctx[4];
    			serviceitem.$set(serviceitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(serviceitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(serviceitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(serviceitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(24:12) {#each services as service}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*services*/ ctx[0].length > 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			add_location(div, file$1, 20, 0, 632);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ServiceList', slots, []);
    	let { services = [] } = $$props;
    	const dispatch = createEventDispatcher();

    	function handleUpdate(event) {
    		const updatedService = event.detail;
    		dispatch('updateService', updatedService);
    		console.log('ServiceList received updateService event:', updatedService);
    	}

    	function handleDelete(event) {
    		const id = event.detail;
    		dispatch('deleteService', id);
    		console.log('ServiceList received deleteService event for ID:', id);
    	}

    	const writable_props = ['services'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<ServiceList> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('services' in $$props) $$invalidate(0, services = $$props.services);
    	};

    	$$self.$capture_state = () => ({
    		ServiceItem,
    		services,
    		createEventDispatcher,
    		dispatch,
    		handleUpdate,
    		handleDelete
    	});

    	$$self.$inject_state = $$props => {
    		if ('services' in $$props) $$invalidate(0, services = $$props.services);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [services, handleUpdate, handleDelete];
    }

    class ServiceList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { services: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ServiceList",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get services() {
    		throw new Error("<ServiceList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set services(value) {
    		throw new Error("<ServiceList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let serviceform;
    	let t2;
    	let servicelist;
    	let current;
    	serviceform = new ServiceForm({ $$inline: true });
    	serviceform.$on("addService", /*addService*/ ctx[1]);

    	servicelist = new ServiceList({
    			props: { services: /*services*/ ctx[0] },
    			$$inline: true
    		});

    	servicelist.$on("updateService", /*updateService*/ ctx[2]);
    	servicelist.$on("deleteService", /*deleteService*/ ctx[3]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Healthcare Services";
    			t1 = space();
    			create_component(serviceform.$$.fragment);
    			t2 = space();
    			create_component(servicelist.$$.fragment);
    			attr_dev(h1, "class", "svelte-1054i2g");
    			add_location(h1, file, 46, 4, 1411);
    			attr_dev(main, "class", "svelte-1054i2g");
    			add_location(main, file, 45, 0, 1400);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			mount_component(serviceform, main, null);
    			append_dev(main, t2);
    			mount_component(servicelist, main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const servicelist_changes = {};
    			if (dirty & /*services*/ 1) servicelist_changes.services = /*services*/ ctx[0];
    			servicelist.$set(servicelist_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(serviceform.$$.fragment, local);
    			transition_in(servicelist.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(serviceform.$$.fragment, local);
    			transition_out(servicelist.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(serviceform);
    			destroy_component(servicelist);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	let services = [
    		{
    			id: 1,
    			name: 'General Consultation',
    			description: 'A standard consultation with our healthcare professionals.',
    			price: 50
    		},
    		{
    			id: 2,
    			name: 'Dental Cleaning',
    			description: 'Professional teeth cleaning services.',
    			price: 80
    		}
    	];

    	// Function to add a new service
    	function addService(event) {
    		const newService = event.detail;

    		newService.id = services.length
    		? services[services.length - 1].id + 1
    		: 1;

    		$$invalidate(0, services = [...services, newService]);
    		console.log('Added Service:', newService);
    	}

    	// Function to update an existing service
    	function updateService(event) {
    		const updatedService = event.detail;

    		$$invalidate(0, services = services.map(service => service.id === updatedService.id
    		? updatedService
    		: service));

    		console.log('Updated Service:', updatedService);
    	}

    	// Function to delete a service
    	function deleteService(event) {
    		const id = event.detail;
    		$$invalidate(0, services = services.filter(service => service.id !== id));
    		console.log('Deleted Service ID:', id);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		ServiceForm,
    		ServiceList,
    		services,
    		addService,
    		updateService,
    		deleteService
    	});

    	$$self.$inject_state = $$props => {
    		if ('services' in $$props) $$invalidate(0, services = $$props.services);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [services, addService, updateService, deleteService];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
