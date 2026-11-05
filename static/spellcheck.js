// English & Engineering Quality Spellcheck Dictionary and Typo Highlighter
// Generated for Block B - EPC#1 SOI0007689 SQCL Dashboard

(function () {
  const WORDS_ARRAY = ["able", "about", "above", "absence", "accelerometer", "accelerometers", "acceptability", "acceptance", "accepted", "access", "accessibility", "accessories", "accordance", "according", "accumulator", "acoustic", "action", "activating", "activation", "activities", "actual", "actually", "actuated", "actuator", "add", "adequate", "adjacent", "adjusted", "admissible", "admitted", "advise", "advised", "after", "again", "against", "age", "agents", "agree", "air", "airside", "alarm", "aligned", "alignment", "all", "allow", "allowed", "allowing", "almost", "along", "already", "also", "alternating", "alternative", "always", "america", "an", "analysis", "anchor", "anchorage", "anchoring", "and", "angle", "animal", "another", "answer", "anthony", "anti", "anticipated", "antisurge", "any", "appear", "applicable", "application", "applied", "apply", "approach", "approved", "are", "area", "areas", "around", "arrange", "arrangement", "arrestor", "arrived", "as", "asbuilt", "ask", "asme", "assembled", "assembly", "at", "atmospheric", "atom", "attention", "auditor", "automatic", "automatically", "auxiliaries", "availability", "available", "avoid", "aw", "away", "axial", "ba", "baby", "back", "backlash", "bad", "bag", "bags", "baker", "bank", "bars", "baseplate", "bat", "batteries", "battery", "bc", "bcl", "be", "beam", "beams", "bear", "bearing", "bearings", "beat", "because", "bed", "been", "before", "began", "begin", "being", "believe", "bell", "bellmouth", "belonging", "below", "belts", "bend", "bending", "bently", "best", "better", "between", "bh", "big", "bit", "blade", "blades", "blasting", "bleed", "blind", "blinded", "blinds", "block", "blood", "blow", "blowing", "blown", "board", "boards", "body", "bolt", "bolted", "bolting", "bolts", "bom", "bonding", "bone", "book", "booster", "boroscope", "both", "bottles", "bottom", "boxes", "boy", "brackets", "break", "breaker", "breaking", "breather", "bright", "broke", "brother", "brown", "bulletin", "bundle", "burn", "but", "buy", "by", "bypass", "cabinet", "cable", "cables", "calculation", "calibrated", "calibration", "call", "came", "can", "cantilever", "capital", "captain", "car", "carbon", "cargo", "carry", "cartridge", "cartridges", "case", "casing", "cat", "catch", "caught", "caulk", "cdr", "ce", "cell", "cent", "center", "centering", "centerline", "central", "centre", "centrifugal", "century", "certification", "chafing", "chair", "change", "channels", "character", "characteristics", "charge", "charger", "check", "checked", "checking", "checks", "child", "children", "choose", "chromatograph", "chung", "circuit", "city", "civil", "cladding", "clarified", "classification", "clean", "cleaned", "cleaning", "cleanliness", "cleanness", "clearance", "clearances", "clearing", "client", "climb", "close", "closed", "closing", "closure", "clothe", "cloud", "clutch", "co", "coalesced", "coast", "coating", "cod", "code", "coherence", "col", "cold", "collect", "color", "colour", "colours", "combustor", "come", "command", "commands", "comment", "commiss", "commissioned", "commissioning", "compare", "compatible", "complete", "completed", "completeness", "completion", "compliance", "compliant", "components", "compression", "compressor", "compressors", "concentricity", "concession", "condition", "conditioning", "conditions", "conduit", "conduits", "confirm", "confirmed", "confirming", "conforming", "conformities", "conformity", "cong", "conical", "connect", "connected", "connecting", "connection", "connections", "connector", "connectors", "consequences", "consider", "considering", "consistency", "console", "consonant", "constructed", "construction", "contact", "container", "contamination", "continue", "continuity", "contract", "contractor", "control", "controls", "conveyor", "cook", "cool", "cooler", "coolers", "coplanar", "copy", "corn", "corners", "corning", "correct", "correctly", "cost", "could", "count", "country", "coupling", "couplings", "cow", "cppt", "cracks", "crease", "create", "criteria", "crop", "crowd", "cu", "customer", "cut", "cylinders", "damage", "damaged", "damages", "dampers", "danger", "darling", "data", "datasheet", "date", "day", "days", "dbse", "dc", "de", "debris", "decimal", "decison", "deck", "defective", "defects", "defined", "definitive", "deflection", "deformation", "depend", "describe", "design", "detail", "detection", "detectors", "determination", "deviation", "device", "devices", "dgs", "diagram", "diagrams", "dial", "dictionary", "did", "die", "different", "differential", "differently", "difficult", "dim", "dimension", "dimensional", "direct", "direction", "directioned", "disassembled", "disassembly", "discharge", "disconnect", "disconnected", "dismantled", "displacement", "distance", "distribution", "dk", "do", "docs", "doctor", "documents", "does", "doesn", "dollar", "don", "done", "door", "doors", "double", "dow", "doweled", "doweling", "down", "downstream", "downward", "drain", "drains", "drawing", "drawings", "dress", "driven", "driver", "dry", "duct", "ducts", "dumpers", "during", "dust", "duy", "dwgs", "each", "ear", "early", "earth", "earthing", "easily", "eat", "edge", "effect", "efficiency", "egg", "eight", "either", "el", "elastic", "electric", "electrical", "elements", "elevation", "elevations", "eliminator", "else", "emergency", "emitting", "enclosure", "end", "ends", "energized", "energy", "engine", "engineer", "enough", "ensure", "entered", "equal", "equipment", "erected", "erection", "error", "etc", "even", "every", "everything", "exact", "examined", "example", "exceed", "except", "excepted", "excessive", "excite", "excluded", "executed", "execution", "exercise", "exh", "exhaust", "expansion", "expect", "expedite", "experiment", "expiry", "explosion", "exposed", "external", "extractor", "eye", "fab", "fabricate", "fabricated", "fabrication", "fabricator", "face", "fair", "false", "family", "famous", "fan", "fans", "far", "fast", "fastened", "fastening", "fat", "father", "fcr", "fear", "feeding", "feet", "fell", "few", "field", "fight", "fighting", "filled", "filling", "filter", "filtering", "filters", "final", "find", "finger", "fingertip", "finish", "fire", "first", "fit", "fitting", "fittings", "five", "fixed", "flag", "flame", "flange", "flanged", "flanges", "flat", "flatness", "flexible", "flooding", "floor", "flow", "flower", "fluid", "flush", "flushed", "flushing", "follow", "followed", "following", "food", "for", "foreign", "forest", "form", "found", "foundation", "foundations", "four", "fraction", "frame", "frames", "free", "from", "front", "fruit", "fsr", "fuel", "full", "fun", "function", "functional", "functionality", "future", "galvanized", "gap", "gaps", "garden", "gas", "gasket", "gaskets", "gates", "gauge", "gauges", "gb", "gear", "gearbox", "gek", "general", "generator", "gentle", "get", "gg", "gimbal", "girl", "give", "gland", "glands", "glass", "go", "gone", "good", "got", "govern", "grass", "gratings", "gravity", "grease", "greasing", "great", "green", "grew", "grinding", "ground", "grounding", "group", "grouting", "grow", "gt", "guard", "guards", "guess", "guide", "guidelines", "had", "hair", "half", "hand", "handles", "handrails", "hangers", "happy", "hard", "hardware", "has", "hatches", "have", "he", "head", "header", "headers", "hear", "heard", "heat", "heater", "heaters", "held", "her", "here", "hex", "high", "hill", "him", "his", "history", "hoang", "hold", "holdpoint", "hole", "holes", "home", "hoods", "hook", "hope", "hoses", "hot", "hour", "hours", "house", "housekeeping", "how", "hp", "hss", "hubs", "hughes", "human", "humidity", "hundred", "hunt", "hydraulic", "hydrostatic", "hydrotest", "id", "idea", "identification", "if", "ignition", "imagine", "impeller", "important", "in", "inches", "inclination", "included", "including", "incomplete", "indicate", "indicated", "indicating", "indication", "indicator", "indicators", "industry", "inflammable", "initial", "inlet", "inoperative", "insect", "inside", "insp", "inspec", "inspect", "inspected", "inspection", "inspector", "install", "installation", "installed", "installing", "instead", "instructed", "instruction", "instructions", "instrument", "instrumentation", "instruments", "insulation", "intake", "integrity", "intercepting", "interconnecting", "interconnection", "interest", "interested", "interference", "interferences", "interlock", "intermediate", "internal", "intervention", "into", "involved", "iron", "is", "iso", "isolated", "isolation", "isometric", "isometrics", "issued", "issuing", "it", "item", "items", "itn", "itp", "its", "jack", "jacket", "jacks", "jb", "jbs", "job", "join", "joint", "joints", "joy", "jump", "jumpers", "junction", "just", "keep", "kept", "key", "keys", "kien", "kill", "kind", "king", "kinks", "kit", "knew", "know", "label", "labeled", "labels", "ladder", "ladders", "lady", "lake", "land", "large", "laser", "last", "late", "later", "law", "lay", "layout", "learn", "least", "leave", "left", "leg", "less", "let", "letter", "level", "leveling", "levelled", "levelling", "lie", "life", "lifting", "light", "lighting", "like", "limit", "limits", "line", "lines", "liquid", "liquids", "list", "listen", "little", "live", "lm", "load", "local", "locate", "lock", "locked", "locking", "lone", "long", "longitudinal", "look", "loop", "loops", "loose", "loosening", "lost", "lot", "loud", "love", "lube", "lubricant", "lubricated", "lubrication", "luong", "luu", "machine", "machines", "made", "magnetic", "main", "maintenance", "make", "man", "mandatory", "manifold", "manifolds", "manometers", "manual", "manufacturer", "many", "map", "marked", "markup", "master", "material", "materials", "mating", "matters", "max", "maximum", "may", "mcc", "mcdermott", "mcl", "mdr", "me", "mean", "measured", "measuring", "meat", "mech", "mechanical", "mechanically", "meet", "meeting", "megger", "melody", "men", "mesh", "metal", "metering", "method", "micron", "mid", "middle", "might", "mile", "milestone", "milk", "million", "mineral", "mini", "minimum", "mis", "miss", "missing", "mist", "mix", "mixing", "mm", "mock", "mockup", "modified", "modify", "modules", "moment", "money", "monitor", "monitored", "month", "more", "morning", "most", "mother", "motor", "motors", "mount", "mountain", "mounted", "mounting", "mouth", "move", "moved", "movement", "mpc", "much", "music", "must", "my", "na", "name", "nation", "natural", "ncr", "ndv", "near", "necessary", "need", "needed", "neighbor", "neoprene", "net", "network", "nevada", "never", "new", "next", "nic", "night", "nitrogen", "nm", "no", "non", "nonconformance", "nonconforming", "nonconformity", "noon", "normally", "not", "note", "notice", "nov", "now", "nozzle", "nozzles", "nt", "number", "numbers", "nuts", "nv", "object", "observe", "observed", "obstructing", "obstruction", "obstructions", "occurs", "oct", "of", "off", "office", "offset", "offshore", "often", "oil", "old", "on", "once", "one", "ones", "ongoing", "only", "onshore", "onto", "open", "opened", "opening", "openings", "operate", "operated", "operation", "operational", "operations", "operator", "optional", "or", "order", "organ", "orientation", "orifice", "orifices", "other", "our", "out", "outlet", "outside", "outstanding", "over", "own", "owner", "oxidation", "pack", "package", "packaging", "packing", "packs", "pad", "page", "painting", "panel", "panels", "panic", "paper", "paragraph", "parallelism", "parameters", "part", "partially", "particles", "particular", "particularly", "parts", "pass", "passage", "passivation", "past", "paste", "pattern", "pay", "pdt", "pen", "pending", "penetrant", "people", "per", "perform", "performed", "perimeter", "period", "permanent", "perpendicularity", "person", "personnel", "phase", "phasor", "phrase", "pick", "pickling", "picture", "piece", "pilot", "pins", "pipe", "pipeline", "pipes", "piping", "place", "placed", "placement", "plan", "plant", "plate", "plates", "platform", "play", "please", "plenum", "pls", "plug", "plugs", "pmc", "pneumatic", "poc", "poem", "point", "points", "poor", "port", "pose", "position", "positioned", "positioning", "positions", "possible", "potential", "power", "pq", "pqp", "practice", "pre", "precautions", "precom", "precommissioned", "preinstalled", "preparation", "prescriptions", "presence", "present", "preservation", "pressure", "pressurization", "prevent", "previously", "primary", "primer", "printed", "prior", "probable", "probe", "probes", "problem", "procedure", "procedures", "proceed", "process", "produce", "profile", "project", "proof", "proper", "properly", "properties", "protect", "protected", "protection", "prove", "provide", "provided", "provisional", "proximity", "pt", "ptsc", "pull", "pump", "pumps", "punch", "punchlist", "punchlisted", "punchlists", "punchs", "purging", "purifier", "push", "put", "qc", "qcp", "quan", "quantity", "query", "questions", "quiet", "quite", "quotes", "race", "rack", "radial", "radio", "radiography", "rail", "rain", "raise", "range", "rather", "rays", "re", "reach", "read", "ready", "real", "reassemble", "reassembled", "receive", "record", "recorded", "recoup", "rectification", "rectified", "rectifier", "recycle", "red", "redundant", "refer", "reference", "regulating", "reinstall", "reinstalled", "rejected", "related", "release", "released", "relevant", "reliability", "relief", "remain", "remaining", "remains", "remarks", "remember", "remote", "removal", "remove", "removed", "reopened", "repaired", "replace", "replaced", "replacement", "replacements", "report", "reported", "require", "required", "requirements", "resistances", "respect", "respected", "restoring", "result", "results", "retaining", "return", "review", "reviewed", "rfr", "rfsu", "rhomboidal", "rich", "ride", "right", "rigid", "ring", "rise", "risk", "river", "ro", "road", "rock", "rod", "roll", "room", "root", "rotating", "rotation", "rotor", "roughness", "routing", "row", "rub", "rule", "run", "rundown", "running", "runout", "safe", "safety", "said", "same", "sample", "sand", "sat", "satisfactory", "save", "saw", "say", "scaffoldings", "scale", "scavenge", "schedule", "schematic", "schematics", "school", "scope", "scratches", "screen", "screens", "scrubber", "sea", "seal", "sealing", "sealings", "seals", "search", "second", "secondary", "section", "sections", "secured", "see", "seed", "seem", "seismic", "seizing", "selectors", "self", "send", "sense", "sensor", "sensors", "sent", "sentence", "separate", "separately", "separator", "sequence", "serial", "serve", "service", "set", "setting", "seven", "several", "sg", "sh", "shaft", "shafts", "shall", "sharp", "she", "sheet", "shell", "shim", "shims", "ship", "shipment", "shipped", "shipping", "shiver", "shortage", "should", "shout", "show", "shut", "shutdown", "si", "sic", "side", "sides", "sight", "sign", "signal", "signature", "signed", "signs", "sikaflex", "silencer", "silencers", "silent", "similar", "simple", "since", "single", "siphon", "sit", "site", "six", "size", "sketch", "skid", "skids", "skin", "skirts", "sko", "sky", "sleep", "sliding", "slippery", "slow", "sm", "small", "smile", "smo", "smoke", "smooth", "so", "socket", "soft", "soil", "sok", "soldier", "sole", "solenoid", "solve", "som", "some", "something", "sometimes", "son", "song", "soon", "sos", "sound", "sourav", "south", "sox", "space", "spacer", "spark", "special", "specialist", "specific", "specification", "specifications", "speed", "spell", "spherical", "spoke", "sponges", "spot", "sprayers", "spring", "sqcl", "sso", "st", "stack", "stage", "stages", "stairs", "stamp", "standard", "standards", "standstill", "star", "start", "starter", "starting", "state", "static", "stator", "status", "steel", "step", "stick", "still", "stone", "stop", "store", "stored", "storing", "story", "straight", "strainer", "strange", "stream", "strength", "stressing", "stretch", "string", "structural", "structure", "study", "sub", "subcontractor", "subject", "subplates", "substance", "substation", "successfully", "such", "suction", "suggest", "summer", "supervisor", "supplied", "supplier", "supply", "support", "supports", "sure", "surface", "surfaces", "surprise", "surveillance", "survey", "surveyor", "sw", "swgr", "switch", "switchboard", "switches", "switchgear", "swo", "symbol", "synthetic", "system", "systems", "table", "tack", "tag", "tagged", "tags", "take", "talk", "tall", "tank", "target", "tarpauline", "team", "tear", "technician", "tell", "temperature", "temporary", "ten", "tension", "tensioning", "terminal", "terminals", "termination", "test", "tested", "testing", "tests", "tg", "than", "that", "the", "their", "them", "then", "there", "thermal", "thermo", "thermocouple", "thermocouples", "thermometers", "these", "they", "thi", "thick", "thickness", "thin", "thing", "think", "third", "this", "thomas", "those", "thought", "threaded", "three", "through", "thrust", "thus", "thuy", "tie", "tight", "tightened", "tightening", "time", "times", "tiny", "tion", "to", "together", "told", "tolerance", "tolerances", "ton", "tone", "too", "took", "tool", "tools", "top", "topcoat", "topside", "torch", "torque", "torqued", "torqueing", "torquing", "torsion", "touch", "toward", "tp", "tpc", "tpi", "tq", "tracing", "trade", "train", "trans", "transformer", "transformers", "transmission", "transmitter", "transmitters", "transporta", "transportation", "travel", "trays", "treatment", "tree", "triangle", "trip", "trolley", "true", "try", "tuan", "tube", "tubing", "turbine", "turn", "twenty", "two", "type", "typical", "ucp", "ucs", "ultrasonic", "unassigned", "unbolted", "uncalibrated", "under", "undue", "unions", "unit", "units", "unless", "unlocked", "unsatisfactory", "unsealed", "until", "up", "update", "updated", "ups", "upward", "us", "use", "used", "using", "utilities", "value", "valve", "valves", "vapor", "vendor", "vent", "ventilated", "ventilation", "verb", "verification", "verified", "verify", "verticality", "very", "vibration", "victor", "vietnam", "view", "village", "visible", "visit", "visual", "voice", "vowel", "vpci", "vsv", "waiting", "walk", "walkways", "wall", "want", "war", "warning", "was", "wash", "washing", "watch", "water", "way", "we", "wear", "weather", "welded", "welder", "welding", "well", "went", "were", "west", "what", "wheel", "when", "where", "whether", "which", "while", "white", "who", "whole", "whose", "why", "wild", "will", "window", "windows", "wing", "winter", "wire", "wired", "wiring", "wish", "with", "within", "without", "witness", "witnessed", "woman", "word", "work", "working", "works", "world", "would", "write", "written", "wrote", "yard", "year", "yellow", "yet", "yho", "you", "young", "your"];
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
    'deg', 'c', 'f', 'rpm', 'gpm', 'm3', 'kg', 'lb', 'ton', 'kw', 'mw', 'hp', 'v', 'a', 'kv', 'hz', 'ohm', 'pid', 'p&id', 'tpi', 'som', 'sok', 'sko', 'sic', 'ro', 'pdt', 'pic'
  ]);

  // Project known personnel names
  const KNOWN_NAMES = new Set([
    'duy', 'hoang', 'kien', 'luong', 'son', 'thi', 'thuy',
    'cong', 'anthony', 'chung', 'ton', 'luu', 'tuan', 'baker', 'hughes', 'dien', 'vu', 'ba', 'hai', 'nam', 'long', 'minh', 'anh', 'quang', 'hung', 'cuong', 'hieu', 'trung'
  ]);

  /**
   * Check if a word is spelled correctly according to English + Project vocabulary
   */
  function isValidWord(word) {
    if (!word || word.length < 2) return true;
    if (/[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(word)) return true;
    const lower = word.toLowerCase();
    
    // Ignore pure numbers or units like 100mm, 25bar, 50psi
    if (/^\d+[a-zA-Z]*$/.test(word)) return true;
    
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
    const tokens = text.match(/\b[A-Za-z]+(?:&[A-Za-z]+)?\b/g) || [];
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

    return escaped.replace(/\b([A-Za-z]{3,})\b/g, (match) => {
      if (isValidWord(match)) return match;
      const suggestions = getSpellingSuggestions(match);
      const sugText = suggestions.length > 0 ? ' (Did you mean: ' + suggestions.join(', ') + '?)' : '';
      return '<span class="spell-typo" title="⚠️ Possible typo: \'' + match + '\'' + sugText + '" data-typo="' + match + '">' + match + '</span>';
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
