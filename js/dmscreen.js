"use strict";

const UP = "UP";
const RIGHT = "RIGHT";
const LEFT = "LEFT";
const DOWN = "DOWN";
const AX_X = "AXIS_X";
const AX_Y = "AXIS_Y";

const EVT_NAMESPACE = ".dm_screen";

const TITLE_LOADING = "Loading...";

const PANEL_TYP_EMPTY = 0;
const PANEL_TYP_STATS = 1;
const PANEL_TYP_ROLLBOX = 2;
const PANEL_TYP_TEXTBOX = 3;
const PANEL_TYP_RULES = 4;
const PANEL_TYP_INITIATIVE_TRACKER = 5;
const PANEL_TYP_UNIT_CONVERTER = 6;
const PANEL_TYP_CREATURE_SCALED_CR = 7;
const PANEL_TYP_SUNDIAL = 8;
const PANEL_TYP_MONEY_CONVERTER = 9;
const PANEL_TYP_TUBE = 10;
const PANEL_TYP_TWITCH = 11;
const PANEL_TYP_TWITCH_CHAT = 12;
const PANEL_TYP_ADVENTURES = 13;
const PANEL_TYP_BOOKS = 14;
const PANEL_TYP_IMAGE = 20;
const PANEL_TYP_GENERIC_EMBED = 90;

class Board {
	constructor () {
		this.panels = {};
		this.exiledPanels = [];
		this.$creen = $(`.dm-screen`);
		this.width = this.getInitialWidth();
		this.height = this.getInitialHeight();
		this.sideMenu = new SideMenu(this);
		this.menu = new AddMenu();
		this.isFullscreen = false;
		this.isLocked = false;
		this.reactor = new Reactor();

		this.nextId = 1;
		this.hoveringPanel = null;
		this.availContent = {};
		this.availRules = {};
		this.availAdventures = {};
		this.availBooks = {};

		this.$cbConfirmTabClose = null;
		this.$btnFullscreen = null;
		this.$btnLockPanels = null;

		this._pDoSaveStateDebounced = MiscUtil.debounce(() => StorageUtil.pSet(DMSCREEN_STORAGE, this.getSaveableState()), 25);
	}

	getInitialWidth () {
		const scW = this.$creen.width();
		return Math.ceil(scW / 400);
	}

	getInitialHeight () {
		const scH = this.$creen.height();
		return Math.ceil(scH / 300);
	}

	getNextId () {
		return this.nextId++;
	}

	get$creen () {
		return this.$creen;
	}

	getWidth () {
		return this.width;
	}

	getHeight () {
		return this.height;
	}

	getConfirmTabClose () {
		return this.$cbConfirmTabClose == null ? false : this.$cbConfirmTabClose.prop("checked");
	}

	setDimensions (width, height) {
		const oldWidth = this.width;
		const oldHeight = this.height;
		if (width) this.width = Math.max(width, 1);
		if (height) this.height = Math.max(height, 1);
		if (!(oldWidth === width && oldHeight === height)) {
			this.doAdjust$creenCss();
			if (width < oldWidth || height < oldHeight) this.doCullPanels(oldWidth, oldHeight);
			this.sideMenu.doUpdateDimensions();
		}
		this.doCheckFillSpaces();
		this.reactor.fire("panelResize");
	}

	doCullPanels (oldWidth, oldHeight) {
		for (let x = oldWidth - 1; x >= 0; x--) {
			for (let y = oldHeight - 1; y >= 0; y--) {
				const p = this.getPanel(x, y);
				if (!p) continue; // happens when a large panel gets shrunk
				if (x >= this.width && y >= this.height) {
					if (p.canShrinkBottom() && p.canShrinkRight()) {
						p.doShrinkBottom();
						p.doShrinkRight();
					} else p.exile();
				} else if (x >= this.width) {
					if (p.canShrinkRight()) p.doShrinkRight();
					else p.exile();
				} else if (y >= this.height) {
					if (p.canShrinkBottom()) p.doShrinkBottom();
					else p.exile();
				}
			}
		}
	}

	doAdjust$creenCss () {
		// assumes 7px grid spacing
		this.$creen.css({
			marginTop: this.isFullscreen ? 0 : 3,
			gridGap: 7,
			width: `calc(100% - ${this._getWidthAdjustment()}px)`,
			height: `calc(100% - ${this._getHeightAdjustment()}px)`,
			gridAutoColumns: `${(1 / this.width) * 100}%`,
			gridAutoRows: `${(1 / this.height) * 100}%`
		});
	}

	_getWidthAdjustment () {
		return (this.width - 1) * 7;
	}

	_getHeightAdjustment () {
		const panelPart = (this.height - 1) * 7;
		if (this.isFullscreen) return panelPart;
		else return 81 + panelPart; // 81 magical pixels
	}

	getPanelDimensions () {
		const w = this.$creen.outerWidth() + this._getWidthAdjustment();
		const h = this.$creen.outerHeight() + this._getHeightAdjustment();
		return {
			pxWidth: w / this.width,
			pxHeight: h / this.height
		};
	}

	doShowLoading () {
		$(`<div class="dm-screen-loading"><span class="initial-message">Loading...</span></div>`).css({
			gridColumnStart: "1",
			gridColumnEnd: String(this.width + 1),
			gridRowStart: "1",
			gridRowEnd: String(this.height + 1)
		}).appendTo(this.$creen);
	}

	doHideLoading () {
		this.$creen.find(`.dm-screen-loading`).remove();
	}

	async pInitialise () {
		this.doAdjust$creenCss();
		this.doShowLoading();

		await this.pLoadIndex();
		if (this.hasSavedStateUrl()) {
			this.doLoadUrlState();
		} else if (await this.pHasSavedState()) {
			await this.pDoLoadState();
		} else {
			this.doCheckFillSpaces();
		}
		this.initGlobalHandlers();
	}

	initGlobalHandlers () {
		window.onhashchange = () => this.doLoadUrlState();
		$(window).resize(() => this.reactor.fire("panelResize"));
	}

	async pLoadIndex () {
		elasticlunr.clearStopWords();
		await EntryRenderer.item.populatePropertyAndTypeReference();

		// rules
		await (async () => {
			const data = await DataUtil.loadJSON("data/generated/bookref-dmscreen-index.json");
			this.availRules.ALL = elasticlunr(function () {
				this.addField("b");
				this.addField("s");
				this.addField("p");
				this.addField("n");
				this.addField("h");
				this.setRef("id");
			});
			SearchUtil.removeStemmer(this.availRules.ALL);

			data.data.forEach(d => {
				d.n = data._meta.name[d.b];
				d.b = data._meta.id[d.b];
				d.s = data._meta.section[d.s];
				this.availRules.ALL.addDoc(d);
			});
		})();

		async function pDoBuildAdvantureOrAdventureIndex (dataPath, dataProp, indexStorage, indexIdField) {
			const data = await DataUtil.loadJSON(dataPath);
			indexStorage.ALL = elasticlunr(function () {
				this.addField(indexIdField);
				this.addField("c");
				this.addField("n");
				this.addField("p");
				this.addField("o");
				this.setRef("id");
			});
			SearchUtil.removeStemmer(indexStorage.ALL);

			let bookOrAdventureId = 0;
			data[dataProp].forEach(adventureOrBook => {
				indexStorage[adventureOrBook.id] = elasticlunr(function () {
					this.addField(indexIdField);
					this.addField("c");
					this.addField("n");
					this.addField("p");
					this.addField("o");
					this.setRef("id");
				});
				SearchUtil.removeStemmer(indexStorage[adventureOrBook.id]);

				adventureOrBook.contents.forEach((chap, i) => {
					const chapDoc = {
						[indexIdField]: adventureOrBook.id,
						n: adventureOrBook.name,
						c: chap.name,
						p: i,
						id: bookOrAdventureId++
					};
					if (chap.ordinal) chapDoc.o = Parser.bookOrdinalToAbv(chap.ordinal, true);

					indexStorage.ALL.addDoc(chapDoc);
					indexStorage[adventureOrBook.id].addDoc(chapDoc);
				});
			});
		}

		// adventures
		await pDoBuildAdvantureOrAdventureIndex(`data/adventures.json`, "adventure", this.availAdventures, "a");

		// books
		await pDoBuildAdvantureOrAdventureIndex(`data/books.json`, "book", this.availBooks, "b");

		// search
		await (async () => {
			const data = await DataUtil.loadJSON("search/index.json");

			function hasBadCat (d) {
				return d.c === Parser.CAT_ID_ADVENTURE || d.c === Parser.CAT_ID_CLASS || d.c === Parser.CAT_ID_QUICKREF || d.c === Parser.CAT_ID_CLASS_FEATURE;
			}

			function fromDeepIndex (d) {
				return d.d; // flag for "deep indexed" content that refers to the same item
			}

			this.availContent.ALL = elasticlunr(function () {
				this.addField("n");
				this.addField("s");
				this.setRef("id");
			});
			SearchUtil.removeStemmer(this.availContent.ALL);
			// Add main site index
			let ixMax = 0;
			data.forEach(d => {
				if (hasBadCat(d) || fromDeepIndex(d)) return;
				d.cf = d.c === Parser.CAT_ID_CREATURE ? "Creature" : Parser.pageCategoryToFull(d.c);
				if (!this.availContent[d.cf]) {
					this.availContent[d.cf] = elasticlunr(function () {
						this.addField("n");
						this.addField("s");
						this.setRef("id");
					});
					SearchUtil.removeStemmer(this.availContent[d.cf]);
				}
				this.availContent.ALL.addDoc(d);
				this.availContent[d.cf].addDoc(d);
				ixMax = Math.max(ixMax, d.id);
			});

			// Add homebrew
			Omnisearch.highestId = Math.max(ixMax, Omnisearch.highestId);

			const brewIndex = await BrewUtil.pGetSearchIndex();

			brewIndex.forEach(d => {
				if (hasBadCat(d) || fromDeepIndex(d)) return;
				d.cf = Parser.pageCategoryToFull(d.c);
				d.cf = d.c === Parser.CAT_ID_CREATURE ? "Creature" : Parser.pageCategoryToFull(d.c);
				this.availContent.ALL.addDoc(d);
				this.availContent[d.cf].addDoc(d);
			});

			// add tabs
			const omniTab = new AddMenuSearchTab(this.availContent);
			omniTab.setSpotlight(true);
			const ruleTab = new AddMenuSearchTab(this.availRules, "rules");
			const adventureTab = new AddMenuSearchTab(this.availAdventures, "adventures");
			const bookTab = new AddMenuSearchTab(this.availBooks, "books");
			const embedTab = new AddMenuVideoTab();
			const imageTab = new AddMenuImageTab();
			const specialTab = new AddMenuSpecialTab();

			this.menu
				.addTab(omniTab)
				.addTab(ruleTab)
				.addTab(adventureTab)
				.addTab(bookTab)
				.addTab(imageTab)
				.addTab(embedTab)
				.addTab(specialTab);

			this.menu.render();

			this.sideMenu.render();

			this.doHideLoading();
		})();
	}

	getPanel (x, y) {
		return Object.values(this.panels).find(p => {
			// x <= pX < x+w && y <= pY < y+h
			return (p.x <= x) && (x < (p.x + p.width)) && (p.y <= y) && (y < (p.y + p.height));
		});
	}

	getPanels (x, y, w = 1, h = 1) {
		const out = [];
		for (let wOffset = 0; wOffset < w; ++wOffset) {
			for (let hOffset = 0; hOffset < h; ++hOffset) {
				out.push(this.getPanel(x + wOffset, y + hOffset));
			}
		}
		return out.filter(it => it);
	}

	getPanelPx (xPx, hPx) {
		const dim = this.getPanelDimensions();
		return this.getPanel(Math.floor(xPx / dim.pxWidth), Math.floor(hPx / dim.pxHeight));
	}

	setHoveringPanel (panel) {
		this.hoveringPanel = panel;
	}

	setVisiblyHoveringPanel (isVis) {
		Object.values(this.panels).forEach(p => p.removeHoverClass());
		if (isVis && this.hoveringPanel) this.hoveringPanel.addHoverClass();
	}

	exilePanel (id) {
		const panelK = Object.keys(this.panels).find(k => this.panels[k].id === id);
		if (panelK) {
			const toExile = this.panels[panelK];
			if (!toExile.getEmpty()) {
				delete this.panels[panelK];
				this.exiledPanels.unshift(toExile);
				const toDestroy = this.exiledPanels.splice(10);
				toDestroy.forEach(p => p.destroy());
				this.sideMenu.doUpdateHistory()
			} else this.destroyPanel(id);
			this.doSaveStateDebounced();
		}
	}

	recallPanel (panel) {
		const ix = this.exiledPanels.findIndex(p => p.id === panel.id);
		if (~ix) this.exiledPanels.splice(ix, 1);
		this.panels[panel.id] = panel;
		this.doSaveStateDebounced();
	}

	destroyPanel (id) {
		const panelK = Object.keys(this.panels).find(k => this.panels[k].id === id);
		if (panelK) delete this.panels[panelK];
		this.doSaveStateDebounced();
	}

	doCheckFillSpaces () {
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; ++y) {
				const pnl = this.getPanel(x, y);
				if (!pnl) {
					const nuPnl = new Panel(this, x, y);
					this.panels[nuPnl.id] = nuPnl;
				}
			}
		}
		Object.values(this.panels).forEach(p => p.render());
		this.doSaveStateDebounced();
	}

	hasSavedStateUrl () {
		return window.location.hash.length;
	}

	doLoadUrlState () {
		if (window.location.hash.length) {
			const toLoad = JSON.parse(decodeURIComponent(window.location.hash.slice(1)));
			this.doReset();
			this.doLoadStateFrom(toLoad);
		}
		window.location.hash = "";
	}

	async pHasSavedState () {
		return !!await StorageUtil.pGet(DMSCREEN_STORAGE);
	}

	getSaveableState () {
		return {
			w: this.width,
			h: this.height,
			ctc: this.getConfirmTabClose(),
			fs: this.isFullscreen,
			lk: this.isLocked,
			ps: Object.values(this.panels).map(p => p.getSaveableState()),
			ex: this.exiledPanels.map(p => p.getSaveableState())
		};
	}

	doSaveStateDebounced () {
		this._pDoSaveStateDebounced();
	}

	doLoadStateFrom (toLoad) {
		if (this.$cbConfirmTabClose) this.$cbConfirmTabClose.prop("checked", !!toLoad.ctc);
		if (this.$btnFullscreen && (toLoad.fs !== !!this.isFullscreen)) this.$btnFullscreen.click();
		if (this.$btnLockPanels && (toLoad.lk !== !!this.isLocked)) this.$btnLockPanels.click();

		// re-exile
		toLoad.ex.filter(Boolean).reverse().forEach(saved => {
			const p = Panel.fromSavedState(this, saved);
			if (p) {
				this.panels[p.id] = p;
				p.exile();
			}
		});
		this.setDimensions(toLoad.w, toLoad.h); // FIXME is this necessary?

		// reload
		// fill content first; empties can fill any remaining space
		toLoad.ps.filter(Boolean).filter(saved => saved.t !== PANEL_TYP_EMPTY).forEach(saved => {
			const p = Panel.fromSavedState(this, saved);
			if (p) this.panels[p.id] = p;
		});
		this.setDimensions(toLoad.w, toLoad.h);
	}

	async pDoLoadState () {
		try {
			const toLoad = await StorageUtil.pGet(DMSCREEN_STORAGE);
			this.doLoadStateFrom(toLoad);
		} catch (e) {
			// on error, purge saved data and reset
			JqueryUtil.doToast({
				content: "Error when loading DM screen! Purged saved data. (See the log for more information.)",
				type: "danger"
			});
			await StorageUtil.pRemove(DMSCREEN_STORAGE);
			setTimeout(() => { throw e; });
		}
	}

	doReset () {
		this.exiledPanels.forEach(p => p.destroy());
		this.exiledPanels = [];
		this.sideMenu.doUpdateHistory();
		Object.values(this.panels).forEach(p => p.destroy());
		this.panels = {};
		this.setDimensions(this.getInitialWidth(), this.getInitialHeight());
	}

	setHoveringButton (panel) {
		this.resetHoveringButton(panel);
		panel.$btnAddInner.addClass("faux-hover");
	}

	resetHoveringButton (panel) {
		Object.values(this.panels).forEach(p => {
			if (panel && panel.id === p.id) return;
			p.$btnAddInner.removeClass("faux-hover");
		})
	}

	addPanel (panel) {
		this.panels[panel.id] = panel;
		panel.render();
		this.doSaveStateDebounced();
	}

	doStopMovingPanels () {
		Object.values(this.panels).forEach(p => p.toggleMoving(false));
	}
}

class SideMenu {
	constructor (board) {
		this.board = board;
		this.$mnu = $(`.sidemenu`);

		this.$mnu.on("mouseover", () => {
			this.board.setHoveringPanel(null);
			this.board.setVisiblyHoveringPanel(false);
			this.board.resetHoveringButton();
		});

		this.$iptWidth = null;
		this.$iptHeight = null;
		this.$wrpHistory = null;
	}

	render () {
		const renderDivider = () => this.$mnu.append(`<hr class="sidemenu__row__divider">`);

		const $wrpResizeW = $(`<div class="sidemenu__row"><div class="sidemenu__row__label">Width</div></div>`).appendTo(this.$mnu);
		const $iptWidth = $(`<input class="form-control" type="number" value="${this.board.width}">`).appendTo($wrpResizeW);
		this.$iptWidth = $iptWidth;
		const $wrpResizeH = $(`<div class="sidemenu__row"><div class="sidemenu__row__label">Height</div></div>`).appendTo(this.$mnu);
		const $iptHeight = $(`<input class="form-control" type="number" value="${this.board.height}">`).appendTo($wrpResizeH);
		this.$iptHeight = $iptHeight;
		const $wrpSetDim = $(`<div class="sidemenu__row"/>`).appendTo(this.$mnu);
		const $btnSetDim = $(`<button class="btn btn-primary" style="width: 100%;">Set Dimensions</div>`).appendTo($wrpSetDim);
		$btnSetDim.on("click", () => {
			const w = Number($iptWidth.val());
			const h = Number($iptHeight.val());
			if ((w > 10 || h > 10) && !window.confirm("That's a lot of panels. You sure?")) return;
			this.board.setDimensions(w, h);
		});
		renderDivider();

		const $wrpFullscreen = $(`<div class="sidemenu__row--alt"></div>`).appendTo(this.$mnu);
		const $btnFullscreen = $(`<button class="btn btn-primary">Toggle Fullscreen</button>`).appendTo($wrpFullscreen);
		this.board.$btnFullscreen = $btnFullscreen;
		$btnFullscreen.on("click", () => {
			this.board.isFullscreen = !this.board.isFullscreen;
			if (this.board.isFullscreen) $(`body`).addClass(`is-fullscreen`);
			else $(`body`).removeClass(`is-fullscreen`);
			this.board.doAdjust$creenCss();
			this.board.doSaveStateDebounced();
			this.board.reactor.fire("panelResize")
		});
		const $btnLockPanels = $(`<button class="btn btn-danger" title="Lock Panels"><span class="glyphicon glyphicon-lock"/></button>`).appendTo($wrpFullscreen);
		this.board.$btnLockPanels = $btnLockPanels;
		$btnLockPanels.on("click", () => {
			this.board.isLocked = !this.board.isLocked;
			if (this.board.isLocked) {
				$(`body`).addClass(`dm-screen-locked`);
				$btnLockPanels.removeClass(`btn-danger`).addClass(`btn-success`);
			} else {
				$(`body`).removeClass(`dm-screen-locked`);
				$btnLockPanels.addClass(`btn-danger`).removeClass(`btn-success`);
			}
			this.board.doSaveStateDebounced();
		});
		renderDivider();

		const $wrpSaveLoad = $(`<div class="sidemenu__row--vert"/>`).appendTo(this.$mnu);
		const $wrpSaveLoadFile = $(`<div class="sidemenu__row--alt"/>`).appendTo($wrpSaveLoad);
		const $btnSaveFile = $(`<button class="btn btn-primary">Save to File</button>`).appendTo($wrpSaveLoadFile);
		$btnSaveFile.on("click", () => {
			DataUtil.userDownload(`dm-screen`, this.board.getSaveableState());
		});
		const $btnLoadFile = $(`<button class="btn btn-primary">Load from File</button>`).appendTo($wrpSaveLoadFile);
		$btnLoadFile.on("click", () => {
			DataUtil.userUpload((json) => {
				this.board.doReset();
				this.board.doLoadStateFrom(json);
			});
		});
		const $wrpSaveLoadUrl = $(`<div class="sidemenu__row--alt"/>`).appendTo($wrpSaveLoad);
		const $btnSaveLink = $(`<button class="btn btn-primary">Save to URL</button>`).appendTo($wrpSaveLoadUrl);
		$btnSaveLink.on("click", async () => {
			const encoded = `${window.location.href.split("#")[0]}#${encodeURIComponent(JSON.stringify(this.board.getSaveableState()))}`;
			await MiscUtil.pCopyTextToClipboard(encoded);
			JqueryUtil.showCopiedEffect($btnSaveLink);
		});
		renderDivider();

		const $wrpCbConfirm = $(`<div class="sidemenu__row"><label class="sidemenu__row__label sidemenu__row__label--cb-label"><span>Confirm on Tab Close</span></label></div>`).appendTo(this.$mnu);
		this.board.$cbConfirmTabClose = $(`<input type="checkbox" class="sidemenu__row__label__cb">`).appendTo($wrpCbConfirm.find(`label`));
		renderDivider();

		const $wrpReset = $(`<div class="sidemenu__row"/>`).appendTo(this.$mnu);
		const $btnReset = $(`<button class="btn btn-danger" style="width: 100%;">Reset Screen</button>`).appendTo($wrpReset);
		$btnReset.on("click", () => {
			if (window.confirm("Are you sure?")) {
				this.board.doReset();
			}
		});
		renderDivider();

		this.$wrpHistory = $(`<div class="sidemenu__history"/>`).appendTo(this.$mnu);
	}

	doUpdateDimensions () {
		this.$iptWidth.val(this.board.width);
		this.$iptHeight.val(this.board.height);
	}

	doUpdateHistory () {
		this.board.exiledPanels.forEach(p => p.get$ContentWrapper().detach());
		this.$wrpHistory.children().remove();
		if (this.board.exiledPanels.length) {
			const $wrpHistHeader = $(`<div class="sidemenu__row"><span style="font-variant: small-caps;">Recently Removed</span></div>`).appendTo(this.$wrpHistory);
			const $btnHistClear = $(`<button class="btn btn-danger">Clear</button>`).appendTo($wrpHistHeader);
			$btnHistClear.on("click", () => {
				this.board.exiledPanels = [];
				this.doUpdateHistory();
			});
		}
		this.board.exiledPanels.forEach((p, i) => {
			const $wrpHistItem = $(`<div class="sidemenu__history-item"/>`).appendTo(this.$wrpHistory);
			const $cvrHistItem = $(`<div class="sidemenu__history-item-cover"/>`).appendTo($wrpHistItem);
			const $btnRemove = $(`<div class="panel-history-control-remove-wrapper"><span class="panel-history-control-remove glyphicon glyphicon-remove" title="Remove"/></div>`).appendTo($cvrHistItem);
			const $ctrlMove = $(`<div class="panel-history-control-middle" title="Move"/>`).appendTo($cvrHistItem);

			$btnRemove.on("click", () => {
				this.board.exiledPanels.splice(i, 1);
				this.doUpdateHistory();
			});

			const $contents = p.get$ContentWrapper();
			$wrpHistItem.append($contents);

			$ctrlMove.on("mousedown touchstart", (e) => {
				this.board.setVisiblyHoveringPanel(true);
				const $body = $(`body`);
				MiscUtil.clearSelection();
				$body.css("userSelect", "none");

				const w = $contents.width();
				const h = $contents.height();
				const offset = $contents.offset();
				const offsetX = e.clientX - offset.left;
				const offsetY = e.clientY - offset.top;

				$body.append($contents);
				$(`.panel-control`).hide();
				$contents.css("overflow-y", "hidden");
				Panel.setMovingCss(e, $contents, w, h, offsetX, offsetY, 61);
				$wrpHistItem.css("box-shadow", "none");
				$btnRemove.hide();
				$ctrlMove.hide();
				this.board.get$creen().addClass("board-content-hovering");
				p.get$Content().addClass("panel-content-hovering");

				Panel.bindMovingEvents(this.board, $contents, offsetX, offsetY);

				$(document).on(`mouseup${EVT_NAMESPACE} touchend${EVT_NAMESPACE}`, () => {
					this.board.setVisiblyHoveringPanel(false);
					$(document).off(`mousemove${EVT_NAMESPACE} touchmove${EVT_NAMESPACE}`).off(`mouseup${EVT_NAMESPACE} touchend${EVT_NAMESPACE}`);

					$body.css("userSelect", "");
					$contents.css("overflow-y", "");
					Panel.unsetMovingCss($contents);
					$wrpHistItem.css("box-shadow", "");
					$btnRemove.show();
					$ctrlMove.show();
					this.board.get$creen().removeClass("board-content-hovering");
					p.get$Content().removeClass("panel-content-hovering");

					if (!this.board.hoveringPanel || p.id === this.board.hoveringPanel.id) $wrpHistItem.append($contents);
					else {
						this.board.recallPanel(p);
						const her = this.board.hoveringPanel;
						if (her.getEmpty()) {
							her.setFromPeer(p.getPanelMeta(), p.$content);
							p.destroy();
						} else {
							const herMeta = her.getPanelMeta();
							const $herContent = her.get$Content();
							her.setFromPeer(p.getPanelMeta(), p.get$Content());
							p.setFromPeer(herMeta, $herContent);
							p.exile();
						}
						// clean any lingering hidden scrollbar
						her.$pnl.removeClass("panel-mode-move");
						her.doShowJoystick();
						this.doUpdateHistory();
					}
					MiscUtil.clearSelection();
					this.board.doSaveStateDebounced();
				});
			});
		});
		this.board.doSaveStateDebounced();
	}
}

class Panel {
	constructor (board, x, y, width = 1, height = 1, title = "") {
		this.id = board.getNextId();
		this.board = board;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.title = title;
		this.isDirty = true;
		this.isContentDirty = false;
		this.isLocked = false; // unused
		this.type = 0;
		this.contentMeta = null; // info used during saved state re-load
		this.isMousedown = false;
		this.isTabs = false;
		this.tabIndex = null;
		this.tabDatas = [];
		this.tabCanRename = false;
		this.tabRenamed = false;

		this.$btnAdd = null;
		this.$btnAddInner = null;
		this.$content = null;
		this.joyMenu = null;
		this.$pnl = null;
		this.$pnlWrpContent = null;
		this.$pnlTitle = null;
		this.$pnlAddTab = null;
		this.$pnlWrpTabs = null;
		this.$pnlTabs = null;
	}

	static fromSavedState (board, saved) {
		const existing = board.getPanels(saved.x, saved.y, saved.w, saved.h);
		if (saved.t === PANEL_TYP_EMPTY && existing.length) return null; // cull empties
		else if (existing.length) existing.forEach(p => p.destroy()); // prefer more recent panels
		const p = new Panel(board, saved.x, saved.y, saved.w, saved.h);
		p.render();

		function loadState (saved, skipSetTab, ixTab) {
			function handleTabRenamed (p) {
				if (saved.r != null) p.tabDatas[ixTab].tabRenamed = true;
			}

			switch (saved.t) {
				case PANEL_TYP_EMPTY:
					return p;
				case PANEL_TYP_STATS: {
					const page = saved.c.p;
					const source = saved.c.s;
					const hash = saved.c.u;
					p.doPopulate_Stats(page, source, hash, skipSetTab); // FIXME skipSetTab is never used
					return p;
				}
				case PANEL_TYP_CREATURE_SCALED_CR: {
					const page = saved.c.p;
					const source = saved.c.s;
					const hash = saved.c.u;
					const cr = saved.c.cr;
					p.doPopulate_StatsScaledCr(page, source, hash, cr, skipSetTab); // FIXME skipSetTab is never used
					return p;
				}
				case PANEL_TYP_RULES: {
					const book = saved.c.b;
					const chapter = saved.c.c;
					const header = saved.c.h;
					p.doPopulate_Rules(book, chapter, header, skipSetTab); // FIXME skipSetTab is never used
					return p;
				}
				case PANEL_TYP_ADVENTURES: {
					const adventure = saved.c.a;
					const chapter = saved.c.c;
					p.doPopulate_Adventures(adventure, chapter, skipSetTab); // FIXME skipSetTab is never used
					return p;
				}
				case PANEL_TYP_BOOKS: {
					const book = saved.c.b;
					const chapter = saved.c.c;
					p.doPopulate_Books(book, chapter, skipSetTab); // FIXME skipSetTab is never used
					return p;
				}
				case PANEL_TYP_ROLLBOX:
					EntryRenderer.dice.bindDmScreenPanel(p);
					return p;
				case PANEL_TYP_TEXTBOX:
					p.doPopulate_TextBox(saved.s.x, saved.r);
					handleTabRenamed(p);
					return p;
				case PANEL_TYP_INITIATIVE_TRACKER:
					p.doPopulate_InitiativeTracker(saved.s);
					return p;
				case PANEL_TYP_UNIT_CONVERTER:
					p.doPopulate_UnitConverter(saved.s);
					return p;
				case PANEL_TYP_MONEY_CONVERTER:
					p.doPopulate_MoneyConverter(saved.s);
					return p;
				case PANEL_TYP_SUNDIAL:
					p.doPopulate_Sundial(saved.s);
					return p;
				case PANEL_TYP_TUBE:
					p.doPopulate_YouTube(saved.c.u, saved.r);
					handleTabRenamed(p);
					return p;
				case PANEL_TYP_TWITCH:
					p.doPopulate_Twitch(saved.c.u, saved.r);
					handleTabRenamed(p);
					return p;
				case PANEL_TYP_TWITCH_CHAT:
					p.doPopulate_TwitchChat(saved.c.u, saved.r);
					handleTabRenamed(p);
					return p;
				case PANEL_TYP_GENERIC_EMBED:
					p.doPopulate_GenericEmbed(saved.c.u, saved.r);
					handleTabRenamed(p);
					return p;
				case PANEL_TYP_IMAGE:
					p.doPopulate_Image(saved.c.u, saved.r);
					handleTabRenamed(p);
					return p;
				default:
					throw new Error(`Unhandled panel type ${saved.t}`);
			}
		}

		if (saved.a) {
			p.isTabs = true;
			p.doRenderTabs();
			saved.a.forEach((tab, ix) => loadState(tab, true, ix));
			p.setActiveTab(saved.b);
		} else {
			loadState(saved);
		}
		return p;
	}

	static _get$eleLoading (message = "Loading") {
		return $(`<div class="panel-content-wrapper-inner"><div class="panel-tab-message loading-spinner"><i>${message}...</i></div></div>`);
	}

	static setMovingCss (evt, $ele, w, h, offsetX, offsetY, zIndex) {
		$ele.css({
			width: w,
			height: h,
			position: "fixed",
			top: evt.clientY - offsetY,
			left: evt.clientX - offsetX,
			zIndex: zIndex,
			pointerEvents: "none",
			transform: "rotate(-4deg)",
			background: "none"
		});
	}

	static unsetMovingCss ($ele) {
		$ele.css({
			width: "",
			height: "",
			position: "",
			top: "",
			left: "",
			zIndex: "",
			pointerEvents: "",
			transform: "",
			background: ""
		});
	}

	static bindMovingEvents (board, $content, offsetX, offsetY) {
		$(document).off(`mousemove${EVT_NAMESPACE} touchmove${EVT_NAMESPACE}`).off(`mouseup${EVT_NAMESPACE} touchend${EVT_NAMESPACE}`);
		$(document).on(`mousemove${EVT_NAMESPACE} touchmove${EVT_NAMESPACE}`, (e) => {
			board.setVisiblyHoveringPanel(true);
			$content.css({
				top: e.clientY - offsetY,
				left: e.clientX - offsetX
			});
		});
	}

	static isNonExilableType (type) {
		return type === PANEL_TYP_ROLLBOX || type === PANEL_TYP_TUBE || type === PANEL_TYP_TWITCH;
	}

	doPopulate_Empty (ixOpt) {
		this.close$TabContent(ixOpt);
	}

	doPopulate_Loading (message) {
		return this.set$ContentTab(
			PANEL_TYP_EMPTY,
			null,
			Panel._get$eleLoading(message),
			TITLE_LOADING
		);
	}

	doPopulate_Stats (page, source, hash) {
		const meta = {p: page, s: source, u: hash};
		const ix = this.set$TabLoading(
			PANEL_TYP_STATS,
			meta
		);
		EntryRenderer.hover._doFillThenCall(
			page,
			source,
			hash,
			() => {
				const fn = EntryRenderer.hover._pageToRenderFn(page);
				const it = EntryRenderer.hover._getFromCache(page, source, hash);

				const $contentInner = $(`<div class="panel-content-wrapper-inner"/>`);
				const $contentStats = $(`<table class="stats"/>`).appendTo($contentInner);
				$contentStats.append(fn(it));

				this._stats_bindCrScaleClickHandler(it, meta, $contentInner, $contentStats);

				this.set$Tab(
					ix,
					PANEL_TYP_STATS,
					meta,
					$contentInner,
					it.name
				);
			}
		);
	}

	_stats_bindCrScaleClickHandler (mon, meta, $contentInner, $contentStats) {
		const self = this;
		$contentStats.off("click", ".mon__btn-scale-cr").on("click", ".mon__btn-scale-cr", function (evt) {
			evt.stopPropagation();
			const $this = $(this);
			const lastCr = self.contentMeta.cr != null ? Parser.numberToCr(self.contentMeta.cr) : mon.cr.cr || mon.cr;

			EntryRenderer.monster.getCrScaleTarget($this, lastCr, (targetCr) => {
				const originalCr = Parser.crToNumber(mon.cr.cr || mon.cr) === targetCr;

				const doRender = (toRender) => {
					$contentStats.empty().append(EntryRenderer.monster.getCompactRenderedString(toRender, null, {showScaler: true, isScaled: !originalCr}));

					const nxtMeta = {
						...meta,
						cr: targetCr
					};
					if (originalCr) delete nxtMeta.cr;

					self.set$Tab(
						self.tabIndex,
						originalCr ? PANEL_TYP_STATS : PANEL_TYP_CREATURE_SCALED_CR,
						nxtMeta,
						$contentInner,
						toRender._displayName || toRender.name
					);
				};

				if (originalCr) {
					doRender(mon)
				} else {
					ScaleCreature.scale(mon, targetCr).then(toRender => doRender(toRender))
				}
			}, true);
		});
		$contentStats.off("click", ".mon__btn-reset-cr").on("click", ".mon__btn-reset-cr", function () {
			$contentStats.empty().append(EntryRenderer.monster.getCompactRenderedString(mon, null, {showScaler: true, isScaled: false}));
			self.set$Tab(
				self.tabIndex,
				PANEL_TYP_STATS,
				meta,
				$contentInner,
				mon.name
			);
		});
	}

	doPopulate_StatsScaledCr (page, source, hash, targetCr) {
		const meta = {p: page, s: source, u: hash, cr: targetCr};
		const ix = this.set$TabLoading(
			PANEL_TYP_CREATURE_SCALED_CR,
			meta
		);
		EntryRenderer.hover._doFillThenCall(
			page,
			source,
			hash,
			() => {
				const it = EntryRenderer.hover._getFromCache(page, source, hash);
				ScaleCreature.scale(it, targetCr).then(initialRender => {
					const $contentInner = $(`<div class="panel-content-wrapper-inner"/>`);
					const $contentStats = $(`<table class="stats"/>`).appendTo($contentInner);
					$contentStats.append(EntryRenderer.monster.getCompactRenderedString(initialRender, null, {showScaler: true, isScaled: true}));

					this._stats_bindCrScaleClickHandler(it, meta, $contentInner, $contentStats);

					this.set$Tab(
						ix,
						PANEL_TYP_CREATURE_SCALED_CR,
						meta,
						$contentInner,
						initialRender._displayName || initialRender.name
					);
				});
			}
		);
	}

	doPopulate_Rules (book, chapter, header) {
		const meta = {b: book, c: chapter, h: header};
		const ix = this.set$TabLoading(
			PANEL_TYP_RULES,
			meta
		);
		RuleLoader.pFill(book).then(() => {
			const rule = RuleLoader.getFromCache(book, chapter, header);
			const it = EntryRenderer.rule.getCompactRenderedString(rule);
			this.set$Tab(
				ix,
				PANEL_TYP_RULES,
				meta,
				$(`<div class="panel-content-wrapper-inner"><table class="stats">${it}</table></div>`),
				rule.name || ""
			);
		});
	}

	doPopulate_Adventures (adventure, chapter) {
		const meta = {a: adventure, c: chapter};
		const ix = this.set$TabLoading(
			PANEL_TYP_ADVENTURES,
			meta
		);
		adventureLoader.pFill(adventure).then(() => {
			const data = adventureLoader.getFromCache(adventure, chapter);
			const it = `
				<tr class="text"><td colspan="6">
				${EntryRenderer.getDefaultRenderer().setFirstSection(true).renderEntry(data)}
				</td></tr>
			`;
			this.set$Tab(
				ix,
				PANEL_TYP_ADVENTURES,
				meta,
				$(`<div class="panel-content-wrapper-inner"><table class="stats stats-book--hover">${it}</table></div>`),
				data.name || ""
			);
		});
	}

	doPopulate_Books (book, chapter) {
		const meta = {b: book, c: chapter};
		const ix = this.set$TabLoading(
			PANEL_TYP_BOOKS,
			meta
		);
		bookLoader.pFill(book).then(() => {
			const data = bookLoader.getFromCache(book, chapter);
			const it = `
				<tr class="text"><td colspan="6">
				${EntryRenderer.getDefaultRenderer().setFirstSection(true).renderEntry(data)}
				</td></tr>
			`;
			this.set$Tab(
				ix,
				PANEL_TYP_BOOKS,
				meta,
				$(`<div class="panel-content-wrapper-inner"><table class="stats stats-book--hover">${it}</table></div>`),
				data.name || ""
			);
		});
	}

	set$ContentTab (type, contentMeta, $content, title, tabCanRename, tabRenamed) {
		const ix = this.isTabs ? this.getNextTabIndex() : 0;
		return this.set$Tab(ix, type, contentMeta, $content, title, tabCanRename, tabRenamed);
	}

	doPopulate_Rollbox () {
		this.set$ContentTab(
			PANEL_TYP_ROLLBOX,
			null,
			$(`<div class="panel-content-wrapper-inner"/>`).append(EntryRenderer.dice.get$Roller().addClass("rollbox-panel")),
			"Dice Roller"
		);
	}

	doPopulate_InitiativeTracker (state = {}) {
		this.set$ContentTab(
			PANEL_TYP_INITIATIVE_TRACKER,
			state,
			$(`<div class="panel-content-wrapper-inner"/>`).append(InitiativeTracker.make$Tracker(this.board, state)),
			"Initiative Tracker"
		);
	}

	doPopulate_UnitConverter (state = {}) {
		this.set$ContentTab(
			PANEL_TYP_UNIT_CONVERTER,
			state,
			$(`<div class="panel-content-wrapper-inner"/>`).append(UnitConverter.make$Converter(this.board, state)),
			"Unit Converter"
		);
	}

	doPopulate_MoneyConverter (state = {}) {
		this.set$ContentTab(
			PANEL_TYP_MONEY_CONVERTER,
			state,
			$(`<div class="panel-content-wrapper-inner"/>`).append(MoneyConverter.make$Converter(this.board, state)),
			"Money Converter"
		);
	}

	doPopulate_Sundial (state = {}) {
		this.set$ContentTab(
			PANEL_TYP_SUNDIAL,
			state,
			$(`<div class="panel-content-wrapper-inner"/>`).append(Sundial.make$Sundail(this.board, state)),
			"Sundial"
		);
	}

	doPopulate_TextBox (content, title = "Notes") {
		this.set$ContentTab(
			PANEL_TYP_TEXTBOX,
			null,
			$(`<div class="panel-content-wrapper-inner"/>`).append(NoteBox.make$Notebox(this.board, content)),
			title,
			true
		);
	}

	doPopulate_YouTube (url, title = "YouTube") {
		const meta = {u: url};
		this.set$ContentTab(
			PANEL_TYP_TUBE,
			meta,
			$(`<div class="panel-content-wrapper-inner"><iframe src="${url}?autoplay=1&enablejsapi=1&modestbranding=1&iv_load_policy=3" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen /></div>`),
			title,
			true
		);
	}

	doPopulate_Twitch (url, title = "Twitch") {
		const meta = {u: url};
		this.set$ContentTab(
			PANEL_TYP_TWITCH,
			meta,
			$(`<div class="panel-content-wrapper-inner"><iframe src="${url}" frameborder="0"  scrolling="no" allowfullscreen/></div>`),
			title,
			true
		);
	}

	doPopulate_TwitchChat (url, title = "Twitch Chat") {
		const meta = {u: url};
		this.set$ContentTab(
			PANEL_TYP_TWITCH_CHAT,
			meta,
			$(`<div class="panel-content-wrapper-inner"><iframe src="${url}" frameborder="0"  scrolling="no"/></div>`),
			title,
			true
		);
	}

	doPopulate_GenericEmbed (url, title = "Embed") {
		const meta = {u: url};
		this.set$ContentTab(
			PANEL_TYP_GENERIC_EMBED,
			meta,
			$(`<div class="panel-content-wrapper-inner"><iframe src="${url}"/></div>`),
			title,
			true
		);
	}

	doPopulate_Image (url, ixOpt, title = "Image") {
		const meta = {u: url};
		const $wrpPanel = $(`<div class="panel-content-wrapper-inner"/>`);
		const $wrpImage = $(`<div class="panel-content-wrapper-img"/>`).appendTo($wrpPanel);
		const $img = $(`<img src="${url}" alt="${title}">`).appendTo($wrpImage);
		const $iptReset = $(`<button class="panel-zoom-reset btn btn-xs btn-default"><span class="glyphicon glyphicon-refresh"/></button>`).appendTo($wrpPanel);
		const $iptRange = $(`<input type="range" class="panel-zoom-slider">`).appendTo($wrpPanel);
		this.set$ContentTab(
			PANEL_TYP_IMAGE,
			meta,
			$wrpPanel,
			title,
			true,
			ixOpt // FIXME never used?
		);
		$img.panzoom({
			$reset: $iptReset,
			$zoomRange: $iptRange,
			minScale: 0.1,
			maxScale: 8,
			duration: 100
		});
	}
	// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	getTopNeighbours () {
		return [...new Array(this.width)]
			.map((blank, i) => i + this.x).map(x => this.board.getPanel(x, this.y - 1))
			.filter(p => p);
	}

	getRightNeighbours () {
		const rightmost = this.x + this.width;
		return [...new Array(this.height)].map((blank, i) => i + this.y)
			.map(y => this.board.getPanel(rightmost, y))
			.filter(p => p);
	}

	getBottomNeighbours () {
		const lowest = this.y + this.height;
		return [...new Array(this.width)].map((blank, i) => i + this.x)
			.map(x => this.board.getPanel(x, lowest))
			.filter(p => p);
	}

	getLeftNeighbours () {
		return [...new Array(this.height)].map((blank, i) => i + this.y)
			.map(y => this.board.getPanel(this.x - 1, y))
			.filter(p => p);
	}
	// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	hasRowTop () {
		return this.y > 0;
	}

	hasColumnRight () {
		return (this.x + this.width) < this.board.getWidth();
	}

	hasRowBottom () {
		return (this.y + this.height) < this.board.getHeight();
	}

	hasColumnLeft () {
		return this.x > 0;
	}
	// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	hasSpaceTop () {
		const hasLockedNeighbourTop = this.getTopNeighbours().filter(p => p.getLocked()).length;
		return this.hasRowTop() && !hasLockedNeighbourTop;
	}

	hasSpaceRight () {
		const hasLockedNeighbourRight = this.getRightNeighbours().filter(p => p.getLocked()).length;
		return this.hasColumnRight() && !hasLockedNeighbourRight;
	}

	hasSpaceBottom () {
		const hasLockedNeighbourBottom = this.getBottomNeighbours().filter(p => p.getLocked()).length;
		return this.hasRowBottom() && !hasLockedNeighbourBottom;
	}

	hasSpaceLeft () {
		const hasLockedNeighbourLeft = this.getLeftNeighbours().filter(p => p.getLocked()).length;
		return this.hasColumnLeft() && !hasLockedNeighbourLeft;
	}
	// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	canShrinkTop () {
		return this.height > 1 && !this.getLocked();
	}

	canShrinkRight () {
		return this.width > 1 && !this.getLocked();
	}

	canShrinkBottom () {
		return this.height > 1 && !this.getLocked();
	}

	canShrinkLeft () {
		return this.width > 1 && !this.getLocked();
	}
	// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	doShrinkTop () {
		this.height -= 1;
		this.y += 1;
		this.setDirty(true);
		this.render();
	}

	doShrinkRight () {
		this.width -= 1;
		this.setDirty(true);
		this.render();
	}

	doShrinkBottom () {
		this.height -= 1;
		this.setDirty(true);
		this.render();
	}

	doShrinkLeft () {
		this.width -= 1;
		this.x += 1;
		this.setDirty(true);
		this.render();
	}
	// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	canBumpTop () {
		if (!this.hasRowTop()) return false; // if there's no row above, we can't bump up a row
		if (!this.getTopNeighbours().filter(p => !p.getEmpty()).length) return true; // if there's a row above and it's empty, we can bump
		// if there's a row above and it has non-empty panels, we can bump if they can all bump
		return !this.getTopNeighbours().filter(p => !p.getEmpty()).filter(p => !p.canBumpTop()).length;
	}

	canBumpRight () {
		if (!this.hasColumnRight()) return false;
		if (!this.getRightNeighbours().filter(p => !p.getEmpty()).length) return true;
		return !this.getRightNeighbours().filter(p => !p.getEmpty()).filter(p => !p.canBumpRight()).length;
	}

	canBumpBottom () {
		if (!this.hasRowBottom()) return false;
		if (!this.getBottomNeighbours().filter(p => !p.getEmpty()).length) return true;
		return !this.getBottomNeighbours().filter(p => !p.getEmpty()).filter(p => !p.canBumpBottom()).length;
	}

	canBumpLeft () {
		if (!this.hasColumnLeft()) return false;
		if (!this.getLeftNeighbours().filter(p => !p.getEmpty()).length) return true;
		return !this.getLeftNeighbours().filter(p => !p.getEmpty()).filter(p => !p.canBumpLeft()).length;
	}
	// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	doBumpTop () {
		this.getTopNeighbours().filter(p => p.getEmpty()).forEach(p => p.destroy());
		this.getTopNeighbours().filter(p => !p.getEmpty()).forEach(p => p.doBumpTop());
		this.y -= 1;
		this.setDirty(true);
		this.render();
	}

	doBumpRight () {
		this.getRightNeighbours().filter(p => p.getEmpty()).forEach(p => p.destroy());
		this.getRightNeighbours().filter(p => !p.getEmpty()).forEach(p => p.doBumpRight());
		this.x += 1;
		this.setDirty(true);
		this.render();
	}

	doBumpBottom () {
		this.getBottomNeighbours().filter(p => p.getEmpty()).forEach(p => p.destroy());
		this.getBottomNeighbours().filter(p => !p.getEmpty()).forEach(p => p.doBumpBottom());
		this.y += 1;
		this.setDirty(true);
		this.render();
	}

	doBumpLeft () {
		this.getLeftNeighbours().filter(p => p.getEmpty()).forEach(p => p.destroy());
		this.getLeftNeighbours().filter(p => !p.getEmpty()).forEach(p => p.doBumpLeft());
		this.x -= 1;
		this.setDirty(true);
		this.render();
	}
	// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	getPanelMeta () {
		return {
			type: this.type,
			contentMeta: this.contentMeta,
			title: this.title,
			isTabs: this.isTabs,
			tabIndex: this.tabIndex,
			tabDatas: this.tabDatas,
			tabCanRename: this.tabCanRename,
			tabRenamed: this.tabRenamed
		}
	}

	setPanelMeta (type, contentMeta) {
		this.type = type;
		this.contentMeta = contentMeta;
	}

	getEmpty () {
		return this.$content == null;
	}

	getLocked () {
		return this.isLocked;
	}

	getMousedown () {
		return this.isMousedown;
	}

	setMousedown (isMousedown) {
		this.isMousedown = isMousedown;
	}

	setDirty (dirty) {
		this.isDirty = dirty;
	}

	setHasTabs (hasTabs) {
		this.isTabs = hasTabs;
	}

	setContentDirty (dirty) {
		this.setDirty.bind(this)(dirty);
		this.isContentDirty = true;
	}

	doShowJoystick () {
		this.joyMenu.doShow();
		this.$pnl.addClass(`panel-mode-move`);
	}

	doHideJoystick () {
		this.joyMenu.doHide();
		this.$pnl.removeClass(`panel-mode-move`);
	}

	doRenderTitle () {
		const displayText = this.title !== TITLE_LOADING &&
			(this.type === PANEL_TYP_STATS || this.type === PANEL_TYP_CREATURE_SCALED_CR || this.type === PANEL_TYP_RULES || this.type === PANEL_TYP_ADVENTURES || this.type === PANEL_TYP_BOOKS) ? this.title : "";

		this.$pnlTitle.text(displayText);
		if (!displayText) this.$pnlTitle.addClass("hidden");
		else this.$pnlTitle.removeClass("hidden");
	}

	doRenderTabs () {
		if (this.isTabs) {
			this.$pnlWrpTabs.css({display: "flex"});
			this.$pnlWrpContent.addClass("panel-content-wrapper-tabs");
			this.$pnlAddTab.addClass("hidden");
		} else {
			this.$pnlWrpTabs.css({display: ""});
			this.$pnlWrpContent.removeClass("panel-content-wrapper-tabs");
			this.$pnlAddTab.removeClass("hidden");
		}
	}

	getReplacementPanel () {
		const replacement = new Panel(this.board, this.x, this.y, this.width, this.height);

		if (this.tabDatas.length > 1 && this.tabDatas.filter(it => !it.isDeleted && (Panel.isNonExilableType(it.type))).length) {
			const prevTabIx = this.tabDatas.findIndex(it => !it.isDeleted);
			if (~prevTabIx) {
				this.setActiveTab(prevTabIx);
			}
			// otherwise, it should be the currently displayed panel, and so will be destroyed on exile

			this.tabDatas.filter(it => it.type === PANEL_TYP_ROLLBOX).forEach(it => {
				it.isDeleted = true;
				EntryRenderer.dice.unbindDmScreenPanel();
			});
		}

		this.exile();
		this.board.addPanel(replacement);
		this.board.doCheckFillSpaces();
		return replacement;
	}

	toggleMoving (val) {
		this.$pnl.find(`.panel-control`).toggle(val);
		this.$pnl.find(`.btn-panel-add`).toggle(val);
		this.$pnl.toggleClass(`panel-mode-move`, val);
	}

	render () {
		const doApplyPosCss = ($ele) => {
			// indexed from 1 instead of zero...
			return $ele.css({
				gridColumnStart: String(this.x + 1),
				gridColumnEnd: String(this.x + 1 + this.width),

				gridRowStart: String(this.y + 1),
				gridRowEnd: String(this.y + 1 + this.height)
			});
		};

		const openAddMenu = () => {
			this.board.menu.doOpen();
			this.board.menu.setPanel(this);
			if (!this.board.menu.hasActiveTab()) this.board.menu.setFirstTabActive();
			else if (this.board.menu.getActiveTab().doTransitionActive) this.board.menu.getActiveTab().doTransitionActive();
		};

		function doInitialRender () {
			const $pnl = $(`<div data-panelId="${this.id}" class="dm-screen-panel" empty="true"/>`);
			this.$pnl = $pnl;
			const $ctrlBar = $(`<div class="panel-control-bar"/>`).appendTo($pnl);
			this.$pnlTitle = $(`<div class="panel-control-bar panel-control-title"/>`).appendTo($pnl).click(() => this.$pnlTitle.toggleClass("panel-control-title--bumped"));
			this.$pnlAddTab = $(`<div class="panel-control-bar panel-control-addtab"><div class="panel-control-icon glyphicon glyphicon-plus" title="Add Tab"/></div>`).click(() => {
				this.setHasTabs(true);
				this.setDirty(true);
				this.render();
				openAddMenu();
			}).appendTo($pnl);

			const $ctrlMove = $(`<div class="panel-control-icon glyphicon glyphicon-move" title="Move"/>`).appendTo($ctrlBar);
			$ctrlMove.on("click", () => {
				this.toggleMoving();
			});
			const $ctrlEmpty = $(`<div class="panel-control-icon glyphicon glyphicon-remove" title="Empty"/>`).appendTo($ctrlBar);
			$ctrlEmpty.on("click", () => {
				this.getReplacementPanel();
			});

			const joyMenu = new JoystickMenu(this.board, this);
			this.joyMenu = joyMenu;
			joyMenu.initialise();

			const $wrpContent = $(`<div class="panel-content-wrapper"/>`).appendTo($pnl);
			const $wrpBtnAdd = $(`<div class="panel-add"/>`).appendTo($wrpContent);
			const $btnAdd = $(`<span class="btn-panel-add glyphicon glyphicon-plus"/>`).on("click", () => {
				openAddMenu();
			}).appendTo($wrpBtnAdd);
			this.$btnAdd = $wrpBtnAdd;
			this.$btnAddInner = $btnAdd;
			this.$pnlWrpContent = $wrpContent;

			const $wrpTabs = $(`<div class="content-tab-bar"/>`).appendTo($pnl);
			const $wrpTabsInner = $(`<div class="content-tab-bar-inner"/>`).on("wheel", (evt) => {
				const delta = evt.originalEvent.deltaY;
				const curr = $wrpTabsInner.scrollLeft();
				$wrpTabsInner.scrollLeft(Math.max(0, curr + delta));
			}).appendTo($wrpTabs);
			const $btnTabAdd = $(`<button class="btn btn-default content-tab"><span class="glyphicon glyphicon-plus"/></button>`)
				.click(() => openAddMenu()).appendTo($wrpTabsInner);
			this.$pnlWrpTabs = $wrpTabs;
			this.$pnlTabs = $wrpTabsInner;

			if (this.$content) $wrpContent.append(this.$content);

			doApplyPosCss($pnl).appendTo(this.board.get$creen());
			this.isDirty = false;
		}

		if (this.isDirty) {
			if (!this.$pnl) doInitialRender.bind(this)();
			else {
				doApplyPosCss(this.$pnl);
				this.doRenderTitle();
				this.doRenderTabs();

				if (this.isContentDirty) {
					this.$pnlWrpContent.clear();
					if (this.$content) this.$pnlWrpContent.append(this.$content);
					this.isContentDirty = false;
				}
			}
			this.isDirty = false;
		}
	}

	getPos () {
		const offset = this.$pnl.offset();
		return {
			top: offset.top,
			left: offset.left,
			width: this.$pnl.outerWidth(),
			height: this.$pnl.outerHeight()
		};
	}

	getAddButtonPos () {
		const offset = this.$btnAddInner.offset();
		return {
			top: offset.top,
			left: offset.left,
			width: this.$btnAddInner.outerWidth(),
			height: this.$btnAddInner.outerHeight()
		};
	}

	doCloseTab (ixOpt) {
		if (this.isTabs) {
			this.close$TabContent(ixOpt);
		}

		// closing the last tab flips this, so we may need to do it in either case
		if (!this.isTabs) {
			const replacement = new Panel(this.board, this.x, this.y, this.width, this.height);
			this.exile();
			this.board.addPanel(replacement);
			this.board.doCheckFillSpaces();
		}
	}

	close$TabContent (ixOpt = 0) {
		return this.set$Tab(-1 * (ixOpt + 1), PANEL_TYP_EMPTY, null, null, null, false);
	}

	set$Content (type, contentMeta, $content, title, tabCanRename, tabRenamed) {
		this.type = type;
		this.contentMeta = contentMeta;
		this.$content = $content;
		this.title = title;
		this.tabCanRename = tabCanRename;
		this.tabRenamed = tabRenamed;

		this.$pnlWrpContent.children().detach();
		if ($content === null) this.$pnlWrpContent.append(this.$btnAdd);
		else this.$pnlWrpContent.append($content);
		this.$pnl.attr("empty", !$content);
		this.doRenderTitle();
		this.doRenderTabs();
	}

	setFromPeer (hisMeta, $hisContent) {
		this.isTabs = hisMeta.isTabs;
		this.tabIndex = hisMeta.tabIndex;
		this.tabDatas = hisMeta.tabDatas;
		this.tabCanRename = hisMeta.tabCanRename;
		this.tabRenamed = hisMeta.tabRenamed;

		this.set$Tab(hisMeta.tabIndex, hisMeta.type, hisMeta.contentMeta, $hisContent, hisMeta.title, hisMeta.tabCanRename, hisMeta.tabRenamed);
		hisMeta.tabDatas
			.forEach((it, ix) => {
				if (!it.isDeleted && it.$tabButton) {
					// regenerate tab buttons to refer to the correct tab
					it.$tabButton.remove();
					it.$tabButton = this._get$BtnSelTab(ix, it.title, it.tabCanRename);
					this.$pnlTabs.children().last().before(it.$tabButton);
				}
			});
	}

	getNextTabIndex () {
		return this.tabDatas.length;
	}

	set$TabLoading (type, contentMeta) {
		return this.set$ContentTab(
			type,
			contentMeta,
			Panel._get$eleLoading(),
			TITLE_LOADING
		);
	}

	_get$BtnSelTab (ix, title, tabCanRename) {
		title = title || "[Untitled]";
		const $btnSelTab = $(`<span class="btn btn-default content-tab ${tabCanRename ? "content-tab-can-rename" : ""}"><span class="content-tab-title">${title}</span></span>`)
			.on("mousedown", (evt) => {
				if (evt.which === 1) {
					this.setActiveTab(ix);
				} else if (evt.which === 2) {
					this.doCloseTab(ix);
				}
			})
			.on("contextmenu", (evt) => {
				if (!evt.ctrlKey && $btnSelTab.hasClass("content-tab-can-rename")) {
					const nuTitle = prompt("Rename tab to:");
					if (nuTitle && nuTitle.trim()) {
						$btnSelTab.find(`.content-tab-title`).text(nuTitle);
						const x = this.tabDatas[ix];
						x.title = nuTitle;
						x.tabRenamed = true;
						if (this.tabIndex === ix) {
							this.title = nuTitle;
							this.tabRenamed = true;
						}
					}
					evt.stopPropagation();
					evt.preventDefault();
				}
			});
		const $btnCloseTab = $(`<span class="glyphicon glyphicon-remove content-tab-remove"/>`)
			.on("mousedown", (evt) => {
				if (evt.button === 0) {
					evt.stopPropagation();
					if (!this.board.getConfirmTabClose() || (this.board.getConfirmTabClose() && confirm(`Are you sure you want to close tab "${this.tabDatas[ix].title}"?`))) this.doCloseTab(ix);
				}
			}).appendTo($btnSelTab);
		return $btnSelTab;
	}

	set$Tab (ix, type, contentMeta, $content, title, tabCanRename, tabRenamed) {
		if (ix === null) ix = 0;
		if (ix < 0) {
			const ixPos = Math.abs(ix + 1);
			const td = this.tabDatas[ixPos];
			if (td) {
				td.isDeleted = true;
				if (td.$tabButton) td.$tabButton.detach();
			}
		} else {
			const $btnOld = (this.tabDatas[ix] || {}).$tabButton; // preserve tab button
			this.tabDatas[ix] = {
				type: type,
				contentMeta: contentMeta,
				$content: $content,
				title: title,
				tabCanRename: !!tabCanRename,
				tabRenamed: !!tabRenamed
			};
			if ($btnOld) this.tabDatas[ix].$tabButton = $btnOld;

			const doAdd$BtnSelTab = (ix, title) => {
				const $btnSelTab = this._get$BtnSelTab(ix, title);
				this.$pnlTabs.children().last().before($btnSelTab);
				return $btnSelTab;
			};

			if (!this.tabDatas[ix].$tabButton) this.tabDatas[ix].$tabButton = doAdd$BtnSelTab(ix, title);
			else this.tabDatas[ix].$tabButton.find(`.content-tab-title`).text(title);

			this.tabDatas[ix].$tabButton.toggleClass("content-tab-can-rename", tabCanRename);
		}

		this.setActiveTab(ix);
		return ix;
	}

	setActiveTab (ix) {
		if (ix < 0) {
			const handleNoTabs = () => {
				this.isTabs = false;
				this.tabIndex = 0;
				this.tabCanRename = false;
				this.tabRenamed = false;
				this.set$Content(PANEL_TYP_EMPTY, null, null, null, false);
			};

			if (this.isTabs) {
				const prevTabIx = this.tabDatas.findIndex(it => !it.isDeleted);
				if (~prevTabIx) {
					this.setActiveTab(prevTabIx);
				} else handleNoTabs();
			} else handleNoTabs();
		} else {
			this.tabIndex = ix;
			const tabData = this.tabDatas[ix];
			this.set$Content(tabData.type, tabData.contentMeta, tabData.$content, tabData.title, tabData.tabCanRename, tabData.tabRenamed);
		}
		this.board.doSaveStateDebounced();
	}

	get$ContentWrapper () {
		return this.$pnlWrpContent;
	}

	get$Content () {
		return this.$content
	}

	exile () {
		if (Panel.isNonExilableType(this.type)) this.destroy();
		else {
			if (this.$pnl) this.$pnl.detach();
			this.board.exilePanel(this.id);
		}
	}

	destroy () {
		if (this.type === PANEL_TYP_ROLLBOX) EntryRenderer.dice.unbindDmScreenPanel();
		if (this.$pnl) this.$pnl.remove();
		this.board.destroyPanel(this.id);
	}

	addHoverClass () {
		this.$pnl.addClass("faux-hover");
	}

	removeHoverClass () {
		this.$pnl.removeClass("faux-hover");
	}

	getSaveableState () {
		const out = {
			x: this.x,
			y: this.y,
			w: this.width,
			h: this.height,
			t: this.type
		};

		function getSaveableContent (type, contentMeta, $content, tabRenamed, tabTitle) {
			const toSaveTitle = tabRenamed ? tabTitle : undefined;
			switch (type) {
				case PANEL_TYP_EMPTY:
					return null;

				case PANEL_TYP_ROLLBOX:
					return {
						t: type,
						r: toSaveTitle
					};
				case PANEL_TYP_STATS:
					return {
						t: type,
						r: toSaveTitle,
						c: {
							p: contentMeta.p,
							s: contentMeta.s,
							u: contentMeta.u
						}
					};
				case PANEL_TYP_CREATURE_SCALED_CR:
					return {
						t: type,
						r: toSaveTitle,
						c: {
							p: contentMeta.p,
							s: contentMeta.s,
							u: contentMeta.u,
							cr: contentMeta.cr
						}
					};
				case PANEL_TYP_RULES:
					return {
						t: type,
						r: toSaveTitle,
						c: {
							b: contentMeta.b,
							c: contentMeta.c,
							h: contentMeta.h
						}
					};
				case PANEL_TYP_ADVENTURES:
					return {
						t: type,
						r: toSaveTitle,
						c: {
							a: contentMeta.a,
							c: contentMeta.c
						}
					};
				case PANEL_TYP_BOOKS:
					return {
						t: type,
						r: toSaveTitle,
						c: {
							b: contentMeta.b,
							c: contentMeta.c
						}
					};
				case PANEL_TYP_TEXTBOX:
					return {
						t: type,
						r: toSaveTitle,
						s: {
							x: $content ? $content.find(`textarea`).val() : ""
						}
					};
				case PANEL_TYP_INITIATIVE_TRACKER: {
					return {
						t: type,
						r: toSaveTitle,
						s: $content.find(`.dm-init`).data("getState")()
					};
				}
				case PANEL_TYP_UNIT_CONVERTER: {
					return {
						t: type,
						r: toSaveTitle,
						s: $content.find(`.dm-unitconv`).data("getState")()
					};
				}
				case PANEL_TYP_MONEY_CONVERTER: {
					return {
						t: type,
						r: toSaveTitle,
						s: $content.find(`.dm_money`).data("getState")()
					};
				}
				case PANEL_TYP_SUNDIAL: {
					return {
						t: type,
						r: toSaveTitle,
						s: $content.find(`.dm_sundial`).data("getState")()
					};
				}
				case PANEL_TYP_TUBE:
				case PANEL_TYP_TWITCH:
				case PANEL_TYP_TWITCH_CHAT:
				case PANEL_TYP_GENERIC_EMBED:
				case PANEL_TYP_IMAGE:
					return {
						t: type,
						r: toSaveTitle,
						c: {
							u: contentMeta.u
						}
					};
				default:
					throw new Error(`Unhandled panel type ${this.type}`);
			}
		}

		const toSave = getSaveableContent(this.type, this.contentMeta, this.$content);
		if (toSave) Object.assign(out, toSave);

		if (this.isTabs) {
			out.a = this.tabDatas.filter(it => !it.isDeleted).map(td => getSaveableContent(td.type, td.contentMeta, td.$content, td.tabRenamed, td.title));
			// offset saved tabindex by number of deleted tabs that come before
			let delCount = 0;
			for (let i = 0; i < this.tabIndex; ++i) {
				if (this.tabDatas[i].isDeleted) delCount++;
			}
			out.b = this.tabIndex - delCount;
		}

		return out;
	}
}

class JoystickMenu {
	constructor (board, panel) {
		this.board = board;
		this.panel = panel;

		this.$ctrls = null;
	}

	initialise () {
		this.panel.$pnl.on("mouseover", () => this.panel.board.setHoveringPanel(this.panel));
		this.panel.$pnl.on("mouseout", () => this.panel.board.setHoveringPanel(null));

		const $ctrlMove = $(`<div class="panel-control panel-control-middle"/>`);
		const $ctrlXpandUp = $(`<div class="panel-control panel-control-top"/>`);
		const $ctrlXpandRight = $(`<div class="panel-control panel-control-right"/>`);
		const $ctrlXpandDown = $(`<div class="panel-control panel-control-bottom"/>`);
		const $ctrlXpandLeft = $(`<div class="panel-control panel-control-left"/>`);
		const $ctrlBg = $(`<div class="panel-control panel-control-bg"/>`);
		this.$ctrls = [$ctrlMove, $ctrlXpandUp, $ctrlXpandRight, $ctrlXpandDown, $ctrlXpandLeft, $ctrlBg];

		$ctrlMove.on("mousedown touchstart", (e) => {
			this.panel.board.setVisiblyHoveringPanel(true);
			const $body = $(`body`);
			MiscUtil.clearSelection();
			$body.css("userSelect", "none");
			if (!this.panel.$content) return;

			const w = this.panel.$content.width();
			const h = this.panel.$content.height();
			const childH = this.panel.$content.children().first().height();
			const offset = this.panel.$content.offset();
			const offsetX = e.clientX - offset.left;
			const offsetY = h > childH ? childH / 2 : (e.clientY - offset.top);

			$body.append(this.panel.$content);
			$(`.panel-control`).hide();
			Panel.setMovingCss(e, this.panel.$content, w, h, offsetX, offsetY, 52);
			this.panel.board.get$creen().addClass("board-content-hovering");
			this.panel.$content.addClass("panel-content-hovering");
			this.panel.$pnl.addClass("pnl-content-tab-bar-hidden");
			// clean any lingering hidden scrollbar
			this.panel.$pnl.removeClass("panel-mode-move");

			Panel.bindMovingEvents(this.panel.board, this.panel.$content, offsetX, offsetY);

			$(document).on(`mouseup${EVT_NAMESPACE} touchend${EVT_NAMESPACE}`, () => {
				this.panel.board.setVisiblyHoveringPanel(false);
				$(document).off(`mousemove${EVT_NAMESPACE} touchmove${EVT_NAMESPACE}`).off(`mouseup${EVT_NAMESPACE} touchend${EVT_NAMESPACE}`);

				$body.css("userSelect", "");
				Panel.unsetMovingCss(this.panel.$content);
				this.panel.board.get$creen().removeClass("board-content-hovering");
				this.panel.$content.removeClass("panel-content-hovering");
				this.panel.$pnl.removeClass("pnl-content-tab-bar-hidden");
				// clean any lingering hidden scrollbar
				this.panel.$pnl.removeClass("panel-mode-move");

				if (!this.panel.board.hoveringPanel || this.panel.id === this.panel.board.hoveringPanel.id) {
					this.panel.$pnlWrpContent.append(this.panel.$content);
					this.panel.doShowJoystick();
				} else {
					const her = this.panel.board.hoveringPanel;
					// TODO this should ideally peel off the selected tab and transfer it to the target pane, instead of swapping
					const herMeta = her.getPanelMeta();
					const $herContent = her.get$Content();
					her.setFromPeer(this.panel.getPanelMeta(), this.panel.get$Content());
					this.panel.setFromPeer(herMeta, $herContent);

					this.panel.doHideJoystick();
					her.doShowJoystick();
				}
				MiscUtil.clearSelection();
				this.board.doSaveStateDebounced();
				this.board.reactor.fire("panelResize");
			});
		});

		function xpandHandler (dir) {
			MiscUtil.clearSelection();
			$(`body`).css("userSelect", "none");
			$(`.panel-control`).hide();
			$(`.panel-control-bar`).addClass("xpander-active");
			$ctrlBg.show();
			this.panel.$pnl.addClass("panel-mode-move");
			switch (dir) {
				case UP:
					$ctrlXpandUp.show();
					break;
				case RIGHT:
					$ctrlXpandRight.show();
					break;
				case DOWN:
					$ctrlXpandDown.show();
					break;
				case LEFT:
					$ctrlXpandLeft.show();
					break;
			}
			const axis = dir === RIGHT || dir === LEFT ? AX_X : AX_Y;

			const pos = this.panel.$pnl.offset();
			const dim = this.panel.board.getPanelDimensions();
			let numPanelsCovered = 0;
			const initGCS = this.panel.$pnl.css("gridColumnStart");
			const initGCE = this.panel.$pnl.css("gridColumnEnd");
			const initGRS = this.panel.$pnl.css("gridRowStart");
			const initGRE = this.panel.$pnl.css("gridRowEnd");

			this.panel.$pnl.css({
				zIndex: 52,
				boxShadow: "0 0 12px 0 #000000a0"
			});

			$(document).off(`mousemove${EVT_NAMESPACE} touchmove${EVT_NAMESPACE}`).off(`mouseup${EVT_NAMESPACE} touchend${EVT_NAMESPACE}`);

			$(document).on(`mousemove${EVT_NAMESPACE} touchmove${EVT_NAMESPACE}`, (e) => {
				let delta = 0;
				const px = axis === AX_X ? dim.pxWidth : dim.pxHeight;
				switch (dir) {
					case UP:
						delta = pos.top - e.clientY;
						break;
					case RIGHT:
						delta = e.clientX - (pos.left + (px * this.panel.width));
						break;
					case DOWN:
						delta = e.clientY - (pos.top + (px * this.panel.height));
						break;
					case LEFT:
						delta = pos.left - e.clientX;
						break;
				}

				numPanelsCovered = Math.ceil((delta / px));
				const canShrink = axis === AX_X ? this.panel.width - 1 : this.panel.height - 1;
				if (canShrink + numPanelsCovered <= 0) numPanelsCovered = -canShrink;

				switch (dir) {
					case UP:
						if (numPanelsCovered > this.panel.y) numPanelsCovered = this.panel.y;
						this.panel.$pnl.css({
							gridRowStart: String(this.panel.y + (1 - numPanelsCovered)),
							gridRowEnd: String(this.panel.y + 1 + this.panel.height)
						});
						break;
					case RIGHT:
						if (numPanelsCovered > (this.panel.board.width - this.panel.width) - this.panel.x) numPanelsCovered = (this.panel.board.width - this.panel.width) - this.panel.x;
						this.panel.$pnl.css({
							gridColumnEnd: String(this.panel.x + 1 + this.panel.width + numPanelsCovered)
						});
						break;
					case DOWN:
						if (numPanelsCovered > (this.panel.board.height - this.panel.height) - this.panel.y) numPanelsCovered = (this.panel.board.height - this.panel.height) - this.panel.y;
						this.panel.$pnl.css({
							gridRowEnd: String(this.panel.y + 1 + this.panel.height + numPanelsCovered)
						});
						break;
					case LEFT:
						if (numPanelsCovered > this.panel.x) numPanelsCovered = this.panel.x;
						this.panel.$pnl.css({
							gridColumnStart: String(this.panel.x + (1 - numPanelsCovered)),
							gridColumnEnd: String(this.panel.x + 1 + this.panel.width)
						});
						break;
				}
			});

			$(document).on(`mouseup${EVT_NAMESPACE} touchend${EVT_NAMESPACE}`, () => {
				$(document).off(`mousemove${EVT_NAMESPACE} touchmove${EVT_NAMESPACE}`).off(`mouseup${EVT_NAMESPACE} touchend${EVT_NAMESPACE}`);

				$(`body`).css("userSelect", "");
				this.panel.$pnl.find(`.panel-control`).show();
				$(`.panel-control-bar`).removeClass("xpander-active");
				this.panel.$pnl.css({
					zIndex: "",
					boxShadow: "",
					gridColumnStart: initGCS,
					gridColumnEnd: initGCE,
					gridRowStart: initGRS,
					gridRowEnd: initGRE
				});

				const canShrink = axis === AX_X ? this.panel.width - 1 : this.panel.height - 1;
				if (canShrink + numPanelsCovered <= 0) numPanelsCovered = -canShrink;
				if (numPanelsCovered === 0) return;
				const isGrowth = !!~Math.sign(numPanelsCovered);
				if (isGrowth) {
					switch (dir) {
						case UP:
							if (!this.panel.hasSpaceTop()) return;
							break;
						case RIGHT:
							if (!this.panel.hasSpaceRight()) return;
							break;
						case DOWN:
							if (!this.panel.hasSpaceBottom()) return;
							break;
						case LEFT:
							if (!this.panel.hasSpaceLeft()) return;
							break;
					}
				}

				for (let i = Math.abs(numPanelsCovered); i > 0; --i) {
					switch (dir) {
						case UP: {
							if (isGrowth) {
								const tNeighbours = this.panel.getTopNeighbours();
								if (tNeighbours.filter(it => it.getEmpty()).length === tNeighbours.length) {
									tNeighbours.forEach(p => p.destroy());
								} else {
									tNeighbours.forEach(p => {
										if (p.canBumpTop()) p.doBumpTop();
										else if (p.canShrinkBottom()) p.doShrinkBottom();
										else p.exile();
									});
								}
							}
							this.panel.height += Math.sign(numPanelsCovered);
							this.panel.y -= Math.sign(numPanelsCovered);
							break;
						}
						case RIGHT: {
							if (isGrowth) {
								const rNeighbours = this.panel.getRightNeighbours();
								if (rNeighbours.filter(it => it.getEmpty()).length === rNeighbours.length) {
									rNeighbours.forEach(p => p.destroy());
								} else {
									rNeighbours.forEach(p => {
										if (p.canBumpRight()) p.doBumpRight();
										else if (p.canShrinkLeft()) p.doShrinkLeft();
										else p.exile();
									});
								}
							}
							this.panel.width += Math.sign(numPanelsCovered);
							break;
						}
						case DOWN: {
							if (isGrowth) {
								const bNeighbours = this.panel.getBottomNeighbours();
								if (bNeighbours.filter(it => it.getEmpty()).length === bNeighbours.length) {
									bNeighbours.forEach(p => p.destroy());
								} else {
									bNeighbours.forEach(p => {
										if (p.canBumpBottom()) p.doBumpBottom();
										else if (p.canShrinkTop()) p.doShrinkTop();
										else p.exile();
									});
								}
							}
							this.panel.height += Math.sign(numPanelsCovered);
							break;
						}
						case LEFT: {
							if (isGrowth) {
								const lNeighbours = this.panel.getLeftNeighbours();
								if (lNeighbours.filter(it => it.getEmpty()).length === lNeighbours.length) {
									lNeighbours.forEach(p => p.destroy());
								} else {
									lNeighbours.forEach(p => {
										if (p.canBumpLeft()) p.doBumpLeft();
										else if (p.canShrinkRight()) p.doShrinkRight();
										else p.exile();
									});
								}
							}
							this.panel.width += Math.sign(numPanelsCovered);
							this.panel.x -= Math.sign(numPanelsCovered);
							break;
						}
					}
				}
				this.panel.setDirty(true);
				this.panel.render();
				this.panel.board.doCheckFillSpaces();
				MiscUtil.clearSelection();
				this.board.reactor.fire("panelResize");
			});
		}

		$ctrlXpandUp.on("mousedown touchstart", xpandHandler.bind(this, UP));
		$ctrlXpandRight.on("mousedown touchstart", xpandHandler.bind(this, RIGHT));
		$ctrlXpandLeft.on("mousedown touchstart", xpandHandler.bind(this, LEFT));
		$ctrlXpandDown.on("mousedown touchstart", xpandHandler.bind(this, DOWN));

		this.panel.$pnl.append($ctrlBg).append($ctrlMove).append($ctrlXpandUp).append($ctrlXpandRight).append($ctrlXpandDown).append($ctrlXpandLeft);
	}

	doShow () {
		this.$ctrls.forEach($c => $c.show());
	}

	doHide () {
		this.$ctrls.forEach($c => $c.hide());
	}
}

class AddMenu {
	constructor () {
		this.tabs = [];

		this.$menu = null;
		this.$tabView = null;
		this.activeTab = null;
		this.pnl = null; // panel where an add button was last clicked
	}

	addTab (tab) {
		tab.setMenu(this);
		this.tabs.push(tab);
		return this;
	}

	get$Menu () {
		return this.$menu;
	}

	setActiveTab (tab) {
		this.$menu.find(`.panel-addmenu-tab-head`).attr(`active`, false);
		if (this.activeTab) this.activeTab.get$Tab().detach();
		this.activeTab = tab;
		this.$tabView.append(tab.get$Tab());
		tab.$head.attr(`active`, true);

		if (tab.doTransitionActive) tab.doTransitionActive();
	}

	hasActiveTab () {
		return this.activeTab !== null;
	}

	getActiveTab () {
		return this.activeTab;
	}

	setFirstTabActive () {
		const t = this.tabs[0];
		this.setActiveTab(t);
	}

	render () {
		if (!this.$menu) {
			const $menu = $(`<div class="panel-addmenu">`);
			this.$menu = $menu;
			const $menuInner = $(`<div class="panel-addmenu-inner dropdown-menu">`).appendTo($menu);
			const $tabBar = $(`<div class="panel-addmenu-bar"/>`).appendTo($menuInner);
			const $tabView = $(`<div class="panel-addmenu-view"/>`).appendTo($menuInner);
			this.$tabView = $tabView;

			this.tabs.forEach(t => {
				t.render();
				const $head = $(`<button class="btn btn-default panel-addmenu-tab-head">${t.label}</button>`).appendTo($tabBar);
				if (t.getSpotlight()) $head.addClass("btn-spotlight");
				const $body = $(`<div class="panel-addmenu-tab-body"/>`).appendTo($tabBar);
				$body.append(t.get$Tab);
				t.$head = $head;
				t.$body = $body;
				$head.on("click", () => this.setActiveTab(t));
			});

			$menu.on("click", () => this.doClose());
			$menuInner.on("click", (e) => e.stopPropagation());
		}
	}

	setPanel (pnl) {
		this.pnl = pnl;
	}

	getPanel () {
		return this.pnl;
	}

	doClose () {
		this.$menu.detach();
	}

	doOpen () {
		$(`body`).append(this.$menu);
	}
}

class AddMenuTab {
	constructor (label) {
		this.label = label;
		this.spotlight = false;

		this.$tab = null;
		this.menu = null;
	}

	get$Tab () {
		return this.$tab;
	}

	genTabId (type) {
		return `tab-${type}-${this.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "_")}`;
	}

	setMenu (menu) {
		this.menu = menu;
	}

	setSpotlight (spotlight) {
		this.spotlight = spotlight;
	}

	getSpotlight () {
		return this.spotlight;
	}
}

class AddMenuVideoTab extends AddMenuTab {
	constructor () {
		super("Embed");
		this.tabId = this.genTabId("tube");
	}

	render () {
		if (!this.$tab) {
			const $tab = $(`<div class="panel-tab-list-wrapper underline-tabs" id="${this.tabId}"/>`);

			const $wrpYT = $(`<div class="tab-body-row"/>`).appendTo($tab);
			const $iptUrlYT = $(`<input class="form-control" placeholder="Paste YouTube URL">`)
				.on("keydown", (e) => {
					if (e.which === 13) $btnAddYT.click();
				})
				.appendTo($wrpYT);
			const $btnAddYT = $(`<button class="btn btn-primary">Embed</button>`).appendTo($wrpYT);
			$btnAddYT.on("click", () => {
				let url = $iptUrlYT.val().trim();
				const m = /https?:\/\/(www\.)?youtube\.com\/watch\?v=(.*?)(&.*$|$)/.exec(url);
				if (url && m) {
					url = `https://www.youtube.com/embed/${m[2]}`;
					this.menu.pnl.doPopulate_YouTube(url);
					this.menu.doClose();
					$iptUrlYT.val("");
				} else {
					JqueryUtil.doToast({
						content: `Please enter a URL of the form: "https://www.youtube.com/watch?v=XXXXXXX"`,
						type: "danger"
					});
				}
			});

			const $wrpTwitch = $(`<div class="tab-body-row"/>`).appendTo($tab);
			const $iptUrlTwitch = $(`<input class="form-control" placeholder="Paste Twitch URL">`)
				.on("keydown", (e) => {
					if (e.which === 13) $btnAddTwitch.click();
				})
				.appendTo($wrpTwitch);
			const $btnAddTwitch = $(`<button class="btn btn-primary">Embed</button>`).appendTo($wrpTwitch);
			const $btnAddTwitchChat = $(`<button class="btn btn-primary">Embed Chat</button>`).appendTo($wrpTwitch);
			const getTwitchM = (url) => {
				return /https?:\/\/(www\.)?twitch\.tv\/(.*?)(\?.*$|$)/.exec(url);
			};
			$btnAddTwitch.on("click", () => {
				let url = $iptUrlTwitch.val().trim();
				const m = getTwitchM(url);
				if (url && m) {
					url = `http://player.twitch.tv/?channel=${m[2]}`;
					this.menu.pnl.doPopulate_Twitch(url);
					this.menu.doClose();
					$iptUrlTwitch.val("");
				} else {
					JqueryUtil.doToast({
						content: `Please enter a URL of the form: "https://www.twitch.tv/XXXXXX"`,
						type: "danger"
					});
				}
			});

			$btnAddTwitchChat.on("click", () => {
				let url = $iptUrlTwitch.val().trim();
				const m = getTwitchM(url);
				if (url && m) {
					url = `http://www.twitch.tv/embed/${m[2]}/chat`;
					this.menu.pnl.doPopulate_TwitchChat(url);
					this.menu.doClose();
					$iptUrlTwitch.val("");
				} else {
					JqueryUtil.doToast({
						content: `Please enter a URL of the form: "https://www.twitch.tv/XXXXXX"`,
						type: "danger"
					});
				}
			});

			const $wrpGeneric = $(`<div class="tab-body-row"/>`).appendTo($tab);
			const $iptUrlGeneric = $(`<input class="form-control" placeholder="Paste any URL">`)
				.on("keydown", (e) => {
					if (e.which === 13) $iptUrlGeneric.click();
				})
				.appendTo($wrpGeneric);
			const $btnAddGeneric = $(`<button class="btn btn-primary">Embed</button>`).appendTo($wrpGeneric);
			$btnAddGeneric.on("click", () => {
				let url = $iptUrlGeneric.val().trim();
				if (url) {
					this.menu.pnl.doPopulate_GenericEmbed(url);
					this.menu.doClose();
				} else {
					JqueryUtil.doToast({
						content: `Please enter a URL!`,
						type: "danger"
					});
				}
			});

			this.$tab = $tab;
		}
	}
}

class AddMenuImageTab extends AddMenuTab {
	constructor () {
		super("Image");
		this.tabId = this.genTabId("image");
	}

	render () {
		if (!this.$tab) {
			const $tab = $(`<div class="panel-tab-list-wrapper underline-tabs" id="${this.tabId}"/>`);

			const $wrpImgur = $(`<div class="tab-body-row"/>`).appendTo($tab);
			$(`<span>Imgur (Anonymous Upload) <i class="text-muted">(accepts <a href="https://help.imgur.com/hc/articles/115000083326" target="_blank" rel="noopener">imgur-friendly formats</a>)</i></span>`).appendTo($wrpImgur);
			const $iptFile = $(`<input type="file" class="hidden">`).on("change", (evt) => {
				const input = evt.target;
				const reader = new FileReader();
				reader.onload = () => {
					const base64 = reader.result.replace(/.*,/, "");
					$.ajax({
						url: "https://api.imgur.com/3/image",
						type: "POST",
						data: {
							image: base64,
							type: "base64"
						},
						headers: {
							Accept: "application/json",
							Authorization: `Client-ID ${IMGUR_CLIENT_ID}`
						},
						success: (data) => {
							this.menu.pnl.doPopulate_Image(data.data.link, ix);
						},
						error: (error) => {
							try {
								JqueryUtil.doToast({
									content: `Failed to upload: ${JSON.parse(error.responseText).data.error}`,
									type: "danger"
								});
							} catch (e) {
								JqueryUtil.doToast({
									content: "Failed to upload: Unknown error",
									type: "danger"
								});
								setTimeout(() => { throw e });
							}
							this.menu.pnl.doPopulate_Empty(ix);
						}
					});
				};
				reader.onerror = () => {
					this.menu.pnl.doPopulate_Empty(ix);
				};
				reader.fileName = input.files[0].name;
				reader.readAsDataURL(input.files[0]);
				const ix = this.menu.pnl.doPopulate_Loading("Uploading"); // will be null if not in tabbed mode
				this.menu.doClose();
			}).appendTo($tab);
			const $btnAdd = $(`<button class="btn btn-primary">Upload</button>`).appendTo($wrpImgur);
			$btnAdd.on("click", () => {
				$iptFile.click();
			});
			$(`<hr class="tab-body-row-sep"/>`).appendTo($tab);

			const $wrpUtl = $(`<div class="tab-body-row"/>`).appendTo($tab);
			const $iptUrl = $(`<input class="form-control" placeholder="Paste image URL">`)
				.on("keydown", (e) => {
					if (e.which === 13) $btnAddUrl.click();
				})
				.appendTo($wrpUtl);
			const $btnAddUrl = $(`<button class="btn btn-primary">Add</button>`).appendTo($wrpUtl);
			$btnAddUrl.on("click", () => {
				let url = $iptUrl.val().trim();
				if (url) {
					this.menu.pnl.doPopulate_Image(url);
					this.menu.doClose();
				} else {
					JqueryUtil.doToast({
						content: `Please enter a URL!`,
						type: "danger"
					});
				}
			});

			this.$tab = $tab;
		}
	}
}

class AddMenuSpecialTab extends AddMenuTab {
	constructor () {
		super("Special");
		this.tabId = this.genTabId("special");
	}

	render () {
		if (!this.$tab) {
			const $tab = $(`<div class="panel-tab-list-wrapper underline-tabs" id="${this.tabId}"/>`);

			const $wrpRoller = $(`<div class="tab-body-row"><span>Dice Roller <i class="text-muted">(pins the existing dice roller to a panel)</i></span></div>`).appendTo($tab);
			const $btnRoller = $(`<button class="btn btn-primary">Pin</button>`).appendTo($wrpRoller);
			$btnRoller.on("click", () => {
				EntryRenderer.dice.bindDmScreenPanel(this.menu.pnl);
				this.menu.doClose();
			});
			$(`<hr class="tab-body-row-sep"/>`).appendTo($tab);

			const $wrpTracker = $(`<div class="tab-body-row"><span>Initiative Tracker</span></div>`).appendTo($tab);
			const $btnTracker = $(`<button class="btn btn-primary">Add</button>`).appendTo($wrpTracker);
			$btnTracker.on("click", () => {
				this.menu.pnl.doPopulate_InitiativeTracker();
				this.menu.doClose();
			});
			$(`<hr class="tab-body-row-sep"/>`).appendTo($tab);

			const $wrpText = $(`<div class="tab-body-row"><span>Basic Text Box <i class="text-muted">(for a feature-rich editor, embed a Google Doc or similar)</i></span></div>`).appendTo($tab);
			const $btnText = $(`<button class="btn btn-primary">Add</button>`).appendTo($wrpText);
			$btnText.on("click", () => {
				this.menu.pnl.doPopulate_TextBox();
				this.menu.doClose();
			});
			$(`<hr class="tab-body-row-sep"/>`).appendTo($tab);

			const $wrpUnitConverter = $(`<div class="tab-body-row"><span>Imperial-Metric Unit Converter</span></div>`).appendTo($tab);
			const $btnUnitConverter = $(`<button class="btn btn-primary">Add</button>`).appendTo($wrpUnitConverter);
			$btnUnitConverter.on("click", () => {
				this.menu.pnl.doPopulate_UnitConverter();
				this.menu.doClose();
			});

			const $wrpMoneyConverter = $(`<div class="tab-body-row"><span>Coin Converter</span></div>`).appendTo($tab);
			const $btnMoneyConverter = $(`<button class="btn btn-primary">Add</button>`).appendTo($wrpMoneyConverter);
			$btnMoneyConverter.on("click", () => {
				this.menu.pnl.doPopulate_MoneyConverter();
				this.menu.doClose();
			});

			// TODO enable this
			/*
			$(`<hr class="tab-body-row-sep"/>`).appendTo($tab);

			const $wrpSundial = $(`<div class="tab-body-row"><span>In-Game Clock</span></div>`).appendTo($tab);
			const $btnSundial = $(`<button class="btn btn-primary">Add</button>`).appendTo($wrpSundial);
			$btnSundial.on("click", () => {
				this.menu.pnl.doPopulate_Sundial();
				this.menu.doClose();
			});
			*/

			this.$tab = $tab;
		}
	}
}

class AddMenuListTab extends AddMenuTab {
	constructor (label, content) {
		super(label);
		this.tabId = this.genTabId("list");
		this.content = content;

		this.list = null;
	}

	render () {
		if (!this.$tab) {
			const $tab = $(`<div class="panel-tab-list-wrapper" id="${this.tabId}"/>`);
			const $srch = $(`<input class="panel-tab-search search form-control" autocomplete="off" placeholder="Search list...">`).appendTo($tab);
			const $list = $(`<div class="list panel-tab-list"/>`).appendTo($tab);
			let temp = "";
			this.content.forEach(d => {
				temp += `<div class="panel-tab-list-item"><span class="name">${d.n}</span></div>`;
			});
			$list.append(temp);
			this.$tab = $tab;
			this.$srch = $srch;
			this.$list = $list;
		}
	}

	doTransitionActive () {
		setTimeout(() => {
			if (!tab.list) {
				tab.list = new List(tab.tabId, {
					valueNames: ["name"],
					listClass: "panel-tab-list"
				});
				ListUtil.bindEscapeKey(tab.list, this.$srch);
			}
		}, 1);
	}
}

class AddMenuSearchTab extends AddMenuTab {
	static _getTitle (subType) {
		switch (subType) {
			case "content": return "Content";
			case "rules": return "Rules";
			case "adventures": return "Adventures";
			case "books": return "Books";
			default: throw new Error(`Unhandled search tab subtype: "${subType}"`);
		}
	}

	constructor (indexes, subType = "content") {
		super(AddMenuSearchTab._getTitle(subType));
		this.tabId = this.genTabId(subType);
		this.indexes = indexes;
		this.cat = "ALL";
		this.subType = subType;

		this.$selCat = null;
		this.$srch = null;
		this.$results = null;
		this.showMsgIpt = null;
		this.doSearch = null;
	}

	_getSearchOptions () {
		switch (this.subType) {
			case "content": return {
				fields: {
					n: {boost: 5, expand: true},
					s: {expand: true}
				},
				bool: "AND",
				expand: true
			};
			case "rules": return {
				fields: {
					h: {boost: 5, expand: true},
					s: {expand: true}
				},
				bool: "AND",
				expand: true
			};
			case "adventures":
			case "books": return {
				fields: {
					c: {boost: 5, expand: true},
					n: {expand: true}
				},
				bool: "AND",
				expand: true
			};
			default: throw new Error(`Unhandled search tab subtype: "${this.subType}"`);
		}
	}

	_get$Row (r) {
		switch (this.subType) {
			case "content": return $(`
				<div class="panel-tab-results-row">
					<span>${r.doc.n}</span>
					<span>${r.doc.s ? `<i title="${Parser.sourceJsonToFull(r.doc.s)}">${Parser.sourceJsonToAbv(r.doc.s)}${r.doc.p ? ` p${r.doc.p}` : ""}</i>` : ""}</span>
				</div>
			`);
			case "rules": return $(`
				<div class="panel-tab-results-row">
					<span>${r.doc.h}</span>
					<span><i>${r.doc.n}, ${r.doc.s}</i></span>
				</div>
			`);
			case "adventures":
			case "books": return $(`
				<div class="panel-tab-results-row">
					<span>${r.doc.c}</span>
					<span><i>${r.doc.n}${r.doc.o ? `, ${r.doc.o}` : ""}</i></span>
				</div>
			`);
			default: throw new Error(`Unhandled search tab subtype: "${this.subType}"`);
		}
	}

	_getAllTitle () {
		switch (this.subType) {
			case "content": return "All Categories";
			case "rules": return "All Categories";
			case "adventures": return "All Adventures";
			case "books": return "All Books";
			default: throw new Error(`Unhandled search tab subtype: "${this.subType}"`);
		}
	}

	_getCatOptionText (it) {
		switch (this.subType) {
			case "content": return it;
			case "rules": return it;
			case "adventures":
			case "books": return Parser.sourceJsonToFull(it);
			default: throw new Error(`Unhandled search tab subtype: "${this.subType}"`);
		}
	}

	render () {
		const flags = {
			doClickFirst: false,
			isWait: false
		};

		this.showMsgIpt = () => {
			flags.isWait = true;
			this.$results.empty().append(DmScreenUtil.getSearchEnter());
		};

		const showMsgDots = () => {
			this.$results.empty().append(DmScreenUtil.getSearchLoading());
		};

		const showNoResults = () => {
			flags.isWait = true;
			this.$results.empty().append(DmScreenUtil.getSearchEnter());
		};

		this.doSearch = () => {
			const srch = this.$srch.val().trim();
			const MAX_RESULTS = 75; // hard cap results

			const searchOptions = this._getSearchOptions();
			const index = this.indexes[this.cat];
			const results = index.search(srch, searchOptions);
			const resultCount = results.length ? results.length : index.documentStore.length;
			const toProcess = results.length ? results : Object.values(index.documentStore.docs).slice(0, 75).map(it => ({doc: it}));

			this.$results.empty();
			if (toProcess.length) {
				const handleClick = (r) => {
					switch (this.subType) {
						case "content": {
							const page = UrlUtil.categoryToPage(r.doc.c);
							const source = r.doc.s;
							const hash = r.doc.u;

							this.menu.pnl.doPopulate_Stats(page, source, hash);
							break;
						}
						case "rules": {
							this.menu.pnl.doPopulate_Rules(r.doc.b, r.doc.p, r.doc.h);
							break;
						}
						case "adventures": {
							this.menu.pnl.doPopulate_Adventures(r.doc.a, r.doc.p);
							break;
						}
						case "books": {
							this.menu.pnl.doPopulate_Books(r.doc.b, r.doc.p);
							break;
						}
						default: throw new Error(`Unhandled search tab subtype: "${this.subType}"`);
					}
					this.menu.doClose();
				};

				if (flags.doClickFirst) {
					handleClick(toProcess[0]);
					flags.doClickFirst = false;
					return;
				}

				const res = toProcess.slice(0, MAX_RESULTS); // hard cap at 75 results

				res.forEach(r => {
					this._get$Row(r).on("click", () => handleClick(r)).appendTo(this.$results);
				});

				if (resultCount > MAX_RESULTS) {
					const diff = resultCount - MAX_RESULTS;
					this.$results.append(`<div class="panel-tab-results-row panel-tab-results-row-display-only">...${diff} more result${diff === 1 ? " was" : "s were"} hidden. Refine your search!</div>`);
				}
			} else {
				if (!srch.trim()) this.showMsgIpt();
				else showNoResults();
			}
		};

		if (!this.$tab) {
			const $tab = $(`<div class="panel-tab-list-wrapper" id="${this.tabId}"/>`);
			const $wrpCtrls = $(`<div class="panel-tab-controls"/>`).appendTo($tab);

			const $selCat = $(`
				<select class="form-control panel-tab-cat">
					<option value="ALL">${this._getAllTitle()}</option>
				</select>
			`).appendTo($wrpCtrls).toggle(Object.keys(this.indexes).length !== 1);
			Object.keys(this.indexes).sort().filter(it => it !== "ALL").forEach(it => {
				$selCat.append(`<option value="${it}">${this._getCatOptionText(it)}</option>`)
			});
			$selCat.on("change", () => {
				this.cat = $selCat.val();
				this.doSearch();
			});

			const $srch = $(`<input class="panel-tab-search search form-control" autocomplete="off" placeholder="Search...">`).appendTo($wrpCtrls);
			const $results = $(`<div class="panel-tab-results"/>`).appendTo($tab);

			DmScreenUtil.bindAutoSearch($srch, {
				flags: flags,
				search: this.doSearch,
				showWait: showMsgDots
			});

			this.$tab = $tab;
			this.$selCat = $selCat;
			this.$srch = $srch;
			this.$results = $results;

			this.doSearch();
		}
	}

	doTransitionActive () {
		this.$srch.val("").focus();
		if (this.doSearch) this.doSearch();
	}
}

class RuleLoader {
	static async pFill (book) {
		const $$$ = RuleLoader.cache;
		if ($$$[book]) return $$$[book];

		const data = DataUtil.loadJSON(`data/generated/${book}.json`);
		Object.keys(data.data).forEach(b => {
			const ref = data.data[b];
			if (!$$$[b]) $$$[b] = {};
			ref.forEach((c, i) => {
				if (!$$$[b][i]) $$$[b][i] = {};
				c.entries.forEach(s => {
					$$$[b][i][s.name] = s;
				});
			});
		});
	}

	static getFromCache (book, chapter, header) {
		return RuleLoader.cache[book][chapter][header];
	}
}
RuleLoader.cache = {};

class AdventureOrBookLoader {
	constructor (type) {
		this._type = type;
		this._cache = {};
	}

	_getJsonPath (bookOrAdventure) {
		switch (this._type) {
			case "adventure": return `data/adventure/adventure-${bookOrAdventure.toLowerCase()}.json`
			case "book": return `data/book/book-${bookOrAdventure.toLowerCase()}.json`
			default: throw new Error(`Unknown loader type "${this._type}"`)
		}
	}

	async pFill (bookOrAdventure) {
		if (this._cache[bookOrAdventure]) return this._cache[bookOrAdventure];

		const data = await DataUtil.loadJSON(this._getJsonPath(bookOrAdventure));
		this._cache[bookOrAdventure] = {};
		data.data.forEach((chap, i) => this._cache[bookOrAdventure][i] = chap);
	}

	getFromCache (adventure, chapter) {
		return this._cache[adventure][chapter];
	}
}

class AdventureLoader extends AdventureOrBookLoader { constructor () { super("adventure"); } }
class BookLoader extends AdventureOrBookLoader { constructor () { super("book"); } }

const adventureLoader = new AdventureLoader();
const bookLoader = new BookLoader();

class NoteBox {
	static make$Notebox (board, content) {
		const $iptText = $(`<textarea class="panel-content-textarea" placeholder="Supports embedding (CTRL-click the text to activate the embed):\n • Clickable rollers,  [[1d20+2]]\n • Tags (as per the Demo page), {@creature goblin}">${content || ""}</textarea>`)
			.on("keydown", () => {
				board.doSaveStateDebounced();
			})
			.on("mousedown", (evt) => {
				if (evt.ctrlKey) {
					setTimeout(() => {
						const txt = $iptText[0];
						if (txt.selectionStart === txt.selectionEnd) {
							const doDesel = (pos = 0) => {
								setTimeout(() => txt.setSelectionRange(pos, pos), 1);
							};

							const pos = txt.selectionStart;
							const text = txt.value;
							const l = text.length;
							let beltStack = [];
							let braceStack = [];
							let belts = 0;
							let braces = 0;
							let beltsAtPos = null;
							let bracesAtPos = null;
							let lastBeltPos = null;
							let lastBracePos = null;
							outer:
							for (let i = 0; i < l; ++i) {
								const c = text[i];
								switch (c) {
									case "[":
										belts = Math.min(belts + 1, 2);
										if (belts === 2) beltStack = [];
										lastBeltPos = i;
										break;
									case "]":
										belts = Math.max(belts - 1, 0);
										if (belts === 0 && i > pos) break outer;
										break;
									case "{":
										if (text[i + 1] === "@") {
											braces = 1;
											braceStack = [];
											lastBracePos = i;
										}
										break;
									case "}":
										braces = 0;
										if (i > pos) break outer;
										break;
									default:
										if (belts === 2) {
											beltStack.push(c);
										}
										if (braces) {
											braceStack.push(c);
										}
								}
								if (i === pos) {
									beltsAtPos = belts;
									bracesAtPos = braces;
								}
							}

							if (beltsAtPos === 2 && belts === 0) {
								const str = beltStack.join("");
								if (/^([1-9]\d*)?d([1-9]\d*)(\s?[+-]\s?\d+)?$/i.exec(str)) {
									EntryRenderer.dice.roll2(str.replace(`[[`, "").replace(`]]`, ""), {
										user: false,
										name: "DM Screen"
									});
									doDesel(lastBeltPos);
								}
							} else if (bracesAtPos === 1 && braces === 0) {
								const str = braceStack.join("");
								const tag = str.split(" ")[0].replace(/^@/, "");
								if (EntryRenderer.HOVER_TAG_TO_PAGE[tag]) {
									const r = EntryRenderer.getDefaultRenderer().renderEntry(`{${str}`);
									evt.type = "mouseover";
									evt.shiftKey = true;
									$(r).trigger(evt);
								}
								doDesel(lastBracePos);
							}
						}
					}, 1); // defer slightly to allow text to be selected
				}
			});

		return $iptText;
	}
}

class UnitConverter {
	static make$Converter (board, state) {
		const units = [
			new UnitConverterUnit("Inches", "2.54", "Centimetres", "0.394"),
			new UnitConverterUnit("Feet", "0.305", "Metres", "3.28"),
			new UnitConverterUnit("Miles", "1.61", "Kilometres", "0.620"),
			new UnitConverterUnit("Pounds", "0.454", "Kilograms", "2.20"),
			new UnitConverterUnit("Gallons", "3.79", "Litres", "0.264")
		];

		let ixConv = state.c || 0;
		let dirConv = state.d || 0;

		const $wrpConverter = $(`<div class="dm-unitconv split-column"/>`);

		const $tblConvert = $(`<table class="table-striped"/>`).appendTo($wrpConverter);
		const $tbodyConvert = $(`<tbody/>`).appendTo($tblConvert);
		units.forEach((u, i) => {
			const $tr = $(`<tr class="row clickable"/>`).appendTo($tbodyConvert);
			const clickL = () => {
				ixConv = i;
				dirConv = 0;
				updateDisplay();
			};
			const clickR = () => {
				ixConv = i;
				dirConv = 1;
				updateDisplay();
			};
			$(`<td class="col-3">${u.n1}</td>`).click(clickL).appendTo($tr);
			$(`<td class="col-3 code">×${u.x1.padStart(5)}</td>`).click(clickL).appendTo($tr);
			$(`<td class="col-3">${u.n2}</td>`).click(clickR).appendTo($tr);
			$(`<td class="col-3 code">×${u.x2.padStart(5)}</td>`).click(clickR).appendTo($tr);
		});

		const $wrpIpt = $(`<div class="split wrp-ipt"/>`).appendTo($wrpConverter);

		const $wrpLeft = $(`<div class="split-column wrp-ipt-inner"/>`).appendTo($wrpIpt);
		const $lblLeft = $(`<span class="bold"/>`).appendTo($wrpLeft);
		const $iptLeft = $(`<textarea class="ipt form-control">${state.i || ""}</textarea>`).appendTo($wrpLeft);

		const $btnSwitch = $(`<button class="btn btn-primary btn-switch">⇆</button>`).click(() => {
			dirConv = Number(!dirConv);
			updateDisplay();
		}).appendTo($wrpIpt);

		const $wrpRight = $(`<div class="split-column wrp-ipt-inner"/>`).appendTo($wrpIpt);
		const $lblRight = $(`<span class="bold"/>`).appendTo($wrpRight);
		const $iptRight = $(`<textarea class="ipt form-control" disabled style="background: #0000"/>`).appendTo($wrpRight);

		const updateDisplay = () => {
			const it = units[ixConv];
			const [lblL, lblR] = dirConv === 0 ? [it.n1, it.n2] : [it.n2, it.n1];
			$lblLeft.text(lblL);
			$lblRight.text(lblR);
			handleInput();
		};

		const mMaths = /^([0-9.+\-*/ ()e])*$/;
		const handleInput = () => {
			const showInvalid = () => {
				$iptLeft.addClass(`ipt-invalid`);
				$iptRight.val("");
			};
			const showValid = () => {
				$iptLeft.removeClass(`ipt-invalid`);
			};

			const val = ($iptLeft.val() || "").trim();
			if (!val) {
				showValid();
				$iptRight.val("");
			} else if (mMaths.exec(val)) {
				showValid();
				const it = units[ixConv];
				const mL = [Number(it.x1), Number(it.x2)][dirConv];
				try {
					/* eslint-disable */
					const total = eval(val);
					/* eslint-enable */
					$iptRight.val(total * mL);
				} catch (e) {
					$iptLeft.addClass(`ipt-invalid`);
					$iptRight.val("")
				}
			} else showInvalid();
			board.doSaveStateDebounced();
		};

		DmScreenUtil.bindTypingEnd($iptLeft, handleInput);

		updateDisplay();

		$wrpConverter.data("getState", () => {
			return {
				c: ixConv,
				d: dirConv,
				i: $iptLeft.val()
			};
		});

		return $wrpConverter;
	}
}

class UnitConverterUnit {
	constructor (n1, x1, n2, x2) {
		this.n1 = n1;
		this.x1 = x1;
		this.n2 = n2;
		this.x2 = x2;
	}
}

// TODO
// a simple time keeping tool
class Sundial {
	static make$Sundail (board, state) {
		const $wrpConverter = $(`<div class="dm_sundial"/>`);

		$wrpConverter.data("getState", () => {
			return {};
		});

		return $wrpConverter;
	}
}

class DmScreenUtil {
	static getSearchNoResults () {
		return `<div class="panel-tab-message"><i>No results.</i></div>`;
	}

	static getSearchLoading () {
		return `<div class="panel-tab-message"><i>\u2022\u2022\u2022</i></div>`;
	}

	static getSearchEnter () {
		return `<div class="panel-tab-message"><i>Enter a search.</i></div>`;
	}

	/**
	 * @param $srch input element
	 * @param opt should contain:
	 *  `search` -- function which runs search
	 *  `flags` -- object which contains:
	 *    `isWait` -- flag tracking "waiting for user to stop typing"
	 *    `doClickFirst` -- flag tracking "should first result get clicked"
	 *  `showWait` -- function which displays loading dots
	 */
	static bindAutoSearch ($srch, opt) {
		DmScreenUtil.bindTypingEnd(
			$srch,
			() => {
				opt.search();
			},
			(e) => {
				if (e.which === 13) {
					opt.flags.doClickFirst = true;
					opt.search();
				}
			},
			() => {
				if (opt.flags.isWait) {
					opt.flags.isWait = false;
					opt.showWait();
				}
			},
			() => {
				if ($srch.val() && $srch.val().trim().length) opt.search();
			}
		);
	}

	static bindTypingEnd ($ipt, fnKeyup, fnKeypress, fnKeydown, fnClick) {
		let typeTimer;
		$ipt.on("keyup", (e) => {
			clearTimeout(typeTimer);
			typeTimer = setTimeout(() => {
				fnKeyup(e);
			}, DmScreenUtil.TYPE_TIMEOUT_MS);
		});
		$ipt.on("keypress", (e) => {
			if (fnKeypress) fnKeypress(e);
		});
		$ipt.on("keydown", (e) => {
			if (fnKeydown) fnKeydown(e);
			clearTimeout(typeTimer);
		});
		$ipt.on("click", () => {
			if (fnClick) fnClick();
		});
	}

	/**
	 * @param titleOrOpts Modal title, or an object of options, which are:
	 *   - `title` The modal title.
	 *   - `fullHeight` If the modal should take up (almost) the full height of the screen.
	 *   - `fullWidth` if the modal should take up (almost) the full width of the screen.
	 *   - `cbClose` Callback run when the modal is closed.
	 * @param cbClose Callback run when the modal is closed.
	 * @returns JQuery Modal inner wrapper, to have content added as required.
	 */
	static getShow$Modal (titleOrOpts, cbClose) {
		const opts = typeof titleOrOpts === "string" ? {} : titleOrOpts;
		if (typeof titleOrOpts === "string") {
			opts.title = titleOrOpts;
			opts.cbClose = cbClose;
		}

		const addStyles = [];
		if (opts.fullHeight) {
			addStyles.push(`height: 100%`);
		}

		const $modal = $(`<div class="panel-addmenu">`);
		const $scroller = $(`<div class="panel-addmenu-modal-scroller"/>`).data("close", () => $modal.click());
		const $modalInner = $(`<div class="panel-addmenu-inner panel-addmenu-inner--modal dropdown-menu${opts.fullWidth ? ` panel-addmenu-inner--large-modal` : ""}"${addStyles.length ? ` style="${addStyles.join(";")}"` : ""}><h4>${opts.title}</h4><div data-r/></div>`).swap($scroller)
			.appendTo($modal).click(e => e.stopPropagation());
		const doClose = () => $modal.remove();
		$modal.click(() => {
			if (opts.cbClose) opts.cbClose();
			doClose();
		});
		$(`body`).append($modal);
		return $scroller;
	}

	static addModal$Sep ($modalInner) {
		$modalInner.append(`<hr class="tab-body-row-sep">`);
	}

	static _getAdd$Row ($modalInner, tag = "div") {
		return $(`<${tag} class="tab-body-row"/>`).appendTo($modalInner);
	}

	static getAddModal$RowCb ($modalInner, labelText, objectWithProp, propName, helpText) {
		const $row = DmScreenUtil._getAdd$Row($modalInner, "label").addClass(`tab-body-row--cb`);
		if (helpText) $row.attr("title", helpText);
		$row.append(`<span>${labelText}</span>`);
		const $cb = $(`<input type="checkbox">`).appendTo($row)
			.prop("checked", objectWithProp[propName])
			.on("change", () => objectWithProp[propName] = $cb.prop("checked"));
		return $cb;
	}
}
DmScreenUtil.TYPE_TIMEOUT_MS = 100; // auto-search after 100ms

window.addEventListener("load", () => {
	ExcludeUtil.pInitialise(); // don't await, as this is only used for search
	// expose it for dbg purposes
	window.DM_SCREEN = new Board();
	EntryRenderer.hover.bindDmScreen(window.DM_SCREEN);
	window.DM_SCREEN.pInitialise();
});
