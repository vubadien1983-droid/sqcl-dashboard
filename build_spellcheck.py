import json
import re

# Load sqcl_data
with open('sqcl_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

vocab = set()
for unit, udata in data.get('units', {}).items():
    for act in udata.get('activities', []):
        for k in ['description', 'ref_doc', 'procedure', 'acceptance', 'check_type', 'note', 'pic_pmc', 'pic_pq', 'status', 'discipline', 'remarks_raw', 'site_markup', 'status_update']:
            v = act.get(k)
            if v:
                for w in re.findall(r'[A-Za-z]{2,}', str(v)):
                    vocab.add(w.lower())

base_english = """
the of and to in is you that it he was for on are as with his they i at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who oil its now find long down day did get come made may part over new sound take only little work know place year live me back give most very after thing our just name sentence man think say great where much through mean before line right too mean old any same tell boy follow came want show also around form three small set put end does another well large must big even such because turn here why ask went men read need land different home us move try kind hand picture again change off play spell air away animal house point page letter mother answer found study still learn should america world high every near add food between own below country plant last school father keep tree never start city earth eye light thought head under story saw left don't few while along might close something seem next hard open example begin life always those both paper together got group often run important until children side feet car mile night walk white sea began grow took river four carry state once book hear stop without second late miss idea enough eat face watch far real almost let above girl sometimes mountain cut young talk soon list song being leave family direct pose leave body music color questions problem complete ship area half rock order fire south problem piece told knew pass since top whole king space heard best hour better true during hundred five remember step early hold west ground interest reach fast verb listen six table travel less morning ten simple several vowel toward war lay against pattern slow center love person money serve appear road map rain rule govern pull cold notice voice energy hunt probable bed brother egg ride cell believe fraction forest sit race window store summer train sleep prove lone leg exercise wall catch mount wish sky board joy winter sat written wild instrument kept glass grass cow job edge sign visit past soft fun bright gas weather month million bear finish happy hope flower clothe strange gone jump baby eight village meet root buy raise solve metal whether push seven paragraph third held hair describe cook floor either result burn hill safe cat century consider type law bit coast copy phrase silent tall sand soil roll temperature finger industry value fight lie beat excite natural view sense ear else quite broke case middle kill son lake moment scale loud spring observe child straight consonant nation dictionary milk speed method organ pay age section dress cloud surprise quiet stone tiny climb cool design poor lot experiment bottom key iron single stick flat twenty skin smile crease hole trade melody trip office receive row mouth exact symbol die least shout except wrote seed tone join suggest clean break lady yard rise bad blow oil blood touch grew cent mix team wire cost lost brown wear garden equal sent choose fell fit flow fair bank collect save control decimal gentle woman captain practice separate difficult doctor please protect noon whose locate ring character insect caught period indicate radio spoke atom human history effect electric crop expect bone rail imagine provide agree thus capital chair danger fruit rich thick soldier process operate guess necessary sharp wing create neighbor wash bat rather crowd corn compare poem string bell depend meat rub tube famous dollar stream fear sight thin triangle star shiver connect thin detail tie search bag send yellow allow printed spot continue darling check mechanical electrical instrument piping civil structural package general punch punchlist vendor contractor client owner acceptance criteria markup note remarks status update pending complete ongoing inspection procedure report witnessed signed rejected approved verified
"""

for w in re.findall(r'[A-Za-z]{2,}', base_english):
    vocab.add(w.lower())

tech_words = [
    'hydrotest', 'hydrostatic', 'pneumatic', 'tightening', 'torque', 'flange', 'gasket', 'coupling',
    'alignment', 'vibration', 'bearing', 'impeller', 'rotor', 'stator', 'casing', 'seal', 'shaft',
    'cooler', 'separator', 'scrubber', 'filter', 'strainer', 'orifice', 'nozzle', 'manifold', 'skid',
    'compressor', 'turbine', 'generator', 'combustor', 'enclosure', 'ventilation', 'lube', 'lubrication',
    'calibration', 'transmitter', 'gauge', 'thermocouple', 'sensor', 'solenoid', 'actuator', 'valve',
    'piping', 'welding', 'welder', 'radiography', 'ultrasonic', 'magnetic', 'penetrant', 'visual',
    'coating', 'painting', 'blasting', 'primer', 'intermediate', 'topcoat', 'galvanized', 'insulation',
    'conduit', 'cable', 'gland', 'wiring', 'earthing', 'grounding', 'bonding', 'megger', 'continuity',
    'preservation', 'nitrogen', 'purging', 'flushing', 'pickling', 'passivation', 'clearing', 'rectification',
    'nonconformance', 'deviation', 'concession', 'asbuilt', 'datasheet', 'schematic', 'isometrics',
    'loop', 'interlock', 'shutdown', 'trip', 'alarm', 'panel', 'cabinet', 'junction', 'substation',
    'swgr', 'switchgear', 'motor', 'breaker', 'transformer', 'battery', 'ups', 'charger', 'rectifier',
    'foundation', 'grouting', 'anchor', 'shim', 'leveling', 'elevation', 'orientation', 'tolerance',
    'clearance', 'backlash', 'runout', 'concentricity', 'parallelism', 'perpendicularity', 'roughness',
    'torqueing', 'torqued', 'bolted', 'fastened', 'secured', 'installed', 'mounted', 'connected',
    'fabricated', 'assembled', 'erected', 'precommissioned', 'commissioned', 'energized', 'tested',
    'flushed', 'cleaned', 'inspected', 'witnessed', 'verified', 'reviewed', 'approved', 'signed',
    'accepted', 'rejected', 'pending', 'ongoing', 'completed', 'outstanding', 'punchlisted', 'rectified',
    'closed', 'reopened', 'monitored', 'checked', 'examined', 'measured', 'calibrated', 'adjusted',
    'disassembled', 'reinstalled', 'replaced', 'repaired', 'modified', 'clarified', 'confirmed',
    'contractor', 'subcontractor', 'vendor', 'supplier', 'manufacturer', 'fabricator', 'inspector',
    'engineer', 'supervisor', 'specialist', 'technician', 'operator', 'auditor', 'surveyor',
    'mcdermott', 'ptsc', 'mpc', 'baker', 'hughes', 'bh', 'cu', 'pmc', 'poc', 'pqp', 'itp', 'qcp',
    'rfsu', 'sat', 'fat', 'sqcl', 'ncr', 'car', 'cdr', 'tq', 'fcr', 'si', 'site', 'query',
    'vietnam', 'block', 'offshore', 'onshore', 'platform', 'deck', 'jacket', 'topside', 'pipeline',
    'bolting', 'torquing', 'unbolted', 'reassembled', 'punchlist', 'punchlists', 'satisfactory',
    'unsatisfactory', 'conforming', 'nonconforming', 'defective', 'rectified', 'witness', 'monitor',
    'holdpoint', 'surveillance', 'calibrated', 'uncalibrated', 'tag', 'tagged', 'label', 'labeled'
]
for tw in tech_words:
    vocab.add(tw.lower())

sorted_words = sorted(list(vocab))

js_content = """// English & Engineering Quality Spellcheck Dictionary and Typo Highlighter
// Generated for Block B - EPC#1 SOI0007689 SQCL Dashboard

(function () {
  const WORDS_ARRAY = """ + json.dumps(sorted_words, ensure_ascii=False) + """;
  const ENGLISH_DICTIONARY = new Set(WORDS_ARRAY);

  // Common known abbreviations & acronyms that should never be flagged as typos
  const KNOWN_ACRONYMS = new Set([
    'gtg', 'gtc', 'bh', 'cu', 'pmc', 'pq', 'poc', 'bv', 'mpc', 'ptsc', 'mcd', 'asme', 'api', 'astm', 'ansi',
    'iso', 'iec', 'ieee', 'nace', 'sspc', 'itp', 'pqp', 'qcp', 'fat', 'sat', 'rfsu', 'ncr', 'car', 'tq',
    'fcr', 'si', 'pdf', 'rev', 'sqcl', 'kod', 'ldo', 'fg', 'lo', 'ia', 'pa', 'fw', 'sw', 'cw', 'hvac',
    'ups', 'dcs', 'plc', 'esd', 'fgs', 'scada', 'hmi', 'rtu', 'mcc', 'swgr', 'vfd', 'ups', 'nde', 'ndt',
    'rt', 'ut', 'mt', 'pt', 'vt', 'pmi', 'pwht', 'dft', 'wps', 'pqr', 'wqt', 'p&id', 'pfd', 'iso', 'ga',
    'pk', 'tag', 'k', 'no', 'ref', 'proc', 'crit', 'doc', 'spec', 'dwg', 'std', 'sec', 'col', 'row',
    'ok', 'na', 'done', 'ong', 'ny', 'pm', 'am', 'mm', 'cm', 'm', 'in', 'ft', 'psi', 'bar', 'kpa', 'mpa',
    'deg', 'c', 'f', 'rpm', 'gpm', 'm3', 'kg', 'lb', 'ton', 'kw', 'mw', 'hp', 'v', 'a', 'kv', 'hz', 'ohm'
  ]);

  // Project known personnel names
  const KNOWN_NAMES = new Set([
    'duy', 'hoang', 'kien', 'luong', 'son', 'thi', 'thuy',
    'cong', 'anthony', 'chung', 'ton', 'luu', 'tuan', 'baker', 'hughes', 'dien'
  ]);

  /**
   * Check if a word is spelled correctly according to English + Project vocabulary
   */
  function isValidWord(word) {
    if (!word || word.length < 2) return true;
    const lower = word.toLowerCase();
    
    // Ignore pure numbers or units like 100mm, 25bar, 50psi
    if (/^\\d+[a-zA-Z]*$/.test(word)) return true;
    
    // Ignore all uppercase acronyms of 2 to 6 chars (e.g. GTG, PQP, ASME)
    if (word === word.toUpperCase() && word.length <= 6) return true;
    
    if (KNOWN_ACRONYMS.has(lower)) return true;
    if (KNOWN_NAMES.has(lower)) return true;
    if (ENGLISH_DICTIONARY.has(lower)) return true;

    // Check with trailing s or ed or ing stripped
    if (lower.endsWith('s') && ENGLISH_DICTIONARY.has(lower.slice(0, -1))) return true;
    if (lower.endsWith('es') && ENGLISH_DICTIONARY.has(lower.slice(0, -2))) return true;
    if (lower.endsWith('ed') && ENGLISH_DICTIONARY.has(lower.slice(0, -2))) return true;
    if (lower.endsWith('ing') && ENGLISH_DICTIONARY.has(lower.slice(0, -3))) return true;
    if (lower.endsWith('d') && ENGLISH_DICTIONARY.has(lower.slice(0, -1))) return true;

    return false;
  }

  /**
   * Calculate Levenshtein distance for spell suggestions
   */
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  /**
   * Get closest suggestions for a misspelled word
   */
  function getSpellingSuggestions(word, maxResults = 3) {
    if (!word || word.length < 3) return [];
    const lower = word.toLowerCase();
    const candidates = [];

    // Search in dictionary with max distance 2
    for (const dictWord of ENGLISH_DICTIONARY) {
      if (Math.abs(dictWord.length - lower.length) > 2) continue;
      if (dictWord[0] !== lower[0] && Math.abs(dictWord.length - lower.length) > 1) continue;
      const dist = levenshtein(lower, dictWord);
      if (dist <= 2) {
        candidates.push({ word: dictWord, dist: dist });
      }
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.slice(0, maxResults).map(c => c.word);
  }

  /**
   * Find all misspelled words in a text
   */
  function findMisspelledWords(text) {
    if (!text) return [];
    const tokens = text.match(/[A-Za-z]{2,}/g) || [];
    const misspelled = [];
    for (const token of tokens) {
      if (!isValidWord(token)) {
        misspelled.push(token);
      }
    }
    return [...new Set(misspelled)];
  }

  /**
   * Highlight misspelled words in an HTML string with a red wavy underline and tooltip
   */
  function highlightEnglishTypos(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    const escaped = div.innerHTML;

    return escaped.replace(/\\b([A-Za-z]{3,})\\b/g, (match) => {
      if (isValidWord(match)) return match;
      const suggestions = getSpellingSuggestions(match);
      const sugText = suggestions.length > 0 ? ' (Did you mean: ' + suggestions.join(', ') + '?)' : '';
      return '<span class="spell-typo" title="⚠️ Possible typo: \\'' + match + '\\'' + sugText + '" data-typo="' + match + '">' + match + '</span>';
    });
  }

  // Expose to window or global
  const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  root.SQCLSpellcheck = {
    dictionary: ENGLISH_DICTIONARY,
    isValidWord: isValidWord,
    findMisspelledWords: findMisspelledWords,
    getSpellingSuggestions: getSpellingSuggestions,
    highlightEnglishTypos: highlightEnglishTypos
  };
})();
"""

with open('static/spellcheck.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f'Successfully generated static/spellcheck.js with {len(sorted_words)} words!')
