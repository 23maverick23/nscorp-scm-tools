// ==UserScript==
// @name         SC Assistant Toolbar
// @namespace    nscorp-scm-tools
// @version      0.1.0
// @description  Lightweight main-form assignment toolbar for NetSuite SC Request forms.
// @icon         https://www.google.com/s2/favicons?domain=netsuite.com
// @tag          productivity
// @tag          work
// @author       Ryan Morrissey (https://github.com/23maverick23)
// @match        https://nlcorp-sb2.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&e=T*
// @match        https://nlcorp-sb2.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&custparam_record_id=*
// @match        https://nlcorp.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&e=T*
// @match        https://nlcorp.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&custparam_record_id=*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://github.com/23maverick23/nscorp-scm-tools/raw/refs/heads/sc-assistant-toolbar/sc_assistant_toolbar.user.js
// @updateURL    https://github.com/23maverick23/nscorp-scm-tools/raw/refs/heads/sc-assistant-toolbar/sc_assistant_toolbar.user.js
// @supportURL   https://github.com/23maverick23/nscorp-scm-tools/issues
// ==/UserScript==

/* globals GM_info, GM_addStyle, GM_getValue, GM_setValue, GM_registerMenuCommand */
/* globals nlapiSearchRecord, nlobjSearchFilter, nlobjSearchColumn */
/* globals nlapiGetFieldValue, nlapiSetFieldValue */

(function () {
	"use strict";

	const SCRIPT_NAME = typeof GM_info !== "undefined" && GM_info.script ? GM_info.script.name : "SC Request Push Panel";
	const LOG_PREFIX = `${SCRIPT_NAME} >>`;
	const CACHE_KEY = "sc_assistant_toolbar_people_cache_v1";
	const CACHE_TS_KEY = "sc_assistant_toolbar_people_cache_ts_v1";
	const CACHE_IDS_KEY = "sc_assistant_toolbar_people_cache_ids_v1";
	const EMPLOYEE_IDS_KEY = "sc_assistant_toolbar_employee_ids_v1";
	const INITIALS_KEY = "sc_assistant_toolbar_initials_v1";
	const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
	const DEFAULT_EMPLOYEE_IDS = [];

	const FIELDS = {
		requestStatus: "custrecord_screq_status",
		assignee: "custrecord_screq_assignee",
		lead: "custrecord_screq_assigned_lead",
		dateNeeded: "custrecord_screq_date_sc_needed",
		details: "custrecord_screq_details",
		managerNotes: "custrecord_screq_scmanager_notes",
		deliverable: "custrecord_screq_engmnt_deliverable",
		complexFlag: "custrecord_sc_complex_flag",
	};

	const STATUS = {
		staffed: 2,
	};

	const ICONS = {
		plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
		settings:
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.37.4.69.6 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-.5 1Z"/></svg>',
		chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
		x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
	};

	let panelSlot = null;
	let assignPanel = null;
	let settingsPanel = null;
	let activePanel = null;
	let assignHydrationRun = 0;
	let settingsHydrationRun = 0;
	let peoplePromise = null;
	const ui = {};

	function log(...args) {
		console.log(LOG_PREFIX, ...args);
	}

	function warn(...args) {
		console.warn(LOG_PREFIX, ...args);
	}

	function addStyles(css) {
		if (typeof GM_addStyle === "function") {
			GM_addStyle(css);
		} else {
			document.head.appendChild(h("style", { text: css }));
		}
	}

	function getStoredValue(key, fallback) {
		try {
			return typeof GM_getValue === "function" ? GM_getValue(key, fallback) : fallback;
		} catch (error) {
			warn(`Could not read Tampermonkey value ${key}`, error);
			return fallback;
		}
	}

	function setStoredValue(key, value) {
		try {
			if (typeof GM_setValue === "function") {
				GM_setValue(key, value);
			}
		} catch (error) {
			warn(`Could not write Tampermonkey value ${key}`, error);
		}
	}

	function registerMenu(label, callback) {
		if (typeof GM_registerMenuCommand === "function") {
			GM_registerMenuCommand(label, callback);
		}
	}

	function h(tagName, attributes = {}, children = []) {
		const node = document.createElement(tagName);
		Object.entries(attributes).forEach(([key, value]) => {
			if (value === null || value === undefined || value === false) {
				return;
			}
			if (key === "class") {
				node.className = value;
			} else if (key === "text") {
				node.textContent = value;
			} else if (key === "html") {
				node.innerHTML = value;
			} else if (key.startsWith("on") && typeof value === "function") {
				node.addEventListener(key.slice(2).toLowerCase(), value);
			} else if (value === true) {
				node.setAttribute(key, "");
			} else {
				node.setAttribute(key, value);
			}
		});
		[].concat(children).forEach((child) => {
			if (child === null || child === undefined || child === false) {
				return;
			}
			node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
		});
		return node;
	}

	function icon(name) {
		return h("span", { class: "scpa-icon", html: ICONS[name] || "" });
	}

	function afterPaint() {
		return new Promise((resolve) => requestAnimationFrame(() => resolve()));
	}

	function deferPanelWork(callback) {
		requestAnimationFrame(() => {
			setTimeout(callback, 0);
		});
	}

	function whenReady(callback) {
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => setTimeout(callback, 0), { once: true });
		} else {
			setTimeout(callback, 0);
		}
	}

	function makeColumn(name, join, summary) {
		return new nlobjSearchColumn(name, join || null, summary || null);
	}

	function nsSearch(recordType, filters, columns) {
		if (typeof nlapiSearchRecord !== "function") {
			throw new Error("NetSuite nlapiSearchRecord is not available on this page.");
		}
		return nlapiSearchRecord(recordType, null, filters, columns) || [];
	}

	function nsGet(fieldId, fallback = "") {
		try {
			const value = nlapiGetFieldValue(fieldId);
			return value === null || value === undefined ? fallback : value;
		} catch (error) {
			warn(`Could not read field ${fieldId}`, error);
			return fallback;
		}
	}

	function nsSet(fieldId, value) {
		try {
			nlapiSetFieldValue(fieldId, value, true);
		} catch (error) {
			throw new Error(`Could not set ${fieldId}: ${error.message || error}`);
		}
	}

	function getInitials() {
		return getStoredValue(INITIALS_KEY, "[SC Mgr]");
	}

	function getEmployeeIdsText() {
		const stored = getStoredValue(EMPLOYEE_IDS_KEY, DEFAULT_EMPLOYEE_IDS.join(", "));
		return Array.isArray(stored) ? stored.join(", ") : String(stored || "");
	}

	function getConfiguredEmployeeIds() {
		return parseEmployeeIds(getEmployeeIdsText());
	}

	function parseEmployeeIds(value) {
		return uniqueValues(
			String(value || "")
				.split(/[\s,;]+/)
				.map((item) => item.trim())
				.filter(Boolean),
		);
	}

	function uniqueValues(values) {
		return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && String(value) !== "")));
	}

	function todayDisplay() {
		const date = new Date();
		return [String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0"), date.getFullYear()].join("/");
	}

	function inputDateToNetSuite(inputValue) {
		if (!inputValue) {
			return "";
		}
		const [year, month, day] = inputValue.split("-").map((part) => parseInt(part, 10));
		if (!year || !month || !day) {
			return "";
		}
		return `${month}/${day}/${year}`;
	}

	function netSuiteDateToInput(value) {
		const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
		if (!match) {
			return "";
		}
		const [, month, day, year] = match;
		return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	}

	function extractShortLocation(location) {
		const match = String(location || "").match(/(^\w+-\w+)/);
		return match ? match[1] : "";
	}

	function normalizeEmployeeName(name) {
		const parts = String(name || "").split(",").map((part) => part.trim());
		return parts.length === 2 && parts[0] && parts[1] ? `${parts[1]} ${parts[0]}` : String(name || "").trim();
	}

	function clearPeopleCache() {
		peoplePromise = null;
		setStoredValue(CACHE_KEY, []);
		setStoredValue(CACHE_TS_KEY, 0);
		setStoredValue(CACHE_IDS_KEY, "");
	}

	function getCacheMetadata() {
		const cached = getStoredValue(CACHE_KEY, null);
		const cachedAt = Number(getStoredValue(CACHE_TS_KEY, 0));
		const cachedIds = String(getStoredValue(CACHE_IDS_KEY, ""));
		const currentIds = getConfiguredEmployeeIds().join(",");
		const count = Array.isArray(cached) ? cached.length : 0;
		const ageMs = cachedAt ? Date.now() - cachedAt : null;
		return {
			count,
			cachedAt,
			ageMs,
			expired: Boolean(cachedAt && ageMs > DEFAULT_CACHE_TTL_MS),
			idsChanged: cachedIds !== currentIds,
			configuredIds: currentIds ? currentIds.split(",").length : 0,
		};
	}

	function formatCacheDate(timestamp) {
		return timestamp ? new Date(timestamp).toLocaleString() : "Never";
	}

	function formatCacheAge(ageMs) {
		if (ageMs === null || ageMs === undefined) {
			return "Not cached";
		}
		if (ageMs < 60 * 1000) {
			return "Less than 1 minute old";
		}
		const minutes = Math.round(ageMs / (60 * 1000));
		if (minutes < 60) {
			return `${minutes} minute${minutes === 1 ? "" : "s"} old`;
		}
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return remainingMinutes ? `${hours}h ${remainingMinutes}m old` : `${hours} hour${hours === 1 ? "" : "s"} old`;
	}

	async function loadPeople(forceRefresh = false) {
		if (peoplePromise && !forceRefresh) {
			return peoplePromise;
		}
		peoplePromise = (async () => {
			const employeeIds = getConfiguredEmployeeIds();
			if (!employeeIds.length) {
				return [];
			}

			const idsKey = employeeIds.join(",");
			const cached = getStoredValue(CACHE_KEY, null);
			const cachedAt = Number(getStoredValue(CACHE_TS_KEY, 0));
			const cachedIds = String(getStoredValue(CACHE_IDS_KEY, ""));
			if (!forceRefresh && Array.isArray(cached) && cachedAt && cachedIds === idsKey && Date.now() - cachedAt < DEFAULT_CACHE_TTL_MS) {
				return cached;
			}

			await afterPaint();
			const people = fetchConfiguredRosterPeople(employeeIds);
			setStoredValue(CACHE_KEY, people);
			setStoredValue(CACHE_TS_KEY, Date.now());
			setStoredValue(CACHE_IDS_KEY, idsKey);
			return people;
		})();
		return peoplePromise;
	}

	function fetchConfiguredRosterPeople(employeeIds) {
		const filters = [
			new nlobjSearchFilter("custrecord_emproster_emp", null, "anyof", employeeIds),
			new nlobjSearchFilter("custrecord_emproster_rosterstatus", null, "is", 1),
			new nlobjSearchFilter("custrecord_emproster_eminactive", null, "is", "F"),
			new nlobjSearchFilter("custrecord_emproster_sales_qb", null, "is", 25),
			new nlobjSearchFilter("custrecord_emproster_rdept", null, "is", 482),
		];
		const columns = [
			makeColumn("internalid"),
			makeColumn("custrecord_emproster_emp"),
			makeColumn("custrecord_emproster_firstname"),
			makeColumn("custrecord_emproster_lastname"),
			makeColumn("custrecord_emproster_olocation"),
		];
		return nsSearch("customrecord_emproster", filters, columns)
			.map((result) => {
				const employeeRecordId = String(result.getValue("custrecord_emproster_emp") || "");
				const first = result.getValue("custrecord_emproster_firstname") || "";
				const last = result.getValue("custrecord_emproster_lastname") || "";
				const employeeText = result.getText("custrecord_emproster_emp") || "";
				const name = [first, last].filter(Boolean).join(" ").trim() || normalizeEmployeeName(employeeText);
				const location = extractShortLocation(result.getText("custrecord_emproster_olocation") || "");
				return {
					value: String(result.getValue("internalid") || result.getId() || ""),
					employeeRecordId,
					label: location ? `${name} (${location})` : name,
					name,
					location,
				};
			})
			.filter((person) => person.value && person.label)
			.sort((a, b) => a.label.localeCompare(b.label));
	}

	function createFieldShell({ label, required = false, className = "" }) {
		const root = h("div", { class: `scpa-field ${className}`.trim() });
		const labelNode = h("label", { class: "scpa-label" }, [
			label,
			required ? h("span", { class: "scpa-required", text: "*" }) : null,
		]);
		root.appendChild(labelNode);
		return { root, labelNode };
	}

	function createTextInput({ label, required = false, placeholder = "", type = "text" }) {
		const field = createFieldShell({ label, required });
		const input = h("input", { class: "scpa-input", type, placeholder });
		field.root.appendChild(input);
		return {
			root: field.root,
			input,
			getValue: () => input.value.trim(),
			setValue: (value) => {
				input.value = value || "";
			},
		};
	}

	function createTextarea({ label, required = false, placeholder = "", minHeight = 80 }) {
		const field = createFieldShell({ label, required });
		const textarea = h("textarea", {
			class: "scpa-textarea",
			placeholder,
			style: `min-height:${minHeight}px`,
		});
		field.root.appendChild(textarea);
		return {
			root: field.root,
			textarea,
			getValue: () => textarea.value,
			setValue: (value) => {
				textarea.value = value || "";
			},
		};
	}

	function createToggle({ label, checked = false }) {
		const root = h("label", { class: "scpa-toggle-row" });
		const input = h("input", { type: "checkbox", class: "scpa-toggle-input" });
		input.checked = checked;
		const visual = h("span", { class: "scpa-toggle" }, [h("span", { class: "scpa-toggle-knob" })]);
		const text = h("span", { class: "scpa-toggle-text", text: label });
		root.append(input, visual, text);
		return {
			root,
			input,
			getValue: () => input.checked,
			setValue: (value) => {
				input.checked = Boolean(value);
			},
		};
	}

	function createComboBox({ label, required = false, placeholder = "", options = [], onSelect = null }) {
		const field = createFieldShell({ label, required });
		const wrapper = h("div", { class: "scpa-combo" });
		const input = h("input", { class: "scpa-input scpa-combo-input", type: "text", placeholder, autocomplete: "off" });
		const hidden = h("input", { type: "hidden" });
		const button = h("button", { class: "scpa-combo-button", type: "button", "aria-label": `Open ${label}` }, [icon("chevron")]);
		const menu = h("div", { class: "scpa-menu", hidden: true });
		let currentOptions = options.slice();
		let selected = null;

		wrapper.append(input, hidden, button, menu);
		field.root.appendChild(wrapper);

		function open() {
			menu.hidden = false;
			render(input.value);
		}

		function close() {
			menu.hidden = true;
		}

		function render(query = "") {
			const needle = query.trim().toLowerCase();
			menu.replaceChildren();
			const matches = currentOptions
				.filter((option) => !needle || option.label.toLowerCase().includes(needle) || String(option.employeeRecordId || "").includes(needle))
				.slice(0, 80);

			if (!matches.length) {
				menu.appendChild(h("div", { class: "scpa-menu-empty", text: currentOptions.length ? "No matches" : "No employees configured" }));
				return;
			}

			matches.forEach((option) => {
				const item = h("button", { class: "scpa-menu-item", type: "button" }, [
					h("span", { class: "scpa-menu-label", text: option.label }),
				]);
				item.addEventListener("mousedown", (event) => {
					event.preventDefault();
					selectOption(option);
				});
				menu.appendChild(item);
			});
		}

		function selectOption(option, silent = false) {
			selected = option;
			hidden.value = option.value;
			input.value = option.label;
			input.setAttribute("data-selected-label", option.label);
			input.dataset.employeeRecordId = option.employeeRecordId || "";
			close();
			if (onSelect && !silent) {
				onSelect(option);
			}
		}

		input.addEventListener("focus", open);
		input.addEventListener("input", () => {
			hidden.value = "";
			selected = null;
			input.removeAttribute("data-selected-label");
			delete input.dataset.employeeRecordId;
			open();
		});
		input.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				close();
			}
			if (event.key === "Enter") {
				const first = menu.querySelector(".scpa-menu-item");
				if (first) {
					event.preventDefault();
					first.dispatchEvent(new MouseEvent("mousedown"));
				}
			}
		});
		button.addEventListener("click", () => {
			if (menu.hidden) {
				open();
				input.focus();
			} else {
				close();
			}
		});
		document.addEventListener("mousedown", (event) => {
			if (!wrapper.contains(event.target)) {
				close();
			}
		});

		return {
			root: field.root,
			input,
			hidden,
			getValue: () => hidden.value,
			getLabel: () => selected ? selected.label : input.value.trim(),
			selectOption,
			setLoading(message) {
				input.placeholder = message;
				currentOptions = [];
				hidden.value = "";
				selected = null;
				render("");
			},
			setOptions(nextOptions) {
				const previousValue = hidden.value;
				currentOptions = nextOptions.slice();
				if (previousValue) {
					const match = currentOptions.find((option) => option.value === previousValue);
					if (match) {
						selectOption(match, true);
						return;
					}
				}
				render(input.value);
			},
			setValue(value) {
				const match = currentOptions.find((option) => option.value === String(value));
				if (match) {
					selectOption(match, true);
				} else {
					hidden.value = value || "";
					selected = null;
					input.value = "";
					input.removeAttribute("data-selected-label");
					delete input.dataset.employeeRecordId;
				}
			},
		};
	}

	function buildToolbar() {
		if (document.getElementById("scpa-toolbar")) {
			return;
		}

		const toolbar = h("div", { id: "scpa-toolbar", class: "scpa-toolbar" }, [
			h("div", { class: "scpa-toolbar-brand" }, [
				h("span", { text: "SC Assistant Toolbar" }),
			]),
			h("div", { class: "scpa-toolbar-spacer" }),
			h("button", { class: "scpa-toolbar-btn scpa-btn-ghost", type: "button", id: "scpa-open-settings", title: "Settings" }, [
				icon("settings"),
				"Settings",
			]),
			h("button", { class: "scpa-toolbar-btn scpa-btn-primary", type: "button", id: "scpa-open-assign" }, [
				icon("plus"),
				"Quick assign SC",
			]),
		]);

		const target =
			document.querySelector(".uir-page-title-record") ||
			document.querySelector(".uir-page-title") ||
			document.querySelector(".uir-page-title-secondline");

		if (target && target.parentNode) {
			target.insertAdjacentElement("afterend", toolbar);
		} else {
			document.body.prepend(toolbar);
		}

		toolbar.querySelector("#scpa-open-assign").addEventListener("click", () => togglePanel("assign"));
		toolbar.querySelector("#scpa-open-settings").addEventListener("click", () => togglePanel("settings"));
	}

	function ensurePanelHost() {
		if (panelSlot) {
			return panelSlot;
		}

		panelSlot = h("div", { id: "scpa-panel-slot", class: "scpa-panel-slot scpa-floating" });
		document.body.appendChild(panelSlot);

		assignPanel = buildAssignPanel();
		settingsPanel = buildSettingsPanel();
		panelSlot.append(assignPanel, settingsPanel);
		return panelSlot;
	}

	function panelHeader(title) {
		return h("div", { class: "scpa-panel-header" }, [
			h("span", { class: "scpa-panel-title", text: title }),
			h("button", { class: "scpa-close", type: "button", "aria-label": "Close panel", onclick: closePanels }, [icon("x")]),
		]);
	}

	function panelStatus() {
		return h("div", { class: "scpa-status", "aria-live": "polite", hidden: true });
	}

	function panelLoading() {
		return h("div", { class: "scpa-loading", "aria-live": "polite", "data-scpa-loading": true, hidden: true }, [
			h("span", { class: "scpa-spinner", "aria-hidden": "true" }),
			h("span", { class: "scpa-loading-text", text: "Loading..." }),
		]);
	}

	function setPanelStatus(panel, message, type = "info") {
		const node = panel ? panel.querySelector(".scpa-status") : null;
		if (!node) {
			return;
		}
		node.hidden = !message;
		node.textContent = message || "";
		node.className = `scpa-status scpa-status-${type}`;
	}

	function setPanelLoading(panel, isLoading, message = "Loading...") {
		const node = panel ? panel.querySelector("[data-scpa-loading]") : null;
		if (!node) {
			return;
		}
		node.hidden = !isLoading;
		node.querySelector(".scpa-loading-text").textContent = message;
		panel.classList.toggle("scpa-is-loading", isLoading);
	}

	function buildAssignPanel() {
		const panel = h("aside", {
			class: "scpa-panel scpa-blue-panel",
			"aria-label": "SC Quick Assign",
			hidden: true,
		});

		ui.assignee = createComboBox({
			label: "Assign To (Employee)",
			required: true,
			placeholder: "Choose an SC",
			onSelect: (option) => {
				defaultSelectedAssigneeLead();
				setGeneratedAddendum(option.name || option.label);
			},
		});
		ui.lead = createToggle({ label: "Lead SC", checked: true });
		ui.dateNeeded = createTextInput({ label: "Date SC Needed", required: true, type: "date" });
		ui.detailsAdd = createTextarea({
			label: "SC Request Details Addendum",
			placeholder: "Text to prepend to the beginning of the SC Request Details on Save...",
			minHeight: 96,
		});
		ui.detailsAdd.textarea.addEventListener("input", () => {
			ui.detailsAdd.textarea.dataset.generated = "0";
		});

		const body = h("div", { class: "scpa-panel-body" }, [
			panelLoading(),
			panelStatus(),
			ui.assignee.root,
			ui.lead.root,
			ui.dateNeeded.root,
			ui.detailsAdd.root,
		]);

		const footer = h("div", { class: "scpa-panel-footer" }, [
			h("button", { class: "scpa-panel-btn scpa-secondary", type: "button", onclick: closePanels }, ["Cancel"]),
			h("button", { class: "scpa-panel-btn scpa-primary-blue", type: "button", onclick: saveQuickAssign }, ["Apply"]),
		]);

		panel.append(panelHeader("SC Quick Assign"), body, footer);
		return panel;
	}

	function buildSettingsPanel() {
		const panel = h("aside", {
			class: "scpa-panel scpa-settings-panel",
			"aria-label": "SC Assistant Toolbar Settings",
			hidden: true,
		});

		ui.settingsInitials = createTextInput({
			label: "Comment Signature",
			placeholder: "[SC Mgr]",
		});
		ui.settingsEmployeeIds = createTextarea({
			label: "Assignee Employee IDs",
			placeholder: "12345, 67890, 24680",
			minHeight: 124,
		});
		ui.settingsCacheSummary = h("div", { class: "scpa-cache-summary" });

		const body = h("div", { class: "scpa-panel-body" }, [
			panelLoading(),
			panelStatus(),
			h("div", { class: "scpa-section-label", text: "Defaults" }),
			ui.settingsInitials.root,
			ui.settingsEmployeeIds.root,
			h("div", { class: "scpa-divider" }),
			h("div", { class: "scpa-section-label", text: "Roster Cache" }),
			ui.settingsCacheSummary,
			h("div", { class: "scpa-settings-actions" }, [
				h("button", { class: "scpa-panel-btn scpa-secondary scpa-action-btn", type: "button", onclick: refreshSettingsCache }, [
					"Refresh roster",
				]),
				h("button", { class: "scpa-panel-btn scpa-secondary scpa-action-btn scpa-danger-outline", type: "button", onclick: clearSettingsCache }, [
					"Clear cache",
				]),
			]),
		]);

		const footer = h("div", { class: "scpa-panel-footer" }, [
			h("button", { class: "scpa-panel-btn scpa-secondary", type: "button", onclick: closePanels }, ["Close"]),
			h("button", { class: "scpa-panel-btn scpa-primary-blue", type: "button", onclick: saveSettings }, ["Save settings"]),
		]);

		panel.append(panelHeader("Settings"), body, footer);
		return panel;
	}

	function togglePanel(name) {
		if (activePanel === name) {
			closePanels();
			return;
		}
		openPanel(name);
	}

	function openPanel(name) {
		ensurePanelHost();
		activePanel = name;
		document.body.classList.add("scpa-panel-open");
		panelSlot.classList.add("scpa-open");
		assignPanel.hidden = name !== "assign";
		settingsPanel.hidden = name !== "settings";

		if (name === "assign") {
			const runId = ++assignHydrationRun;
			setPanelStatus(assignPanel, "");
			setPanelLoading(assignPanel, true, "Loading configured assignees...");
			ui.assignee.setLoading("Loading configured assignees...");
			deferPanelWork(() => {
				if (activePanel === "assign" && runId === assignHydrationRun) {
					hydrateAssignPanel(runId);
				}
			});
		}
		if (name === "settings") {
			const runId = ++settingsHydrationRun;
			setPanelStatus(settingsPanel, "");
			setPanelLoading(settingsPanel, true, "Loading settings...");
			deferPanelWork(() => {
				if (activePanel === "settings" && runId === settingsHydrationRun) {
					hydrateSettingsPanel(runId);
				}
			});
		}
	}

	function closePanels() {
		if (!panelSlot) {
			return;
		}
		activePanel = null;
		assignHydrationRun += 1;
		settingsHydrationRun += 1;
		document.body.classList.remove("scpa-panel-open");
		panelSlot.classList.remove("scpa-open");
		if (assignPanel) {
			assignPanel.hidden = true;
		}
		if (settingsPanel) {
			settingsPanel.hidden = true;
		}
	}

	function hydrateAssignPanel(runId) {
		setPanelStatus(assignPanel, "");
		ui.dateNeeded.setValue(netSuiteDateToInput(nsGet(FIELDS.dateNeeded)));
		ui.lead.setValue(nsGet(FIELDS.lead, "T") !== "F");
		ui.assignee.setLoading("Loading configured assignees...");

		loadPeople()
			.then((people) => {
				if (activePanel !== "assign" || runId !== assignHydrationRun) {
					return;
				}
				ui.assignee.setOptions(people);
				const currentAssignee = nsGet(FIELDS.assignee);
				if (currentAssignee) {
					ui.assignee.setValue(currentAssignee);
				}
				ui.assignee.input.placeholder = people.length ? "Choose an SC" : "Add employee IDs in Settings";
				setPanelLoading(assignPanel, false);
				if (!getConfiguredEmployeeIds().length) {
					setPanelStatus(assignPanel, "Add employee IDs in Settings to populate the assignee dropdown.", "info");
				} else if (!people.length) {
					setPanelStatus(assignPanel, "No active SC roster records found for the configured employee IDs.", "error");
				}
			})
			.catch((error) => {
				if (activePanel !== "assign" || runId !== assignHydrationRun) {
					return;
				}
				ui.assignee.input.placeholder = "Could not load configured assignees";
				setPanelLoading(assignPanel, false);
				setPanelStatus(assignPanel, error.message || String(error), "error");
			});
	}

	function hydrateSettingsPanel(runId) {
		if (activePanel !== "settings" || runId !== settingsHydrationRun) {
			return;
		}
		ui.settingsInitials.setValue(getInitials());
		ui.settingsEmployeeIds.setValue(getEmployeeIdsText());
		updateSettingsCacheSummary();
		setPanelLoading(settingsPanel, false);
	}

	function updateSettingsCacheSummary() {
		if (!ui.settingsCacheSummary) {
			return;
		}
		const metadata = getCacheMetadata();
		const status = !metadata.count ? "Empty" : metadata.expired || metadata.idsChanged ? "Stale" : "Ready";
		const statusClass = !metadata.count ? "empty" : metadata.expired || metadata.idsChanged ? "expired" : "ready";
		ui.settingsCacheSummary.replaceChildren(
			h("div", { class: "scpa-cache-heading" }, [
				h("span", { class: `scpa-cache-pill scpa-cache-${statusClass}`, text: status }),
				h("span", { class: "scpa-cache-count", text: `${metadata.count} cached assignee${metadata.count === 1 ? "" : "s"}` }),
			]),
			h("div", { class: "scpa-cache-detail" }, [
				h("span", { text: "Configured IDs" }),
				h("strong", { text: String(metadata.configuredIds) }),
			]),
			h("div", { class: "scpa-cache-detail" }, [
				h("span", { text: "Last refreshed" }),
				h("strong", { text: formatCacheDate(metadata.cachedAt) }),
			]),
			h("div", { class: "scpa-cache-detail" }, [
				h("span", { text: "Age" }),
				h("strong", { text: formatCacheAge(metadata.ageMs) }),
			]),
		);
	}

	function saveSettings() {
		const initials = ui.settingsInitials.getValue() || "[SC Mgr]";
		const employeeIdsText = parseEmployeeIds(ui.settingsEmployeeIds.getValue()).join(", ");

		setStoredValue(INITIALS_KEY, initials);
		setStoredValue(EMPLOYEE_IDS_KEY, employeeIdsText);
		clearPeopleCache();
		ui.settingsEmployeeIds.setValue(employeeIdsText);

		updateSettingsCacheSummary();
		setPanelStatus(settingsPanel, "Settings saved. Roster cache was cleared.", "success");
	}

	async function refreshSettingsCache() {
		setPanelStatus(settingsPanel, "");
		setPanelLoading(settingsPanel, true, "Refreshing configured roster...");
		try {
			const people = await loadPeople(true);
			updateSettingsCacheSummary();
			setPanelStatus(settingsPanel, `Roster refreshed with ${people.length} assignee${people.length === 1 ? "" : "s"}.`, "success");
		} catch (error) {
			setPanelStatus(settingsPanel, error.message || String(error), "error");
		} finally {
			setPanelLoading(settingsPanel, false);
		}
	}

	function clearSettingsCache() {
		clearPeopleCache();
		updateSettingsCacheSummary();
		setPanelStatus(settingsPanel, "Roster cache cleared.", "info");
	}

	function defaultSelectedAssigneeLead() {
		if (ui.lead) {
			ui.lead.setValue(true);
		}
	}

	function setGeneratedAddendum(name) {
		if (!ui.detailsAdd || (ui.detailsAdd.getValue() && ui.detailsAdd.textarea.dataset.generated !== "1")) {
			return;
		}
		const cleanName = String(name || "").replace(/\s+\([^)]*\)$/, "");
		ui.detailsAdd.setValue(`${todayDisplay()} - Please work with ${cleanName} on next steps to KT ${getInitials()}\n\n`);
		ui.detailsAdd.textarea.dataset.generated = "1";
	}

	function validateQuickAssign(values) {
		const missing = [];
		if (!values.assigneeId) missing.push("Assign To");
		if (!values.dateNeeded) missing.push("Date SC Needed");
		return missing;
	}

	function saveQuickAssign() {
		const values = {
			assigneeId: ui.assignee.getValue(),
			assigneeName: ui.assignee.getLabel(),
			isLead: ui.lead.getValue(),
			dateNeeded: inputDateToNetSuite(ui.dateNeeded.getValue()),
			detailsAdd: ui.detailsAdd.getValue(),
		};
		const missing = validateQuickAssign(values);

		if (missing.length) {
			setPanelStatus(assignPanel, `Required: ${missing.join(", ")}`, "error");
			return;
		}

		try {
			nsSet(FIELDS.requestStatus, STATUS.staffed);
			nsSet(FIELDS.dateNeeded, values.dateNeeded);
			nsSet(FIELDS.assignee, values.assigneeId);
			nsSet(FIELDS.lead, values.isLead ? "T" : "F");
			nsSet(FIELDS.deliverable, 53);
			nsSet(FIELDS.complexFlag, 2);

			if (values.detailsAdd) {
				prependField(FIELDS.details, values.detailsAdd);
			}

			nsSet(FIELDS.managerNotes, buildManagerNotes(values));
			setPanelStatus(assignPanel, "Applied changes to the NetSuite form. Save the record when ready.", "success");
		} catch (error) {
			setPanelStatus(assignPanel, error.message || String(error), "error");
		}
	}

	function buildManagerNotes(values) {
		return `${todayDisplay()} - Staffed deal ${getInitials()}`;
	}

	function prependField(fieldId, text) {
		const current = nsGet(fieldId, "");
		nsSet(fieldId, `${text}${current}`);
	}

	function registerMenus() {
		registerMenu("SC Assistant Toolbar: open settings", () => openPanel("settings"));
		registerMenu("SC Assistant Toolbar: refresh configured roster", async () => {
			try {
				const people = await loadPeople(true);
				log(`Configured roster refreshed with ${people.length} people.`);
				if (activePanel === "assign") {
					ui.assignee.setOptions(people);
				} else if (activePanel === "settings") {
					updateSettingsCacheSummary();
				}
			} catch (error) {
				warn("Configured roster refresh failed", error);
			}
		});
	}

	function injectStyles() {
		addStyles(`
			#scpa-toolbar,
			#scpa-panel-slot,
			#scpa-panel-slot * {
				box-sizing: border-box;
			}

			#scpa-toolbar,
			#scpa-panel-slot {
				--scpa-ns-teal: #326478;
				--scpa-ns-teal-deep: #1d4050;
				--scpa-ns-coral: #e88070;
				--scpa-ns-redwood: #8a3d35;
				--scpa-ns-ink: #181818;
				--scpa-ns-muted: #66635f;
				--scpa-ns-border: #dedbd5;
				--scpa-ns-field: #f7f6f3;
				--scpa-ns-line: #ece9e3;
				--scpa-ns-surface-2: #f1f4f5;
				--scpa-panel-width: 420px;
			}

			body.scpa-panel-open {
				--scpa-panel-width: 420px;
			}

			#scpa-toolbar {
				display: flex;
				align-items: center;
				gap: 10px;
				min-height: 50px;
				margin: 8px 0 12px;
				padding: 6px 14px;
				background: #fff;
				border: 1px solid var(--scpa-ns-border);
				border-left: 4px solid var(--scpa-ns-teal);
				border-bottom: 3px solid var(--scpa-ns-coral);
				border-radius: 0;
				color: var(--scpa-ns-ink);
				font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				box-shadow: 0 1px 2px rgba(29, 64, 80, 0.08);
			}

			.scpa-toolbar-brand {
				display: flex;
				align-items: center;
				font-size: 14px;
				font-weight: 750;
				white-space: nowrap;
				color: var(--scpa-ns-teal-deep);
			}

			.scpa-toolbar-spacer {
				flex: 1;
				min-width: 8px;
			}

			.scpa-toolbar-btn,
			.scpa-panel-btn,
			.scpa-close,
			.scpa-combo-button,
			.scpa-menu-item {
				font: inherit;
			}

			.scpa-toolbar-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 7px;
				height: 36px;
				padding: 0 14px;
				border: 1px solid var(--scpa-ns-border);
				border-radius: 0;
				font-size: 13px;
				font-weight: 700;
				cursor: pointer;
				white-space: nowrap;
			}

			.scpa-btn-primary {
				background: var(--scpa-ns-teal);
				border-color: var(--scpa-ns-teal);
				color: #fff;
			}

			.scpa-btn-primary:hover {
				background: var(--scpa-ns-teal-deep);
				border-color: var(--scpa-ns-teal-deep);
			}

			.scpa-btn-ghost {
				background: var(--scpa-ns-field);
				color: var(--scpa-ns-teal-deep);
			}

			.scpa-btn-ghost:hover {
				background: var(--scpa-ns-surface-2);
				border-color: var(--scpa-ns-teal);
			}

			.scpa-icon {
				display: inline-flex;
				width: 15px;
				height: 15px;
				flex: 0 0 15px;
			}

			.scpa-icon svg {
				width: 100%;
				height: 100%;
				fill: none;
				stroke: currentColor;
				stroke-width: 2;
				stroke-linecap: round;
				stroke-linejoin: round;
			}

			#scpa-panel-slot {
				position: fixed;
				top: 0;
				right: 0;
				z-index: 900;
				width: 0;
				height: 100vh;
				overflow: hidden;
				background: #fff;
				border-left: 0 solid var(--scpa-ns-line);
				box-shadow: -16px 0 34px rgba(33, 63, 99, 0.16);
				transition:
					width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
					border-left-width 0.01s 0.15s;
			}

			#scpa-panel-slot.scpa-open {
				width: var(--scpa-panel-width);
				border-left-width: 1px;
				overflow: visible;
			}

			body.scpa-panel-open #pageContainer {
				margin-right: var(--scpa-panel-width);
				transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			}

			.scpa-panel {
				display: flex;
				flex-direction: column;
				width: var(--scpa-panel-width);
				height: 100vh;
				max-height: 100vh;
				background: #fff;
				color: var(--scpa-ns-ink);
				font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			}

			.scpa-panel[hidden] {
				display: none;
			}

			.scpa-panel-header {
				display: flex;
				align-items: center;
				min-height: 48px;
				padding: 0 16px;
				background: var(--scpa-ns-teal-deep);
				color: #fff;
				flex: 0 0 auto;
			}

			.scpa-panel-title {
				flex: 1;
				font-size: 13px;
				font-weight: 650;
			}

			.scpa-close {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				padding: 0;
				border: 0;
				border-radius: 0;
				background: transparent;
				color: rgba(255, 255, 255, 0.72);
				cursor: pointer;
			}

			.scpa-close:hover {
				background: rgba(255, 255, 255, 0.12);
				color: #fff;
			}

			.scpa-panel-body {
				display: flex;
				flex: 1 1 auto;
				flex-direction: column;
				gap: 12px;
				min-height: 0;
				overflow-y: auto;
				padding: 16px;
			}

			.scpa-panel-footer {
				position: sticky;
				bottom: 0;
				z-index: 35;
				display: flex;
				gap: 8px;
				padding: 12px 16px;
				border-top: 1px solid var(--scpa-ns-line);
				background: #fff;
				box-shadow: 0 -8px 18px rgba(33, 63, 99, 0.06);
				flex: 0 0 auto;
			}

			.scpa-field {
				display: flex;
				flex-direction: column;
				gap: 6px;
			}

			.scpa-label-row {
				display: flex;
				justify-content: space-between;
				gap: 8px;
			}

			.scpa-label {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				color: #536173;
				font-size: 10px;
				font-weight: 750;
				letter-spacing: 0.06em;
				text-transform: uppercase;
			}

			.scpa-required {
				color: var(--scpa-ns-redwood);
			}

			.scpa-input,
			.scpa-textarea {
				width: 100%;
				border: 1px solid var(--scpa-ns-border);
				border-radius: 0;
				background: var(--scpa-ns-field);
				color: var(--scpa-ns-ink);
				font-size: 13px;
			}

			.scpa-input {
				height: 32px;
				padding: 0 10px;
			}

			.scpa-textarea {
				padding: 9px 10px;
				resize: vertical;
				line-height: 1.42;
			}

			.scpa-input:focus,
			.scpa-textarea:focus {
				border-color: var(--scpa-ns-teal);
				background: #fff;
				outline: 2px solid rgba(50, 100, 120, 0.14);
			}

			.scpa-combo {
				position: relative;
			}

			.scpa-combo-input {
				padding-right: 34px;
			}

			.scpa-combo-button {
				position: absolute;
				top: 1px;
				right: 1px;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 30px;
				height: 30px;
				border: 0;
				border-left: 1px solid var(--scpa-ns-line);
				border-radius: 0;
				background: transparent;
				color: #687589;
				cursor: pointer;
			}

			.scpa-combo-button:hover {
				background: var(--scpa-ns-surface-2);
				color: var(--scpa-ns-teal-deep);
			}

			.scpa-menu {
				position: absolute;
				top: calc(100% + 4px);
				left: 0;
				right: 0;
				z-index: 20;
				max-height: 230px;
				overflow-y: auto;
				border: 1px solid var(--scpa-ns-border);
				border-radius: 0;
				background: #fff;
				box-shadow: 0 14px 32px rgba(33, 63, 99, 0.18);
			}

			.scpa-menu[hidden] {
				display: none;
			}

			.scpa-menu-item {
				display: flex;
				width: 100%;
				align-items: center;
				padding: 9px 10px;
				border: 0;
				background: #fff;
				color: var(--scpa-ns-ink);
				font-size: 13px;
				font-weight: 650;
				text-align: left;
				cursor: pointer;
			}

			.scpa-menu-item:hover {
				background: var(--scpa-ns-surface-2);
			}

			.scpa-menu-empty {
				padding: 9px 10px;
				color: var(--scpa-ns-muted);
				font-size: 12px;
			}

			.scpa-toggle-row {
				display: flex;
				align-items: center;
				gap: 9px;
				min-height: 28px;
				color: var(--scpa-ns-ink);
				font-size: 13px;
				cursor: pointer;
			}

			.scpa-toggle-input {
				position: absolute;
				opacity: 0;
				pointer-events: none;
			}

			.scpa-toggle {
				position: relative;
				width: 34px;
				height: 18px;
				border-radius: 999px;
				background: #9aa6b2;
				transition: background 0.16s ease;
			}

			.scpa-toggle-knob {
				position: absolute;
				top: 2px;
				left: 2px;
				width: 14px;
				height: 14px;
				border-radius: 50%;
				background: #fff;
				box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
				transition: transform 0.16s ease;
			}

			.scpa-toggle-input:checked + .scpa-toggle {
				background: var(--scpa-ns-teal);
			}

			.scpa-toggle-input:checked + .scpa-toggle .scpa-toggle-knob {
				transform: translateX(16px);
			}

			.scpa-toggle-text {
				font-weight: 650;
			}

			.scpa-divider {
				height: 1px;
				background: var(--scpa-ns-line);
				margin: 2px 0;
			}

			.scpa-section-label {
				margin-bottom: -4px;
				color: #7b8796;
				font-size: 10px;
				font-weight: 750;
				letter-spacing: 0.06em;
				text-transform: uppercase;
			}

			.scpa-panel-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 6px;
				min-width: 80px;
				height: 34px;
				padding: 0 16px;
				border-radius: 0;
				font-size: 13px;
				font-weight: 700;
				cursor: pointer;
			}

			.scpa-panel-btn:disabled {
				opacity: 0.55;
				cursor: not-allowed;
			}

			.scpa-secondary {
				border: 1px solid var(--scpa-ns-border);
				background: #fff;
				color: var(--scpa-ns-teal-deep);
			}

			.scpa-secondary:hover {
				background: var(--scpa-ns-surface-2);
			}

			.scpa-primary-blue {
				flex: 1;
				border: 0;
				background: var(--scpa-ns-teal);
				color: #fff;
			}

			.scpa-primary-blue:hover {
				background: var(--scpa-ns-teal-deep);
			}

			.scpa-danger-outline {
				border-color: #d9aca6;
				color: var(--scpa-ns-redwood);
			}

			.scpa-settings-actions {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 8px;
			}

			.scpa-action-btn {
				width: 100%;
			}

			.scpa-cache-summary {
				display: flex;
				flex-direction: column;
				gap: 8px;
				padding: 10px;
				border: 1px solid var(--scpa-ns-line);
				border-radius: 0;
				background: var(--scpa-ns-field);
			}

			.scpa-cache-heading,
			.scpa-cache-detail {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
				font-size: 12px;
			}

			.scpa-cache-detail {
				color: var(--scpa-ns-muted);
			}

			.scpa-cache-detail strong {
				color: var(--scpa-ns-ink);
				font-weight: 700;
				text-align: right;
			}

			.scpa-cache-pill {
				display: inline-flex;
				align-items: center;
				height: 20px;
				padding: 0 7px;
				border-radius: 0;
				font-size: 11px;
				font-weight: 750;
			}

			.scpa-cache-ready {
				background: #eaf4f7;
				color: var(--scpa-ns-teal-deep);
			}

			.scpa-cache-expired {
				background: #fcebe8;
				color: var(--scpa-ns-redwood);
			}

			.scpa-cache-empty {
				background: #ecebe8;
				color: #6b6863;
			}

			.scpa-cache-count {
				color: var(--scpa-ns-muted);
				font-size: 12px;
				font-weight: 650;
			}

			.scpa-status,
			.scpa-loading {
				padding: 9px 10px;
				border-radius: 0;
				font-size: 12px;
				line-height: 1.4;
			}

			.scpa-status[hidden],
			.scpa-loading[hidden] {
				display: none;
			}

			.scpa-status-info {
				background: #eaf4f7;
				color: var(--scpa-ns-teal-deep);
			}

			.scpa-status-success {
				background: #e8f4ee;
				color: #24523d;
			}

			.scpa-status-error {
				background: #fcebe8;
				color: var(--scpa-ns-redwood);
			}

			.scpa-loading {
				display: flex;
				align-items: center;
				gap: 9px;
				background: #eaf4f7;
				color: var(--scpa-ns-teal-deep);
				font-weight: 650;
			}

			.scpa-spinner {
				width: 16px;
				height: 16px;
				border: 2px solid rgba(50, 100, 120, 0.22);
				border-top-color: var(--scpa-ns-teal);
				border-radius: 50%;
				animation: scpa-spin 0.85s linear infinite;
			}

			@keyframes scpa-spin {
				to {
					transform: rotate(360deg);
				}
			}

			.scpa-is-loading .scpa-panel-footer button[type="button"]:last-child {
				pointer-events: none;
				opacity: 0.6;
			}

			@media (max-width: 860px) {
				body.scpa-panel-open #pageContainer {
					margin-right: 0;
				}

				#scpa-toolbar {
					flex-wrap: wrap;
					padding: 8px;
				}

				#scpa-panel-slot.scpa-open {
					width: min(var(--scpa-panel-width), 100vw);
					box-shadow: -16px 0 34px rgba(33, 63, 99, 0.18);
				}

				.scpa-panel {
					width: min(var(--scpa-panel-width), 100vw);
				}

				.scpa-settings-actions {
					grid-template-columns: 1fr;
				}
			}
		`);
	}

	function init() {
		injectStyles();
		buildToolbar();
		registerMenus();
		log("Loaded simplified main form workflow.");
	}

	whenReady(init);
})();
