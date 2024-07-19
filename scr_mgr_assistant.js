// ==UserScript==
// @name         SCR Mgr Assistant Toolbar
// @namespace    https://ryancmorrissey.com/
// @copyright    Copyright © 2024 by Ryan Morrissey
// @version      2.1.1
// @description  Adds an Assistant Toolbar with interactive buttons to all SC Request forms.
// @author       Ryan Morrissey (https://github.com/23maverick23)
// @match        https://nlcorp.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&e=T*
// @match        https://nlcorp.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=2840*&custparam_record_id=*
// @icon         https://www.google.com/s2/favicons?domain=netsuite.com
// @require      https://code.jquery.com/jquery-3.6.0.js
// @require      https://cdn.jsdelivr.net/npm/fomantic-ui@2.9.3/dist/semantic.min.js
// @require      https://cdn.jsdelivr.net/gh/CoeJoder/waitForKeyElements.js@v1.3/waitForKeyElements.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @require      https://userscripts-mirror.org/scripts/source/107941.user.js
// @resource     FOMANTIC_CSS https://cdn.jsdelivr.net/npm/fomantic-ui@2.9.3/dist/semantic.min.css
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://github.com/23maverick23/nscorp-scm-tools/raw/main/scr_mgr_assistant.js
// @updateURL    https://github.com/23maverick23/nscorp-scm-tools/raw/main/scr_mgr_assistant.js
// @supportURL   https://github.com/23maverick23/nscorp-scm-tools/issues
// ==/UserScript==

/* globals $, jQuery */
/* globals GM_config, , GM_SuperValue, waitForKeyElements */
/* globals nlapiSearchRecord, nlapiGetFieldValue, nlapiSetFieldValue, nlapiGetFieldValues, nlapiSetFieldValues, nlapiGetUser, nlobjSearchFilter, nlobjSearchColumn, nlapiStringToDate */
(function() {
    'use strict';

    /**
    * >>=========================================================================<<
    * ||######  #######    #     # ####### #######    ####### ######  ### #######||
    * ||#     # #     #    ##    # #     #    #       #       #     #  #     #   ||
    * ||#     # #     #    # #   # #     #    #       #       #     #  #     #   ||
    * ||#     # #     #    #  #  # #     #    #       #####   #     #  #     #   ||
    * ||#     # #     #    #   # # #     #    #       #       #     #  #     #   ||
    * ||#     # #     #    #    ## #     #    #       #       #     #  #     #   ||
    * ||######  #######    #     # #######    #       ####### ######  ###    #   ||
    * >>=========================================================================<<
    */

    var $ = jQuery.noConflict(true);

    let configFieldDefs = {
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
            'default': 'true',
            'section': ['Buttons', 'Enable/disable specific buttons in the assistant bar.']
        },
        'showPR': {
            'label': 'Show Products cross-vertical button',
            'type': 'checkbox',
            'default': 'true'
        },
        'showHT': {
            'label': 'Show High Tech / Tiger cross-vertical button',
            'type': 'checkbox',
            'default': 'true'
        },
        'showEPM': {
            'label': 'Show EPM cross-vertical button',
            'type': 'checkbox',
            'default': 'true'
        },
        'showCancel': {
            'label': 'Show Cancel button',
            'type': 'checkbox',
            'default': 'true'
        },
        'showHold': {
            'label': 'Show On Hold button',
            'type': 'checkbox',
            'default': 'true'
        },
        'filterMe': {
            'label': 'Filter "Assigned To" using: SC Manager = Me',
            'type': 'checkbox',
            'default': 'true',
            'section': ['Filters', 'Set filters for the Assign To field (filters are additive).']
        },
        'filterVertical': {
            'label': 'Filter "Assigned To" using: SC Vertical = My Vertical',
            'type': 'checkbox',
            'default': 'true'
        },
        'filterTier': {
            'label': 'Filter "Assigned To" using: SC Tier = My Tier',
            'type': 'checkbox',
            'default': 'false'
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
            'default': 'false',
            'section': ['Experimental Settings', 'Only change these if you know what you\'re doing.']
        },
        'overrideForm': {
            'label': 'Force "Solution Consultant - Direct" form on load',
            'type': 'checkbox',
            'default': 'false'
        },
        'forceRefreshCache': {
            'label': 'Force refresh cache',
            'type': 'checkbox',
            'save': false,
            'default': false
        }
    };

    const CACHE_DURATION_MS = 86400000; // 24 hours

    var shout = function() {
        var context = "SC Mgr Assistant >> ";
        return Function.prototype.bind.call(console.log, console, context);
    }();

    const modalSettingForm = /* syntax: html */ `
        <form class="ui small form modal" id="scr-modal-settings-form"></form>
        `
    ;

    $('body').append(modalSettingForm);
    const frame = document.createElement('div');
    frame.className = "content";
    document.getElementById("scr-modal-settings-form").appendChild(frame);

    const configCss = /* syntax: css */ ``
    ;

    let gmc = new GM_config(
        {
            'id': 'scrMgrAssistantConfig',
            'title': 'SCR Mgr Assistant Settings',
            'fields': configFieldDefs,
            'css': configCss,
            'frame': frame,
            'events': {
                'save': function(values) {
                    if (values['forceRefreshCache']) {
                        GM_SuperValue.set('people_cache', '');
                        GM_SuperValue.set('people_cache_ts', '');
                    }
                    alert('SC Mgr Assistant >> Refresh the page for changes to settings to take effect.');
                    let config = this;
                    this.close();
                },
                'close': function() {
                    closeSettingsModal();
                },
                'init': onInit
            }
        }
    );

    function openSettingsModal() {
        // opens staffing modal form
        $('#scr-modal-settings-form')
            .modal({
                inverted: true
            })
            .modal('setting', 'transition', 'scale')
            .modal('show')
        ;

        $('#scrMgrAssistantConfig').attr('style', ''); // remove default form styling

        $('#scrMgrAssistantConfig_header').attr('class', 'ui center aligned large header'); // remove default header styling

        $('#scrMgrAssistantConfig .section_header.center').attr('class', 'ui header'); // remove default section header styling

        $('#scrMgrAssistantConfig .section_desc.center').attr('class', 'grey sub header'); // remove default section subheader styling

        $('[id^=scrMgrAssistantConfig_section_desc]').each(function() {
            $(this).siblings("[id^=scrMgrAssistantConfig_section_header]").append(this);
        });

        $('#scrMgrAssistantConfig .section_header_holder').attr('class', 'ui segment'); // remove default section styling

        $('#scrMgrAssistantConfig label').attr('class', ''); // remove default label styling

        $('#scrMgrAssistantConfig select')
            .attr('class', 'ui fluid selection dropdown') // remove default class for select
            .parent().closest('div')
            .attr('class', 'inline field') // remove default class for select
        ;

        $('#scrMgrAssistantConfig select').dropdown({clearable: true}); // convert select to fancy

        $('#scrMgrAssistantConfig input:checkbox')
            .attr('class', 'hidden') // remove default class for checkbox
            .parent().closest('div')
            .attr('class', 'ui toggle checkbox') // remove default class for checkbox
            .wrap('<div class="inline field"></div>')
        ;
        $('#scrMgrAssistantConfig input:checkbox').parent().closest('div').checkbox(); // convert checkbox to fancy

        $('#scrMgrAssistantConfig_saveBtn').attr('class', 'ui green button'); // remove default class for buttons
        $('#scrMgrAssistantConfig_closeBtn').attr('class', 'ui black button').html('Dismiss'); // remove default class for buttons

    }

    function closeSettingsModal() {
        $('#scr-modal-settings-form').modal('hide');
    }

    function openConfig() {
        gmc.open();
        openSettingsModal();
    }

    function closeConfig() {
        gmc.close();
        closeSettingsModal();
    }

    GM_registerMenuCommand('SCR Mgr Assistant Settings', openConfig);

    function onInit() {

        waitForKeyElements("#scr-modal-request-form", (element) => {
            doReloadForm();
        });

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
            constructor(id, first, last, location, status, notes, restricted) {
                this._id = id;
                this._first = first;
                this._last = last;
                this._location = location;
                this._status = status;
                this._notes = notes;
                this._restricted = restricted;
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
                const res = (this.restricted && this.restricted.length > 0) ? `<br>&emsp;<span style="font-style:italic;color:#db2828 !important;">${this.restricted}</span>` : '';
                return `${this.statusColor} ${this.notes} ${res}`;
            }
        }

        /**
         * INITIALIZE SETTINGS
         */

        const settings = {
            theme             : gmc.get('theme'),
            showGB            : gmc.get('showGB'),
            showPR            : gmc.get('showPR'),
            showHT            : gmc.get('showHT'),
            showEPM           : gmc.get('showEPM'),
            showCancel        : gmc.get('showCancel'),
            showHold          : gmc.get('showHold'),
            filterMe          : gmc.get('filterMe'),
            filterVertical    : gmc.get('filterVertical'),
            filterTier        : gmc.get('filterTier'),
            filterDirector    : gmc.get('filterDirector'),
            initials          : gmc.get('initials'),
            overrideForm      : gmc.get('overrideForm'),
            showDebug         : gmc.get('showDebug'),
            forceRefreshCache : gmc.get('forceRefreshCache'),
            hashtags          : gmc.get('hashtags')
        };

        shout(settings);

        // Set UI settings
        GM_addStyle(/* syntax: css */ `
            :root {
                --menu-color-red    : #db282830;
                --menu-color-orange : #f5a97f45;
                --menu-color-yellow : #eed49f70;
                --menu-color-green  : #21ba4530;
                --menu-color-blue   : #54c8ff30;
                --menu-color-purple : #673ab730;
                --menu-color-pink   : #f5bde670;
            }
            .ui.menu {
                box-shadow:0 1px 2px 0 rgba(34, 36, 38, 0.15) !important;
                background-color: var(--menu-color-${settings.theme}) !important;
            }
        `);

        // HELPER FUNCTION

        function doReloadForm() {
            if (settings.overrideForm) {
                shout('Overriding current form to Direct...');
                setRequestType();
            }
        }

        /**
         * HTML TEMPLATES
         */

        var btnMenuProducts = /* syntax: html */ `
            <div class="item">
                <div class="ui tiny buttons">
                    <button class="ui orange button" id="_xvertprodemg">PR Emg</button>
                    <div class="or"></div>
                    <button class="ui orange button" id="_xvertprodupm">PR Upm</button>
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

        var legendTemplatePR = /* syntax: html */ `<div class='item'> <i class='orange stop icon'></i> <div class='content'> <div class='header'>Product Emerging</div> <div class='description'>lauren, #emg</div> </div> </div> <div class='item'> <i class='orange stop icon'></i> <div class='content'> <div class='header'>Product Upmarket</div> <div class='description'>robyn</div> </div> </div>`;
        var legendTemplateGB = /* syntax: html */ `<div class='item'> <i class='blue stop icon'></i> <div class='content'> <div class='header'>GB West</div> <div class='description'>rebecca</div> </div> </div> <div class='item'> <i class='blue stop icon'></i> <div class='content'> <div class='header'>GB East</div> <div class='description'>karl</div> </div> </div>`;
        var legendTemplateHT = /* syntax: html */ `<div class='item'> <i class='green stop icon'></i> <div class='content'> <div class='header'>High Tech, Tiger</div> <div class='description'>jeff</div> </div> </div>`;
        var legendTemplateEPM = /* syntax: html */ `<div class='item'> <i class='teal stop icon'></i> <div class='content'> <div class='header'>EPM</div> <div class='description'>jason</div> </div> </div>`;

        var legendBtnTemplate = /* syntax: html */ `
            <div class='ui list'>
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
            `
        ;

        var btnMenu = /* syntax: html */ `
            <!-- SC Mgr Assistant -->
            <div class="ui menu" id="sc-mgr-assistant">
                <div class="header item">
                    <i class="big colored ${settings.theme} life ring icon"></i>
                    Assistant
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
                    <button class="ui tiny pink labeled icon button" id="_staffmyteam" data-tooltip="Open quick staff form" data-position="bottom right">
                        <i class="users cog icon"></i>
                        My Team
                    </button>
                </div>
                <div class="item">
                    <button class="ui tiny grey icon button" id="_legend" data-position="right center" data-html="${legendBtnTemplate}">
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

        var modalContentRequestForm = /* syntax: html */ `
        <!-- Staff My Team Modal and Form -->
        <form class="ui form fullscreen modal" id="scr-modal-request-form">
            <i class="close icon"></i>
            <div class="header">SC Request Quick Form</div>
            <div class="content">

                <!-- Start Grid -->
                <div class="ui stackable two column grid">

                    <!-- Column One -->
                    <div class="ten wide column">

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
                            <div class="twelve wide required field">
                                <label>SC Industry</label>
                                <div class="ui fluid search selection dropdown" id="scmindustry">
                                    <input type="hidden" name="scmindustry">
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
                                        <div class="item" data-value="1">ACS</div>
                                        <div class="item" data-value="2">Advanced Electronic Bank Payments</div>
                                        <div class="item" data-value="3">Advanced Manufacturing</div>
                                        <div class="item" data-value="4">Advanced Order Management</div>
                                        <div class="item" data-value="5">AP Automation</div>
                                        <div class="item" data-value="6">Bill Capture</div>
                                        <div class="item" data-value="7">CPQ</div>
                                        <div class="item" data-value="8">Demand Planning</div>
                                        <div class="item" data-value="9">Disaster Recovery</div>
                                        <div class="item" data-value="10">Dunning</div>
                                        <div class="item" data-value="11">Edition</div>
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
                                        <div class="item" data-value="24">LCS</div>
                                        <div class="item" data-value="25">NS Connector</div>
                                        <div class="item" data-value="26">NS POS</div>
                                        <div class="item" data-value="27">NSAW</div>
                                        <div class="item" data-value="28">OneWorld</div>
                                        <div class="item" data-value="29">OpenAir</div>
                                        <div class="item" data-value="30">Other</div>
                                        <div class="item" data-value="31">Payroll</div>
                                        <div class="item" data-value="33">Quality Management </div>
                                        <div class="item" data-value="34">Rebate Management</div>
                                        <div class="item" data-value="35">Revenue Management</div>
                                        <div class="item" data-value="36">Sandbox</div>
                                        <div class="item" data-value="37">Smart Count</div>
                                        <div class="item" data-value="38">SuiteAnalytics Connect</div>
                                        <div class="item" data-value="39">SuiteBilling</div>
                                        <div class="item" data-value="40">SuiteCloud Plus</div>
                                        <div class="item" data-value="41">SuiteCommerce</div>
                                        <div class="item" data-value="42">SuiteCommerce Instore</div>
                                        <div class="item" data-value="43">SuiteCommerce MyAccount</div>
                                        <div class="item" data-value="44">SuitePeople</div>
                                        <div class="item" data-value="45">SuiteProjects</div>
                                        <div class="item" data-value="47">Users</div>
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

                    </div>

                    <!-- Column Two -->
                    <div class="six wide column">

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

                <!-- Assign As Lead -->
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

        var fomanticCss = /* syntax: html */ `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/fomantic-ui@2.9.3/dist/semantic.css" integrity="sha256-lT1UJMnT8Tu/iZ/FT7mJlzcRoe3yhl3K8oyCebjP8qw=" crossorigin="anonymous" referrerpolicy="no-referrer">`;

        $('head').append(fomanticCss);
        $('body').append(modalContentRequestForm);
        $('body').append(modalContentNotesForm);

        // SC Request Form Button Bar
        // var nsBtnBar = $('#main_form table table').children('tbody').children('tr').eq(1);
        // var nsBtnBarCnt = $('#main_form table table').children('tbody').children('tr').eq(1).children('td').length;
        // nsBtnBar.children('td').append('<td></td>');
        // $('#main_form table table').children('tbody').eq(1).append(btnMenu);
        // $('#sc-mgr-assistant-col').attr('colspan', nsBtnBarCnt);
        $('.uir-page-title-secondline').append(btnMenu);

        /**
         * SUITESCRIPT FUNCTIONS
         */
        function getCurrentEmp() {
            var curUser = nlapiGetUser();
            var filters = new Array();
            filters[0] = new nlobjSearchFilter('custrecord_emproster_emp', null, 'is', curUser);
            var columns = new Array();
            columns[0] = new nlobjSearchColumn('custrecord_emproster_vertical_amo');
            columns[1] = new nlobjSearchColumn('custrecord_emproster_salesteam');
            columns[2] = new nlobjSearchColumn('custrecord_emproster_salesregion');
            columns[3] = new nlobjSearchColumn('custrecord_emproster_sales_tier');
            columns[4] = new nlobjSearchColumn('name');
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

        function getPeopleData() {
            var people = [];

            const vertId = empRec.getValue('custrecord_emproster_vertical_amo');
            const teamId = empRec.getValue('custrecord_emproster_salesteam');
            const regId = empRec.getValue('custrecord_emproster_salesregion');
            const tierId = empRec.getValue('custrecord_emproster_sales_tier'); // 10, 28, 29 are all valid SC Tier IDs

            // filter on current, active team
            var filters = new Array();

            filters[0] = new nlobjSearchFilter('custrecord_emproster_rosterstatus', null, 'is', 1);
            filters[1] = new nlobjSearchFilter('custrecord_emproster_eminactive', null, 'is', 'F');
            filters[2] = new nlobjSearchFilter('custrecord_emproster_salesteam', null, 'is', teamId);
            filters[3] = new nlobjSearchFilter('custrecord_emproster_salesregion', null, 'is', regId);
            filters[4] = new nlobjSearchFilter('custrecord_emproster_sales_qb', null, 'is', 25); // this should filter to QB = Solution Consultant

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
            var columns = new Array();
            columns[0] = new nlobjSearchColumn('internalid');
            columns[1] = new nlobjSearchColumn('custrecord_emproster_firstname');
            columns[2] = new nlobjSearchColumn('custrecord_emproster_lastname');
            columns[3] = new nlobjSearchColumn('custrecord_emproster_olocation');
            columns[4] = new nlobjSearchColumn('custrecord_emproster_avail');
            columns[5] = new nlobjSearchColumn('custrecord_emproster_avail_notes');
            columns[6] = new nlobjSearchColumn('custrecord_emproster_avail_notes_res');

            var results = nlapiSearchRecord('customrecord_emproster', null, filters, columns);

            if (!results || results.length < 1) {
                shout('Error getting team availability!');
                return;
            }
            for (var _i = results.length - 1; _i >= 0; _i--) {

                var newPerson = new Person(
                    results[_i].getId(),
                    results[_i].getValue('custrecord_emproster_firstname'),
                    results[_i].getValue('custrecord_emproster_lastname'),
                    results[_i].getText('custrecord_emproster_olocation'),
                    results[_i].getText('custrecord_emproster_avail'),
                    results[_i].getValue('custrecord_emproster_avail_notes'),
                    results[_i].getValue('custrecord_emproster_avail_notes_res')
                );

                people.push(newPerson);
            }

            return people;
        }

        function checkCache() {
            shout(`Cache set to ${CACHE_DURATION_MS}ms`);

            var getCacheArray = GM_SuperValue.get('people_cache');

            if (getCacheArray && getCacheArray.length > 0) {
                // cache found, check for timestamp
                var getCacheTs = GM_SuperValue.get('people_cache_ts');

                if (getCacheTs) {
                    // timestamp found, move to compare
                    var _currentTs = new Date().valueOf();
                    var _diffTs = _currentTs - getCacheTs;

                    if (_diffTs >= CACHE_DURATION_MS) {
                        // cache is older than 2 hours, refresh cache
                        refreshCache();
                    } else {
                        shout('People Cache < 2 hrs old');
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

            GM_SuperValue.set('people_cache', _peopleCache);
            GM_SuperValue.set('people_cache_ts', _peopleCacheTs);

            shout('People Cache Refreshed');
        }

        function getPeopleCache() {
            checkCache();
            var _peopleCache = GM_SuperValue.get('people_cache');
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

        function getRequestType() {
            var id = nlapiGetFieldValue('custrecord_screq_type');
            return id;
        }

        function setRequestType() {
            nlapiSetFieldValue('custrecord_screq_type', 19, true);
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
            // assignee = Jeff Underdahl
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.jeff, true);
        }

        function setAssigneeKarl() {
            // assignee = Karl Eberhardt
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.karl, true);
        }

        function setAssigneeRebecca() {
            // assignee = Rebecca VanHousen
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.rebecca, true);
        }

        function setAssigneeRobyn() {
            // assignee = Robyn Reed
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.robyn, true);
        }

        function setAssigneeLauren() {
            // assignee = Lauren Casey
            nlapiSetFieldValue('custrecord_screq_assignee', _ids.lauren, true);
        }

        function setAssigneeJason() {
            // assignee = Jason Wells (EPM)
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
            var reg = /(#xvr[|,]?)/;
            if (!reg.test(hashtagFld)) {
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
            var reg = /(#emg[|,]?)/;
            if (!reg.test(hashtagFld)) {
                nlapiSetFieldValue('custrecord_screq_hashtags', tag + hashtagFld, true);
            }
            nlapiSetFieldValue('custrecord_screq_hashtags', tag + hashtagFld, true);
        }

        function setRecordCancelled() {
            // button action - cancelled
            setStatusCancelled();
            shout('Set status to Cancelled, and Assigned To to myself.')
        }

        function setRecordHold() {
            // button action - on hold
            setStatusHold();
            setAssigneeMe();
            shout('Set status to On Hold, and Assigned To to myself.')
        }

        function setRecordProductsEmg() {
            // button action - move to Products
            setStatusRequested();
            setAssigneeLauren();
            setXvert();
            setEmg();
            shout('Set to xvr and emg, and Assigned To Lauren Casey.')
        }

        function setRecordProductsUpm() {
            // button action - move to Products
            setStatusRequested();
            setAssigneeRobyn();
            setXvert();
            shout('Set to xvr, and Assigned To Robyn Reed.')
        }

        function setRecordGBEast() {
            // button action - move to GB
            setStatusRequested();
            setAssigneeKarl();
            setXvert();
            shout('Set to xvr, and Assigned To Karl Eberhardt.')
        }

        function setRecordGBWest() {
            // button action - move to GB
            setStatusRequested();
            setAssigneeRebecca();
            setXvert();
            shout('Set to xvr, and Assigned To Rebecca VanHousen.')
        }

        function setRecordHT() {
            // button action - move to HT
            setStatusRequested();
            setAssigneeJeff();
            setXvert();
            shout('Set to xvr, and Assigned to Jeff Underdahl.');
        }

        function setRecordEPM() {
            // button action - move to EPM
            setStatusRequested();
            setAssigneeJason();
            setXvert();
            shout('Set to xvr, and Assigned to Jason Wells.');
        }

        function openRequestModal() {
            // opens staffing modal form
            $('#scr-modal-request-form')
                .modal('show')
            ;
        }

        /**
         * DOM MANIPULATION
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
        $("#_xvertprodemg").click(
            function(event) {
                event.preventDefault();
                setRecordProductsEmg();
            }
        );
        $("#_xvertprodupm").click(
            function(event) {
                event.preventDefault();
                setRecordProductsUpm();
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

        $('#_legend')
            .popup()
        ;

        $('.ui.selection.dropdown')
            .dropdown({
                clearable: true
            })
        ;

        $('#scmindustry')
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
                match: 'text'
            })
        ;

        const initials = (settings.initials) ? settings.initials : "";

        var scValues = getPeopleCache();

        $('#solutionconsultant')
            .dropdown({
                clearable: false,
                showOnFocus: false,
                placeholder: 'Choose an SC',
                fullTextSearch: true,
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

        // Get the form element
        var $scrRequestForm = $('#scr-modal-request-form')
            .form('set value', 'screquestdetails', getRequestDetails())
            .form('set value', 'salesmanagernotes', getSalesManagerNotes())
            .form('set value', 'dateneeded', getDateNeeded())
            .form('set defaults', 'products', [])
            .form('set value', 'products', getProducts())
            .form({
                onSuccess: function(event, fields) {
                    event.preventDefault();
                    var allFields = $scrRequestForm.form('get values');
                    shout("Form data: " + JSON.stringify(allFields));

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

        // Get the form element
        var $scrNotesForm = $('#scr-modal-notes-form')
            .form({
                onSuccess: function(event, fields) {
                    event.preventDefault();
                    var allFields = $scrNotesForm.form('get values');
                    var staffingNotes = allFields.scmstaffingnotes;
                    var needsEmerging = allFields.needsemg;

                    var myDate = new Date();
                    var myDateString = ('0' + (myDate.getMonth()+1)).slice(-2) + '/' + ('0' + myDate.getDate()).slice(-2) + '/' + myDate.getFullYear();

                    var scmStaffingNotesPretty = `${myDateString} - ${staffingNotes} ${initials}\n\n`;

                    setStaffingNotes(scmStaffingNotesPretty);

                    if (needsEmerging === "on") { setEmg(); }
                }
            })
        ;
    }
})();
