"use strict";

/*
 * Various utilities to assist in statblock parse/conversion. Formatted as a Node module, to allow external use.
 *
 * In all cases, the first argument, `m`, is a monster statblock.
 * Additionally, `cbMan` is a callback which should accept up to two arguments representing part of the statblock which
 * require manual consideration/tagging, and an error message, respectively.
 * Where available, `cbErr` accepts the same arguments, and may be called when an error occurs (the parser encounters
 * something too far from acceptable to be solved with manual conversion; for instance, in the case of completely junk
 * data, or common errors which should be corrected prior to running the parser).
 */

class AcConvert {
	static tryPostProcessAc (m, cbMan, cbErr) {
		let nuAc = [];
		const basic = /^(\d+)( \((.*?)\))?$/.exec(m.ac.trim());
		if (basic) {
			if (basic[3]) {
				const brak = basic[3];
				let cur = {
					ac: Number(basic[1])
				};

				let nextPart = null;

				const from = [];

				const splitter = StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX;

				const parts = brak.split(splitter).map(it => it.trim());

				parts.forEach(p => {
					const pLow = p.toLowerCase();
					switch (pLow) {
						// unhandled/other
						case "unarmored defense":
						case "suave defense":
						case "armor scraps":
						case "barding scraps":
						case "patchwork armor":
						case "see natural armor feature":
						case "barkskin trait":
						case "sylvan warrior":
						case "cage":
						case "chains":
						case "coin mail":
						case "crude armored coat":
						case "improvised armor":
						case "magic robes":
						case "makeshift armor":
						case "natural and mystic armor":
						case "padded armor":
						case "padded leather":
						case "parrying dagger":
						case "plant fiber armor":
						case "plus armor worn":
						case "rag armor":
						case "ring of protection +2":
						case "see below":
						case "wicker armor":
						case "bone armor":
							from.push(p);
							break;

						// au naturel
						case "natural armor":
						case "natural":
							from.push("natural armor");
							break;

						// spells
						case "foresight bonus":
							from.push(`{@spell foresight} bonus`);
							break;

						case "natural barkskin":
							from.push(`natural {@spell barkskin}`);
							break;

						case "mage armor":
							from.push("{@spell mage armor}");
							break;

						// armour
						case "studded leather armor":
						case "studded leather":
							from.push("{@item studded leather armor|phb}");
							break;

						case "leather armor":
						case "leather":
							from.push("{@item leather armor|phb}");
							break;

						case "half plate":
							from.push("{@item half plate armor|phb}");
							break;

						case "splint":
						case "splint armor":
							from.push("{@item splint armor|phb}");
							break;

						case "chain mail":
						case "chainmail":
						case "chain armor":
							from.push("{@item chain mail|phb}");
							break;

						case "scale mail":
						case "scale armor":
						case "scale":
							from.push("{@item scale mail|phb}");
							break;

						case "hide armor":
						case "hide":
							from.push("{@item hide armor|phb}");
							break;

						case "chain shirt":
							from.push("{@item chain shirt|phb}");
							break;

						case "breastplate":
							from.push("{@item breastplate|phb}");
							break;

						case "ring mail":
							from.push("{@item ring mail|phb}");
							break;

						case "plate mail":
						case "platemail":
						case "plate":
						case "plate armor":
						case "full plate":
							from.push("{@item plate armor|phb}");
							break;

						case "shield":
							from.push("{@item shield|phb}");
							break;

						case "shields":
							from.push("{@item shield|phb|shields}");
							break;

						// magic items
						case "dwarven plate":
							from.push("{@item dwarven plate}");
							break;
						case "elven chain":
							from.push("{@item elven chain}");
							break;
						case "glamoured studded leather":
							from.push("{@item glamoured studded leather}");
							break;
						case "bracers of defense":
							from.push("{@item bracers of defense}");
							break;
						case "badge of the watch":
							from.push("{@item Badge of the Watch|wdh}");
							break;
						case "ring of protection":
							from.push("{@item ring of protection}");
							break;
						case "robe of the archmagi":
							from.push("{@item robe of the archmagi}");
							break;
						case "staff of power":
							from.push("{@item staff of power}");
							break;

						// TODO general auto-detect for enchanted versions of items
						case "+3 plate armor":
							from.push("{@item plate armor +3|dmg|+3 plate armor}");
							break;
						case "half plate armor +1":
							from.push("{@item half plate armor +1|dmg|+1 half-plate armor}");
							break;
						case "scale mail +1":
							from.push("{@item scale mail +1|dmg|+1 scale mail}");
							break;
						case "scale mail +2":
							from.push("{@item scale mail +2|dmg|+2 scale mail}");
							break;
						case "splint mail +2":
							from.push("{@item splint armor +2|dmg|+2 splint armor}");
							break;
						case "studded leather armor +1":
							from.push("{@item studded leather armor +1|dmg|+1 studded leather armor}");
							break;
						case "+2 leather armor":
							from.push("{@item leather armor +2|dmg|+2 leather armor}");
							break;
						case "+3 leather armor":
							from.push("{@item leather armor +3|dmg|+3 leather armor}");
							break;

						default: {
							if (pLow.endsWith("with mage armor") || pLow.endsWith("with barkskin")) {
								const numMatch = /(\d+) with (.*)/.exec(pLow);
								if (!numMatch) throw new Error("Spell AC but no leading number?");
								let spell = null;
								if (numMatch[2] === "mage armor") {
									spell = `{@spell mage armor}`
								} else if (numMatch[2] === "barkskin") {
									spell = `{@spell barkskin}`
								} else {
									throw new Error(`Unhandled spell! ${numMatch[2]}`)
								}

								nextPart = {
									ac: Number(numMatch[1]),
									condition: `with ${spell}`,
									braces: true
								}
							} else {
								if (cbMan) cbMan(p, `AC requires manual checking: ${m.name} ${m.source} p${m.page}`);
								nuAc.push(p)
							}
						}
					}
				});

				if (from.length) {
					cur.from = from;
					nuAc.push(cur);
				} else {
					nuAc.push(cur.ac);
				}
				if (nextPart) nuAc.push(nextPart)
			} else {
				nuAc.push(Number(basic[1]));
			}
		} else {
			if (cbErr) cbErr(m.ac, `${`${m.name} ${m.source} p${m.page}`.padEnd(48)} => ${m.ac}`);
			nuAc.push(m.ac);
		}
		m.ac = nuAc;
	}
}

class TagAttack {
	static tryTagAttacks (m, cbMan) {
		const handleProp = (prop) => {
			if (m[prop]) {
				m[prop].forEach(it => {
					if (it.entries) {
						const str = JSON.stringify(it.entries, null, "\t");
						const out = str.replace(/([\t ]")((?:(?:[A-Z][a-z]*|or) )*Attack:) /g, (...m) => {
							if (TagAttack.MAP[m[2]]) {
								return `${m[1]}${TagAttack.MAP[m[2]]} `;
							} else {
								cbMan(m[2]);
								return m[0];
							}
						});
						it.entries = JSON.parse(out);
					}
				})
			}
		};

		handleProp("action");
		handleProp("reaction");
		handleProp("trait");
		handleProp("legendary");
		handleProp("variant");
	}
}
TagAttack.MAP = {
	"Melee Weapon Attack:": "{@atk mw}",
	"Ranged Weapon Attack:": "{@atk rw}",
	"Melee Attack:": "{@atk m}",
	"Ranged Attack:": "{@atk r}",
	"Area Attack:": "{@atk a}",
	"Area Weapon Attack:": "{@atk aw}",
	"Melee Spell Attack:": "{@atk ms}",
	"Melee or Ranged Weapon Attack:": "{@atk mw,rw}",
	"Ranged Spell Attack:": "{@atk rs}",
	"Melee or Ranged Spell Attack:": "{@atk ms,rs}",
	"Melee or Ranged Attack:": "{@atk m,r}"
};

class TagHit {
	static tryTagHits (m) {
		const handleProp = (prop) => {
			if (m[prop]) {
				m[prop].forEach(it => {
					if (it.entries) {
						const str = JSON.stringify(it.entries, null, "\t");
						const out = str.replace(/Hit: /g, "{@h}");
						it.entries = JSON.parse(out);
					}
				})
			}
		};

		handleProp("action");
		handleProp("reaction");
		handleProp("trait");
		handleProp("legendary");
		handleProp("variant");
	}
}

class AlignmentConvert {
	static tryConvertAlignment (m, cbMan) {
		const a = m.alignment;
		if (!AlignmentConvert.ALIGNMENTS[a]) {
			if (cbMan) cbMan(a);
		} else {
			m.alignment = AlignmentConvert.ALIGNMENTS[a];
		}
	}
}
AlignmentConvert.ALIGNMENTS = {
	"lawful good": ["L", "G"],
	"neutral good": ["N", "G"],
	"chaotic good": ["C", "G"],
	"chaotic neutral": ["C", "N"],
	"lawful evil": ["L", "E"],
	"lawful neutral": ["L", "N"],
	"neutral evil": ["L", "E"],
	"chaotic evil": ["C", "E"],

	"good": ["G"],
	"lawful": ["L"],
	"neutral": ["N"],
	"chaotic": ["C"],
	"evil": ["E"],

	"unaligned": ["U"],

	"any alignment": ["A"],

	"any non-good alignment": ["L", "NX", "C", "NY", "E"],
	"any non-lawful alignment": ["NX", "C", "G", "NY", "E"],

	"any chaotic alignment": ["C", "G", "NY", "E"],
	"any evil alignment": ["L", "NX", "C", "E"],
	"any lawful alignment": ["L", "G", "NY", "E"],
	"any good alignment": ["L", "NX", "C", "G"],

	// TODO general auto-detect for percentage-weighted alignments
	"neutral good (50%) or neutral evil (50%)": [{alignment: ["N", "G"], chance: 50}, {
		alignment: ["N", "E"],
		chance: 50
	}],
	"chaotic good (75%) or neutral evil (25%)": [{alignment: ["C", "G"], chance: 75}, {
		alignment: ["N", "E"],
		chance: 25
	}],
	"chaotic good or chaotic neutral": [{alignment: ["C", "G"]}, {alignment: ["C", "N"]}],
	"lawful neutral or lawful evil": [{alignment: ["L", "N"]}, {alignment: ["L", "E"]}],
	"neutral evil (50%) or lawful evil (50%)": [{alignment: ["N", "E"], chance: 50}, {
		alignment: ["L", "E"],
		chance: 50
	}]
};

class TagUtil {
	static isNoneOrEmpty (str) {
		if (!str || !str.trim()) return false;
		return !!TagUtil.NONE_EMPTY_REGEX.exec(str);
	}
}
TagUtil.NONE_EMPTY_REGEX = /^(([-\u2014\u2013\u2221])+|none)$/gi;

class TraitsActionsTag {
	static tryRun (m, cbMan) {
		function doTag (prop, outProp) {
			function isTraits () {
				return prop === "trait";
			}

			if (m[prop]) {
				m[prop].forEach(t => {
					if (!t.name) return;
					t.name = t.name.trim();

					const cleanName = t.name.toLowerCase();
					const mapped = TraitsActionsTag.tags[prop][cleanName];
					if (mapped) {
						m[outProp] = m[outProp] || [];
						if (mapped === true) {
							m[outProp].push(t.name);
						} else {
							m[outProp].push(mapped)
						}
					} else if (isTraits() && cleanName.startsWith("keen ")) {
						m[outProp] = m[outProp] || [];
						m[outProp].push("Keen Senses");
					} else if (isTraits() && cleanName.startsWith("legendary resistance")) {
						m[outProp] = m[outProp] || [];
						m[outProp].push("Legendary Resistances");
					} else if (isTraits() && cleanName.endsWith(" absorption")) {
						m[outProp] = m[outProp] || [];
						m[outProp].push("Damage Absorption");
					} else {
						if (cbMan) {
							cbMan(prop, outProp, cleanName);
						}
					}
				})
			}
		}
		if (m.traitTags) m.traitTags = [];
		if (m.actionTags) m.actionTags = [];

		doTag("trait", "traitTags");
		doTag("action", "actionTags");
		doTag("reaction", "actionTags");

		if (m.traitTags && !m.traitTags.length) delete m.traitTags;
		if (m.actionTags && !m.actionTags.length) delete m.actionTags;
	}
}
TraitsActionsTag.tags = { // true = map directly; string = map to this string
	trait: {
		"turn immunity": true,
		"brute": true,
		"antimagic susceptibility": true,
		"sneak attack": true,
		"sneak attack (1/turn)": "Sneak Attack",
		"reckless": true,
		"web sense": true,
		"flyby": true,
		"pounce": true,
		"water breathing": true,

		"turn resistance": true,
		"turn defiance": "Turn Resistance",
		"turning defiance": "Turn Resistance",
		"turn resistance aura": "Turn Resistance",
		"undead fortitude": true,

		"aggressive": true,
		"illumination": true,
		"rampage": true,
		"rejuvenation": true,
		"web walker": true,
		"incorporeal movement": true,

		"keen hearing and smell": "Keen Senses",
		"keen sight and smell": "Keen Senses",
		"keen hearing and sight": "Keen Senses",
		"keen hearing": "Keen Senses",
		"keen smell": "Keen Senses",
		"keen senses": true,

		"hold breath": true,

		"charge": true,

		"fey ancestry": true,

		"siege monster": true,

		"pack tactics": true,

		"regeneration": true,

		"shapechanger": true,

		"false appearance": true,

		"spider climb": true,

		"sunlight sensitivity": true,
		"sunlight hypersensitivity": "Sunlight Sensitivity",
		"light sensitivity": true,

		"amphibious": true,

		"legendary resistance (1/day)": "Legendary Resistances",
		"legendary resistance (2/day)": "Legendary Resistances",
		"legendary resistance (3/day)": "Legendary Resistances",
		"legendary resistance (5/day)": "Legendary Resistances",

		"magic weapon": "Magic Weapons",
		"magic weapons": true,

		"magic resistance": true,
		"spell immunity": "Magic Resistance",

		"ambush": "Ambusher",
		"ambusher": true,

		"amorphous": true,
		"amorphous form": "Amorphous",

		"death burst": true,
		"death throes": "Death Burst",

		"devil's sight": true,
		"devil sight": "Devil's Sight",

		"immutable form": true
	},
	action: {
		"multiattack": true,
		"frightful presence": true,
		"teleport": true,
		"swallow": true,
		"tentacle": "Tentacles",
		"tentacles": true
	},
	reaction: {
		"parry": true
	},
	legendary: {
		// unused
	}
};

class LanguageTag {
	static tryRun (m, cbAll, cbTracked) {
		if (m.languages) {
			m.languages = m.languages.trim();
			if (TagUtil.isNoneOrEmpty(m.languages)) {
				delete m.languages;
				return;
			} else {
				m.languages = m.languages.replace(/but can(not|'t) speak/ig, "but can't speak")
			}

			m.languages.split(", ").map(it => it.trim()).filter(it => it).forEach(l => {
				if (cbAll) cbAll(l);

				Object.keys(LanguageTag.LANGUAGE_MAP).forEach(k => {
					const v = LanguageTag.LANGUAGE_MAP[k];

					const re = new RegExp(`(^|[^-a-zA-Z])${k}([^-a-zA-Z]|$)`, "g");

					if (re.exec(l)) {
						if ((v === "XX" || v === "X") && (l.includes("knew in life") || l.includes("spoke in life"))) return;
						if (/(one|the) languages? of its creator/i.exec(l)) return;

						if (cbTracked) cbTracked(v);

						m.languageTags = m.languageTags || [];
						if (!m.languageTags.includes(v)) {
							m.languageTags.push(v);
						}
					}
				})
			});
		}
	}
}
LanguageTag.LANGUAGE_MAP = {
	"Abyssal": "AB",
	"Aquan": "AQ",
	"Auran": "AU",
	"Celestial": "CE",
	"Common": "C",
	"can't speak": "CS",
	"Draconic": "DR",
	"Dwarvish": "D",
	"Elvish": "E",
	"Giant": "GI",
	"Gnomish": "G",
	"Goblin": "GO",
	"Halfling": "H",
	"Infernal": "I",
	"Orc": "O",
	"Primordial": "P",
	"Sylvan": "S",
	"Terran": "T",
	"Undercommon": "U",
	"Aarakocra": "OTH",
	"one additional": "X",
	"Blink Dog": "OTH",
	"Bothii": "OTH",
	"Bullywug": "OTH",
	"one other language": "X",
	"plus six more": "X",
	"plus two more languages": "X",
	"up to five other languages": "X",
	"Druidic": "DU",
	"Giant Eagle": "OTH",
	"Giant Elk": "OTH",
	"Giant Owl": "OTH",
	"Gith": "GTH",
	"Grell": "OTH",
	"Grung": "OTH",
	"Homarid": "OTH",
	"Hook Horror": "OTH",
	"Ice Toad": "OTH",
	"Ixitxachitl": "OTH",
	"Kruthik": "OTH",
	"Netherese": "OTH",
	"Olman": "OTH",
	"Otyugh": "OTH",
	"Primal": "OTH",
	"Sahuagin": "OTH",
	"Sphinx": "OTH",
	"Thayan": "OTH",
	"Thri-kreen": "OTH",
	"Tlincalli": "OTH",
	"Troglodyte": "OTH",
	"Umber Hulk": "OTH",
	"Vegepygmy": "OTH",
	"Winter Wolf": "OTH",
	"Worg": "OTH",
	"Yeti": "OTH",
	"Yikaria": "OTH",
	"all": "XX",
	"all but rarely speaks": "XX",
	"any one language": "X",
	"any two languages": "X",
	"any three languages": "X",
	"any four languages": "X",
	"any five languages": "X",
	"any six languages": "X",
	"one language of its creator's choice": "X",
	"two other languages": "X",
	"telepathy": "TP",
	"thieves' cant": "TC",
	"Thieves' cant": "TC",
	"Deep Speech": "DS",
	"Gnoll": "OTH",
	"Ignan": "IG",
	"Modron": "OTH",
	"Slaad": "OTH",
	"all languages": "XX",
	"any language": "X"
};

class SensesTag {
	static tryRun (m, cbAll) {
		if (m.senses) {
			if (TagUtil.isNoneOrEmpty(m.senses)) {
				delete m.senses;
			} else {
				const senseTags = new Set();
				m.senses.toLowerCase().split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX).map(it => it.trim())
					.forEach(s => {
						Object.entries(SensesTag.TAGS).forEach(([k, v]) => {
							if (s.includes(k)) {
								if (v === "D" && /\d\d\d ft/.exec(s)) senseTags.add("SD");
								else senseTags.add(v);
							}
						});

						if (cbAll) cbAll(s);
					});

				if (senseTags.size === 0) delete m.senseTags;
				else m.senseTags = [...senseTags];
			}
		}
	}
}
SensesTag.TAGS = {
	"blindsight": "B",
	"darkvision": "D",
	"tremorsense": "T",
	"truesight": "U"
};

class TextClean {
	static getCleanedJson (str) {
		str = str.replace(TextClean.REPLACEMENT_REGEX, (match) => TextClean.REPLACEMENTS[match]);
		return str.replace(/\s*(\\u2014|\\u2013)\s*/g, "$1");
	}

	static getReplacedQuotesText (str) {
		return str
			.replace(/’/g, "'")
			.replace(/[“”]/g, `"`)
			.replace(/…/g, `...`)
	}
}
TextClean.REPLACEMENTS = {
	"—": "\\u2014",
	"–": "\\u2013",
	"−": "\\u2212",
	"’": "'",
	"“": '\\"',
	"”": '\\"',
	"…": "..."
};
TextClean.REPLACEMENT_REGEX = new RegExp(Object.keys(TextClean.REPLACEMENTS).join("|"), 'g');

if (typeof module !== "undefined") {
	module.exports = {
		AcConvert,
		TagAttack,
		TagHit,
		AlignmentConvert,
		TraitsActionsTag,
		LanguageTag,
		SensesTag,
		TextClean
	};
}
