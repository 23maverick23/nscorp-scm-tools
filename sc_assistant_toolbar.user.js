// ==UserScript==
// @name         SC Assistant Toolbar
// @namespace    nscorp-scm-tools
// @version      0.1.25
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
/* globals nlapiGetFieldValue, nlapiGetFieldText, nlapiSetFieldValue, nlapiGetUser, nlapiGetRecordId */

(function () {
	"use strict";

	const SCRIPT_NAME = typeof GM_info !== "undefined" && GM_info.script ? GM_info.script.name : "SC Request Push Panel";
	const SCRIPT_VERSION = typeof GM_info !== "undefined" && GM_info.script ? GM_info.script.version : "0.1.25";
	const TOOLBAR_NAME = "SCAI CrewMatch";
	const LOG_PREFIX = `${SCRIPT_NAME} >>`;
	const CACHE_KEY = "sc_assistant_toolbar_people_cache_v1";
	const CACHE_TS_KEY = "sc_assistant_toolbar_people_cache_ts_v1";
	const CACHE_IDS_KEY = "sc_assistant_toolbar_people_cache_ids_v1";
	const EMPLOYEE_IDS_KEY = "sc_assistant_toolbar_employee_ids_v1";
	const INITIALS_KEY = "sc_assistant_toolbar_initials_v1";
	const MANAGER_NOTES_TEMPLATE_KEY = "sc_assistant_toolbar_manager_notes_template_v1";
	const APPROVED_HASHTAGS_KEY = "sc_assistant_toolbar_approved_hashtags_v1";
	const AUTO_OPEN_ENABLED_KEY = "sc_assistant_toolbar_auto_open_enabled_v1";
	const AUTO_OPEN_URL_KEY = "sc_assistant_toolbar_auto_open_url_v1";
	const EXPAND_DETAILS_ENABLED_KEY = "sc_assistant_toolbar_expand_details_enabled_v1";
	const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
	const DEFAULT_EMPLOYEE_IDS = [];
	const DEFAULT_MANAGER_NOTES_TEMPLATE = "{date} - Staffed deal {initials}";
	const DEFAULT_APPROVED_HASHTAGS = "#emg";

	const FIELDS = {
		requestStatus: "custrecord_screq_status",
		engagementStatus: "custrecord_screq_engmnt_status",
		assignee: "custrecord_screq_assignee",
		lead: "custrecord_screq_assigned_lead",
		details: "custrecord_screq_details",
		managerNotes: "custrecord_screq_scmanager_notes",
		hashtags: "custrecord_screq_hashtags",
		deliverable: "custrecord_screq_engmnt_deliverable",
		complexFlag: "custrecord_sc_complex_flag",
		salesRep: "custrecord_screq_opp_salesreproster",
		salesRepEmail: "custrecord_screq_opp_salesreproster.custrecord_emproster_email",
		requester: "custrecord_screq_requestor",
		requesterEmail: "custrecord_screq_requestor.custrecord_emproster_email",
		company: "custrecord_screq_opp_company",
	};

	const STATUS = {
		hold: 3,
		staffed: 2,
		cancelled: 4,
		engagementCancelled: 5,
	};

	const ICONS = {
		plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
		settings:
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.37.4.69.6 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-.5 1Z"/></svg>',
		mail:
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>',
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

	function nsGetText(fieldId, fallback = "") {
		try {
			if (typeof nlapiGetFieldText !== "function") {
				return fallback;
			}
			const value = nlapiGetFieldText(fieldId);
			return value === null || value === undefined ? fallback : value;
		} catch (error) {
			warn(`Could not read field text ${fieldId}`, error);
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

	function getParentheticalInitials() {
		return String(getInitials() || "")
			.trim()
			.replace(/^\[/, "")
			.replace(/\]$/, "")
			.replace(/^\(/, "")
			.replace(/\)$/, "");
	}

	function getManagerNotesTemplate() {
		return String(getStoredValue(MANAGER_NOTES_TEMPLATE_KEY, DEFAULT_MANAGER_NOTES_TEMPLATE) || "");
	}

	function getApprovedHashtagsText() {
		const stored = getStoredValue(APPROVED_HASHTAGS_KEY, DEFAULT_APPROVED_HASHTAGS);
		return Array.isArray(stored) ? stored.join(", ") : String(stored || "");
	}

	function getApprovedHashtags() {
		return parseHashtags(getApprovedHashtagsText());
	}

	function getAutoOpenEnabled() {
		const stored = getStoredValue(AUTO_OPEN_ENABLED_KEY, false);
		return stored === true || stored === "true";
	}

	function getAutoOpenUrlPattern() {
		return String(getStoredValue(AUTO_OPEN_URL_KEY, "") || "");
	}

	function getExpandDetailsEnabled() {
		const stored = getStoredValue(EXPAND_DETAILS_ENABLED_KEY, true);
		return stored === true || stored === "true";
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

	function currentAutoOpenPattern() {
		const url = new URL(window.location.href);
		const rectype = url.searchParams.get("rectype");
		return rectype ? `${url.origin}${url.pathname}?rectype=${rectype}*&e=T*` : `${url.origin}${url.pathname}*e=T*`;
	}

	function isEditModeUrl(url = window.location.href) {
		try {
			return new URL(url).searchParams.get("e") === "T";
		} catch (error) {
			return false;
		}
	}

	function parseUrlPatterns(value) {
		return uniqueValues(
			String(value || "")
				.split(/[\n,]+/)
				.map((pattern) => pattern.trim())
				.filter(Boolean),
		);
	}

	function urlMatchesPattern(url, pattern) {
		const cleanUrl = String(url || "").split("#")[0];
		const cleanPattern = String(pattern || "").trim();
		if (!cleanPattern) {
			return false;
		}
		if (!cleanPattern.includes("*")) {
			return cleanUrl === cleanPattern;
		}
		const escaped = cleanPattern
			.split("*")
			.map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
			.join(".*");
		return new RegExp(`^${escaped}$`).test(cleanUrl);
	}

	function shouldAutoOpenAssignPanel() {
		if (!getAutoOpenEnabled() || !isEditModeUrl()) {
			return false;
		}
		const patterns = parseUrlPatterns(getAutoOpenUrlPattern());
		return patterns.some((pattern) => urlMatchesPattern(window.location.href, pattern));
	}

	function parseHashtags(value) {
		return uniqueValues(
			String(value || "")
				.split(/[\s,;]+/)
				.map(normalizeHashtag)
				.filter(Boolean),
		);
	}

	function normalizeHashtag(value) {
		const clean = String(value || "")
			.trim()
			.replace(/^#+/, "")
			.replace(/[^\w/-]/g, "")
			.replace(/\/+/g, "/")
			.replace(/^\/|\/$/g, "");
		return clean ? `#${clean}` : "";
	}

	function hashtagParts(tag) {
		const parts = String(tag || "")
			.replace(/^#/, "")
			.split("/")
			.filter(Boolean);
		if (parts.length > 1) {
			return { group: parts[0], label: parts.slice(1).join("/") };
		}
		return { group: "tags", label: parts[0] || String(tag || "").replace(/^#/, "") };
	}

	function titleCase(value) {
		return String(value || "")
			.replace(/[-_]+/g, " ")
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	function uniqueValues(values) {
		return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && String(value) !== "")));
	}

	function todayDisplay() {
		const date = new Date();
		return [String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0"), date.getFullYear()].join("/");
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
				return applyEmployeeLocationOverrides(cached);
			}

			await afterPaint();
			const people = applyEmployeeLocationOverrides(fetchConfiguredRosterPeople(employeeIds));
			setStoredValue(CACHE_KEY, people);
			setStoredValue(CACHE_TS_KEY, Date.now());
			setStoredValue(CACHE_IDS_KEY, idsKey);
			return people;
		})();
		return peoplePromise;
	}

	function fetchConfiguredRosterPeople(configuredIds) {
		const ids = uniqueValues(configuredIds.map((id) => String(id)));
		const order = new Map(ids.map((id, index) => [id, index]));
		const peopleByRosterId = new Map();
		const matchedEmployeeIds = new Set();

		searchRosterPeople([
			new nlobjSearchFilter("custrecord_emproster_emp", null, "anyof", ids),
			...activeRosterFilters(),
		]).forEach((person) => {
			peopleByRosterId.set(person.value, person);
			if (person.employeeRecordId) {
				matchedEmployeeIds.add(person.employeeRecordId);
			}
		});

		const unresolvedIds = ids.filter((id) => !matchedEmployeeIds.has(id));
		if (unresolvedIds.length) {
			searchRosterPeople([
				new nlobjSearchFilter("internalid", null, "anyof", unresolvedIds),
				...activeRosterFilters(),
			]).forEach((person) => {
				if (!peopleByRosterId.has(person.value)) {
					peopleByRosterId.set(person.value, person);
				}
			});
		}

		return Array.from(peopleByRosterId.values()).sort((a, b) => {
			const orderDiff = configuredRosterOrder(a, order) - configuredRosterOrder(b, order);
			return orderDiff || a.label.localeCompare(b.label);
		});
	}

	function activeRosterFilters() {
		return [
			new nlobjSearchFilter("custrecord_emproster_rosterstatus", null, "is", 1),
			new nlobjSearchFilter("custrecord_emproster_eminactive", null, "is", "F"),
		];
	}

	function searchRosterPeople(filters) {
		const columns = [
			makeColumn("internalid"),
			makeColumn("name"),
			makeColumn("custrecord_emproster_emp"),
			makeColumn("custrecord_emproster_firstname"),
			makeColumn("custrecord_emproster_lastname"),
			makeColumn("custrecord_emproster_olocation"),
		];
		return nsSearch("customrecord_emproster", filters, columns)
			.map(mapRosterPerson)
			.filter((person) => person.value && person.label)
			.sort((a, b) => a.label.localeCompare(b.label));
	}

	function mapRosterPerson(result) {
		const employeeRecordId = String(result.getValue("custrecord_emproster_emp") || "");
		const first = result.getValue("custrecord_emproster_firstname") || "";
		const last = result.getValue("custrecord_emproster_lastname") || "";
		const employeeText = result.getText("custrecord_emproster_emp") || "";
		const rosterName = result.getValue("name") || "";
		const name = [first, last].filter(Boolean).join(" ").trim() || normalizeEmployeeName(employeeText) || rosterName;
		const location = extractShortLocation(result.getText("custrecord_emproster_olocation") || "");
		return {
			value: String(result.getValue("internalid") || result.getId() || ""),
			employeeRecordId,
			label: location ? `${name} (${location})` : name,
			name,
			location,
		};
	}

	function applyEmployeeLocationOverrides(people) {
		return people.map((person) => {
			if (person.location !== "US-TX" || !/^Gabriel Cunha$/i.test(person.name.trim())) {
				return person;
			}
			return {
				...person,
				location: "US-CA",
				label: `${person.name} (US-CA)`,
			};
		});
	}

	function configuredRosterOrder(person, order) {
		const employeeOrder = order.has(person.employeeRecordId) ? order.get(person.employeeRecordId) : Number.POSITIVE_INFINITY;
		const rosterOrder = order.has(person.value) ? order.get(person.value) : Number.POSITIVE_INFINITY;
		return Math.min(employeeOrder, rosterOrder);
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

	function createComboBox({ label, required = false, placeholder = "", options = [], onSelect = null, onClear = null }) {
		const field = createFieldShell({ label, required });
		const wrapper = h("div", { class: "scpa-combo" });
		const input = h("input", { class: "scpa-input scpa-combo-input", type: "text", placeholder, autocomplete: "off" });
		const hidden = h("input", { type: "hidden" });
		const clearButton = h("button", { class: "scpa-combo-clear", type: "button", "aria-label": `Clear ${label}`, hidden: true }, [icon("x")]);
		const button = h("button", { class: "scpa-combo-button", type: "button", "aria-label": `Open ${label}` }, [icon("chevron")]);
		const menu = h("div", { class: "scpa-menu", hidden: true });
		let currentOptions = options.slice();
		let selected = null;

		wrapper.append(input, hidden, clearButton, button, menu);
		field.root.appendChild(wrapper);

		function getOpenQuery() {
			const selectedLabel = input.getAttribute("data-selected-label");
			return selected && selectedLabel && input.value === selectedLabel ? "" : input.value;
		}

		function open(query = getOpenQuery()) {
			menu.hidden = false;
			render(query);
		}

		function close() {
			menu.hidden = true;
		}

		function updateClearState() {
			clearButton.hidden = !input.value && !hidden.value;
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
			updateClearState();
			close();
			if (onSelect && !silent) {
				onSelect(option);
			}
		}

		function clearSelection({ focus = false, silent = false } = {}) {
			hidden.value = "";
			selected = null;
			input.value = "";
			input.removeAttribute("data-selected-label");
			delete input.dataset.employeeRecordId;
			updateClearState();
			render("");
			if (onClear && !silent) {
				onClear();
			}
			if (focus) {
				input.focus();
				open();
			}
		}

		input.addEventListener("focus", open);
		input.addEventListener("input", () => {
			const hadSelection = Boolean(hidden.value || selected);
			hidden.value = "";
			selected = null;
			input.removeAttribute("data-selected-label");
			delete input.dataset.employeeRecordId;
			updateClearState();
			if (hadSelection && onClear) {
				onClear();
			}
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
				open("");
				input.focus();
			} else {
				close();
			}
		});
		clearButton.addEventListener("mousedown", (event) => {
			event.preventDefault();
		});
		clearButton.addEventListener("click", () => clearSelection({ focus: true }));
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
				clearSelection({ silent: true });
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
				render(getOpenQuery());
			},
			setValue(value) {
				const match = currentOptions.find((option) => option.value === String(value));
				if (match) {
					selectOption(match, true);
				} else {
					clearSelection({ silent: true });
					hidden.value = value || "";
					updateClearState();
				}
			},
		};
	}

	function createHashtagPicker({ label, placeholder = "" }) {
		const field = createFieldShell({ label });
		const wrapper = h("div", { class: "scpa-tag-picker" });
		const input = h("input", { class: "scpa-input scpa-tag-custom-input", type: "text", placeholder, autocomplete: "off" });
		const groupsNode = h("div", { class: "scpa-tag-groups" });
		const customNode = h("div", { class: "scpa-custom-tags", hidden: true });
		let selected = [];
		let options = getApprovedHashtags();

		wrapper.append(input, groupsNode, customNode);
		field.root.appendChild(wrapper);

		function addTag(value) {
			const tag = normalizeHashtag(value);
			if (!tag || selected.includes(tag)) {
				input.value = "";
				render();
				return;
			}
			selected.push(tag);
			input.value = "";
			render();
		}

		function removeTag(tag) {
			selected = selected.filter((value) => value !== tag);
			render();
		}

		function toggleTag(tag) {
			if (selected.includes(tag)) {
				removeTag(tag);
			} else {
				addTag(tag);
			}
		}

		function renderGroups() {
			groupsNode.replaceChildren();
			if (!options.length) {
				groupsNode.appendChild(h("div", { class: "scpa-tag-help", text: "Add approved hashtags in Settings, or type a custom hashtag above." }));
				return;
			}

			const grouped = new Map();
			options.forEach((tag) => {
				const parts = hashtagParts(tag);
				if (!grouped.has(parts.group)) {
					grouped.set(parts.group, []);
				}
				grouped.get(parts.group).push({ tag, label: parts.label });
			});

			let groupIndex = 0;
			grouped.forEach((items, group) => {
				const toneClass = `scpa-tag-tone-${(groupIndex % 6) + 1}`;
				groupIndex += 1;
				const row = h("div", { class: "scpa-tag-toggle-row" });
				items.forEach(({ tag, label }) => {
					const isActive = selected.includes(tag);
					const button = h(
						"button",
						{
							class: `scpa-tag-toggle ${toneClass}${isActive ? " scpa-tag-toggle-active" : ""}`,
							type: "button",
							"aria-pressed": isActive ? "true" : "false",
							"data-tag": tag,
						},
						[titleCase(label)],
					);
					button.addEventListener("click", () => toggleTag(tag));
					row.appendChild(button);
				});

				groupsNode.appendChild(
					h("div", { class: `scpa-tag-group ${toneClass}` }, [
						h("div", { class: "scpa-tag-group-title", text: `#${group}` }),
						row,
					]),
				);
			});
		}

		function renderCustomTags() {
			customNode.replaceChildren();
			const approved = new Set(options);
			const customTags = selected.filter((tag) => !approved.has(tag));
			customNode.hidden = !customTags.length;
			if (!customTags.length) {
				return;
			}
			customNode.appendChild(h("div", { class: "scpa-custom-tags-title", text: "Custom" }));
			const row = h("div", { class: "scpa-custom-tag-row" });
			customTags.forEach((tag) => {
				const remove = h("button", { class: "scpa-tag-remove", type: "button", "aria-label": `Remove ${tag}` }, ["x"]);
				remove.addEventListener("click", () => removeTag(tag));
				row.appendChild(h("span", { class: "scpa-tag" }, [h("span", { text: tag }), remove]));
			});
			customNode.appendChild(row);
		}

		function render() {
			renderGroups();
			renderCustomTags();
		}

		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === ",") {
				event.preventDefault();
				addTag(input.value);
			}
		});
		input.addEventListener("blur", () => {
			if (input.value.trim()) {
				addTag(input.value);
			}
		});

		render();

		return {
			root: field.root,
			input,
			getValue: () => selected.join(","),
			setValue(value) {
				selected = parseHashtags(value);
				render();
			},
			setOptions(nextOptions) {
				options = parseHashtags(nextOptions.join(","));
				render();
			},
		};
	}

	function buildToolbar() {
		if (document.getElementById("scpa-toolbar")) {
			return;
		}

		const toolbar = h("div", { id: "scpa-toolbar", class: "scpa-toolbar" }, [
			h("div", { class: "scpa-toolbar-left" }, [
				h("div", { class: "scpa-toolbar-brand", "aria-label": `${TOOLBAR_NAME} version ${SCRIPT_VERSION}` }, [
					h("span", { class: "scpa-toolbar-name", text: TOOLBAR_NAME }),
					h("span", { class: "scpa-toolbar-version", text: `v${SCRIPT_VERSION}` }),
				]),
				h("span", { class: "scpa-toolbar-separator", "aria-hidden": "true", text: "|" }),
				h("button", { class: "scpa-toolbar-btn scpa-toolbar-icon-btn scpa-btn-ghost", type: "button", id: "scpa-open-settings", title: "Settings", "aria-label": "Settings" }, [
					icon("settings"),
				]),
				h("button", { class: "scpa-toolbar-btn scpa-toolbar-icon-btn scpa-btn-ghost", type: "button", id: "scpa-compose-email", title: "Email requester and sales rep", "aria-label": "Email requester and sales rep" }, [
					icon("mail"),
				]),
			]),
			h("div", { class: "scpa-toolbar-actions" }, [
				h("button", { class: "scpa-toolbar-btn scpa-hold", type: "button", id: "scpa-hold-request" }, [
					"On Hold",
				]),
				h("button", { class: "scpa-toolbar-btn scpa-cancel", type: "button", id: "scpa-cancel-request" }, [
					"Cancel request",
				]),
				h("button", { class: "scpa-toolbar-btn scpa-btn-primary", type: "button", id: "scpa-open-assign" }, [
					icon("plus"),
					"Quick assign SC",
				]),
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
		toolbar.querySelector("#scpa-compose-email").addEventListener("click", openSupportEmail);
		toolbar.querySelector("#scpa-hold-request").addEventListener("click", holdRequest);
		toolbar.querySelector("#scpa-cancel-request").addEventListener("click", cancelRequest);
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
				setGeneratedAddendum(option);
				setGeneratedManagerNotes(option.name || option.label);
			},
			onClear: clearGeneratedAssigneeText,
		});
		ui.detailsAdd = createTextarea({
			label: "SC Request Details Addendum",
			placeholder: "Text to prepend to the beginning of the SC Request Details on Save...",
			minHeight: 96,
		});
		ui.detailsAdd.textarea.addEventListener("input", () => {
			ui.detailsAdd.textarea.dataset.generated = "0";
		});
		ui.managerNotes = createTextarea({
			label: "SC Manager Notes",
			placeholder: "Manager notes to set on Apply...",
			minHeight: 132,
		});
		ui.managerNotes.textarea.addEventListener("input", () => {
			ui.managerNotes.textarea.dataset.generated = "0";
		});
		ui.hashtags = createHashtagPicker({
			label: "Hashtags",
			placeholder: "Add hashtag",
		});

		const body = h("div", { class: "scpa-panel-body" }, [
			panelLoading(),
			panelStatus(),
			ui.assignee.root,
			ui.detailsAdd.root,
			h("div", { class: "scpa-divider" }),
			h("div", { class: "scpa-section-label", text: "Manager Fields" }),
			ui.managerNotes.root,
			ui.hashtags.root,
		]);

		const footer = h("div", { class: "scpa-panel-footer" }, [
			h("button", { class: "scpa-panel-btn scpa-cancel", type: "button", onclick: closePanels }, ["Cancel"]),
			h("button", { class: "scpa-panel-btn scpa-secondary", type: "button", onclick: () => saveQuickAssign(false) }, ["Apply"]),
			h("button", { class: "scpa-panel-btn scpa-primary-blue", type: "button", onclick: () => saveQuickAssign(true) }, ["Apply and Save"]),
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
		ui.settingsAutoOpen = createToggle({ label: "Auto-open Quick Assign panel", checked: false });
		ui.settingsAutoOpenUrl = createTextInput({
			label: "Auto-open URL Match",
			placeholder: currentAutoOpenPattern(),
		});
		ui.settingsExpandDetails = createToggle({ label: "Expand native Request Details field", checked: true });
		ui.settingsManagerNotesTemplate = createTextarea({
			label: "SC Manager Notes Template",
			placeholder: "{date} - Staffed deal {initials}",
			minHeight: 132,
		});
		ui.settingsApprovedHashtags = createTextarea({
			label: "Approved Hashtags",
			placeholder: "#emg, #priority",
			minHeight: 84,
		});
		ui.settingsApprovedHashtags.root.appendChild(h("div", {
			class: "scpa-field-help",
			text: "Separate tags with commas or line breaks. Use slash for hierarchy, like #type/call; dashes stay in the tag name, like #follow-up.",
		}));
		ui.settingsEmployeeIds = createTextarea({
			label: "Assignee Employee or Roster IDs",
			placeholder: "Employee IDs first; roster record IDs are accepted as fallback",
			minHeight: 124,
		});
		ui.settingsCacheSummary = h("div", { class: "scpa-cache-summary" });

		const body = h("div", { class: "scpa-panel-body" }, [
			panelLoading(),
			panelStatus(),
			h("div", { class: "scpa-section-label", text: "Defaults" }),
			ui.settingsInitials.root,
			ui.settingsAutoOpen.root,
			ui.settingsAutoOpenUrl.root,
			ui.settingsExpandDetails.root,
			ui.settingsManagerNotesTemplate.root,
			ui.settingsApprovedHashtags.root,
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
		ui.hashtags.setOptions(getApprovedHashtags());
		ui.hashtags.setValue(nsGet(FIELDS.hashtags));
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
				hydrateManagerNotesField();
				ui.assignee.input.placeholder = people.length ? "Choose an SC" : "Add employee IDs in Settings";
				setPanelLoading(assignPanel, false);
				if (!getConfiguredEmployeeIds().length) {
					setPanelStatus(assignPanel, "Add employee IDs in Settings to populate the assignee dropdown.", "info");
				} else if (!people.length) {
					setPanelStatus(assignPanel, "No active SC roster records found for the configured employee or roster IDs.", "error");
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
		ui.settingsAutoOpen.setValue(getAutoOpenEnabled());
		ui.settingsAutoOpenUrl.setValue(getAutoOpenUrlPattern());
		ui.settingsExpandDetails.setValue(getExpandDetailsEnabled());
		ui.settingsManagerNotesTemplate.setValue(getManagerNotesTemplate());
		ui.settingsApprovedHashtags.setValue(getApprovedHashtagsText());
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

	function persistSettingsInputs() {
		const initials = ui.settingsInitials.getValue() || "[SC Mgr]";
		const autoOpenEnabled = ui.settingsAutoOpen.getValue();
		const autoOpenUrlPattern = autoOpenEnabled
			? (ui.settingsAutoOpenUrl.getValue().trim() || currentAutoOpenPattern())
			: ui.settingsAutoOpenUrl.getValue().trim();
		const expandDetailsEnabled = ui.settingsExpandDetails.getValue();
		const managerNotesTemplate = ui.settingsManagerNotesTemplate.getValue() || DEFAULT_MANAGER_NOTES_TEMPLATE;
		const approvedHashtagsText = parseHashtags(ui.settingsApprovedHashtags.getValue()).join(", ");
		const employeeIdsText = parseEmployeeIds(ui.settingsEmployeeIds.getValue()).join(", ");

		setStoredValue(INITIALS_KEY, initials);
		setStoredValue(AUTO_OPEN_ENABLED_KEY, autoOpenEnabled);
		setStoredValue(AUTO_OPEN_URL_KEY, autoOpenUrlPattern);
		setStoredValue(EXPAND_DETAILS_ENABLED_KEY, expandDetailsEnabled);
		setStoredValue(MANAGER_NOTES_TEMPLATE_KEY, managerNotesTemplate);
		setStoredValue(APPROVED_HASHTAGS_KEY, approvedHashtagsText);
		setStoredValue(EMPLOYEE_IDS_KEY, employeeIdsText);
		clearPeopleCache();
		ui.settingsAutoOpen.setValue(autoOpenEnabled);
		ui.settingsAutoOpenUrl.setValue(autoOpenUrlPattern);
		ui.settingsExpandDetails.setValue(expandDetailsEnabled);
		ui.settingsManagerNotesTemplate.setValue(managerNotesTemplate);
		ui.settingsApprovedHashtags.setValue(approvedHashtagsText);
		ui.settingsEmployeeIds.setValue(employeeIdsText);
		if (ui.hashtags) {
			ui.hashtags.setOptions(getApprovedHashtags());
		}
		applyNativeDetailsExpansion();
		return employeeIdsText;
	}

	async function saveSettings() {
		const employeeIdsText = persistSettingsInputs();

		updateSettingsCacheSummary();
		if (!employeeIdsText) {
			setPanelStatus(settingsPanel, "Settings saved. Add assignee IDs to populate the roster cache.", "info");
			return;
		}

		await refreshSettingsRosterCache("Settings saved. Roster refreshed");
	}

	async function refreshSettingsCache() {
		const employeeIdsText = persistSettingsInputs();
		updateSettingsCacheSummary();
		if (!employeeIdsText) {
			setPanelStatus(settingsPanel, "Add assignee IDs before refreshing the roster cache.", "info");
			return;
		}

		await refreshSettingsRosterCache("Roster refreshed");
	}

	async function refreshSettingsRosterCache(successPrefix) {
		setPanelStatus(settingsPanel, "");
		setPanelLoading(settingsPanel, true, "Refreshing configured roster...");
		try {
			const people = await loadPeople(true);
			updateSettingsCacheSummary();
			const message = `${successPrefix} with ${people.length} assignee${people.length === 1 ? "" : "s"}.`;
			setPanelStatus(
				settingsPanel,
				people.length ? message : `${message} Check that the IDs are active Employee internal IDs or SC roster record IDs.`,
				people.length ? "success" : "error",
			);
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

	function resolveCurrentUserRosterPerson() {
		if (typeof nlapiGetUser !== "function") {
			return null;
		}
		const currentUserId = String(nlapiGetUser() || "");
		if (!currentUserId) {
			return null;
		}
		try {
			const matches = fetchConfiguredRosterPeople([currentUserId]);
			return matches[0] || null;
		} catch (error) {
			warn("Could not resolve current user roster record", error);
			return null;
		}
	}

	function setGeneratedAddendum(assignee) {
		if (!ui.detailsAdd || (ui.detailsAdd.getValue() && ui.detailsAdd.textarea.dataset.generated !== "1")) {
			return;
		}
		const assigneeText = formatAssigneeForAddendum(assignee);
		ui.detailsAdd.setValue(`${todayDisplay()} - Please work with ${assigneeText} on next steps to KT ${getInitials()}\n\n`);
		ui.detailsAdd.textarea.dataset.generated = "1";
	}

	function formatAssigneeForAddendum(assignee) {
		if (assignee && typeof assignee === "object") {
			const name = cleanAssigneeName(assignee.name || assignee.label);
			return assignee.location ? `${name} (${assignee.location})` : name;
		}
		const label = String(assignee || "");
		const location = extractLocationFromLabel(label);
		const name = cleanAssigneeName(label);
		return location ? `${name} (${location})` : name;
	}

	function extractLocationFromLabel(label) {
		const match = String(label || "").match(/\(([^)]*)\)\s*$/);
		return match ? match[1] : "";
	}

	function clearGeneratedAssigneeText() {
		if (ui.detailsAdd && ui.detailsAdd.textarea.dataset.generated === "1") {
			ui.detailsAdd.setValue("");
		}
		if (ui.managerNotes && ui.managerNotes.textarea.dataset.generated === "1") {
			ui.managerNotes.setValue("");
		}
	}

	function hydrateManagerNotesField() {
		const currentNotes = nsGet(FIELDS.managerNotes);
		if (currentNotes) {
			ui.managerNotes.setValue(currentNotes);
			ui.managerNotes.textarea.dataset.generated = "0";
			return;
		}
		setGeneratedManagerNotes(ui.assignee.getLabel());
	}

	function setGeneratedManagerNotes(name) {
		if (!ui.managerNotes || (ui.managerNotes.getValue() && ui.managerNotes.textarea.dataset.generated !== "1")) {
			return;
		}
		ui.managerNotes.setValue(buildManagerNotesFromTemplate(name));
		ui.managerNotes.textarea.dataset.generated = "1";
	}

	function buildManagerNotesFromTemplate(name) {
		return renderTemplate(getManagerNotesTemplate(), {
			date: todayDisplay(),
			initials: getInitials(),
			assignee: cleanAssigneeName(name),
			assigneeName: cleanAssigneeName(name),
		});
	}

	function renderTemplate(template, values) {
		return String(template || "")
			.replace(/\\n/g, "\n")
			.replace(/\{([a-zA-Z][\w]*)\}/g, (match, key) =>
				Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
			);
	}

	function cleanAssigneeName(name) {
		return String(name || "").replace(/\s+\([^)]*\)$/, "");
	}

	function validateQuickAssign(values) {
		const missing = [];
		if (!values.assigneeId) missing.push("Assign To");
		return missing;
	}

	function saveQuickAssign(shouldSubmit = false) {
		const values = {
			assigneeId: ui.assignee.getValue(),
			assigneeName: ui.assignee.getLabel(),
			detailsAdd: ui.detailsAdd.getValue(),
			managerNotes: ui.managerNotes.getValue(),
			hashtags: ui.hashtags.getValue(),
		};
		const missing = validateQuickAssign(values);

		if (missing.length) {
			setPanelStatus(assignPanel, `Required: ${missing.join(", ")}`, "error");
			return;
		}

		try {
			nsSet(FIELDS.requestStatus, STATUS.staffed);
			nsSet(FIELDS.assignee, values.assigneeId);
			nsSet(FIELDS.lead, "F");
			nsSet(FIELDS.deliverable, 53);
			nsSet(FIELDS.complexFlag, 2);

			if (values.detailsAdd) {
				prependField(FIELDS.details, values.detailsAdd);
			}

			nsSet(FIELDS.managerNotes, values.managerNotes);
			nsSet(FIELDS.hashtags, values.hashtags);

			if (shouldSubmit) {
				setPanelStatus(assignPanel, "Applied changes. Submitting through the native NetSuite Save button...", "info");
				submitNetSuiteForm();
				return;
			}

			setPanelStatus(assignPanel, "Applied changes to the NetSuite form. Save the record when ready.", "success");
		} catch (error) {
			setPanelStatus(assignPanel, error.message || String(error), "error");
		}
	}

	function prependField(fieldId, text) {
		const current = nsGet(fieldId, "");
		nsSet(fieldId, `${text}${current}`);
	}

	function holdRequest() {
		try {
			const currentUser = resolveCurrentUserRosterPerson();
			nsSet(FIELDS.requestStatus, STATUS.hold);
			nsSet(FIELDS.lead, "F");
			if (currentUser) {
				nsSet(FIELDS.assignee, currentUser.value);
				if (ui.assignee) {
					ui.assignee.selectOption(currentUser, true);
				}
				reportToolbarActionResult(`Marked request On Hold and assigned to ${currentUser.name || currentUser.label}. Save the record when ready.`, "success");
				return;
			}
			reportToolbarActionResult("Marked request On Hold. I could not resolve your roster record, so Assign To was not changed.", "info");
		} catch (error) {
			reportToolbarActionResult(error.message || String(error), "error");
		}
	}

	function cancelRequest() {
		if (!window.confirm("Mark this SC Request as cancelled? Changes will be applied to the form but not saved until you save the record.")) {
			return;
		}
		const currentUser = resolveCurrentUserRosterPerson();
		const comment = `SC Request cancelled by SC Manager (${getParentheticalInitials()}). \nPlease create a new request if needed.\n---\n\n`;
		try {
			prependField(FIELDS.details, comment);
			nsSet(FIELDS.requestStatus, STATUS.cancelled);
			nsSet(FIELDS.engagementStatus, STATUS.engagementCancelled);
			nsSet(FIELDS.lead, "F");
			if (currentUser) {
				nsSet(FIELDS.assignee, currentUser.value);
				if (ui.assignee) {
					ui.assignee.selectOption(currentUser, true);
				}
				reportToolbarActionResult(`Marked request cancelled and assigned to ${currentUser.name || currentUser.label}. Save the record when ready.`, "success");
				return;
			}
			reportToolbarActionResult("Marked request cancelled. I could not resolve your roster record, so Assign To was not changed.", "info");
		} catch (error) {
			reportToolbarActionResult(error.message || String(error), "error");
		}
	}

	function openSupportEmail() {
		try {
			const draft = buildSupportEmailDraft();
			if (!draft.recipients.length) {
				throw new Error("Could not find a Sales Rep or Requester email address on this request.");
			}
			window.location.href = buildMailtoUrl(draft);
		} catch (error) {
			reportToolbarActionResult(error.message || String(error), "error");
		}
	}

	function buildSupportEmailDraft() {
		const requestId = getRequestId();
		const company = getRequestCompany();
		return {
			recipients: uniqueEmailRecipients([
				getRosterEmail(FIELDS.salesRepEmail, FIELDS.salesRep),
				getRosterEmail(FIELDS.requesterEmail, FIELDS.requester),
			]),
			subject: `Req ${requestId || "Unknown"} | SCAI Support for ${company || "Unknown Company"}`,
			body: String(nsGet(FIELDS.details) || "").trim(),
		};
	}

	function getRosterEmail(joinedEmailFieldId, rosterFieldId) {
		const joinedEmail = nsGet(joinedEmailFieldId);
		if (joinedEmail) {
			return joinedEmail;
		}
		return findRosterEmail(nsGet(rosterFieldId));
	}

	function findRosterEmail(rosterId) {
		if (!rosterId) {
			return "";
		}
		try {
			const results = nsSearch("customrecord_emproster", [
				new nlobjSearchFilter("internalid", null, "anyof", rosterId),
			], [
				makeColumn("custrecord_emproster_email"),
			]);
			const match = results[0];
			return match ? String(match.getValue("custrecord_emproster_email") || "") : "";
		} catch (error) {
			warn(`Could not resolve roster email for ${rosterId}`, error);
			return "";
		}
	}

	function uniqueEmailRecipients(values) {
		const seen = new Set();
		const recipients = [];
		values.flatMap(splitEmailRecipients).forEach((recipient) => {
			const key = emailRecipientKey(recipient);
			if (!key || seen.has(key)) {
				return;
			}
			seen.add(key);
			recipients.push(recipient);
		});
		return recipients;
	}

	function splitEmailRecipients(value) {
		return String(value || "")
			.split(/[;,]+/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function emailRecipientKey(recipient) {
		return extractEmailAddress(recipient).toLowerCase();
	}

	function extractEmailAddress(recipient) {
		const match = String(recipient || "").match(/<([^>]+)>/);
		return (match ? match[1] : recipient).trim();
	}

	function getRequestId() {
		try {
			if (typeof nlapiGetRecordId === "function") {
				const recordId = nlapiGetRecordId();
				if (recordId) {
					return String(recordId);
				}
			}
		} catch (error) {
			warn("Could not read current record id", error);
		}
		return "";
	}

	function getRequestCompany() {
		return String(nsGetText(FIELDS.company) || nsGet(FIELDS.company) || "").trim();
	}

	function buildMailtoUrl({ recipients, subject, body }) {
		const to = recipients.map(extractEmailAddress).filter(Boolean).map(encodeURIComponent).join(",");
		const query = [`subject=${encodeURIComponent(subject || "")}`];
		if (body) {
			query.push(`body=${encodeURIComponent(body)}`);
		}
		return `mailto:${to}?${query.join("&")}`;
	}

	function reportToolbarActionResult(message, type) {
		if (assignPanel && activePanel === "assign") {
			setPanelStatus(assignPanel, message, type);
			return;
		}
		window.alert(message);
	}

	function submitNetSuiteForm() {
		const button = findNetSuiteSaveButton();
		if (!button) {
			throw new Error("Could not find the native NetSuite Save button. Changes were applied, but the record was not submitted.");
		}
		button.click();
	}

	function findNetSuiteSaveButton() {
		const selectors = [
			"#submitter",
			"#secondarysubmitter",
			"input[name='submitter']",
			"#tbl_submitter input",
			"input[id$='submitter'][type='button']",
			"input[type='submit'][value='Save']",
			"button[type='submit'][value='Save']",
			"#btn_multibutton_submitter",
		];
		return selectors.map((selector) => document.querySelector(selector)).find((node) => node && !node.disabled && isVisible(node));
	}

	function isVisible(node) {
		const rect = node.getBoundingClientRect();
		const style = window.getComputedStyle(node);
		return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
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

	function maybeAutoOpenAssignPanel() {
		if (!shouldAutoOpenAssignPanel()) {
			return;
		}
		deferPanelWork(() => {
			if (!activePanel) {
				openPanel("assign");
			}
		});
	}

	function applyNativeDetailsExpansion(retries = 8) {
		const textarea = document.getElementById(FIELDS.details);
		if (!textarea) {
			if (retries > 0) {
				setTimeout(() => applyNativeDetailsExpansion(retries - 1), 250);
			}
			return;
		}

		const wrapper = textarea.closest(".uir-text-area-wrapper");
		const fieldWrapper = textarea.closest(".uir-field-wrapper");
		const enabled = getExpandDetailsEnabled();
		if (wrapper) {
			wrapper.classList.toggle("scpa-native-details-expanded", enabled);
		}
		if (fieldWrapper) {
			fieldWrapper.classList.toggle("scpa-native-details-field-expanded", enabled);
		}
		textarea.classList.toggle("scpa-native-details-textarea-expanded", enabled);
		if (enabled) {
			textarea.setAttribute("rows", "16");
			textarea.setAttribute("cols", "80");
		} else {
			textarea.setAttribute("rows", "4");
			textarea.setAttribute("cols", "40");
		}
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
				--scpa-canvas: #f7f6f3;
				--scpa-surface: #ffffff;
				--scpa-frost: #f1f4f5;
				--scpa-ink: #181818;
				--scpa-text: #3d3d3a;
				--scpa-muted: #66635f;
				--scpa-subtle: #9a9792;
				--scpa-line: #dedbd5;
				--scpa-line-soft: #ece9e3;
				--scpa-line-strong: #326478;
				--scpa-action: #326478;
				--scpa-action-hover: #1d4050;
				--scpa-action-soft: #eaf4f7;
				--scpa-success: #326478;
				--scpa-danger: #7a241a;
				--scpa-danger-soft: #fbe7e3;
				--scpa-next-gradient: linear-gradient(90deg, #376980 0%, #997faa 24%, #ffa5a5 48%, #d4976c 72%, #975d6b 100%);
				--scpa-c-blue-50: #e8f4f8;
				--scpa-c-blue-600: #7898a8;
				--scpa-c-blue-900: #376980;
				--scpa-c-teal-50: #ddeef2;
				--scpa-c-teal-600: #326478;
				--scpa-c-teal-900: #1d4050;
				--scpa-c-coral-50: #fcebe8;
				--scpa-c-coral-600: #e88070;
				--scpa-c-coral-900: #8a3d35;
				--scpa-c-amber-50: #fbf1da;
				--scpa-c-amber-600: #e0b870;
				--scpa-c-amber-900: #73521e;
				--scpa-c-pink-50: #f8e8f0;
				--scpa-c-pink-600: #e0a0b8;
				--scpa-c-pink-900: #7a435b;
				--scpa-c-purple-50: #f0eaf4;
				--scpa-c-purple-600: #887898;
				--scpa-c-purple-900: #4a3a5b;
				--scpa-radius-control: 6px;
				--scpa-radius-card: 6px;
				--scpa-radius-button: 3px;
				--scpa-radius-pill: 9999px;
				--scpa-shadow-sm: rgba(50, 100, 120, 0.12) 0 0 0 1px;
				--scpa-shadow-md: rgba(50, 100, 120, 0.16) 0 0 0 1px, rgba(24, 24, 24, 0.08) 0 14px 30px -18px;
				--scpa-font: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
				--scpa-panel-width: 420px;
			}

			.uir-text-area-wrapper.scpa-native-details-expanded {
				width: min(760px, calc(100vw - var(--scpa-panel-width, 0px) - 96px)) !important;
				max-width: calc(100vw - var(--scpa-panel-width, 0px) - 32px) !important;
				height: 520px !important;
				min-height: 520px !important;
			}

			.uir-field-wrapper.scpa-native-details-field-expanded {
				max-width: min(860px, calc(100vw - var(--scpa-panel-width, 0px) - 32px)) !important;
			}

			textarea#custrecord_screq_details.scpa-native-details-textarea-expanded {
				box-sizing: border-box !important;
				width: 100% !important;
				height: calc(100% - 24px) !important;
				min-height: 480px !important;
			}

			body.scpa-panel-open {
				--scpa-panel-width: 420px;
				overflow-x: hidden;
				padding-right: var(--scpa-panel-width) !important;
				transition: padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			}

			#scpa-toolbar {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
				min-height: 52px;
				margin: 8px 0 12px;
				padding: 8px 20px;
				background: var(--scpa-frost);
				border: 1px solid var(--scpa-line);
				border-right: 0;
				border-left: 0;
				border-radius: 0;
				color: var(--scpa-ink);
				font-family: var(--scpa-font);
				line-height: 1.5;
				box-shadow: none;
			}

			.scpa-toolbar-left,
			.scpa-toolbar-actions {
				display: flex;
				align-items: center;
				gap: 10px;
			}

			.scpa-toolbar-left {
				justify-content: flex-start;
			}

			.scpa-toolbar-brand {
				display: inline-flex;
				align-items: baseline;
				gap: 7px;
				min-width: 0;
				color: var(--scpa-ink);
				white-space: nowrap;
			}

			.scpa-toolbar-name {
				font-size: 14px;
				font-weight: 750;
			}

			.scpa-toolbar-version {
				color: var(--scpa-muted);
				font-size: 11px;
				font-weight: 700;
				letter-spacing: 0;
			}

			.scpa-toolbar-separator {
				color: var(--scpa-subtle);
				font-size: 18px;
				line-height: 1;
			}

			.scpa-toolbar-actions {
				justify-content: flex-end;
				margin-left: auto;
			}

			.scpa-toolbar-btn,
			.scpa-panel-btn,
			.scpa-close,
			.scpa-combo-clear,
			.scpa-combo-button,
			.scpa-menu-item {
				font: inherit;
			}

			.scpa-toolbar-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 7px;
				height: 40px;
				padding: 0 16px;
				border: 1px solid var(--scpa-line-strong);
				border-radius: var(--scpa-radius-button);
				font-size: 13px;
				font-weight: 650;
				cursor: pointer;
				white-space: nowrap;
				transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease;
			}

			.scpa-toolbar-icon-btn {
				width: 40px;
				padding: 0;
			}

			.scpa-btn-primary {
				background: var(--scpa-surface);
				border-color: var(--scpa-action);
				color: var(--scpa-action);
			}

			.scpa-btn-primary:hover {
				background: var(--scpa-action-soft);
				border-color: var(--scpa-action);
				box-shadow: none;
			}

			.scpa-btn-ghost {
				background: var(--scpa-surface);
				border-color: var(--scpa-line);
				color: var(--scpa-muted);
			}

			.scpa-btn-ghost:hover {
				background: var(--scpa-action-soft);
				border-color: var(--scpa-action);
				color: var(--scpa-action);
				box-shadow: none;
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
				background: var(--scpa-canvas);
				border-left: 0 solid var(--scpa-line);
				box-shadow: -8px 0 24px rgba(50, 100, 120, 0.12);
				transition:
					width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
					border-left-width 0.01s 0.15s;
			}

			#scpa-panel-slot.scpa-open {
				width: var(--scpa-panel-width);
				border-left-width: 1px;
				overflow: visible;
			}

			body.scpa-panel-open #pageContainer,
			body.scpa-panel-open #div__body {
				width: calc(100vw - var(--scpa-panel-width)) !important;
				max-width: calc(100vw - var(--scpa-panel-width)) !important;
				margin-right: 0 !important;
				transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			}

			.scpa-panel {
				display: flex;
				flex-direction: column;
				width: var(--scpa-panel-width);
				height: 100vh;
				max-height: 100vh;
				background: var(--scpa-canvas);
				color: var(--scpa-ink);
				font-family: var(--scpa-font);
				line-height: 1.5;
				overflow: hidden;
				position: relative;
			}

			.scpa-panel::before {
				content: "";
				position: absolute;
				top: 0;
				right: 0;
				left: 0;
				z-index: 2;
				height: 4px;
				background: var(--scpa-next-gradient);
			}

			.scpa-panel[hidden] {
				display: none;
			}

			.scpa-panel-header {
				display: flex;
				align-items: center;
				min-height: 64px;
				padding: 4px 20px 0;
				background: var(--scpa-surface);
				border-bottom: 1px solid var(--scpa-line);
				color: var(--scpa-ink);
				flex: 0 0 auto;
			}

			.scpa-panel-title {
				flex: 1;
				font-size: 17px;
				font-weight: 700;
			}

			.scpa-close {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				padding: 0;
				border: 0;
				border-radius: var(--scpa-radius-button);
				background: transparent;
				color: var(--scpa-muted);
				cursor: pointer;
			}

			.scpa-close:hover {
				background: var(--scpa-action-soft);
				color: var(--scpa-action);
			}

			.scpa-panel-body {
				display: flex;
				flex: 1 1 auto;
				flex-direction: column;
				gap: 14px;
				min-height: 0;
				overflow-y: auto;
				padding: 18px 18px 20px;
			}

			.scpa-panel-footer {
				position: sticky;
				bottom: 0;
				z-index: 35;
				display: flex;
				gap: 10px;
				padding: 14px 18px;
				border-top: 1px solid var(--scpa-line);
				background: var(--scpa-surface);
				box-shadow: 0 -4px 16px rgba(50, 100, 120, 0.08);
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
				color: var(--scpa-muted);
				font-size: 11px;
				font-weight: 650;
				letter-spacing: 0;
				text-transform: uppercase;
			}

			.scpa-required {
				color: var(--scpa-danger);
			}

			.scpa-field-help {
				margin-top: -2px;
				color: var(--scpa-muted);
				font-size: 12px;
				line-height: 1.4;
			}

			.scpa-input,
			.scpa-textarea {
				width: 100%;
				border: 1px solid var(--scpa-line);
				border-radius: var(--scpa-radius-control);
				background: var(--scpa-surface);
				color: var(--scpa-ink);
				font-size: 13px;
			}

			.scpa-input::placeholder,
			.scpa-textarea::placeholder {
				color: var(--scpa-subtle);
			}

			.scpa-input {
				height: 38px;
				padding: 0 12px;
			}

			.scpa-textarea {
				padding: 10px 12px;
				resize: vertical;
				line-height: 1.42;
			}

			.scpa-input:focus,
			.scpa-textarea:focus {
				border-color: var(--scpa-action);
				background: var(--scpa-surface);
				outline: 3px solid rgba(50, 100, 120, 0.16);
			}

			.scpa-combo {
				position: relative;
			}

			.scpa-combo-input {
				padding-right: 76px;
			}

			.scpa-combo-clear,
			.scpa-combo-button {
				position: absolute;
				top: 1px;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				height: 36px;
				border: 0;
				background: transparent;
				color: var(--scpa-subtle);
				cursor: pointer;
			}

			.scpa-combo-clear {
				right: 37px;
				width: 32px;
				border-left: 1px solid var(--scpa-line-soft);
			}

			.scpa-combo-clear[hidden] {
				display: none;
			}

			.scpa-combo-button {
				right: 1px;
				width: 36px;
				border-left: 1px solid var(--scpa-line);
				border-radius: 0 var(--scpa-radius-control) var(--scpa-radius-control) 0;
			}

			.scpa-combo-clear:hover,
			.scpa-combo-button:hover {
				background: var(--scpa-action-soft);
				color: var(--scpa-action);
			}

			.scpa-tag-picker {
				position: relative;
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.scpa-tag-groups {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.scpa-tag-group {
				padding: 9px;
				border: 1px solid var(--scpa-line);
				border-radius: var(--scpa-radius-card);
				background: var(--scpa-surface);
				box-shadow: var(--scpa-shadow-sm);
			}

			.scpa-tag-group-title,
			.scpa-custom-tags-title {
				margin-bottom: 7px;
				color: var(--scpa-tag-ink, var(--scpa-muted));
				font-size: 10px;
				font-weight: 700;
				letter-spacing: 0;
				text-transform: uppercase;
			}

			.scpa-tag-toggle-row,
			.scpa-custom-tag-row {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 6px;
			}

			.scpa-tag-toggle {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-height: 30px;
				padding: 0 12px;
				border: 1px solid var(--scpa-line);
				border-radius: var(--scpa-radius-pill);
				background: var(--scpa-surface);
				color: var(--scpa-ink);
				font-size: 12px;
				font-weight: 650;
				cursor: pointer;
				transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
			}

			.scpa-tag-toggle:hover {
				border-color: var(--scpa-tag-line, var(--scpa-action));
				background: var(--scpa-tag-bg, var(--scpa-action-soft));
			}

			.scpa-tag-toggle-active {
				border-color: var(--scpa-tag-line, var(--scpa-action));
				background: var(--scpa-tag-bg, var(--scpa-action-soft));
				color: var(--scpa-tag-ink, var(--scpa-action));
				box-shadow: inset 0 0 0 1px var(--scpa-surface);
			}

			.scpa-tag-tone-1 {
				--scpa-tag-bg: var(--scpa-c-blue-50);
				--scpa-tag-line: var(--scpa-c-blue-600);
				--scpa-tag-ink: var(--scpa-c-blue-900);
			}

			.scpa-tag-tone-2 {
				--scpa-tag-bg: var(--scpa-c-teal-50);
				--scpa-tag-line: var(--scpa-c-teal-600);
				--scpa-tag-ink: var(--scpa-c-teal-900);
			}

			.scpa-tag-tone-3 {
				--scpa-tag-bg: var(--scpa-c-coral-50);
				--scpa-tag-line: var(--scpa-c-coral-600);
				--scpa-tag-ink: var(--scpa-c-coral-900);
			}

			.scpa-tag-tone-4 {
				--scpa-tag-bg: var(--scpa-c-amber-50);
				--scpa-tag-line: var(--scpa-c-amber-600);
				--scpa-tag-ink: var(--scpa-c-amber-900);
			}

			.scpa-tag-tone-5 {
				--scpa-tag-bg: var(--scpa-c-pink-50);
				--scpa-tag-line: var(--scpa-c-pink-600);
				--scpa-tag-ink: var(--scpa-c-pink-900);
			}

			.scpa-tag-tone-6 {
				--scpa-tag-bg: var(--scpa-c-purple-50);
				--scpa-tag-line: var(--scpa-c-purple-600);
				--scpa-tag-ink: var(--scpa-c-purple-900);
			}

			.scpa-tag-help {
				padding: 9px 10px;
				border: 1px dashed var(--scpa-line);
				border-radius: var(--scpa-radius-card);
				background: var(--scpa-frost);
				color: var(--scpa-muted);
				font-size: 12px;
			}

			.scpa-custom-tags {
				padding: 9px;
				border: 1px solid var(--scpa-line);
				border-radius: var(--scpa-radius-card);
				background: var(--scpa-surface);
				box-shadow: var(--scpa-shadow-sm);
			}

			.scpa-custom-tags[hidden] {
				display: none;
			}

			.scpa-tag {
				display: inline-flex;
				align-items: center;
				gap: 5px;
				min-height: 28px;
				padding: 0 9px;
				border: 1px solid var(--scpa-line);
				border-radius: var(--scpa-radius-pill);
				background: var(--scpa-action-soft);
				color: var(--scpa-text);
				font-size: 12px;
				font-weight: 650;
			}

			.scpa-tag-remove {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 16px;
				height: 16px;
				padding: 0;
				border: 0;
				border-radius: var(--scpa-radius-pill);
				background: transparent;
				color: var(--scpa-subtle);
				cursor: pointer;
				font: inherit;
				line-height: 1;
			}

			.scpa-tag-remove:hover {
				background: var(--scpa-action);
				color: var(--scpa-surface);
			}

			.scpa-menu {
				position: absolute;
				top: calc(100% + 4px);
				left: 0;
				right: 0;
				z-index: 20;
				max-height: 230px;
				overflow-y: auto;
				border: 1px solid var(--scpa-line);
				border-radius: var(--scpa-radius-card);
				background: var(--scpa-surface);
				box-shadow: var(--scpa-shadow-md);
			}

			.scpa-menu[hidden] {
				display: none;
			}

			.scpa-menu-item {
				display: flex;
				width: 100%;
				align-items: center;
				padding: 10px 12px;
				border: 0;
				background: var(--scpa-surface);
				color: var(--scpa-ink);
				font-size: 13px;
				font-weight: 550;
				text-align: left;
				cursor: pointer;
			}

			.scpa-menu-item:hover {
				background: var(--scpa-action-soft);
			}

			.scpa-menu-empty {
				padding: 9px 10px;
				color: var(--scpa-muted);
				font-size: 12px;
			}

			.scpa-toggle-row {
				display: flex;
				align-items: center;
				gap: 9px;
				min-height: 28px;
				color: var(--scpa-text);
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
				width: 38px;
				height: 22px;
				border-radius: var(--scpa-radius-pill);
				background: var(--scpa-line);
				transition: background 0.16s ease;
			}

			.scpa-toggle-knob {
				position: absolute;
				top: 2px;
				left: 2px;
				width: 18px;
				height: 18px;
				border-radius: var(--scpa-radius-pill);
				background: var(--scpa-surface);
				box-shadow: 0 1px 2px rgba(24, 24, 24, 0.18);
				transition: transform 0.16s ease;
			}

			.scpa-toggle-input:checked + .scpa-toggle {
				background: var(--scpa-action);
			}

			.scpa-toggle-input:checked + .scpa-toggle .scpa-toggle-knob {
				transform: translateX(16px);
			}

			.scpa-toggle-text {
				font-weight: 550;
			}

			.scpa-divider {
				height: 1px;
				background: var(--scpa-line);
				margin: 4px 0;
			}

			.scpa-section-label {
				margin-bottom: -4px;
				color: var(--scpa-action);
				font-size: 11px;
				font-weight: 650;
				letter-spacing: 0;
				text-transform: uppercase;
			}

			.scpa-panel-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 6px;
				min-width: 80px;
				height: 40px;
				padding: 0 16px;
				border-radius: var(--scpa-radius-button);
				font-size: 13px;
				font-weight: 650;
				cursor: pointer;
				transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease;
			}

			.scpa-panel-btn:disabled {
				opacity: 0.55;
				cursor: not-allowed;
			}

			.scpa-secondary {
				border: 1px solid var(--scpa-line);
				background: var(--scpa-surface);
				color: var(--scpa-ink);
			}

			.scpa-secondary:hover {
				background: var(--scpa-action-soft);
				border-color: var(--scpa-action);
				color: var(--scpa-action);
				box-shadow: none;
			}

			.scpa-cancel {
				border: 1px solid rgba(122, 36, 26, 0.5);
				background: var(--scpa-surface);
				color: var(--scpa-danger);
			}

			.scpa-cancel:hover {
				background: var(--scpa-danger-soft);
				border-color: var(--scpa-danger);
				color: var(--scpa-danger);
				box-shadow: none;
			}

			.scpa-hold {
				border: 1px solid var(--scpa-c-amber-600);
				background: var(--scpa-c-amber-50);
				color: var(--scpa-c-amber-900);
			}

			.scpa-hold:hover {
				background: #f6e5bd;
				border-color: var(--scpa-c-amber-900);
				color: var(--scpa-c-amber-900);
				box-shadow: none;
			}

			.scpa-primary-blue {
				flex: 1;
				border: 1px solid var(--scpa-action);
				background: var(--scpa-action);
				color: var(--scpa-surface);
			}

			.scpa-primary-blue:hover {
				background: var(--scpa-action-hover);
				border-color: var(--scpa-action-hover);
				box-shadow: none;
			}

			.scpa-danger-outline {
				border-color: rgba(235, 108, 0, 0.45);
				color: var(--scpa-danger);
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
				padding: 14px;
				border: 1px solid var(--scpa-line);
				border-radius: var(--scpa-radius-card);
				background: var(--scpa-surface);
				box-shadow: var(--scpa-shadow-md);
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
				color: var(--scpa-muted);
			}

			.scpa-cache-detail strong {
				color: var(--scpa-ink);
				font-weight: 650;
				text-align: right;
			}

			.scpa-cache-pill {
				display: inline-flex;
				align-items: center;
				height: 20px;
				padding: 0 9px;
				border-radius: var(--scpa-radius-pill);
				font-size: 11px;
				font-weight: 650;
			}

			.scpa-cache-ready {
				background: var(--scpa-action-soft);
				color: var(--scpa-action);
			}

			.scpa-cache-expired {
				background: #fbe7e3;
				color: var(--scpa-danger);
			}

			.scpa-cache-empty {
				background: var(--scpa-canvas);
				color: var(--scpa-subtle);
			}

			.scpa-cache-count {
				color: var(--scpa-muted);
				font-size: 12px;
				font-weight: 550;
			}

			.scpa-status,
			.scpa-loading {
				padding: 9px 10px;
				border-radius: var(--scpa-radius-control);
				font-size: 12px;
				line-height: 1.4;
			}

			.scpa-status[hidden],
			.scpa-loading[hidden] {
				display: none;
			}

			.scpa-status-info {
				background: var(--scpa-action-soft);
				color: var(--scpa-action);
			}

			.scpa-status-success {
				background: var(--scpa-action-soft);
				color: var(--scpa-success);
			}

			.scpa-status-error {
				background: #fbe7e3;
				color: var(--scpa-danger);
			}

			.scpa-loading {
				display: flex;
				align-items: center;
				gap: 9px;
				background: var(--scpa-action-soft);
				color: var(--scpa-action);
				font-weight: 650;
			}

			.scpa-spinner {
				width: 16px;
				height: 16px;
				border: 2px solid rgba(50, 100, 120, 0.18);
				border-top-color: var(--scpa-action);
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
				body.scpa-panel-open {
					padding-right: 0 !important;
				}

				body.scpa-panel-open #pageContainer,
				body.scpa-panel-open #div__body {
					width: auto !important;
					max-width: none !important;
					margin-right: 0 !important;
				}

				#scpa-toolbar {
					flex-wrap: wrap;
					padding: 8px;
				}

				.scpa-toolbar-left {
					flex: 1 1 100%;
				}

				#scpa-panel-slot.scpa-open {
					width: min(var(--scpa-panel-width), 100vw);
					box-shadow: -8px 0 18px rgba(18, 18, 18, 0.1);
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
		applyNativeDetailsExpansion();
		maybeAutoOpenAssignPanel();
		log("Loaded simplified main form workflow.");
	}

	whenReady(init);
})();
