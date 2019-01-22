"use strict";

// Global variable for Roll20 compatibility
(typeof module !== "undefined" ? global : window).ScaleCreature = {

	_crRangeToVal (cr, ranges) {
		return Object.keys(ranges).find(k => {
			const [a, b] = ranges[k];
			return cr >= a && cr <= b;
		});
	},

	_acCrRanges: {
		"13": [-1, 3],
		"14": [4, 4],
		"15": [5, 7],
		"16": [8, 9],
		"17": [10, 12],
		"18": [13, 16],
		"19": [17, 30]
	},

	_crToAc (cr) {
		return Number(this._crRangeToVal(cr, this._acCrRanges));
	},

	_crHpRanges: {
		"0": [1, 6],
		"0.125": [7, 35],
		"0.25": [36, 49],
		"0.5": [50, 70],
		"1": [71, 85],
		"2": [86, 100],
		"3": [101, 115],
		"4": [116, 130],
		"5": [131, 145],
		"6": [146, 160],
		"7": [161, 175],
		"8": [176, 190],
		"9": [191, 205],
		"10": [206, 220],
		"11": [221, 235],
		"12": [236, 250],
		"13": [251, 265],
		"14": [266, 280],
		"15": [281, 295],
		"16": [296, 310],
		"17": [311, 325],
		"18": [326, 340],
		"19": [341, 355],
		"20": [356, 400],
		"21": [401, 445],
		"22": [446, 490],
		"23": [491, 535],
		"24": [536, 580],
		"25": [581, 625],
		"26": [626, 670],
		"27": [671, 715],
		"28": [716, 760],
		"29": [761, 805],
		"30": [806, 850]
	},

	// calculated as the mean modifier for each CR,
	// -/+ the mean absolute deviation,
	// rounded to the nearest integer
	_crToEstimatedConModRange: {
		"0": [-1, 2],
		"0.125": [-1, 1],
		"0.25": [0, 2],
		"0.5": [0, 2],
		"1": [0, 2],
		"2": [0, 3],
		"3": [1, 3],
		"4": [1, 4],
		"5": [2, 4],
		"6": [2, 5],
		"7": [1, 5],
		"8": [1, 5],
		"9": [2, 5],
		"10": [2, 5],
		"11": [2, 6],
		"12": [1, 5],
		"13": [3, 6],
		"14": [3, 6],
		"15": [3, 6],
		"16": [4, 7],
		"17": [3, 7],
		"18": [1, 7],
		"19": [4, 6],
		"20": [5, 9],
		"21": [3, 8],
		"22": [4, 9],
		"23": [5, 9],
		"24": [5, 9],
		"25": [7, 9],
		"26": [7, 9],
		// no creatures for these CRs; use 26
		"27": [7, 9],
		"28": [7, 9],
		"29": [7, 9],
		// end
		"30": [10, 10]
	},

	_atkCrRanges: {
		"3": [-1, 2],
		"4": [3, 3],
		"5": [4, 4],
		"6": [5, 7],
		"7": [8, 10],
		"8": [11, 15],
		"9": [16, 16],
		"10": [17, 20],
		"11": [21, 23],
		"12": [24, 26],
		"13": [27, 29],
		"14": [30, 30]
	},

	_crToAtk (cr) {
		return this._crRangeToVal(cr, this._atkCrRanges);
	},

	_crDprRanges: {
		"0": [0, 1],
		"0.125": [2, 3],
		"0.25": [4, 5],
		"0.5": [6, 8],
		"1": [9, 14],
		"2": [15, 20],
		"3": [21, 26],
		"4": [27, 32],
		"5": [33, 38],
		"6": [39, 44],
		"7": [45, 50],
		"8": [51, 56],
		"9": [57, 62],
		"10": [63, 68],
		"11": [69, 74],
		"12": [75, 80],
		"13": [81, 86],
		"14": [87, 92],
		"15": [93, 98],
		"16": [99, 104],
		"17": [105, 110],
		"18": [111, 116],
		"19": [117, 122],
		"20": [123, 140],
		"21": [141, 158],
		"22": [159, 176],
		"23": [177, 194],
		"24": [195, 212],
		"25": [213, 230],
		"26": [231, 248],
		"27": [249, 266],
		"28": [267, 284],
		"29": [285, 302],
		"30": [303, 320]
	},

	_crToEstimatedDamageMod: {
		"0": [-1, 2],
		"0.125": [0, 2],
		"0.25": [0, 3],
		"0.5": [0, 3],
		"1": [0, 3],
		"2": [1, 4],
		"3": [1, 4],
		"4": [2, 4],
		"5": [2, 5],
		"6": [2, 5],
		"7": [2, 5],
		"8": [2, 5],
		"9": [2, 6],
		"10": [3, 6],
		"11": [3, 7],
		"12": [2, 6],
		"13": [3, 7],
		"14": [4, 7],
		"15": [3, 7],
		"16": [4, 8],
		"17": [4, 8],
		"18": [3, 7],
		"19": [5, 8],
		"20": [6, 9],
		"21": [5, 9],
		"22": [6, 10],
		"23": [6, 10],
		"24": [6, 11],
		"25": [8, 11],
		"26": [7, 9],
		// no creatures for these CRs; use 26
		"27": [7, 9],
		"28": [7, 9],
		"29": [7, 9],
		// end
		"30": [9, 11]
	},

	_dcRanges: {
		"13": [-1, 3],
		"14": [4, 4],
		"15": [5, 7],
		"16": [8, 10],
		"17": [11, 12],
		"18": [13, 16],
		"19": [17, 20],
		"20": [21, 23],
		"21": [24, 26],
		"22": [27, 29],
		"23": [30, 30]
	},

	_crToDc (cr) {
		return this._crRangeToVal(cr, this._dcRanges);
	},

	_casterLevelAndClassCantrips: {
		bard: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
		cleric: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
		druid: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
		sorcerer: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
		warlock: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
		wizard: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
	},

	_casterLevelAndClassToCantrips (level, clazz) {
		clazz = (clazz || "cleric").toLowerCase(); // Cleric/Wizard have middle-ground scaling
		return this._casterLevelAndClassCantrips[clazz][level];
	},

	// cantrips that should be preserved when lowering the number of cantrips known, to ensure caster effectiveness
	_protectedCantrips: ["acid splash", "chill touch", "eldritch blast", "fire bolt", "poison spray", "produce flame", "ray of frost", "sacred flame", "shocking grasp", "thorn whip", "vicious mockery"],

	// analysis of official data + some manual smoothing
	_crToCasterLevelAvg: {
		"0": 2,
		"0.125": 2,
		"0.25": 2,
		"0.5": 2,
		"1": 3.5,
		"2": 4.25,
		"3": 5.75,
		"4": 6.75,
		"5": 8,
		"6": 9.75,
		"7": 10.5,
		"8": 10.75,
		"9": 11.5,
		"10": 11.75,
		"11": 12,
		"12": 13,
		"13": 14,
		"14": 15,
		"15": 16,
		"16": 17,
		"17": 18,
		"18": 19
	},

	_crToCasterLevel (cr) {
		if (cr === 0) return 2;
		if (cr >= 19) return 20;
		return this._crToCasterLevelAvg[cr]
	},

	_calcNewAbility (mon, prop, modifier) {
		// at least 1
		return Math.max(1,
			((modifier + 5) * 2) +
			(mon[prop] % 2) // add trailing odd numbers from the original ability, just for fun
		);
	},

	_rng: null,
	_initRng (mon, toCr) {
		let h = CryptUtil.hashCode(toCr);
		h = 31 * h + CryptUtil.hashCode(mon.source);
		h = 31 * h + CryptUtil.hashCode(mon.name);
		this._rng = Math.seed(h);
	},

	/**
	 * @async
	 * @param mon Creature data.
	 * @param toCr target CR, as a number.
	 * @return {Promise<creature>} the scaled creature.
	 */
	scale (mon, toCr) {
		return this._pInitSpellCache().then(() => {
			if (toCr == null || toCr === "Unknown") throw new Error("Attempting to scale unknown CR!");

			this._initRng(mon, toCr);
			mon = JSON.parse(JSON.stringify(mon));

			const crIn = mon.cr.cr || mon.cr;
			const crInNumber = Parser.crToNumber(crIn);
			if (crInNumber === toCr) throw new Error("Attempting to scale creature to own CR!");
			if (crInNumber > 30) throw new Error("Attempting to scale a creature beyond 30 CR!");
			if (crInNumber < 0) throw new Error("Attempting to scale a creature below 0 CR!");

			const pbIn = Parser.crToPb(crIn);
			const pbOut = Parser.crToPb(String(toCr));

			if (pbIn !== pbOut) this._applyPb(mon, pbIn, pbOut);

			this._adjustHp(mon, crInNumber, toCr);
			this._adjustAtkBonusAndSaveDc(mon, crInNumber, toCr, pbIn, pbOut);
			this._adjustDpr(mon, crInNumber, toCr);
			this._adjustSpellcasting(mon, crInNumber, toCr);

			// adjust AC after DPR/etc, as DPR takes priority for adjusting DEX
			this._adjustAc(mon, crInNumber, toCr);

			// TODO update not-yet-scaled abilities

			this._handleUpdateAbilityScoresSkillsSaves(mon, pbOut);

			// cleanup
			[`str`, `dex`, `con`, `int`, `wis`, `cha`].forEach(a => delete mon[`${a}Old`]);

			const crOutStr = Parser.numberToCr(toCr);
			if (mon.cr.cr) mon.cr.cr = crOutStr;
			else mon.cr = crOutStr;

			mon._displayName = `${mon.name} (CR ${crOutStr})`;
			mon._isScaledCr = toCr;
			mon._originalCr = mon._originalCr || crIn;

			return mon;
		});
	},

	_applyPb (mon, pbIn, pbOut) {
		const getNewSkillSaveMod = (oldMod, expert) => {
			const mod = Number(oldMod) - (expert ? 2 * pbIn : pbIn) + (expert ? 2 * pbOut : pbOut);
			return `${mod >= 0 ? "+" : ""}${mod}`;
		};

		if (mon.save) {
			Object.keys(mon.save).forEach(k => {
				const bonus = mon.save[k];

				const fromAbility = Parser.getAbilityModNumber(mon[k]);
				if (fromAbility === Number(bonus)) return; // handle the case where no-PB saves are listed

				const actualPb = bonus - fromAbility;
				const expert = actualPb === pbIn * 2;

				mon.save[k] = getNewSkillSaveMod(bonus, expert);
			})
		}

		if (mon.skill) {
			Object.keys(mon.skill).forEach(k => {
				const bonus = mon.skill[k];

				const fromAbility = Parser.getAbilityModNumber(mon[Parser.skillToAbilityAbv(k)]);
				if (fromAbility === Number(bonus)) return; // handle the case where no-PB skills are listed

				const actualPb = bonus - fromAbility;
				const expert = actualPb === pbIn * 2;

				mon.skill[k] = getNewSkillSaveMod(bonus, expert);

				if (k === "perception" && mon.passive != null) mon.passive = 10 + Number(mon.skill[k]);
			});
		}

		const pbDelta = pbOut - pbIn;
		const handleHit = (str) => {
			return str.replace(/{@hit ([-+]?\d+)}/g, (m0, m1) => {
				const curToHit = Number(m1);
				const outToHit = curToHit + pbDelta;
				return `{@hit ${outToHit}}`;
			})
		};

		const handleDc = (str) => {
			return str.replace(/DC (\d+)/g, (m0, m1) => {
				const curDc = Number(m1);
				const outDc = curDc + pbDelta;
				return `DC ${outDc}`;
			});
		};

		if (mon.spellcasting) {
			mon.spellcasting.forEach(sc => {
				if (sc.headerEntries) {
					const toUpdate = JSON.stringify(sc.headerEntries);
					const out = handleDc(handleHit(toUpdate));
					sc.headerEntries = JSON.parse(out);
				}
			});
		}

		const handleGenericEntries = (prop) => {
			if (mon[prop]) {
				mon[prop].forEach(it => {
					const toUpdate = JSON.stringify(it.entries);
					const out = handleDc(handleHit(toUpdate));
					it.entries = JSON.parse(out);
				});
			}
		};

		handleGenericEntries("trait");
		handleGenericEntries("action");
		handleGenericEntries("reaction");
		handleGenericEntries("legendary");
		handleGenericEntries("variant");
	},

	_acHeavy: {
		"ring mail": 14,
		"chain mail": 16,
		"splint armor": 17,
		"plate armor": 18
	},
	_acMedium: {
		"hide armor": 12,
		"chain shirt": 13,
		"scale mail": 14,
		"breastplate": 14,
		"half plate armor": 15
	},
	_acLight: {
		"padded armor": 11,
		"leather armor": 11,
		"studded leather armor": 12
	},
	_acMageArmor: "@spell mage armor",
	_adjustAc (mon, crIn, crOut) {
		const getEnchanted = (item, baseMod) => {
			const out = [];
			for (let i = 0; i < 3; ++i) {
				out.push({
					tag: `${item} +${i + 1}|dmg`,
					mod: baseMod + i + 1
				});
				out.push({
					tag: `+${i + 1} ${item}|dmg`,
					mod: baseMod + i + 1
				});
			}
			return out;
		};

		const getAllVariants = (obj) => {
			return Object.keys(obj).map(armor => {
				const mod = obj[armor];
				return [{
					tag: `${armor}|phb`,
					mod
				}].concat(getEnchanted(armor, mod));
			}).reduce((a, b) => a.concat(b), []);
		};

		const shields = (() => {
			return [{
				tag: "shield|phb",
				mod: 2
			}].concat(getEnchanted("shield", 2));
		})();

		const heavyArmor = getAllVariants(this._acHeavy);
		const mediumArmor = getAllVariants(this._acMedium);
		const lightArmor = getAllVariants(this._acLight);

		const getAcBaseAndMod = (all, tag) => {
			const tagBaseType = tag.replace(/( \+\d)?\|.*$/, "");
			const tagBase = all[tagBaseType];
			const tagModM = /^.*? (\+\d)\|.*$/.exec(tag);
			const tagMod = tagModM ? Number(tagModM[1]) : 0;
			return [tagBase, tagMod];
		};

		const findTag = (tagSet, str) => {
			return tagSet.find(it => str.includes(`@item ${it}`));
		};

		const replaceTag = (str, oldTag, nuTag) => {
			const out = str.replace(`@item ${oldTag}`, `@item ${nuTag}`);
			const spl = out.split("|");
			if (spl.length > 2) {
				return `${spl.slice(0, 2).join("|")}}`;
			}
			return out;
		};

		const canDropShield = () => {
			return mon._shieldRequired === false && mon._shieldDropped === false;
		};

		const dropShield = (it) => {
			const idxShield = it.from.findIndex(f => shields.find(s => f._.includes(s.tag)));
			if (idxShield === -1) throw new Error("Should never occur!");
			it.from.splice(idxShield, 1);
		};

		// normalises results as "value above 10"
		const getAcVal = (name) => {
			name = name.trim().toLowerCase();
			const toCheck = [this._acHeavy, this._acMedium, this._acLight, {shield: 2}];
			for (const tc of toCheck) {
				const armorKey = Object.keys(tc).find(k => name === k);
				if (armorKey) {
					const acBonus = tc[armorKey];
					if (acBonus > 10) return acBonus - 10;
				}
			}
		};

		const getDexCapVal = name => {
			name = name.trim().toLowerCase();
			const ix = [this._acHeavy, this._acMedium, this._acLight].findIndex(tc => !!Object.keys(tc).find(k => name === k));
			return ix === 0 ? 0 : ix === 1 ? 2 : ix === 3 ? 999 : null;
		};

		// if the DPR calculations didn't already adjust DEX, we can adjust it here
		// otherwise, respect the changes made in the DPR calculations, and find a combination of AC factors to meet the desired number
		mon.ac = mon.ac.map(acItem => {
			let loop = 0;

			const handleAc = () => {
				const getEnchTotal = () => acItem._enchTotal || 0;
				const getBaseGearBonus = () => acItem._gearBonus || 0;
				const getDexCap = () => acItem._dexCap || 999;

				// strip enchantments and total bonuses
				if (typeof acItem !== "number") {
					acItem._enchTotal = acItem._enchTotal || 0; // maintain this between loops, in case we throw away the enchanted gear
					acItem._gearBonus = 0; // recalculate this each time
					acItem._dexCap = 999; // recalculate this each time
				}
				if (acItem.from) {
					acItem.from = acItem.from.map(f => {
						if (f._) f = f._; // if a previous loop modified it

						// normalise to "true name" format
						// e.g. {@item +1 chain mail} -> {@item chain mail +1|dmg|+1 chain mail}
						const pre = /@item (\+\d+)([^+\d}]+)/gi.exec(f);
						if (pre) {
							const [_, bonus, name, rest] = pre.map(it => it.trim());
							const restSpl = (rest || "").split("|");
							const restPart = restSpl.length > 1 ? restSpl.last() : null;
							f = `{@item ${name} ${bonus}|dmg|${restPart || `${bonus} ${name}`}}`;
						}

						const m = /@item ([^+\d]+)(\+\d+)\|([^|}]+)/gi.exec(f); // e.g. {@item chain mail +1|dmg|+1 chain mail}
						if (m) {
							const [_, name, bonus, source] = m;

							const acVal = getAcVal(name);
							if (acVal) acItem._gearBonus += acVal;

							const dexCap = getDexCapVal(name);
							if (dexCap != null) acItem._dexCap = Math.min(acItem._dexCap, dexCap);

							const ench = Number(bonus);
							acItem._enchTotal += ench;
							return {
								_: f,
								name: name.trim(),
								ench: ench,
								source: source
							}
						} else {
							const m = /@item ([^|}]+)(\|[^|}]+)?(\|[^|}]+)?/gi.exec(f);
							if (m) {
								const [_, name, source, display] = m;
								const out = {_: f, name};
								if (source) out.source = source;
								if (display) out.display = display;

								const acVal = getAcVal(name);
								if (acVal) {
									acItem._gearBonus += acVal;
									out._gearBonus = acVal;
								}

								const dexCap = getDexCapVal(name);
								if (dexCap != null) acItem._dexCap = Math.min(acItem._dexCap, dexCap);

								return out;
							} else return {_: f, name: f};
						}
					});
				}
				// for armored creatures, try to calculate the expected AC, and use this as a starting point for scaling
				const expectedBaseScore = mon.dexOld != null ? (getBaseGearBonus() + Math.min(Parser.getAbilityModNumber(mon.dexOld), getDexCap()) + 10) : null;

				let canAdjustDex = mon.dexOld == null;
				const dexGain = Parser.getAbilityModNumber(mon.dex) - Parser.getAbilityModNumber((mon.dexOld || mon.dex));

				const curr = acItem.ac || acItem;
				// don't include enchantments in AC-CR calculations
				const currWithoutEnchants = curr - (loop === 0 ? getEnchTotal() : 0); // only take it off on the first loop, as it gets saved

				// ignore any other misc modifications from abilities, enchanted items, etc
				if (typeof acItem !== "number") {
					acItem._miscOffset = acItem._miscOffset || (expectedBaseScore != null ? currWithoutEnchants - expectedBaseScore : null); // maintain this between loops, keep the original "pure" version
				}

				const idealAcIn = this._crToAc(crIn);
				const idealAcOut = this._crToAc(crOut);
				const effectiveCurrent = expectedBaseScore == null ? currWithoutEnchants : expectedBaseScore;
				const target = this._getScaledToRatio(effectiveCurrent, idealAcIn, idealAcOut);
				let targetNoShield = target;
				const acGain = target - effectiveCurrent;

				const dexMismatch = acGain - dexGain;

				const adjustDex = () => {
					mon.dexOld = mon.dex;
					mon.dex = this._calcNewAbility(mon, "dex", Parser.getAbilityModNumber(mon.dex) + dexMismatch);
					canAdjustDex = false;
					return true;
				};

				const handleNoArmor = () => {
					if (dexMismatch > 0) {
						if (canAdjustDex) {
							adjustDex();
							return target;
						} else {
							return { // fill the gap with natural armor
								ac: target,
								from: ["natural armor"]
							}
						}
					} else if (dexMismatch < 0 && canAdjustDex) { // increase/reduce DEX to move the AC up/down
						adjustDex();
						return target;
					} else return target; // AC adjustment perfectly matches DEX adjustment; or there's nothing we can do because of a previous DEX adjustment
				};

				// "FROM" ADJUSTERS ========================================================================================

				const handleMageArmor = () => {
					// if there's mage armor, try adjusting dex
					if (acItem.condition && acItem.condition.toLowerCase().includes(this._acMageArmor)) {
						if (canAdjustDex) {
							acItem.ac = target;
							return adjustDex();
						} else {
							acItem.ac = 13 + Parser.getAbilityModNumber(mon.dex);
							return true; // mage armor means there was no other armor, so stop here
						}
					}
					return false;
				};

				const handleShield = () => {
					// if there's a shield, try dropping it
					const DUAL_SHIELD_AC = 3; // dual-wield shields is 3 AC, according to VGM's Fire Giant Dreadnought

					if (acItem.from) {
						const fromShields = acItem.from.filter(f => shields.find(s => f._.includes(`@item ${s.tag}`)));
						if (fromShields.length) {
							if (fromShields.length > 1) throw new Error("AC contained multiple shields!"); // should be impossible

							// check if shields are an important part of this creature
							// if they have abilities/etc which refer to the shield, don't remove the shield
							const shieldRequired = mon._shieldRequired != null ? mon._shieldRequired : (() => {
								const checkShields = (prop) => {
									if (!mon[prop]) return false;
									for (const it of mon[prop]) {
										if (it.name && it.name.toLowerCase().includes("shield")) return true;
										if (it.entries && JSON.stringify(it.entries).match(/shield/i)) return true;
									}
								};
								return mon._shieldRequired = checkShields("trait") ||
									checkShields("action") ||
									checkShields("reaction") ||
									checkShields("legendary");
							})();
							mon._shieldDropped = false;

							const fromShield = fromShields[0]._;
							const idx = acItem.from.findIndex(it => it === fromShield);

							if (fromShield.endsWith("|shields}")) {
								targetNoShield -= DUAL_SHIELD_AC;

								if (!shieldRequired && (acGain <= -DUAL_SHIELD_AC)) {
									acItem.from.splice(idx, 1);
									acItem.ac -= DUAL_SHIELD_AC;
									mon._shieldDropped = true;
									if (acItem.ac === target) return true;
								}
							} else {
								const shieldVal = shields.find(s => fromShield.includes(s.tag));
								targetNoShield -= shieldVal.mod;

								if (!shieldRequired && (acGain <= -shieldVal.mod)) {
									acItem.from.splice(idx, 1);
									acItem.ac -= shieldVal.mod;
									mon._shieldDropped = true;
									if (acItem.ac === target) return true;
								}
							}
						}
					}
					return false;
				};

				// FIXME this can result in armor with strength requirements greater than the user can manage
				const handleHeavyArmor = () => {
					// if there's heavy armor, try adjusting it
					const PL3_PLATE = 21;

					const heavyTags = heavyArmor.map(it => it.tag);

					const isHeavy = (ac) => {
						return ac >= 14 && ac <= PL3_PLATE; // ring mail (14) to +3 Plate (21)
					};

					const isBeyondHeavy = (ac) => {
						return ac > PL3_PLATE; // more than +3 plate
					};

					const getHeavy = (ac) => {
						const nonEnch = Object.keys(this._acHeavy).find(armor => this._acHeavy[armor] === ac);
						if (nonEnch) return `${nonEnch}|phb`;
						switch (ac) {
							case 19:
								return [`plate armor +1|dmg`, `splint armor +2|dmg`][RollerUtil.roll(1, this._rng)];
							case 20:
								return `plate armor +2|dmg`;
							case PL3_PLATE:
								return `plate armor +3|dmg`
						}
					};

					if (acItem.from) {
						for (let i = 0; i < acItem.from.length; ++i) {
							const heavyTag = findTag(heavyTags, acItem.from[i]._);
							if (heavyTag) {
								if (isHeavy(targetNoShield)) {
									const bumpOne = targetNoShield === 15; // there's no heavy armor with 15 AC
									if (bumpOne) targetNoShield++;
									acItem.from[i]._ = replaceTag(acItem.from[i]._, heavyTag, getHeavy(targetNoShield));
									acItem.ac = target + (bumpOne ? 1 : 0);
									return true;
								} else if (canDropShield() && isHeavy(target)) {
									const targetWithBump = target + (target === 15 ? 1 : 0); // there's no heavy armor with 15 AC
									acItem.from[i]._ = replaceTag(acItem.from[i]._, heavyTag, getHeavy(targetWithBump));
									acItem.ac = targetWithBump;
									dropShield(acItem);
									return true;
								} else if (isBeyondHeavy(targetNoShield)) { // cap it at +3 plate and call it a day
									const max = PL3_PLATE;
									acItem.from[i]._ = replaceTag(acItem.from[i]._, heavyTag, getHeavy(max));
									acItem.ac = max;
									return true;
								} else { // drop to medium
									const [tagBase, tagMod] = getAcBaseAndMod(this._acLight, heavyTag);
									const tagAc = tagBase + tagMod;
									acItem.from[i]._ = replaceTag(acItem.from[i]._, heavyTag, `half plate armor|phb`);
									acItem.ac = (acItem.ac - tagAc) + 15 + Math.min(2, Parser.getAbilityModNumber(mon.dex));
									return false;
								}
							}
						}
					}
					return false;
				};

				const handleMediumArmor = () => {
					// if there's medium armor, try adjusting dex, then try adjusting it
					const mediumTags = mediumArmor.map(it => it.tag);

					const isMedium = (ac, asPos) => {
						const min = 12 + (canAdjustDex ? -5 : Parser.getAbilityModNumber(mon.dex)); // hide; 12
						const max = 18 + (canAdjustDex ? 2 : Math.min(2, Parser.getAbilityModNumber(mon.dex))); // half-plate +3; 18
						if (asPos) return ac < min ? -1 : ac > max ? 1 : 0;
						return ac >= min && ac <= max;
					};

					const getMedium = (ac, curArmor) => {
						const getByBase = (base) => {
							switch (base) {
								case 14:
									return [`scale mail|phb`, `breastplate|phb`][RollerUtil.roll(1, this._rng)];
								case 16:
									return [`half plate armor +1|dmg`, `breastplate +2|dmg`, `scale mail +2|dmg`][RollerUtil.roll(2, this._rng)];
								case 17:
									return `half plate armor +2|dmg`;
								case 18:
									return `half plate armor +3|dmg`;
								default: {
									const nonEnch = Object.keys(this._acMedium).find(it => this._acMedium[it] === base);
									return `${nonEnch}|phb`;
								}
							}
						};

						if (canAdjustDex) {
							let fromArmor = curArmor.ac;
							let maxFromArmor = fromArmor + 2;
							let minFromArmor = fromArmor - 5;

							const withinDexRange = () => {
								return ac >= minFromArmor && ac <= maxFromArmor;
							};

							const getTotalAc = () => {
								return fromArmor + Math.min(2, Parser.getAbilityModNumber(mon.dex));
							};

							let loops = 0;
							while (1) {
								if (loops > 1000) throw new Error(`Failed to find valid light armor!`);

								if (withinDexRange()) {
									canAdjustDex = false;
									if (mon.dexOld == null) mon.dexOld = mon.dex;

									if (ac > getTotalAc()) mon.dex += 2;
									else mon.dex -= 2;
								} else {
									if (ac < minFromArmor) fromArmor -= 1;
									else fromArmor += 1;
									if (fromArmor < 12 || fromArmor > 18) throw Error("Should never occur!"); // sanity check
									maxFromArmor = fromArmor + 2;
									minFromArmor = fromArmor - 5;
								}

								if (getTotalAc() === ac) break;
								loops++;
							}

							return getByBase(fromArmor);
						} else {
							const dexOffset = Math.min(Parser.getAbilityModNumber(mon.dex), 2);
							return getByBase(ac - dexOffset);
						}
					};

					if (acItem.from) {
						for (let i = 0; i < acItem.from.length; ++i) {
							const mediumTag = findTag(mediumTags, acItem.from[i]._);
							if (mediumTag) {
								const [tagBase, tagMod] = getAcBaseAndMod(this._acMedium, mediumTag);
								const tagAc = tagBase + tagMod;
								if (isMedium(targetNoShield)) {
									acItem.from[i]._ = replaceTag(acItem.from[i]._, mediumTag, getMedium(targetNoShield, {tag: mediumTag, ac: tagAc}));
									acItem.ac = target;
									return true;
								} else if (canDropShield() && isMedium(target)) {
									acItem.from[i]._ = replaceTag(acItem.from[i]._, mediumTag, getMedium(target, {tag: mediumTag, ac: tagAc}));
									acItem.ac = target;
									dropShield(acItem);
									return true;
								} else if (canAdjustDex && isMedium(targetNoShield, true) === -1) { // drop to light
									acItem.from[i]._ = replaceTag(acItem.from[i]._, mediumTag, `studded leather armor|phb`);
									acItem.ac = (acItem.ac - tagAc - Math.min(2, Parser.getAbilityModNumber(mon.dex))) + 12 + Parser.getAbilityModNumber(mon.dex);
									return false;
								} else {
									// if we need more AC, switch to heavy, and restart the conversion
									acItem.from[i]._ = replaceTag(acItem.from[i]._, mediumTag, `ring mail|phb`);
									acItem.ac = (acItem.ac - tagAc - Math.min(2, Parser.getAbilityModNumber(mon.dex))) + 14;
									return -1;
								}
							}
						}
					}
					return false;
				};

				const handleLightArmor = () => {
					// if there's light armor, try adjusting dex, then try adjusting it
					const lightTags = lightArmor.map(it => it.tag);

					const isLight = (ac, asPos) => {
						const min = 11 + (canAdjustDex ? -5 : Parser.getAbilityModNumber(mon.dex)); // padded/leather; 11
						const max = 15 + (canAdjustDex ? 100 : Parser.getAbilityModNumber(mon.dex)); // studded leather +3; 15
						if (asPos) return ac < min ? -1 : ac > max ? 1 : 0;
						return ac >= min && ac <= max;
					};

					const getLight = (ac, curArmor) => {
						const getByBase = (base) => {
							switch (base) {
								case 11:
									return [`padded armor|phb`, `leather armor|phb`][RollerUtil.roll(1, this._rng)];
								case 12:
									return `studded leather armor|phb`;
								case 13:
									return [`padded armor +1|dmg`, `leather armor +1|dmg`][RollerUtil.roll(1, this._rng)];
								case 14:
									return [`padded armor +2|dmg`, `leather armor +2|dmg`, `studded leather armor +1|dmg`][RollerUtil.roll(2, this._rng)];
								case 15:
									return `studded leather armor +2|dmg`;
							}
						};

						if (canAdjustDex) {
							let fromArmor = curArmor.ac;
							let minFromArmor = fromArmor - 5;

							const withinDexRange = () => {
								return ac >= minFromArmor;
							};

							const getTotalAc = () => {
								return fromArmor + Parser.getAbilityModNumber(mon.dex);
							};

							let loops = 0;
							while (1) {
								if (loops > 1000) throw new Error(`Failed to find valid light armor!`);

								if (withinDexRange()) {
									canAdjustDex = false;
									if (mon.dexOld == null) mon.dexOld = mon.dex;

									if (ac > getTotalAc()) mon.dex += 2;
									else mon.dex -= 2;
								} else {
									if (ac < minFromArmor) fromArmor -= 1;
									else fromArmor += 1;
									if (fromArmor < 11 || fromArmor > 15) throw Error("Should never occur!"); // sanity check
									minFromArmor = fromArmor - 5;
								}

								if (getTotalAc() === ac) break;
								loops++;
							}

							return getByBase(fromArmor);
						} else {
							const dexOffset = Parser.getAbilityModNumber(mon.dex);
							return getByBase(ac - dexOffset);
						}
					};

					if (acItem.from) {
						for (let i = 0; i < acItem.from.length; ++i) {
							const lightTag = findTag(lightTags, acItem.from[i]._);
							if (lightTag) {
								const [tagBase, tagMod] = getAcBaseAndMod(this._acLight, lightTag);
								const tagAc = tagBase + tagMod;
								if (isLight(targetNoShield)) {
									acItem.from[i]._ = replaceTag(acItem.from[i]._, lightTag, getLight(targetNoShield, {tag: lightTag, ac: tagAc}));
									acItem.ac = target;
									return true;
								} else if (canDropShield() && isLight(target)) {
									acItem.from[i]._ = replaceTag(acItem.from[i]._, lightTag, getLight(target, {tag: lightTag, ac: tagAc}));
									acItem.ac = target;
									dropShield(acItem);
									return true;
								} else if (!canAdjustDex && isLight(targetNoShield, true) === -1) { // drop armor
									if (acItem.from.length === 1) { // revert to pure numerical
										acItem._droppedArmor = true;
										return -1;
									} else { // revert to base 10
										acItem.from.splice(i, 1);
										acItem.ac = (acItem.ac - tagAc) + 10;
										return -1;
									}
								} else {
									// if we need more, switch to medium, and restart the conversion
									acItem.from[i]._ = replaceTag(acItem.from[i]._, lightTag, `chain shirt|phb`);
									acItem.ac = (acItem.ac - tagAc - Parser.getAbilityModNumber(mon.dex)) + 13 + Math.min(2, Parser.getAbilityModNumber(mon.dex));
									return -1;
								}
							}
						}
					}
					return false;
				};

				const handleNaturalArmor = () => {
					// if there's natural armor, try adjusting dex, then try adjusting it

					if (acItem.from && acItem.from.map(it => it._).includes("natural armor")) {
						if (canAdjustDex) {
							acItem.ac = target;
							return adjustDex();
						} else {
							acItem.ac = target; // natural armor of all modifiers is still just "natural armor," so this works
							return true;
						}
					}
					return false;
				};

				if (acItem.ac && !acItem._droppedArmor) {
					const toRun = [
						handleMageArmor,
						handleShield,
						handleHeavyArmor,
						handleMediumArmor,
						handleLightArmor,
						handleNaturalArmor
					];
					let lastVal = 0;
					for (let i = 0; i < toRun.length; ++i) {
						lastVal = toRun[i]();
						if (lastVal === -1) return null;
						else if (lastVal) break;
					}

					// if there was no reasonable way to adjust the AC, forcibly set it here as a fallback
					if (!lastVal) acItem.ac = target;
					return acItem;
				} else {
					return handleNoArmor();
				}
			};

			let out = null;
			while (out == null) {
				if (loop > 100) throw new Error(`Failed to calculate new AC! Input was:\n${JSON.stringify(acItem, null, "\t")}`);
				out = handleAc();
				loop++;
			}

			// finalise "from"
			let handledEnchBonus = !acItem._enchTotal;
			if (acItem.from) {
				if (acItem._enchTotal) {
					acItem.from.forEach(f => {
						if (handledEnchBonus) return;

						if (f.ench && f.ench < 3) {
							const enchToGive = Math.min(3 - f.ench, acItem._enchTotal);
							acItem._enchTotal -= enchToGive;
							f.ench += enchToGive;
							acItem.ac += enchToGive;
							f._ = `{@item ${f.name} +${f.ench}|dmg|+${f.ench} ${f.name}}`;
							if (acItem._enchTotal <= 0) handledEnchBonus = true;
						} else if (out._gearBonus) {
							const enchToGive = Math.min(3, acItem._enchTotal);
							acItem._enchTotal -= enchToGive;
							f._ = `{@item ${f.name} +${enchToGive}|dmg|+${enchToGive} ${f.name}}`;
							if (acItem._enchTotal <= 0) handledEnchBonus = true;
						}
					});
				}
				acItem.from = acItem.from.map(it => it._);
			}

			// if there's an unhandled enchantment, give the creature enchanted leather. This implies an extra point of AC, but this is an acceptable workaround
			if (!handledEnchBonus) {
				const enchToGive = Math.min(3, acItem._enchTotal);
				acItem._enchTotal -= enchToGive;
				acItem.ac += enchToGive + 1;
				(acItem.from = acItem.from || []).unshift(`{@item leather armor +${enchToGive}|dmg|+${enchToGive} leather armor}`);

				if (acItem._enchTotal > 0) acItem.ac += acItem._enchTotal; // as a fallback, add any remaining enchantment AC to the total
			}

			if (acItem._miscOffset != null) acItem.ac += acItem._miscOffset;

			// cleanup
			["_enchTotal", "_gearBonus", "_dexCap", "_miscOffset"].forEach(it => delete acItem[it]);

			return out;
		});
	},

	/**
	 * X in L-H
	 * --L---X------H--
	 *   \   \     |
	 * 	  \   \    |
	 *   --M---Y---I--
	 * to Y; relative position in M-I
	 * so (where D is "delta;" fractional position in L-H range)
	 * X = D(H - L) + L
	 *   => D = X - L / H - L
	 *
	 * @param x position within L-H space
	 * @param lh L-H is the original space (1 dimension; a range)
	 * @param mi M-I is the target space (1 dimension; a range)
	 * @returns {number} the relative position in M-I space
	 */
	_interpAndTranslateToSpace (x, lh, mi) {
		let [l, h] = lh;
		let [m, i] = mi;
		// adjust to avoid infinite delta
		const OFFSET = 0.1;
		l -= OFFSET; h += OFFSET;
		m -= OFFSET; i += OFFSET;
		const delta = (x - l) / (h - l);
		return Math.round((delta * (i - m)) + m); // round to nearest whole number
	},

	/**
	 * Calculate outVal based on a ratio equality.
	 *
	 *   inVal       outVal
	 * --------- = ----------
	 *  inTotal     outTotal
	 *
	 * @param inVal
	 * @param inTotal
	 * @param outTotal
	 * @returns {number} outVal
	 */
	_getScaledToRatio (inVal, inTotal, outTotal) {
		return Math.round(inVal * (outTotal / inTotal));
	},

	_adjustHp (mon, crIn, crOut) {
		if (mon.hp.special) return; // could be anything; best to just leave it

		const hpInAvg = Math.mean(...this._crHpRanges[crIn]);
		const hpOutRange = this._crHpRanges[crOut];
		const hpOutAvg = Math.mean(...hpOutRange);
		const targetHpOut = this._getScaledToRatio(mon.hp.average, hpInAvg, hpOutAvg);
		const targetHpDeviation = (hpOutRange[1] - hpOutRange[0]) / 2;
		const targetHpRange = [Math.floor(targetHpOut - targetHpDeviation), Math.ceil(targetHpOut + targetHpDeviation)];

		const origFormula = mon.hp.formula.replace(/\s*/g, "");
		mon.hp.average = Math.floor(Math.max(1, targetHpOut));

		const fSplit = origFormula.split(/([-+])/);
		const mDice = /(\d+)d(\d+)/i.exec(fSplit[0]);
		const hdFaces = Number(mDice[2]);
		const hdAvg = (hdFaces + 1) / 2;
		const numHd = Number(mDice[1]);
		const modTotal = fSplit.length === 3 ? Number(`${fSplit[1]}${fSplit[2]}`) : 0;
		const modPerHd = Math.floor(modTotal / numHd);

		const getAdjustedConMod = () => {
			const outRange = this._crToEstimatedConModRange[crOut];
			if (outRange[0] === outRange[1]) return outRange[0]; // handle CR 30, which is always 10
			return this._interpAndTranslateToSpace(modPerHd, this._crToEstimatedConModRange[crIn], outRange);
		};

		let numHdOut = numHd;
		let hpModOut = getAdjustedConMod();

		const getAvg = (numHd = numHdOut, hpMod = hpModOut) => {
			return (numHd * hdAvg) + (numHd * hpMod);
		};

		const inRange = (num) => {
			return num >= targetHpRange[0] && num <= targetHpRange[1];
		};

		let loops = 0;
		while (1) {
			if (inRange(getAvg(numHdOut))) break;
			if (loops > 100) throw new Error(`Failed to find new HP! Current formula is: ${numHd}d${hpModOut}`);

			const tryAdjustNumDice = () => {
				let numDiceTemp = numHdOut;
				let tempTotalHp = getAvg();
				let found = false;

				if (tempTotalHp > targetHpRange[1]) { // too high
					while (numDiceTemp > 1) {
						numDiceTemp -= 1;
						tempTotalHp -= hdAvg;

						if (inRange(getAvg(numDiceTemp))) {
							found = true;
							break;
						}
					}
				} else { // too low
					while (tempTotalHp <= targetHpRange[1]) {
						numDiceTemp += 1;
						tempTotalHp += hdAvg;

						if (inRange(getAvg(numDiceTemp))) {
							found = true;
							break;
						}
					}
				}

				if (found) {
					numHdOut = numDiceTemp;
					return true;
				}
				return false;
			};

			const tryAdjustMod = () => {
				// alternating sequence, going further from origin each time.
				// E.g. original modOut == 0 => 1, -1, 2, -2, 3, -3, ... modOut+n, modOut-n
				hpModOut += (1 - ((loops % 2) * 2)) * (loops + 1);
			};

			// order of preference for scaling:
			// - adjusting number of dice
			// - adjusting modifier
			if (tryAdjustNumDice()) break;
			tryAdjustMod();

			loops++;
		}

		mon.hp.average = Math.floor(getAvg(numHdOut));
		const outModTotal = numHdOut * hpModOut;
		mon.hp.formula = `${numHdOut}d${hdFaces}${outModTotal === 0 ? "" : ` ${outModTotal >= 0 ? "+" : ""} ${outModTotal}`}`;

		if (hpModOut !== modPerHd) {
			const conOut = this._calcNewAbility(mon, "con", hpModOut);
			if (conOut !== mon.con && mon.save && mon.save.con) {
				const conDelta = Parser.getAbilityModifier(conOut) - Parser.getAbilityModifier(mon.con);
				const conSaveOut = Number(mon.save.con) + conDelta;
				mon.save.con = `${conSaveOut >= 0 ? "+" : ""}${conSaveOut}`;
			}
			mon.con = conOut;
		}
	},

	_getEnchantmentBonus (str) {
		const m = /\+(\d+)/.exec(str);
		if (m) return Number(m[1]);
		else return 0;
	},

	_wepThrownFinesse: ["dagger", "dart"],
	_wepFinesse: ["dagger", "dart", "rapier", "scimitar", "shortsword", "whip"],
	_wepThrown: ["handaxe", "javelin", "light hammer", "spear", "trident", "net"],
	_getModBeingScaled (strMod, dexMod, modFromAbil, name, content) {
		const guessMod = () => {
			name = name.toLowerCase();
			content = content.replace(/{@atk ([A-Za-z,]+)}/gi, (_, p1) => EntryRenderer.attackTagToFull(p1)).toLowerCase();

			const isMeleeOrRangedWep = content.includes("melee or ranged weapon attack:");
			if (isMeleeOrRangedWep) {
				const wtf = this._wepThrownFinesse.find(it => content.includes(it));
				if (wtf) return "dex";

				const wf = this._wepFinesse.find(it => content.includes(it));
				if (wf) return "dex";

				const wt = this._wepThrown.find(it => content.includes(it));
				if (wt) return "str";

				return null;
			}

			const isMeleeWep = content.includes("melee weapon attack:");
			if (isMeleeWep) {
				const wf = this._wepFinesse.find(it => content.includes(it));
				if (wf) return "dex";
				return "str";
			}

			const isRangedWep = content.includes("ranged weapon attack:");
			if (isRangedWep) {
				const wt = this._wepThrown.find(it => content.includes(it));
				if (wt) return "str"; // this should realistically only catch Nets
				return "dex";
			}
		};

		if (!modFromAbil || (strMod === dexMod && strMod === modFromAbil)) return guessMod();
		return strMod === modFromAbil ? "str" : dexMod === modFromAbil ? "dex" : null;
	},

	_adjustAtkBonusAndSaveDc (mon, crIn, crOut, pbIn, pbOut) {
		const idealHitIn = Number(this._crToAtk(crIn));
		const idealHitOut = Number(this._crToAtk(crOut));

		const strMod = Parser.getAbilityModNumber(mon.str);
		const dexMod = Parser.getAbilityModNumber(mon.dex);

		// prefer scaling to-hits by a flat difference, rather than using a ratio
		// this keeps ability scores more sane, and better maintains bounded accuracy
		const getAdjustedHitFlat = (toHitIn) => toHitIn + (idealHitOut - idealHitIn);

		const handleHit = (str, name) => {
			const offsetEnchant = name != null ? this._getEnchantmentBonus(name) : 0;

			return str.replace(/{@hit ([-+]?\d+)}/g, (m0, m1) => {
				const curToHit = Number(m1);

				const modFromAbil = curToHit - (offsetEnchant + pbOut);
				const modBeingScaled = name != null ? this._getModBeingScaled(strMod, dexMod, modFromAbil, name, str) : null; // ignore spell attacks here, as they'll be scaled using DCs later

				const origToHitNoEnch = curToHit + (pbIn - pbOut) - offsetEnchant;
				const targetToHitNoEnch = getAdjustedHitFlat(origToHitNoEnch);

				if (origToHitNoEnch === targetToHitNoEnch) return m0; // this includes updated PB, so just return it

				if (modBeingScaled != null) {
					const modDiff = (targetToHitNoEnch - pbOut) - (origToHitNoEnch - pbIn);
					const modFromAbilOut = modFromAbil + modDiff;
					const tempKey = `_${modBeingScaled}TmpMods`;
					mon[tempKey] = mon[tempKey] || [];
					mon[tempKey].push(modFromAbilOut);
				}
				return `{@hit ${targetToHitNoEnch + offsetEnchant}}`;
			})
		};

		const idealDcIn = this._crToDc(crIn);
		const idealDcOut = this._crToDc(crOut);

		const getAdjustedDcFlat = (dcIn) => dcIn + (idealDcOut - idealDcIn);

		const handleDc = (str, castingAbility) => {
			return str.replace(/DC (\d+)/g, (m0, m1) => {
				const curDc = Number(m1);
				const origDc = curDc + pbIn - pbOut;
				const outDc = Math.max(10, getAdjustedDcFlat(origDc));
				if (curDc === outDc) return m0;

				if (["int", "wis", "cha"].includes(castingAbility)) {
					const oldKey = `${castingAbility}Old`;
					if (mon[oldKey] == null) {
						mon[oldKey] = mon[castingAbility];
						const dcDiff = outDc - origDc;
						const curMod = Parser.getAbilityModNumber(mon[castingAbility]);
						mon[castingAbility] = this._calcNewAbility(mon, castingAbility, curMod + dcDiff);
					}
				}
				return `DC ${outDc}`;
			});
		};

		if (mon.spellcasting) {
			mon.spellcasting.forEach(sc => {
				if (sc.headerEntries) {
					const toUpdate = JSON.stringify(sc.headerEntries);
					const out = handleHit(handleDc(toUpdate, sc.ability));
					sc.headerEntries = JSON.parse(out);
				}
			});
		}

		const handleGenericEntries = (prop) => {
			if (mon[prop]) {
				mon[prop].forEach(it => {
					const toUpdate = JSON.stringify(it.entries);
					const out = handleDc(handleHit(toUpdate, it.name));
					it.entries = JSON.parse(out);
				});
			}
		};

		handleGenericEntries("trait");
		handleGenericEntries("action");
		handleGenericEntries("reaction");
		handleGenericEntries("legendary");
		handleGenericEntries("variant");

		const checkSetTempMod = (abil) => {
			const k = `_${abil}TmpMods`;
			if (mon[k]) {
				const nxtK = `_${abil}TmpMod`;
				if (mon[k].length === 0) throw new Error("Should never occur!");
				else if (mon[k].length > 1) {
					const base = mon[k][0];
					const notEqualBase = mon[k].find(it => it !== base);
					if (notEqualBase == null) {
						mon[nxtK] = mon[k][0];
					}
				} else {
					mon[nxtK] = mon[k][0];
				}
				delete mon[k];
			}
		};
		checkSetTempMod("str");
		checkSetTempMod("dex");
	},

	_DAMAGE_REGEX_DICE: new RegExp(/(\d+)( \((?:{@dice |{@damage ))([-+0-9d ]*)(}\) [a-z]+( or [a-z]+)? damage)/, "ig"),
	_DAMAGE_REGEX_FLAT: new RegExp(/(Hit: |{@h})([0-9]*)( [a-z]+( or [a-z]+)? damage)/, "ig"),
	_adjustDpr (mon, crIn, crOut) {
		const idealDprRangeIn = this._crDprRanges[crIn];
		const idealDprRangeOut = this._crDprRanges[crOut];
		const dprTotalIn = Math.mean(...idealDprRangeIn);
		const dprTotalOut = Math.mean(...idealDprRangeOut);

		const getAdjustedDpr = (dprIn) => {
			if (crIn === 0) dprIn = Math.min(dprIn, 0.63); // cap CR 0 DPR to prevent average damage in the thousands
			return this._getScaledToRatio(dprIn, dprTotalIn, dprTotalOut);
		};

		const getAvgDpr = (diceExp) => {
			diceExp = diceExp.replace(/\s*/g, "");
			const asAverages = diceExp.replace(/d(\d+)/gi, (...m) => {
				return ` * ${(Number(m[1]) + 1) / 2}`;
			});
			return MiscUtil.expEval(asAverages);
		};

		const crOutDprVariance = (idealDprRangeOut[1] - idealDprRangeOut[0]) / 2;

		let dprAdjustmentComplete = false;
		let scaledEntries = [];
		while (!dprAdjustmentComplete) {
			scaledEntries = []; // reset any previous processing

			const originalStrMod = Parser.getAbilityModNumber(mon.str);
			const originalDexMod = Parser.getAbilityModNumber(mon.dex);
			const strMod = mon._strTmpMod || originalStrMod;
			const dexMod = mon._dexTmpMod || originalDexMod;

			const handleDpr = (prop) => {
				if (mon[prop]) {
					let allSucceeded = true;

					mon[prop].forEach((it, idxProp) => {
						const toUpdate = JSON.stringify(it.entries);

						// handle flat values first, as we may convert dice values to flats
						let out = toUpdate.replace(this._DAMAGE_REGEX_FLAT, (m0, prefix, flatVal, suffix) => {
							const adjDpr = getAdjustedDpr(flatVal);
							return `${prefix}${adjDpr}${suffix}`;
						});

						// track attribute adjustment requirements (unused except for dbgging)
						const reqAbilAdjust = [];

						// pre-calculate enchanted weapon offsets
						const offsetEnchant = this._getEnchantmentBonus(it.name);

						out = out.replace(this._DAMAGE_REGEX_DICE, (m0, average, prefix, diceExp, suffix) => {
							diceExp = diceExp.replace(/\s+/g, "");
							const avgDpr = getAvgDpr(diceExp);
							const adjustedDpr = getAdjustedDpr(avgDpr);

							const targetDprRange = [ // cap min damage range at 0-1
								Math.max(0, Math.floor(adjustedDpr - crOutDprVariance)),
								Math.ceil(Math.max(1, adjustedDpr + crOutDprVariance))
							];

							const inRange = (num) => {
								return num >= targetDprRange[0] && num <= targetDprRange[1];
							};

							// in official data, there are no dice expressions with more than one type of dice
							const [dice, modifier] = diceExp.split(/[-+]/);
							const [numDice, diceFaces] = dice.split("d").map(it => Number(it));
							const modFromAbil = modifier ? Number(modifier) - offsetEnchant : null;

							// try to figure out which mod we're going to be scaling
							const modBeingScaled = this._getModBeingScaled(originalStrMod, originalDexMod, modFromAbil, it.name, toUpdate);
							const originalAbilMod = modBeingScaled === "str" ? strMod : modBeingScaled === "dex" ? dexMod : null;

							const getAdjustedDamMod = () => {
								if (modBeingScaled === "str" && mon._strTmpMod != null) return mon._strTmpMod;
								if (modBeingScaled === "dex" && mon._dexTmpMod != null) return mon._dexTmpMod;

								if (modFromAbil == null) return 0 - offsetEnchant; // ensure enchanted equipment is ignored even with +0 base damage mod

								// calculate this without enchanted equipment; ignore them and add them back at the end
								return this._interpAndTranslateToSpace(modFromAbil, this._crToEstimatedDamageMod[crIn], this._crToEstimatedDamageMod[crOut]);
							};

							let numDiceOut = numDice;
							let diceFacesOut = diceFaces;
							let modOut = getAdjustedDamMod();

							const doPostCalc = () => {
								// prevent ability scores going below zero
								// should be mathematically impossible, if the recalculation is working correctly as:
								// - minimum damage dice is a d4
								// - minimum number of dice is 1
								// - minimum DPR range is 0-1, which can be achieved with e.g. 1d4-1 (avg 1) or 1d4-2 (avg 0)
								// therefore, this provides a sanity check: this should only occur when something's broken
								if (modOut < -5) throw new Error(`Ability modifier ${modBeingScaled != null ? `(${modBeingScaled})` : ""} was below -5 (${modOut})! Original dice expression was ${diceExp}.`);

								if (originalAbilMod != null && modOut !== originalAbilMod) {
									const tmpKey = `_${modBeingScaled}TmpMod`;
									const maxDprKey = `_maxDpr${modBeingScaled.uppercaseFirst()}`;
									let updateTempMod = true;
									if (mon[tmpKey] != null && mon[tmpKey] !== modOut) {
										if (mon[maxDprKey] >= adjustedDpr) {
											updateTempMod = false;
										} else {
											// TODO test this -- none of the official monsters require attribute re-calculation but homebrew might. The story so far:
											//   - A previous damage roll required an adjusted ability modifier to make the numbers line up
											//   - This damage roll requires a _different_ adjustment to the same modifier to make the numbers line up
											//   - This damage roll has a bigger average DPR, so should be prioritised. Update the modifier using this roll's requirements.
											//   - Since this will effectively invalidate the previous roll adjustments, break out of whatever we're doing here, and restart the entire adjustment process
											//   - As we've set our new attribute modifier on the creature, the next loop will respect it, and use it by default
											//   - Additionally, track the largest DPR, so we don't get stuck in a loop doing this on the next DPR adjustment iteration
											mon[tmpKey] = modOut;
											mon[maxDprKey] = adjustedDpr;
											allSucceeded = false;
											return "";
										}
									}

									if (updateTempMod) {
										mon[maxDprKey] = Math.max((mon[maxDprKey] || 0), adjustedDpr);
										mon[tmpKey] = modOut;
									}

									reqAbilAdjust.push({
										ability: modBeingScaled,
										mod: modOut,
										adjustedDpr
									})
								}
							};

							const getDiceExp = (a = numDiceOut, b = diceFacesOut, c = modOut) => `${a}d${b}${c !== 0 ? ` ${c > 0 ? "+" : ""} ${c}` : ""}`;
							let loops = 0;
							while (1) {
								if (inRange(getAvgDpr(getDiceExp()))) break;
								if (loops > 100) throw new Error(`Failed to find new DPR! Current formula is: ${getDiceExp()}`);

								const tryAdjustNumDice = (diceFacesTemp = diceFacesOut, modTemp = modOut) => {
									let numDiceTemp = numDice;
									let tempAvgDpr = getAvgDpr(getDiceExp(numDiceTemp, diceFacesTemp, modTemp));

									let found = false;

									if (adjustedDpr < tempAvgDpr) {
										while (numDiceTemp > 1 && tempAvgDpr >= targetDprRange[0]) {
											numDiceTemp -= 1;
											tempAvgDpr -= (diceFacesTemp + 1) / 2;

											if (inRange(getAvgDpr(getDiceExp(numDiceTemp, diceFacesTemp, modTemp)))) {
												found = true;
												break;
											}
										}
									} else {
										while (tempAvgDpr <= targetDprRange[1]) {
											numDiceTemp += 1;
											tempAvgDpr += (diceFacesTemp + 1) / 2;

											if (inRange(getAvgDpr(getDiceExp(numDiceTemp, diceFacesTemp, modTemp)))) {
												found = true;
												break;
											}
										}
									}

									if (found) {
										numDiceOut = numDiceTemp;
										return true;
									}
									return false;
								};

								const tryAdjustDiceFaces = () => {
									if (diceFaces === 4 || diceFaces === 20) return; // can't be scaled
									let diceFacesTemp = diceFaces;
									let tempAvgDpr = getAvgDpr(getDiceExp(undefined, diceFacesTemp));
									let found = false;

									if (adjustedDpr < tempAvgDpr) {
										while (diceFacesTemp > 4 && tempAvgDpr >= targetDprRange[0]) {
											diceFacesTemp = EntryRenderer.dice.getPreviousDice(diceFacesTemp);
											tempAvgDpr = getAvgDpr(getDiceExp(undefined, diceFacesTemp));

											if (inRange(getAvgDpr(getDiceExp(numDice, diceFacesTemp, modOut)))) {
												found = true;
												break;
											} else {
												found = tryAdjustNumDice(diceFacesTemp);
												if (found) break;
											}
										}
									} else {
										while (diceFacesTemp < 20 && tempAvgDpr <= targetDprRange[1]) {
											diceFacesTemp = EntryRenderer.dice.getNextDice(diceFacesTemp);
											tempAvgDpr = getAvgDpr(getDiceExp(undefined, diceFacesTemp));

											if (inRange(getAvgDpr(getDiceExp(numDice, diceFacesTemp, modOut)))) {
												found = true;
												break;
											} else {
												found = tryAdjustNumDice(diceFacesTemp);
												if (found) break;
											}
										}
									}

									if (found) {
										diceFacesOut = diceFacesTemp;
										return true;
									}
									return false;
								};

								const tryAdjustMod = () => {
									// alternating sequence, going further from origin each time.
									// E.g. original modOut == 0 => 1, -1, 2, -2, 3, -3, ... modOut+n, modOut-n
									modOut += (1 - ((loops % 2) * 2)) * (loops + 1);
								};

								// order of preference for scaling:
								// - adjusting number of dice
								// - adjusting number of faces
								// - adjusting modifier
								if (tryAdjustNumDice()) break;
								if (tryAdjustDiceFaces()) break;
								tryAdjustMod();

								loops++;
							}

							doPostCalc();
							const diceExpOut = getDiceExp(undefined, undefined, modOut + offsetEnchant);
							const avgDamOut = Math.floor(getAvgDpr(diceExpOut));
							if (avgDamOut <= 0) return `1 ${suffix.replace(/^[^\w]+/, " ")}`;
							return `${Math.floor(getAvgDpr(diceExpOut))}${prefix}${diceExpOut}${suffix}`;
						});

						// skip remaining entries, to let the outer loop continue
						if (!allSucceeded) return false;

						if (toUpdate !== out) {
							scaledEntries.push({
								prop,
								idxProp,
								entriesStrOriginal: toUpdate, // unused/debug
								entriesStr: out,
								reqAbilAdjust // unused/debug
							});
						}
					});

					return allSucceeded;
				}
				return true; // if there was nothing to do, the operation was a success
			};

			if (!handleDpr("trait")) continue;
			if (!handleDpr("action")) continue;
			if (!handleDpr("reaction")) continue;
			if (!handleDpr("legendary")) continue;
			if (!handleDpr("variant")) continue;
			dprAdjustmentComplete = true;
		}

		// overwrite originals with scaled versions
		scaledEntries.forEach(it => {
			mon[it.prop][it.idxProp].entries = JSON.parse(it.entriesStr);
		});

		// update ability scores, as required
		const updateAbility = (prop) => {
			const tempKey = `_${prop}TmpMod`;
			const oldKey = `${prop}Old`;
			if (mon[tempKey] != null) {
				mon[oldKey] = mon[prop];
				mon[prop] = this._calcNewAbility(mon, prop, mon[tempKey])
			}
			delete mon[tempKey];
		};
		updateAbility("str");
		updateAbility("dex");
	},

	_handleUpdateAbilityScoresSkillsSaves (mon) {
		const TO_HANDLE = ["str", "dex", "int", "wis", "con"];

		const getModString = (mod) => {
			return `${mod >= 0 ? "+" : ""}${mod}`;
		};

		TO_HANDLE.forEach(abil => {
			const abilOld = `${abil}Old`;
			if (mon[abilOld] != null) {
				const diff = Parser.getAbilityModNumber(mon[abil]) - Parser.getAbilityModNumber(mon[abilOld]);

				if (mon.save && mon.save[abil] != null) {
					const out = Number(mon.save[abil]) + diff;
					mon.save[abil] = getModString(out);
				}

				if (mon.skill) {
					Object.keys(mon.skill).forEach(skill => {
						const skillAbil = Parser.skillToAbilityAbv(skill);
						if (skillAbil !== abil) return;
						const out = Number(mon.skill[skill]) + diff;
						mon.skill[skill] = getModString(out);
					});
				}

				if (abil === "wis" && mon.passive != null) {
					mon.passive = mon.passive + diff;
				}
			}
		});
	},

	_spells: null,
	_pInitSpellCache () {
		if (this._spells) return Promise.resolve();

		this._spells = {};
		return DataUtil.loadJSON(`data/spells/spells-phb.json`).then(data => {
			this.__initSpellCache(data);
		});
	},

	__initSpellCache (data) {
		data.spell.forEach(s => {
			s.classes.fromClassList.forEach(c => {
				let it = (this._spells[c.source] = this._spells[c.source] || {});
				const lowName = c.name.toLowerCase();
				it = (it[lowName] = it[lowName] || {});
				it = (it[s.level] = it[s.level] || {});
				it[s.name] = 1;
			})
		});
	},

	_adjustSpellcasting (mon, crIn, crOut) {
		const getSlotsAtLevel = (casterLvl, slotLvl) => {
			// there's probably a nice equation for this somewhere
			if (casterLvl < (slotLvl * 2) - 1) return 0;
			switch (slotLvl) {
				case 1: return casterLvl === 1 ? 2 : casterLvl === 2 ? 3 : 4;
				case 2: return casterLvl === 3 ? 2 : 3;
				case 3: return casterLvl === 5 ? 2 : 3;
				case 4: return casterLvl === 7 ? 1 : casterLvl === 8 ? 2 : 3;
				case 5: return casterLvl === 9 ? 1 : casterLvl < 18 ? 2 : 3;
				case 6: return casterLvl >= 19 ? 2 : 1;
				case 7: return casterLvl === 20 ? 2 : 1;
				case 8: return 1;
				case 9: return 1;
			}
		};

		if (mon.spellcasting) {
			const idealClvlIn = this._crToCasterLevel(crIn);
			const idealClvlOut = this._crToCasterLevel(crOut);

			mon.spellcasting.forEach(sc => {
				// favor the first result as primary
				let primaryInLevel = null;
				let primaryOutLevel = null;

				// attempt to ascertain class spells
				let spellsFromClass = null;

				if (sc.headerEntries) {
					const inStr = JSON.stringify(sc.headerEntries);

					let anyChange = false;
					const outStr = inStr.replace(/(an?) (\d+)[A-Za-z]+-level/i, (...m) => {
						const level = Number(m[2]);
						const outLevel = Math.max(1, Math.min(20, this._getScaledToRatio(level, idealClvlIn, idealClvlOut)));
						anyChange = level !== outLevel;
						if (anyChange) {
							if (primaryInLevel == null) primaryInLevel = level;
							if (primaryOutLevel == null) primaryOutLevel = outLevel;
							return `${Parser.spellLevelToArticle(outLevel)} ${Parser.spLevelToFull(outLevel)}-level`;
						} else return m[0];
					});

					const mClasses = /(bard|cleric|druid|paladin|ranger|sorcerer|warlock|wizard) spell(?:s)?/i.exec(outStr);
					if (mClasses) spellsFromClass = mClasses[1];
					else {
						const mClasses2 = /(bard|cleric|druid|paladin|ranger|sorcerer|warlock|wizard)(?:'s)? spell list/i.exec(outStr);
						if (mClasses2) spellsFromClass = mClasses2[1]
					}

					if (anyChange) sc.headerEntries = JSON.parse(outStr);
				}

				// calculate spell level from caster levels
				let maxSpellLevel = null;
				if (primaryOutLevel) {
					maxSpellLevel = Math.min(9, Math.ceil(primaryOutLevel / 2));

					// cap half-caster slots at 5
					if (/paladin|ranger/i.exec(spellsFromClass)) {
						maxSpellLevel = Math.min(5, primaryOutLevel);
					}
				}

				if (sc.spells && primaryOutLevel != null) {
					const spells = sc.spells;
					// cantrips
					if (spells[0]) {
						const curCantrips = spells[0].spells.length;
						const idealCantripsIn = this._casterLevelAndClassToCantrips(primaryInLevel, spellsFromClass);
						const idealCantripsOut = this._casterLevelAndClassToCantrips(primaryOutLevel, spellsFromClass);
						const targetCantripCount = this._getScaledToRatio(curCantrips, idealCantripsIn, idealCantripsOut);

						if (curCantrips < targetCantripCount) {
							const cantrips = Object.keys((this._spells[SRC_PHB][spellsFromClass.toLowerCase()] || {})[0]).map(it => it.toLowerCase());
							if (cantrips.length) {
								const extraCantrips = [];
								const numNew = Math.min(targetCantripCount - curCantrips, cantrips.length);
								for (let n = 0; n < numNew; ++n) {
									const ix = RollerUtil.roll(cantrips.length, this._rng);
									extraCantrips.push(cantrips[ix]);
									cantrips.splice(ix, 1);
								}
								spells[0].spells = spells[0].spells.concat(extraCantrips.map(it => `{@spell ${it}}`));
							}
						} else {
							const keepThese = this._protectedCantrips.map(it => `@spell ${it}`);
							while (spells[0].spells.length > targetCantripCount) {
								const ixs = spells[0].spells.filterIndex(it => !~keepThese.findIndex(x => it.includes(x)));
								if (ixs.length) {
									const ix = RollerUtil.roll(ixs.length, this._rng);
									spells[0].spells.splice(ix, 1);
								} else spells[0].spells.pop();
							}
						}
					}

					// spells
					let lastRatio = 1; // adjust for higher/lower than regular spell slot counts
					for (let i = 1; i < 10; ++i) {
						const atLevel = spells[i];
						const idealSlotsIn = getSlotsAtLevel(primaryInLevel, i);
						const idealSlotsOut = getSlotsAtLevel(primaryOutLevel, i);

						if (atLevel) {
							if (atLevel.slots) { // no "slots" signifies at-wills
								const adjustedSlotsOut = this._getScaledToRatio(atLevel.slots, idealSlotsIn, idealSlotsOut);
								lastRatio = adjustedSlotsOut / idealSlotsOut;

								atLevel.slots = adjustedSlotsOut;
								if (adjustedSlotsOut <= 0) {
									delete spells[i];
								}
							}
						} else if (i <= maxSpellLevel) {
							const slots = Math.max(1, Math.round(idealSlotsOut * lastRatio));
							if (spellsFromClass && (this._spells[SRC_PHB][spellsFromClass.toLowerCase()] || {})[i]) {
								const examples = [];
								const levelSpells = Object.keys(this._spells[SRC_PHB][spellsFromClass.toLowerCase()][i]).map(it => it.toLowerCase());
								const numExamples = Math.min(5, levelSpells.length);
								for (let n = 0; n < numExamples; ++n) {
									const ix = RollerUtil.roll(levelSpells.length, this._rng);
									examples.push(levelSpells[ix]);
									levelSpells.splice(ix, 1);
								}
								spells[i] = {
									slots,
									spells: [
										`A selection of {@filter ${Parser.spLevelToFull(i)}-level ${spellsFromClass} spells|spells|level=${i}|class=${spellsFromClass}}. Examples include: ${examples.map(it => `{@spell ${it}}`).joinConjunct(", ", " and ")}`
									]
								};
							} else {
								spells[i] = {
									slots,
									spells: [
										`A selection of {@filter ${Parser.spLevelToFull(i)}-level spells|spells|level=${i}}`
									]
								};
							}
						} else {
							delete spells[i];
						}
					}
				}
			});
		}
	}
};
