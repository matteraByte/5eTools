if (typeof require !== "undefined") {
	require('../js/utils.js');
	require('../js/entryrender.js');
}

class Omnidexer {
	constructor (id = 0) {
		/**
		 * Produces index of the form:
		 * {
		 *   n: "Display Name",
		 *   s: "PHB", // source
		 *   u: "spell name_phb,
		 *   p: 110, // page
		 *   h: 1 // if hover enabled, otherwise undefined
		 *   c: 10, // category ID
		 *   id: 123 // index ID
		 * }
		 */
		this.index = [];
		this.id = id;
	}

	getIndex () {
		return this.index;
	}

	static getProperty (obj, withDots) {
		return withDots.split(".").reduce((o, i) => o[i], obj);
	}

	addToIndex (arbiter, j, idOffset) {
		if (idOffset) this.id += idOffset;
		const index = this.index;
		let id = this.id;

		const getToAdd = (it, toMerge, i) => {
			const src = Omnidexer.getProperty(it, arbiter.source || "source");
			const hash = arbiter.hashBuilder
				? arbiter.hashBuilder(it, i)
				: UrlUtil.URL_TO_HASH_BUILDER[arbiter.baseUrl](it);
			const toAdd = {
				c: arbiter.category,
				s: src,
				id: id++,
				u: hash,
				p: Omnidexer.getProperty(it, arbiter.page || "page")
			};
			if (arbiter.hover) {
				toAdd.h = 1;
			}
			Object.assign(toAdd, toMerge);
			return toAdd;
		};

		Omnidexer.getProperty(j, arbiter.listProp).forEach((it, i) => {
			const name = Omnidexer.getProperty(it, arbiter.primary || "name");
			if (!it.noDisplay) {
				const toAdd = getToAdd(it, {n: name}, i);
				if ((!arbiter.filter || !arbiter.filter(it)) && !arbiter.onlyDeep) index.push(toAdd);
				if (arbiter.deepIndex) {
					const primary = {it: it, i: i, parentName: name};
					const deepItems = arbiter.deepIndex(primary, it);
					deepItems.forEach(item => {
						const toAdd = getToAdd(it, item);
						if (!arbiter.filter || !arbiter.filter(it)) index.push(toAdd);
					})
				}
			}
		});

		this.id = id;
	}
}
/**
 * See docs for `TO_INDEX` below.
 * Instead of `file` these have `dir` and will read an `index.json` from that directory to find all files to be indexed
 */
Omnidexer.TO_INDEX__FROM_INDEX_JSON = [
	{
		category: 1,
		dir: "bestiary",
		primary: "name",
		source: "source",
		page: "page",
		listProp: "monster",
		baseUrl: "bestiary.html",
		hover: true
	},
	{
		category: 2,
		dir: "spells",
		primary: "name",
		source: "source",
		page: "page",
		listProp: "spell",
		baseUrl: "spells.html",
		hover: true
	},
	{
		category: 5,
		dir: "class",
		primary: "name",
		source: "source",
		page: "page",
		listProp: "class",
		baseUrl: "classes.html",
		deepIndex: (primary, it) => {
			return it.subclasses.map(sc => ({
				n: `${primary.parentName}; ${sc.name}`,
				s: sc.source,
				u: `${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](it)}${HASH_PART_SEP}${HASH_SUBCLASS}${UrlUtil.encodeForHash(sc.name)}${HASH_SUB_LIST_SEP}${UrlUtil.encodeForHash(sc.source)}`
			}))
		}
	}
];
/**
 * category: a category from utils.js (see `Parser.pageCategoryToFull`)
 * file: source JSON file
 * primary: (OPTIONAL; default "name") JSON property to index, per item.
 * 		Can be a chain of properties e.g. `outer.inner.name`
 * source: (OPTIONAL; default "source") JSON property containing the item's source, per item.
 * 		Can be a chan of properties, e.g. `outer.inner.source`
 * page: (OPTIONAL; default "page") JSON property containing the item's page in the relevant book, per item.
 * 		Can be a chain of properties, e.g. `outer.inner.page`
 * listProp: the JSON always has a root property containing the list of items. Provide the name of this property here.
 * 		Can be a chain of properties e.g. `outer.inner.name`
 * baseUrl: the base URL (which page) to use when forming index URLs
 * deepIndex: (OPTIONAL) a function which returns a list of strings to be indexed, in addition to the primary index.
 * 		Once indexed, these will share the item's source, URL (and page).
 * hashBuilder: (OPTIONAL) a function which takes a data item and returns a hash for it.
 * 		Generally not needed, as UrlUtils has a defined list of hash-building functions for each page.
 * test_extraIndex: (OPTIONAL) a function which can optionally be called per item if `doExtraIndex` is true.
 * 		Used to generate a complete list of links for testing; should not be used for production index.
 * 		Should return full index objects.
 * hover: (OPTIONAL) a boolean indicating if the generated link should have `EntryRenderer` hover functionality.
 * filter: (OPTIONAL) a function which takes a data item and returns true if it should be indexed, false otherwise
 * postLoad: (OPTIONAL) a function which takes the data set, does some post-processing,
 * 		and runs a callback when done (synchronously)
 *
 */
Omnidexer.TO_INDEX = [
	{
		category: 3,
		file: "backgrounds.json",
		listProp: "background",
		baseUrl: "backgrounds.html",
		hover: true
	},
	{
		category: 4,
		file: "basicitems.json",
		listProp: "basicitem",
		baseUrl: "items.html",
		hover: true
	},
	{
		category: 6,
		file: "conditionsdiseases.json",
		listProp: "condition",
		baseUrl: "conditionsdiseases.html",
		hover: true
	},
	{
		category: 7,
		file: "feats.json",
		listProp: "feat",
		baseUrl: "feats.html",
		hover: true
	},
	{
		category: 8,
		file: "invocations.json",
		listProp: "invocation",
		baseUrl: "invocations.html",
		hover: true
	},
	{
		category: 4,
		file: "items.json",
		page: "page",
		listProp: "item",
		baseUrl: "items.html",
		hover: true
	},
	{
		category: 4,
		file: "items.json",
		page: "page",
		listProp: "itemGroup",
		baseUrl: "items.html",
		hover: true
	},
	{
		category: 9,
		file: "psionics.json",
		listProp: "psionic",
		baseUrl: "psionics.html",
		deepIndex: (primary, it) => {
			if (!it.modes) return [];
			return it.modes.map(m => ({d: 1, n: `${primary.parentName}; ${m.name}`}))
		},
		hover: true
	},
	{
		category: 10,
		file: "races.json",
		listProp: "race",
		baseUrl: "races.html",
		onlyDeep: true,
		deepIndex: (primary, it) => {
			const subs = EntryRenderer.race._mergeSubrace(it);
			return subs.map(r => ({
				n: r.name,
				s: r.source,
				u: UrlUtil.URL_TO_HASH_BUILDER["races.html"](r)
			}));
		},
		hover: true
	},
	{
		category: 11,
		file: "rewards.json",
		listProp: "reward",
		baseUrl: "rewards.html",
		hover: true
	},
	{
		category: 12,
		file: "variantrules.json",
		listProp: "variantrule",
		baseUrl: "variantrules.html",
		deepIndex: (primary, it) => {
			const names = [];
			it.entries.forEach(e => {
				EntryRenderer.getNames(names, e);
			});
			return names.map(n => ({d: 1, n: `${primary.parentName}; ${n}`}));
		}
	},
	{
		category: 13,
		file: "adventures.json",
		source: "id",
		listProp: "adventure",
		baseUrl: "adventure.html"
	},
	{
		category: 4,
		file: "magicvariants.json",
		source: "inherits.source",
		page: "inherits.page",
		listProp: "variant",
		baseUrl: "items.html",
		hashBuilder: (it) => {
			return UrlUtil.encodeForHash([it.name, it.inherits.source]);
		},
		test_extraIndex: () => {
			const specVars = UtilSearchIndex._test_getBasicVariantItems();

			return specVars.map(sv => ({c: 4, u: UrlUtil.encodeForHash([sv.name, sv.source])}));
		},
		hover: true
	},
	{
		category: 14,
		file: "deities.json",
		postLoad: DataUtil.deity.doPostLoad,
		listProp: "deity",
		baseUrl: "deities.html",
		hover: true,
		filter: (it) => {
			return it.reprinted;
		}
	},
	{
		category: 15,
		file: "objects.json",
		listProp: "object",
		baseUrl: "objects.html",
		hover: true
	},
	{
		category: 16,
		file: "trapshazards.json",
		listProp: "trap",
		baseUrl: "trapshazards.html",
		hover: true
	},
	{
		category: 17,
		file: "trapshazards.json",
		listProp: "hazard",
		baseUrl: "trapshazards.html",
		hover: true
	},
	{
		category: 18,
		file: "bookref-quick.json",
		listProp: "data.bookref-quick",
		baseUrl: "quickreference.html",
		hashBuilder: (it, i) => {
			return `bookref-quick,${i}`;
		},
		onlyDeep: true,
		deepIndex: (primary, it) => {
			const names = it.entries.map(e => e.name);
			return names.map(n => {
				return {
					n: n,
					u: `bookref-quick${HASH_PART_SEP}${primary.i}${HASH_PART_SEP}${UrlUtil.encodeForHash(n.toLowerCase())}`,
					s: undefined
				}
			});
		}
	},
	{
		category: 19,
		file: "cultsboons.json",
		listProp: "cult",
		baseUrl: "cultsboons.html",
		hover: true
	},
	{
		category: 20,
		file: "cultsboons.json",
		listProp: "boon",
		baseUrl: "cultsboons.html",
		hover: true
	},
	{
		category: 21,
		file: "conditionsdiseases.json",
		listProp: "disease",
		baseUrl: "conditionsdiseases.html",
		hover: true
	}
];

if (typeof module !== "undefined") {
	module.exports.Omnidexer = Omnidexer;
}