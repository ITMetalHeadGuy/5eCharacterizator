// ==========================================
// 1. GLOBAL STATE MANAGEMENT
// ==========================================
const AppState = {
    // Caches the heavy JSON data so we never fetch twice
    db: {
        races: null,
        classes: null
    },
    // Tracks the user's current selections as they move through the SPA
    character: {
        name: "Nameless Hero",
        raceIndex: null,
        classIndex: null,
        subclass: null,
        level: 1,
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    }
};

// ==========================================
// 2. THE SPA ROUTER (Navigation Logic)
// ==========================================
function initRouter() {
    // Listen for the URL hash changing (e.g., clicking "Next" changes URL to #class)
    window.addEventListener('hashchange', handleRoute);
    
    // Force a route evaluation on initial page load
    if (!window.location.hash) {
        window.location.hash = '#race'; // Default to the first step
    } else {
        handleRoute();
    }
}

function handleRoute() {
    const hash = window.location.hash; // e.g., "#class"
    
    // 1. Hide all views and deactivate all nav buttons
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // 2. Find the target view based on the hash
    const targetNavBtn = document.querySelector(`.nav-btn[href="${hash}"]`);
    if (targetNavBtn) {
        targetNavBtn.classList.add('active');
        const targetViewId = targetNavBtn.getAttribute('data-target');
        document.getElementById(targetViewId).classList.add('active');
    }
    
    // 3. Trigger specific logic based on the screen we just loaded
    if (hash === '#sheet') {
        compileFinalCharacter();
    }
}

// ==========================================
// 3. DATA INITIALIZATION (5etools)
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    initRouter();
    await load5eToolsData();
    setupEventListeners();
});

async function load5eToolsData() {
    try {
        // Fetch BOTH 5etools files locally at startup
        const [racesRes, classRes] = await Promise.all([
            fetch('./data/races.json'),
            fetch('./data/classes.json')
        ]);
        
        if (!racesRes.ok || !classRes.ok) throw new Error("Could not find data files.");

        AppState.db.races = await racesRes.json();
        AppState.db.classes = await classRes.json();
        
        populateDropdowns();
        
        // ADD THIS LINE HERE:
        renderRollGroups(); 

    } catch (error) {
        console.error("Data Load Error:", error);
    }
}


function populateDropdowns() {
    const raceSelect = document.getElementById('raceSelect');
    const classSelect = document.getElementById('classSelect');
    
    raceSelect.innerHTML = '<option value="">-- Choose a Race --</option>';
    classSelect.innerHTML = '<option value="">-- Choose a Class --</option>';

    // Populate Races (Filtering for Player's Handbook for cleanliness)
    AppState.db.races.race.forEach((r, index) => {
            raceSelect.add(new Option(r.name, index));

    });

    // Populate Classes
    AppState.db.classes.class.forEach((c, index) => {
            classSelect.add(new Option(c.name, index));
    });
}

// ==========================================
// 4. EVENT LISTENERS & UI UPDATES
// ==========================================
function setupEventListeners() {
    // Save selections to Global State when changed
    const raceDetail = document.getElementById('raceDetails');
    document.getElementById('raceSelect').addEventListener('change', (e) => {
        AppState.character.raceIndex = e.target.value;
        const races = AppState.db.races.race
        raceDetail.innerHTML = races[AppState.character.raceIndex].toString()

        // You can add logic here to update the 'raceDetails' div with lore!
    });

    document.getElementById('classSelect').addEventListener('change', (e) => {
        const classIndex = e.target.value;
        AppState.character.classIndex = classIndex;
        
        const subclassSelect = document.getElementById('subclassSelect');
        const optionsContainer = document.getElementById('classOptionsContainer');
        
        if (classIndex === "") {
            optionsContainer.style.display = 'none';
            return;
        }

        const selectedClass = AppState.db.classes.class[classIndex];
        subclassSelect.innerHTML = '<option value="">-- No Subclass / Base Class --</option>';

        if (selectedClass.subclasses && Array.isArray(selectedClass.subclasses)) {
            selectedClass.subclasses.forEach(sub => {
                subclassSelect.add(new Option(sub.name, sub.name));
            });
        }
        optionsContainer.style.display = 'block';
    });

    document.getElementById('subclassSelect').addEventListener('change', (e) => {
        AppState.character.subclass = e.target.value;
    });

    // Attach PDF Export
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
}

// ==========================================
// 4.5 DICE ROLLER LOGIC
// ==========================================
let rollGroups = [[null, null, null, null, null, null]];
const abilities = ["str", "dex", "con", "int", "wis", "cha"];

function renderRollGroups() {
    const container = document.getElementById('allRollGroups');
    if (!container) return; 
    container.innerHTML = '';
    
    rollGroups.forEach((group, gIndex) => {
        let gridHtml = `<div class="roll-slots-grid" style="padding: 20px;">`;
        for(let i = 0; i < 6; i++) {
            let displayValue = group[i] !== null ? group[i] : '--';
            let disabledState = group[i] !== null ? 'disabled' : '';
            gridHtml += `
                <div class="roll-slot">
                    <div class="result-display" style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${displayValue}</div>
                    <button class="btn-roll" style="width: 100%; padding: 10px; background: #8ab868; color: white; border: none; border-radius: 4px; cursor: pointer;" ${disabledState} onclick="rollSingleSlot(${gIndex}, ${i})">ROLL</button>
                </div>`;
        }
        gridHtml += `</div>`;
        
        let isComplete = group.every(val => val !== null);
        let applyBg = isComplete ? '#4caf50' : '#e0e0e0';
        let applyColor = isComplete ? 'white' : '#888';
        
        let actionsHtml = `
        <div class="group-actions" style="display: flex; justify-content: flex-end; gap: 10px; padding: 0 20px 20px 20px;">
            <button onclick="addRollGroup()" style="background: #2196F3; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">+ ADD ROW</button>
            <button onclick="resetRollGroup(${gIndex})" style="background: #f0f0f0; color: #666; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">RESET</button>
            <button onclick="applyAbilityScores(${gIndex})" style="background: ${applyBg}; color: ${applyColor}; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">APPLY SCORES</button>
        </div>`;
        
        let rowHtml = `<div class="roll-group-row" style="background: #fafafa; border: 1px solid #eee; margin-bottom: 20px; border-radius: 8px;">${gridHtml}${actionsHtml}</div>`;
        container.innerHTML += rowHtml;
    });
}

function addRollGroup() { 
    rollGroups.push([null, null, null, null, null, null]); 
    renderRollGroups(); 
}

function rollSingleSlot(groupIndex, slotIndex) {
    let rolls = Array.from({length: 4}, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    rolls.pop(); // Drop the lowest
    rollGroups[groupIndex][slotIndex] = rolls.reduce((sum, val) => sum + val, 0);
    renderRollGroups();
}

function resetRollGroup(groupIndex) { 
    rollGroups[groupIndex] = [null, null, null, null, null, null]; 
    renderRollGroups(); 
}

function applyAbilityScores(groupIndex) {
    if(rollGroups[groupIndex].includes(null)) {
        return alert("Roll all 6 slots in this group first!");
    }
    // Update the input boxes
    abilities.forEach((stat, index) => { 
        document.getElementById(`input-${stat}`).value = rollGroups[groupIndex][index]; 
        // Save it directly to our SPA state manager!
        AppState.character.abilityScores[stat] = rollGroups[groupIndex][index];
    });
    alert("Scores applied!");
}

// ==========================================
// 5. COMPILER (Runs when entering the Final Sheet view)
// ==========================================
function compileFinalCharacter() {
    // Failsafe: Send them back if they skipped the first steps
    if (AppState.character.raceIndex === null || AppState.character.classIndex === null) {
        alert("Please select a Race and Class before generating the sheet.");
        window.location.hash = '#race';
        return;
    }

    const rawRace = AppState.db.races.race[AppState.character.raceIndex];
    const rawClass = AppState.db.classes.class[AppState.character.classIndex];
    const selectedLevel = AppState.character.level;

    // 1. Parse Race Data
    let raceAsi = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    let raceTraits = [];
    if (rawRace.ability && rawRace.ability.length > 0) {
        const baseBonuses = rawRace.ability[0];
        abilities.forEach(stat => { if (baseBonuses[stat]) raceAsi[stat] = baseBonuses[stat]; });
    }
    if (rawRace.entries) {
        rawRace.entries.forEach(entry => { if (entry.name) raceTraits.push(entry.name); });
    }

    // 2. Parse Class Data
    let hitDie = rawClass.hd ? rawClass.hd.faces : 8;
    let classFeatures = [];
    if (AppState.db.classes.classFeature) {
        AppState.db.classes.classFeature.forEach(feature => {
            if (feature.className === rawClass.name && feature.level === 1) {
                classFeatures.push(feature.name);
            }
        });
    }

    // 3. Do the Math
    let finalStats = {};
    let modifiers = {};
    abilities.forEach(stat => {
        let finalScore = AppState.character.abilityScores[stat] + (raceAsi[stat] || 0);
        finalStats[stat] = finalScore;
        modifiers[stat] = Math.floor((finalScore - 10) / 2);
    });

    let pb = Math.ceil(selectedLevel / 4) + 1;
    let totalHP = hitDie + modifiers['con']; // Level 1 calculation
    if (selectedLevel > 1) {
        const fixedAverageGain = Math.floor(hitDie / 2) + 1;
        totalHP += (selectedLevel - 1) * (fixedAverageGain + modifiers['con']);
    }
    totalHP = Math.max(totalHP, selectedLevel); // Minimum 1 HP per level

    // 4. Update the HTML View
    document.getElementById('charName').textContent = AppState.character.name;
    
    const subclassName = AppState.character.subclass ? ` (${AppState.character.subclass})` : "";
    const classDisplayString = `${rawClass.name}${subclassName} ${selectedLevel}`;
    
    document.getElementById('charRace').textContent = rawRace.name;
    document.getElementById('charClass').textContent = classDisplayString;

    const combinedTraits = [...raceTraits, ...classFeatures];

    // 5. Save to the Global Export Object
    exportedCharacterData = {
        name: AppState.character.name,
        race: rawRace.name,
        classAndLevel: classDisplayString,
        hp: totalHP.toString(),
        hitDice: `${selectedLevel}d${hitDie}`,
        profBonus: `+${pb}`,
        stats: finalStats,
        modifiers: modifiers,
        featuresAndTraits: combinedTraits 
    };
}

// ==========================================
// 6. PDF EXPORT LOGIC
// ==========================================
async function exportToPDF() {
    if (!exportedCharacterData) return alert("Please generate the character sheet first!");
    
    let existingPdfBytes;
    try {
        existingPdfBytes = await fetch('./5e_template.pdf').then(res => res.arrayBuffer());
    } catch (err) {
        return alert("Could not find '5e_template.pdf'. Make sure it is in the same folder as your index.html file.");
    }

    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    // Map Header Data
    try { form.getTextField('CharacterName').setText(exportedCharacterData.name); } catch(e) {}
    try { form.getTextField('ClassLevel').setText(exportedCharacterData.classAndLevel); } catch(e) {}
    try { form.getTextField('Race ').setText(exportedCharacterData.race); } catch(e) {}
    try { form.getTextField('ProfBonus').setText(exportedCharacterData.profBonus); } catch(e) {}
    try { form.getTextField('HPMax').setText(exportedCharacterData.hp); } catch(e) {}
    try { form.getTextField('HDTotal').setText(exportedCharacterData.hitDice); } catch(e) {}
    
    // Map Traits
    try { 
        const featuresField = form.getTextField('Features and Traits');
        featuresField.setFontSize(9); 
        
        // Summarize traits (ensure summarizeForPDF function is available in your app.js)
        let summarized = exportedCharacterData.featuresAndTraits.map(t => `• ${t}`).join('\n\n');
        if (summarized.length > 800) {
            summarized = summarized.substring(0, 770);
            summarized = summarized.substring(0, summarized.lastIndexOf(' ')) + "...\n(See rules)";
        }
        featuresField.setText(summarized);
    } catch(e) {}

    // Map Ability Scores and Modifiers (Bypassing WotC Typos)
    const pdfStatNames = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
    abilities.forEach(stat => {
        const score = exportedCharacterData.stats[stat].toString();
        const mod = exportedCharacterData.modifiers[stat];
        const modString = mod >= 0 ? `+${mod}` : `${mod}`;

        try { form.getTextField(pdfStatNames[stat]).setText(score); } catch(e) {}
        try {
            if (stat === 'dex') form.getTextField('DEXmod ').setText(modString);
            else if (stat === 'cha') form.getTextField('CHamod').setText(modString);
            else form.getTextField(`${pdfStatNames[stat]}mod`).setText(modString);
        } catch(e) {}
    });

    // Trigger File Download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${exportedCharacterData.name.replace(' ', '_')}_Sheet.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}