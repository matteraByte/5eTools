"use strict";

window.onload = () => {
	doPageInit().catch(e => { throw e })
};

class PageUi {
	constructor () {
		this._builders = {};

		this._$menuInner = null;
		this._$wrpSource = null;
		this._$wrpMain = null;
		this._$wrpInput = null;
		this._$wrpInputControls = null;
		this._$wrpOutput = null;

		this._allSources = [];
		this._$selSource = null;

		this.__saveableStates = null;
		this.doSaveDebounced = MiscUtil.debounce(() => this._doSave(), 50);

		this._settings = {};
		this._saveSettingsDebounced = MiscUtil.debounce(() => this._doSaveSettings(), 50);
	}

	set creatureBuilder (creatureBuilder) { this._builders.creatureBuilder = creatureBuilder; }
	set spellBuilder (spellBuilder) { this._builders.spellBuilder = spellBuilder; }

	get $wrpInput () { return this._$wrpInput; }

	get $wrpInputControls () { return this._$wrpInputControls; }

	get $wrpOutput () { return this._$wrpOutput; }

	get $wrpSideMenu () { return this._$menuInner; }

	get source () { return this._settings.activeSource || ""; }

	get allSources () { return this._allSources; }

	set source (json) {
		this._$selSource.val(json);
		this._settings.activeSource = json;
		this._doHandleUpdateSource();
	}

	_doSave () {
		this.__saveableStates = this.__saveableStates || {builders: {}};

		Object.entries(this._builders).forEach(([name, builder]) => {
			if (!this.__saveableStates.builders[name] || builder.isStateDirty) {
				this.__saveableStates.builders[name] = builder.getSaveableState();
				builder.isStateDirty = false;
			}
		});
		StorageUtil.pSetForPage(PageUi.STORAGE_STATE, this.__saveableStates);
	}

	_doSaveSettings () { StorageUtil.pSetForPage(PageUi.STORAGE_SETTINGS, this._settings); }

	async init () {
		this._settings = await StorageUtil.pGetForPage(PageUi.STORAGE_SETTINGS) || {};

		this._$wrpLoad = $(`#page_loading`);
		this._$wrpSource = $(`#page_source`);
		this._$wrpMain = $(`#page_main`);

		this._settings.activeBuilder = this._settings.activeBuilder || "creatureBuilder";

		this._initLhs();
		this._initRhs();
		this._initSideMenu();

		const storedState = await StorageUtil.pGetForPage(PageUi.STORAGE_STATE) || {};
		if (storedState.builders) {
			Object.entries(storedState.builders).forEach(([name, state]) => {
				if (this._builders[name]) this._builders[name].setStateFromLoaded(state);
			});
		}

		this._doRenderActiveBuilder();
		this._doInitNavHandler();

		if (!this._settings.activeSource || !BrewUtil.homebrewMeta.sources.some(it => it.json === this._settings.activeSource)) {
			this._doRebuildStageSource({mode: "add", isRequired: true});
			this.__setStageSource();
		} else {
			this.__setStageMain();
			this._sideMenuEnabled = true;
		}
	}

	__setStageSource () {
		this._$wrpLoad.hide();
		this._$wrpSource.show();
		this._$wrpMain.hide()
	}

	__setStageMain () {
		this._$wrpLoad.hide();
		this._$wrpSource.hide();
		this._$wrpMain.show()
	}

	_doRebuildStageSource (options) {
		SourceUiUtil.render({
			...options,
			$parent: this._$wrpSource,
			cbConfirm: (source) => {
				const isNewSource = options.mode !== "edit";

				if (isNewSource) BrewUtil.addSource(source);
				else BrewUtil.updateSource(source);

				this._settings.activeSource = source.json;

				if (isNewSource) this._doAddSourceOption(source);
				this._doHandleUpdateSource();
				this._sideMenuEnabled = true;
				this.__setStageMain();
			},
			cbConfirmExisting: (source) => {
				this._settings.activeSource = source.json;
				this._doHandleUpdateSource();
				this._sideMenuEnabled = true;
				this.__setStageMain();
			},
			cbCancel: () => {
				this._sideMenuEnabled = true;
				this.__setStageMain();
			}
		});
	}

	_initLhs () {
		this._$wrpInput = $(`#content_input`);
		this._$wrpInputControls = $(`#content_input_controls`);
	}

	_initRhs () {
		this._$wrpOutput = $(`#content_output`);
	}

	_initSideMenu () {
		const $mnu = $(`.sidemenu`);

		const prevMode = this._settings.activeBuilder;

		const $wrpMode = $(`<div class="sidemenu__row split-v-center"><div class="sidemenu__row__label mr-2">Mode</div></div>`).appendTo($mnu);
		const $selMode = $(`
			<select class="form-control input-xs">
				<option value="creatureBuilder">Creature</option>
				<option value="spellBuilder">Spell</option>
			</select>
		`).appendTo($wrpMode).change(() => {
			this._settings.activeBuilder = $selMode.val();
			const builder = this._builders[this._settings.activeBuilder];
			builder.renderInput();
			builder.renderOutput();
			builder.renderSideMenu();
			this._saveSettingsDebounced();
		});

		$mnu.append(PageUi.__$getSideMenuDivider(true));

		const $wrpSource = $(`<div class="sidemenu__row split-v-center"><div class="sidemenu__row__label mr-2">Source</div></div>`).appendTo($mnu);
		this._allSources = (BrewUtil.homebrewMeta.sources || []).sort((a, b) => SortUtil.ascSortLower(a.full, b.full))
			.map(it => it.json);
		this._$selSource = $$`
			<select class="form-control input-xs">
				<option disabled>Select</option>
				${this._allSources.map(s => `<option value="${s.escapeQuotes()}">${Parser.sourceJsonToFull(s).escapeQuotes()}</option>`)}
			</select>`
			.appendTo($wrpSource)
			.change(() => {
				this._settings.activeSource = this._$selSource.val();
				this._doHandleUpdateSource();
			});
		if (this._settings.activeSource) this._$selSource.val(this._settings.activeSource);
		else this._$selSource[0].selectedIndex = 0;

		const $btnSourceEdit = $(`<button class="btn btn-default btn-xs mr-2">Edit Selected Source</button>`)
			.click(() => {
				const curSourceJson = this._settings.activeSource;
				const curSource = BrewUtil.sourceJsonToSource(curSourceJson);
				if (!curSource) return;
				this._doRebuildStageSource({mode: "edit", source: MiscUtil.copy(curSource)});
				this.__setStageSource();
			});
		$$`<div class="sidemenu__row">${$btnSourceEdit}</div>`.appendTo($mnu);

		const $btnSourceAdd = $(`<button class="btn btn-default btn-xs">Add New Source</button>`).click(() => {
			this._doRebuildStageSource({mode: "add"});
			this.__setStageSource();
		});
		$$`<div class="sidemenu__row">${$btnSourceAdd}</div>`.appendTo($mnu);

		$mnu.append(PageUi.__$getSideMenuDivider(true));
		this._$menuInner = $(`<div/>`).appendTo($mnu);

		if (prevMode) $selMode.val(prevMode).change();
	}

	set _sideMenuEnabled (val) { $(`.sidemenu__toggle`).toggle(!!val); }

	static __$getSideMenuDivider (heavy) {
		return $(`<hr class="sidemenu__row__divider ${heavy ? "sidemenu__row__divider--heavy" : ""}">`);
	}

	_doRenderActiveBuilder () {
		const activeBuilder = this._builders[this._settings.activeBuilder];
		activeBuilder.renderInput();
		activeBuilder.renderOutput();
	}

	_doInitNavHandler () {
		// More obnoxious than useful (the form is auto-saved automatically); disabled until further notice
		/*
		$(window).on("beforeunload", evt => {
			const message = this._builders[this._settings.activeBuilder].getOnNavMessage();
			if (message) {
				(evt || window.event).message = message;
				return message;
			}
		});
		*/
	}

	_doAddSourceOption (source) {
		this._allSources.push(source.json);
		// TODO this should detach + re-order. Ensure correct is re-selected; ensure disabled option is first
		this._$selSource.append(`<option value="${source.json.escapeQuotes()}">${source.full.escapeQuotes()}</option>`);
		this._builders[this._settings.activeBuilder].doHandleSourcesAdd();
	}

	_doHandleUpdateSource () {
		if (this._$selSource) this._$selSource.val(this._settings.activeSource);
		this._saveSettingsDebounced();
		this._builders[this._settings.activeBuilder].doHandleSourceUpdate();
	}

	_getJsonOutputTemplate () {
		return {
			_meta: {sources: [MiscUtil.copy(BrewUtil.sourceJsonToSource(this._settings.activeSource))]},
			dateAdded: Math.round(Date.now() / 1000)
		};
	}
}
PageUi.STORAGE_STATE = "brewbuilderState";
PageUi.STORAGE_SETTINGS = "brewbuilderSettings";

class Builder extends ProxyBase {
	static async pInitAll () {
		return Promise.all(Builder._BUILDERS.map(b => b.pInit()))
	}

	/**
	 * @param opts Options object.
	 * @param opts.titleSidebarLoadExisting Text for "Load Existing" sidebar button.
	 * @param opts.titleSidebarDownloadJson Text for "Download JSON" sidebar button.
	 * @param opts.prop Homebrew prop.
	 */
	constructor (opts) {
		super();
		opts = opts || {};
		this._titleSidebarLoadExisting = opts.titleSidebarLoadExisting;
		this._titleSidebarDownloadJson = opts.titleSidebarDownloadJson;
		this._prop = opts.prop;

		Builder._BUILDERS.push(this);
		TabUiUtil.decorate(this);

		this._ui = null;
		this._isStateDirty = false;
		this._isEntrySaved = true;

		this._sourcesCache = []; // the JSON sources from the main UI
		this._$selSource = null;
		this._cbCache = null;

		this.__state = this._getInitialState();
		this._state = null; // proxy used to access state
		this.__meta = this.getInitialMetaState(); // meta state
		this._meta = null; // proxy used to access meta state
		this.doCreateProxies(); // init proxies

		this._$btnSave = null;
		this._$sideMenuStageSaved = null;
		this._$sideMenuWrpList = null;
		this._$eles = {}; // Generic internal element storage
	}

	doCreateProxies () {
		this._resetHooks("state");
		this._resetHooks("meta");
		this._state = this._getProxy("state", this.__state);
		this._meta = this._getProxy("meta", this.__meta);
	}

	set ui (ui) { this._ui = ui; }

	get isStateDirty () { return this._isStateDirty; }
	set isStateDirty (val) { this._isStateDirty = val; }

	get isEntrySaved () { return this._isEntrySaved; }
	set isEntrySaved (val) { this._isEntrySaved = val; }

	getSaveableState () {
		return {
			s: this.__state,
			m: this.__meta,
			// parent/other meta-state
			_m: {
				isEntrySaved: this.isEntrySaved
			}
		}
	}

	setStateFromLoaded () { throw new TypeError(`Unimplemented method!`); }

	doHandleSourceUpdate () {
		const nuSource = this._ui.source;

		// if the source we were using is gone, update
		if (!this._sourcesCache.includes(nuSource)) {
			this._state.source = nuSource;
			this._sourcesCache = MiscUtil.copy(this._ui.allSources);

			const $cache = this._$selSource;
			this._$selSource = this.$getSourceInput(this._cbCache);
			$cache.replaceWith(this._$selSource);
		}

		this.renderInput();
		this.renderOutput();
		this.renderSideMenu();
		this.doUiSave();
	}

	$getSourceInput (cb) {
		return BuilderUi.$getStateIptEnum(
			"Source",
			cb,
			this._state,
			{
				vals: this._sourcesCache, fnDisplay: Parser.sourceJsonToFull, type: "string", nullable: false
			},
			"source"
		);
	}

	doUiSave () {
		// set our state to dirty, and trigger a save at a higher level
		this._isStateDirty = true;
		this._ui.doSaveDebounced();
	}

	renderSideMenu () {
		this._ui.$wrpSideMenu.empty();

		const $btnLoadExisting = $(`<button class="btn btn-xs btn-default">${this._titleSidebarLoadExisting}</button>`)
			.click(() => this.handleSidebarLoadExistingClick());
		$$`<div class="sidemenu__row">${$btnLoadExisting}</div>`.appendTo(this._ui.$wrpSideMenu);

		const $btnDownloadJson = $(`<button class="btn btn-default btn-xs mb-2">${this._titleSidebarDownloadJson}</button>`)
			.click(() => this.handleSidebarDownloadJsonClick());

		this._$sideMenuWrpList = $(`<div class="sidemenu__row flex-col">`);
		this._$sideMenuStageSaved = $$`<div>
		${PageUi.__$getSideMenuDivider().hide()}
		<div class="flex-v-center">${$btnDownloadJson}</div>
		${this._$sideMenuWrpList}
		</div>`.appendTo(this._ui.$wrpSideMenu);

		this.doUpdateSidemenu();
	}

	get ixBrew () { return this._meta.ixBrew; }
	set ixBrew (val) { this._meta.ixBrew = val; }

	getOnNavMessage () {
		if (!this.isEntrySaved && ~this.ixBrew) return "You have unsaved changes! Are you sure you want to leave?";
		else return null;
	}

	getSideMenuItems () {
		return MiscUtil.copy((BrewUtil.homebrew[this._prop] || []).filter(entry => entry.source === this._ui.source))
			.sort((a, b) => SortUtil.ascSort(a.name, b.name));
	}

	doUpdateSidemenu () {
		this._$sideMenuWrpList.empty();

		const toList = this.getSideMenuItems();
		this._$sideMenuStageSaved.toggle(!!toList.length);

		toList.forEach(entry => {
			const ixBrew = BrewUtil.getEntryIxByName(this._prop, entry);

			const $btnEdit = $(`<button class="btn btn-xs btn-default mr-2" title="Edit"><span class="glyphicon glyphicon-pencil"/></button>`)
				.click(() => {
					if (this.getOnNavMessage() && !confirm("You have unsaved changes. Are you sure?")) return;
					this.setStateFromLoaded({s: MiscUtil.copy(entry), m: {...this.getInitialMetaState(), ixBrew}});
					this.renderInput();
					this.renderOutput();
					this.doUiSave();
				});

			const contextId = ContextUtil.getNextGenericMenuId();
			const _CONTEXT_OPTIONS = [
				{
					name: "Duplicate",
					action: async () => {
						const copy = MiscUtil.copy(entry);

						// Get the root name without trailing numbers, e.g. "Goblin (2)" -> "Goblin"
						const m = /^(.*?) \((\d+)\)$/.exec(entry.name.trim());
						if (m) copy.name = `${m[1]} (${Number(m[2]) + 1})`;
						else copy.name = `${copy.name} (1)`;
						await BrewUtil.pAddEntry(this._prop, copy);
						this.doUpdateSidemenu();
					}
				},
				{
					name: "View JSON",
					action: (evt) => {
						const out = this._ui._getJsonOutputTemplate();
						out[this._prop] = [PropOrder.getOrdered(DataUtil.cleanJson(MiscUtil.copy(entry)), this._prop)];

						const popoutCodeId = Renderer.hover.__initOnMouseHoverEntry({
							type: "code",
							name: `${this._state.name} \u2014 Source Data`,
							preformatted: JSON.stringify(out, null, "\t")
						});
						$btnBurger.attr("data-hover-active", false);
						Renderer.hover.mouseOverHoverTooltip({shiftKey: true, clientX: evt.clientX}, $btnBurger[0], popoutCodeId, true);
					}
				},
				{
					name: "Download JSON",
					action: () => {
						const out = this._ui._getJsonOutputTemplate();
						out[this._prop] = [DataUtil.cleanJson(MiscUtil.copy(entry))];
						DataUtil.userDownload(DataUtil.getCleanFilename(entry.name), out);
					}
				}
			];
			ContextUtil.doInitContextMenu(contextId, (evt, ele, $invokedOn, $selectedMenu) => {
				const val = Number($selectedMenu.data("ctx-id"));
				_CONTEXT_OPTIONS[val].action(evt, $invokedOn);
			}, _CONTEXT_OPTIONS.map(it => it.name));

			const $btnBurger = $(`<button class="btn btn-xs btn-default mr-2" title="More Options"><span class="glyphicon glyphicon-option-vertical"/></button>`)
				.click(evt => ContextUtil.handleOpenContextMenu(evt, $btnBurger, contextId));

			const $btnDelete = $(`<button class="btn btn-xs btn-danger" title="Delete"><span class="glyphicon glyphicon-trash"/></button>`)
				.click(async () => {
					if (confirm("Are you sure?")) {
						if (this.ixBrew === ixBrew) {
							this.isEntrySaved = false;
							this.ixBrew = null;
							this.mutSavedButtonText();
						} else if (this.ixBrew > ixBrew) {
							this.ixBrew--; // handle the splice -- our index is not one lower
						}
						await BrewUtil.pRemoveEntry(this._prop, entry);
						this.doUpdateSidemenu();
					}
				});

			$$`<div class="mkbru__sidebar-entry flex-v-center split px-2">
			<span class="py-1">${entry.name}</span>
			<div class="py-1 no-shrink">${$btnEdit}${$btnBurger}${$btnDelete}</div>
			</div>`.appendTo(this._$sideMenuWrpList);
		});
	}

	handleSidebarDownloadJsonClick () {
		const out = this._ui._getJsonOutputTemplate();
		out[this._prop] = (BrewUtil.homebrew[this._prop] || []).filter(entry => entry.source === this._ui.source).map(entry => PropOrder.getOrdered(DataUtil.cleanJson(MiscUtil.copy(entry)), this._prop));
		DataUtil.userDownload(DataUtil.getCleanFilename(BrewUtil.sourceJsonToFull(this._ui.source)), out);
	}

	renderInputControls () {
		const $wrpControls = this._ui.$wrpInputControls.empty();

		this._$btnSave = BuilderUi.$getSaveButton().click(async () => {
			await this._renderInputControls_pSaveBrew();
			this.doUpdateSidemenu();
		}).appendTo($wrpControls);

		BuilderUi.$getResetButton().click(() => {
			if (!confirm("Are you sure?")) return;
			this.setStateFromLoaded({s: this._getInitialState(), m: this.getInitialMetaState()});
			this.renderInput();
			this.renderOutput();
			this.isEntrySaved = true;
			this.mutSavedButtonText();
			this.doUiSave();
		}).appendTo($wrpControls);
	}

	async _renderInputControls_pSaveBrew () {
		if (this.ixBrew != null) {
			await BrewUtil.pUpdateEntryByIx(this._prop, this.ixBrew, MiscUtil.copy(this.__state));
			this.renderSideMenu();
		} else {
			const cpy = MiscUtil.copy(this.__state);
			this.ixBrew = await BrewUtil.pAddEntry(this._prop, cpy);
			await Omnisearch.pAddToIndex(this._prop, cpy);
			await SearchWidget.P_LOADING_CONTENT;
			SearchWidget.addToIndexes(this._prop, cpy);
		}
		this.isEntrySaved = true;
		this.mutSavedButtonText();
		this.doUiSave();
	}

	mutSavedButtonText () {
		if (this._$btnSave) this._$btnSave.text(this.isEntrySaved ? "Saved" : "Save *");
	}

	// TODO use this in creature builder
	/**
	 * @param doUpdateState
	 * @param rowArr
	 * @param row
	 * @param $wrpRow
	 * @param title
	 * @param [opts] Options object.
	 * @param [opts.isProtectLast]
	 * @param [opts.isExtraSmall]
	 * @return {JQuery}
	 */
	static $getBtnRemoveRow (doUpdateState, rowArr, row, $wrpRow, title, opts) {
		opts = opts || {};

		return $(`<button class="btn ${opts.isExtraSmall ? "btn-xxs" : "btn-xs"} btn-danger mb-2 ${opts.isProtectLast ? "mkbru__btn-rm-row" : ""}" title="Remove ${title}"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => {
				rowArr.splice(rowArr.indexOf(row), 1);
				$wrpRow.empty().remove();
				doUpdateState();
			});
	}

	doHandleSourcesAdd () { throw new TypeError(`Unimplemented method!`); }
	renderInput () { throw new TypeError(`Unimplemented method!`); }
	renderOutput () { throw new TypeError(`Unimplemented method!`); }
	handleSidebarLoadExistingClick () { throw new TypeError(`Unimplemented method!`); }
	getInitialMetaState () { return {}; }
	async pInit () {}
}
Builder._BUILDERS = [];

class BuilderUi {
	static $getSaveButton () {
		return $(`<button class="btn btn-xs btn-default mr-2 mkbru__cnt-save">Save</button>`);
	}

	static $getResetButton () {
		return $(`<button class="btn btn-xs btn-default">Reset</button>`);
	}

	static __setProp (toVal, options, state, ...path) {
		if (path.length > 1) {
			let cur = state;
			for (let i = 0; i < path.length - 1; ++i) cur = state[path[i]];

			if (toVal == null) {
				delete cur[path.last()];
				return null;
			} else return cur[path.last()] = toVal;
		} else {
			if (toVal == null) {
				delete state[path[0]];
				return null;
			} else return state[path[0]] = toVal;
		}
	}

	/**
	 *
	 * @param name Row name.
	 * @param [options] Options object.
	 * @param [options.eleType] HTML element to use.
	 * @param [options.isMarked] If a "group" vertical marker should be displayed between the name and the row body.
	 * @param [options.isRow] If the row body should use flex row (instead of flex col).
	 * @param [options.title] Tooltip text.
	 */
	static getLabelledRowTuple (name, options) {
		options = options || {};

		const eleType = options.eleType || "div";

		const $rowInner = $(`<div class="${options.isRow ? "flex" : "flex-col"} w-100"/>`);
		const $row = $$`<div class="mb-2 mkbru__row stripe-even"><${eleType} class="mkbru__wrp-row flex-v-center"><span class="mr-2 mkbru__row-name ${options.isMarked ? `mkbru__row-name--marked` : ""} ${options.title ? "help" : ""}" ${options.title ? `title="${options.title}"` : ""}>${name}</span>${options.isMarked ? `<div class="mkbru__row-mark mr-2"/>` : ""}${$rowInner}</${eleType}></div>`;
		return [$row, $rowInner];
	}

	static __$getRow (name, $ipt, options) {
		options = options || {};

		const eleType = options.eleType || "div";

		return $$`<div class="mb-2 mkbru__row stripe-even"><${eleType} class="mkbru__wrp-row flex-v-center">
		<span class="mr-2 mkbru__row-name ${options.title ? "help" : ""}" ${options.title ? `title="${options.title}"` : ""}>${name}</span>
		${$ipt}
		<${eleType}/></div>`
	}

	static $getStateIptString (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const initialState = MiscUtil.get(state, ...path);
		const $ipt = $(`<input class="form-control input-xs form-control--minimal ${options.type ? `type="${options.type}"` : ""}">`)
			.val(initialState)
			.change(() => {
				const raw = $ipt.val().trim();
				const set = BuilderUi.__setProp(raw || !options.nullable ? raw : null, options, state, ...path);
				fnRender();
				if (options.callback) options.callback(set);
			});
		return BuilderUi.__$getRow(name, $ipt, options);
	}

	/**
	 * @param name
	 * @param fnRender
	 * @param state
	 * @param options
	 * @param [options.nullable]
	 * @param [options.placeholder]
	 * @param [options.withHeader]
	 * @param path
	 * @return {*}
	 */
	static $getStateIptEntries (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		let initialState = MiscUtil.get(state, ...path);
		if (options.withHeader && initialState) initialState = initialState[0].entries;

		const $ipt = $(`<textarea class="form-control form-control--minimal resize-vertical" ${options.placeholder ? `placeholder="${options.placeholder}"` : ""}/>`)
			.val(UiUtil.getEntriesAsText(initialState))
			.change(() => {
				const raw = $ipt.val().trim();
				let out = raw || !options.nullable ? UiUtil.getTextAsEntries(raw) : null;
				if (options.withHeader) {
					out = [
						{
							name: options.withHeader,
							entries: out
						}
					];
				}
				BuilderUi.__setProp(out, options, state, ...path);
				fnRender();
			});
		return BuilderUi.__$getRow(name, $ipt, options);
	}

	static $getStateIptStringArray (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple(name, {isMarked: true});
		const initialState = MiscUtil.get(state, ...path) || [];
		const stringRows = [];

		const doUpdateState = () => {
			const raw = stringRows.map(row => row.getState()).filter(it => it.trim());
			BuilderUi.__setProp(raw.length || !options.nullable ? raw : null, options, state, ...path);
			fnRender();
		};

		const $wrpRows = $(`<div/>`).appendTo($rowInner);
		initialState.forEach(string => BuilderUi._$getStateIptStringArray_getRow(doUpdateState, stringRows, string).$wrp.appendTo($wrpRows));

		const $wrpBtnAdd = $(`<div/>`).appendTo($rowInner);
		$(`<button class="btn btn-xs btn-default">Add ${options.shortName}</button>`)
			.appendTo($wrpBtnAdd)
			.click(() => {
				BuilderUi._$getStateIptStringArray_getRow(doUpdateState, stringRows).$wrp.appendTo($wrpRows);
				doUpdateState();
			});

		return $row;
	}

	static _$getStateIptStringArray_getRow (doUpdateState, stringRows, initialString) {
		const getState = () => $iptString.val().trim();

		const $iptString = $(`<input class="form-control form-control--minimal input-xs mr-2">`)
			.change(() => doUpdateState());
		if (initialString && initialString.trim()) $iptString.val(initialString);

		const $btnRemove = $(`<button class="btn btn-xs btn-danger" title="Remove Row"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => {
				stringRows.splice(stringRows.indexOf(out), 1);
				$wrp.empty().remove();
				doUpdateState();
			});

		const $wrp = $$`<div class="flex-v-center mb-2">${$iptString}${$btnRemove}</div>`;
		const out = {$wrp, getState};
		stringRows.push(out);
		return out;
	}

	static $getStateIptNumber (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const initialState = MiscUtil.get(state, ...path);
		const $ipt = $(`<input class="form-control input-xs form-control--minimal" type="number" ${options.placeholder ? `placeholder="${options.placeholder}"` : ""}>`)
			.val(initialState)
			.change(() => {
				const raw = $ipt.val().trim();
				BuilderUi.__setProp(raw || !options.nullable ? Number(raw) : null, options, state, ...path);
				fnRender();
			});
		return BuilderUi.__$getRow(name, $ipt, options);
	}

	/**
	 * @param name
	 * @param fnRender
	 * @param state
	 * @param options Options object.
	 * @param options.nullable
	 * @param options.fnDisplay
	 * @param options.vals
	 * @param path
	 */
	static $getStateIptEnum (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const initialState = MiscUtil.get(state, ...path);
		const $sel = $(`<select class="form-control input-xs form-control--minimal">`);
		if (options.nullable) $sel.append(`<option value="-1">(None)</option>`);
		options.vals.forEach((v, i) => $(`<option>`).val(i).text(options.fnDisplay ? options.fnDisplay(v) : v).appendTo($sel));
		const ixInitial = options.vals.indexOf(initialState);
		$sel.val(ixInitial)
			.change(() => {
				const ixOut = Number($sel.val());
				const out = ~ixOut ? options.vals[ixOut] : null;
				BuilderUi.__setProp(out, options, state, ...path);
				fnRender();
			});
		return BuilderUi.__$getRow(name, $sel, options);
	}

	static $getStateIptBoolean (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const initialState = MiscUtil.get(state, ...path);
		const $ipt = $(`<input class="mkbru__ipt-cb" type="checkbox">`)
			.prop("checked", initialState)
			.change(() => {
				// assumes false => null, unless not nullable
				const raw = !!$ipt.prop("checked");
				BuilderUi.__setProp(raw || !options.nullable ? raw : null, options, state, ...path);
				fnRender();
			});
		return BuilderUi.__$getRow(name, $$`<div class="w-100 flex-v-center">${$ipt}</div>`, {...options, eleType: "label"});
	}

	/**
	 * @param name
	 * @param fnRender
	 * @param state
	 * @param options
	 * @param options.vals
	 * @param [options.nullable]
	 * @param [options.fnDisplay]
	 * @param path
	 * @return {*}
	 */
	static $getStateIptBooleanArray (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple(name, {isMarked: true});

		const initialState = MiscUtil.get(state, ...path) || [];
		const $wrpIpts = $(`<div class="flex-col w-100 mr-2"/>`).appendTo($rowInner);
		const inputs = [];
		options.vals.forEach(val => {
			const $cb = $(`<input class="mkbru__ipt-cb" type="checkbox">`)
				.prop("checked", initialState.includes(val))
				.change(() => {
					BuilderUi.__setProp(getState(), options, state, ...path);
					fnRender();
				});
			inputs.push({$ipt: $cb, val});
			$$`<label class="flex-v-center split stripe-odd--faint"><span>${options.fnDisplay ? options.fnDisplay(val) : val}</span>${$cb}</label>`.appendTo($wrpIpts);
		});

		const getState = () => {
			const raw = inputs.map(it => it.$ipt.prop("checked") ? it.val : false).filter(Boolean);
			return raw.length || !options.nullable ? raw : null;
		};

		return $row;
	}

	static async pGetUserSpellSearch (options) {
		options = options || {};
		await SearchWidget.P_LOADING_CONTENT;
		return new Promise(resolve => {
			const searchOpts = {defaultCategory: "alt_Spell"};
			if (options.level != null) searchOpts.resultFilter = (result) => result.lvl === options.level;

			const searchWidget = new SearchWidget(
				{alt_Spell: SearchWidget.CONTENT_INDICES.alt_Spell},
				(page, source, hash) => {
					const [encName, encSource] = hash.split(HASH_LIST_SEP);
					doClose(false); // "cancel" close
					resolve(`{@spell ${decodeURIComponent(encName)}${encSource !== UrlUtil.encodeForHash(SRC_PHB) ? `|${decodeURIComponent(encSource)}` : ""}}`)
				},
				searchOpts
			);
			const {$modalInner, doClose} = UiUtil.getShowModal({
				title: "Select Spell",
				cbClose: (doResolve) => {
					searchWidget.$wrpSearch.detach();
					if (doResolve) resolve(null); // ensure resolution
				}
			});
			$modalInner.append(searchWidget.$wrpSearch);
			searchWidget.doFocus();
		});
	}

	/**
	 * @param $ipt The input to sort.
	 * @param cb Callback function.
	 * @param sortOptions Sort order options.
	 * @param sortOptions.bottom Regex patterns that, should a token match, that token should be sorted to the end. Warning: slow.
	 */
	static $getSplitCommasSortButton ($ipt, cb, sortOptions) {
		sortOptions = sortOptions || {};
		return $(`<button class="btn btn-xs btn-default">Sort</button>`)
			.click(() => {
				const spl = $ipt.val().split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX);
				$ipt.val(spl.sort((a, b) => {
					if (sortOptions.bottom) {
						const ixA = sortOptions.bottom.findIndex(re => {
							const m = re.test(a);
							re.lastIndex = 0;
							return m;
						});
						const ixB = sortOptions.bottom.findIndex(re => {
							const m = re.test(b);
							re.lastIndex = 0;
							return m;
						});

						if (~ixA && ~ixB) return 0;
						else if (~ixA) return 1;
						else if (~ixB) return -1;
						else return SortUtil.ascSortLower(a, b);
					} else return SortUtil.ascSortLower(a, b);
				}).join(", "));
				cb();
			});
	}

	static $getUpButton (cbUpdate, rows, myRow) {
		return $(`<button class="btn btn-xs btn-default mkbru__btn-up-row ml-2" title="Move Up"><span class="glyphicon glyphicon-arrow-up"/></button>`)
			.click(() => {
				const ix = rows.indexOf(myRow);
				const cache = rows[ix - 1];
				rows[ix - 1] = myRow;
				rows[ix] = cache;
				cbUpdate();
			})
	}

	static $getDownButton (cbUpdate, rows, myRow) {
		return $(`<button class="btn btn-xs btn-default mkbru__btn-down-row ml-2" title="Move Down"><span class="glyphicon glyphicon-arrow-down"/></button>`)
			.click(() => {
				const ix = rows.indexOf(myRow);
				const cache = rows[ix + 1];
				rows[ix + 1] = myRow;
				rows[ix] = cache;
				cbUpdate();
			})
	}

	static $getDragPad (cbUpdate, rows, myRow, options) {
		const dragMeta = {};
		const doDragCleanup = () => {
			dragMeta.on = false;
			dragMeta.$wrap.remove();
			dragMeta.$dummies.forEach($d => $d.remove());
		};

		const doDragRender = () => {
			if (dragMeta.on) doDragCleanup();

			dragMeta.on = true;
			dragMeta.$wrap = $(`<div class="flex-col ui-drag__wrp-drag-block"/>`).appendTo(options.$wrpRowsOuter);
			dragMeta.$dummies = [];

			const ixRow = rows.indexOf(myRow);

			rows.forEach((row, i) => {
				const dimensions = {w: row.$ele.outerWidth(true), h: row.$ele.outerHeight(true)};
				const $dummy = $(`<div class="${i === ixRow ? "ui-drag__wrp-drag-dummy--highlight" : "ui-drag__wrp-drag-dummy--lowlight"}"/>`)
					.width(dimensions.w).height(dimensions.h)
					.mouseup(() => {
						if (dragMeta.on) {
							doDragCleanup();
						}
					})
					.appendTo(dragMeta.$wrap);
				dragMeta.$dummies.push($dummy);

				if (i !== ixRow) { // on entering other areas, swap positions
					$dummy.mouseenter(() => {
						const cache = rows[i];
						rows[i] = myRow;
						rows[ixRow] = cache;

						if (options.cbSwap) options.cbSwap(cache);

						cbUpdate();
						doDragRender();
					});
				}
			});
		};

		return $(`<div class="ml-2 ui-drag__patch" title="Drag to Reorder">
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		</div>`).mousedown(() => doDragRender());
	}
}

async function doPageInit () {
	// generic init
	ExcludeUtil.pInitialise(); // don't await, as this is only used for search
	try {
		await BrewUtil.pAddBrewData();
		await BrewUtil.pAddLocalBrewData();
	} catch (e) {
		await BrewUtil.pPurgeBrew(e);
	}
	await SearchUiUtil.pDoGlobalInit();
	// Do this asynchronously, to avoid blocking the load
	SearchWidget.pDoGlobalInit();

	// page-specific init
	await Builder.pInitAll();
	Renderer.utils.bindPronounceButtons();
	return ui.init();
}

const ui = new PageUi();
