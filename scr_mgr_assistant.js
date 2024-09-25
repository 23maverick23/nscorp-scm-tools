// ==UserScript==
// @name         SCR Mgr Assistant Toolbar BETA
// @namespace    scrmgrassistant
// @copyright    Copyright © 2024 by Ryan Morrissey
// @version      3.3.1
// @description  Adds an Assistant Toolbar with interactive buttons to all SC Request forms.
// @icon         https://cdn0.iconfinder.com/data/icons/phosphor-bold-vol-3-1/256/lifebuoy-duotone-512.png
// @tag          productivity
// @tag          work
// @author       Ryan Morrissey (https://github.com/23maverick23)
// @match        https://nlcorp-sb2.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&e=T*
// @match        https://nlcorp-sb2.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&custparam_record_id=*
// @match        https://nlcorp.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&e=T*
// @match        https://nlcorp.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&custparam_record_id=*
// @icon         https://www.google.com/s2/favicons?domain=netsuite.com
// @require      https://code.jquery.com/jquery-3.6.0.js
// @require      https://cdn.jsdelivr.net/npm/fomantic-ui@2.9.3/dist/semantic.min.js
// @require      https://cdn.jsdelivr.net/gh/CoeJoder/waitForKeyElements.js@v1.3/waitForKeyElements.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @require      https://userscripts-mirror.org/scripts/source/107941.user.js
// @require      https://fomantic-ui.com/javascript/library/tablesort.js
// @resource     FOMANTIC_CSS https://cdn.jsdelivr.net/npm/fomantic-ui@2.9.3/dist/semantic.min.css
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://github.com/23maverick23/nscorp-scm-tools/raw/beta-3.0.0/scr_mgr_assistant.js
// @updateURL    https://github.com/23maverick23/nscorp-scm-tools/raw/beta-3.0.0/scr_mgr_assistant.js
// @supportURL   https://github.com/23maverick23/nscorp-scm-tools/issues
// ==/UserScript==

/* globals $, jQuery */
/* globals GM_config, GM_SuperValue, waitForKeyElements */
/* globals nlapiSearchRecord, nlapiGetFieldValue, nlapiSetFieldValue, nlapiGetFieldValues, nlapiSetFieldValues, nlapiGetUser, nlobjSearchFilter, nlobjSearchColumn, nlapiStringToDate */

/**
* +========================================================================+
* |                                                                        |
* |    ######   ##        #######  ########     ###    ##        ######    |
* |   ##    ##  ##       ##     ## ##     ##   ## ##   ##       ##    ##   |
* |   ##        ##       ##     ## ##     ##  ##   ##  ##       ##         |
* |   ##   #### ##       ##     ## ########  ##     ## ##        ######    |
* |   ##    ##  ##       ##     ## ##     ## ######### ##             ##   |
* |   ##    ##  ##       ##     ## ##     ## ##     ## ##       ##    ##   |
* |    ######   ########  #######  ########  ##     ## ########  ######    |
* |                                                                        |
* +========================================================================+
*/

const CACHE_DURATION_MS = 21600000; // duration in milliseconds, currently 6 hours
const SCRIPT_PREFIX     = 'BETA_';  // remove this later
const SCRIPT_ID         = `${SCRIPT_PREFIX}assistant_config`;
const SCRIPT_CACHE_ID   = `${SCRIPT_PREFIX}people_cache`;
const SCRIPT_VERSION    = GM_info.script.version;
const CONFIG_TITLE      = `${GM_info.script.name} (v${SCRIPT_VERSION})`;

/**
 * Simple wrapper for console logging
 * @return {object} console.log instance
 */
var shout = function() {
    var context = `${GM_info.script.name} >> `;
    return Function.prototype.bind.call(console.log, console, context);
}();

// Script code
(function() {
    'use strict';

    var $ = jQuery.noConflict(true);

    /**
    * +==================================================================================+
    * |                                                                                  |
    * |    ######   ##     ##       ######   #######  ##    ## ######## ####  ######     |
    * |   ##    ##  ###   ###      ##    ## ##     ## ###   ## ##        ##  ##    ##    |
    * |   ##        #### ####      ##       ##     ## ####  ## ##        ##  ##          |
    * |   ##   #### ## ### ##      ##       ##     ## ## ## ## ######    ##  ##   ####   |
    * |   ##    ##  ##     ##      ##       ##     ## ##  #### ##        ##  ##    ##    |
    * |   ##    ##  ##     ##      ##    ## ##     ## ##   ### ##        ##  ##    ##    |
    * |    ######   ##     ##       ######   #######  ##    ## ##       ####  ######     |
    * |                                                                                  |
    * +==================================================================================+
    */

    // Init the GM settings page
    const configFieldDefs = {
        'theme': {
            'label': 'Theme',
            'type': 'select',
            'options': ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'],
            'default': 'red',
            'section': ['Appearance', 'Change how the assistant bar looks.']
        },
        'showGB': {
            'label': 'Show General Business cross-vertical button',
            'type': 'checkbox',
            'default': true,
            'section': ['Buttons', 'Enable/disable specific buttons in the assistant bar.']
        },
        'showPR': {
            'label': 'Show Products cross-vertical button',
            'type': 'checkbox',
            'default': true
        },
        'showHT': {
            'label': 'Show High Tech / Tiger cross-vertical button',
            'type': 'checkbox',
            'default': true
        },
        'showEPM': {
            'label': 'Show EPM cross-vertical button',
            'type': 'checkbox',
            'default': true
        },
        'showCancel': {
            'label': 'Show Cancel button',
            'type': 'checkbox',
            'default': true
        },
        'showHold': {
            'label': 'Show On Hold button',
            'type': 'checkbox',
            'default': true
        },
        'filterMe': {
            'label': 'Filter "Assigned To" using: SC Manager = Me',
            'type': 'checkbox',
            'default': true,
            'section': ['Filters', 'Set filters for the Assign To field (filters are additive).']
        },
        'filterVertical': {
            'label': 'Filter "Assigned To" using: SC Vertical = My Vertical',
            'type': 'checkbox',
            'default': true
        },
        'filterTier': {
            'label': 'Filter "Assigned To" using: SC Tier = My Tier',
            'type': 'checkbox',
            'default': false
        },
        'filterDirector': {
            'label': 'Filter "Assigned To" using: SC Director = <name|none>',
            'type': 'select',
            'options': ['', 'jeff', 'karl', 'rebecca', 'robyn', 'lauren'],
            'default': ''
        },
        'initials': {
            'label': 'Name/Initials for text comments',
            'type': 'text',
            'size': 50,
            'title': 'Put your text into square brackets [] !',
            'default': '[SC Mgr]',
            'section': ['Personalization', 'Personalize text comments with your name or initials in brackets.']
        },
        'hashtags': {
            'label': 'Customize Hashtags (comma separated list: apples,bananas,carrots)',
            'type': 'textarea',
            'default': 'apples,bananas,carrots'
        },
        'showDebug': {
            'label': 'Show Debug button in assistant bar',
            'type': 'checkbox',
            'default': false,
            'section': ['Experimental Settings', 'Only change these if you know what you\'re doing.']
        },
        'includeBodyOfWork': {
            'label': 'Include SC Body of Work lookup',
            'type': 'checkbox',
            'default': false
        },
        'includeAvailability': {
            'label': 'Include SC engagement workload data in dropdown',
            'type': 'checkbox',
            'default': false
        },
        'sortAvailabilityBy': {
            'label': 'Sort "Assigned To" dropdown by: ',
            'type': 'select',
            'options': ['SC Name', '30 day load', 'In Play'],
            'default': 'SC Name'
        },
        'sortAvailabilityDirection': {
            'label': '"Assigned To" dropdown sort direction: ',
            'type': 'select',
            'options': ['Asc', 'Desc'],
            'default': 'Asc'
        },
        'cacheRefreshDelay': {
            'label': 'Refresh SC availability (and workload) data every N hour(s)',
            'type': 'select',
            'options': ['1', '2', '3', '4', '6'],
            'default': '6'
        },
        'cacheDateTime': {
            'label': 'Date/time of last cache refresh',
            'type': 'text',
            'size': 50,
            'title': 'This is for information purposes only.',
            'default': '',
            'save': false
        },
        'forceRefreshCache': {
            'label': 'Force cache refresh',
            'type': 'checkbox',
            'save': false,
            'default': false
        }
    };

    let modalSettingForm = document.createElement('form');
    modalSettingForm.setAttribute('id', 'scr-modal-settings-form');
    modalSettingForm.setAttribute('class', 'ui overlay fullscreen form modal');
    document.body.appendChild(modalSettingForm);

    let frame = document.createElement('div');
    frame.setAttribute('class', 'scrolling content');
    document.getElementById('scr-modal-settings-form').appendChild(frame);

    GM_registerMenuCommand(`${GM_info.script.name} Settings`, () => {
        openConfig();
    });

    let gmc = new GM_config(
        {
            'id': `${SCRIPT_ID}`,
            'title': `${GM_info.script.name} ${GM_info.script.version}`,
            'fields': configFieldDefs,
            'frame': frame,
            'events': {
                'init': init,
                'save': function(values) {
                    if (values.forceRefreshCache) {
                        GM_SuperValue.set(`${SCRIPT_CACHE_ID}`, null);
                        GM_SuperValue.set(`${SCRIPT_CACHE_ID}_ts`, null);
                    }

                    if (confirm(`${GM_info.script.name} >> The page will now refresh for changes to take effect.`)) { location.reload(); }
                    GM_config.close();
                },
                'close': onClose
            }
        }
    );

    function openSettingsModal() {
        // opens staffing modal form
        $('#scr-modal-settings-form')
            .modal({
                inverted: true,
                closable: false
            })
            .modal('setting', 'transition', 'scale')
            .modal('show')
        ;

        /**
         * These are just "quality of life" improvements to remove and restyle the settings panel
         * from the gm_config script. There isn't a nicer way to remove and reset all the classnames
         * to follow fomantic naming, so we will live with this mess for now...
         */

        $(`#${SCRIPT_ID}`).attr('style', ''); // remove default form styling
        $(`#${SCRIPT_ID}_header`).attr('class', 'ui center aligned large header'); // remove default header styling
        $(`#${SCRIPT_ID} .section_header.center`).attr('class', 'ui header'); // remove default section header styling
        $(`#${SCRIPT_ID} .section_desc.center`).attr('class', 'grey sub header'); // remove default section subheader styling
        $(`[id^=${SCRIPT_ID}_section_desc]`).each(function() {
            $(this).siblings("[id^=assistant_config_section_header]").append(this);
        });
        $(`#${SCRIPT_ID} .section_header_holder`).attr('class', 'ui segment'); // remove default section styling
        $(`#${SCRIPT_ID} label`).attr('class', ''); // remove default label styling
        $(`#${SCRIPT_ID} select`)
            .attr('class', 'ui fluid selection dropdown') // remove default class for select
            .parent().closest('div')
            .attr('class', 'inline field') // remove default class for select
        ;
        $(`#${SCRIPT_ID} select`).dropdown({clearable: true}); // convert select to fancy
        $(`#${SCRIPT_ID} input:checkbox`)
            .attr('class', 'hidden') // remove default class for checkbox
            .parent().closest('div')
            .attr('class', 'ui toggle checkbox') // remove default class for checkbox
            .wrap('<div class="inline field"></div>')
        ;
        $(`#${SCRIPT_ID} input:radio`)
            .attr('class', 'hidden')
        ;
        $(`#${SCRIPT_ID} input:radio+label`).each(function() {
            $(this).prev().addBack().wrapAll('<div class="ui radio checkbox" />');
        });
        $(`.ui.radio.checkbox`)
            .parent().closest('div')
            .attr('class', 'field')
            .parent().closest('div')
            .attr('class', 'inline fields')
        ;
        $(`#${SCRIPT_ID} input:checkbox`).parent().closest('div').checkbox(); // convert checkbox to fancy
        $(`#${SCRIPT_ID}_saveBtn`).attr('class', 'ui green button'); // remove default class for buttons
        $(`#${SCRIPT_ID}_closeBtn`).attr('class', 'ui black button').html('Dismiss'); // remove default class for buttons
        $(`#${SCRIPT_ID}_cacheDateTime_var`).attr('class', 'disabled field'); // make field disabled
        $(`#${SCRIPT_ID}_field_cacheDateTime`).attr('readonly', ''); // make cache date/time field read-only

    }

    function closeSettingsModal() {
        $('#scr-modal-settings-form').modal('hide');
    }

    function openConfig() {
        gmc.open();
        openSettingsModal();
    }

    function onClose() {
        // gmc.close();
        closeSettingsModal();
    }

    // Helper for whenPageReady function
    const PAGE_READY = {
        timeout: true,
        startTimer: null,
    };

    // Executes the callback after the page finishes loading
    // Using a MutationObserver, a timout is set every time a new mutation happens,
    // if either the elapsed time bewteen mutations is greater than intervalTime or
    // the full elapsed time is greater than maxWaitTime the callback is executed
    function whenPageReady(callback, intervalTime, maxWaitTime = 3000) {
        PAGE_READY.startTimer = Date.now();
        shout('Waiting for page to load');

        const observerCallback = (mutationList, observer) => {
            if (PAGE_READY.timeout) {
                clearTimeout(PAGE_READY.timeout);
                if ((Date.now() - PAGE_READY.startTimer) > maxWaitTime) {
                    shout('Max wait time exceded, loading script anyway!');
                    clearTimeout(PAGE_READY.timeout);
                    PAGE_READY.timeout = null;
                    observer.disconnect();
                    callback();
                } else {
                    PAGE_READY.timeout = setTimeout(() => {
                        shout(`Page ready in ${Date.now() - PAGE_READY.startTimer}ms!`);
                        clearTimeout(PAGE_READY.timeout);
                        PAGE_READY.timeout = null;
                        observer.disconnect();
                        callback();
                    }, intervalTime);
                }
            } else {
                observer.disconnect();
            }
        };
        const observer = new MutationObserver(observerCallback);
        observer.observe(document.documentElement, {attributes: true, childList: true, subtree: true});
    }

    /**
    * +=================================+
    * |                                 |
    * |   #### ##    ## #### ########   |
    * |    ##  ###   ##  ##     ##      |
    * |    ##  ####  ##  ##     ##      |
    * |    ##  ## ## ##  ##     ##      |
    * |    ##  ##  ####  ##     ##      |
    * |    ##  ##   ###  ##     ##      |
    * |   #### ##    ## ####    ##      |
    * |                                 |
    * +=================================+
    */

    function init() {

        whenPageReady(() => {

            buildToolbarAndForms();

        }, 250);

    }

    /**
    * +=======================================+
    * |                                       |
    * |   ##     ##    ###    #### ##    ##   |
    * |   ###   ###   ## ##    ##  ###   ##   |
    * |   #### ####  ##   ##   ##  ####  ##   |
    * |   ## ### ## ##     ##  ##  ## ## ##   |
    * |   ##     ## #########  ##  ##  ####   |
    * |   ##     ## ##     ##  ##  ##   ###   |
    * |   ##     ## ##     ## #### ##    ##   |
    * |                                       |
    * +=======================================+
    */

    function buildToolbarAndForms() {

        var cacheTime = GM_SuperValue.get(`${SCRIPT_CACHE_ID}_ts`, null);

        if (cacheTime) {
            var cacheDate = new Date(cacheTime);
            gmc.set('cacheDateTime', cacheDate);
            shout('Cache date/time = ' + cacheDate.toString());
        }

        // DEBUGGING
        // waitForKeyElements("#scr-modal-request-form", (element) => {
        //     doReloadForm();
        // });

        var fomantic_css = GM_getResourceText("FOMANTIC_CSS");
        // GM_addStyle(fomantic_css);

        // custom CSS overrides
        GM_addStyle(/* syntax: css */ `.ui.dimmer { background-color:rgba(0,0,0,.85) !important; }`);
        GM_addStyle(/* syntax: css */ `.ui.dropdown > .text > .description, .ui.dropdown .menu > .item > .description {color:rgba(0,0,0,0.7) !important};`);
        GM_addStyle(/* syntax: css */ `#solutionconsultant span.text {font-size:10pt !important;}`);
        GM_addStyle(/* syntax: css */ `#solutionconsultant span.description {font-size:8pt !important;}`);
        GM_addStyle(/* syntax: css */ `.selection.dropdown .text.default {font-size:1em !important;}`);
        GM_addStyle(/* syntax: css */ `#sc-mgr-assistant {margin-bottom: 20px;}`);

        class Person {
            constructor(id, first, last, location, status, notes, restricted, weight, inplay) {
                this._id         = id;
                this._first      = first;
                this._last       = last;
                this._location   = location;
                this._status     = status;
                this._notes      = notes;
                this._restricted = restricted;
                this._weight     = weight || 0;
                this._inplay     = inplay || 0;
            }

            get id() {
                return this._id;
            }

            set id(value) {
                this._id = value;
            }

            get first() {
                return this._first;
            }

            set first(value) {
                this._first = value
            }

            get last() {
                return this._last;
            }

            set last(value) {
                this._last = value;
            }

            get location() {
                return this._location;
            }

            set location(value) {
                this._location = value;
            }

            get status() {
                return this._status;
            }

            set status(value) {
                this._status = value;
            }

            get notes() {
                return this._notes;
            }

            set notes(value) {
                this._notes = value;
            }

            get restricted() {
                return this._restricted;
            }

            set restricted(value) {
                this._restricted = value;
            }

            get weight() {
                return this._weight;
            }

            set weight(value) {
                this._weight = value;
            }

            get inplay() {
                return this._inplay;
            }

            set inplay(value) {
                this._inplay = value;
            }

            _fullname() {
                return `${this.first} ${this.last}`;
            }

            get fullname() {
                return this._fullname();
            }

            _shortLocation() {
                const regex = /(^\w+-\w+)/;
                var locArray = this.location.split(regex);
                if (!locArray || locArray.length == 1) { return ""; }
                return locArray[1];
            }

            get shortLocation() {
                return this._shortLocation();
            }

            _colorToEmoji(status) {
                let emoji;

                switch (status) {
                    case 'Red':
                        emoji = '🔴';
                        break;
                    case 'Yellow':
                        emoji = '🟡';
                        break;
                    case 'Green':
                        emoji = '🟢';
                        break;
                    default:
                        emoji = '❓';
                        break;
                }

                return emoji;
            }

            /* Getters for buliding dropdown content */

            get name() {
                return `${this.fullname} (based in ${this.shortLocation})`;
            }

            get statusColor() {
                return this._colorToEmoji(this.status);
            }

            get value() {
                return this.id;
            }

            get description() {
                let template = `
                    <div class="list">
                        <div class="item">
                            ${
                                (settings.includeAvailability) ?
                                `<div class="right floated content">
                                    <div class="header" style="font-weight:bold;text-align:right;">${this.weight}</div>
                                    <div class="description" style="text-align:right;">${this.inplay} in play</div>
                                </div>` : ''
                            }
                            <div class="content">
                                <div class="header" style="font-weight:bold;">${this.statusColor} ${this.notes}</div>
                                <div class="description" style="font-style:italic;color:#db2828 !important;">${this.restricted}</div>
                            </div>
                        </div>
                    </div>
                    `
                ;
                return template;
            }
        }

        /**
        * +==========================================================================+
        * |                                                                          |
        * |    ######  ######## ######## ######## #### ##    ##  ######    ######    |
        * |   ##    ## ##          ##       ##     ##  ###   ## ##    ##  ##    ##   |
        * |   ##       ##          ##       ##     ##  ####  ## ##        ##         |
        * |    ######  ######      ##       ##     ##  ## ## ## ##   ####  ######    |
        * |         ## ##          ##       ##     ##  ##  #### ##    ##        ##   |
        * |   ##    ## ##          ##       ##     ##  ##   ### ##    ##  ##    ##   |
        * |    ######  ########    ##       ##    #### ##    ##  ######    ######    |
        * |                                                                          |
        * +==========================================================================+
        */

        const settings = {
            theme                     : gmc.get('theme'),
            showGB                    : gmc.get('showGB'),
            showPR                    : gmc.get('showPR'),
            showHT                    : gmc.get('showHT'),
            showEPM                   : gmc.get('showEPM'),
            showCancel                : gmc.get('showCancel'),
            showHold                  : gmc.get('showHold'),
            filterMe                  : gmc.get('filterMe'),
            filterVertical            : gmc.get('filterVertical'),
            filterTier                : gmc.get('filterTier'),
            filterDirector            : gmc.get('filterDirector'),
            initials                  : gmc.get('initials'),
            showDebug                 : gmc.get('showDebug'),
            includeAvailability       : gmc.get('includeAvailability'),
            sortAvailabilityBy        : gmc.get('sortAvailabilityBy'),
            sortAvailabilityDirection : gmc.get('sortAvailabilityDirection'),
            includeBodyOfWork         : gmc.get('includeBodyOfWork'),
            cacheRefreshDelay         : gmc.get('cacheRefreshDelay'),
            forceRefreshCache         : gmc.get('forceRefreshCache'),
            cacheDateTime             : gmc.get('cacheDateTime'),
            hashtags                  : gmc.get('hashtags')
        };

        shout(settings);

        /**
        * +=========================================================================================+
        * |                                                                                         |
        * |   ######## ######## ##     ## ########  ##          ###    ######## ########  ######    |
        * |      ##    ##       ###   ### ##     ## ##         ## ##      ##    ##       ##    ##   |
        * |      ##    ##       #### #### ##     ## ##        ##   ##     ##    ##       ##         |
        * |      ##    ######   ## ### ## ########  ##       ##     ##    ##    ######    ######    |
        * |      ##    ##       ##     ## ##        ##       #########    ##    ##             ##   |
        * |      ##    ##       ##     ## ##        ##       ##     ##    ##    ##       ##    ##   |
        * |      ##    ######## ##     ## ##        ######## ##     ##    ##    ########  ######    |
        * |                                                                                         |
        * +=========================================================================================+
        */

       // Set UI settings
        GM_addStyle(/* syntax: css */ `
            :root {
                --menu-color-red    : #C6463330; /* #db282830; */
                --menu-color-orange : #AD562B30; /* #f5a97f45; */
                --menu-color-yellow : #E2BF6B30; /* #eed49f70; */
                --menu-color-green  : #85B49730; /* #21ba4530; */
                --menu-color-blue   : #558DA230; /* #54c8ff30; */
                --menu-color-purple : #60698830; /* #673ab730; */
                --menu-color-pink   : #FB867530; /* #f5bde670; */

                --btn-color-red    : hsl(8, 59%, 49%); /* #C74634; */
                --btn-color-orange : hsl(20, 60%, 42%); /* #D39E5C; */
                --btn-color-yellow : hsl(42, 67%, 65%); /* #E2C06B; */
                --btn-color-green  : hsl(143, 24%, 61%); /* #86B596; */
                --btn-color-teal   : var(--btn-color-purple); /* hsl(176, 33%, 38%); */
                --btn-color-blue   : hsl(196, 31%, 48%); /* #81B2C3; */
                --btn-color-purple : hsl(227, 17%, 45%); /* #606988; */
                --btn-color-pink   : hsl(8, 94%, 72%); /* #FB8675; */
                --btn-color-black  : hsl(199, 40%, 35%); /* #36677D; */

                --btn-hover-color-red    : hsl(8, 59%, 30%);
                --btn-hover-color-orange : hsl(20, 60%, 30%);
                --btn-hover-color-yellow : hsl(42, 67%, 50%);
                --btn-hover-color-green  : hsl(143, 24%, 45%);
                --btn-hover-color-teal   : var(--btn-hover-color-purple) ; /* hsl(176, 33%, 20%); */
                --btn-hover-color-blue   : hsl(196, 31%, 30%);
                --btn-hover-color-purple : hsl(227, 17%, 35%);
                --btn-hover-color-pink   : hsl(8, 94%, 60%);
                --btn-hover-color-black  : hsl(199, 40%, 25%);
            }
            .ui.menu {
                box-shadow:0 1px 2px 0 rgba(34, 36, 38, 0.15) !important;
                background-color: var(--menu-color-${settings.theme}) !important;
                border-radius: 0 !important;
            }

            .ui.toggle.checkbox input:checked ~ label::before {
                background-color: var(--btn-color-blue) !important;
            }

            .ui a {
                color: var(--nsn-uif-redwood-color-light-text-link) !important;
                fill: var(--nsn-uif-redwood-color-light-text-link) !important;
            }
            .ui a:hover {
                text-decoration: underline !important;
                color: var(--nsn-uif-redwood-color-light-text-link) !important;
                fill: var(--nsn-uif-redwood-color-light-text-link) !important;
            }

            .ui.red.button {
                background-color: var(--btn-color-red) !important;
                color: #fff !important;
            }
            .ui.red.button:hover {
                background-color: var(--btn-hover-color-red) !important;
            }
            .ui.orange.button {
                background-color: var(--btn-color-orange) !important;
                color: #fff !important;
            }
            .ui.orange.button:hover {
                background-color: var(--btn-hover-color-orange) !important;
            }
            .ui.yellow.button {
                background-color: var(--btn-color-yellow) !important;
                color: #fff !important;
            }
            .ui.yellow.button:hover {
                background-color: var(--btn-hover-color-yellow) !important;
            }
            .ui.green.button {
                background-color: var(--btn-color-green) !important;
                color: #fff !important;
            }
            .ui.green.button:hover {
                background-color: var(--btn-hover-color-green) !important;
            }
            .ui.teal.button {
                background-color: var(--btn-color-teal) !important;
                color: #fff !important;
            }
            .ui.teal.button:hover {
                background-color: var(--btn-hover-color-teal) !important;
            }
            .ui.blue.button,
            .ui.primary.button {
                background-color: var(--btn-color-blue) !important;
                color: #fff !important;
            }
            .ui.blue.button:hover,
            .ui.primary.button:hover {
                background-color: var(--btn-hover-color-blue) !important;
            }
            .ui.purple.button {
                background-color: var(--btn-color-purple) !important;
                color: #fff !important;
            }
            .ui.purple.button:hover {
                background-color: var(--btn-hover-color-purple) !important;
            }
            .ui.pink.button {
                background-color: var(--btn-color-pink) !important;
                color: #fff !important;
            }
            .ui.pink.button:hover {
                background-color: var(--btn-hover-color-pink) !important;
            }
            .ui.black.button {
                background-color: var(--btn-color-black) !important;
                color: #fff !important;
            }
            .ui.black.button:hover {
                background-color: var(--btn-hover-color-black) !important;
            }

            .orange.icon {
                color: var(--btn-color-orange) !important;
            }
            .blue.icon {
                color: var(--btn-color-blue) !important;
            }
            .green.icon {
                color: var(--btn-color-green) !important;
            }
            .teal.icon {
                color: var(--btn-color-teal) !important;
            }
            .yellow.icon {
                color: var(--btn-color-yellow) !important;
            }
            .red.icon {
                color: var(--btn-color-red) !important;
            }
            .black.icon {
                color: var(--btn-color-black) !important;
            }
        `);

        var btnMenuProducts = /* syntax: html */ `
            <div class="item">
                <div class="ui tiny buttons">
                    <button class="ui orange button" id="_xvertprodwest">PR West</button>
                    <div class="or"></div>
                    <button class="ui orange button" id="_xvertprodeast">PR East</button>
                </div>
            </div>
            `
        ;

        var btnMenuGB = /* syntax: html */ `
            <div class="item">
                <div class="ui tiny buttons">
                    <button class="ui blue button" id="_xvertgbwest">GB West</button>
                    <div class="or"></div>
                    <button class="ui blue button" id="_xvertgbeast">GB East</button>
                </div>
            </div>
            `
        ;

        var btnMenuHT = /* syntax: html */ `
            <div class="item">
                <div class="ui tiny buttons">
                    <button class="ui green button" id="_xvertht">High Tech</button>
                </div>
            </div>
            `
        ;

        var btnMenuEPM = /* syntax: html */ `
            <div class="item">
                <div class="ui tiny buttons">
                    <button class="ui teal button" id="_xvertepm">EPM</button>
                </div>
            </div>
            `
        ;

        var btnMenuHold = /* syntax: html */ `
            <button class="ui tiny yellow icon button" id="_onhold" data-tooltip="Place SCR on hold" data-position="bottom right">
                <i class="hand paper icon"></i>
            </button>
            `
        ;

        var btnMenuCancel = /* syntax: html */ `
            <button class="ui tiny red icon button" id="_cancelled" data-tooltip="Mark SCR cancelled" data-position="bottom right">
                <i class="times circle icon"></i>
            </button>
            `
        ;

        var btnMenuDebug = /* syntax: html */ `
            <button class="ui tiny gray icon button" id="_debug" data-tooltip="Open script interface" data-position="bottom right">
                <i class="bug icon"></i>
            </button>
            `
        ;

        var legendTemplatePR = /* syntax: html */ `
            <div class='item'>
                <i class='orange stop icon'></i>
                <div class='content'>
                    <div class='header'>Products West</div>
                    <div class='description'>assigned to robyn</div>
                </div>
            </div>
            <div class='item'>
                <i class='orange stop icon'></i>
                <div class='content'>
                    <div class='header'>Products East</div>
                    <div class='description'>assigned to lauren</div>
                </div>
            </div>
            `
        ;
        var legendTemplateGB = /* syntax: html */ `
            <div class='item'>
                <i class='blue stop icon'></i>
                <div class='content'>
                    <div class='header'>General Business West</div>
                    <div class='description'>assigned to rebecca</div>
                </div>
            </div>
            <div class='item'>
                <i class='blue stop icon'></i>
                <div class='content'>
                    <div class='header'>General Business East</div>
                    <div class='description'>assigned to karl</div>
                </div>
            </div>
            `
        ;
        var legendTemplateHT = /* syntax: html */ `
            <div class='item'>
                <i class='green stop icon'></i>
                <div class='content'>
                    <div class='header'>High Tech, Tiger</div>
                    <div class='description'>assigned to jeff</div>
                </div>
            </div>
            `
        ;
        var legendTemplateEPM = /* syntax: html */ `
            <div class='item'>
                <i class='teal stop icon'></i>
                <div class='content'>
                    <div class='header'>EPM</div><div
                    class='description'>assigned to jason</div>
                </div>
            </div>
            `
        ;
        var legendTemplateEMG = /* syntax: html */ `
            <div class='item'>
                <i class='grey hashtag icon'></i>
                <div class='content'>
                    <div class='description'>for Emerging queue, add #emg to hashtags</div>
                </div>
            </div>
            `
        ;

        var legendBtnTemplate = /* syntax: html */ `
            <div class='header'>Toolbar Legend</div>
            <div class='content'>
                <div class='ui small list'>
                    ${
                        (settings.showPR === true) ? `${legendTemplatePR}` : ""
                    }
                    ${
                        (settings.showGB === true) ? `${legendTemplateGB}` : ""
                    }
                    ${
                        (settings.showHT === true) ? `${legendTemplateHT}` : ""
                    }
                    ${
                        (settings.showEPM === true) ? `${legendTemplateEPM}` : ""
                    }
                </div>

                <div class='ui divider'></div>

                <div class='ui small list'>
                    ${legendTemplateEMG}
                </div>

                <div class='ui divider'></div>

                <div class='ui small list'>
                    <div class='item'>
                        <i class='yellow stop icon'></i>
                        <div class='content'>
                            <div class='header'>On Hold</div>
                            <div class='description'>assign to myself, status on hold</div>
                        </div>
                    </div>
                    <div class='item'>
                        <i class='red stop icon'></i>
                        <div class='content'>
                            <div class='header'>Cancel Request</div>
                            <div class='description'>both statuses cancelled, lead is false</div>
                        </div>
                    </div>
                    <div class='item'>
                        <i class='black stop icon'></i>
                        <div class='content'>
                            <div class='header'>Settings</div>
                            <div class='description'>change toolbar preferences</div>
                        </div>
                    </div>
                </div>
            </div>
            `
        ;

        var btnMenu = /* syntax: html */ `
            <!-- SC Mgr Assistant -->
            <div class="ui menu" id="sc-mgr-assistant">
                <div class="header item">
                    <i class="big colored ${settings.theme} life ring icon"></i>
                    ${
                        (SCRIPT_PREFIX.length > 0) ? '<div class="floating ui black label">BETA</div>' : ''
                    }
                    Assistant (v${SCRIPT_VERSION})
                </div>
                ${
                    (settings.showPR === true) ? `${btnMenuProducts}` : ""
                }
                ${
                    (settings.showGB === true) ? `${btnMenuGB}` : ""
                }
                ${
                    (settings.showHT === true) ? `${btnMenuHT}` : ""
                }
                ${
                    (settings.showEPM === true) ? `${btnMenuEPM}` : ""
                }
                <div class="item">
                    <button class="ui tiny pink labeled icon button" id="_staffmyteam" data-tooltip="Open quick assign form" data-position="bottom right">
                        <i class="users cog icon"></i>
                        Quick Assign
                    </button>
                </div>
                <div class="item">
                    <button class="ui tiny grey icon button" id="_legend" data-variation="small wide" data-position="right center" data-html="${legendBtnTemplate}">
                        <i class="question icon"></i>
                    </button>
                </div>
                <div class="right menu">
                    <div class="item">
                        <div class="ui icon buttons">
                            ${
                                (settings.showHold === true) ? `${btnMenuHold}` : ""
                            }

                            ${
                                (settings.showCancel === true) ? `${btnMenuCancel}` : ""
                            }
                        </div>
                    </div>

                    <div class="item">
                        <div class="ui icon buttons">
                            ${
                                (settings.showDebug === true) ? `${btnMenuDebug}` : ""
                            }

                            <button class="ui tiny black icon button" id="_settings" data-tooltip="Open settings form" data-position="bottom right">
                                <i class="cog circle icon"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            `
        ;

        function fldIndustryHTml(id, width) {
            return /* syntax: html */  `
                <div class="${(width) ? width : 'sixteen'} wide required field">
                    <label>SC Industry</label>
                    <div class="ui fluid search selection dropdown" id="${id}">
                        <input type="hidden" name="${id}">
                        <div class="default text">Provide an SC Industry</div>
                        <i class="dropdown icon"></i>
                        <div class="menu">
                            <div class="header">Agriculture</div>
                            <div class="item" data-value="9">Agriculture (Agriculture)</div>
                            <div class="header">Business Services</div>
                            <div class="item" data-value="1">Advertising & Marketing (Business Services)</div>
                            <div class="item" data-value="8">Business Services (Business Services)</div>
                            <div class="item" data-value="4">Commercial Printing (Business Services)</div>
                            <div class="item" data-value="3">Custom Software & IT Services (IT VAR) (Business Services)</div>
                            <div class="item" data-value="2">HR & Staffing (Business Services)</div>
                            <div class="item" data-value="6">Research & Development (Business Services)</div>
                            <div class="header">Construction</div>
                            <div class="item" data-value="10">Architecture, Engineering & Design (Construction)</div>
                            <div class="item" data-value="7">Construction (Construction)</div>
                            <div class="item" data-value="5">Consumer Services (Consumer Services)</div>
                            <div class="header">Education</div>
                            <div class="item" data-value="11">Campus Bookstores (Education)</div>
                            <div class="item" data-value="12">Education (Education)</div>
                            <div class="header">Energy, Utilities & Waste</div>
                            <div class="item" data-value="16">Energy, Utilities & Waste (Energy, Utilities & Waste)</div>
                            <div class="header">Finance</div>
                            <div class="item" data-value="17">Cryptocurrency (Finance)</div>
                            <div class="item" data-value="13">Finance (Finance)</div>
                            <div class="item" data-value="14">Lending & Brokerage (Finance)</div>
                            <div class="item" data-value="15">Venture Capital & Private Equity (Finance)</div>
                            <div class="header">Government</div>
                            <div class="item" data-value="20">Government: Federal (Government)</div>
                            <div class="item" data-value="18">Government: State/Local (Government)</div>
                            <div class="header">Healthcare Services</div>
                            <div class="item" data-value="19">Elderly Care Services (Healthcare Services)</div>
                            <div class="item" data-value="21">Federally Qualified Healthcare (FQHC) (Healthcare Services)</div>
                            <div class="item" data-value="22">Healthcare Services (Healthcare Services)</div>
                            <div class="item" data-value="101">Life Sciences and Biotech (Healthcare Services)</div>
                            <div class="item" data-value="24">Medical Laboratories & Imaging Centers (Healthcare Services)</div>
                            <div class="item" data-value="23">Veterinary Services (Healthcare Services)</div>
                            <div class="header">Holding Companies & Conglomerates</div>
                            <div class="item" data-value="25">Holding Companies & Conglomerates (Holding Companies & Conglomerates)</div>
                            <div class="header">Hospitality</div>
                            <div class="item" data-value="27">Cultural & Informational Centers (Hospitality)</div>
                            <div class="item" data-value="29">Gambling & Gaming (Hospitality)</div>
                            <div class="item" data-value="26">Hospitality (Hospitality)</div>
                            <div class="item" data-value="30">Lodging & Resorts (Hospitality)</div>
                            <div class="item" data-value="28">Museums & Art Galleries (Hospitality)</div>
                            <div class="item" data-value="39">Performing Arts Theaters (Hospitality)</div>
                            <div class="item" data-value="31">Restaurants (Hospitality)</div>
                            <div class="item" data-value="32">Sports Teams & Leagues (Hospitality)</div>
                            <div class="header">Hospitals & Physicians Clinics</div>
                            <div class="item" data-value="34">Dental Offices (Hospitals & Physicians Clinics)</div>
                            <div class="item" data-value="33">Hospitals & Physicians Clinics (Hospitals & Physicians Clinics)</div>
                            <div class="item" data-value="35">Physicians Clinics (Hospitals & Physicians Clinics)</div>
                            <div class="header">Insurance</div>
                            <div class="item" data-value="36">Insurance (Insurance)</div>
                            <div class="header">Law Firms & Legal Services</div>
                            <div class="item" data-value="37">Law Firms & Legal Services (Law Firms & Legal Services)</div>
                            <div class="header">Manufacturing</div>
                            <div class="item" data-value="40">Aerospace & Defense (Manufacturing)</div>
                            <div class="item" data-value="41">Food & Beverage (Manufacturing)</div>
                            <div class="item" data-value="42">Industrial Machinery & Equipment (Manufacturing)</div>
                            <div class="item" data-value="43">Job Shop (Manufacturing)</div>
                            <div class="item" data-value="44">Life Sciences and Biotech (Manufacturing)</div>
                            <div class="item" data-value="38">Manufacturing (Manufacturing)</div>
                            <div class="item" data-value="45">Medical Devices & Equipment (Manufacturing)</div>
                            <div class="item" data-value="46">Pharmaceuticals (Manufacturing)</div>
                            <div class="item" data-value="47">Textiles & Apparel (Manufacturing)</div>
                            <div class="item" data-value="48">Wholesale (Manufacturing)</div>
                            <div class="header">Media & Internet</div>
                            <div class="item" data-value="50">Broadcasting (Media & Internet)</div>
                            <div class="item" data-value="49">Media & Internet (Media & Internet)</div>
                            <div class="item" data-value="52">Motion Picture and Sound Recording (Media & Internet)</div>
                            <div class="item" data-value="51">Promotional Products (Media & Internet)</div>
                            <div class="item" data-value="53">Publishing (Media & Internet)</div>
                            <div class="header">Minerals & Mining</div>
                            <div class="item" data-value="54">Minerals & Mining (Minerals & Mining)</div>
                            <div class="header">Organizations</div>
                            <div class="item" data-value="56">Food Pantry, Food Share, Food Bank (Organizations)</div>
                            <div class="item" data-value="57">Non-Profit Organizations & Charitable Foundations (Organizations)</div>
                            <div class="item" data-value="55">Organizations (Organizations)</div>
                            <div class="item" data-value="58">Religious Organizations (Organizations)</div>
                            <div class="header">Real Estate</div>
                            <div class="item" data-value="59">Real Estate (Real Estate)</div>
                            <div class="header">Retail</div>
                            <div class="item" data-value="61">Apparel & Accessories Retail (Retail)</div>
                            <div class="item" data-value="62">Automobile Deals (Retail)</div>
                            <div class="item" data-value="63">Automobile Part Stores (Retail)</div>
                            <div class="item" data-value="64">Convenience Stores, Gas Stations & Liquor Stores (Retail)</div>
                            <div class="item" data-value="65">Drug Stores & Pharmacies (Retail)</div>
                            <div class="item" data-value="66">Franchise (Retail)</div>
                            <div class="item" data-value="67">Grocery Retail (Retail)</div>
                            <div class="item" data-value="68">Home Improvement & Hardware Retail (Retail)</div>
                            <div class="item" data-value="60">Retail (Retail)</div>
                            <div class="item" data-value="69">Vitamins Supplements & Health Stores (Retail)</div>
                            <div class="item" data-value="70">Wholesale (Retail)</div>
                            <div class="header">Software</div>
                            <div class="item" data-value="72">Cryptocurrency (Software)</div>
                            <div class="item" data-value="77">Platform (Software)</div>
                            <div class="item" data-value="71">Software (Software)</div>
                            <div class="item" data-value="73">Software with Inventory, Usage, Subscriptions (Software)</div>
                            <div class="header">Telecommunications</div>
                            <div class="item" data-value="74">Telecommunications (Telecommunications)</div>
                            <div class="header">Transportation</div>
                            <div class="item" data-value="76">Freight & Logistics Services (Transportation)</div>
                            <div class="item" data-value="75">Transportation (Transportation)</div>
                        </div>
                    </div>
                </div>
                `
            ;
        }

        var modalContentRequestForm = /* syntax: html */ `
            <!-- Staff My Team Modal and Form -->
            <form class="ui form overlay fullscreen modal" id="scr-modal-request-form">
                <i class="close icon"></i>
                <div class="header">SC Request Quick Assign Form</div>
                <div class="scrolling content">

                    <!-- Start Grid -->
                    <div class="ui stackable two column grid">

                        <!-- Column One -->
                        <div class="eleven wide column">

                            <!-- SC Assign -->
                            <div class="fields">
                                <div class="nine wide required field">
                                    <label>Assign To (Employee)</label>
                                    <div class="ui fluid search selection dropdown" id="solutionconsultant">
                                        <input type="hidden" name="solutionconsultant">
                                        <div class="text">Choose an SC</div>
                                        <i class="dropdown icon"></i>
                                    </div>
                                </div>

                                <!-- Assign As Lead -->
                                <div class="three wide field">
                                    <div class="ui toggle checkbox">
                                        <input type="checkbox" name="islead" id="islead" tabindex="0" class="hidden" checked>
                                        <label>Lead SC</label>
                                    </div>
                                </div>

                                <div class="four wide required field">
                                    <label>Date SC Needed</label>
                                    <div class="ui calendar" id="dateneeded">
                                        <div class="ui fluid input left icon" >
                                            <i class="calendar icon"></i>
                                            <input type="text" placeholder="Date SC Needed" name="dateneeded">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Request Details Addendum -->
                            <div class="field">
                                <label>SC Request Details Addendum</label>
                                <textarea rows="3" name="screquestdetailsadd" id="screquestdetailsadd" placeholder="Text to prepend to the beginning of the SC Request Details on Save..."></textarea>
                            </div>

                            <div class="fields">
                                ${fldIndustryHTml('scmindustry', 'twelve')}

                                <div class="four wide required field">
                                    <label>Proposed SKU</label>
                                    <div class="ui fluid search selection dropdown" id="scmsku">
                                        <input type="hidden" name="scmsku">
                                        <div class="default text">Choose a SKU</div>
                                        <i class="dropdown icon"></i>
                                        <div class="menu">
                                            <div class="item" data-value="Svcs Std/Prm">Svcs Std/Prm</div>
                                            <div class="item" data-value="FF Std/Prm">FF Std/Prm</div>
                                            <div class="item" data-value="SW Std/Prm">SW Std/Prm</div>
                                            <div class="item" data-value="WD Std/Prm">WD Std/Prm</div>
                                            <div class="item" data-value="MFG Std/Prm">MFG Std/Prm</div>
                                            <div class="item" data-value="OpenAir Std/Prm">OpenAir Std/Prm</div>
                                            <div class="item" data-value="Healthcare Std/Prm">Healthcare Std/Prm</div>
                                            <div class="item" data-value="NFP Std/Prm">NFP Std/Prm</div>
                                            <div class="item" data-value="Starter">Starter</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="three fields">
                                <div class="field">
                                    <label>Potential Integrations</label>
                                    <input type="text" name="scmaddons" placeholder="List systems">
                                </div>
                                <div class="field">
                                    <label>Partners</label>
                                    <input type="text" name="scmpartners" placeholder="Required or known partner(s)">
                                </div>
                                <div class="field">
                                    <label>Competitors</label>
                                    <input type="text" name="scmcompetitors" placeholder="Incumbent or competitor(s)">
                                </div>
                            </div>

                            <div class="fields">
                                <!-- Hashtags -->
                                <div class="six wide field">
                                    <label>Add #hashtags</label>
                                    <div class="ui fluid multiple search selection dropdown" id="hashtags">
                                        <input type="hidden" name="hashtags">
                                        <i class="dropdown icon"></i>
                                        <div class="default text">Add hashtags</div>
                                        <div class="menu">
                                            ${ createHashtags() }
                                        </div>
                                    </div>
                                </div>

                                <!-- Products -->
                                <div class="ten wide field">
                                    <label>Products</label>
                                    <div class="ui fluid multiple three column search selection dropdown" id="products">
                                        <input type="hidden" name="products">
                                        <i class="dropdown icon"></i>
                                        <div class="default text">Add product(s)</div>
                                        <div class="menu">
                                            <div class="item" data-value="2">Advanced Electronic Bank Payments</div>
                                            <div class="item" data-value="3">Advanced Manufacturing</div>
                                            <div class="item" data-value="4">Advanced Order Management</div>
                                            <div class="item" data-value="5">AP Automation</div>
                                            <div class="item" data-value="6">Bill Capture</div>
                                            <div class="item" data-value="7">CPQ</div>
                                            <div class="item" data-value="8">Demand Planning</div>
                                            <div class="item" data-value="10">Dunning</div>
                                            <div class="item" data-value="12">EPM FCC</div>
                                            <div class="item" data-value="13">EPM FF</div>
                                            <div class="item" data-value="14">EPM NR</div>
                                            <div class="item" data-value="15">EPM NSAR</div>
                                            <div class="item" data-value="16">EPM NSPB</div>
                                            <div class="item" data-value="17">EPM PCM</div>
                                            <div class="item" data-value="18">EPM Tax</div>
                                            <div class="item" data-value="19">Field Service Management</div>
                                            <div class="item" data-value="20">Financial Management</div>
                                            <div class="item" data-value="21">Fixed Asset Management</div>
                                            <div class="item" data-value="22">Incentive Compensation</div>
                                            <div class="item" data-value="23">Inventory Management</div>
                                            <div class="item" data-value="25">NS Connector</div>
                                            <div class="item" data-value="27">NSAW</div>
                                            <div class="item" data-value="28">OneWorld</div>
                                            <div class="item" data-value="29">OpenAir</div>
                                            <div class="item" data-value="31">Payroll</div>
                                            <div class="item" data-value="33">Quality Management </div>
                                            <div class="item" data-value="34">Rebate Management</div>
                                            <div class="item" data-value="35">Revenue Management</div>
                                            <div class="item" data-value="37">Smart Count</div>
                                            <div class="item" data-value="38">SuiteAnalytics Connect</div>
                                            <div class="item" data-value="39">SuiteBilling</div>
                                            <div class="item" data-value="40">SuiteCloud Plus</div>
                                            <div class="item" data-value="41">SuiteCommerce</div>
                                            <div class="item" data-value="42">SuiteCommerce Instore</div>
                                            <div class="item" data-value="43">SuiteCommerce MyAccount</div>
                                            <div class="item" data-value="44">SuitePeople</div>
                                            <div class="item" data-value="45">SuiteProjects</div>
                                            <div class="item" data-value="48">WFM</div>
                                            <div class="item" data-value="49">WIP and Routings</div>
                                            <div class="item" data-value="50">WMS</div>
                                            <div class="item" data-value="51">Work Orders and Assemblies</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="fields">
                                <div class="sixteen wide field">
                                    <label>Red Flags</label>
                                    <input type="text" name="scmredflags" placeholder="Red flags or cautions">
                                </div>
                            </div>

                            ${(settings.includeBodyOfWork) ? `
                            <h4 class="ui horizontal left aligned divider header">
                                <i class="tools icon"></i>
                                Product Skills Search Ranking
                            </h4>

                            <div class="ui basic segment">
                                <!-- Dimmer and Loader -->
                                <div class="ui dimmer" id="tableSkillsLoader">
                                    <div class="ui indeterminate blue elastic text loader">Gathering and Ranking Skills</div>
                                </div>

                                <!-- TOP Help text -->
                                <div class="ui top attached secondary segment">
                                    <p>Need help narrowing down an SC? Select an SC Industry and at least one Product to search and rank Body of Work data below. Use the filters to control which SCs should be returned.</p>
                                </div>

                                <!-- MIDDLE Filters and buttons -->
                                <div class="ui attached segment">
                                    <div class="four fields">
                                        <div class="field">
                                            <label>My Team</label>
                                            <select class="ui fluid search dropdown" name="skillfilter-myteam" id="skillfilter-myteam">
                                                <option value="">Limit to my team</option>
                                                <option value="T">Yes</option>
                                                <option value="F">No</option>
                                            </select>
                                        </div>

                                        <div class="field">
                                            <label>SC Vertical</label>
                                            <select class="ui fluid search dropdown" multiple="" name="skillfilter-scvertical" id="skillfilter-scvertical">
                                                <option value="">Filter SC vertical</option>
                                                <option value="5">General Business</option>
                                                <option value="58">Products</option>
                                                <option value="57">High Tech</option>
                                                <option value="45">Tiger</option>
                                            </select>
                                        </div>

                                        <div class="field">
                                            <label>SC Director</label>
                                            <select class="ui fluid search dropdown" name="skillfilter-scdirector" id="skillfilter-scdirector">
                                                <option value="">Filter SC director</option>
                                                <option value="karl">Karl</option>
                                                <option value="rebecca">Rebecca</option>
                                                <option value="lauren">Lauren</option>
                                                <option value="robyn">Robyn</option>
                                                <option value="jeff">Jeff</option>
                                            </select>
                                        </div>

                                        <div class="field">
                                            <label>SC Tier</label>
                                            <select class="ui fluid search dropdown" multiple="" name="skillfilter-sctier" id="skillfilter-sctier">
                                                <option value="">Filter SC tier</option>
                                                <option value="29">LMM</option>
                                                <option value="28">MM/Corp</option>
                                            </select>
                                        </div>

                                        <div class="field">
                                            <label>SC Region</label>
                                            <select class="ui fluid search dropdown" multiple="" name="skillfilter-scregion" id="skillfilter-scregion">
                                                <option value="">Filter SC region</option>
                                                <option value="48">East</option>
                                                <option value="49">Central</option>
                                                <option value="50">West</option>
                                            </select>
                                        </div>

                                    </div>

                                    <div class="ui blue button" id="productskillsearch"><i class="icon search"></i>Search Skills</div>

                                </div>

                                <!-- BOTTOM Main table -->
                                <div class="ui bottom attached segment">

                                    <table id="bodyofwork" class="ui compact small selectable collapsing celled resizable scrolling table"></table>

                                </div>

                            </div>
                            ` : ''}


                        </div>

                        <!-- Column Two -->
                        <div class="five wide column">

                            <!-- Opp Details -->
                            ${
                                getRequestMetadataHrml()
                            }

                            <!-- Request Details -->
                            <div class="field">
                                <label>SC Request Details</label>
                                <textarea rows="20" name="screquestdetails" id="screquestdetails" readonly="" style="background-color:lightgray;"></textarea>
                            </div>

                            <!-- FLM Notes -->
                            <div class="field">
                                <label>Sales Manager Notes</label>
                                <textarea rows="5" name="salesmanagernotes" id="salesmanagernotes" readonly="" style="background-color:lightgray;"></textarea>
                            </div>

                            <!-- LAUNCHPAD -->
                            <div class="ui accordion field">
                                <div class="title">
                                    <i class="icon dropdown"></i>
                                    Toggle Launchpad Information
                                </div>
                                <div class="content">
                                    <div class="field">
                                        <label>Qualifying Questions</label>
                                        <textarea rows="20" name="launchpadqual" id="launchpadqual" readonly="" style="background-color:lightgray;"></textarea>
                                    </div>
                                    <div class="field">
                                        <label>Launchpad Notes</label>
                                        <textarea rows="5" name="launchpadnotes" id="launchpadnotes" readonly="" style="background-color:lightgray;"></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- End Grid -->

                </div>
                <div class="actions">
                    <button type="submit" class="ui green approve button" id="submitform">Apply Changes</button>
                    <div class="ui reset button">Reset</div>
                    <div class="ui black deny button">Dismiss</div>
                </div>
            </form>
            `
        ;

        var modalContentNotesForm = /* syntax: html */ `
            <!-- SC Mgr Notes Modal -->
            <form class="ui small form modal" id="scr-modal-notes-form">
                <i class="close icon"></i>
                <div class="content">

                    <!-- Request Details Addendum -->
                    <div class="required field">
                        <label>SCM Staffing Notes</label>
                        <textarea rows="3" name="scmstaffingnotes" id="scmstaffingnotes" placeholder="Why are you sending this cross-vertical?"></textarea>
                    </div>

                    <!-- Industry -->
                    ${fldIndustryHTml('scmindustry-popup')}

                    <!-- Emerging -->
                    <div class="field">
                        <div class="ui toggle checkbox">
                            <input type="checkbox" name="needsemg" id="needsemg" tabindex="0" class="hidden">
                            <label>Needs EMG support or review</label>
                        </div>
                    </div>
                </div>
                <div class="actions">
                    <button type="submit" class="ui green approve button" id="submitform">Apply Changes</button>
                    <div class="ui black deny button">Dismiss</div>
                </div>
            </form>
            `
        ;

        var fomanticCss = /* syntax: html */ `
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/fomantic-ui@2.9.3/dist/semantic.css" integrity="sha256-lT1UJMnT8Tu/iZ/FT7mJlzcRoe3yhl3K8oyCebjP8qw=" crossorigin="anonymous" referrerpolicy="no-referrer">
            `
        ;

        $('head').append(fomanticCss);
        $('body').append(modalContentRequestForm);
        $('body').append(modalContentNotesForm);

        // SC Request Form Button Bar
        // var nsBtnBar = $('#main_form table table').children('tbody').children('tr').eq(1);
        // var nsBtnBarCnt = $('#main_form table table').children('tbody').children('tr').eq(1).children('td').length;
        // nsBtnBar.children('td').append('<td></td>');
        // $('#main_form table table').children('tbody').eq(1).append(btnMenu);
        // $('#sc-mgr-assistant-col').attr('colspan', nsBtnBarCnt);

        function createHashtags() {
            let hashtags = settings.hashtags;
            if (!hashtags || hashtags.length == 0) { return ''; }

            let hashtagsArray = hashtags.replace('#', '').split(',').sort();
            let hashtagsHtmlArray = [];
            for (var h in hashtagsArray) {
                hashtagsHtmlArray.push(`<div class="item" data-value="#${hashtagsArray[h].trim()}">${hashtagsArray[h].trim()}</div>`);
            }
            return hashtagsHtmlArray.join('');
        }

        let pageTitle = $('.uir-page-title-secondline');
        let pageTitleNew = $('.uir-page-title');
        let pageTitleBig = $('.uir-page-title-record');
        // (pageTitle.length !== 0) ? pageTitle.append(btnMenu) : pageTitleNew.append(btnMenu);
        pageTitleBig.after(btnMenu);


        /**
        * +===================================================================================================+
        * |                                                                                                   |
        * |    ######  ##     ## #### ######## ########  ######   ######  ########  #### ########  ########   |
        * |   ##    ## ##     ##  ##     ##    ##       ##    ## ##    ## ##     ##  ##  ##     ##    ##      |
        * |   ##       ##     ##  ##     ##    ##       ##       ##       ##     ##  ##  ##     ##    ##      |
        * |    ######  ##     ##  ##     ##    ######    ######  ##       ########   ##  ########     ##      |
        * |         ## ##     ##  ##     ##    ##             ## ##       ##   ##    ##  ##           ##      |
        * |   ##    ## ##     ##  ##     ##    ##       ##    ## ##    ## ##    ##   ##  ##           ##      |
        * |    ######   #######  ####    ##    ########  ######   ######  ##     ## #### ##           ##      |
        * |                                                                                                   |
        * +===================================================================================================+
        */

        function getCurrentEmp() {
            var curUser = nlapiGetUser();
            var filters = [];
            filters.push(new nlobjSearchFilter('custrecord_emproster_emp', null, 'is', curUser));

            var columns = [];
            columns.push(new nlobjSearchColumn('custrecord_emproster_vertical_amo'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_salesteam'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_salesregion'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_sales_tier'));
            columns.push(new nlobjSearchColumn('name'));

            var results = nlapiSearchRecord('customrecord_emproster', null, filters, columns);
            return results[0];
        }

        const empRec = getCurrentEmp();
        const empName = empRec.getValue('name');

        const _ids = {
            "me"     : empRec.getId(),
            "jeff"   : 727821,
            "karl"   : 106513,
            "rebecca": 344520,
            "robyn"  : 758520,
            "lauren" : 169117,
            "jason"  : 684320
        };

        function getWorkloadData() {
            var workload = {};

            const vertId = empRec.getValue('custrecord_emproster_vertical_amo');
            const teamId = empRec.getValue('custrecord_emproster_salesteam');
            const regId = empRec.getValue('custrecord_emproster_salesregion');
            const tierId = empRec.getValue('custrecord_emproster_sales_tier'); // 10, 28, 29 are all valid SC Tier IDs

            // Date helpers
            const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

            const addMonths = (input, months) => {
                const date = new Date(input);
                date.setDate(1);
                date.setMonth(date.getMonth() + months);
                date.setDate(Math.min(input.getDate(), getDaysInMonth(date.getFullYear(), date.getMonth()+1)));
                return date;
            }

            const _today = new Date();
            const sixMonthsAgo = addMonths(_today, -6);
            const sixMonthsAgoFormatted = nlapiDateToString(sixMonthsAgo, 'date');

            // filter on current, active team
            var filters = [];

            filters.push(new nlobjSearchFilter('custrecord_screq_status', null, 'is', 2)); // Request Status = Staffed
            filters.push(new nlobjSearchFilter('created', null, 'onorafter', sixMonthsAgoFormatted));

            filters.push(new nlobjSearchFilter('custrecord_emproster_rosterstatus', 'custrecord_screq_assignee', 'is', 1));
            filters.push(new nlobjSearchFilter('custrecord_emproster_eminactive', 'custrecord_screq_assignee', 'is', 'F'));
            filters.push(new nlobjSearchFilter('custrecord_emproster_salesteam', 'custrecord_screq_assignee', 'is', teamId));
            filters.push(new nlobjSearchFilter('custrecord_emproster_salesregion', 'custrecord_screq_assignee', 'is', regId));
            filters.push(new nlobjSearchFilter('custrecord_emproster_sales_qb', 'custrecord_screq_assignee', 'is', 25)); // this should filter to QB = Solution Consultant

            if (settings.filterMe === true) {
                filters.push(new nlobjSearchFilter('custrecord_emproster_mgrroster', 'custrecord_screq_assignee', 'is', _ids.me));
            }

            if (settings.filterVertical === true) {
                filters.push(new nlobjSearchFilter('custrecord_emproster_vertical_amo', 'custrecord_screq_assignee', 'is', vertId));
            }

            if (settings.filterTier === true) {
                filters.push(new nlobjSearchFilter('custrecord_emproster_sales_tier', 'custrecord_screq_assignee', 'is', tierId));
            }

            if (settings.filterDirector) {
                const dirName = settings.filterDirector;
                switch (dirName) {
                    case "jeff":
                    case "karl":
                    case "rebecca":
                    case "lauren":
                    case "robyn":
                        filters.push(new nlobjSearchFilter('custrecord_emproster_oml7', 'custrecord_screq_assignee', 'is', _ids[dirName]));
                        break;
                    default:
                        shout(`Invalid director name provided: ${dirName}.`);
                }
            }

            // return id, name, location, and availability data
            var columns = [];
            columns.push(new nlobjSearchColumn('internalid', 'custrecord_screq_assignee', 'group'));
            // columns.push(new nlobjSearchColumn('custrecord_screq_assignee', null, 'group'));
            // columns.push(new nlobjSearchColumn('internalid', null, 'count'));

            var columnLoad = new nlobjSearchColumn('formulanumeric', null, 'sum');
            columnLoad.setFormula('CASE WHEN {custrecord_screq_date_sc_needed} >= ({today}-30) THEN 1 ELSE 0 END');
            columnLoad.setFunction('percentOfTotal');
            columnLoad.setLabel('Load');
            columns.push(columnLoad);

            var columnInplay = new nlobjSearchColumn('formulanumeric', null, 'sum');
            columnInplay.setFormula("CASE WHEN {custrecord_screq_engmnt_status} IN ('Not Started', 'In Progress') THEN 1 ELSE 0 END");
            columnInplay.setLabel('Inplay');
            columns.push(columnInplay);

            var results = nlapiSearchRecord('customrecord_sc_request', null, filters, columns);

            if (!results || results.length < 1) {
                shout('Error getting team workload!');
                return;
            }

            for (var _i = results.length - 1; _i >= 0; _i--) {

                var result = results[_i];
                var scName = result.getValue('internalid', 'custrecord_screq_assignee', 'group');
                var tmpArray = [0, 0];

                var allColumns = result.getAllColumns();

                for (var j = 0; j < allColumns.length; j++) {

                    var column = allColumns[j];
                    var columnLabel = column.getLabel();
                    var columnValue = result.getValue(column);

                    switch (columnLabel) {
                        case "Load":
                            tmpArray[0] = columnValue;
                            break;
                        case "Inplay":
                            tmpArray[1] = columnValue;
                            break;

                    }
                }

                workload[scName] = tmpArray;
            }

            // shout(workload);
            return workload;
        }

        function getPeopleData() {
            var workloadData = (settings.includeAvailability) ? getWorkloadData() : {};
            var people = [];

            const vertId = empRec.getValue('custrecord_emproster_vertical_amo');
            const teamId = empRec.getValue('custrecord_emproster_salesteam');
            const regId = empRec.getValue('custrecord_emproster_salesregion');
            const tierId = empRec.getValue('custrecord_emproster_sales_tier'); // 10, 28, 29 are all valid SC Tier IDs

            // filter on current, active team
            var filters = [];

            filters.push(new nlobjSearchFilter('custrecord_emproster_rosterstatus', null, 'is', 1));
            filters.push(new nlobjSearchFilter('custrecord_emproster_eminactive', null, 'is', 'F'));
            filters.push(new nlobjSearchFilter('custrecord_emproster_salesteam', null, 'is', teamId));
            filters.push(new nlobjSearchFilter('custrecord_emproster_salesregion', null, 'is', regId));
            filters.push(new nlobjSearchFilter('custrecord_emproster_sales_qb', null, 'is', 25)); // this should filter to QB = Solution Consultant

            if (settings.filterMe === true) {
                filters.push(new nlobjSearchFilter('custrecord_emproster_mgrroster', null, 'is', _ids.me));
            }

            if (settings.filterVertical === true) {
                filters.push(new nlobjSearchFilter('custrecord_emproster_vertical_amo', null, 'is', vertId));
            }

            if (settings.filterTier === true) {
                filters.push(new nlobjSearchFilter('custrecord_emproster_sales_tier', null, 'is', tierId));
            }

            if (settings.filterDirector) {
                const dirName = settings.filterDirector;
                switch (dirName) {
                    case "jeff":
                    case "karl":
                    case "rebecca":
                    case "lauren":
                    case "robyn":
                        filters.push(new nlobjSearchFilter('custrecord_emproster_oml7', null, 'is', _ids[dirName]));
                        break;
                    default:
                        shout(`Invalid director name provided: ${dirName}.`);
                }
            }

            // return id, name, location, and availability data
            var columns = [];
            columns.push(new nlobjSearchColumn('internalid'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_firstname'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_lastname'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_olocation'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_avail'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_avail_notes'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_avail_notes_res'));

            var results = nlapiSearchRecord('customrecord_emproster', null, filters, columns);

            if (!results || results.length < 1) {
                shout('Error getting team availability!');
                return;
            }

            for (var _i = results.length - 1; _i >= 0; _i--) {

                var _id = results[_i].getId();
                var _workload = (Object.keys(workloadData).length !== 0) ? workloadData[_id.toString()] : null;

                var newPerson = new Person(
                    _id,
                    results[_i].getValue('custrecord_emproster_firstname'),
                    results[_i].getValue('custrecord_emproster_lastname'),
                    results[_i].getText('custrecord_emproster_olocation'),
                    results[_i].getText('custrecord_emproster_avail'),
                    results[_i].getValue('custrecord_emproster_avail_notes'),
                    results[_i].getValue('custrecord_emproster_avail_notes_res'),
                    (_workload && _workload.length > 0) ? _workload[0] : 0,
                    (_workload && _workload.length > 0) ? _workload[1] : 0
                );

                people.push(newPerson);
            }

            function sortPeopleData(people, key, ascending) {
                people.sort((a, b) => {
                    let valueA, valueB;

                    // Get the appropriate values based on the key
                    if (key === '30 day load') {
                        // these values look like "9.999%"
                        valueA = parseFloat(a.weight);
                        valueB = parseFloat(b.weight);
                    } else if (key === 'In Play') {
                        // these values look like "9"
                        valueA = parseInt(a.inplay);
                        valueB = parseInt(b.inplay);
                    } else if (key === 'SC Name') {
                        // these values look like "First Last"
                        valueA = a.fullname.toLowerCase(); // case-insensitive sorting
                        valueB = b.fullname.toLowerCase();
                    } else {
                        shout('Invalid sort key; check settings.')
                        return 0;
                    }

                    // Compare the values
                    if (valueA < valueB) return ascending ? -1 : 1;
                    if (valueA > valueB) return ascending ? 1 : -1;
                    return 0; // If values are equal
                });
            }

            const sortBy     = settings.sortAvailabilityBy || 'SC Name';
            const sortAsc    = (settings.sortAvailabilityDirection === 'Desc') ? false : true;

            sortPeopleData(people, sortBy, sortAsc);
            return people;
        }

        /**
         * Get custom skills filters from form
         * @return {obj} Filter obj which contains two keys.
         */
        function getTableFilters() {
            var filters = {};
            var fIndustry = [];
            var fSkills = [];

            // my team
            const filterMyTeam = $('#skillfilter-myteam').dropdown('get value') || null;
            if (filterMyTeam && filterMyTeam === 'T') {
                fSkills.push(new nlobjSearchFilter('custrecord_emproster_mgrroster', 'custrecord_ssm_skill_employee', 'is', _ids.me));
                fIndustry.push(new nlobjSearchFilter('custrecord_emproster_mgrroster', 'custrecord_sr_ind_rating_employee', 'is', _ids.me));
                // shout('Table filter: My Team');
            }

            // sc vertical
            const filterVertical = $('#skillfilter-scvertical').dropdown('get values') || null;
            if (filterVertical && filterVertical.length > 0) {
                fSkills.push(new nlobjSearchFilter('custrecord_emproster_vertical_amo', 'custrecord_ssm_skill_employee', 'anyof', filterVertical));
                fIndustry.push(new nlobjSearchFilter('custrecord_emproster_vertical_amo', 'custrecord_sr_ind_rating_employee', 'anyof', filterVertical));
                // shout('Table filter: SC Vertical');
            }

            // sc director
            const filterDirector = $('#skillfilter-scdirector').dropdown('get value') || null;

            switch (filterDirector) {
                case "jeff":
                case "karl":
                case "rebecca":
                case "lauren":
                case "robyn":
                    fSkills.push(new nlobjSearchFilter('custrecord_emproster_oml7', 'custrecord_ssm_skill_employee', 'is', _ids[filterDirector]));
                    fIndustry.push(new nlobjSearchFilter('custrecord_emproster_oml7', 'custrecord_sr_ind_rating_employee', 'is', _ids[filterDirector]));
                    // shout('Table filter: SC Director');
                    break;
                default:
                    shout(`Invalid director name provided: ${filterDirector}.`);
            }

            // sc tier
            const filterTier = $('#skillfilter-sctier').dropdown('get values') || null;
            if (filterTier && filterTier.length > 0) {
                fSkills.push(new nlobjSearchFilter('custrecord_emproster_sales_tier', 'custrecord_ssm_skill_employee', 'anyof', filterTier));
                fIndustry.push(new nlobjSearchFilter('custrecord_emproster_sales_tier', 'custrecord_sr_ind_rating_employee', 'anyof', filterTier));
                // shout('Table filter: SC Tier');
            }

            // sc region
            const filterRegion = $('#skillfilter-scregion').dropdown('get values') || null;
            if (filterRegion && filterRegion.length > 0) {
                fSkills.push(new nlobjSearchFilter('custrecord_emproster_salessubregion', 'custrecord_ssm_skill_employee', 'anyof', filterRegion));
                fIndustry.push(new nlobjSearchFilter('custrecord_emproster_salessubregion', 'custrecord_sr_ind_rating_employee', 'anyof', filterRegion));
                // shout('Table filter: SC Region');
            }

            filters.industry = fIndustry;
            filters.skills = fSkills;

            return filters;
        }

        function getBodyOfWorkIndustryData(industryId, tableFilters) {
            if (!industryId) { return null; }

            var industryData = [];

            const vertId = empRec.getValue('custrecord_emproster_vertical_amo');
            const teamId = empRec.getValue('custrecord_emproster_salesteam');
            const regId = empRec.getValue('custrecord_emproster_salesregion');
            const tierId = empRec.getValue('custrecord_emproster_sales_tier'); // 10, 28, 29 are all valid SC Tier IDs

            // filter on current, active team
            var filters = [];

            filters.push(new nlobjSearchFilter('custrecord_sr_ind_rating_subindustry', null, 'is', industryId));

            filters.push(new nlobjSearchFilter('custrecord_emproster_rosterstatus', 'custrecord_sr_ind_rating_employee', 'is', 1));
            filters.push(new nlobjSearchFilter('custrecord_emproster_eminactive', 'custrecord_sr_ind_rating_employee', 'is', 'F'));
            filters.push(new nlobjSearchFilter('custrecord_emproster_salesteam', 'custrecord_sr_ind_rating_employee', 'is', teamId));
            filters.push(new nlobjSearchFilter('custrecord_emproster_salesregion', 'custrecord_sr_ind_rating_employee', 'is', regId));
            filters.push(new nlobjSearchFilter('custrecord_emproster_sales_qb', 'custrecord_sr_ind_rating_employee', 'is', 25)); // this should filter to QB = Solution Consultant

            if (tableFilters && tableFilters.length > 0) {
                filters = filters.concat(tableFilters);
            } else {
                if (settings.filterMe === true) {
                    filters.push(new nlobjSearchFilter('custrecord_emproster_mgrroster', 'custrecord_sr_ind_rating_employee', 'is', _ids.me));
                }

                if (settings.filterVertical === true) {
                    filters.push(new nlobjSearchFilter('custrecord_emproster_vertical_amo', 'custrecord_sr_ind_rating_employee', 'is', vertId));
                }

                if (settings.filterTier === true) {
                    filters.push(new nlobjSearchFilter('custrecord_emproster_sales_tier', 'custrecord_sr_ind_rating_employee', 'is', tierId));
                }

                if (settings.filterDirector) {
                    const dirName = settings.filterDirector;
                    switch (dirName) {
                        case "jeff":
                        case "karl":
                        case "rebecca":
                        case "lauren":
                        case "robyn":
                            filters.push(new nlobjSearchFilter('custrecord_emproster_oml7', 'custrecord_sr_ind_rating_employee', 'is', _ids[dirName]));
                            break;
                        default:
                            shout(`Invalid director name provided: ${dirName}.`);
                    }
                }
            }

            var columns = [];
            columns.push(new nlobjSearchColumn('internalid'));
            columns.push(new nlobjSearchColumn('custrecord_sr_ind_rating_employee'));
            columns.push(new nlobjSearchColumn('internalid', 'custrecord_sr_ind_rating_employee'));
            columns.push(new nlobjSearchColumn('custrecord_sr_ind_rating_industry'));
            columns.push(new nlobjSearchColumn('custrecord_sr_ind_rating_subindustry'));
            columns.push(new nlobjSearchColumn('custrecord_sr_ind_rating'));

            // var nRating = new nlobjSearchColumn('formulanumeric', null, 'sum');
            // nRating.setFormula("TO_NUMBER(SUBSTR({custrecord_sr_ind_rating}, 1, 1))");
            // nRating.setLabel('nRating');
            // columns.push(nRating);

            var results = nlapiSearchRecord('customrecord_sr_industry_rating_entry', null, filters, columns);

            if (!results || results.length < 1) {
                shout('Error getting team workload!');
                return;
            }

            for (var _i = results.length - 1; _i >= 0; _i--) {

                var result       = results[_i];
                var id           = result.getId();
                var employee     = result.getText('custrecord_sr_ind_rating_employee');
                var employeeId   = result.getValue('internalid', 'custrecord_sr_ind_rating_employee');
                var industry     = result.getText('custrecord_sr_ind_rating_industry');
                var subindustry  = result.getText('custrecord_sr_ind_rating_subindustry');
                var rating       = Array.from(result.getText('custrecord_sr_ind_rating'))[0]; // only pull in the numeric rating, not the text

                var data = [
                    employeeId,
                    employee,
                    industry,
                    subindustry,
                    rating
                ];

                industryData.push(data);
            }

            shout("Industry data:", industryData);
            return industryData;
        }

        function getBodyOfWorkSkillData(skillIds, tableFilters) {
            if (!skillIds) { return null; }

            shout('skillIds: ', skillIds);

            var skills = [];

            const vertId = empRec.getValue('custrecord_emproster_vertical_amo');
            const teamId = empRec.getValue('custrecord_emproster_salesteam');
            const regId = empRec.getValue('custrecord_emproster_salesregion');
            const tierId = empRec.getValue('custrecord_emproster_sales_tier'); // 10, 28, 29 are all valid SC Tier IDs

            // filter on current, active team
            var filters = [];

            filters.push(new nlobjSearchFilter('custrecord_ssm_skill_entry', null, 'anyof', skillIds));

            filters.push(new nlobjSearchFilter('custrecord_emproster_rosterstatus', 'custrecord_ssm_skill_employee', 'is', 1));
            filters.push(new nlobjSearchFilter('custrecord_emproster_eminactive', 'custrecord_ssm_skill_employee', 'is', 'F'));
            filters.push(new nlobjSearchFilter('custrecord_emproster_salesteam', 'custrecord_ssm_skill_employee', 'is', teamId));
            filters.push(new nlobjSearchFilter('custrecord_emproster_salesregion', 'custrecord_ssm_skill_employee', 'is', regId));
            filters.push(new nlobjSearchFilter('custrecord_emproster_sales_qb', 'custrecord_ssm_skill_employee', 'is', 25)); // this should filter to QB = Solution Consultant

            if (tableFilters && tableFilters.length > 0) {
                filters = filters.concat(tableFilters);
            } else {

                if (settings.filterMe === true) {
                    filters.push(new nlobjSearchFilter('custrecord_emproster_mgrroster', 'custrecord_ssm_skill_employee', 'is', _ids.me));
                }

                if (settings.filterVertical === true) {
                    filters.push(new nlobjSearchFilter('custrecord_emproster_vertical_amo', 'custrecord_ssm_skill_employee', 'is', vertId));
                }

                if (settings.filterTier === true) {
                    filters.push(new nlobjSearchFilter('custrecord_emproster_sales_tier', 'custrecord_ssm_skill_employee', 'is', tierId));
                }

                if (settings.filterDirector) {
                    const dirName = settings.filterDirector;
                    switch (dirName) {
                        case "jeff":
                        case "karl":
                        case "rebecca":
                        case "lauren":
                        case "robyn":
                            filters.push(new nlobjSearchFilter('custrecord_emproster_oml7', 'custrecord_ssm_skill_employee', 'is', _ids[dirName]));
                            break;
                        default:
                            shout(`Invalid director name provided: ${dirName}.`);
                    }
                }
            }

            var columns = [];
            columns.push(new nlobjSearchColumn('internalid'));
            columns.push(new nlobjSearchColumn('custrecord_ssm_skill_employee'));
            columns.push(new nlobjSearchColumn('internalid', 'custrecord_ssm_skill_employee'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_avail', 'custrecord_ssm_skill_employee'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_avail_notes', 'custrecord_ssm_skill_employee'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_avail_notes_res', 'custrecord_ssm_skill_employee'));
            columns.push(new nlobjSearchColumn('custrecord_ssm_skill_subsection'));
            columns.push(new nlobjSearchColumn('custrecord_ssm_skill_entry'));
            columns.push(new nlobjSearchColumn('custrecord_ssm_skill_rating'));
            // columns.push(new nlobjSearchColumn('custrecord_last_updated'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_olocation', 'custrecord_ssm_skill_employee'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_salessubregion', 'custrecord_ssm_skill_employee'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_vertical_amo', 'custrecord_ssm_skill_employee'));
            columns.push(new nlobjSearchColumn('custrecord_emproster_sales_tier', 'custrecord_ssm_skill_employee'));

            // var nRating = new nlobjSearchColumn('formulanumeric', null, 'sum');
            // nRating.setFormula("TO_NUMBER(SUBSTR({custrecord_sr_ind_rating}, 1, 1))");
            // nRating.setLabel('nRating');
            // columns.push(nRating);

            var results = nlapiSearchRecord('customrecord_ssm_entry', null, filters, columns);

            if (!results || results.length < 1) {
                shout('Error getting team workload!');
                return;
            }

            for (var _i = results.length - 1; _i >= 0; _i--) {

                var result         = results[_i];
                var id             = result.getId();
                var employee       = result.getText('custrecord_ssm_skill_employee');
                var employeeId     = result.getText('internalid', 'custrecord_ssm_skill_employee');
                var availability   = result.getText('custrecord_emproster_avail', 'custrecord_ssm_skill_employee');
                var avail_notes    = result.getValue('custrecord_emproster_avail_notes', 'custrecord_ssm_skill_employee');
                var avail_res      = result.getValue('custrecord_emproster_avail_notes_res', 'custrecord_ssm_skill_employee');
                var location       = result.getText('custrecord_emproster_olocation', 'custrecord_ssm_skill_employee');
                var region         = result.getText('custrecord_emproster_salessubregion', 'custrecord_ssm_skill_employee');
                var vertical       = result.getText('custrecord_emproster_vertical_amo', 'custrecord_ssm_skill_employee');
                var tier           = result.getText('custrecord_emproster_sales_tier', 'custrecord_ssm_skill_employee');
                var subsection     = result.getText('custrecord_ssm_skill_subsection');
                var skill          = result.getText('custrecord_ssm_skill_entry');
                var rating         = Array.from(result.getText('custrecord_ssm_skill_rating'))[0]; // only pull in the numeric rating, not the text
                var ratingWeighted = generateWeightedRating(rating);
                // var lastupdate     = result.getValue('custrecord_last_updated');

                var data = [
                    employeeId,
                    employee,
                    subsection,
                    skill,
                    rating,
                    ratingWeighted,
                    availability,
                    avail_notes,
                    avail_res,
                    location,
                    region,
                    vertical,
                    tier
                ];

                skills.push(data);
            }

            shout('All skills:', skills);
            return skills;
        }

        function consolidateSkillsData(data) {
            // now passing array of 2 results...
            const skillsData = data[0];
            const industryData = data[1];
            if (!skillsData || skillsData.length === 0) { return null; }

            const aggregatedScores = skillsData.reduce((acc, [
                employeeId,
                employee,
                subsection,
                skill,
                rating,
                ratingWeighted,
                availability,
                avail_notes,
                avail_res,
                location,
                region,
                vertical,
                tier
            ]) => {
                // If the employee ID is not yet in the accumulator, initialize it with a rating of 0 and an empty skills string
                if (!acc[employee]) {
                    acc[employee] = {
                        employeeId     : employeeId,
                        location       : extractLocationString(location),
                        region         : region,
                        vertical       : vertical,
                        tier           : tier.replace('Solution Consultant - ', ''),
                        availability   : availability.toLowerCase(),
                        avail_notes    : avail_notes,
                        avail_res      : avail_res,
                        weightedRating : 0,
                        skillsList     : ''
                    };
                }

                // Sum the rating for the current employee
                acc[employee].weightedRating += ratingWeighted;

                // Append the skill and rating to the skills string
                acc[employee].skillsList += `${skill}-${rating}, `;

                return acc;
            }, {});

            // Clean up the trailing comma and space from the skills string
            Object.keys(aggregatedScores).forEach(employee => {
                aggregatedScores[employee].skillsList = aggregatedScores[employee].skillsList.replace(/,\s*$/, "");
            });

            // Find the maximum rating among all employees
            const maxRating = Math.max(...Object.values(aggregatedScores).map(employee => employee.weightedRating));

            // Calculate the stack rank percentage for each employee
            const rankedEmployees = Object.entries(aggregatedScores).map(([employee, data]) => {
                const percentage = (data.weightedRating / maxRating) * 100;

                return {
                    employee       : employee,
                    employeeId     : data.employeeId,
                    availability   : data.availability,
                    avail_notes    : data.avail_notes,
                    avail_res      : data.avail_res,
                    location       : data.location,
                    region         : data.region,
                    vertical       : data.vertical,
                    tier           : data.tier,
                    weightedRating : data.weightedRating,
                    skillsList     : data.skillsList.replace(/,(\s+)/gm, '<br>'),
                    stackRank      : percentage.toFixed(1) // Format to 1 decimal place
                };
            });

            const sortedRankedEmployees = rankedEmployees.sort((a, b) => b.weightedRating - a.weightedRating);

            if (industryData && industryData.length > 0) {
                const aggregatedIndustries = industryData.reduce((acc, [
                    employeeId,
                    employee,
                    industry,
                    subindustry,
                    rating
                ]) => {
                    if (!acc[employee]) {
                        acc[employee] = {
                            employeeId: employeeId,
                            industryRating: rating
                        };
                    }
                    return acc;
                }, {});

                const cleanedIndustries = Object.entries(aggregatedIndustries).map(([employee, data]) => {
                    return {
                        employee       : employee,
                        employeeId     : data.employeeId,
                        industryRating : parseInt(data.industryRating)
                    };
                });

                const cleanedIndustriesMap = cleanedIndustries.reduce((acc, obj) => {
                    acc[obj.employeeId] = obj;
                    return acc;
                }, {});

                const combinedEmployeeData = sortedRankedEmployees.map(objA => {
                    const match = cleanedIndustriesMap[objA.employeeId];
                    return match ? { ...objA, industryRating: match.industryRating } : objA;
                });

                return combinedEmployeeData;
            }

            return sortedRankedEmployees;
        }

        function extractLocationString(str) {
            // Define the regular expression
            const regex = /^\w{2}-\w+/i;

            // Use match() to extract the substring that matches the regex
            const match = str.match(regex);

            // If a match is found, return the first match (or the original location if no match)
            return match ? match[0] : str;
        }

        function generateWeightedRating(rating) {
            const weights = {
                4: 8,
                3: 5,
                2: 2,
                1: 1,
                0: 0 // Assuming 0 maps to 0 as there's no weight provided
            };

            return weights[rating] || 0; // Default to 0 if the rating is not in the dictionary
        }

        function calculateRatingAverage(...numbers) {
            if (numbers.length === 0) return 0; // Return 0 if no numbers are provided

            const sum = numbers.reduce((acc, num) => acc + num, 0);
            const average = sum / numbers.length;

            return Math.round(average * 10) / 10; // Round to 1 decimal place
        }

        function calculateRatingStackRank(numbers) {
            const max = Math.max(...numbers);
            const min = Math.min(...numbers);

            return numbers.map(num => {
                const percentage = ((num - min) / (max - min)) * 100;
                return parseFloat(percentage.toFixed(1)); // Round to 1 decimal place and convert back to a number
            });
        }

        function generateRating(rating) {
            if (!rating) { rating = 0; }
            var maxRemain = 4 - rating;
            var ratings = [];

            for (var i = 0; i < rating; i++) {
                ratings.push(`<i class="star icon active"></i>`);
            }

            for (var j = 0; j < maxRemain; j++) {
                ratings.push(`<i class="star icon"></i>`)
            }

            var ratingsHtml = ratings.join('');
            shout('Ratings HTML:', ratingsHtml);
            return `<div class="ui yellow rating disabled">${ratingsHtml}</div>`;
        }

        function generateBodtOfWorkHtml(data, industryId) {
            if (!data || data.length === 0) { return ''; }

            shout("Data for HTML table:", data);

            var html = [];

            var tableHead = /* syntax: html */ `
                    <thead>
                        <tr>
                            <th class="single line">SC Name</th>
                            <th>Attributes</th>
                            <th>Availability Notes</th>
                            ${(industryId) ? `<th class="single line">Sub-Industry Fit</th>` : ``}
                            <th>Skills Detail</th>
                            <th class="single line">Weighted Rating</th>
                            <th class="single line">Stack Rank</th>
                        </tr>
                    </thead>
                    `
                ;

            var tableFoot = /* syntax: html */ `
                    <tbody></tbody>
                    <tfoot class="full-width">
                        <tr class="right aligned">
                            <th colspan="${(industryId) ? 7 : 6}" id="bodyofwork-footer">0 rows</th>
                        </tr>
                    </tfoot>
                    `
                ;

            html.push(tableHead);

            var len = data.length;
            var i = 0;

            for (i; i < len; i++) {
                /**
                 * {
                 *   "employee"
                 *   "employeeId"
                 *   "availability"
                 *   "avail_notes"
                 *   "avail_res"
                 *   "weightedRating"
                 *   "skillsList"
                 *   "stackRank"
                 *   "industryRating"
                 * }
                 */

                const row = /* syntax: html */ `
                    <tr>
                        <td class="single line tableSkillsAssign">
                            <button class="ui mini primary icon button" data-eid="${data[i]["employeeId"]}" data-ename="${data[i]["employee"]}">
                                <i class="plus icon"></i>
                            </button>
                            <a href="/app/common/custom/custrecordentry.nl?rectype=1572&id=${data[i]["employeeId"]}" target="_blank">${data[i]["employee"]}</a>
                        </td>
                        <td>
                            <div class="ui tiny basic labels">
                                ${(data[i]["vertical"]) ? `<div class="ui label">${data[i]["vertical"]}</div>` : ''}
                                ${(data[i]["tier"]) ? `<div class="ui label">${data[i]["tier"]}</div>` : ''}
                                ${(data[i]["location"]) ? `<div class="ui label">${data[i]["location"]}</div>` : ''}
                                ${(data[i]["region"]) ? `<div class="ui label">${data[i]["region"]}</div>` : ''}
                            </div>
                        </td>
                        <td class="${(data[i]["availability"]) ? ` left ${data[i]["availability"]} marked` : ''}">
                            ${data[i]["avail_notes"]}
                            ${(data[i]["avail_res"]) ? `
                                <div class="ui fitted divider"></div>
                                <span class="ui red text">${data[i]["avail_res"]}</span>
                                ` : ''
                            }
                            </h5>
                        </td>
                        ${(industryId) ?
                        `<td>
                            <div class="ui yellow disabled rating" data-icon="star" data-rating="${data[i]["industryRating"]}" data-max-rating="4"></div>
                        </td>` : ``
                        }
                        <td>
                            ${data[i]["skillsList"]}
                        </td>
                        <td>
                            ${data[i]["weightedRating"]}
                        </td>
                        <td>
                            <div class="ui indicating progress" data-percent="${data[i]["stackRank"]}" id="progress-${data[i]["employeeId"]}">
                                <div class="bar">
                                    <div class="progress"></div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `
                html.push(row);
            }

            html.push(tableFoot);
            return html.join('');
        }

        async function getIndustryRating(industryId) {
            try {
                const payload = await new Promise((resolve, reject) => {
                    try {
                        const result = getBodyOfWorkIndustryData(industryId);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });

                shout("Payload received!");

                shout("Industry data:", payload);
            } catch (error) {
                shout("Payload error:", error);
            }
        }

        /**
         * Utility wrapper around setTimeout
         * @param  {int}   ms       Sleep time in milliseconds
         * @param  {func}  callback Callback function
         */
        function sleep(ms, callback) {
            setTimeout(callback, ms);
        }

        function convertNameFormat(name) {
            // Split the string by the comma and trim any extra spaces
            let [lastname, firstname] = name.split(',').map(part => part.trim());

            // Return the concatenated result in "Firstname Lastname" format
            return `${firstname} ${lastname}`;
        }

        function updateBodyOfWorkTable(skills, industryId, tableFilters) {
            // Add dimmer and loader
            var dimmer = $('#tableSkillsLoader');
            dimmer.addClass('active');

            sleep(2000, function() {
                var results = [];
                const resultA = getBodyOfWorkSkillData(skills, tableFilters.skills);
                const resultB = (industryId) ? getBodyOfWorkIndustryData(industryId, tableFilters.industry) : [];
                results.push(resultA, resultB);

                const skillsClean = consolidateSkillsData(results);
                var html = generateBodtOfWorkHtml(skillsClean, industryId);
                var rowTotals = skillsClean.length || 0;

                // Update table with row data
                $('#bodyofwork').html(`${html}`);

                // Update table footer
                $('#bodyofwork-footer').html(`${rowTotals} row${(rowTotals == 1) ? '':'s'}`)

                // Update progress bars
                $('.ui.progress').progress();

                // Update ratings
                $('.ui.rating').rating();

                // Update link events
                $('.tableSkillsAssign button').click(
                    function(event) {
                        event.preventDefault();

                        var eid   = $(this).data('eid');
                        var ename = $(this).data('ename');

                        const newValues = [{
                            "name"                : convertNameFormat(ename),
                            "value"               : parseInt(eid),
                            "description"         : "Override: Added from skills search results table",
                            "descriptionVertical" : true
                        }];

                        const scValues = getPeopleCache();

                        $('#solutionconsultant').dropdown('change values', newValues);
                        $('#solutionconsultant').dropdown('set selected', eid);

                        shout('Add employee to dropdown:', `${ename} (${eid})`);
                    }
                );

                sleep(1000, function() {
                    // Remove dimmer and loader
                    dimmer.removeClass('active');
                });
            });

        }

        /**
        * +====================================================+
        * |                                                    |
        * |    ######     ###     ######  ##     ## ########   |
        * |   ##    ##   ## ##   ##    ## ##     ## ##         |
        * |   ##        ##   ##  ##       ##     ## ##         |
        * |   ##       ##     ## ##       ######### ######     |
        * |   ##       ######### ##       ##     ## ##         |
        * |   ##    ## ##     ## ##    ## ##     ## ##         |
        * |    ######  ##     ##  ######  ##     ## ########   |
        * |                                                    |
        * +====================================================+
        */

        function checkCache() {

            var getCacheArray = GM_SuperValue.get(`${SCRIPT_CACHE_ID}`);

            if (getCacheArray && getCacheArray.length > 0) {
                // cache found, check for timestamp
                var getCacheTs = GM_SuperValue.get(`${SCRIPT_CACHE_ID}_ts`);

                if (getCacheTs) {
                    // timestamp found, move to compare
                    var _currentTs = new Date().valueOf();
                    var _diffTs = _currentTs - getCacheTs;

                    /**
                     * Cache is used to help increase performance by limiting
                     * API calls for data that doens't change all that often.
                     * We store the full HTML formatted dropdown values in the
                     * cache and only refresh that data after a duration specified
                     * in settings. For maths purposes, 3600000 ms = 1 hr.
                     */

                    const cacheDurationHrs = parseInt(settings.cacheRefreshDelay) || 6;
                    const cacheDurationMs  = cacheDurationHrs * 3600000;

                    if (_diffTs >= cacheDurationMs) {
                        // cache is older than threshold, refresh cache
                        refreshCache();
                    }

                } else {
                    // no timestamp found, refresh cache
                    refreshCache();
                }

            } else {
                // no cache currently set, create one
                refreshCache();
            }

        }

        function refreshCache() {
            var scValues = [];
            var people = getPeopleData();

            people.forEach(async (person) => {
                scValues.push(
                    {
                        "name": person.name,
                        "value": person.value,
                        "description": `${person.description}`,
                        "descriptionVertical": true
                    }
                );
            });

            var _peopleCache = scValues;
            var _peopleCacheTs = new Date().valueOf();

            GM_SuperValue.set(`${SCRIPT_CACHE_ID}`, _peopleCache);
            GM_SuperValue.set(`${SCRIPT_CACHE_ID}_ts`, _peopleCacheTs);
            GM_SuperValue.set(`${SCRIPT_CACHE_ID}_raw`, people);

            shout('People cache refreshed');
        }

        /**
        * +========================================================+
        * |                                                        |
        * |   ######## #### ######## ##       ########   ######    |
        * |   ##        ##  ##       ##       ##     ## ##    ##   |
        * |   ##        ##  ##       ##       ##     ## ##         |
        * |   ######    ##  ######   ##       ##     ##  ######    |
        * |   ##        ##  ##       ##       ##     ##       ##   |
        * |   ##        ##  ##       ##       ##     ## ##    ##   |
        * |   ##       #### ######## ######## ########   ######    |
        * |                                                        |
        * +========================================================+
        */

        function getPeopleCache() {
            checkCache();
            var _peopleCache = GM_SuperValue.get(`${SCRIPT_CACHE_ID}`);
            return _peopleCache;
        }

        function getSalesManagerNotes() {
            var text = nlapiGetFieldValue('custrecord_screq_sales_manager_notes');
            return text;
        }

        function getRequestDetails() {
            var text = nlapiGetFieldValue('custrecord_screq_details');
            return text;
        }

        function setRequestDetails(text) {
            // prepend text to SC Request Details
            nlapiSetFieldValue('custrecord_screq_details', text + getRequestDetails());
        }

        function getLaunchpadQual() {
            var text = nlapiGetFieldValue('custrecord_bdr_scr_qualifying_questions');
            return text;
        }

        function getLaunchpadNotes() {
            var text = nlapiGetFieldValue('custrecord_bdr_scr_sales_compass_notes');
            return text;
        }

        function getStaffingNotes() {
            var text = nlapiGetFieldValue('custrecord_screq_scmanager_notes_2');
            return text;
        }

        function setStaffingNotes(text) {
            // prepend text to SCM Staffing Notes
            nlapiSetFieldValue('custrecord_screq_scmanager_notes_2', text + getStaffingNotes());
        }

        function getDateNeeded() {
            var text = nlapiGetFieldValue('custrecord_screq_date_sc_needed');
            return text;
        }

        function setDateNeeded(text) {
            // var d = nlapiStringToDate(text, 'MM/DD/YYYY'); // apparently NSCORP wants a date string in M/D/YYYY
            nlapiSetFieldValue('custrecord_screq_date_sc_needed', text);
        }

        function getProducts() {
            var idArray = nlapiGetFieldValues('custrecord_sc_req_products');
            return idArray;
        }

        function setProducts(str) {
            var strArray = str.split(',');
            nlapiSetFieldValues('custrecord_sc_req_products', strArray);
        }

        /**
         * Convert SC Product selections to corresponding Skills Matrix entries.
         * @param  {...[int]} idsArray   One or more SC Product internal IDs
         * @return {[array]}             Array of Skills Matrix internal IDs
         */
        function getProductSkills(idsArray) {
            var legend = {
                "2":"591", // Advanced Electronic Bank Payments
                "3":"827", // Advanced Manufacturing
                "4":"529", // Advanced Order Management
                "5":"957", // AP Automation
                "6":"957", // Bill Capture
                "7":"956", // CPQ
                "8":"834", // Demand Planning
                "9":"962", // Disaster Recovery
                "10":"985", // Dunning
                "53":"988", // E-Invoicing
                "12":"982", // EPM FCC
                "13":"993", // EPM FF
                "14":"990", // EPM NR
                "15":"983", // EPM NSAR
                "16":"984", // EPM NSPB
                "17":"991", // EPM PCM
                "18":"992", // EPM Tax
                "19":"964", // Field Service Management
                "20":"825", // Financial Management
                "21":"600", // Fixed Asset Management
                "22":"572", // Incentive Compensation
                "23":"826", // Inventory Management
                "25":"934", // NS Connector
                "26":"715", // NS POS
                "27":"968", // NSAW
                "28":"839", // OneWorld
                "29":"840", // OpenAir
                "31":"652", // Payroll
                "32":"844", // Procurement
                "33":"846", // Quality Management
                "34":"929", // Rebate Management
                "35":"979", // Revenue Management
                "38":"708", // SuiteAnalytics Connect
                "39":"710", // SuiteBilling
                "40":"712", // SuiteCloud Plus
                "41":"714", // SuiteCommerce
                "42":"657", // SuiteCommerce Instore
                "43":"716", // SuiteCommerce MyAccount
                "44":"604", // SuitePeople
                "45":"845", // SuiteProjects
                "46":"974", // Tier
                "48":"958", // WFM
                "49":"738", // WIP and Routings
                "50":"850", // WMS
                "51":"739" // Work Orders and Assemblies
            };
            return idsArray.map(id => {
                if (legend.hasOwnProperty(id)) {
                    return legend[id];
                } else {
                    shout('getProductSkills: ID not found -> ', id);
                }
            });
        }

        function getRegion(state) {
            if (state === '-N/A-') { return '-Review-'; }

            const eastStates = ['ME', 'NH', 'VT', 'MA', 'CT', 'RI', 'NY', 'PA', 'NJ', 'DE', 'MD', 'DC', 'WV', 'VA', 'NC', 'SC', 'GA', 'FL'];
            const centralStates = ['ND', 'SD', 'NE', 'KS', 'OK', 'TX', 'MN', 'IA', 'MO', 'AR', 'LA', 'WI', 'IL', 'MI', 'IN', 'OH', 'KY', 'TN', 'MS', 'AL'];
            const westStates = ['AK', 'WA', 'OR', 'CA', 'HI', 'MT', 'ID', 'NV', 'WY', 'UT', 'AZ', 'CO', 'NM'];
            const canWestStates = ['YT', 'BC', 'NT', 'AB', 'SK'];
            const canEastStates = ['NU', 'MB', 'ON', 'QC', 'NB', 'PE', 'NL', 'NS'];

            if (eastStates.includes(state)) {
                return 'East';
            } else if (centralStates.includes(state)) {
                return 'Central';
            } else if (westStates.includes(state)) {
                return 'West';
            } else if (canWestStates.includes(state)) {
                return 'CAN-West';
            } else if (canEastStates.includes(state)) {
                return 'CAN-East';
            } else {
                return '-Review-';
            }
        }

        function getRequestMetadata() {
            var scr = {};

            scr.company       = nlapiGetFieldText('custrecord_screq_opp_company') || '-N/A-';
            scr.companyid     = nlapiGetFieldValue('custrecord_screq_opp_company') || null;

            scr.city          = nlapiLookupField('customer', scr.companyid, 'billcity', true) || '-N/A-';
            scr.state         = nlapiLookupField('customer', scr.companyid, 'billstate', true) || '-N/A-';
            scr.region        = getRegion(scr.state);

            scr.opportunity   = nlapiGetFieldText('custrecord_screq_opportunity') || '-N/A-';
            scr.opportunityid = nlapiGetFieldValue('custrecord_screq_opportunity') || null;

            scr.salesrep      = nlapiGetFieldText('custrecord_screq_opp_salesreproster') || '-N/A-';
            scr.salesmgr      = nlapiGetFieldText('custrecord_sales_rep_manager') || '-N/A-';

            scr.industry      = nlapiGetFieldValue('custrecord_screq_zoominfo_industry') || '-N/A-';
            scr.subindustry   = nlapiGetFieldValue('custrecord_screq_zoominfo_sub_industry') || '-N/A-';

            scr.url           = nlapiGetFieldValue('custrecord_screq_customer_web_address') || '-N/A-';
            scr.linkedin      = nlapiGetFieldValue('custrecord_screq_linkedin_url') || '-N/A-';

            return scr;
        }

        function getRequestMetadataHrml() {
            var data = getRequestMetadata() || null;

            if (!data) { return ''; }

            var html = /* syntax: html */ `
            <div class="ui segment">
                <div class="ui list">
                    <div class="item">
                        <div class="header">Opportunity</div>
                        <a href="/app/accounting/transactions/opprtnty.nl?id=${data.opportunityid}" target="_blank">${data.opportunity}</a>
                    </div>
                    <div class="item">
                        <div class="header">Company</div>
                        <a href="/app/common/entity/custjob.nl?id=${data.companyid}" target="_blank">${data.company}</a>
                    </div>
                    <div class="item">
                        <div class="header">Company Region</div>
                        ${data.region}: ${data.city}, ${data.state}
                    </div>
                    <div class="item">
                        <div class="header">Industry</div>
                        ${data.industry}
                    </div>
                    <div class="item">
                        <div class="header">Sub-Industry</div>
                        ${data.subindustry}
                    </div>
                    <div class="item">
                        <div class="header">Website</div>
                        <a href="${data.url}" target="_blank">${data.url}</a>
                    </div>
                    <div class="item">
                        <div class="header">LinkedIn</div>
                        <a href="${data.linkedin}" target="_blank">${data.linkedin}</a>
                    </div>
                </div>
            </div>
            `;

            return html;
        }

        function getRequestType() {
            var id = nlapiGetFieldValue('custrecord_screq_type');
            return id;
        }

        function setRequestType() {
            nlapiSetFieldValue('custrecord_screq_type', 19, true);
        }

        function getIndustry() {
            var id = nlapiGetFieldValue('custrecord_screq_industry');
            return id;
        }

        function setIndustry(id) {
            // utility func: set industry to ID
            if (id) {
                nlapiSetFieldValue('custrecord_screq_industry', id, true);
            } else {
                return null;
            }
        }

        function setAssignee(id) {
            // utility func: set assignee to ID
            nlapiSetFieldValue('custrecord_screq_assignee', id, true);
        }

        function setAssigneeJeff() {
            // assignee = Jeff
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.jeff, true);
        }

        function setAssigneeKarl() {
            // assignee = Karl
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.karl, true);
        }

        function setAssigneeRebecca() {
            // assignee = Rebecca
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.rebecca, true);
        }

        function setAssigneeRobyn() {
            // assignee = Robyn
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.robyn, true);
        }

        function setAssigneeLauren() {
            // assignee = Lauren
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.lauren, true);
        }

        function setAssigneeJason() {
            // assignee = Jason (EPM)
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.jason, true);
        }

        function setAssigneeMe() {
            // assignee = current user roster
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.me, true);
        }

        function setRequesterMe() {
            // requestor = current user roster
            nlapiSetFieldValue('custrecord_screq_requestor', _ids.me, true);
        }

        function setLeadStatus(status) {
            // lead SC = true, T
            var bool = 'T';
            if (status !== "on") { bool = 'F' }
            nlapiSetFieldValue('custrecord_screq_assigned_lead', bool);
        }

        function setDeliverable() {
            // Deliverable = Business Discussion
            nlapiSetFieldValue('custrecord_screq_engmnt_deliverable', 53);
        }

        function setTierStatus() {
            // Service Tier Assessment Flag = No
            nlapiSetFieldValue('custrecord_sc_complex_flag', 2);
        }

        function setHashtags(hashtags) {
            // Set hashtags to string
            nlapiSetFieldValue('custrecord_screq_hashtags', hashtags);
        }

        function setSCManagerNotes(scmanagernotes) {
            // set SC Manager Notes 1 to string
            nlapiSetFieldValue('custrecord_screq_scmanager_notes', scmanagernotes);
        }

        function setStatusRequested() {
            // Request Status = Requested
            nlapiSetFieldValue('custrecord_screq_status', 1, true);
        }

        function setStatusStaffed() {
            // Request Status = Staffed
            nlapiSetFieldValue('custrecord_screq_status', 2, true);
        }

        function setStatusHold() {
            // Request status = On Hold
            nlapiSetFieldValue('custrecord_screq_status', 3, true);
        }

        function setStatusCancelled() {
            // Request Status = Cancelled
            // Eng Status = Cancelled
            // prepend text to SC Request Details
            // Lead SC = False, F
            var comment = `SC Request cancelled by SC Manager (${empName}). \nPlease create a new request if needed.\n---\n\n`;
            var request = nlapiGetFieldValue('custrecord_screq_details');
            nlapiSetFieldValue('custrecord_screq_details', comment + request, true);
            nlapiSetFieldValue('custrecord_screq_status', 4, true);
            nlapiSetFieldValue('custrecord_screq_engmnt_status', 5, true);
            nlapiSetFieldValue('custrecord_screq_assigned_lead', 'F', true);
        }

        function setXvert() {
            // add hashtag string
            // Xvert = True, T
            var tag = "#xvr,";
            var hashtagFld = nlapiGetFieldValue('custrecord_screq_hashtags');

            // test for value first
            const regex = new RegExp('(#xvr[|,]?)', 'gi');
            if (!regex.test(hashtagFld)) {
                nlapiSetFieldValue('custrecord_screq_hashtags', tag + hashtagFld, true);
            }
            nlapiSetFieldValue('custrecord_screq_cross_vertical', 'T', true);
        }

        function setEmg() {
            // add hashtag string
            // Xvert = True, T
            var tag = "#emg,";
            var hashtagFld = nlapiGetFieldValue('custrecord_screq_hashtags');

            // test for value first
            const regex = new RegExp('(#emg[|,]?)', 'gi')
            if (!regex.test(hashtagFld)) {
                nlapiSetFieldValue('custrecord_screq_hashtags', tag + hashtagFld, true);
            }
        }

        function setRecordCancelled() {
            // button action - cancelled
            setStatusCancelled();
            // shout('Set status to Cancelled, and Assigned To to myself.')
        }

        function setRecordHold() {
            // button action - on hold
            setStatusHold();
            setAssigneeMe();
            // shout('Set status to On Hold, and Assigned To to myself.')
        }

        function setRecordProductsEast() {
            // button action - move to Products East
            setStatusRequested();
            setAssigneeLauren();
            setXvert();
            // shout('Set to xvr, and Assigned To Lauren.')
        }

        function setRecordProductsWest() {
            // button action - move to Products West
            setStatusRequested();
            setAssigneeRobyn();
            setXvert();
            // shout('Set to xvr, and Assigned To Robyn.')
        }

        function setRecordGBEast() {
            // button action - move to GB East
            setStatusRequested();
            setAssigneeKarl();
            setXvert();
            // shout('Set to xvr, and Assigned To Karl.')
        }

        function setRecordGBWest() {
            // button action - move to GB West
            setStatusRequested();
            setAssigneeRebecca();
            setXvert();
            // shout('Set to xvr, and Assigned To Rebecca.')
        }

        function setRecordHT() {
            // button action - move to HT
            setStatusRequested();
            setAssigneeJeff();
            setXvert();
            // shout('Set to xvr, and Assigned to Jeff.');
        }

        function setRecordEPM() {
            // button action - move to EPM
            setStatusRequested();
            setAssigneeJason();
            setXvert();
            // shout('Set to xvr, and Assigned to Jason.');
        }

        function openRequestModal() {
            // opens staffing modal form
            $('#scr-modal-request-form')
                .modal('show')
            ;
        }

        /**
        * +=============================================================================================+
        * |                                                                                             |
        * |   ########   #######  ##     ##    ######## ##     ## ######## ##    ## ########  ######    |
        * |   ##     ## ##     ## ###   ###    ##       ##     ## ##       ###   ##    ##    ##    ##   |
        * |   ##     ## ##     ## #### ####    ##       ##     ## ##       ####  ##    ##    ##         |
        * |   ##     ## ##     ## ## ### ##    ######   ##     ## ######   ## ## ##    ##     ######    |
        * |   ##     ## ##     ## ##     ##    ##        ##   ##  ##       ##  ####    ##          ##   |
        * |   ##     ## ##     ## ##     ##    ##         ## ##   ##       ##   ###    ##    ##    ##   |
        * |   ########   #######  ##     ##    ########    ###    ######## ##    ##    ##     ######    |
        * |                                                                                             |
        * +=============================================================================================+
        */

        $("#_legend").click(
            function(event) {
                event.preventDefault();
            }
        );
        $("#_debug").click(
            function(event) {
                event.preventDefault();
                window.open('https://vscode.dev/?connectTo=tampermonkey', '_blank');
            }
        );
        $("#_settings").click(
            function(event) {
                event.preventDefault();
                openConfig();
            }
        );
        $("#_cancelled").click(
            function(event) {
                event.preventDefault();
                setRecordCancelled();
            }
        );
        $("#_onhold").click(
            function(event) {
                event.preventDefault();
                setRecordHold();
            }
        );
        $("#_xvertprodwest").click(
            function(event) {
                event.preventDefault();
                setRecordProductsWest();
            }
        );
        $("#_xvertprodeast").click(
            function(event) {
                event.preventDefault();
                setRecordProductsEast();
            }
        );
        $("#_xvertgbwest").click(
            function(event) {
                event.preventDefault();
                setRecordGBWest();
            }
        );
        $("#_xvertgbeast").click(
            function(event) {
                event.preventDefault();
                setRecordGBEast();
            }
        );
        $("#_xvertht").click(
            function(event) {
                event.preventDefault();
                setRecordHT();
            }
        );
        $("#_xvertepm").click(
            function(event) {
                event.preventDefault();
                setRecordEPM();
            }
        );
        $('#_staffmyteam').click(
            function(event) {
                event.preventDefault();
                openRequestModal();
            }
        );
        $('#_searchindustrylink').click(
            function(event) {
                event.preventDefault();
                //
            }
        );

        $('#productskillsearch').click(
            function(event) {
                event.preventDefault();

                const products = $('#products').dropdown('get values');
                if (!products || products.length === 0) { return false; }

                const industryId   = $('#scmindustry').dropdown('get value') || null;
                const skills       = getProductSkills(products);
                const tableFilters = getTableFilters();
                shout('Table filters:', tableFilters);
                updateBodyOfWorkTable(skills, industryId, tableFilters);
            }
        );

        // This doesn't appear to do anything different...
        // $('#productskillsearch').click(
        //     async function(event) {
        //         event.preventDefault();

        //         var dimmer = $('#tableSkillsLoader');
        //         dimmer.removeClass('active'); // start with a fresh dimmer

        //         const products = $('#products').dropdown('get values');
        //         if (!products || products.length === 0) { return false; }

        //         dimmer.addClass('active'); // add in a dimmer

        //         const industryId = $('#scmindustry').dropdown('get value') || null;
        //         const skills = getProductSkills(products);

        //         try {
        //             // Step 2: Call the async function
        //             const result = await updateBodyOfWorkTable(skills, industryId);
        //             dimmer.removeClass('active');
        //         } catch (error) {
        //             // Handle any errors and update the DOM accordingly
        //             console.error('Error occurred:', error);
        //         }
        //     }
        // );

        $('#scr-modal-request-form')
            .modal({
                inverted: true
            })
            .modal('setting', 'transition', 'scale')
            .modal('attach events', '#_staffmyteam', 'show')
        ;

        $('#scr-modal-notes-form')
            .modal({
                inverted: true
            })
            .modal('setting', 'transition', 'scale')
            .modal('attach events', '[id^=_xvert]', 'show')
        ;

        $('.ui.checkbox')
            .checkbox()
        ;

        $('.ui.accordion')
            .accordion()
        ;

        $('#bodyofwork')
            .tablesort()
        ;

        $('#_legend')
            .popup()
        ;

        $('.ui.selection.dropdown')
            .dropdown({
                clearable: true
            })
        ;

        $('.ui.search.selection.dropdown [id^=skillfilter]')
            .dropdown({
                keepSearchTerm: true
            })
        ;

        var industryFld = $('#scmindustry')
            .dropdown({
                hideDividers: 'empty'
            })
        ;

        var industryFld = $('#scmindustry-popup')
            .dropdown({
                hideDividers: 'empty'
            })
        ;

        $('#scmsku')
            .dropdown({
                allowAdditions: true,
                hideAdditions: false,
                className: {
                    addition: 'stuck addition'
                },
                name: 'scmsku'
            })
        ;

        const products = getProducts();

        $('#products')
            .dropdown({
                clearable: true,
                showOnFocus: true,
                placeholder: 'Select product(s)',
                fullTextSearch: true,
                name: 'products',
                match: 'text',
                maxSelections: 4
            })
        ;

        const initials = (settings.initials) ? settings.initials : "";

        var scValues = getPeopleCache();

        $('#solutionconsultant')
            .dropdown({
                clearable: false,
                showOnFocus: false,
                placeholder: 'Choose an SC',
                fullTextSearch: 'exact',
                name: 'solutionconsultant',
                values: scValues,
                match: 'text',
                onChange: function(value, text, $selectedItem) {
                    var d = new Date();
                    var today = [('0' + (d.getMonth()+1)).slice(-2), ('0'+d.getDate()).slice(-2), d.getFullYear()].join('/');
                    var scName = $.parseHTML(`${text}`)[1].innerText;
                    var msg = `${today} - Please work with ${scName} on next steps to KT ${initials}\n\n`;

                    $('#screquestdetailsadd').val(msg);
                }
            })
        ;

        $('#hashtags')
            .dropdown({
                allowAdditions: true,
                hideAdditions: false,
                className: {
                    addition: 'stuck addition'
                },
                hideDividers: 'empty'
            })
        ;

        $('#dateneeded')
            .calendar({
                type: 'date',
                today: true,
                firstDayOfWeek: 1,
                disabledDaysOfWeek: [0, 6],
                formatter: {
                    date: 'MM/DD/YYYY'
                }
            })
        ;

        /**
        * +=====================================================+
        * |                                                     |
        * |   ########  #######  ########  ##     ##  ######    |
        * |   ##       ##     ## ##     ## ###   ### ##    ##   |
        * |   ##       ##     ## ##     ## #### #### ##         |
        * |   ######   ##     ## ########  ## ### ##  ######    |
        * |   ##       ##     ## ##   ##   ##     ##       ##   |
        * |   ##       ##     ## ##    ##  ##     ## ##    ##   |
        * |   ##        #######  ##     ## ##     ##  ######    |
        * |                                                     |
        * +=====================================================+
        */

        // SCR Request Form
        var $scrRequestForm = $('#scr-modal-request-form')
            .form('set value', 'screquestdetails', getRequestDetails())
            .form('set value', 'salesmanagernotes', getSalesManagerNotes())
            .form('set value', 'launchpadqual', getLaunchpadQual())
            .form('set value', 'launchpadnotes', getLaunchpadNotes())
            .form('set value', 'dateneeded', getDateNeeded())
            .form('set value', 'products', getProducts())
            .form('set value', 'scmindustry', getIndustry())
            .form({
                onSuccess: function(event, fields) {
                    event.preventDefault();
                    var allFields = $scrRequestForm.form('get values');
                    // shout("Form data: " + JSON.stringify(allFields));

                    // var dateNeeded = allfields.dateneeded;
                    var dateNeeded = $('#dateneeded').calendar('get date');
                    var dateNeededStr = (dateNeeded.getMonth()+1) + '/' + dateNeeded.getDate() + '/' + dateNeeded.getFullYear();

                    setStatusStaffed();
                    setDateNeeded(dateNeededStr);
                    setAssignee(allFields.solutionconsultant);
                    setLeadStatus(allFields.islead);
                    setDeliverable();
                    setTierStatus();
                    setHashtags(allFields.hashtags);
                    setRequestDetails(allFields.screquestdetailsadd);
                    setIndustry(allFields.scmindustry);
                    setProducts(allFields.products);

                    var myDate = new Date();
                    var myDateString = ('0' + (myDate.getMonth()+1)).slice(-2) + '/' + ('0' + myDate.getDate()).slice(-2) + '/' + myDate.getFullYear();

                    var industryName = "";
                    var industryFormFld = allFields.scmindustry;

                    if (industryFormFld && industryFormFld.length > 0) {
                        var industryFld = $(`#scmindustry div[data-value=${industryFormFld}]`);
                        industryName = industryFld[0].innerText;
                    }

                    var scmNotes = `Industry: ${industryName}\n` +
                        `SKU: ${allFields.scmsku}\n` +
                        `Integrations: ${allFields.scmaddons}\n` +
                        `Partners: ${allFields.scmpartners}\n` +
                        `Competitors: ${allFields.scmcompetitors}\n` +
                        `---\n` +
                        `Why We Win: \n` +
                        `Why We Lose: \n` +
                        `Red Flags: ${allFields.scmredflags}\n` +
                        `---\n\n` +
                        `${myDateString} - Staffed deal ${initials}`
                    ;

                    setSCManagerNotes(scmNotes);
                }
            })
        ;

        // SCR Notes Form
        var $scrNotesForm = $('#scr-modal-notes-form')
            .form({
                onSuccess: function(event, fields) {
                    event.preventDefault();
                    var allFields = $scrNotesForm.form('get values');
                    var staffingNotes = allFields['scmstaffingnotes'];
                    var needsEmerging = allFields['needsemg'];
                    var scIndustry    = allFields['scmindustry-popup'];

                    var myDate = new Date();
                    var myDateString = ('0' + (myDate.getMonth()+1)).slice(-2) + '/' + ('0' + myDate.getDate()).slice(-2) + '/' + myDate.getFullYear();

                    var scmStaffingNotesPretty = `${myDateString} - ${staffingNotes} ${initials}\n\n`;

                    setStaffingNotes(scmStaffingNotesPretty);

                    if (needsEmerging === "on") { setEmg(); }
                    if (scIndustry) { setIndustry(scIndustry); }
                }
            })
        ;
    }
})();
