## 5e.tools

[![Build Status](https://ci.develop.5etools.com/api/badges/5eTools/5etoolsR20/status.svg)](https://ci.develop.5etools.com/5eTools/5etoolsR20)

Visit the [main site](https://5e.tools/5etools.html) or go to the unofficial GitHub [mirror](5etools.html).

[Join the 5etools Discord here!](https://discord.gg/AzyBjtQ)

## Running 5etools Locally (Offline Copy)
There are several options for running a local/offline copy of 5etools, including:

**Beginner:** Use Firefox to open the files.

**Intermediate:** When using Chrome (or similar), a command-line switch is required to load some pages locally. On Windows, this can be accomplished by creating a Chrome shortcut and editing the properties of the shortcut to add `--allow-file-access-from-files` to the shortcut `Target`:

![Chrome tutorial](https://raw.githubusercontent.com/TheGiddyLimit/TheGiddyLimit.github.io/master/chrome-tutorial.png "Chrome tutorial")

Be sure to close any running Chrome instances (and kill any remaining Chrome processes as required) before opening the shortcut. A summary of the security implications can be found [here](https://superuser.com/a/873527).
 
**Advanced:** Host the project locally on a dev webserver, perhaps using [this](https://github.com/cortesi/devd).

## How to import 5etools creatures/spells/items into Roll20
1. Get Greasemonkey (Firefox) or Tampermonkey (Chrome).

2. Click [here](https://get.5e.tools/script/betteR20-5etools.user.js) and install the script.

3. Open the Roll20 game where you want the stuff imported.

4. Go to the gear icon and click on the things you want imported.

5. Let it run. The journal will start fill up with the stuff you selected. It's not too laggy but can take a long time depending on the amount of stuff you selected.

6. Bam. Done. If you are using the Shaped sheet, be sure to open up the NPC sheets and let them convert before using it.

You can convert stat blocks to JSON for importing via [this converter](converter.html).

## Dev Notes
### Target JavaScript Version
Targeting ES6 was the original intent, but more modern features have long since crept into the code. Therefore, if something is available as standard in both Chrome and Firefox (preferably in versions dating back at least a couple of months), and isn't bleeding-edge, one can reasonable justify using it. As with all things, use common sense.

### Style Guidelines
#### Code
- Use tabs over spaces.

#### CSS
- The [BEM](http://getbem.com/) ("Block Element Modifier") naming strategy should be used where possible.

#### Data/Text
- When "tagging" references in data (e.g. `{@creature goblin}`), the following rules apply:
	- Only tag references which are _intended as references_. For example, the Wizard class in `You gain one cantrip of your choice from the wizard spell list` should be tagged, whereas the Wizard class in `Together, a group of seven powerful wizards sought to contain the demon` should not be tagged. One is a reference to the mechanical class, one is merely the casual usage of the word "wizard." 
	- In a similar vein, never tag anything within a `quote`-type block. Even if the quote directly refers to a specific creature, we can assume the quote is from a universe/perspective in which (for example) statblocks don't exist, and therefore the tag should be omitted to maintain the flavour of the quote.
	- Within data from a source, avoid referencing content from a source printed after the publication of that source. For example, MTF content might reference SCAG deities, but SCAG deities should refrain from referencing MTF content.
	- Use `@skill` tags sparingly. Only tag "loose" skill references, those without specific use or reference in the surrounding text. For example, `You have proficiency in the Perception skill` should be tagged, as the generalised text provided in the tooltip is a useful addition. `You have advantage on Dexterity (Stealth) checks made to hide in rocky environments`, however, should not be tagged, as the text already specifies exactly what the skill means in this case: your ability to hide in rocky environments. Likewise, `You have advantage on any Strength (Athletics) or Dexterity (Acrobatics) check you make to escape from being grappled` should not be tagged, as a specific use of the skill is already well defined in the text.

### JSON Cleaning
#### Trailing commas
To remove trailing commas in JSON:

Find: `(.*?)(,)(:?\s*]|\s*})`

Replace: `$1$3`

#### Character replacement
- `’` should be replaced with `'`
- `“` and `”` should be replaced with `"`
- `—` (em dash) should be replaced with `\u2014` (Unicode for em dash)
- `–` should be replaced with `\u2013` (Unicode for en dash)
- `−` should be replaced with `\u2212` (Unicode for minus sign)
- `•` should be not be used unless the JSON in question is not yet covered by the entryRenderer, i.e. should be encoded as a list
- the only Unicode escape sequences allowed are `\u2014`, `\u2013`, and `\u2212`; all other characters (unless noted above) should be stored as-is

#### Convention for dashes
- `-` (hyphen) should **only** be used to hyphenate words, e.g. `60-foot` and `18th-level`
- `\u2014` should be used for parenthetical dash pairs, or for marking empty table rows.
- `\u2013` should be used for joining numerical ranges, e.g. `1-5` should become `1\u20135`. 
- `\u2212` should be used for unary minus signs, in the case of penalties. For example, `"You have a -5 penalty to..."` should become `"You have a \u22125 penalty to..."`. 
- any whitespace on any side of a `\u2014` should be removed

#### Convention for measurement
- Adjectives: a hyphen and the full name of the unit of measure should be used, e.g. dragon exhales acid in a `60-foot line`
- Nouns: a space and the short name of the unit of measure (including the trailing period) should be used, e.g. `blindsight 60 ft.`, `darkvision 120 ft.`
- Time: a slash, `/`, with no spaces on either side followed by the capitalised unit of time, e.g. `2/Turn`, `3/Day`

##### Convention for Dice
Dice should be written as `[X]dY[ <+|-|×> Z]`, i.e. with a space between dice and operator, and a space between operator and modifier. Some examples of acceptable formatting are: `d6`, `2d6`, or `2d6 + 1`.

##### Misc

- A handy dice regex: `([1-9]\d*)?d([1-9]\d*)(\s?([+-])\s?(\d+))?` (and to output as tagged dice in the basic case: `{@dice $0}`). Warning: does not detect already-tagged dice expressions; be wary of double-tagging.

### Dev Server

Do `npm run dev-server` to launch a local dev server that serves the project files on [`http://localhost:8080/5etools.html`](http://localhost:8080/5etools.html).

The server automatically refreshes the page for you whenever one of the project files (html, css, js, images) changes.

### Version bump

Do `npm run version-bump -- [OPTION]`, where `[OPTION]` is one of the following:

- `major` to increment the major version (`1.2.3` will become `2.0.0`)
- `minor` to increment the minor version (`1.2.3` will become `1.3.0`)
- `patch` to increment the patch version (`1.2.3` will become `1.2.4`)
- a version number (like `1.2.3`)

It will first run the tests and fail to increase the version if the tests fail.  
It will then automatically replace the version in the files where it needs to be replaced, create a commit with the message `chore(version): bump` and create a tag (in the form `v1.2.3`) at the commit.  
This feature can be easily disabled by doing `npm config set git-tag-version false`. 

## License

This project is licensed under the terms of the MIT license.