/* global $:false */
'use strict';

class ShapedConverter {
	static get SOURCE_INFO () {
		return {
			bestiary: {
				dir: 'data/bestiary/',
				inputProp: 'monsterInput'
			},
			spells: {
				dir: 'data/spells/',
				inputProp: 'spellInput'
			}
		};
	}

	getInputs () {
		const SOURCE_INFO = this.constructor.SOURCE_INFO;
		if (!this._inputPromise) {
			const sources = [
				{url: `${SOURCE_INFO.bestiary.dir}index.json`},
				{url: `${SOURCE_INFO.spells.dir}index.json`},
				{url: `${SOURCE_INFO.bestiary.dir}srd-monsters.json`},
				{url: `${SOURCE_INFO.spells.dir}srd-spells.json`},
				{url: `${SOURCE_INFO.spells.dir}roll20.json`},
				{url: `${SOURCE_INFO.bestiary.dir}meta.json`}
			];

			this._inputPromise = DataUtil.multiLoadJSON(sources, null, data => {
				ShapedConverter.bestiaryIndex = data[0];

				SOURCE_INFO.bestiary.fileIndex = data[0];
				SOURCE_INFO.spells.fileIndex = data[1];
				const inputs = {};
				inputs._srdMonsters = data[2].monsters;
				inputs._srdSpells = data[3].spells;
				inputs._srdSpellRenames = data[3].spellRenames;
				inputs._additionalSpellData = {};

				data[4].spell.forEach(spell => inputs._additionalSpellData[spell.name] = Object.assign(spell.data, spell.shapedData));
				inputs._legendaryGroup = {};
				data[5].legendaryGroup.forEach(monsterDetails => {
					inputs._legendaryGroup[monsterDetails.source] = inputs._legendaryGroup[monsterDetails.source] || {};
					inputs._legendaryGroup[monsterDetails.source][monsterDetails.name] = monsterDetails
				});
				Object.defineProperties(inputs, {
					_srdMonsters: { writable: false, enumerable: false },
					_srdSpells: { writable: false, enumerable: false },
					_srdSpellRenames: { writable: false, enumerable: false },
					_additionalSpellData: { writable: false, enumerable: false },
					_legendaryGroup: { writable: false, enumerable: false }
				});

				return Object.values(SOURCE_INFO).reduce((inputs, sourceType) => {
					Object.keys(sourceType.fileIndex).forEach(key => {
						const input = this.constructor.getInput(inputs, key, Parser.SOURCE_JSON_TO_FULL[key]);
						input[sourceType.inputProp] = `${sourceType.dir}${sourceType.fileIndex[key]}`;
					});
					return inputs;
				}, inputs);
			}).then(inputs => {
				return BrewUtil.pAddBrewData().then(data => {
					this.addBrewData(inputs, data);
					return inputs;
				});
			});
		}
		return this._inputPromise;
	}

	addBrewData (inputs, data) {
		if (data.spell && data.spell.length) {
			data.spell.forEach(spell => {
				const input = this.constructor.getInput(inputs, spell.source, BrewUtil.sourceJsonToFull(spell.source));
				input.spellInput = input.spellInput || [];
				input.spellInput.push(spell);
			})
		}
		if (data.monster && data.monster.length) {
			data.monster.forEach(monster => {
				const input = this.constructor.getInput(inputs, monster.source, BrewUtil.sourceJsonToFull(monster.source));
				input.monsterInput = input.monsterInput || [];
				input.monsterInput.push(monster);
			});
		}
		if (data.legendaryGroup && data.legendaryGroup.length) {
			data.legendaryGroup.forEach(legendary => {
				inputs._legendaryGroup[legendary.source] = inputs._legendaryGroup[legendary.source] || {};
				if (!inputs._legendaryGroup[legendary.source][legendary.name]) {
					inputs._legendaryGroup[legendary.source][legendary.name] = legendary;
				}
			})
		}
	}

	static getInput (inputs, key, name) {
		inputs[key] = inputs[key] || {
			name,
			key,
			dependencies: key === SRC_PHB ? ['SRD'] : ['Player\'s Handbook'],
			classes: {}
		};
		return inputs[key];
	}

	generateShapedJS (sourceKeys) {
		return this.getInputs().then(inputs => {
			const sources = [];

			sourceKeys.forEach(sourceKey => {
				const input = inputs[sourceKey];
				if (isString(input.monsterInput)) {
					sources.push({
						url: input.monsterInput,
						key: sourceKey
					})
				}
				if (isString(input.spellInput)) {
					sources.push({
						url: input.spellInput,
						key: sourceKey
					})
				}
			});

			let jsonPromise;
			if (sources.length) {
				const originalSources = MiscUtil.copy(sources);
				jsonPromise = DataUtil.multiLoadJSON(
					originalSources,
					null,
					(data) => {
						data.forEach((dataItem, index) => {
							const key = sources[index].key;
							if (dataItem.spell) inputs[key].spellInput = dataItem.spell;
							if (dataItem.monster) inputs[key].monsterInput = dataItem.monster;
							if (sources[index].doNotConvert) inputs[key].doNotConvert = true;
						});
					}
				);
			} else {
				jsonPromise = Promise.resolve();
			}

			return jsonPromise.then(() => {
				this.constructor.convertData(inputs);
				const lines = sourceKeys
					.map(key => {
						return `ShapedScripts.addEntities(${JSON.stringify(inputs[key].converted, this.constructor.serialiseFixer)})`;
					}).join('\n');
				return `on('ready', function() {\n${lines}\n});`
			})
		});
	}

	static makeSpellList (spellArray) {
		return `${spellArray.map(this.fixLinks).join(', ')}`;
	}

	static get INNATE_SPELLCASTING_RECHARGES () {
		return {
			daily: 'day',
			rest: 'rest',
			weekly: 'week'
		};
	}

	static innateSpellProc (spellcasting) {
		return Object.keys(spellcasting)
			.filter(k => ![
				'headerEntries',
				'headerWill',
				'name',
				'footerEntries',
				'ability',
				'hidden'
			].includes(k))
			.map(useInfo => {
				const spellDetails = spellcasting[useInfo];
				if (useInfo === 'will') {
					return `At will: ${this.makeSpellList(spellDetails)}`;
				}
				if (useInfo === 'constant') {
					return `Constant: ${this.makeSpellList(spellDetails)}`;
				}
				if (this.INNATE_SPELLCASTING_RECHARGES[useInfo]) {
					const rechargeString = this.INNATE_SPELLCASTING_RECHARGES[useInfo];
					return Object.keys(spellDetails).map(usesPerDay => {
						const spellList = spellDetails[usesPerDay];
						const howMany = usesPerDay.slice(0, 1);
						const each = usesPerDay.endsWith('e') && spellList.length > 1;
						return `${howMany}/${rechargeString}${each ? ' each' : ''}: ${this.makeSpellList(spellList)}`;
					}).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
				} else if (useInfo === 'spells') {
					return this.processLeveledSpells(spellDetails);
				} else {
					throw new Error('Unrecognised spellUseInfo ' + useInfo);
				}
			})
			.reduce(this.flattener, []);
	}

	static processLeveledSpells (spellObj) {
		return Object.keys(spellObj).map(levelString => {
			const level = parseInt(levelString, 10);
			const levelInfo = spellObj[level];
			return `${Parser.spLevelToFullLevelText(level)} (${this.slotString(levelInfo.slots)}): ${this.makeSpellList(levelInfo.spells)}`;
		});
	}

	static normalSpellProc (spellcasting) {
		return this.processLeveledSpells(spellcasting.spells);
	}

	static slotString (slots) {
		switch (slots) {
			case undefined:
				return 'at will';
			case 1:
				return '1 slot';
			default:
				return `${slots} slots`;
		}
	}

	static processChallenge (cr) {
		if (cr === 'Unknown' || cr == null) {
			return 0;
		}
		const match = cr.match(/(\d+)(?:\s?\/\s?(\d+))?/);
		if (!match) {
			throw new Error('Bad CR ' + cr);
		}
		if (match[2]) {
			return parseInt(match[1], 10) / parseInt(match[2], 10);
		}
		return parseInt(match[1], 10);
	}

	static fixLinks (string) {
		return string
			.replace(/{@filter ([^|]+)[^}]+}/g, '$1')
			.replace(/{@hit (\d+)}/g, '+$1')
			.replace(/{@chance (\d+)[^}]+}/g, '$1 percent')
			.replace(/{@recharge(?: (\d))?}/g, (m, lower) => `(Recharge ${lower ? `${Number(lower)}\u2013` : ""}6)`)
			.replace(/{(@atk [A-Za-z,]+})/g, (m, p1) => EntryRenderer.attackTagToFull(p1))
			.replace(/{@h}/g, "Hit: ")
			.replace(/{@\w+ ((?:[^|}]+\|?){0,3})}/g, (m, p1) => {
				const parts = p1.split('|');
				return parts.length === 3 ? parts[2] : parts[0];
			})
			.replace(/(d\d+)([+-])(\d)/g, '$1 $2 $3');
	}

	static makeTraitAction (name) {
		const nameMatch = this.fixLinks(name).match(/([^(]+)(?:\(([^)]+)\))?/);
		if (nameMatch && nameMatch[2]) {
			const rechargeMatch = nameMatch[2].match(/^(?:(.*), )?(\d(?: minute[s]?)?\/(?:Day|Turn|Rest|Hour|Week|Month|Night|Long Rest|Short Rest)|Recharge \d(?:\u20136)?|Recharge[s]? [^),]+)(?:, ([^)]+))?$/i);
			if (rechargeMatch) {
				let newName = nameMatch[1].trim();
				const condition = rechargeMatch[1] || rechargeMatch[3];
				if (condition) {
					newName += ` (${condition})`
				}
				return {
					name: newName,
					text: '',
					recharge: rechargeMatch[2]
				};
			}
		}

		return {
			name
		};
	}

	static processStatblockSection (section) {
		return section.map(trait => {
			const newTrait = this.makeTraitAction(trait.name);
			if (this.SPECIAL_TRAITS_ACTIONS[newTrait.name]) {
				return this.SPECIAL_TRAITS_ACTIONS[newTrait.name](newTrait, trait.entries);
			}

			const expandedList = trait.entries.map(entry => {
				if (isObject(entry)) {
					if (entry.items) {
						if (isObject(entry.items[0])) {
							return entry.items.map(item => ({
								name: item.name.replace(/^([^.]+)\.$/, '$1'),
								text: this.fixLinks(item.entry)
							}));
						} else {
							return entry.items.map(item => `• ${this.fixLinks(item)}`).join('\n');
						}
					} else if (entry.entries) {
						const joiner = entry.type === 'inline' ? '' : '\n';
						return entry.entries.map(subEntry => isString(subEntry) ? subEntry : subEntry.text).join(joiner);
					}
				} else {
					return this.fixLinks(entry);
				}
			}).reduce(this.flattener, []);

			newTrait.text = expandedList.filter(isString).join('\n');
			return [newTrait].concat(expandedList.filter(isObject));
		}).reduce(this.flattener, []);
	}

	static processSpecialList (action, entries) {
		action.text = this.fixLinks(entries[0]);
		let slice = entries.slice(1);
		if (slice.length === 1 && slice[0].type === "list") {
			slice = slice[0].items.map(it => it.type === "item" ? `${it.name}. ${it.entries ? it.entries.join("\n") : it.entry}` : it);
		}
		return slice.reduce((result, entry) => {
			const match = entry.match(/^(?:\d+\. )?([A-Z][a-z]+(?: [A-Z][a-z]+)*). (.*)$/);
			if (match) {
				result.push({
					name: match[1],
					text: this.fixLinks(match[2])
				});
			} else {
				result.last().text = result.last().text + '\n' + entry;
			}
			return result;
		}, [action]);
	}

	static get SPECIAL_TRAITS_ACTIONS () {
		return {
			Roar: this.processSpecialList.bind(this),
			'Eye Rays': this.processSpecialList.bind(this),
			'Eye Ray': this.processSpecialList.bind(this),
			'Gaze': this.processSpecialList.bind(this),
			'Call the Blood': this.processSpecialList.bind(this)
		};
	}

	static processHP (monster, output) {
		if (monster.hp.special) {
			output.HP = monster.hp.special;
		} else {
			output.HP = `${monster.hp.average} (${monster.hp.formula.replace(/(\d)([+-])(\d)/, '$1 $2 $3')})`;
		}
	}

	static processAC (ac) {
		function appendToList (string, newItem) {
			return `${string}${string.length ? ', ' : ''}${newItem}`;
		}

		return ac.reduce((acString, acEntry) => {
			if (isNumber(acEntry)) {
				return appendToList(acString, acEntry);
			}

			if (acEntry.condition && acEntry.braces) {
				return `${acString} (${acEntry.ac} ${this.fixLinks(acEntry.condition)})`;
			}

			let entryString = `${acEntry.ac}`;
			if (acEntry.from) {
				entryString += ` (${acEntry.from.map(this.fixLinks).join(', ')})`;
			}
			if (acEntry.condition) {
				entryString += ` ${this.fixLinks(acEntry.condition)}`;
			}

			return appendToList(acString, entryString);
		}, '');
	}

	static processSkills (monster, output) {
		output.skills = Object.keys(monster.skill)
			.filter(name => name !== 'other')
			.map(name => `${name.toTitleCase()} ${monster.skill[name]}`)
			.join(', ');

		if (monster.skill.other) {
			const additionalSkills = this.objMap(monster.skill.other[0].oneOf, (val, name) => `${name.toTitleCase()} ${val}`).join(', ');
			(monster.trait = monster.trait || []).push({
				name: 'Additional Skill Proficiencies',
				entries: [
					`The ${monster.name} also has one of the following skill proficiencies: ${additionalSkills}`
				]
			});
		}
	}

	static getSpellcastingProcessor (spellcasting) {
		if (spellcasting.daily || spellcasting.will || spellcasting.headerWill) {
			return this.innateSpellProc.bind(this);
		} else if (spellcasting.spells) {
			return this.normalSpellProc.bind(this);
		} else if (spellcasting.hidden) {
			return null;
		}

		throw new Error(`Unrecognised type of spellcasting object: ${spellcasting.name}`);
	}

	static processMonster (monster, legendaryGroup) {
		const output = {};
		output.name = monster.name;
		output.size = Parser.sizeAbvToFull(monster.size);
		output.type = Parser.monTypeToFullObj(monster.type).asText.replace(/^[a-z]/, (char) => char.toLocaleUpperCase());
		output.alignment = Parser.alignmentListToFull(monster.alignment).toLowerCase();
		output.AC = this.processAC(monster.ac);
		this.processHP(monster, output);
		output.speed = Parser.getSpeedString(monster);
		output.strength = monster.str;
		output.dexterity = monster.dex;
		output.constitution = monster.con;
		output.intelligence = monster.int;
		output.wisdom = monster.wis;
		output.charisma = monster.cha;
		if (monster.save) {
			output.savingThrows = this.objMap(monster.save, (saveVal, saveName) => `${saveName.toTitleCase()} ${saveVal}`).join(', ');
		}
		if (monster.skill) {
			this.processSkills(monster, output);
		}
		if (monster.vulnerable) {
			output.damageVulnerabilities = Parser.monImmResToFull(monster.vulnerable);
		}
		if (monster.resist) {
			output.damageResistances = Parser.monImmResToFull(monster.resist);
		}
		if (monster.immune) {
			output.damageImmunities = Parser.monImmResToFull(monster.immune);
		}
		if (monster.conditionImmune) {
			output.conditionImmunities = Parser.monCondImmToFull(monster.conditionImmune);
		}
		output.senses = monster.senses;
		output.languages = monster.languages;
		output.challenge = this.processChallenge(monster.cr.cr || monster.cr);

		const traits = [];
		const actions = [];
		const reactions = [];

		if (monster.trait) {
			traits.push.apply(traits, this.processStatblockSection(monster.trait));
		}
		if (monster.spellcasting) {
			monster.spellcasting.forEach(spellcasting => {
				const spellProc = this.getSpellcastingProcessor(spellcasting);
				if (spellProc == null) return;

				const spellLines = spellProc(spellcasting);
				spellLines.unshift(this.fixLinks(spellcasting.headerEntries[0]));
				if (spellcasting.footerEntries) {
					spellLines.push.apply(spellLines, spellcasting.footerEntries);
				}
				const trait = this.makeTraitAction(spellcasting.name);
				trait.text = spellLines.join('\n');

				traits.push(trait);
			});
		}

		if (monster.action) {
			actions.push.apply(actions, this.processStatblockSection(monster.action));
		}
		if (monster.reaction) {
			reactions.push.apply(reactions, this.processStatblockSection(monster.reaction));
		}

		const addVariant = (name, text, output, forceActions) => {
			const newTraitAction = this.makeTraitAction(name);
			newTraitAction.name = 'Variant: ' + newTraitAction.name;
			const isAttack = text.match(/{@hit|Attack:|{@atk/);
			newTraitAction.text = this.fixLinks(text);
			if ((newTraitAction.recharge && !text.match(/bonus action/)) || forceActions || isAttack) {
				actions.push(newTraitAction);
			} else {
				traits.push(newTraitAction);
			}
		};

		const entryStringifier = (entry, omitName) => {
			if (isString(entry)) {
				return entry;
			}
			const entryText = `${entry.entries.map(subEntry => entryStringifier(subEntry)).join('\n')}`;
			return omitName ? entryText : `${entry.name}. ${entryText}`;
		};

		if (monster.variant && monster.name !== 'Shadow Mastiff') {
			monster.variant.forEach(variant => {
				const baseName = variant.name;
				if (variant.entries.every(entry => isString(entry) || entry.type !== 'entries')) {
					const text = variant.entries.map(entry => {
						if (isString(entry)) return entry;
						else if (entry.type === "table") return this.processTable(entry);
						else return entry.items.map(item => `${item.name} ${item.entry}`).join('\n');
					}).join('\n');
					addVariant(baseName, text, output);
				} else if (variant.entries.find(entry => entry.type === 'entries')) {
					let explicitlyActions = false;

					variant.entries.forEach(entry => {
						if (isObject(entry)) {
							addVariant(entry.name || baseName, entryStringifier(entry, true), output, explicitlyActions);
						} else {
							explicitlyActions = !!entry.match(/action options?[.:]/);
						}
					});
				}
			});
		}

		if (traits.length) {
			output.traits = traits;
		}

		if (actions.length) {
			output.actions = actions;
		}

		if (reactions.length) {
			output.reactions = reactions;
		}

		if (monster.legendary) {
			output.legendaryPoints = monster.legendaryActions || 3;
			output.legendaryActions = monster.legendary.map(legendary => {
				if (!legendary.name) {
					return null;
				}
				const result = {};
				const nameMatch = legendary.name.match(/([^(]+)(?:\s?\((?:Costs )?(\d(?:[-\u2013]\d)?) [aA]ctions(?:, ([^)]+))?\))?/);
				if (nameMatch && nameMatch[2]) {
					result.name = nameMatch[1].trim() + (nameMatch[3] ? ` (${nameMatch[3]})` : '');
					result.text = '';
					result.cost = parseInt(nameMatch[2], 10);
				} else {
					result.name = legendary.name;
					result.text = '';
					result.cost = 1;
				}
				result.text = this.fixLinks(legendary.entries.join('\n'));
				return result;
			}).filter(l => !!l);
		}

		if (monster.legendaryGroup && (legendaryGroup[monster.legendaryGroup.source] || {})[monster.legendaryGroup.name]) {
			const lg = legendaryGroup[monster.legendaryGroup.source][monster.legendaryGroup.name];
			const lairs = lg.lairActions;
			if (lairs) {
				if (lairs.every(isString)) {
					output.lairActions = lairs.map(this.fixLinks);
				} else {
					output.lairActions = lairs.filter(isObject)[0].items.map(this.itemRenderer);
				}
			}
			if (lg.regionalEffects) {
				output.regionalEffects = lg.regionalEffects.filter(isObject)[0].items.map(this.itemRenderer);
				output.regionalEffectsFade = this.fixLinks(lg.regionalEffects.filter(isString).last());
			}
		}

		if (monster.environment && monster.environment.length > 0) {
			output.environments = monster.environment.sort((a, b) => a.localeCompare(b)).map(env => env.toTitleCase());
		}

		return output;
	}

	static get itemRenderer () {
		return item => (this.fixLinks(isObject(item) ? `${item.name}. ${item.entries.join('\n')}` : item));
	}

	static padInteger (num) {
		if (num < 10 && num >= 0) {
			return `0${num}`;
		}
		return `${num}`;
	}

	static processSpellComponents (components, newSpell) {
		components = components || {};
		const shapedComponents = {};
		if (components.v) shapedComponents.verbal = true;
		if (components.s) shapedComponents.somatic = true;
		if (components.m) {
			shapedComponents.material = true;

			if (components.m !== true) {
				shapedComponents.materialMaterial = components.m.text || components.m;
			}
		}
		newSpell.components = shapedComponents;
	}

	static processSpellDuration (duration, newSpell) {
		switch (duration.type) {
			case "special":
				newSpell.duration = "Special";
				break;
			case "instant":
				newSpell.duration = "Instantaneous";
				break;
			case "timed":
				newSpell.concentration = duration.concentration;
				newSpell.duration = `${duration.concentration ? "up to " : ""}${duration.duration.amount} ${duration.duration.type}${duration.duration.amount > 1 ? "s" : ""}`;
				break;
			case "permanent":
				if (duration.ends) {
					newSpell.duration = `Until ${duration.ends
						.filter(end => end === "dispel" || end === "trigger")
						.map(end => end === "dispel" ? "dispelled" : end)
						.map(end => end === "trigger" ? "triggered" : end)
						.sort()
						.join(" or ")}`
				} else {
					// shape has no option for "Permanent"
					newSpell.duration = "Special";
				}
		}
	}

	static processSpellEntries (entries, newSpell) {
		const entryMapper = entry => {
			if (isString(entry)) {
				return entry;
			} else if (entry.type === 'table') {
				return this.processTable(entry);
			} else if (entry.type === 'list') {
				return entry.items.map(item => `- ${item}`).join('\n');
			} else if (entry.type === 'homebrew') {
				if (!entry.entries) return '';
				return entry.entries.map(entryMapper).join('\n');
			} else {
				return `***${entry.name}.*** ${entry.entries.map(entryMapper).join('\n')}`;
			}
		};

		let entriesToProc = entries;
		if (isString(entries.last()) && (entries.last().match(/damage increases(?: by (?:{[^}]+}|one die))? when you reach/) || entries.last().match(/creates more than one beam when you reach/))) {
			newSpell.description = '';
			entriesToProc = entries.slice(0, -1);
			newSpell.higherLevel = this.fixLinks(entries.last());
		}

		newSpell.description = this.fixLinks(entriesToProc.map(entryMapper).join('\n'));
	}

	static processTable (entry) {
		const cellProc = cell => {
			if (isString(cell)) {
				return cell;
			} else if (cell.roll) {
				return cell.roll.exact || `${this.padInteger(cell.roll.min)}\\u2013${this.padInteger(cell.roll.max)}`;
			}
		};

		const rows = [entry.colLabels];
		rows.push.apply(rows, entry.rows);

		const formattedRows = rows.map(row => `| ${row.map(cellProc).join(' | ')} |`);
		const styleToColDefinition = style => {
			if (style.includes('text-align-center')) {
				return ':----:';
			} else if (style.includes('text-align-right')) {
				return '----:';
			}
			return ':----';
		};
		const colDefinitions = entry.colStyles ? entry.colStyles.map(styleToColDefinition) : entry.colLabels.map(() => ':----');
		const divider = `|${colDefinitions.join('|')}|`;
		formattedRows.splice(1, 0, divider);

		const title = entry.caption ? `##### ${entry.caption}\n` : '';
		return `${title}${formattedRows.join('\n')}`;
	}

	static addExtraSpellData (newSpell, data) {
		if (data['Spell Attack']) {
			newSpell.attack = {
				type: data['Spell Attack'].toLocaleLowerCase()
			};
		}

		if (data.Save) {
			newSpell.save = {
				ability: data.Save
			};
			if (data['Save Success']) {
				newSpell.save.saveSuccess = data['Save Success'].toLocaleLowerCase();
			}
		}

		const secondOutput = (data.primaryDamageCondition === data.secondaryDamageCondition) ? this.SECONDARY_DAMAGE_OUTPUTS_NAMES : this.PRIMARY_DAMAGE_OUTPUT_NAMES;

		[
			[
				this.PRIMARY_DAMAGE_PROP_NAMES,
				this.PRIMARY_DAMAGE_OUTPUT_NAMES
			],
			[
				this.SECONDARY_DAMAGE_PROP_NAMES,
				secondOutput
			]
		].forEach(propNamesArray => {
			const propNames = propNamesArray[0];
			const outputNames = propNamesArray[1];
			if (data[propNames.damage] && data[propNames.damageType] !== 'Effect') {
				switch (data[propNames.condition]) {
					case 'save':
						this.processDamageInfo(data, newSpell.save, propNames, outputNames);
						break;
					case 'attack':
						this.processDamageInfo(data, newSpell.attack, propNames, outputNames);
						break;
					case 'auto':
						newSpell.damage = newSpell.damage || {};
						this.processDamageInfo(data, newSpell.damage, propNames, outputNames);
						break;
					default:
						throw new Error('Missing ' + propNames.condition + ' for spell ' + newSpell.name);
				}
			}
		});

		if (data.Healing) {
			newSpell.heal = {};

			const healMatch = data.Healing.match(/^(\d+d\d+)?(?:\s?\+\s?)?(\d+)?$/);
			if (healMatch) {
				if (healMatch[1]) {
					newSpell.heal.heal = healMatch[1];
				}
				if (healMatch[2]) {
					newSpell.heal.bonus = parseInt(healMatch[2], 10);
				}
			} else {
				newSpell.heal.heal = data.Healing;
			}

			if (data['Add Casting Modifier'] === 'Yes') {
				newSpell.heal.castingStat = true;
			}
			if (data['Higher Spell Slot Dice'] && data.Healing.match(/\d+(?:d\d+)/)) {
				newSpell.heal.higherLevelDice = parseInt(data['Higher Spell Slot Dice'], 10);
			}

			if (data['Higher Level Healing']) {
				newSpell.heal.higherLevelAmount = parseInt(data['Higher Level Healing'], 10);
			}
		}
	}

	static get PRIMARY_DAMAGE_PROP_NAMES () {
		return {
			damage: 'Damage',
			damageProgression: 'Damage Progression',
			damageType: 'Damage Type',
			higherLevel: 'Higher Spell Slot Dice',
			castingStat: 'Add Casting Modifier',
			condition: 'primaryDamageCondition'
		};
	}

	static get PRIMARY_DAMAGE_OUTPUT_NAMES () {
		return {
			outputDamage: 'damage',
			outputDamageBonus: 'damageBonus',
			outputDamageType: 'damageType',
			outputHigherLevel: 'higherLevelDice',
			outputCastingStat: 'castingStat'
		};
	}

	static get SECONDARY_DAMAGE_PROP_NAMES () {
		return {
			damage: 'Secondary Damage',
			damageType: 'Secondary Damage Type',
			damageProgression: 'Secondary Damage Progression',
			higherLevel: 'Secondary Higher Spell Slot Dice',
			castingStat: 'Secondary Add Casting Modifier',
			condition: 'secondaryDamageCondition'
		};
	}

	static get SECONDARY_DAMAGE_OUTPUTS_NAMES () {
		return {
			outputDamage: 'secondaryDamage',
			outputDamageBonus: 'secondaryDamageBonus',
			outputDamageType: 'secondaryDamageType',
			outputHigherLevel: 'higherLevelSecondaryDice',
			outputCastingStat: 'secondaryCastingStat'
		};
	}

	static processDamageInfo (data, outputObject, propNames, outputNames) {
		if (data[propNames.damage]) {
			if (data[propNames.damageProgression]) {
				if (data[propNames.damageProgression] === 'Cantrip Dice') {
					outputObject[outputNames.outputDamage] = '[[ceil((@{level} + 2) / 6)]]' + data[propNames.damage].replace(/\d+(d\d+)/, '$1');
				} else {
					outputObject[outputNames.outputDamage] = data[propNames.damage];
				}
			} else {
				const damageMatch = data[propNames.damage].match(/^(\d+d\d+)?(?:\s?\+\s?)?(\d+)?$/);
				if (damageMatch) {
					if (damageMatch[1]) {
						outputObject[outputNames.outputDamage] = damageMatch[1];
					}
					if (damageMatch[2]) {
						outputObject[outputNames.outputDamageBonus] = damageMatch[2];
					}
				} else {
					outputObject[outputNames.outputDamage] = data[propNames.damage];
				}
			}
			if (data[propNames.damageType]) {
				outputObject[outputNames.outputDamageType] = data[propNames.damageType].toLocaleLowerCase();
			}

			if (data[propNames.higherLevel]) {
				const parseFunc = data[propNames.higherLevel].includes('.') ? parseFloat : parseInt;
				outputObject[outputNames.outputHigherLevel] = parseFunc(data[propNames.higherLevel]);
			}

			if (data[propNames.castingStat] === 'Yes') {
				outputObject[outputNames.outputCastingStat] = true;
			}
		}
	}

	static processHigherLevel (entriesHigherLevel, newSpell) {
		if (entriesHigherLevel && entriesHigherLevel.length) {
			newSpell.higherLevel = this.fixLinks((entriesHigherLevel[0].entries || entriesHigherLevel).join('\n'));
		}
	}

	static processSpell (spell, additionalSpellData) {
		const newSpell = {
			name: spell.name,
			level: spell.level,
			school: Parser.spSchoolAndSubschoolsAbvsToFull(spell.school, spell.subschools)
		};

		if (spell.meta && spell.meta.ritual) {
			newSpell.ritual = true;
		}

		Object.assign(newSpell, {
			castingTime: Parser.getTimeToFull(spell.time[0]),
			range: Parser.spRangeToFull(spell.range)
		});

		this.processSpellComponents(spell.components, newSpell);
		this.processSpellDuration(spell.duration[0], newSpell);
		this.processSpellEntries(spell.entries, newSpell);
		this.processHigherLevel(spell.entriesHigherLevel, newSpell);
		if (additionalSpellData[spell.name]) {
			this.addExtraSpellData(newSpell, additionalSpellData[spell.name]);
		}

		return newSpell;
	}

	static serialiseFixer (key, value) {
		if (isString(value)) {
			return value
				.replace(/'/g, '’')
				.replace(/([\s(])"(\w)/g, '$1“$2')
				.replace(/([\w,.])"/g, '$1”');
		}

		if (isObject(value)) {
			if (value.recharge) {
				return Object.assign({
					name: value.name,
					recharge: value.recharge
				}, value);
			}
			if (value.cost) {
				if (value.cost === 1) {
					delete value.cost;
				} else {
					return Object.assign({
						name: value.name,
						cost: value.cost
					}, value);
				}
			}
		}

		return value;
	}

	static convertData (inputs) {
		const spellLevels = {};
		const srdMonsters = inputs._srdMonsters;
		const srdSpells = inputs._srdSpells;
		const srdSpellRenames = inputs._srdSpellRenames;
		const additionalSpellData = inputs._additionalSpellData;
		const legendaryGroup = inputs._legendaryGroup;

		const toProcess = Object.values(inputs)
			.filter(input => !input.converted && (isObject(input.monsterInput) || isObject(input.spellInput)) && !input.doNotConvert);

		let monsterList = [];
		Object.values(inputs).forEach(data => {
			if (data.monsterInput) monsterList = monsterList.concat(data.monsterInput);
		});

		toProcess.forEach(data => {
			if (data.monsterInput) {
				// FIXME does this ever do anything?
				if (data.monsterInput.legendaryGroup) {
					data.monsterInput.legendaryGroup.forEach(monsterDetails => legendaryGroup[monsterDetails.name] = monsterDetails);
				}
				data.monsters = data.monsterInput.map(monster => {
					try {
						const converted = this.processMonster(monster, legendaryGroup);
						if (srdMonsters.includes(monster.name)) {
							const pruned = (({name, lairActions, regionalEffects, regionalEffectsFade}) => ({
								name,
								lairActions,
								regionalEffects,
								regionalEffectsFade
							}))(converted);
							if (Object.values(pruned).filter(v => !!v).length > 1) {
								return pruned;
							}
							return null;
						}
						return converted;
					} catch (e) {
						throw new Error('Error with monster ' + monster.name + ' in file ' + data.name + ': ' + e.toString() + e.stack);
					}
				})
					.filter(m => !!m)
					.sort((a, b) => a.name.localeCompare(b.name));
			}

			if (data.spellInput) {
				data.spells = data.spellInput.map(spell => {
					spellLevels[spell.name] = spell.level;
					spell.classes.fromClassList.forEach(clazz => {
						if ((srdSpells.includes(spell.name) || srdSpells.includes(srdSpellRenames[spell.name])) && clazz.source === SRC_PHB) {
							return;
						}
						const nameToAdd = srdSpellRenames[spell.name] || spell.name;
						const sourceObject = clazz.source === SRC_PHB ? data : inputs[clazz.source];
						if (!sourceObject) {
							return;
						}
						sourceObject.classes = sourceObject.classes || {};
						sourceObject.classes[clazz.name] = sourceObject.classes[clazz.name] || {
							archetypes: [],
							spells: []
						};
						sourceObject.classes[clazz.name].spells.push(nameToAdd);
					});

					(spell.classes.fromSubclass || []).forEach(subclass => {
						if ([
							'Life',
							'Devotion',
							'Land',
							'Fiend'
						].includes(subclass.subclass.name)) {
							return;
						}

						if (!inputs[subclass.class.source]) {
							return;
						}

						const sourceObject = subclass.subclass.source === SRC_PHB ? data : inputs[subclass.subclass.source];
						if (!sourceObject) {
							return;
						}
						sourceObject.classes[subclass.class.name] = sourceObject.classes[subclass.class.name] || {
							archetypes: [],
							spells: []
						};
						const archetypeName = subclass.subclass.subSubclass || subclass.subclass.name;
						let archetype = sourceObject.classes[subclass.class.name].archetypes.find(arch => arch.name === archetypeName);
						if (!archetype) {
							archetype = {
								name: archetypeName,
								spells: []
							};
							sourceObject.classes[subclass.class.name].archetypes.push(archetype);
						}
						archetype.spells.push(spell.name);
					});
					if (srdSpells.includes(spell.name)) {
						return null;
					}
					if (srdSpellRenames[spell.name]) {
						return {
							name: srdSpellRenames[spell.name],
							newName: spell.name
						};
					}
					try {
						return this.processSpell(spell, additionalSpellData);
					} catch (e) {
						throw new Error(`Error with spell ${spell.name} in file ${data.name}:${e.toString()}${e.stack}`);
					}
				})
					.filter(s => !!s)
					.sort((a, b) => a.name.localeCompare(b.name));
			}
		});

		const levelThenAlphaComparer = (spellA, spellB) => {
			const levelCompare = spellLevels[spellA] - spellLevels[spellB];
			return levelCompare === 0 ? spellA.localeCompare(spellB) : levelCompare;
		};

		toProcess.forEach(input => {
			input.converted = {
				name: input.name,
				dependencies: input.dependencies,
				version: '2.0.0'
			};
			if (input.classes && !isEmpty(input.classes)) {
				input.converted.classes = Object.keys(input.classes)
					.map(name => {
						const clazz = input.classes[name];
						if (clazz.spells && clazz.spells.length > 0) {
							clazz.spells.sort(levelThenAlphaComparer);
						} else {
							delete clazz.spells;
						}
						if (clazz.archetypes.length === 0) {
							delete clazz.archetypes;
						} else {
							clazz.archetypes.sort((a, b) => a.name.localeCompare(b.name));
							clazz.archetypes.forEach(arch => arch.spells.sort(levelThenAlphaComparer));
						}
						return Object.assign({name}, clazz);
					})
					.sort((a, b) => a.name.localeCompare(b.name));
			}
			if (input.monsters && input.monsters.length > 0) {
				input.converted.monsters = input.monsters;
			}
			if (input.spells && input.spells.length > 0) {
				input.converted.spells = input.spells;
			}
		});
	}

	static flattener (result, item) {
		if (Array.isArray(item)) {
			result.push(...item);
		} else {
			result.push(item);
		}
		return result;
	}

	static objMap (obj, func) {
		return Object.keys(obj).map((key) => {
			return func(obj[key], key, obj);
		})
	}
}

function rebuildShapedSources () {
	shapedConverter.getInputs().then((inputs) => {
		return Object.values(inputs).sort((a, b) => {
			if (a.name === 'Player\'s Handbook') {
				return -1;
			} else if (b.name === 'Player\'s Handbook') {
				return 1;
			}
			return a.name.localeCompare(b.name);
		});
	}).then(inputs => {
		const checkedSources = {};
		checkedSources[SRC_PHB] = true;

		$('.shaped-source').each((i, e) => {
			const $e = $(e);
			if ($e.prop('checked')) {
				checkedSources[$e.val()] = true;
			}
			$e.parent().parent().remove();
		});

		inputs.forEach(input => {
			const disabled = input.key === SRC_PHB ? 'disabled="disabled" ' : '';
			const checked = checkedSources[input.key] ? 'checked="checked" ' : '';
			$('#sourceList').append($(`<li><label class="shaped-label"><input class="shaped-source" type="checkbox" ${disabled}${checked} value="${input.key}"><span>${input.name}</span></label></li>`));
		});
	}).catch(e => {
		alert(`${e}\n${e.stack}`);
		setTimeout(() => { throw e; });
	});
}

window.onload = function load () {
	ExcludeUtil.pInitialise(); // don't await, as this is only used for search

	window.handleBrew = data => {
		shapedConverter.getInputs()
			.then(inputs => {
				shapedConverter.addBrewData(inputs, data);
				rebuildShapedSources();
			})
			.catch(e => {
				alert(`${e}\n${e.stack}`);
				setTimeout(() => {
					throw e;
				}, 0);
			});
	};

	window.removeBrewSource = source => {
		shapedConverter.getInputs().then(inputs => {
			delete inputs[source];
			rebuildShapedSources();
		});
	};

	window.shapedConverter = new ShapedConverter();
	rebuildShapedSources();

	BrewUtil.makeBrewButton("manage-brew");

	const $btnSaveFile = $(`<button class="btn btn-primary">Prepare JS</button>`);
	$(`#buttons`).append($btnSaveFile);
	$btnSaveFile.on('click', () => {
		const keys = $('.shaped-source:checked').map((i, e) => {
			return e.value;
		}).get();
		shapedConverter.generateShapedJS(keys)
			.then(js => {
				$('#shapedJS').val(js);
				$('#copyJS').removeAttr('disabled');
			})
			.catch(e => {
				alert(`${e}\n${e.stack}`);
				setTimeout(() => {
					throw e;
				}, 0);
			});
	});
	$('#copyJS').on('click', () => {
		const shapedJS = $('#shapedJS');
		shapedJS.select();
		document.execCommand('Copy');
		JqueryUtil.showCopiedEffect($('#copyJS'));
	});
	$(`#selectAll`).change(function () {
		$(`.shaped-source:not([disabled])`).prop("checked", $(this).prop("checked"));
	})
};
