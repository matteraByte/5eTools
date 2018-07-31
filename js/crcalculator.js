"use strict";
const MSBCR_JSON_URL = "data/msbcr.json";
const MONSTERFEATURES_JSON_URL = "data/monsterfeatures.json";
let msbcr;
let monsterfeatures;

window.onload = function load () {
	DataUtil.loadJSON(MSBCR_JSON_URL).then(addMSBCR);
};

function addMSBCR (crData) {
	msbcr = crData;
	DataUtil.loadJSON(MONSTERFEATURES_JSON_URL).then(addMonsterFeatures);
}

function addMonsterFeatures (mfData) {
	monsterfeatures = mfData.monsterfeatures;
	for (let i = 0; i < msbcr.cr.length; i++) {
		const curcr = msbcr.cr[i];
		$("#msbcr").append(`<tr><td>${curcr._cr}</td><td>${Parser.crToXp(curcr._cr)}</td><td>${curcr.pb}</td><td>${curcr.ac}</td><td>${curcr.hpmin}-${curcr.hpmax}</td><td>${curcr.attackbonus}</td><td>${curcr.dprmin}-${curcr.dprmax}</td><td>${curcr.savedc}</td></tr>`)
	}

	$("input#calculate").click(function () {
		calculatecr();
	});

	$("#crcalc input").change(function () {
		calculatecr();
	});

	$("#saveprofs, #resistances").change(function () {
		calculatecr();
	});

	$("#saveinstead").change(function () {
		const curval = parseInt($("#attackbonus").val());
		if (!$(this).is(":checked")) $("#attackbonus").val(curval - 10);
		if ($(this).is(":checked")) $("#attackbonus").val(curval + 10);
		calculatecr();
	});

	$("select#size").change(function () {
		const newsize = $(this).val();
		if (newsize === "Tiny") $("#hdval").html("d4");
		if (newsize === "Small") $("#hdval").html("d6");
		if (newsize === "Medium") $("#hdval").html("d8");
		if (newsize === "Large") $("#hdval").html("d10");
		if (newsize === "Huge") $("#hdval").html("d12");
		if (newsize === "Gargantuan") $("#hdval").html("d20");
		$("#hp").val(calculatehp());
		calculatecr();
	});

	$("#hd, #con").change(function () {
		$("#hp").val(calculatehp());
		calculatecr();
	});

	$("#msbcr tr").not(":has(th)").click(function () {
		$("#expectedcr").val($(this).children("td:eq(0)").html());
		const minhp = parseInt($(this).children("td:eq(4)").html().split("-")[0]);
		const maxhp = parseInt($(this).children("td:eq(4)").html().split("-")[1]);
		$("#hp").val(minhp + (maxhp - minhp) / 2);
		$("#hd").val(calculatehd());
		$("#ac").val($(this).children("td:eq(3)").html());
		$("#dpr").val($(this).children("td:eq(6)").html().split("-")[0]);
		$("#attackbonus").val($(this).children("td:eq(5)").html());
		if ($("#saveinstead").is(":checked")) $("#attackbonus").val($(this).children("td:eq(7)").html());
		calculatecr();
	});

	$("#hp").change(function () {
		$("#hd").val(calculatehd());
		calculatecr();
	});

	// parse monsterfeatures
	for (let i = 0; i < monsterfeatures.length; i++) {
		let effectoncr = [];
		if (monsterfeatures[i].hp) effectoncr.push("HP: " + monsterfeatures[i].hp);
		if (monsterfeatures[i].ac) effectoncr.push("AC: " + monsterfeatures[i].ac);
		if (monsterfeatures[i].dpr) effectoncr.push("DPR: " + monsterfeatures[i].dpr);
		if (monsterfeatures[i].attackbonus) effectoncr.push("AB: " + monsterfeatures[i].attackbonus);
		effectoncr = effectoncr.join(", ");
		let numbox = "";
		if (monsterfeatures[i].numbox === true) numbox = "<input type='number' value='0'>";
		$("#monsterfeatures table").append(`<tr><td style="white-space: nowrap"><input type='checkbox' id='MF${encodeURI(monsterfeatures[i].name).toLowerCase()}' title="${monsterfeatures[i].name}" data-hp='${monsterfeatures[i].hp}' data-ac='${monsterfeatures[i].ac}' data-dpr='${monsterfeatures[i].dpr}' data-attackbonus='${monsterfeatures[i].attackbonus}'>${numbox}</td><td>${monsterfeatures[i].name}</td><td>${monsterfeatures[i].example.replace(/, /g, ",<br />")}</td><td><span title="${effectoncr}" class="explanation">${monsterfeatures[i].effect}</span></td></tr>`);
	}

	// parse url
	function parseurl () {
		if (window.location.hash) {
			let curdata = window.location.hash.split("#")[1].split(",");
			$("#expectedcr").val(curdata[0]);
			$("#hp").val(curdata[1]);
			$("#hp").val(calculatehp());
			$("#ac").val(curdata[2]);
			$("#dpr").val(curdata[3]);
			$("#attackbonus").val(curdata[4]);
			if (curdata[5] === "true") $("#saveinstead").attr("checked", true);
			$("#size").val(curdata[6]);
			$("select#size").change();
			$("#hd").val(curdata[7]);
			$("#con").val(curdata[8]);
			$("#hp").val(calculatehp());
			if (curdata[9] === "true") $("#vulnerabilities").attr("checked", true);
			$("#resistances").val(curdata[10]);
			if (curdata[11] === "true") $("#flying").attr("checked", true);
			$("#saveprofs").val(curdata[12]);

			if (window.location.hash.indexOf("traits:") !== -1) {
				curdata = window.location.hash.split("traits:")[1].split(",");
				for (let i = 1; i < curdata.length; i++) {
					$("input[id='" + curdata[i].split(":")[0] + "']").click();
					if (curdata[i].split(":")[1]) $("input[id='" + curdata[i].split(":")[0] + "']").siblings("input[type=number]").val(curdata[i].split(":")[1])
				}
			}
			calculatecr();
		}
	}

	// Monster Features table
	$("#monsterfeatures tr td").not(":has(input)").click(function () {
		$(this).siblings().children("input").click();

		const curfeature = $(this).siblings("td").children("input").attr("id");
		let curnumber = "";
		if ($(this).siblings("td").children("input[type=number]").length) curnumber = ":" + $(this).siblings("td").children("input[type=number]").val();
		window.location = window.location.hash + "," + curfeature + curnumber;

		if ($(this).siblings("td").children("input").prop("checked")) return;

		window.location = window.location.hash.split("," + curfeature + curnumber).join("");
		window.location = window.location.hash.split("," + curfeature + ":0").join("");
		window.location = window.location.hash.split("," + curfeature).join("");
	});

	$("#monsterfeatures tr td input").change(function () {
		calculatecr();
	});

	$("#reset").click(function () {
		window.location = "";
		parseurl();
	});

	parseurl();
	calculatecr();
}

function calculatecr () {
	const expectedcr = parseInt($("#expectedcr").val());

	let hp = parseInt($("#crcalc #hp").val());

	if ($("#vulnerabilities").prop("checked")) hp *= 0.5;
	if ($("#resistances").val() === "res") {
		if (expectedcr >= 0 && expectedcr <= 4) hp *= 2;
		if (expectedcr >= 5 && expectedcr <= 10) hp *= 1.5;
		if (expectedcr >= 11 && expectedcr <= 16) hp *= 1.25;
	}
	if ($("#resistances").val() === "imm") {
		if (expectedcr >= 0 && expectedcr <= 4) hp *= 2;
		if (expectedcr >= 5 && expectedcr <= 10) hp *= 2;
		if (expectedcr >= 11 && expectedcr <= 16) hp *= 1.5;
		if (expectedcr >= 17) hp *= 1.25;
	}

	let ac = parseInt($("#crcalc #ac").val()) + parseInt($("#saveprofs").val()) + parseInt($("#flying").prop("checked") * 2);
	let dpr = parseInt($("#crcalc #dpr").val());

	let attackbonus = parseInt($("#crcalc #attackbonus").val());
	const usesavedc = $("#saveinstead").prop("checked");

	let offensiveCR = -1;
	let defensiveCR = -1;

	// go through monster features
	$("#monsterfeatures input:checked").each(function () {
		let trait = 0;
		if ($(this).siblings("input[type=number]").length) trait = $(this).siblings("input[type=number]").val();
		/* eslint-disable */
		if ($(this).attr("data-hp") !== "") hp += Number(eval($(this).attr("data-hp")));
		if ($(this).attr("data-ac") !== "") ac += Number(eval($(this).attr("data-ac")));
		if ($(this).attr("data-dpr") !== "") dpr += Number(eval($(this).attr("data-dpr")));
		/* eslint-enable */
		if (!usesavedc && $(this).attr("data-attackbonus") !== "") attackbonus += Number($(this).attr("data-attackbonus"));
	});

	hp = Math.floor(hp);
	dpr = Math.floor(dpr);

	const effectivehp = hp;
	const effectivedpr = dpr;

	// make sure you don't break the CR
	if (hp > 850) hp = 850;
	if (dpr > 320) dpr = 320;

	for (let i = 0; i < msbcr.cr.length; i++) {
		const curcr = msbcr.cr[i];
		if (hp >= parseInt(curcr.hpmin) && hp <= parseInt(curcr.hpmax)) {
			let defensedifference = parseInt(curcr.ac) - ac;
			if (defensedifference > 0) defensedifference = Math.floor(defensedifference / 2);
			if (defensedifference < 0) defensedifference = Math.ceil(defensedifference / 2);
			defensedifference = i - defensedifference;
			if (defensedifference < 0) defensedifference = 0;
			if (defensedifference >= msbcr.cr.length) defensedifference = msbcr.cr.length - 1;
			defensiveCR = msbcr.cr[defensedifference]._cr;
		}
		if (dpr >= curcr.dprmin && dpr <= curcr.dprmax) {
			let adjuster = parseInt(curcr.attackbonus);
			if (usesavedc) adjuster = parseInt(curcr.savedc);
			let attackdifference = adjuster - attackbonus;
			if (attackdifference > 0) attackdifference = Math.floor(attackdifference / 2);
			if (attackdifference < 0) attackdifference = Math.ceil(attackdifference / 2);
			attackdifference = i - attackdifference;
			if (attackdifference < 0) attackdifference = 0;
			if (attackdifference >= msbcr.cr.length) attackdifference = msbcr.cr.length - 1;
			offensiveCR = msbcr.cr[attackdifference]._cr;
		}
	}

	if (offensiveCR === -1) offensiveCR = "0";
	if (defensiveCR === -1) defensiveCR = "0";
	let cr = ((fractionStrToDecimal(offensiveCR) + fractionStrToDecimal(defensiveCR)) / 2).toString();

	if (cr === "0.5625") cr = "1/2";
	if (cr === "0.5") cr = "1/2";
	if (cr === "0.375") cr = "1/4";
	if (cr === "0.3125") cr = "1/4";
	if (cr === "0.25") cr = "1/4";
	if (cr === "0.1875") cr = "1/8";
	if (cr === "0.125") cr = "1/8";
	if (cr === "0.0625") cr = "1/8";
	if (cr.indexOf(".") !== -1) cr = Math.round(cr).toString();

	let finalcr = 0;
	for (let i = 0; i < msbcr.cr.length; i++) {
		if (msbcr.cr[i]._cr === cr) {
			finalcr = i;
			break;
		}
	}

	const hitdice = calculatehd();
	const hitdicesize = $("#hdval").html();
	const conmod = Math.floor(($("#con").val() - 10) / 2);
	let hash = "#";
	hash += $("#expectedcr").val() + ","; // 0
	hash += $("#hp").val() + ","; // 1
	hash += $("#ac").val() + ","; // 2
	hash += $("#dpr").val() + ","; // 3
	hash += $("#attackbonus").val() + ","; // 4
	hash += usesavedc + ","; // 5
	hash += $("#size").val() + ","; // 6
	hash += $("#hd").val() + ","; // 7
	hash += $("#con").val() + ","; // 8
	hash += $("#vulnerabilities").prop("checked") + ","; // 9
	hash += $("#resistances").val() + ","; // 10
	hash += $("#flying").prop("checked") + ","; // 11
	hash += $("#saveprofs").val() + ","; // 12
	hash += "traits:";
	const hastraits = window.location.hash.split("traits:")[1];
	if (hastraits !== "undefined") hash += hastraits;

	window.location = hash;

	$("#croutput").html("<h4>Challenge Rating: " + cr + "</h4>");
	$("#croutput").append("<p>Offensive CR: " + offensiveCR + "</p>");
	$("#croutput").append("<p>Defensive CR: " + defensiveCR + "</p>");
	$("#croutput").append("<p>Proficiency Bonus: +" + msbcr.cr[finalcr].pb + "</p>");
	$("#croutput").append("<p>Effective HP: " + effectivehp + " (" + hitdice + hitdicesize + (conmod < 0 ? "" : "+") + conmod * hitdice + ")</p>");
	$("#croutput").append("<p>Effective AC: " + ac + "</p>");
	$("#croutput").append("<p>Average Damage Per Round: " + effectivedpr + "</p>");
	$("#croutput").append("<p>" + (usesavedc ? "Save DC: " : "Effective Attack Bonus: +") + attackbonus + "</p>");
	$("#croutput").append("<p>Experience Points: " + Parser.crToXp(msbcr.cr[finalcr]._cr) + "</p>");
}

function calculatehd () {
	const avghp = $("#hdval").html().split("d")[1] / 2 + 0.5;
	const conmod = Math.floor(($("#con").val() - 10) / 2);
	let curhd = Math.floor(parseInt($("#hp").val()) / (avghp + conmod));
	if (!curhd) curhd = 1;
	return curhd;
}

function calculatehp () {
	const avghp = $("#hdval").html().split("d")[1] / 2 + 0.5;
	const conmod = Math.floor(($("#con").val() - 10) / 2);
	return Math.round((avghp + conmod) * $("#hd").val());
}

function fractionStrToDecimal (str) {
	return str === "0" ? 0 : parseFloat(str.split('/').reduce((numerator, denominator) => numerator / denominator));
}