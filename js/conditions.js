"use strict";
const JSON_URL = "data/conditions.json";
const entryRenderer = new EntryRenderer();
let tableDefault;
let conditionList;

window.onload = function load () {
	DataUtil.loadJSON(JSON_URL, onJsonLoad);
};

function onJsonLoad (data) {
	conditionList = data.condition;

	tableDefault = $("#pagecontent").html();

	let tempString = "";
	for (let i = 0; i < conditionList.length; i++) {
		const name = conditionList[i].name;
		tempString += `
			<li>
				<a id='${i}' href='#${UrlUtil.autoEncodeHash(conditionList[i])}' title='${name}'>
					<span class='name' title='${name}'>${name}</span>
				</a>
			</li>`;
	}
	$("ul.conditions").append(tempString);

	const list = ListUtil.search({
		valueNames: ['name'],
		listClass: "conditions"
	});

	initHistory()
}

function loadhash (id) {
	$("#pagecontent").html(tableDefault);
	const curcondition = conditionList[id];
	$("th.name").html(curcondition.name);
	$("tr.text").remove();
	const entryList = {type: "entries", entries: curcondition.entries};
	const textStack = [];
	entryRenderer.recursiveEntryRender(entryList, textStack);
	$("tr#text").after("<tr class='text'><td colspan='6'>" + textStack.join("") + "</td></tr>");
}
