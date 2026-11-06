// SQCL Dashboard Application Logic (100% English, Full-Width, Resizable Columns with Subtle Grid, Device Modes)
(function () {
  "use strict";

  const DEFAULT_COL_WIDTHS = [45, 65, 75, 300, 140, 105, 105, 105, 100, 110, 110, 160, 180, 180, 50, 210];

  const state = {
    data: window.SQCL_INITIAL_DATA || null,
    selectedUnit: "ALL", // "ALL", "GTG#1", "GTG#2"
    deviceMode: window.innerWidth < 768 ? "phone" : "laptop",
    openMode: "IN_APP", // "IN_APP" or "NEW_WINDOW"
    activeTabId: "summary",
    tabs: [
      {
        id: "summary",
        title: "Overview (Summary)",
        type: "summary",
        closable: false
      }
    ],
    summaryFilters: {
      systemSearch: "",
      systemProgress: "ALL",
      scheduleDiscipline: "ALL" // "ALL", "Mechanical", "Electrical & Instruments"
    },
    colWidths: loadSavedColWidths(),
    closingViewMode: "matrix",
    closingChartMetric: "daily",
    closingRange: "all",
    closingLedger: null,
    charts: {}
  };

  function loadSavedColWidths() {
    try {
      const saved = localStorage.getItem("sqcl_col_widths");
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr) && arr.length === DEFAULT_COL_WIDTHS.length) {
          return arr;
        }
      }
    } catch (e) {}
    return [...DEFAULT_COL_WIDTHS];
  }

  function saveColWidths(widths) {
    state.colWidths = widths;
    try {
      localStorage.setItem("sqcl_col_widths", JSON.stringify(widths));
    } catch (e) {}
  }

  window.resetDetailColWidths = function (tabId) {
    state.colWidths = [...DEFAULT_COL_WIDTHS];
    saveColWidths(state.colWidths);
    applyColWidthsToTable(tabId);
    showToast("Detail column widths reset to default.", "info");
  };

  function applyColWidthsToTable(tabId) {
    const table = document.getElementById(`detail-table-${tabId}`);
    if (!table) return;
    const cols = table.querySelectorAll("colgroup col");
    if (cols && cols.length === state.colWidths.length) {
      cols.forEach((col, idx) => {
        col.style.width = `${state.colWidths[idx]}px`;
      });
    }
  }

  // Closing Ledger Helpers (07:30 AM Cut-off)
  function computeWorkDateJS(dateObj) {
    const d = new Date(dateObj);
    const hour = d.getHours();
    const minute = d.getMinutes();
    if (hour < 7 || (hour === 7 && minute < 30)) {
      d.setDate(d.getDate() - 1);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatWorkDateLabel(dateStr) {
    if (!dateStr || dateStr === "ALL") return "";
    try {
      const parts = dateStr.split("-");
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const curD = new Date(y, m, d);
      const nextD = new Date(y, m, d + 1);
      const curStr = `${String(curD.getDate()).padStart(2, "0")}/${String(curD.getMonth() + 1).padStart(2, "0")}`;
      const nextStr = `${String(nextD.getDate()).padStart(2, "0")}/${String(nextD.getMonth() + 1).padStart(2, "0")}`;
      return `${curStr} (Cut-off 07:30 ${nextStr})`;
    } catch (e) {
      return dateStr;
    }
  }

  function formatWorkDateShort(dateStr) {
    if (!dateStr || dateStr === "ALL") return "";
    try {
      const parts = dateStr.split("-");
      return `${parts[2]}/${parts[1]}`;
    } catch (e) {
      return dateStr;
    }
  }

  function getClosingLedger() {
    if (state.closingLedger && state.closingLedger.records) return state.closingLedger;
    try {
      const stored = localStorage.getItem("SQCL_CLOSING_LEDGER");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.records) {
          const bundleLedger = window.SQCL_CLOSING_LEDGER;
          if (!bundleLedger || (parsed.last_updated && parsed.last_updated >= (bundleLedger.last_updated || ""))) {
            state.closingLedger = parsed;
            return state.closingLedger;
          }
        }
      }
    } catch (e) {}

    if (window.SQCL_CLOSING_LEDGER) {
      state.closingLedger = window.SQCL_CLOSING_LEDGER;
      return state.closingLedger;
    }

    if (state.data && state.data.closing_ledger_full) {
      state.closingLedger = state.data.closing_ledger_full;
      return state.closingLedger;
    }

    state.closingLedger = {
      version: "1.0",
      total_closed_items: 0,
      records: {},
      daily_summary: {}
    };
    return state.closingLedger;
  }

  function saveClosingLedger(ledger) {
    state.closingLedger = ledger;
    window.SQCL_CLOSING_LEDGER = ledger;
    try {
      localStorage.setItem("SQCL_CLOSING_LEDGER", JSON.stringify(ledger));
    } catch (e) {}
  }

  // Guarantees 100% two-way data consistency between state.data and state.closingLedger
  // strictly driven by Column Status (Column P == 'Done') as requested by user.
  function ensureDataLedgerConsistency() {
    if (!state.data || !state.data.units) return;
    const ledger = getClosingLedger();
    if (!ledger.records) ledger.records = {};

    let changed = false;
    const activeDoneIds = new Set();

    ["GTG#1", "GTG#2"].forEach((uid) => {
      const uObj = state.data.units[uid];
      if (!uObj || !uObj.activities) return;

      uObj.activities.forEach((act) => {
        const isDone = act.status === "Done";
        let disc = act.discipline || "General";
        if (disc === "Unassigned") disc = "General";

        if (isDone) {
          activeDoneIds.add(act.id);
          if (!ledger.records[act.id]) {
            let wDate = "2026-08-24";
            if (act.sig_date && act.sig_date.trim()) {
              wDate = act.sig_date.slice(0, 10);
            } else {
              wDate = computeWorkDateJS(new Date());
            }
            ledger.records[act.id] = {
              id: act.id,
              unit: uid,
              activity: act.activity,
              section: act.section,
              section_title: act.section_title,
              description: act.description,
              discipline: disc,
              work_date: wDate,
              status: "Done",
              col_c_date: act.sig_date || "",
              closed_timestamp: new Date().toISOString(),
              source: "status_column_p_sync"
            };
            changed = true;
          } else {
            const rec = ledger.records[act.id];
            if (rec.discipline !== disc) {
              rec.discipline = disc;
              changed = true;
            }
            if (rec.unit !== uid) {
              rec.unit = uid;
              changed = true;
            }
            if (rec.status !== "Done") {
              rec.status = "Done";
              changed = true;
            }
          }
        } else {
          if (ledger.records[act.id]) {
            delete ledger.records[act.id];
            changed = true;
          }
        }
      });
    });

    // Purge any orphan records that do not exist or are no longer Done
    Object.keys(ledger.records).forEach((rId) => {
      if (!activeDoneIds.has(rId)) {
        delete ledger.records[rId];
        changed = true;
      }
    });

    ledger.total_closed_items = Object.keys(ledger.records).length;
    saveClosingLedger(ledger);
  }

  const CORE_DISCIPLINES = [
    "Mechanical",
    "Electrical & Instruments",
    "Piping",
    "Pre-Commissioning",
    "Structural",
    "Material",
    "Unassigned"
  ];

  const DISCIPLINE_COLORS = {
    "Mechanical": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", bar: "#2563EB", badge: "bg-blue-100 text-blue-800 border-blue-200" },
    "Electrical & Instruments": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", bar: "#7C3AED", badge: "bg-purple-100 text-purple-800 border-purple-200" },
    "Piping": { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", bar: "#0891B2", badge: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    "Pre-Commissioning": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", bar: "#D97706", badge: "bg-amber-100 text-amber-800 border-amber-200" },
    "Structural": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", bar: "#4F46E5", badge: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    "Material": { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", bar: "#0D9488", badge: "bg-teal-100 text-teal-800 border-teal-200" },
    "Package": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", bar: "#059669", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    "Civil": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", bar: "#EA580C", badge: "bg-orange-100 text-orange-800 border-orange-200" },
    "Unassigned": { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", bar: "#64748B", badge: "bg-slate-100 text-slate-700 border-slate-200" }
  };

  const DYNAMIC_PALETTE = [
    { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", bar: "#0D9488", badge: "bg-teal-100 text-teal-800 border-teal-200" },
    { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", bar: "#4F46E5", badge: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", bar: "#E11D48", badge: "bg-rose-100 text-rose-800 border-rose-200" },
    { bg: "bg-lime-50", text: "text-lime-700", border: "border-lime-200", bar: "#65A30D", badge: "bg-lime-100 text-lime-800 border-lime-200" },
    { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200", bar: "#C026D3", badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200" },
    { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", bar: "#0284C7", badge: "bg-sky-100 text-sky-800 border-sky-200" }
  ];

  function getDisciplineTheme(dName) {
    if (!dName || dName === "Unassigned") return DISCIPLINE_COLORS["Unassigned"];
    if (DISCIPLINE_COLORS[dName]) return DISCIPLINE_COLORS[dName];
    let hash = 0;
    for (let i = 0; i < dName.length; i++) hash = (hash * 31 + dName.charCodeAt(i)) & 0xffffffff;
    return DYNAMIC_PALETTE[Math.abs(hash) % DYNAMIC_PALETTE.length];
  }

  function getDisciplineShortLabel(dName) {
    if (!dName) return "-";
    if (dName === "Electrical & Instruments") return "E&I";
    if (dName === "Mechanical") return "Mech";
    if (dName === "Pre-Commissioning") return "Pre-Com";
    if (dName === "Structural") return "Struct";
    return dName;
  }

  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${parts[2]}-${months[mIdx] || parts[1]}`;
  }

  // Device Mode Switcher (Laptop Widescreen vs Phone Mode)
  window.setDeviceMode = function (mode) {
    state.deviceMode = mode;
    try {
      localStorage.setItem("sqcl_device_mode", mode);
    } catch (e) {}

    const body = document.body;
    if (mode === "phone") {
      body.classList.add("phone-mode-active");
    } else {
      body.classList.remove("phone-mode-active");
    }

    renderTopNav();
    showToast(`Switched to ${mode === "phone" ? "Mobile Phone" : "Laptop Widescreen"} Mode`, "info");
  };

  function getAllScheduleTuples(unitFilter = "ALL") {
    if (!state.data || !state.data.units) return [];
    const u1 = state.data.units["GTG#1"];
    if (!u1 || !u1.sections) return [];

    const tuples = [];
    u1.sections.forEach((sec) => {
      (sec.schedule || []).forEach((sc) => {
        (sc.items || []).forEach((it) => {
          it.units.forEach((u) => {
            if (unitFilter === "ALL" || unitFilter === u) {
              tuples.push({
                unit: u,
                section: sec.section,
                section_title: sec.title,
                date: sc.date,
                discipline: it.discipline,
                raw: it.raw
              });
            }
          });
        });
      });
    });
    return tuples;
  }

  function getActivitiesByFilter(criteria) {
    if (!state.data || !state.data.units) return [];
    const unitFilter = criteria.unit || "ALL";
    let list = [];
    const unitKeys = unitFilter === "ALL" ? ["GTG#1", "GTG#2"] : [unitFilter];
    unitKeys.forEach((uk) => {
      const u = state.data.units[uk];
      if (u && u.activities) {
        list = list.concat(u.activities);
      }
    });

    if (criteria.scheduledOnly || (criteria.scheduleDate && criteria.scheduleDate !== "ALL")) {
      const tuples = getAllScheduleTuples(unitFilter);
      const validTriples = new Set();
      tuples.forEach((t) => {
        if (criteria.scheduleDate && criteria.scheduleDate !== "ALL" && t.date !== criteria.scheduleDate) {
          return;
        }
        if (criteria.discipline && criteria.discipline !== "ALL" && t.discipline !== criteria.discipline) {
          return;
        }
        if (criteria.section && criteria.section !== "ALL" && t.section !== criteria.section) {
          return;
        }
        validTriples.add(`${t.unit}__${t.section}__${t.discipline}`);
      });
      list = list.filter((a) => validTriples.has(`${a.unit}__${a.section}__${a.discipline}`));
    }

    if (criteria.closingWorkDate && criteria.closingWorkDate !== "ALL") {
      const ledger = getClosingLedger();
      const recs = (ledger && ledger.records) || {};
      list = list.filter((a) => {
        const rec = recs[a.id];
        return Boolean(a.status === "Done" && rec && rec.work_date === criteria.closingWorkDate);
      });
    }

    if (criteria.section && criteria.section !== "ALL") {
      list = list.filter((a) => a.section === criteria.section);
    }
    if (criteria.discipline && criteria.discipline !== "ALL") {
      list = list.filter((a) => {
        if (criteria.discipline === "General" || criteria.discipline === "Unassigned") {
          return a.discipline === "General" || a.discipline === "Unassigned" || !a.discipline;
        }
        return a.discipline === criteria.discipline;
      });
    }
    if (criteria.status && criteria.status !== "ALL") {
      list = list.filter((a) => a.status === criteria.status);
    }
    if (criteria.sigFilter && criteria.sigFilter !== "ALL") {
      switch (criteria.sigFilter) {
        case "BH_SIGNED":
          list = list.filter((a) => a.bh_signed);
          break;
        case "BH_UNSIGNED":
          list = list.filter((a) => !a.bh_signed);
          break;
        case "CU_SIGNED":
          list = list.filter((a) => a.cu_signed);
          break;
        case "CU_UNSIGNED":
          list = list.filter((a) => !a.cu_signed);
          break;
        case "BOTH_SIGNED":
          list = list.filter((a) => a.both_signed);
          break;
        case "BH_ONLY":
          list = list.filter((a) => a.bh_signed && !a.cu_signed);
          break;
        case "CU_ONLY":
          list = list.filter((a) => !a.bh_signed && a.cu_signed);
          break;
        case "DONE_UNSIGNED":
          list = list.filter((a) => a.done_unsigned);
          break;
        case "UNSIGNED":
          list = list.filter((a) => !a.bh_signed && !a.cu_signed);
          break;
      }
    }
    if (criteria.search && criteria.search.trim() !== "") {
      const q = criteria.search.trim().toLowerCase();
      list = list.filter((a) => {
        return (
          (a.activity && a.activity.toLowerCase().includes(q)) ||
          (a.description && a.description.toLowerCase().includes(q)) ||
          (a.section_title && a.section_title.toLowerCase().includes(q)) ||
          (a.discipline && a.discipline.toLowerCase().includes(q)) ||
          (a.ref_doc && a.ref_doc.toLowerCase().includes(q)) ||
          (a.procedure && a.procedure.toLowerCase().includes(q)) ||
          (a.pic_pmc && a.pic_pmc.toLowerCase().includes(q)) ||
          (a.pic_pq && a.pic_pq.toLowerCase().includes(q)) ||
          (a.site_markup && a.site_markup.toLowerCase().includes(q)) ||
          (a.status_update && a.status_update.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }

  function computeStats(activities) {
    const total = activities.length;
    let done = 0,
      ongoing = 0,
      not_yet = 0,
      na = 0,
      bh_signed = 0,
      cu_signed = 0,
      both_signed = 0,
      bh_only = 0,
      cu_only = 0,
      done_unsigned = 0,
      unsigned = 0;

    const byDisciplineMap = {};

    activities.forEach((a) => {
      if (a.status === "Done") done++;
      else if (a.status === "Ongoing") ongoing++;
      else if (a.status === "N/A") na++;
      else not_yet++;

      if (a.bh_signed) bh_signed++;
      if (a.cu_signed) cu_signed++;
      if (a.both_signed) both_signed++;
      if (a.bh_signed && !a.cu_signed) bh_only++;
      if (!a.bh_signed && a.cu_signed) cu_only++;
      if (a.done_unsigned) done_unsigned++;
      if (!a.bh_signed && !a.cu_signed) unsigned++;

      const d = a.discipline || "Unassigned";
      if (!byDisciplineMap[d]) {
        byDisciplineMap[d] = {
          discipline: d,
          total: 0,
          done: 0,
          ongoing: 0,
          not_yet: 0,
          bh_signed: 0,
          cu_signed: 0,
          both_signed: 0,
          done_unsigned: 0,
          pct_done: 0
        };
      }
      const dm = byDisciplineMap[d];
      dm.total++;
      if (a.status === "Done") dm.done++;
      else if (a.status === "Ongoing") dm.ongoing++;
      else dm.not_yet++;
      if (a.bh_signed) dm.bh_signed++;
      if (a.cu_signed) dm.cu_signed++;
      if (a.both_signed) dm.both_signed++;
      if (a.done_unsigned) dm.done_unsigned++;
    });

    const denom = total - na;
    const pct_done = denom > 0 ? Number(((done / denom) * 100).toFixed(1)) : 0;
    const pct_bh = total > 0 ? Number(((bh_signed / total) * 100).toFixed(1)) : 0;
    const pct_cu = total > 0 ? Number(((cu_signed / total) * 100).toFixed(1)) : 0;
    const pct_both = total > 0 ? Number(((both_signed / total) * 100).toFixed(1)) : 0;

    const disciplines = [];
    const allDiscKeys = Object.keys(byDisciplineMap).sort((a, b) => {
      const ia = CORE_DISCIPLINES.indexOf(a);
      const ib = CORE_DISCIPLINES.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    allDiscKeys.forEach((k) => {
      const dm = byDisciplineMap[k];
      dm.pct_done = dm.total > 0 ? Number(((dm.done / dm.total) * 100).toFixed(1)) : 0;
      disciplines.push(dm);
    });

    return {
      total,
      done,
      ongoing,
      not_yet,
      na,
      pct_done,
      bh_signed,
      cu_signed,
      both_signed,
      bh_only,
      cu_only,
      done_unsigned,
      unsigned,
      pct_bh,
      pct_cu,
      pct_both,
      disciplines
    };
  }

  function getSectionTitle(secCode) {
    if (!state.data || !state.data.units) return "";
    const u1 = state.data.units["GTG#1"];
    if (u1 && u1.sections) {
      const found = u1.sections.find((s) => s.section === secCode);
      if (found) return found.title;
    }
    return "";
  }

  function buildFilterDescription(criteria) {
    const parts = [];
    if (!criteria.unit || criteria.unit === "ALL") {
      parts.push("Unit: All Equipment (GTG#1 & GTG#2)");
    } else if (criteria.unit === "GTG#1") {
      parts.push("Unit: GTG#1 (CPPT-PK-1101)");
    } else if (criteria.unit === "GTG#2") {
      parts.push("Unit: GTG#2 (CPPT-PK-2101)");
    }

    if (criteria.scheduledOnly) {
      parts.push("Scope: Scheduled Inspections");
    }
    if (criteria.scheduleDate && criteria.scheduleDate !== "ALL") {
      parts.push(`Scheduled Date: ${formatShortDate(criteria.scheduleDate)} (${criteria.scheduleDate})`);
    }
    if (criteria.closingWorkDate && criteria.closingWorkDate !== "ALL") {
      parts.push(`Work Date: ${formatWorkDateLabel(criteria.closingWorkDate)}`);
    }
    if (criteria.section && criteria.section !== "ALL") {
      const secTitle = getSectionTitle(criteria.section);
      parts.push(`System: ${criteria.section}${secTitle ? " - " + secTitle : ""}`);
    }
    if (criteria.discipline && criteria.discipline !== "ALL") {
      parts.push(`Discipline: ${criteria.discipline}`);
    }
    if (criteria.status && criteria.status !== "ALL") {
      parts.push(`Status: ${criteria.status}`);
    }
    if (criteria.sigFilter && criteria.sigFilter !== "ALL") {
      const sigLabels = {
        BH_SIGNED: "BH Signed",
        BH_UNSIGNED: "BH Unsigned",
        CU_SIGNED: "CU Signed",
        CU_UNSIGNED: "CU Unsigned",
        BOTH_SIGNED: "Both Signed (BH & CU)",
        BH_ONLY: "BH Signed Only (Waiting CU)",
        CU_ONLY: "CU Signed Only (Waiting BH)",
        DONE_UNSIGNED: "Accepted (Done) but Unsigned",
        UNSIGNED: "Unsigned / Pending"
      };
      parts.push(`Signature: ${sigLabels[criteria.sigFilter] || criteria.sigFilter}`);
    }
    if (criteria.search && criteria.search.trim() !== "") {
      parts.push(`Search: "${criteria.search.trim()}"`);
    }
    return parts.join("  •  ");
  }

  function buildDetailUrl(criteria) {
    const params = new URLSearchParams();
    params.set("view", "detail");
    if (criteria.unit) params.set("unit", criteria.unit);
    if (criteria.section && criteria.section !== "ALL") params.set("section", criteria.section);
    if (criteria.discipline && criteria.discipline !== "ALL") params.set("discipline", criteria.discipline);
    if (criteria.status && criteria.status !== "ALL") params.set("status", criteria.status);
    if (criteria.sigFilter && criteria.sigFilter !== "ALL") params.set("sigFilter", criteria.sigFilter);
    if (criteria.scheduleDate && criteria.scheduleDate !== "ALL") params.set("scheduleDate", criteria.scheduleDate);
    if (criteria.scheduledOnly) params.set("scheduledOnly", "1");
    if (criteria.closingWorkDate && criteria.closingWorkDate !== "ALL") params.set("closingWorkDate", criteria.closingWorkDate);
    if (criteria.title) params.set("title", criteria.title);
    return `${window.location.pathname}?${params.toString()}`;
  }

  window.openDetailTab = function (criteria, forceNewWindow = false) {
    if (forceNewWindow || state.openMode === "NEW_WINDOW") {
      const url = buildDetailUrl(criteria);
      window.open(url, "_blank");
      return;
    }

    const keyParts = [
      criteria.unit || "ALL",
      criteria.section || "ALL",
      criteria.discipline || "ALL",
      criteria.status || "ALL",
      criteria.sigFilter || "ALL",
      criteria.scheduleDate || "ALL",
      criteria.scheduledOnly ? "SCHED" : "ALL",
      criteria.closingWorkDate || "ALL"
    ];
    const tabKey = "detail_" + keyParts.join("__").replace(/[^a-zA-Z0-9_#-]/g, "_");

    const existing = state.tabs.find((t) => t.id === tabKey);
    if (existing) {
      state.activeTabId = existing.id;
      renderAll();
      return;
    }

    let shortTitle = criteria.title || "";
    if (!shortTitle) {
      const uPrefix = criteria.unit && criteria.unit !== "ALL" ? criteria.unit : "All";
      if (criteria.scheduleDate && criteria.scheduleDate !== "ALL") {
        shortTitle = `${uPrefix} • ${formatShortDate(criteria.scheduleDate)}${
          criteria.discipline && criteria.discipline !== "ALL" ? " (" + criteria.discipline + ")" : ""
        }`;
      } else if (criteria.closingWorkDate && criteria.closingWorkDate !== "ALL") {
        const wLabel = formatWorkDateShort(criteria.closingWorkDate);
        const dSuffix = criteria.discipline && criteria.discipline !== "ALL" ? ` • ${criteria.discipline}` : "";
        shortTitle = `${uPrefix} • Closed ${wLabel}${dSuffix}`;
      } else if (criteria.section && criteria.section !== "ALL") {
        shortTitle = `${uPrefix} • Sec ${criteria.section}`;
      } else if (criteria.discipline && criteria.discipline !== "ALL") {
        shortTitle = `${uPrefix} • ${criteria.discipline}`;
      } else if (criteria.sigFilter && criteria.sigFilter !== "ALL") {
        shortTitle = `${uPrefix} • ${criteria.sigFilter}`;
      } else if (criteria.status && criteria.status !== "ALL") {
        shortTitle = `${uPrefix} • ${criteria.status}`;
      } else {
        shortTitle = `${uPrefix} • Details`;
      }
    }

    const newTab = {
      id: tabKey,
      title: shortTitle,
      type: "detail",
      closable: true,
      baseCriteria: {
        unit: criteria.unit || "ALL",
        section: criteria.section || "ALL",
        discipline: criteria.discipline || "ALL",
        status: criteria.status || "ALL",
        sigFilter: criteria.sigFilter || "ALL",
        scheduleDate: criteria.scheduleDate || "ALL",
        scheduledOnly: Boolean(criteria.scheduledOnly),
        closingWorkDate: criteria.closingWorkDate || "ALL"
      },
      subFilter: {
        search: "",
        status: "ALL",
        discipline: "ALL",
        sigFilter: "ALL"
      }
    };

    state.tabs.push(newTab);
    state.activeTabId = newTab.id;
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.switchTab = function (tabId) {
    state.activeTabId = tabId;
    renderAll();
  };

  window.closeTab = function (tabId, ev) {
    if (ev) ev.stopPropagation();
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    state.tabs.splice(idx, 1);
    if (state.activeTabId === tabId) {
      const nextTab = state.tabs[Math.max(0, idx - 1)] || state.tabs[0];
      state.activeTabId = nextTab ? nextTab.id : "summary";
    }
    renderAll();
  };

  window.closeAllDetailTabs = function () {
    state.tabs = state.tabs.filter((t) => !t.closable);
    state.activeTabId = "summary";
    renderAll();
  };

  window.setSelectedUnit = function (unit) {
    state.selectedUnit = unit;
    renderAll();
  };

  window.setOpenMode = function (mode) {
    state.openMode = mode;
    renderTopNav();
  };

  window.updateSummaryFilter = function (field, val) {
    state.summaryFilters[field] = val;
    if (field === "scheduleDiscipline") {
      renderInspectionScheduleSection();
    } else {
      renderSummarySystemsTable();
    }
  };

  window.updateDetailSubFilter = function (tabId, field, val) {
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    if (field === "reset") {
      tab.subFilter = { search: "", status: "ALL", discipline: "ALL", sigFilter: "ALL" };
      const searchInput = document.getElementById(`detail-search-${tabId}`);
      if (searchInput) searchInput.value = "";
    } else {
      tab.subFilter[field] = val;
    }
    renderDetailTabTableOnly(tab);
  };

  function normalizeDisciplineInBrowser(raw) {
    const s = String(raw || "").trim();
    if (!s) return "Unassigned";
    const sl = s.toLowerCase();
    if (sl.includes("electrical") || sl.includes("instrument") || sl.includes("e&i")) {
      return "Electrical & Instruments";
    }
    if (sl.includes("pip")) {
      return "Piping";
    }
    if (sl.includes("mech")) {
      return "Mechanical";
    }
    if (sl.includes("pre/com") || sl.includes("precom") || sl.includes("commissioning")) {
      return "Pre-Commissioning";
    }
    if (sl.includes("struct")) {
      return "Structural";
    }
    if (sl.includes("material") || sl.includes("mat")) {
      return "Material";
    }
    if (sl.includes("pkg") || sl.includes("package")) {
      return "Package";
    }
    if (sl.includes("civil")) {
      return "Civil";
    }
    return s;
  }

  function normalizeStatusInBrowser(raw) {
    const s = String(raw || "").trim();
    const sl = s.toLowerCase();
    if (sl === "done") return "Done";
    if (sl === "ongoing") return "Ongoing";
    if (sl === "not yet") return "Not yet";
    if (sl === "n/a" || sl === "na") return "N/A";
    return s || "Not yet";
  }

  function parseSigInBrowser(raw) {
    const s = String(raw || "").trim();
    const sl = s.toLowerCase();
    if (!s) return { signed: false, label: "Pending", raw: "" };
    if (sl.includes("signed") || sl.includes("done") || sl.includes("ok") || /^\d{4}-\d{2}-\d{2}/.test(s)) {
      return { signed: true, label: "Signed", raw: s };
    }
    return { signed: false, label: s, raw: s };
  }

  function parseScheduleCellInBrowser(raw) {
    const s = String(raw || "").trim();
    if (!s || s === "?") return [];
    const parts = s.split(/,\s*(?=[A-Za-z])/).map((p) => p.trim()).filter(Boolean);
    const items = [];
    parts.forEach((p) => {
      const pl = p.toLowerCase();
      let disc = p;
      if (pl.includes("mech")) disc = "Mechanical";
      else if (pl.includes("e&i") || pl.includes("elect") || pl.includes("inst")) disc = "Electrical & Instruments";
      else if (pl.includes("pip")) disc = "Piping";
      else if (pl.includes("mat")) disc = "Material";
      else if (pl.includes("struct")) disc = "Structural";
      else if (pl.includes("precom") || pl.includes("pre/com") || pl.includes("commission")) disc = "Pre-Commissioning";
      else if (pl.includes("pkg") || pl.includes("package")) disc = "Package";
      else if (pl.includes("civil")) disc = "Civil";
      else {
        const clean = p.replace(/[\d_#\s]+$/, "").trim();
        disc = clean || p;
      }

      const has1 = p.includes("1");
      const has2 = p.includes("2");
      let units = ["GTG#1", "GTG#2"];
      if (has1 && !has2) units = ["GTG#1"];
      else if (has2 && !has1) units = ["GTG#2"];

      items.push({
        raw: p,
        discipline: disc,
        units: units
      });
    });
    return items;
  }

  function parseWorkbookInBrowser(wb) {
    const unitsConfig = [
      { id: "GTG#1", summarySheet: "Summary GTC#1", checkSheet: "SQCL Check Sheet GTC#1" },
      { id: "GTG#2", summarySheet: "Summary GTC#2", checkSheet: "SQCL Check Sheet GTC#2" }
    ];

    const result = {
      project_info: {
        doc_title: "SITE QUALITY CHECK LIST (SQCL) – Doc. SOI0007689 Rev. 0",
        customer: "MCDERMOTT",
        owner: "PETROVIETNAM",
        location: "VIETNAM BLOCK B GAS PROJECT",
        contract_no: "MEC002",
        package_info: "PRODUCTION & PIPELINE COMPRESSOR GTG#1 & GTG#2",
        last_synced: new Date().toISOString().replace("T", " ").substring(0, 19)
      },
      schedule_dates: [],
      units: {}
    };

    let allSchedDates = [];

    unitsConfig.forEach((cfg) => {
      const uid = cfg.id;
      const wsSum = wb.Sheets[cfg.summarySheet];
      const wsChk = wb.Sheets[cfg.checkSheet];
      if (!wsSum || !wsChk) return;

      const sumData = XLSX.utils.sheet_to_json(wsSum, { header: 1, raw: false, defval: "" });
      const chkData = XLSX.utils.sheet_to_json(wsChk, { header: 1, raw: false, defval: "" });

      const dateCols = {};
      if (sumData.length > 2) {
        const headerRow = sumData[2] || [];
        for (let c = 11; c < headerRow.length; c++) {
          let val = String(headerRow[c] || "").trim();
          if (val) {
            val = val.split(" ")[0].trim();
            dateCols[c] = val;
            if (!allSchedDates.includes(val)) allSchedDates.push(val);
          }
        }
      }

      const sectionsMap = {};
      const sectionsList = [];
      for (let r = 3; r < sumData.length; r++) {
        const row = sumData[r] || [];
        const secCode = String(row[0] || "").trim();
        const titleRaw = String(row[1] || "").trim();
        const statusReview = String(row[2] || "").trim();
        const pdfSheet = String(row[9] || "").trim();
        if (!secCode && !titleRaw) continue;

        const scheduleNotes = [];
        for (const [cStr, dStr] of Object.entries(dateCols)) {
          const c = parseInt(cStr, 10);
          const cellVal = String(row[c] || "").trim();
          if (cellVal && cellVal !== "?") {
            const parsedItems = parseScheduleCellInBrowser(cellVal);
            scheduleNotes.push({
              date: dStr,
              note: cellVal,
              items: parsedItems
            });
          }
        }

        const secObj = {
          section: secCode,
          title: titleRaw,
          pdf_sheet: pdfSheet,
          status_review: statusReview,
          schedule: scheduleNotes,
          activities_count: 0,
          done: 0,
          ongoing: 0,
          not_yet: 0,
          na: 0,
          bh_signed: 0,
          cu_signed: 0,
          both_signed: 0,
          done_unsigned: 0,
          pct_done: 0.0
        };
        sectionsMap[secCode] = secObj;
        sectionsList.push(secObj);
      }

      const activities = [];
      let currentSecCode = "5.1";
      let currentSecTitle = "GENERAL";
      let secCounter = 0;

      for (let r = 8; r < chkData.length; r++) {
        const row = chkData[r] || [];
        const c1 = String(row[0] || "").trim();
        const c2 = String(row[1] || "").trim();

        if (!c1 && !c2) continue;

        if (c1 && !c2) {
          secCounter++;
          const m = c1.match(/^(\d+\.\d+)\s+(.*)$/);
          if (m) {
            currentSecCode = m[1];
            currentSecTitle = m[2].trim();
          } else {
            currentSecCode = `5.${secCounter}`;
            currentSecTitle = c1;
          }
          continue;
        }

        const actCode = c1;
        const parts = actCode.split(".");
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          const derivedSec = `${parts[0]}.${parts[1]}`;
          if (sectionsMap[derivedSec]) {
            currentSecCode = derivedSec;
          }
        }

        const secInfo = sectionsMap[currentSecCode] || { section: currentSecCode, title: currentSecTitle };

        const cleanCellVal = (v) => String(v || "").trim().replace(/\bP&I\b(?![Dd])/g, "P&ID");
        let sigDate = String(row[2] || "").trim().split(" ")[0];
        const bhSigInfo = parseSigInBrowser(row[3]);
        const cuSigInfo = parseSigInBrowser(row[4]);
        const bhRole = cleanCellVal(row[5]);
        const cuRole = cleanCellVal(row[6]);
        const refDoc = cleanCellVal(row[7]);
        const procedure = cleanCellVal(row[8]);
        const acceptance = cleanCellVal(row[9]);
        const checkType = cleanCellVal(row[10]);
        const serviceReport = cleanCellVal(row[11]);
        const note = cleanCellVal(row[12]);
        const picPmc = cleanCellVal(row[13]);
        const picPq = cleanCellVal(row[14]);
        const status = normalizeStatusInBrowser(row[15]);
        const rawRemarks = cleanCellVal(row[16]);
        const discipline = normalizeDisciplineInBrowser(rawRemarks);
        const siteMarkup = cleanCellVal(row[17]);
        const pdfSheet = cleanCellVal(row[18]);
        const statusUpdate = cleanCellVal(row[19]);

        if (!sigDate && /^\d{4}-\d{2}-\d{2}/.test(cuSigInfo.raw)) {
          sigDate = cuSigInfo.raw.substring(0, 10);
        }

        const bhSigned = bhSigInfo.signed;
        const cuSigned = cuSigInfo.signed;
        const bothSigned = bhSigned && cuSigned;

        let sigStatus = "Unsigned";
        if (bothSigned) sigStatus = "Both Signed";
        else if (bhSigned && !cuSigned) sigStatus = "BH Signed Only";
        else if (cuSigned && !bhSigned) sigStatus = "CU Signed Only";

        const doneUnsigned = (status === "Done") && (!bothSigned);

        const actItem = {
          id: `${uid}-${actCode}`,
          row_num: r + 1,
          unit: uid,
          activity: actCode,
          section: currentSecCode,
          section_title: secInfo.title,
          description: c2,
          sig_date: sigDate,
          bh_signed: bhSigned,
          cu_signed: cuSigned,
          both_signed: bothSigned,
          sig_status: sigStatus,
          bh_sig_raw: bhSigInfo.raw,
          cu_sig_raw: cuSigInfo.raw,
          bh_role: bhRole,
          cu_role: cuRole,
          ref_doc: refDoc,
          procedure: procedure,
          acceptance: acceptance,
          check_type: checkType,
          service_report: serviceReport,
          note: note,
          pic_pmc: picPmc,
          pic_pq: picPq,
          status: status,
          discipline: discipline,
          remarks_raw: rawRemarks,
          site_markup: siteMarkup,
          pdf_sheet: pdfSheet || secInfo.pdf_sheet,
          status_update: statusUpdate,
          done_unsigned: doneUnsigned
        };

        activities.push(actItem);
      }

      const totalActs = activities.length;
      let totalDone = 0, totalOngoing = 0, totalNotYet = 0, totalNa = 0;
      let totalBhSigned = 0, totalCuSigned = 0, totalBothSigned = 0, totalDoneUnsigned = 0;

      const discMap = {};

      activities.forEach((a) => {
        if (a.status === "Done") totalDone++;
        else if (a.status === "Ongoing") totalOngoing++;
        else if (a.status === "N/A") totalNa++;
        else totalNotYet++;

        if (a.bh_signed) totalBhSigned++;
        if (a.cu_signed) totalCuSigned++;
        if (a.both_signed) totalBothSigned++;
        if (a.done_unsigned) totalDoneUnsigned++;

        if (!discMap[a.discipline]) {
          discMap[a.discipline] = {
            discipline: a.discipline,
            total: 0,
            done: 0,
            ongoing: 0,
            not_yet: 0,
            bh_signed: 0,
            cu_signed: 0,
            both_signed: 0,
            pct_done: 0.0
          };
        }
        const dm = discMap[a.discipline];
        dm.total++;
        if (a.status === "Done") dm.done++;
        else if (a.status === "Ongoing") dm.ongoing++;
        else dm.not_yet++;
        if (a.bh_signed) dm.bh_signed++;
        if (a.cu_signed) dm.cu_signed++;
        if (a.both_signed) dm.both_signed++;

        const sec = sectionsMap[a.section];
        if (sec) {
          sec.activities_count++;
          if (a.status === "Done") sec.done++;
          else if (a.status === "Ongoing") sec.ongoing++;
          else if (a.status === "N/A") sec.na++;
          else sec.not_yet++;
          if (a.bh_signed) sec.bh_signed++;
          if (a.cu_signed) sec.cu_signed++;
          if (a.both_signed) sec.both_signed++;
          if (a.done_unsigned) sec.done_unsigned++;
        }
      });

      sectionsList.forEach((s) => {
        s.pct_done = s.activities_count > 0 ? Math.round((s.done / s.activities_count) * 1000) / 10 : 0.0;
      });

      const discList = Object.values(discMap);
      discList.forEach((dm) => {
        dm.pct_done = dm.total > 0 ? Math.round((dm.done / dm.total) * 1000) / 10 : 0.0;
      });
      discList.sort((a, b) => b.total - a.total);

      const pctDone = totalActs > 0 ? Math.round((totalDone / totalActs) * 1000) / 10 : 0.0;

      result.units[uid] = {
        name: uid === "GTG#1" ? "GTG#1 (CPPT-PK-1101)" : "GTG#2 (CPPT-PK-2101)",
        tag: uid === "GTG#1" ? "CPPT-PK-1101" : "CPPT-PK-2101",
        kpis: {
          total: totalActs,
          done: totalDone,
          ongoing: totalOngoing,
          not_yet: totalNotYet,
          na: totalNa,
          pct_done: pctDone,
          bh_signed: totalBhSigned,
          cu_signed: totalCuSigned,
          both_signed: totalBothSigned,
          done_unsigned: totalDoneUnsigned
        },
        disciplines: discList,
        sections: sectionsList,
        activities: activities
      };
    });

    result.schedule_dates = allSchedDates.sort();
    return result;
  }

  window.syncFromOneDrive = async function (customUrl) {
    const btn = document.getElementById("btn-sync-onedrive");
    const statusText = document.getElementById("sync-status-text");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Syncing...`;
    }

    // Always push pending local edits to cloud/local server first before pulling
    try {
      await pushAllPendingEditsSilently();
    } catch (pushErr) {
      console.warn("Pre-sync push pending edits error:", pushErr);
    }

    let synced = false;

    // 1. Attempt server endpoints (Local Python server, Vercel Serverless)
    const customBackendUrl = localStorage.getItem("SQCL_BACKEND_URL") || "";
    const endpoints = [];
    if (customBackendUrl) {
      endpoints.push(`${customBackendUrl.replace(/\/+$/, "")}/api/sync`);
    }
    endpoints.push("/api/sync");
    endpoints.push("https://sqcl-dashboard.vercel.app/api/sync");
    endpoints.push("https://sqcl-dashboard-vu-ba-dien-s-projects.vercel.app/api/sync");
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      endpoints.push("http://localhost:8080/api/sync");
    }

    for (const endpoint of endpoints) {
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: customUrl || "" })
        });
        const contentType = resp.headers.get("content-type") || "";
        if (!resp.ok || !contentType.includes("application/json")) {
          continue;
        }

        const res = await resp.json();
        if (res && res.status === "ok" && res.data) {
          applyLocalEdits(res.data);
          state.data = res.data;
          window.SQCL_INITIAL_DATA = res.data;
          if (res.ledger) {
            state.closingLedger = res.ledger;
            window.SQCL_CLOSING_LEDGER = res.ledger;
            saveClosingLedger(res.ledger);
          }
          ensureDataLedgerConsistency();
          try {
            localStorage.setItem("SQCL_OFFLINE_DATA", JSON.stringify(res.data));
          } catch (e) {}
          if (statusText) {
            statusText.textContent = `Last Synced: ${res.data.project_info.last_synced || new Date().toLocaleTimeString()}`;
          }
          showToast("✓ Synced latest data from OneDrive successfully!", "success");
          renderAll();
          synced = true;
          break;
        }
      } catch (err) {
        // Network or CORS failure
      }
    }

    // 2. Direct fallback to repository data (auto-synced from OneDrive via GitHub Actions)
    if (!synced) {
      const dataFallbacks = [
        `./sqcl_data.json?t=${Date.now()}`,
        `https://raw.githubusercontent.com/vubadien1983-droid/sqcl-dashboard/main/sqcl_data.json?t=${Date.now()}`
      ];
      for (const fbUrl of dataFallbacks) {
        try {
          const resp = await fetch(fbUrl);
          if (resp.ok) {
            const freshData = await resp.json();
            if (freshData && freshData.units && freshData.units["GTG#1"]) {
              applyLocalEdits(freshData);
              state.data = freshData;
              window.SQCL_INITIAL_DATA = freshData;
              try {
                localStorage.setItem("SQCL_OFFLINE_DATA", JSON.stringify(freshData));
              } catch (e) {}

              // Also fetch matching closing ledger
              try {
                const ledgerUrl = fbUrl.replace("sqcl_data.json", "sqcl_closing_ledger.json");
                const lResp = await fetch(ledgerUrl);
                if (lResp.ok) {
                  const freshLedger = await lResp.json();
                  if (freshLedger && freshLedger.records) {
                    state.closingLedger = freshLedger;
                    window.SQCL_CLOSING_LEDGER = freshLedger;
                    saveClosingLedger(freshLedger);
                  }
                }
              } catch (lErr) {}

              ensureDataLedgerConsistency();
              if (statusText) {
                statusText.textContent = `Last Synced: ${(freshData.project_info && freshData.project_info.last_synced) || new Date().toLocaleTimeString()}`;
              }
              showToast("✓ Synced latest data from OneDrive successfully!", "success");
              renderAll();
              synced = true;
              break;
            }
          }
        } catch (fbErr) {}
      }
    }

    // 3. If offline, keep working seamlessly with local cache
    if (!synced) {
      if (state.data) {
        applyLocalEdits(state.data);
        ensureDataLedgerConsistency();
        renderAll();
        if (statusText) {
          statusText.textContent = `Last Synced: ${new Date().toLocaleTimeString()} (Offline Cache)`;
        }
        showToast("✓ Data synchronized with local cache.", "info");
      } else {
        showToast("Offline mode: Working with current data.", "info");
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-sync-alt mr-1"></i> Sync OneDrive`;
    }
  };

  // Local Excel (.xlsx) file upload: in-browser parsing with SheetJS
  window.handleLocalExcelUpload = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    showToast("Processing uploaded Excel file directly in browser...", "info");
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const parsedData = parseWorkbookInBrowser(workbook);

        if (!parsedData || !parsedData.units || !parsedData.units["GTG#1"]) {
          throw new Error("Could not find required sheets (Summary GTC#1 & SQCL Check Sheet GTC#1) in uploaded file.");
        }

        state.data = parsedData;
        window.SQCL_INITIAL_DATA = parsedData;
        ensureDataLedgerConsistency();
        try {
          localStorage.setItem("SQCL_OFFLINE_DATA", JSON.stringify(parsedData));
        } catch (storageErr) {}

        const statusText = document.getElementById("sync-status-text");
        if (statusText) {
          statusText.textContent = `Uploaded: ${parsedData.project_info.last_synced}`;
        }

        const totalActivities =
          (parsedData.units["GTG#1"].activities.length || 0) +
          ((parsedData.units["GTG#2"] && parsedData.units["GTG#2"].activities.length) || 0);

        showToast(`Successfully parsed and loaded ${totalActivities} activities from Excel!`, "success");
        closeSourceModal();
        renderAll();
      } catch (err) {
        showToast("Error parsing Excel file: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  window.showToast = function (msg, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    const colors =
      type === "success"
        ? "bg-emerald-600 text-white"
        : type === "error"
        ? "bg-rose-600 text-white"
        : "bg-slate-800 text-white";
    const icon =
      type === "success"
        ? "fa-check-circle"
        : type === "error"
        ? "fa-exclamation-triangle"
        : "fa-info-circle";
    el.className = `${colors} px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-medium transition-all duration-300 transform translate-y-0 opacity-100 z-50`;
    el.innerHTML = `<i class="fas ${icon} text-base"></i><span>${esc(msg)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => el.remove(), 300);
    }, 4000);
  };

  function getEffectiveDetailCriteria(tab) {
    const base = tab.baseCriteria;
    const sub = tab.subFilter;
    return {
      unit: base.unit,
      section: base.section,
      discipline: sub.discipline !== "ALL" ? sub.discipline : base.discipline,
      status: sub.status !== "ALL" ? sub.status : base.status,
      sigFilter: sub.sigFilter !== "ALL" ? sub.sigFilter : base.sigFilter,
      scheduleDate: base.scheduleDate,
      scheduledOnly: base.scheduledOnly,
      closingWorkDate: base.closingWorkDate,
      search: sub.search
    };
  }

  // Client-Side ExcelJS Export with Server fallback
  window.exportToExcel = async function (scopeType, tabId) {
    try {
      showToast("Generating formatted Excel (.xlsx) report...", "info");
      let payload = {};

      if (scopeType === "summary") {
        const unit = state.selectedUnit;
        const activities = getActivitiesByFilter({ unit });
        const stats = computeStats(activities);
        let sections = [];
        const unitKeys = unit === "ALL" ? ["GTG#1", "GTG#2"] : [unit];
        unitKeys.forEach((uk) => {
          const u = state.data.units[uk];
          if (u && u.sections) {
            u.sections.forEach((s) => sections.push(Object.assign({ unit: uk }, s)));
          }
        });
        payload = {
          title: "SQCL OVERALL SUMMARY & FULL CHECKLIST REPORT",
          filter_desc: buildFilterDescription({ unit }),
          stats,
          disciplines: stats.disciplines,
          sections,
          activities
        };
      } else {
        const tab = state.tabs.find((t) => t.id === tabId);
        if (!tab) return;
        const effectiveCriteria = getEffectiveDetailCriteria(tab);
        const activities = getActivitiesByFilter(effectiveCriteria);
        const stats = computeStats(activities);
        payload = {
          title: `SQCL DETAILED REPORT – ${tab.title.toUpperCase()}`,
          filter_desc: buildFilterDescription(effectiveCriteria),
          stats,
          disciplines: stats.disciplines,
          sections: [],
          activities
        };
      }

      // Try server export first if API available
      try {
        const resp = await fetch("/api/export-excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const safeName = (payload.title || "SQCL_Report").replace(/[^a-zA-Z0-9_-]/g, "_");
          a.href = url;
          a.download = `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          showToast("Excel (.xlsx) report exported successfully!", "success");
          return;
        }
      } catch (serverErr) {
        // Fallback to client-side ExcelJS below
      }

      // Fallback: Client-Side ExcelJS export
      if (window.ExcelJS) {
        await exportWithClientExcelJS(payload);
        showToast("Excel (.xlsx) report generated via client engine!", "success");
      } else {
        throw new Error("Excel export engine not available.");
      }
    } catch (err) {
      showToast("Excel Export Error: " + err.message, "error");
    }
  };

  async function exportWithClientExcelJS(payload) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("SQCL Report");
    ws.views = [{ showGridLines: true }];

    // Title banner
    ws.mergeCells("A1:P1");
    ws.getCell("A1").value = `VIETNAM BLOCK B GAS PROJECT  |  ${payload.title}`;
    ws.getCell("A1").font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    ws.getRow(1).height = 28;

    ws.mergeCells("A2:P2");
    ws.getCell("A2").value = `Doc: SOI0007689 Rev. 0 • Customer: MCDERMOTT PTSC CONSORTIUM (MPC) • Scope: ${payload.filter_desc}`;
    ws.getCell("A2").font = { name: "Calibri", size: 10, color: { argb: "FFE2E8F0" } };
    ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    ws.getRow(2).height = 20;

    // Header row
    const headers = [
      "Unit", "Section", "Activity", "Activity Description", "Remarks / Discipline",
      "Status", "BH Sig", "CU Sig", "Signature Date",
      "PIC (PMC)", "PIC (PQ/BV)", "NOTE", "Ref.Doc / Procedure / Criteria",
      "Site Markup", "PDF", "Status Update"
    ];
    ws.getRow(4).values = headers;
    ws.getRow(4).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    ws.getRow(4).height = 25;

    let curRow = 5;
    let lastSecKey = null;
    (payload.activities || []).forEach((a) => {
      const secKey = `${a.unit}__${a.section}`;
      if (secKey !== lastSecKey) {
        lastSecKey = secKey;
        ws.mergeCells(`A${curRow}:P${curRow}`);
        ws.getCell(`A${curRow}`).value = `[${a.unit}] SECTION ${a.section} — ${a.section_title} (PDF Sheet: ${a.pdf_sheet || "-"})`;
        ws.getCell(`A${curRow}`).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E3A8A" } };
        ws.getCell(`A${curRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
        ws.getRow(curRow).height = 22;
        curRow++;
      }

      ws.getRow(curRow).values = [
        a.unit, a.section, a.activity, a.description, a.remarks_raw || a.discipline,
        a.status, a.bh_signed ? "Signed" : "Pending", a.cu_signed ? "Signed" : "Pending",
        a.sig_date || "",
        a.pic_pmc || "",
        a.pic_pq || "",
        a.note || "",
        [a.ref_doc ? a.ref_doc.replace(/\n/g, ", ") : "", a.procedure, a.acceptance].filter(Boolean).join(" | "),
        a.site_markup || "",
        a.pdf_sheet || "",
        a.status_update || ""
      ];
      curRow++;
    });

    const colWidths = [10, 10, 12, 45, 20, 12, 12, 12, 13, 16, 16, 25, 30, 25, 10, 30];
    colWidths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement("a");
    aEl.href = url;
    aEl.download = `SQCL_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(aEl);
    aEl.click();
    aEl.remove();
    URL.revokeObjectURL(url);
  }

  // Export to Professional PDF (.pdf)
  window.exportToPDF = function (scopeType, tabId) {
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast("PDF library is loading, please try again in a moment.", "error");
        return;
      }
      showToast("Generating formatted A4 Landscape PDF report...", "info");

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      let fontName = "helvetica";
      if (window.ROBOTO_REGULAR_B64 && window.ROBOTO_BOLD_B64) {
        doc.addFileToVFS("Roboto-Regular.ttf", window.ROBOTO_REGULAR_B64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.addFileToVFS("Roboto-Bold.ttf", window.ROBOTO_BOLD_B64);
        doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
        doc.setFont("Roboto", "normal");
        fontName = "Roboto";
      }

      let reportTitle = "";
      let filterDesc = "";
      let activities = [];
      let stats = null;
      let sections = [];

      if (scopeType === "summary") {
        const unit = state.selectedUnit;
        activities = getActivitiesByFilter({ unit });
        stats = computeStats(activities);
        reportTitle = "SQCL PROGRESS EXECUTIVE SUMMARY REPORT";
        filterDesc = buildFilterDescription({ unit });
        const unitKeys = unit === "ALL" ? ["GTG#1", "GTG#2"] : [unit];
        unitKeys.forEach((uk) => {
          const u = state.data.units[uk];
          if (u && u.sections) {
            u.sections.forEach((s) => sections.push(Object.assign({ unit: uk }, s)));
          }
        });
      } else {
        const tab = state.tabs.find((t) => t.id === tabId);
        if (!tab) return;
        const effectiveCriteria = getEffectiveDetailCriteria(tab);
        activities = getActivitiesByFilter(effectiveCriteria);
        stats = computeStats(activities);
        reportTitle = `SQCL DETAILED INSPECTION REPORT – ${tab.title.toUpperCase()}`;
        filterDesc = buildFilterDescription(effectiveCriteria);
      }

      const nowStr = new Date().toLocaleString("en-GB");

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(10, 8, 277, 18, "F");
      doc.setFont(fontName, "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(`VIETNAM BLOCK B GAS PROJECT  |  ${reportTitle}`, 14, 15.5);

      doc.setFont(fontName, "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(226, 232, 240);
      doc.text(
        `Doc. SOI0007689 Rev. 0  •  Customer: MCDERMOTT PTSC CONSORTIUM (MPC)  •  Vendor: BAKER HUGHES  •  Exported: ${nowStr}`,
        14,
        22
      );

      // Filter Scope Bar
      doc.setFillColor(239, 246, 255);
      doc.rect(10, 27, 277, 7, "F");
      doc.setFont(fontName, "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 138);
      doc.text(`Filter Scope: ${filterDesc}`, 14, 31.8);

      // 1. Summary KPI Table
      doc.setFont(fontName, "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("I. EXECUTIVE SUMMARY OVERVIEW (ACCEPTANCE STATUS & SIGNATURES)", 10, 39);

      doc.autoTable({
        startY: 41,
        margin: { left: 10, right: 10 },
        styles: {
          font: fontName,
          fontSize: 8.5,
          cellPadding: 2.2,
          halign: "center",
          valign: "middle",
          lineWidth: 0.15,
          lineColor: [203, 213, 225]
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        bodyStyles: {
          fontStyle: "bold",
          textColor: [15, 23, 42]
        },
        head: [
          [
            "Total Activities",
            "Accepted (Done)",
            "Ongoing",
            "Pending (Not yet)",
            "% Completion",
            "BH Signed",
            "CU Signed",
            "Both Signed",
            "Done (Unsigned)",
            "Unsigned"
          ]
        ],
        body: [
          [
            stats.total,
            stats.done,
            stats.ongoing,
            stats.not_yet,
            `${stats.pct_done}%`,
            `${stats.bh_signed} (${stats.pct_bh}%)`,
            `${stats.cu_signed} (${stats.pct_cu}%)`,
            `${stats.both_signed} (${stats.pct_both}%)`,
            stats.done_unsigned,
            stats.unsigned
          ]
        ]
      });

      // 2. Discipline Breakdown Table
      let nextY = doc.lastAutoTable.finalY + 5;
      doc.setFont(fontName, "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("II. PROGRESS BREAKDOWN BY DISCIPLINE", 10, nextY);

      doc.autoTable({
        startY: nextY + 2,
        margin: { left: 10, right: 10 },
        styles: {
          font: fontName,
          fontSize: 8,
          cellPadding: 1.8,
          halign: "center",
          valign: "middle",
          lineWidth: 0.15,
          lineColor: [203, 213, 225]
        },
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 55 }
        },
        head: [
          [
            "Discipline / Group",
            "Total Activities",
            "Done",
            "Ongoing",
            "Not yet",
            "% Done",
            "BH Signed",
            "CU Signed",
            "Both Signed"
          ]
        ],
        body: stats.disciplines.map((d) => [
          d.discipline === "Unassigned" ? "General / Unassigned" : d.discipline,
          d.total,
          d.done,
          d.ongoing,
          d.not_yet,
          `${d.pct_done}%`,
          d.bh_signed,
          d.cu_signed,
          d.both_signed
        ])
      });

      nextY = doc.lastAutoTable.finalY + 6;

      if (scopeType === "summary" && sections.length > 0) {
        doc.setFont(fontName, "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`III. SYSTEM PROGRESS SUMMARY TABLE (${sections.length} SYSTEMS)`, 10, nextY);

        doc.autoTable({
          startY: nextY + 2,
          margin: { left: 10, right: 10 },
          styles: {
            font: fontName,
            fontSize: 7.8,
            cellPadding: 1.8,
            valign: "middle",
            lineWidth: 0.15,
            lineColor: [203, 213, 225]
          },
          headStyles: {
            fillColor: [30, 58, 138],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center"
          },
          head: [
            ["Unit", "Section", "System Title", "PDF", "Activities", "Done", "Ongoing", "Not yet", "% Done", "BH Signed", "CU Signed"]
          ],
          body: sections.map((s) => [
            s.unit, s.section, s.title, s.pdf_sheet, s.activities_count,
            s.done, s.ongoing, s.not_yet, `${s.pct_done}%`, s.bh_signed, s.cu_signed
          ])
        });
      } else {
        if (nextY > 175) {
          doc.addPage();
          nextY = 14;
        }
        doc.setFont(fontName, "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`III. DETAILED SQCL INSPECTION CHECKLIST (${activities.length} ACTIVITIES)`, 10, nextY);

        const pdfRows = [];
        let lastSecKey = null;
        activities.forEach((a) => {
          const secKey = `${a.unit}__${a.section}`;
          if (secKey !== lastSecKey) {
            lastSecKey = secKey;
            pdfRows.push([
              {
                content: `[${a.unit}] SECTION ${a.section} — ${a.section_title}  (PDF Sheet: ${a.pdf_sheet || "-"})`,
                colSpan: 13,
                styles: {
                  fillColor: [219, 234, 254],
                  textColor: [30, 58, 138],
                  fontStyle: "bold",
                  halign: "left"
                }
              }
            ]);
          }
          pdfRows.push([
            a.unit,
            a.activity,
            a.description,
            a.discipline === "Unassigned" ? "General" : a.discipline,
            a.status,
            `${a.bh_signed ? "Signed" : "Pending"}${a.bh_role ? " (" + a.bh_role + ")" : ""}`,
            `${a.cu_signed ? "Signed" : "Pending"}${a.cu_role ? " (" + a.cu_role + ")" : ""}`,
            a.sig_date || "-",
            [a.pic_pmc, a.pic_pq].filter(Boolean).join(" / ") || "-",
            a.note || "-",
            [a.site_markup ? a.site_markup.replace(/\n/g, "; ") : "", a.ref_doc ? a.ref_doc.split("\n")[0] : ""].filter(Boolean).join(" | ") || "-",
            a.pdf_sheet || "-",
            a.status_update || "-"
          ]);
        });

        doc.autoTable({
          startY: nextY + 2,
          margin: { left: 10, right: 10, bottom: 14 },
          styles: {
            font: fontName,
            fontSize: 7.5,
            cellPadding: 1.8,
            valign: "middle",
            lineWidth: 0.15,
            lineColor: [203, 213, 225],
            overflow: "linebreak"
          },
          headStyles: {
            fillColor: [30, 58, 138],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center"
          },
          head: [
            ["Unit", "Activity", "Activity Description", "Discipline", "Status", "BH Signature", "CU Signature", "Sig Date", "PIC (PMC/PQ)", "NOTE", "Site Markup / Ref Doc", "PDF", "Status Update"]
          ],
          body: pdfRows
        });
      }

      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont(fontName, "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `VIETNAM BLOCK B GAS PROJECT  •  SOI0007689 SQCL Check List Dashboard  •  Page ${p} of ${totalPages}`,
          148.5,
          204,
          { align: "center" }
        );
      }

      const safeFile = reportTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45);
      doc.save(`${safeFile}_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast("PDF (.pdf) report exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("PDF Export Error: " + err.message, "error");
    }
  };

  // Render Top Navigation & Multi-Tab Bar
  function renderTopNav() {
    const tabBarEl = document.getElementById("multi-tab-bar");
    if (!tabBarEl) return;

    const detailCount = state.tabs.filter((t) => t.closable).length;

    let tabsHtml = state.tabs
      .map((t) => {
        const isActive = t.id === state.activeTabId;
        const activeClasses = isActive
          ? "bg-white text-blue-700 border-t-2 border-t-blue-600 font-bold shadow-sm"
          : "bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white";
        const icon = t.type === "summary" ? "fa-chart-pie text-blue-500" : "fa-list-check text-emerald-500";
        const closeBtn = t.closable
          ? `<button onclick="closeTab('${esc(t.id)}', event)" title="Close this tab" class="ml-2 w-5 h-5 rounded-full inline-flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors text-xs"><i class="fas fa-times"></i></button>`
          : "";
        return `
          <div onclick="switchTab('${esc(t.id)}')" class="cursor-pointer select-none px-3.5 py-2 rounded-t-xl flex items-center gap-2 text-xs sm:text-sm transition-all whitespace-nowrap ${activeClasses}">
            <i class="fas ${icon}"></i>
            <span>${esc(t.title)}</span>
            ${closeBtn}
          </div>
        `;
      })
      .join("");

    if (detailCount > 1) {
      tabsHtml += `
        <button onclick="closeAllDetailTabs()" class="ml-auto px-2.5 py-1 text-xs text-slate-300 hover:text-rose-300 flex items-center gap-1 whitespace-nowrap">
          <i class="fas fa-times-circle"></i> Close ${detailCount} Detail Tabs
        </button>
      `;
    }

    tabBarEl.innerHTML = tabsHtml;

    // Device Mode Switcher (Laptop vs Phone)
    const devToggleEl = document.getElementById("device-mode-toggle");
    if (devToggleEl) {
      const isPhone = state.deviceMode === "phone";
      devToggleEl.innerHTML = `
        <button onclick="setDeviceMode('laptop')" class="px-2 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
          !isPhone ? "bg-blue-600 text-white shadow" : "text-slate-300 hover:text-white"
        }">
          <i class="fas fa-laptop"></i> Laptop
        </button>
        <button onclick="setDeviceMode('phone')" class="px-2 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
          isPhone ? "bg-blue-600 text-white shadow" : "text-slate-300 hover:text-white"
        }">
          <i class="fas fa-mobile-screen"></i> Phone
        </button>
      `;
    }

    const modeToggleEl = document.getElementById("open-mode-toggle");
    if (modeToggleEl) {
      const isInApp = state.openMode === "IN_APP";
      modeToggleEl.innerHTML = `
        <button onclick="setOpenMode('IN_APP')" class="px-2 py-1 rounded-lg text-xs font-medium transition-all ${
          isInApp ? "bg-blue-600 text-white shadow" : "text-slate-300 hover:text-white"
        }" title="Open Detail Tabs inside the top workspace bar">
          <i class="fas fa-folder-plus mr-1"></i>In-App
        </button>
        <button onclick="setOpenMode('NEW_WINDOW')" class="px-2 py-1 rounded-lg text-xs font-medium transition-all ${
          !isInApp ? "bg-blue-600 text-white shadow" : "text-slate-300 hover:text-white"
        }" title="Open Detail Views in a new Browser Tab">
          <i class="fas fa-external-link-alt mr-1"></i>New Tab
        </button>
      `;
    }
  }

  function renderAll() {
    renderTopNav();
    const summaryContainer = document.getElementById("view-summary");
    const detailContainer = document.getElementById("view-detail");

    if (state.activeTabId === "summary") {
      summaryContainer.classList.remove("hidden");
      detailContainer.classList.add("hidden");
      renderSummaryView();
    } else {
      summaryContainer.classList.add("hidden");
      detailContainer.classList.remove("hidden");
      const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
      if (activeTab) {
        renderDetailView(activeTab);
      }
    }
  }

  function renderSummaryView() {
    const unit = state.selectedUnit;
    const allActivities = getActivitiesByFilter({ unit });
    const stats = computeStats(allActivities);

    const gtg1Stats = computeStats(getActivitiesByFilter({ unit: "GTG#1" }));
    const gtg2Stats = computeStats(getActivitiesByFilter({ unit: "GTG#2" }));

    // 1. Unit Switcher Buttons
    const unitSwitcherEl = document.getElementById("unit-switcher");
    if (unitSwitcherEl) {
      const units = [
        { id: "ALL", label: "All Equipment (GTG#1 & GTG#2)", sub: `${gtg1Stats.total + gtg2Stats.total} activities`, icon: "fa-layer-group" },
        { id: "GTG#1", label: "GTG#1 (CPPT-PK-1101)", sub: `${gtg1Stats.done}/${gtg1Stats.total} Done (${gtg1Stats.pct_done}%)`, icon: "fa-cogs" },
        { id: "GTG#2", label: "GTG#2 (CPPT-PK-2101)", sub: `${gtg2Stats.done}/${gtg2Stats.total} Done (${gtg2Stats.pct_done}%)`, icon: "fa-cogs" }
      ];
      unitSwitcherEl.innerHTML = units
        .map((u) => {
          const active = state.selectedUnit === u.id;
          return `
            <button onclick="setSelectedUnit('${u.id}')" class="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl border text-left transition-all flex items-center justify-between ${
              active
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"
            }">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center ${
                  active ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                }">
                  <i class="fas ${u.icon}"></i>
                </div>
                <div>
                  <div class="font-bold text-xs sm:text-sm">${esc(u.label)}</div>
                  <div class="text-[11px] ${active ? "text-blue-100" : "text-slate-500"}">${esc(u.sub)}</div>
                </div>
              </div>
              ${active ? `<span class="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"></span>` : ""}
            </button>
          `;
        })
        .join("");
    }

    // 2. Top 6 KPI Cards
    const kpiContainer = document.getElementById("summary-kpi-cards");
    if (kpiContainer) {
      kpiContainer.innerHTML = `
        <div onclick='openDetailTab({unit:"${unit}", title:"${unit} • All Activities"})' class="group cursor-pointer bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Activities</p>
              <h3 class="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">${stats.total.toLocaleString()}</h3>
            </div>
            <div class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <i class="fas fa-clipboard-list text-base"></i>
            </div>
          </div>
          <div class="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>46 Systems</span>
            <span class="text-blue-600 font-semibold">Details <i class="fas fa-arrow-right ml-0.5"></i></span>
          </div>
        </div>

        <div onclick='openDetailTab({unit:"${unit}", status:"Done", title:"${unit} • Status: Done"})' class="group cursor-pointer bg-white rounded-2xl p-3.5 border border-emerald-200 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Accepted (Done)</p>
              <div class="flex items-baseline gap-1.5 mt-1">
                <h3 class="text-xl sm:text-2xl font-extrabold text-emerald-600">${stats.done.toLocaleString()}</h3>
                <span class="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">${stats.pct_done}%</span>
              </div>
            </div>
            <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <i class="fas fa-check-double text-base"></i>
            </div>
          </div>
          <div class="mt-2.5 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div class="bg-emerald-500 h-full rounded-full" style="width: ${stats.pct_done}%"></div>
          </div>
          <div class="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Ongoing: <strong class="text-amber-600">${stats.ongoing}</strong></span>
            <span class="text-emerald-700 font-semibold">Inspect <i class="fas fa-arrow-right ml-0.5"></i></span>
          </div>
        </div>

        <div onclick='openDetailTab({unit:"${unit}", status:"Not yet", title:"${unit} • Status: Not yet"})' class="group cursor-pointer bg-white rounded-2xl p-3.5 border border-rose-200 shadow-sm hover:shadow-md hover:border-rose-400 transition-all">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Pending (Not yet)</p>
              <div class="flex items-baseline gap-1.5 mt-1">
                <h3 class="text-xl sm:text-2xl font-extrabold text-rose-600">${stats.not_yet.toLocaleString()}</h3>
                <span class="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800">${(100 - stats.pct_done).toFixed(1)}%</span>
              </div>
            </div>
            <div class="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <i class="fas fa-hourglass-half text-base"></i>
            </div>
          </div>
          <div class="mt-2.5 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div class="bg-rose-500 h-full rounded-full" style="width: ${(100 - stats.pct_done).toFixed(1)}%"></div>
          </div>
          <div class="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Remaining</span>
            <span class="text-rose-600 font-semibold">Inspect <i class="fas fa-arrow-right ml-0.5"></i></span>
          </div>
        </div>

        <div onclick='openDetailTab({unit:"${unit}", sigFilter:"BH_SIGNED", title:"${unit} • BH Signed"})' class="group cursor-pointer bg-white rounded-2xl p-3.5 border border-indigo-200 shadow-sm hover:shadow-md hover:border-indigo-500 transition-all">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">BH Signed (Baker Hughes)</p>
              <div class="flex items-baseline gap-1.5 mt-1">
                <h3 class="text-xl sm:text-2xl font-extrabold text-indigo-600">${stats.bh_signed.toLocaleString()}</h3>
                <span class="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">${stats.pct_bh}%</span>
              </div>
            </div>
            <div class="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <i class="fas fa-file-signature text-base"></i>
            </div>
          </div>
          <div class="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Waiting CU: <strong class="text-amber-600">${stats.bh_only}</strong></span>
            <span class="text-indigo-600 font-semibold">Inspect <i class="fas fa-arrow-right ml-0.5"></i></span>
          </div>
        </div>

        <div onclick='openDetailTab({unit:"${unit}", sigFilter:"CU_SIGNED", title:"${unit} • CU Signed (Customer MPC)"})' class="group cursor-pointer bg-white rounded-2xl p-3.5 border border-teal-200 shadow-sm hover:shadow-md hover:border-teal-500 transition-all">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-teal-700">CU Signed (Customer MPC)</p>
              <div class="flex items-baseline gap-1.5 mt-1">
                <h3 class="text-xl sm:text-2xl font-extrabold text-teal-600">${stats.cu_signed.toLocaleString()}</h3>
                <span class="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800">${stats.pct_cu}%</span>
              </div>
            </div>
            <div class="w-9 h-9 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <i class="fas fa-stamp text-base"></i>
            </div>
          </div>
          <div class="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Both Signed: <strong class="text-emerald-600">${stats.both_signed}</strong></span>
            <span class="text-teal-700 font-semibold">Inspect <i class="fas fa-arrow-right ml-0.5"></i></span>
          </div>
        </div>

        <div onclick='openDetailTab({unit:"${unit}", sigFilter:"DONE_UNSIGNED", title:"${unit} • Done (Pending Signature)"})' class="group cursor-pointer bg-amber-50/70 rounded-2xl p-3.5 border border-amber-300 shadow-sm hover:shadow-md hover:border-amber-500 transition-all">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Done - Pending Sign-Off</p>
              <div class="flex items-baseline gap-1.5 mt-1">
                <h3 class="text-xl sm:text-2xl font-extrabold text-amber-600">${stats.done_unsigned.toLocaleString()}</h3>
                <span class="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900">Urgent</span>
              </div>
            </div>
            <div class="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <i class="fas fa-pen-nib text-base"></i>
            </div>
          </div>
          <div class="mt-2.5 flex items-center justify-between text-[11px] text-amber-800">
            <span>Missing sign-off</span>
            <span class="font-bold underline">Check <i class="fas fa-arrow-right ml-0.5"></i></span>
          </div>
        </div>
      `;
    }

    // 3. Equipment Comparison Cards
    const equipCompEl = document.getElementById("equipment-comparison-grid");
    if (equipCompEl) {
      const unitsRender = [
        { id: "GTG#1", name: "GTG#1 (CPPT-PK-1101)", desc: "GT G14537 / Comp. C20987 • BH Job 1604149", st: gtg1Stats },
        { id: "GTG#2", name: "GTG#2 (CPPT-PK-2101)", desc: "GT G14538 / Comp. C20988 • BH Job 1604150", st: gtg2Stats }
      ];
      equipCompEl.innerHTML = unitsRender
        .map((u) => {
          const st = u.st;
          return `
            <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
              <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold text-xs">${esc(u.id)}</span>
                    <h4 class="font-bold text-slate-900 text-sm sm:text-base">${esc(u.name)}</h4>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">${esc(u.desc)}</p>
                </div>
                <div class="flex items-center gap-1.5">
                  <button onclick='openDetailTab({unit:"${u.id}", title:"${u.id} • Full Checklist"})' class="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-semibold transition-colors">
                    <i class="fas fa-search-plus mr-1"></i>View ${esc(u.id)} Details
                  </button>
                  <button onclick='openDetailTab({unit:"${u.id}", title:"${u.id} • Full Checklist"}, true)' title="Open in New Browser Tab" class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs">
                    <i class="fas fa-external-link-alt"></i>
                  </button>
                </div>
              </div>

              <div class="mt-3">
                <div class="flex justify-between text-xs font-semibold mb-1">
                  <span class="text-slate-600">Overall Acceptance Progress</span>
                  <span class="text-emerald-600 font-bold">${st.done} / ${st.total} (${st.pct_done}%)</span>
                </div>
                <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div class="bg-emerald-500 h-full" style="width: ${st.pct_done}%"></div>
                  <div class="bg-amber-400 h-full" style="width: ${((st.ongoing / st.total) * 100).toFixed(1)}%"></div>
                </div>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5">
                <div onclick='openDetailTab({unit:"${u.id}", status:"Done", title:"${u.id} • Status: Done"})' class="cursor-pointer p-2 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200 transition-colors text-center">
                  <div class="text-[10px] font-semibold text-emerald-800">Accepted (Done)</div>
                  <div class="text-base font-extrabold text-emerald-600 mt-0.5">${st.done}</div>
                </div>
                <div onclick='openDetailTab({unit:"${u.id}", status:"Not yet", title:"${u.id} • Status: Not yet"})' class="cursor-pointer p-2 rounded-xl bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 transition-colors text-center">
                  <div class="text-[10px] font-semibold text-rose-800">Pending (Not yet)</div>
                  <div class="text-base font-extrabold text-rose-600 mt-0.5">${st.not_yet}</div>
                </div>
                <div onclick='openDetailTab({unit:"${u.id}", sigFilter:"BH_SIGNED", title:"${u.id} • BH Signed"})' class="cursor-pointer p-2 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 transition-colors text-center">
                  <div class="text-[10px] font-semibold text-indigo-800">BH Signed (${st.pct_bh}%)</div>
                  <div class="text-base font-extrabold text-indigo-600 mt-0.5">${st.bh_signed}</div>
                </div>
                <div onclick='openDetailTab({unit:"${u.id}", sigFilter:"CU_SIGNED", title:"${u.id} • CU Signed"})' class="cursor-pointer p-2 rounded-xl bg-teal-50/70 hover:bg-teal-100/80 border border-teal-200 transition-colors text-center">
                  <div class="text-[10px] font-semibold text-teal-800">CU Signed (${st.pct_cu}%)</div>
                  <div class="text-base font-extrabold text-teal-600 mt-0.5">${st.cu_signed}</div>
                </div>
              </div>

              <div class="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                ${st.disciplines
                  .slice(0, 5)
                  .map((d) => {
                    const dName = d.discipline === "Unassigned" ? "General" : d.discipline;
                    return `
                      <button onclick='openDetailTab({unit:"${u.id}", discipline:"${esc(d.discipline)}", title:"${u.id} • ${esc(dName)}"})' class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-800 text-slate-700 text-[11px] font-medium transition-colors">
                        ${esc(dName)}: <strong>${d.done}/${d.total}</strong> (${d.pct_done}%)
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          `;
        })
        .join("");
    }

    // 4. Status & Signature Panels
    renderStatusAndSignaturePanels(unit, stats);

    // 5. Discipline Summary Section
    renderDisciplineSummarySection(unit, stats);

    // 5B. Daily Closed Items Tracking Section (07:30 AM Cut-off)
    renderDailyClosingSection();

    // 6. Inspection Schedule by Discipline Section
    renderInspectionScheduleSection();

    // 7. Systems Summary Table (46 Systems)
    renderSummarySystemsTable();

    // 8. Charts
    renderSummaryCharts(unit, stats);
  }

  function renderStatusAndSignaturePanels(unit, stats) {
    const statusListEl = document.getElementById("status-breakdown-list");
    if (statusListEl) {
      const items = [
        { label: "Done (Accepted)", status: "Done", count: stats.done, pct: stats.pct_done, color: "emerald", icon: "fa-check-circle" },
        { label: "Ongoing (In Progress)", status: "Ongoing", count: stats.ongoing, pct: stats.total > 0 ? ((stats.ongoing / stats.total) * 100).toFixed(1) : 0, color: "amber", icon: "fa-spinner" },
        { label: "Not yet (Pending)", status: "Not yet", count: stats.not_yet, pct: stats.total > 0 ? ((stats.not_yet / stats.total) * 100).toFixed(1) : 0, color: "rose", icon: "fa-clock" }
      ];

      statusListEl.innerHTML = items
        .map((it) => {
          return `
            <div onclick='openDetailTab({unit:"${unit}", status:"${it.status}", title:"${unit} • Status: ${it.status}"})' class="cursor-pointer p-3 rounded-xl border border-${it.color}-200 bg-${it.color}-50/50 hover:bg-${it.color}-100/70 transition-all flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-${it.color}-500 text-white flex items-center justify-center text-xs">
                  <i class="fas ${it.icon}"></i>
                </div>
                <div>
                  <div class="font-bold text-slate-800 text-xs sm:text-sm">${esc(it.label)}</div>
                  <div class="text-[10px] text-slate-500">Click to inspect in Detail Tab</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-base font-extrabold text-${it.color}-700">${it.count.toLocaleString()}</div>
                <div class="text-[10px] font-semibold text-${it.color}-600">${it.pct}%</div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    const sigListEl = document.getElementById("signature-breakdown-list");
    if (sigListEl) {
      const sigItems = [
        { label: "Both Signed (BH & CU Complete)", sub: "Fully signed off by both Baker Hughes & Customer (MPC)", sigFilter: "BOTH_SIGNED", count: stats.both_signed, pct: stats.pct_both, badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200" },
        { label: "BH Signed Only (Waiting for CU)", sub: "Signed by Baker Hughes, pending Customer (MPC) signature", sigFilter: "BH_ONLY", count: stats.bh_only, pct: stats.total > 0 ? ((stats.bh_only / stats.total) * 100).toFixed(1) : 0, badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200" },
        { label: "Accepted (Done) — Pending Full Sign-Off", sub: "Done on site, but missing BH and/or CU signature", sigFilter: "DONE_UNSIGNED", count: stats.done_unsigned, pct: stats.done > 0 ? ((stats.done_unsigned / stats.done) * 100).toFixed(1) : 0, badgeClass: "bg-amber-100 text-amber-800 border-amber-300" },
        { label: "Unsigned / Pending Both Parties", sub: "Neither BH nor CU has signed yet", sigFilter: "UNSIGNED", count: stats.unsigned, pct: stats.total > 0 ? ((stats.unsigned / stats.total) * 100).toFixed(1) : 0, badgeClass: "bg-slate-100 text-slate-700 border-slate-200" }
      ];

      sigListEl.innerHTML = sigItems
        .map((s) => {
          return `
            <div onclick='openDetailTab({unit:"${unit}", sigFilter:"${s.sigFilter}", title:"${unit} • ${esc(s.label)}"})' class="cursor-pointer p-2.5 rounded-xl border ${s.badgeClass} hover:shadow-sm transition-all flex items-center justify-between gap-2">
              <div>
                <div class="font-bold text-xs sm:text-sm">${esc(s.label)}</div>
                <div class="text-[10px] opacity-80 mt-0.5">${esc(s.sub)}</div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-base font-extrabold">${s.count.toLocaleString()}</div>
                <div class="text-[10px] font-semibold">${s.pct}%</div>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }

  function renderDisciplineSummarySection(unit, stats) {
    const coreCardsEl = document.getElementById("core-discipline-cards");
    if (coreCardsEl) {
      const mainGroups = ["Mechanical", "Electrical & Instruments", "Piping"];
      coreCardsEl.innerHTML = mainGroups
        .map((gName) => {
          const d = stats.disciplines.find((x) => x.discipline === gName) || {
            discipline: gName, total: 0, done: 0, ongoing: 0, not_yet: 0, pct_done: 0, bh_signed: 0, cu_signed: 0, both_signed: 0
          };
          const theme = DISCIPLINE_COLORS[gName] || DISCIPLINE_COLORS["Unassigned"];
          const icon = gName === "Mechanical" ? "fa-gears" : gName === "Electrical & Instruments" ? "fa-bolt" : "fa-network-wired";

          return `
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl ${theme.badge} flex items-center justify-center font-bold">
                    <i class="fas ${icon} text-sm"></i>
                  </div>
                  <div>
                    <h4 class="font-bold text-slate-900 text-sm sm:text-base">${esc(d.discipline)}</h4>
                    <p class="text-xs text-slate-500">Total: <strong>${d.total}</strong> activities</p>
                  </div>
                </div>
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", title:"${unit} • ${esc(d.discipline)}"})' class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold transition-colors">
                  Details <i class="fas fa-arrow-right ml-1"></i>
                </button>
              </div>

              <div class="mt-3">
                <div class="flex justify-between text-xs font-semibold mb-1">
                  <span class="text-slate-600">Completion Progress</span>
                  <span class="text-emerald-600 font-bold">${d.done} / ${d.total} (${d.pct_done}%)</span>
                </div>
                <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full" style="width: ${d.pct_done}%; background:${theme.bar}"></div>
                </div>
              </div>

              <div class="grid grid-cols-4 gap-1.5 mt-3 text-center">
                <div onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", status:"Done", title:"${unit} • ${esc(d.discipline)} (Done)"})' class="cursor-pointer p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200">
                  <div class="text-[10px] text-emerald-700 font-semibold">Done</div>
                  <div class="text-xs sm:text-sm font-bold text-emerald-700">${d.done}</div>
                </div>
                <div onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", status:"Not yet", title:"${unit} • ${esc(d.discipline)} (Not yet)"})' class="cursor-pointer p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200">
                  <div class="text-[10px] text-rose-700 font-semibold">Not yet</div>
                  <div class="text-xs sm:text-sm font-bold text-rose-700">${d.not_yet}</div>
                </div>
                <div onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", sigFilter:"BH_SIGNED", title:"${unit} • ${esc(d.discipline)} (BH Signed)"})' class="cursor-pointer p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200">
                  <div class="text-[10px] text-indigo-700 font-semibold">BH Signed</div>
                  <div class="text-xs sm:text-sm font-bold text-indigo-700">${d.bh_signed}</div>
                </div>
                <div onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", sigFilter:"CU_SIGNED", title:"${unit} • ${esc(d.discipline)} (CU Signed)"})' class="cursor-pointer p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200">
                  <div class="text-[10px] text-teal-700 font-semibold">CU Signed</div>
                  <div class="text-xs sm:text-sm font-bold text-teal-700">${d.cu_signed}</div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    const tbody = document.getElementById("discipline-summary-tbody");
    if (tbody) {
      tbody.innerHTML = stats.disciplines
        .map((d) => {
          const theme = DISCIPLINE_COLORS[d.discipline] || DISCIPLINE_COLORS["Unassigned"];
          const displayLabel =
            d.discipline === "Unassigned" ? "General / Unassigned (Completed Baseline Items)" : d.discipline;
          return `
            <tr class="hover:bg-blue-50/40 transition-colors border-b border-slate-100 text-xs sm:text-sm">
              <td class="py-2.5 px-3 font-bold text-slate-800">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full" style="background:${theme.bar}"></span>
                  <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", title:"${unit} • ${esc(d.discipline)}"})' class="hover:text-blue-600 text-left font-bold">
                    ${esc(displayLabel)}
                  </button>
                </div>
              </td>
              <td class="py-2.5 px-3 text-center font-bold text-slate-700">${d.total}</td>
              <td class="py-2.5 px-3 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", status:"Done", title:"${unit} • ${esc(d.discipline)} (Done)"})' class="px-2 py-0.5 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs">
                  ${d.done}
                </button>
              </td>
              <td class="py-2.5 px-3 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", status:"Ongoing", title:"${unit} • ${esc(d.discipline)} (Ongoing)"})' class="px-2 py-0.5 rounded-full ${
            d.ongoing > 0 ? "bg-amber-100 text-amber-800 font-bold" : "text-slate-400"
          } text-xs">
                  ${d.ongoing}
                </button>
              </td>
              <td class="py-2.5 px-3 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", status:"Not yet", title:"${unit} • ${esc(d.discipline)} (Not yet)"})' class="px-2 py-0.5 rounded-full ${
            d.not_yet > 0 ? "bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold" : "text-slate-400"
          } text-xs">
                  ${d.not_yet}
                </button>
              </td>
              <td class="py-2.5 px-3 min-w-[130px]">
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full rounded-full" style="width:${d.pct_done}%; background:${theme.bar}"></div>
                  </div>
                  <span class="font-bold text-xs text-slate-700 w-10 text-right">${d.pct_done}%</span>
                </div>
              </td>
              <td class="py-2.5 px-3 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", sigFilter:"BH_SIGNED", title:"${unit} • ${esc(d.discipline)} (BH Signed)"})' class="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs">
                  ${d.bh_signed}
                </button>
              </td>
              <td class="py-2.5 px-3 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", sigFilter:"CU_SIGNED", title:"${unit} • ${esc(d.discipline)} (CU Signed)"})' class="px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold text-xs">
                  ${d.cu_signed}
                </button>
              </td>
              <td class="py-2.5 px-3 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", sigFilter:"BOTH_SIGNED", title:"${unit} • ${esc(d.discipline)} (Both Signed)"})' class="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs">
                  ${d.both_signed}
                </button>
              </td>
              <td class="py-2.5 px-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", title:"${unit} • ${esc(d.discipline)}"})' class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-semibold transition-colors">
                    Details
                  </button>
                  <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(d.discipline)}", title:"${unit} • ${esc(d.discipline)}"}, true)' title="Open in New Browser Tab" class="p-1 rounded-lg text-slate-400 hover:text-blue-600">
                    <i class="fas fa-external-link-alt text-xs"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");
    }
  }

  // Section 4B: Daily Closed Items Tracking & Discipline Trend (07:30 AM Cut-off)
  window.setClosingViewMode = function (mode) {
    state.closingViewMode = mode;
    renderDailyClosingSection();
  };

  window.setClosingChartMetric = function (metric) {
    state.closingChartMetric = metric;
    renderDailyClosingSection();
  };

  window.setClosingRange = function (range) {
    state.closingRange = range;
    renderDailyClosingSection();
  };

  function renderDailyClosingSection() {
    const badgeEl = document.getElementById("closing-total-badge");
    const matrixContainer = document.getElementById("closing-matrix-container");
    const chartContainer = document.getElementById("closing-chart-container");
    const metricToggleContainer = document.getElementById("closing-metric-toggle-container");
    const btnMatrix = document.getElementById("btn-closing-view-matrix");
    const btnChart = document.getElementById("btn-closing-view-chart");
    const btnMetricDaily = document.getElementById("btn-closing-metric-daily");
    const btnMetricCum = document.getElementById("btn-closing-metric-cumulative");
    const rangeSelect = document.getElementById("closing-range-select");

    if (!matrixContainer && !chartContainer) return;

    // View mode button states
    if (btnMatrix && btnChart) {
      if (state.closingViewMode === "matrix") {
        btnMatrix.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-blue-700 shadow-sm";
        btnChart.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900";
        if (matrixContainer) matrixContainer.classList.remove("hidden");
        if (chartContainer) chartContainer.classList.add("hidden");
        if (metricToggleContainer) metricToggleContainer.classList.add("hidden");
      } else {
        btnChart.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-blue-700 shadow-sm";
        btnMatrix.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900";
        if (matrixContainer) matrixContainer.classList.add("hidden");
        if (chartContainer) chartContainer.classList.remove("hidden");
        if (metricToggleContainer) metricToggleContainer.classList.remove("hidden");
      }
    }

    // Chart metric buttons state
    if (btnMetricDaily && btnMetricCum) {
      if (state.closingChartMetric === "daily") {
        btnMetricDaily.className = "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-blue-700 shadow-sm";
        btnMetricCum.className = "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900";
      } else {
        btnMetricCum.className = "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-blue-700 shadow-sm";
        btnMetricDaily.className = "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900";
      }
    }

    if (rangeSelect) {
      rangeSelect.value = state.closingRange;
    }

    // Retrieve ledger records
    const ledger = getClosingLedger();
    const records = ledger.records || {};
    const unit = state.selectedUnit;

    const matchingRecords = [];
    Object.values(records).forEach((r) => {
      if (unit === "ALL" || r.unit === unit) {
        matchingRecords.push(r);
      }
    });

    if (badgeEl) {
      badgeEl.textContent = `${matchingRecords.length} items completed`;
    }

    // Grouping
    const dateSet = new Set();
    const matrixData = {};
    const DISCIPLINES = [
      "Mechanical",
      "Electrical & Instruments",
      "Piping",
      "Pre-Commissioning",
      "Structural",
      "Material",
      "General"
    ];

    DISCIPLINES.forEach((d) => {
      matrixData[d] = {};
    });

    matchingRecords.forEach((r) => {
      const wDate = r.work_date || "2026-08-24";
      dateSet.add(wDate);
      let disc = r.discipline || "General";
      if (!DISCIPLINES.includes(disc)) {
        disc = "General";
      }
      if (!matrixData[disc]) matrixData[disc] = {};
      matrixData[disc][wDate] = (matrixData[disc][wDate] || 0) + 1;
    });

    let sortedDates = Array.from(dateSet).sort();
    if (state.closingRange !== "all") {
      const c = parseInt(state.closingRange, 10);
      if (!isNaN(c) && c > 0) {
        sortedDates = sortedDates.slice(-c);
      }
    }

    // 1. Render Matrix Table
    if (matrixContainer) {
      if (sortedDates.length === 0) {
        matrixContainer.innerHTML = `
          <div class="p-8 text-center text-slate-400 text-xs">
            <i class="fas fa-inbox text-3xl mb-2 text-slate-300"></i>
            <div>Không có hạng mục nào được đóng trong phạm vi ngày đã chọn (${esc(unit)}).</div>
          </div>
        `;
      } else {
        const dateHeadersHtml = sortedDates
          .map(
            (d) => `
              <th class="py-3 px-3 text-center border-l border-slate-700/60" title="${esc(formatWorkDateLabel(d))}">
                <div class="font-bold text-white text-xs">${esc(formatWorkDateShort(d))}</div>
                <div class="text-[10px] text-amber-300 font-semibold tracking-tight">Cut-off 07:30</div>
              </th>
            `
          )
          .join("");

        const colTotals = {};
        sortedDates.forEach((d) => {
          colTotals[d] = 0;
        });
        let grandTotal = 0;

        const rowsHtml = DISCIPLINES.map((disc) => {
          let rowTotal = 0;
          const cellsHtml = sortedDates
            .map((d) => {
              const c = matrixData[disc][d] || 0;
              rowTotal += c;
              colTotals[d] += c;
              grandTotal += c;
              if (c > 0) {
                return `
                  <td class="py-2.5 px-2 text-center border-l border-slate-100 align-middle">
                    <button
                      onclick="openDetailTab({ closingWorkDate: '${d}', discipline: '${esc(disc)}', unit: '${unit}', status: 'Done', title: 'Completed • ${esc(formatWorkDateShort(d))} • ${esc(disc)}' })"
                      class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-800 hover:text-white font-extrabold text-xs transition-all shadow-sm"
                      title="Click xem ${c} hạng mục ${esc(disc)} hoàn thành ngày ${esc(formatWorkDateLabel(d))}"
                    >
                      ${c}
                    </button>
                  </td>
                `;
              }
              return `
                <td class="py-2.5 px-2 text-center border-l border-slate-100 align-middle">
                  <span class="text-slate-300 text-xs font-mono">-</span>
                </td>
              `;
            })
            .join("");

          const discBadgeClass =
            {
              Mechanical: "bg-blue-100 text-blue-800 border-blue-200",
              "Electrical & Instruments": "bg-purple-100 text-purple-800 border-purple-200",
              Piping: "bg-teal-100 text-teal-800 border-teal-200",
              Structural: "bg-amber-100 text-amber-800 border-amber-200",
              "Pre-Commissioning": "bg-rose-100 text-rose-800 border-rose-200",
              Material: "bg-slate-100 text-slate-800 border-slate-200",
              General: "bg-emerald-100 text-emerald-800 border-emerald-200"
            }[disc] || "bg-slate-100 text-slate-800 border-slate-200";

          const discTotal = matchingRecords.filter((r) => {
            let d = r.discipline || "General";
            if (d === "Unassigned") d = "General";
            return d === disc;
          }).length;

          const totalBtnHtml =
            discTotal > 0
              ? `<button
                   onclick="openDetailTab({ discipline: '${esc(disc === "General" ? "General" : disc)}', status: 'Done', unit: '${unit}', title: 'Completed • ${esc(disc)} (Status: Done • ${discTotal})' })"
                   class="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-800 hover:text-white font-extrabold text-xs transition-all shadow-sm"
                   title="Click xem ${discTotal} hạng mục hoàn thành thuộc ${esc(disc)}"
                 >
                   ${state.closingRange !== "all" && rowTotal !== discTotal ? `${rowTotal} / ${discTotal}` : discTotal}
                 </button>`
              : `<span class="text-slate-400 text-xs font-mono">0</span>`;

          return `
            <tr class="hover:bg-blue-50/30 border-b border-slate-100 text-xs sm:text-sm bg-white">
              <td class="py-2.5 px-3.5 font-bold text-slate-800 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${discBadgeClass}">
                  <i class="fas fa-layer-group text-[10px]"></i>
                  ${esc(disc)}
                </span>
              </td>
              ${cellsHtml}
              <td class="py-2.5 px-3 text-center border-l border-slate-200 bg-slate-50/70 align-middle">
                ${totalBtnHtml}
              </td>
            </tr>
          `;
        }).join("");

        const footerColsHtml = sortedDates
          .map((d) => {
            const c = colTotals[d] || 0;
            return `
              <td class="py-2.5 px-2 text-center border-l border-slate-700/60 align-middle">
                ${
                  c > 0
                    ? `<button
                         onclick="openDetailTab({ closingWorkDate: '${d}', unit: '${unit}', status: 'Done', title: 'Completed • ${esc(formatWorkDateLabel(d))}' })"
                         class="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all shadow-sm"
                         title="Click xem tất cả ${c} hạng mục hoàn thành ngày ${esc(formatWorkDateLabel(d))}"
                       >
                         ${c}
                       </button>`
                    : `<span class="text-slate-400 text-xs font-mono">0</span>`
                }
              </td>
            `;
          })
          .join("");

        matrixContainer.innerHTML = `
          <table class="w-full text-left sqcl-grid-table">
            <thead>
              <tr class="bg-slate-900 text-white text-xs uppercase font-extrabold tracking-wider">
                <th class="py-3 px-4 min-w-[200px]">Discipline / Remarks</th>
                ${dateHeadersHtml}
                <th class="py-3 px-3 text-center border-l border-slate-700 bg-slate-800 text-amber-400 min-w-[100px]">Total Completed</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr class="bg-slate-900 text-white font-extrabold text-xs border-t-2 border-slate-700">
                <td class="py-3 px-4 uppercase tracking-wider text-amber-300">
                  <div class="flex items-center gap-1.5">
                    <i class="fas fa-calculator"></i>
                    <span>Daily Total (All Disciplines)</span>
                  </div>
                </td>
                ${footerColsHtml}
                <td class="py-3 px-3 text-center border-l border-slate-700 bg-slate-950 align-middle">
                  <button
                    onclick="openDetailTab({ status: 'Done', unit: '${unit}', title: 'All Completed Activities (Status: Done • ${matchingRecords.length})' })"
                    class="px-3.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs transition-all shadow-md"
                    title="Click xem toàn bộ ${matchingRecords.length} hạng mục đã hoàn thành (Status: Done)"
                  >
                    ${state.closingRange !== "all" && grandTotal !== matchingRecords.length ? `${grandTotal} / ${matchingRecords.length}` : matchingRecords.length}
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        `;
      }
    }

    // 2. Render Line Chart
    if (window.Chart && document.getElementById("chart-daily-closing")) {
      const ctx = document.getElementById("chart-daily-closing");
      if (state.charts.dailyClosing) {
        state.charts.dailyClosing.destroy();
        state.charts.dailyClosing = null;
      }

      if (sortedDates.length > 0) {
        const labels = sortedDates.map((d) => formatWorkDateShort(d));

        const DISC_COLORS = {
          Mechanical: { border: "#2563EB", bg: "rgba(37, 99, 235, 0.1)" },
          "Electrical & Instruments": { border: "#7C3AED", bg: "rgba(124, 58, 237, 0.1)" },
          Piping: { border: "#0D9488", bg: "rgba(13, 148, 136, 0.1)" },
          Structural: { border: "#D97706", bg: "rgba(217, 119, 6, 0.1)" },
          "Pre-Commissioning": { border: "#DC2626", bg: "rgba(220, 38, 38, 0.1)" },
          Material: { border: "#64748B", bg: "rgba(100, 116, 139, 0.1)" },
          General: { border: "#059669", bg: "rgba(5, 150, 105, 0.1)" }
        };

        const isCum = state.closingChartMetric === "cumulative";
        const datasets = [];

        // Total Line
        let totalRunning = 0;
        const totalData = sortedDates.map((d) => {
          let daySum = 0;
          DISCIPLINES.forEach((disc) => {
            daySum += matrixData[disc][d] || 0;
          });
          if (isCum) {
            totalRunning += daySum;
            return totalRunning;
          }
          return daySum;
        });

        datasets.push({
          label: isCum ? "Cumulative Completed (All Disciplines)" : "Daily Completed (All Disciplines)",
          data: totalData,
          borderColor: "#0F172A",
          backgroundColor: "rgba(15, 23, 42, 0.08)",
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: "#0F172A",
          tension: 0.3,
          fill: false,
          disciplineCode: "ALL"
        });

        // Disciplines
        DISCIPLINES.forEach((disc) => {
          let sum = 0;
          sortedDates.forEach((d) => {
            sum += matrixData[disc][d] || 0;
          });
          if (sum === 0) return;

          let running = 0;
          const data = sortedDates.map((d) => {
            const c = matrixData[disc][d] || 0;
            if (isCum) {
              running += c;
              return running;
            }
            return c;
          });

          const col = DISC_COLORS[disc] || { border: "#64748B", bg: "rgba(100, 116, 139, 0.1)" };
          datasets.push({
            label: disc,
            data: data,
            borderColor: col.border,
            backgroundColor: col.bg,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: col.border,
            tension: 0.3,
            fill: false,
            disciplineCode: disc
          });
        });

        state.charts.dailyClosing = new Chart(ctx, {
          type: "line",
          data: {
            labels: labels,
            datasets: datasets
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: "index",
              intersect: false
            },
            onClick: (evt, elements) => {
              if (elements && elements.length > 0) {
                const el = elements[0];
                const dateIdx = el.index;
                const dsIdx = el.datasetIndex;
                const targetDate = sortedDates[dateIdx];
                const ds = datasets[dsIdx];
                const discCode = ds.disciplineCode;

                if (discCode === "ALL") {
                  openDetailTab({
                    closingWorkDate: targetDate,
                    status: "Done",
                    unit: unit,
                    title: `Completed • ${formatWorkDateLabel(targetDate)}`
                  });
                } else {
                  openDetailTab({
                    closingWorkDate: targetDate,
                    discipline: discCode,
                    status: "Done",
                    unit: unit,
                    title: `Completed • ${formatWorkDateShort(targetDate)} • ${discCode}`
                  });
                }
              }
            },
            plugins: {
              legend: {
                position: "top",
                labels: {
                  boxWidth: 12,
                  font: { size: 11, weight: "bold" }
                }
              },
              tooltip: {
                callbacks: {
                  title: (items) => {
                    if (!items.length) return "";
                    const idx = items[0].dataIndex;
                    const targetDate = sortedDates[idx];
                    return `Work Date: ${formatWorkDateLabel(targetDate)}`;
                  },
                  afterBody: () => "\n(Click vào điểm dữ liệu để mở danh sách chi tiết)"
                }
              }
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: "Work Date (07:30 AM Cut-off)",
                  font: { size: 11, weight: "bold" }
                },
                grid: {
                  display: false
                }
              },
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: isCum ? "Cumulative Completed Items (S-Curve)" : "Daily Completed Items Count (Status: Done)",
                  font: { size: 11, weight: "bold" }
                },
                ticks: {
                  precision: 0
                }
              }
            }
          }
        });
      }
    }
  }

  // Section 5: Inspection Schedule by Discipline & Date
  function renderInspectionScheduleSection() {
    if (!state.data || !state.data.units) return;
    const unit = state.selectedUnit;
    const schedDiscFilter = state.summaryFilters.scheduleDiscipline || "ALL";

    const allTuples = getAllScheduleTuples(unit);
    const activeDatesSet = new Set();
    allTuples.forEach((t) => activeDatesSet.add(t.date));
    const activeDates = Array.from(activeDatesSet).sort();

    // Dynamically discover all disciplines present in schedule tuples (Mechanical, E&I, Piping, Material, etc.)
    const schedDisciplineSet = new Set();
    allTuples.forEach((t) => {
      if (t.discipline && t.discipline !== "Unassigned") {
        schedDisciplineSet.add(t.discipline);
      }
    });

    // Also include any active disciplines that have activities in the project
    const currentUnitObj = unit === "ALL" ? null : state.data.units[unit];
    const targetUnits = currentUnitObj ? [currentUnitObj] : [state.data.units["GTG#1"], state.data.units["GTG#2"]].filter(Boolean);
    targetUnits.forEach((uObj) => {
      (uObj.disciplines || []).forEach((d) => {
        if (d.discipline && d.discipline !== "Unassigned") {
          if (allTuples.some((t) => t.discipline === d.discipline)) {
            schedDisciplineSet.add(d.discipline);
          }
        }
      });
    });

    if (schedDisciplineSet.size === 0) {
      schedDisciplineSet.add("Mechanical");
      schedDisciplineSet.add("Electrical & Instruments");
    }

    const priority = ["Mechanical", "Electrical & Instruments", "Piping", "Material", "Structural", "Pre-Commissioning", "Package", "Civil"];
    const schedDisciplines = Array.from(schedDisciplineSet).sort((a, b) => {
      const ia = priority.indexOf(a);
      const ib = priority.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const filterBarEl = document.getElementById("schedule-discipline-filter");
    if (filterBarEl) {
      const opts = [
        { id: "ALL", label: "All Scheduled Disciplines" },
        ...schedDisciplines.map((d) => ({
          id: d,
          label: getDisciplineShortLabel(d) === d ? d : `${d} (${getDisciplineShortLabel(d)})`
        }))
      ];
      filterBarEl.innerHTML = opts
        .map((o) => {
          const active = schedDiscFilter === o.id;
          return `
            <button onclick="updateSummaryFilter('scheduleDiscipline', '${esc(o.id)}')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            }">
              ${esc(o.label)}
            </button>
          `;
        })
        .join("");
    }

    const summaryEl = document.getElementById("schedule-by-discipline-summary");
    if (summaryEl) {
      const dateHeadersHtml = activeDates
        .map(
          (dt) => `
          <th class="py-2.5 px-2 text-center border-l border-slate-700 whitespace-nowrap">
            <button onclick='openDetailTab({unit:"${unit}", scheduleDate:"${dt}", scheduledOnly:true, title:"${unit} • Scheduled ${formatShortDate(dt)}"})' class="hover:text-amber-300 underline decoration-dotted">
              ${esc(formatShortDate(dt))}
            </button>
          </th>
        `
        )
        .join("");

      const rowsHtml = schedDisciplines
        .filter((dName) => schedDiscFilter === "ALL" || schedDiscFilter === dName)
        .map((dName) => {
          const dActivities = getActivitiesByFilter({ unit, discipline: dName, scheduledOnly: true });
          const dStats = computeStats(dActivities);
          const dSectionsSet = new Set(
            allTuples.filter((t) => t.discipline === dName).map((t) => t.section)
          );
          const theme = getDisciplineTheme(dName);
          const shortD = getDisciplineShortLabel(dName);

          const dateCellsHtml = activeDates
            .map((dt) => {
              const dtActs = getActivitiesByFilter({
                unit,
                discipline: dName,
                scheduleDate: dt,
                scheduledOnly: true
              });
              if (dtActs.length === 0) {
                return `<td class="py-2 px-2 text-center border-l border-slate-100 text-slate-300">-</td>`;
              }
              const dtStats = computeStats(dtActs);
              const secsOnDate = Array.from(
                new Set(
                  allTuples
                    .filter((t) => t.discipline === dName && t.date === dt)
                    .map((t) => t.section)
                )
              );
              return `
                <td class="py-2 px-2 text-center border-l border-slate-100">
                  <button
                    onclick='openDetailTab({unit:"${unit}", discipline:"${esc(dName)}", scheduleDate:"${dt}", scheduledOnly:true, title:"${unit} • ${esc(dName)} (${formatShortDate(dt)})"})'
                    class="w-full px-2 py-1 rounded-lg ${theme.badge} border hover:shadow-sm transition-all text-center"
                    title="Sections: ${secsOnDate.join(", ")} | Click to open Detail Tab"
                  >
                    <div class="font-extrabold text-xs">${secsOnDate.length} Sys (${dtStats.total} acts)</div>
                    <div class="text-[10px] opacity-90">Done: ${dtStats.done} | NY: ${dtStats.not_yet}</div>
                  </button>
                </td>
              `;
            })
            .join("");

          return `
            <tr class="hover:bg-blue-50/30 border-b border-slate-200 text-xs sm:text-sm bg-white">
              <td class="py-2.5 px-3 font-bold text-slate-900">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(dName)}", scheduledOnly:true, title:"${unit} • Scheduled ${esc(dName)}"})' class="hover:text-blue-600 flex items-center gap-2 text-left">
                  <span class="w-2.5 h-2.5 rounded-full" style="background:${theme.bar}"></span>
                  <span>${esc(dName)}</span>
                  <span class="text-[10px] text-slate-400 font-normal">(${esc(shortD)})</span>
                </button>
              </td>
              <td class="py-2.5 px-2 text-center font-bold text-slate-700">${dSectionsSet.size} Systems</td>
              <td class="py-2.5 px-2 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(dName)}", scheduledOnly:true, title:"${unit} • Scheduled ${esc(dName)}"})' class="font-extrabold text-blue-700 hover:underline">
                  ${dStats.total}
                </button>
              </td>
              <td class="py-2.5 px-2 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(dName)}", status:"Done", scheduledOnly:true, title:"${unit} • Scheduled ${esc(dName)} (Done)"})' class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                  ${dStats.done}
                </button>
              </td>
              <td class="py-2.5 px-2 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(dName)}", status:"Not yet", scheduledOnly:true, title:"${unit} • Scheduled ${esc(dName)} (Not yet)"})' class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-xs">
                  ${dStats.not_yet}
                </button>
              </td>
              <td class="py-2.5 px-2 text-center font-bold text-slate-700">${dStats.pct_done}%</td>
              <td class="py-2.5 px-2 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(dName)}", sigFilter:"BH_SIGNED", scheduledOnly:true, title:"${unit} • Scheduled ${esc(dName)} (BH Signed)"})' class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-xs">
                  ${dStats.bh_signed}
                </button>
              </td>
              <td class="py-2.5 px-2 text-center">
                <button onclick='openDetailTab({unit:"${unit}", discipline:"${esc(dName)}", sigFilter:"CU_SIGNED", scheduledOnly:true, title:"${unit} • Scheduled ${esc(dName)} (CU Signed)"})' class="px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-bold text-xs">
                  ${dStats.cu_signed}
                </button>
              </td>
              ${dateCellsHtml}
            </tr>
          `;
        })
        .join("");

      summaryEl.innerHTML = `
        <table class="w-full text-left sqcl-grid-table">
          <thead>
            <tr class="bg-slate-900 text-white text-xs uppercase font-bold">
              <th class="py-2.5 px-3">Scheduled Discipline</th>
              <th class="py-2.5 px-2 text-center">Systems</th>
              <th class="py-2.5 px-2 text-center">Scheduled Acts</th>
              <th class="py-2.5 px-2 text-center">Done</th>
              <th class="py-2.5 px-2 text-center">Not yet</th>
              <th class="py-2.5 px-2 text-center">% Done</th>
              <th class="py-2.5 px-2 text-center">BH Signed</th>
              <th class="py-2.5 px-2 text-center">CU Signed</th>
              ${dateHeadersHtml}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }

    const matrixEl = document.getElementById("schedule-system-matrix");
    const badgeEl = document.getElementById("schedule-count-badge");
    if (!matrixEl) return;

    const u1Sections = state.data.units["GTG#1"].sections || [];
    let scheduledSections = u1Sections.filter((s) => s.schedule && s.schedule.length > 0);

    if (schedDiscFilter !== "ALL") {
      scheduledSections = scheduledSections.filter((s) =>
        s.schedule.some((sc) => sc.items.some((it) => it.discipline === schedDiscFilter))
      );
    }

    if (badgeEl) {
      badgeEl.textContent = `${scheduledSections.length} Scheduled Systems`;
    }

    const matrixDateHeaders = activeDates
      .map(
        (dt) => `
        <th class="py-2.5 px-2 text-center border-l border-slate-700 whitespace-nowrap">
          <button onclick='openDetailTab({unit:"${unit}", scheduleDate:"${dt}", scheduledOnly:true, title:"${unit} • Scheduled ${formatShortDate(dt)}"})' class="hover:text-amber-300 underline decoration-dotted">
            ${esc(formatShortDate(dt))}
          </button>
        </th>
      `
      )
      .join("");

    const matrixRows = scheduledSections
      .map((sec) => {
        const secDiscs = Array.from(
          new Set(
            sec.schedule.flatMap((sc) =>
              sc.items
                .filter((it) => schedDiscFilter === "ALL" || it.discipline === schedDiscFilter)
                .map((it) => it.discipline)
            )
          )
        );

        const discProgressPills = secDiscs
          .map((dName) => {
            const acts = getActivitiesByFilter({ unit, section: sec.section, discipline: dName });
            const st = computeStats(acts);
            const theme = getDisciplineTheme(dName);
            const shortD = getDisciplineShortLabel(dName);
            return `
              <button
                onclick='openDetailTab({unit:"${unit}", section:"${sec.section}", discipline:"${esc(dName)}", title:"${unit} • Sec ${sec.section} (${shortD})"})'
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded border ${theme.badge} text-[11px] font-bold mr-1 mb-1 hover:shadow-sm transition-all"
              >
                <span>${esc(shortD)}:</span>
                <span class="text-emerald-700">${st.done} Done</span> /
                <span class="text-rose-700">${st.not_yet} NY</span>
                <span class="opacity-75">(${st.pct_done}%)</span>
              </button>
            `;
          })
          .join("");

        const dateCols = activeDates
          .map((dt) => {
            const scEntry = sec.schedule.find((x) => x.date === dt);
            if (!scEntry) {
              return `<td class="py-2 px-1 text-center border-l border-slate-100 text-slate-300">-</td>`;
            }
            const matchingItems = scEntry.items.filter(
              (it) => schedDiscFilter === "ALL" || it.discipline === schedDiscFilter
            );
            if (matchingItems.length === 0) {
              return `<td class="py-2 px-1 text-center border-l border-slate-100 text-slate-300">-</td>`;
            }
            const pills = matchingItems
              .map((it) => {
                const theme = getDisciplineTheme(it.discipline);
                const targetUnit = unit !== "ALL" ? unit : it.units.length === 1 ? it.units[0] : "ALL";
                const unitTag = it.units.length === 2 ? "GTG#1&2" : it.units[0];
                const shortD = getDisciplineShortLabel(it.discipline);
                return `
                  <button
                    onclick='openDetailTab({unit:"${targetUnit}", section:"${sec.section}", discipline:"${esc(it.discipline)}", title:"${targetUnit} • Sec ${sec.section} • ${shortD} (${formatShortDate(dt)})"})'
                    class="block w-full px-1.5 py-0.5 rounded border ${theme.badge} text-[10px] font-bold mb-0.5 last:mb-0 hover:scale-[1.02] transition-transform"
                    title="Click to inspect Section ${sec.section} (${it.discipline}) in Detail Tab"
                  >
                    ${esc(shortD)} <span class="font-normal opacity-80">(${esc(unitTag)})</span>
                  </button>
                `;
              })
              .join("");

            return `<td class="py-2 px-1.5 text-center border-l border-slate-100 align-middle">${pills}</td>`;
          })
          .join("");

        return `
          <tr class="hover:bg-blue-50/40 border-b border-slate-100 text-xs sm:text-sm bg-white">
            <td class="py-2 px-2 text-center font-extrabold text-blue-700">${esc(sec.section)}</td>
            <td class="py-2 px-3 font-semibold text-slate-800 max-w-sm">
              <button onclick='openDetailTab({unit:"${unit}", section:"${sec.section}", title:"${unit} • Sec ${sec.section}"})' class="hover:text-blue-600 text-left">
                ${esc(sec.title)}
              </button>
            </td>
            <td class="py-2 px-2">${discProgressPills}</td>
            ${dateCols}
          </tr>
        `;
      })
      .join("");

    matrixEl.innerHTML = `
      <table class="w-full text-left sqcl-grid-table">
        <thead>
          <tr class="bg-slate-800 text-white text-xs uppercase font-bold">
            <th class="py-2.5 px-2 text-center w-16">Section</th>
            <th class="py-2.5 px-3">System Title</th>
            <th class="py-2.5 px-3">Scheduled Discipline Progress (Done / Not yet)</th>
            ${matrixDateHeaders}
          </tr>
        </thead>
        <tbody>
          ${matrixRows}
        </tbody>
      </table>
    `;
  }

  // Section 6: Systems Summary Table (46 Systems)
  function renderSummarySystemsTable() {
    const tbody = document.getElementById("systems-summary-tbody");
    const countBadge = document.getElementById("systems-count-badge");
    if (!tbody || !state.data) return;

    const unit = state.selectedUnit;
    const searchQ = (state.summaryFilters.systemSearch || "").trim().toLowerCase();
    const progFilter = state.summaryFilters.systemProgress || "ALL";

    let rows = [];
    const unitKeys = unit === "ALL" ? ["GTG#1", "GTG#2"] : [unit];
    unitKeys.forEach((uk) => {
      const u = state.data.units[uk];
      if (u && u.sections) {
        u.sections.forEach((s) => {
          rows.push(Object.assign({ unit: uk }, s));
        });
      }
    });

    if (searchQ) {
      rows = rows.filter(
        (r) =>
          r.section.toLowerCase().includes(searchQ) ||
          r.title.toLowerCase().includes(searchQ) ||
          (r.status_review && r.status_review.toLowerCase().includes(searchQ))
      );
    }

    if (progFilter === "DONE_100") {
      rows = rows.filter((r) => r.pct_done >= 100);
    } else if (progFilter === "IN_PROGRESS") {
      rows = rows.filter((r) => r.pct_done > 0 && r.pct_done < 100);
    } else if (progFilter === "NOT_STARTED") {
      rows = rows.filter((r) => r.pct_done === 0);
    } else if (progFilter === "HAS_SCHEDULE") {
      rows = rows.filter((r) => (r.schedule && r.schedule.length > 0) || (r.status_review && r.status_review !== ""));
    }

    if (countBadge) {
      countBadge.textContent = `${rows.length} Systems`;
    }

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="13" class="py-8 text-center text-slate-400 text-sm">
            No systems match the current filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows
      .map((r) => {
        const barColor =
          r.pct_done >= 100 ? "bg-emerald-500" : r.pct_done >= 50 ? "bg-blue-600" : r.pct_done > 0 ? "bg-amber-500" : "bg-slate-300";
        const unitBadge =
          r.unit === "GTG#1"
            ? "bg-blue-100 text-blue-800 border-blue-200"
            : "bg-indigo-100 text-indigo-800 border-indigo-200";

        const schedBadges = (r.schedule || [])
          .map((sc) => `<span class="inline-block px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] mr-1 mb-0.5"><strong>${esc(formatShortDate(sc.date))}:</strong> ${esc(sc.note)}</span>`)
          .join("");
        const reviewNote = r.status_review
          ? `<div class="text-[11px] text-emerald-700 font-medium">${esc(r.status_review)}</div>`
          : "";

        return `
          <tr class="hover:bg-blue-50/50 transition-colors border-b border-slate-100 text-xs sm:text-sm">
            <td class="py-2 px-2 text-center">
              <span class="px-2 py-0.5 rounded border text-[11px] font-bold ${unitBadge}">${esc(r.unit)}</span>
            </td>
            <td class="py-2 px-2 text-center font-extrabold text-blue-700">${esc(r.section)}</td>
            <td class="py-2 px-3 font-semibold text-slate-800 max-w-md">
              <button onclick='openDetailTab({unit:"${r.unit}", section:"${esc(r.section)}", title:"${r.unit} • Sec ${esc(r.section)}"})' class="text-left hover:text-blue-600 transition-colors">
                ${esc(r.title)}
              </button>
            </td>
            <td class="py-2 px-2 text-center text-slate-500 text-xs">${esc(r.pdf_sheet)}</td>
            <td class="py-2 px-2 text-center font-bold text-slate-700">${r.activities_count}</td>
            <td class="py-2 px-2 text-center">
              <button onclick='openDetailTab({unit:"${r.unit}", section:"${esc(r.section)}", status:"Done", title:"${r.unit} • Sec ${esc(r.section)} (Done)"})' class="px-2 py-0.5 rounded-full ${
          r.done > 0 ? "bg-emerald-100 text-emerald-800 font-bold" : "text-slate-400"
        } text-xs">
                ${r.done}
              </button>
            </td>
            <td class="py-2 px-2 text-center">
              <button onclick='openDetailTab({unit:"${r.unit}", section:"${esc(r.section)}", status:"Ongoing", title:"${r.unit} • Sec ${esc(r.section)} (Ongoing)"})' class="px-2 py-0.5 rounded-full ${
          r.ongoing > 0 ? "bg-amber-100 text-amber-800 font-bold" : "text-slate-400"
        } text-xs">
                ${r.ongoing}
              </button>
            </td>
            <td class="py-2 px-2 text-center">
              <button onclick='openDetailTab({unit:"${r.unit}", section:"${esc(r.section)}", status:"Not yet", title:"${r.unit} • Sec ${esc(r.section)} (Not yet)"})' class="px-2 py-0.5 rounded-full ${
          r.not_yet > 0 ? "bg-rose-100 text-rose-800 font-bold" : "text-slate-400"
        } text-xs">
                ${r.not_yet}
              </button>
            </td>
            <td class="py-2 px-2 min-w-[120px]">
              <div class="flex items-center gap-1.5">
                <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div class="${barColor} h-full rounded-full" style="width: ${r.pct_done}%"></div>
                </div>
                <span class="font-bold text-[11px] w-9 text-right ${r.pct_done >= 100 ? "text-emerald-600" : "text-slate-700"}">${r.pct_done}%</span>
              </div>
            </td>
            <td class="py-2 px-2 text-center">
              <button onclick='openDetailTab({unit:"${r.unit}", section:"${esc(r.section)}", sigFilter:"BH_SIGNED", title:"${r.unit} • Sec ${esc(r.section)} (BH Signed)"})' class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-xs">
                ${r.bh_signed}
              </button>
            </td>
            <td class="py-2 px-2 text-center">
              <button onclick='openDetailTab({unit:"${r.unit}", section:"${esc(r.section)}", sigFilter:"CU_SIGNED", title:"${r.unit} • Sec ${esc(r.section)} (CU Signed)"})' class="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-semibold text-xs">
                ${r.cu_signed}
              </button>
            </td>
            <td class="py-2 px-2 max-w-[200px]">
              ${reviewNote}
              ${schedBadges}
            </td>
            <td class="py-2 px-2 text-center whitespace-nowrap">
              <button onclick='openDetailTab({unit:"${r.unit}", section:"${esc(r.section)}", title:"${r.unit} • Sec ${esc(r.section)}"})' class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors">
                <i class="fas fa-table-list mr-1"></i>Details
              </button>
              <button onclick='openDetailTab({unit:"${r.unit}", section:"${esc(r.section)}", title:"${r.unit} • Sec ${esc(r.section)}"}, true)' title="Open in New Browser Tab" class="ml-1 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs">
                <i class="fas fa-external-link-alt"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderSummaryCharts(unit, stats) {
    if (!window.Chart) return;

    const ctxDisc = document.getElementById("chart-disciplines");
    if (ctxDisc) {
      if (state.charts.disc) state.charts.disc.destroy();
      const labels = stats.disciplines.map((d) =>
        d.discipline === "Unassigned" ? "General / Unassigned" : d.discipline
      );
      state.charts.disc = new Chart(ctxDisc, {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "Accepted (Done)", data: stats.disciplines.map((d) => d.done), backgroundColor: "#10B981", borderRadius: 4 },
            { label: "Pending (Not yet)", data: stats.disciplines.map((d) => d.not_yet), backgroundColor: "#F43F5E", borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (evt, elements) => {
            if (elements && elements.length > 0) {
              const idx = elements[0].index;
              const dObj = stats.disciplines[idx];
              if (dObj) {
                openDetailTab({ unit, discipline: dObj.discipline, title: `${unit} • ${dObj.discipline}` });
              }
            }
          },
          plugins: { legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: { x: { stacked: true, ticks: { font: { size: 10 } } }, y: { stacked: true, beginAtZero: true } }
        }
      });
    }

    const ctxSig = document.getElementById("chart-signatures");
    if (ctxSig) {
      if (state.charts.sig) state.charts.sig.destroy();
      state.charts.sig = new Chart(ctxSig, {
        type: "doughnut",
        data: {
          labels: ["Both Signed (BH & CU)", "BH Signed Only", "Done on Site (Unsigned)", "Pending Inspection"],
          datasets: [
            {
              data: [stats.both_signed, stats.bh_only, Math.max(0, stats.done - stats.bh_signed), Math.max(0, stats.total - stats.done)],
              backgroundColor: ["#10B981", "#6366F1", "#F59E0B", "#E2E8F0"],
              borderWidth: 2,
              borderColor: "#FFFFFF"
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: { legend: { position: "bottom", labels: { boxWidth: 11, font: { size: 10 } } } }
        }
      });
    }
  }

  // Render Detail Tab View
  function renderDetailView(tab) {
    const container = document.getElementById("view-detail");
    if (!container) return;

    const baseActivities = getActivitiesByFilter(tab.baseCriteria);
    const baseStats = computeStats(baseActivities);
    const filterDesc = buildFilterDescription(tab.baseCriteria);
    const extUrl = buildDetailUrl(tab.baseCriteria);

    container.innerHTML = `
      <div class="space-y-4 w-full">
        <!-- DETAIL TAB TOP BANNER & SUMMARY TABLE -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <button onclick="switchTab('summary')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors">
                  <i class="fas fa-arrow-left mr-1"></i>Back to Overview (Summary)
                </button>
                <span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                  <i class="fas fa-layer-group mr-1"></i>DETAIL INSPECTION TAB
                </span>
              </div>
              <h2 class="text-base sm:text-xl font-extrabold text-slate-900 mt-2">${esc(tab.title)}</h2>
              <p class="text-xs sm:text-sm text-blue-700 font-medium mt-0.5">
                <i class="fas fa-filter mr-1"></i>${esc(filterDesc)}
              </p>
              ${
                tab.baseCriteria.closingWorkDate && tab.baseCriteria.closingWorkDate !== "ALL"
                  ? `
                <div class="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900 font-medium">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span><strong>Báo cáo Hoàn thành Hàng ngày (Status: Done • Cột P):</strong> Ngày làm việc <strong>${esc(formatWorkDateLabel(tab.baseCriteria.closingWorkDate))}</strong> (Cut-off 07:30 AM). Thống nhất với số liệu tiến độ của bộ môn trong file Excel.</span>
                </div>
              `
                  : ""
              }
            </div>

            <!-- Export & Browser Tab Buttons -->
            <div class="flex flex-wrap items-center gap-2">
              <button onclick="exportToExcel('detail', '${esc(tab.id)}')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm flex items-center gap-1.5 transition-all">
                <i class="fas fa-file-excel"></i> Export Excel
              </button>
              <button onclick="exportToPDF('detail', '${esc(tab.id)}')" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-sm flex items-center gap-1.5 transition-all">
                <i class="fas fa-file-pdf"></i> Export PDF
              </button>
              <a href="${esc(extUrl)}" target="_blank" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all" title="Open this Detail View in an independent Browser Tab">
                <i class="fas fa-external-link-alt"></i> New Browser Tab
              </a>
            </div>
          </div>

          <!-- HEADER SUMMARY TABLE FOR SELECTED SCOPE -->
          <div class="mt-4 pt-3.5 border-t border-slate-200">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <i class="fas fa-table text-blue-600"></i>
                Summary Status Overview (Selected Scope)
              </h3>
              <span class="text-xs text-slate-500">Click any cell below to filter the checklist table</span>
            </div>

            <div class="overflow-x-auto rounded-xl border border-slate-200">
              <table class="w-full text-xs sm:text-sm text-center sqcl-grid-table">
                <thead>
                  <tr class="bg-slate-900 text-white font-bold">
                    <th class="py-2 px-3 border-r border-slate-700">Total Activities</th>
                    <th class="py-2 px-3 border-r border-slate-700 bg-emerald-900/60">Accepted (Done)</th>
                    <th class="py-2 px-3 border-r border-slate-700">Ongoing</th>
                    <th class="py-2 px-3 border-r border-slate-700 bg-rose-900/60">Pending (Not yet)</th>
                    <th class="py-2 px-3 border-r border-slate-700">% Completion</th>
                    <th class="py-2 px-3 border-r border-slate-700 bg-indigo-900/60">BH Signed</th>
                    <th class="py-2 px-3 border-r border-slate-700 bg-teal-900/60">CU Signed</th>
                    <th class="py-2 px-3 border-r border-slate-700">Both Signed (BH & CU)</th>
                    <th class="py-2 px-3 border-r border-slate-700 bg-amber-900/60">Done (Unsigned)</th>
                    <th class="py-2 px-3">Unsigned</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="bg-white font-extrabold text-sm sm:text-base">
                    <td onclick="updateDetailSubFilter('${esc(tab.id)}', 'reset', '')" class="cursor-pointer py-2 px-3 hover:bg-slate-100 text-slate-900">${baseStats.total}</td>
                    <td onclick="updateDetailSubFilter('${esc(tab.id)}', 'status', 'Done')" class="cursor-pointer py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700">${baseStats.done}</td>
                    <td onclick="updateDetailSubFilter('${esc(tab.id)}', 'status', 'Ongoing')" class="cursor-pointer py-2 px-3 hover:bg-amber-50 text-amber-600">${baseStats.ongoing}</td>
                    <td onclick="updateDetailSubFilter('${esc(tab.id)}', 'status', 'Not yet')" class="cursor-pointer py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700">${baseStats.not_yet}</td>
                    <td class="py-2 px-3 text-blue-700">${baseStats.pct_done}%</td>
                    <td onclick="updateDetailSubFilter('${esc(tab.id)}', 'sigFilter', 'BH_SIGNED')" class="cursor-pointer py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700">${baseStats.bh_signed} <span class="text-xs font-normal">(${baseStats.pct_bh}%)</span></td>
                    <td onclick="updateDetailSubFilter('${esc(tab.id)}', 'sigFilter', 'CU_SIGNED')" class="cursor-pointer py-2 px-3 bg-teal-50 hover:bg-teal-100 text-teal-700">${baseStats.cu_signed} <span class="text-xs font-normal">(${baseStats.pct_cu}%)</span></td>
                    <td onclick="updateDetailSubFilter('${esc(tab.id)}', 'sigFilter', 'BOTH_SIGNED')" class="cursor-pointer py-2 px-3 hover:bg-emerald-50 text-emerald-700">${baseStats.both_signed}</td>
                    <td onclick="updateDetailSubFilter('${esc(tab.id)}', 'sigFilter', 'DONE_UNSIGNED')" class="cursor-pointer py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700">${baseStats.done_unsigned}</td>
                    <td onclick="updateDetailSubFilter('${esc(tab.id)}', 'sigFilter', 'UNSIGNED')" class="cursor-pointer py-2 px-3 hover:bg-slate-100 text-slate-600">${baseStats.unsigned}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 overflow-x-auto rounded-xl border border-slate-200">
              <table class="w-full text-xs text-center sqcl-grid-table">
                <thead>
                  <tr class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th class="py-1.5 px-3 text-left">Discipline Breakdown (in Selected Scope)</th>
                    <th class="py-1.5 px-2">Total</th>
                    <th class="py-1.5 px-2 text-emerald-700">Done</th>
                    <th class="py-1.5 px-2 text-amber-700">Ongoing</th>
                    <th class="py-1.5 px-2 text-rose-700">Not yet</th>
                    <th class="py-1.5 px-2">% Done</th>
                    <th class="py-1.5 px-2 text-indigo-700">BH Signed</th>
                    <th class="py-1.5 px-2 text-teal-700">CU Signed</th>
                    <th class="py-1.5 px-2 text-emerald-700">Both Signed</th>
                  </tr>
                </thead>
                <tbody>
                  ${baseStats.disciplines
                    .map((d) => {
                      return `
                        <tr onclick="updateDetailSubFilter('${esc(tab.id)}', 'discipline', '${esc(d.discipline)}')" class="cursor-pointer hover:bg-blue-50/60 border-b border-slate-100 transition-colors">
                          <td class="py-1.5 px-3 text-left font-bold text-slate-800">${esc(
                            d.discipline === "Unassigned" ? "General / Unassigned" : d.discipline
                          )}</td>
                          <td class="py-1.5 px-2 font-bold">${d.total}</td>
                          <td class="py-1.5 px-2 text-emerald-700 font-semibold">${d.done}</td>
                          <td class="py-1.5 px-2 text-amber-700">${d.ongoing}</td>
                          <td class="py-1.5 px-2 text-rose-700 font-semibold">${d.not_yet}</td>
                          <td class="py-1.5 px-2 font-bold text-blue-700">${d.pct_done}%</td>
                          <td class="py-1.5 px-2 text-indigo-700">${d.bh_signed}</td>
                          <td class="py-1.5 px-2 text-teal-700">${d.cu_signed}</td>
                          <td class="py-1.5 px-2 text-emerald-700">${d.both_signed}</td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- DETAILED CHECKLIST TABLE WITH RESIZABLE COLUMNS AND ALWAYS-FIRST SECTION HEADERS -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div class="flex items-center gap-2">
              <h3 class="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <i class="fas fa-list-ul text-blue-600"></i>
                Detailed Inspection Checklist
              </h3>
              <span id="detail-count-badge-${esc(tab.id)}" class="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-xs"></span>
              <span class="hidden sm:inline-block text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                <i class="fas fa-arrows-left-right text-[10px] mr-1"></i> Drag column border to resize
              </span>
            </div>

            <div class="flex flex-wrap items-center gap-2 flex-1 max-w-3xl justify-end">
              <div class="relative flex-1 min-w-[180px]">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  id="detail-search-${esc(tab.id)}"
                  type="text"
                  value="${esc(tab.subFilter.search)}"
                  oninput="updateDetailSubFilter('${esc(tab.id)}', 'search', this.value)"
                  placeholder="Search Activity ID, description, ref doc, PIC, markup..."
                  class="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                onchange="updateDetailSubFilter('${esc(tab.id)}', 'status', this.value)"
                class="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white font-medium text-slate-700"
              >
                <option value="ALL" ${tab.subFilter.status === "ALL" ? "selected" : ""}>All Statuses</option>
                <option value="Done" ${tab.subFilter.status === "Done" ? "selected" : ""}>Status: Done</option>
                <option value="Ongoing" ${tab.subFilter.status === "Ongoing" ? "selected" : ""}>Status: Ongoing</option>
                <option value="Not yet" ${tab.subFilter.status === "Not yet" ? "selected" : ""}>Status: Not yet</option>
              </select>

              <select
                onchange="updateDetailSubFilter('${esc(tab.id)}', 'sigFilter', this.value)"
                class="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white font-medium text-slate-700"
              >
                <option value="ALL" ${tab.subFilter.sigFilter === "ALL" ? "selected" : ""}>All Signatures</option>
                <option value="BOTH_SIGNED" ${tab.subFilter.sigFilter === "BOTH_SIGNED" ? "selected" : ""}>Both Signed</option>
                <option value="BH_SIGNED" ${tab.subFilter.sigFilter === "BH_SIGNED" ? "selected" : ""}>BH Signed</option>
                <option value="CU_SIGNED" ${tab.subFilter.sigFilter === "CU_SIGNED" ? "selected" : ""}>CU Signed</option>
                <option value="BH_ONLY" ${tab.subFilter.sigFilter === "BH_ONLY" ? "selected" : ""}>BH Only (Wait CU)</option>
                <option value="DONE_UNSIGNED" ${tab.subFilter.sigFilter === "DONE_UNSIGNED" ? "selected" : ""}>Done (Unsigned)</option>
                <option value="UNSIGNED" ${tab.subFilter.sigFilter === "UNSIGNED" ? "selected" : ""}>Unsigned</option>
              </select>

              <button
                onclick="updateDetailSubFilter('${esc(tab.id)}', 'reset', '')"
                class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold"
                title="Reset sub-filters"
              >
                <i class="fas fa-rotate-left mr-1"></i>Reset
              </button>
              <button
                onclick="resetDetailColWidths('${esc(tab.id)}')"
                class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold"
                title="Reset column widths to default"
              >
                <i class="fas fa-arrows-left-right-to-line mr-1"></i>Reset Widths
              </button>
            </div>
          </div>

          <div id="detail-table-wrapper-${esc(tab.id)}" class="mt-3 w-full"></div>
        </div>
      </div>
    `;

    renderDetailTabTableOnly(tab);
  }

  // Resizable column handler using colgroup
  function initColumnResizers(tableId, tabId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const resizers = table.querySelectorAll(".col-resizer");
    resizers.forEach((resizer) => {
      resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const colIndex = parseInt(resizer.getAttribute("data-col-index"), 10);
        const colEl = table.querySelector(`colgroup col:nth-child(${colIndex + 1})`);
        if (!colEl) return;

        const startX = e.pageX;
        const startWidth = colEl.offsetWidth || state.colWidths[colIndex] || DEFAULT_COL_WIDTHS[colIndex];
        resizer.classList.add("is-resizing");
        document.body.classList.add("resizing-columns");

        function onMouseMove(moveEv) {
          const delta = moveEv.pageX - startX;
          const newWidth = Math.max(35, startWidth + delta);
          colEl.style.width = `${newWidth}px`;
          state.colWidths[colIndex] = newWidth;
        }

        function onMouseUp() {
          resizer.classList.remove("is-resizing");
          document.body.classList.remove("resizing-columns");
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          saveColWidths(state.colWidths);
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  }

  // Render Detail Table with Subtle Column Gridlines and Draggable Resizers
  function renderDetailTabTableOnly(tab) {
    const wrapper = document.getElementById(`detail-table-wrapper-${tab.id}`);
    const countBadge = document.getElementById(`detail-count-badge-${tab.id}`);
    if (!wrapper) return;

    const effectiveCriteria = getEffectiveDetailCriteria(tab);
    const list = getActivitiesByFilter(effectiveCriteria);

    if (countBadge) {
      countBadge.textContent = `${list.length} Activities`;
    }

    if (list.length === 0) {
      wrapper.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <i class="fas fa-inbox text-3xl mb-2"></i>
          <p class="text-sm">No inspection activities match the current filter criteria.</p>
        </div>
      `;
      return;
    }

    const sectionGroups = [];
    const groupMap = {};
    list.forEach((a) => {
      const key = `${a.unit}__${a.section}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          unit: a.unit,
          section: a.section,
          section_title: a.section_title,
          pdf_sheet: a.pdf_sheet,
          items: []
        };
        sectionGroups.push(groupMap[key]);
      }
      groupMap[key].items.push(a);
    });

    let globalRowIndex = 0;
    const tbodyHtml = sectionGroups
      .map((grp) => {
        const grpStats = computeStats(grp.items);
        const sectionHeaderRow = `
          <tr class="bg-blue-100/90 border-y-2 border-blue-300">
            <td colspan="16" class="py-2.5 px-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-blue-700 text-white font-extrabold text-xs">${esc(grp.unit)}</span>
                  <span class="px-2.5 py-0.5 rounded bg-slate-900 text-white font-extrabold text-xs">SECTION ${esc(grp.section)}</span>
                  <span class="font-extrabold text-blue-950 text-xs sm:text-sm uppercase tracking-wide">${esc(grp.section_title)}</span>
                </div>
                <div class="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  <span class="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">PDF: ${esc(grp.pdf_sheet || "-")}</span>
                  <span class="px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200">Total: ${grpStats.total}</span>
                  <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Done: ${grpStats.done} (${grpStats.pct_done}%)</span>
                  <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">Not yet: ${grpStats.not_yet}</span>
                  <span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">BH: ${grpStats.bh_signed}</span>
                  <span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200">CU: ${grpStats.cu_signed}</span>
                </div>
              </div>
            </td>
          </tr>
        `;

        const itemRows = grp.items
          .map((a) => {
            globalRowIndex++;
            const statusBadge =
              a.status === "Done"
                ? `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs inline-flex items-center gap-1"><i class="fas fa-check text-[10px]"></i>Done</span>`
                : a.status === "Ongoing"
                ? `<span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-xs inline-flex items-center gap-1"><i class="fas fa-spinner text-[10px]"></i>Ongoing</span>`
                : a.status === "N/A"
                ? `<span class="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs">N/A</span>`
                : `<span class="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-semibold text-xs">Not yet</span>`;

            const bhBadge = a.bh_signed
              ? `<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-xs"><i class="fas fa-check-circle mr-1"></i>Signed</span>`
              : `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs">Pending</span>`;

            const cuBadge = a.cu_signed
              ? `<span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold text-xs"><i class="fas fa-check-circle mr-1"></i>Signed</span>`
              : `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs">Pending</span>`;

            const theme = DISCIPLINE_COLORS[a.discipline] || DISCIPLINE_COLORS["Unassigned"];
            const discLabel = a.discipline === "Unassigned" ? "General" : a.discipline;

            return `
              <tr class="hover:bg-blue-50/40 transition-colors">
                <td class="py-2.5 px-2 text-center text-slate-400 font-mono text-xs">${globalRowIndex}</td>
                <td class="py-2.5 px-2 text-center">
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[11px]">${esc(a.unit)}</span>
                </td>
                <td class="py-2.5 px-2 text-center font-extrabold text-blue-700 whitespace-nowrap">${esc(a.activity)}</td>
                <td class="py-2.5 px-3 font-medium text-slate-900 leading-snug">${esc(a.description)}</td>
                
                <!-- Col 5: Remarks / Discipline (Col Q) - Editable -->
                <td class="editable-cell py-2 px-2.5 text-xs text-slate-800"
                    data-unit="${esc(a.unit)}" data-act-id="${esc(a.id)}" data-field="remarks_raw" data-row-num="${a.row_num || 0}" data-col-letter="Q"
                    onclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'remarks_raw')" ondblclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'remarks_raw')"
                    title="Double-click to edit (Excel style)">
                  <span class="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${theme.badge}">${esc(discLabel)}</span>
                  ${a.remarks_raw && a.remarks_raw !== discLabel ? `<div class="mt-1 text-[11px] text-slate-600">${formatCellWithSpellcheck(a.remarks_raw)}</div>` : ""}
                </td>

                <!-- Col 6: Status (Col P) - Editable -->
                <td class="editable-cell py-2 px-2 text-center whitespace-nowrap"
                    data-unit="${esc(a.unit)}" data-act-id="${esc(a.id)}" data-field="status" data-row-num="${a.row_num || 0}" data-col-letter="P"
                    onclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'status')" ondblclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'status')"
                    title="Double-click to edit (Excel style)">
                  ${statusBadge}
                </td>

                <!-- Col 7: BH Signature -->
                <td class="py-2.5 px-2 text-center whitespace-nowrap">
                  ${bhBadge}
                  ${a.bh_role ? `<div class="text-[10px] text-slate-400 mt-0.5">Role: ${esc(a.bh_role)} | Check: ${esc(a.check_type)}</div>` : ""}
                </td>

                <!-- Col 8: CU Signature -->
                <td class="py-2.5 px-2 text-center whitespace-nowrap">
                  ${cuBadge}
                  ${a.cu_role ? `<div class="text-[10px] text-slate-400 mt-0.5">Role: ${esc(a.cu_role)}</div>` : ""}
                </td>

                <!-- Col 9: Signature Date -->
                <td class="py-2.5 px-2 text-center text-xs font-medium text-slate-700 whitespace-nowrap">${esc(a.sig_date || "-")}</td>

                <!-- Col 10: PIC PMC (Col N) - Editable -->
                <td class="editable-cell py-2 px-2 text-xs font-medium text-slate-800"
                    data-unit="${esc(a.unit)}" data-act-id="${esc(a.id)}" data-field="pic_pmc" data-row-num="${a.row_num || 0}" data-col-letter="N"
                    onclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'pic_pmc')" ondblclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'pic_pmc')"
                    title="Double-click to edit (Excel style)">
                  <span class="font-semibold">${esc(a.pic_pmc || "-")}</span>
                </td>

                <!-- Col 11: PIC PQ/BV (Col O) - Editable -->
                <td class="editable-cell py-2 px-2 text-xs font-medium text-slate-800"
                    data-unit="${esc(a.unit)}" data-act-id="${esc(a.id)}" data-field="pic_pq" data-row-num="${a.row_num || 0}" data-col-letter="O"
                    onclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'pic_pq')" ondblclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'pic_pq')"
                    title="Double-click to edit (Excel style)">
                  <span class="font-semibold">${esc(a.pic_pq || "-")}</span>
                </td>

                <!-- Col 12: NOTE (Col M) - Editable -->
                <td class="editable-cell py-2 px-2 text-xs text-slate-700 whitespace-pre-line"
                    data-unit="${esc(a.unit)}" data-act-id="${esc(a.id)}" data-field="note" data-row-num="${a.row_num || 0}" data-col-letter="M"
                    onclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'note')" ondblclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'note')"
                    title="Double-click to edit (Excel style)">
                  <div class="leading-snug">${formatCellWithSpellcheck(a.note)}</div>
                </td>

                <!-- Col 13: Ref. Doc / Procedure / Criteria -->
                <td class="py-2.5 px-3 text-xs text-slate-600">
                  ${a.ref_doc ? `<div class="truncate max-w-[220px]" title="${esc(a.ref_doc)}"><strong>Ref:</strong> ${esc(a.ref_doc.replace(/\n/g, ", "))}</div>` : ""}
                  ${a.procedure ? `<div><strong>Proc:</strong> ${esc(a.procedure)}</div>` : ""}
                  ${a.acceptance ? `<div class="text-[11px] text-slate-500"><strong>Crit:</strong> ${esc(a.acceptance)}</div>` : ""}
                </td>

                <!-- Col 14: Site Markup (Col R) - Editable -->
                <td class="editable-cell py-2 px-2.5 text-xs text-slate-700 whitespace-pre-line"
                    data-unit="${esc(a.unit)}" data-act-id="${esc(a.id)}" data-field="site_markup" data-row-num="${a.row_num || 0}" data-col-letter="R"
                    onclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'site_markup')" ondblclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'site_markup')"
                    title="Double-click to edit (Excel style)">
                  <div class="leading-snug">${formatCellWithSpellcheck(a.site_markup)}</div>
                </td>

                <!-- Col 15: PDF Sheet (Col S) -->
                <td class="py-2.5 px-2 text-center font-mono text-xs text-slate-500">${esc(a.pdf_sheet || "-")}</td>

                <!-- Col 16: Status Update (Col T) - Editable -->
                <td class="editable-cell py-2 px-2.5 text-xs text-slate-900 bg-amber-50/25 whitespace-pre-line font-medium leading-relaxed"
                    data-unit="${esc(a.unit)}" data-act-id="${esc(a.id)}" data-field="status_update" data-row-num="${a.row_num || 0}" data-col-letter="T"
                    onclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'status_update')" ondblclick="window.startZoomCellEdit(this, '${esc(a.unit)}', '${esc(a.id)}', 'status_update')"
                    title="Double-click to edit (Excel style)">
                  ${a.status_update ? `<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-extrabold text-[10px] mr-1 uppercase">Update</span>` + formatCellWithSpellcheck(a.status_update) : `<span class="text-slate-300">-</span>`}
                </td>
              </tr>
            `;
          })
          .join("");

        return sectionHeaderRow + itemRows;
      })
      .join("");

    const thHeaders = [
      "#", "Unit", "Activity", "Activity Description", "Remarks / Discipline",
      "Status", "BH Signature", "CU Signature", "Signature Date",
      "PIC (PMC)", "PIC (PQ/BV)", "NOTE", "Ref. Doc / Procedure / Criteria",
      "Site Markup (Checked PDF)", "PDF", "Status Update"
    ];

    const colGroupHtml = state.colWidths.map((w) => `<col style="width: ${w}px;">`).join("");

    const theadThs = thHeaders
      .map(
        (title, idx) => `
        <th class="py-3 px-2 text-xs uppercase font-bold relative">
          <div class="px-1 truncate">${esc(title)}</div>
          <div class="col-resizer" data-col-index="${idx}" title="Drag to resize column"></div>
        </th>
      `
      )
      .join("");

    wrapper.innerHTML = `
      <div class="overflow-x-auto rounded-xl border border-slate-200 w-full">
        <table id="detail-table-${esc(tab.id)}" class="w-full text-xs sm:text-sm text-left sqcl-grid-table" style="table-layout: fixed;">
          <colgroup>
            ${colGroupHtml}
          </colgroup>
          <thead class="bg-slate-900 text-white">
            <tr>
              ${theadThs}
            </tr>
          </thead>
          <tbody class="bg-white">
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    `;

    initColumnResizers(`detail-table-${tab.id}`, tab.id);
  }

  // Modals for Source & Share
  window.openSourceModal = function () {
    const modal = document.getElementById("source-modal");
    if (modal) modal.classList.remove("hidden");
    const inp = document.getElementById("vercel-backend-url-input");
    if (inp) inp.value = localStorage.getItem("SQCL_BACKEND_URL") || "";
  };

  window.closeSourceModal = function () {
    const modal = document.getElementById("source-modal");
    if (modal) modal.classList.add("hidden");
  };

  window.saveBackendUrl = function () {
    const inp = document.getElementById("vercel-backend-url-input");
    if (!inp) return;
    const val = inp.value.trim();
    if (!val) {
      localStorage.removeItem("SQCL_BACKEND_URL");
      showToast("Cloud Backend URL cleared.", "info");
    } else {
      localStorage.setItem("SQCL_BACKEND_URL", val);
      showToast("Cloud Backend URL saved! Online sync will route through this server.", "success");
    }
  };

  window.handleCustomUrlSync = function () {
    const inp = document.getElementById("custom-onedrive-url");
    const url = inp ? inp.value.trim() : "";
    closeSourceModal();
    syncFromOneDrive(url);
  };

  window.openShareModal = function () {
    const modal = document.getElementById("share-modal");
    if (modal) modal.classList.remove("hidden");
  };

  window.closeShareModal = function () {
    const modal = document.getElementById("share-modal");
    if (modal) modal.classList.add("hidden");
  };

  window.copyShareUrl = function () {
    const inp = document.getElementById("share-url-input");
    if (inp) {
      inp.select();
      navigator.clipboard.writeText(inp.value).then(() => {
        showToast("Shareable link copied to clipboard!", "success");
      });
    }
  };

  /* =========================================================
   * MICROSOFT GRAPH API & MSAL TWO-WAY CLOUD SYNC MODULE
   * ========================================================= */
  const ONEDRIVE_SHARE_TOKEN = "u!aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9jMjJhZDg0YmFlMDJkYjM1L0lRQzc2QWZ3VXh2eVRiTk9POVhLOFhYd0FWMHFwWWFXaWZrTUVnUm5PcnFkQzVNP2U9YmVkQ1Jp";
  let msalClient = null;
  let msalAccount = null;
  let activeEditingCell = null;

  function getAzureClientId() {
    return localStorage.getItem("SQCL_AZURE_CLIENT_ID") || "";
  }

  function getStoredEdits() {
    try {
      return JSON.parse(localStorage.getItem("SQCL_USER_EDITS") || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveStoredEdits(edits) {
    try {
      localStorage.setItem("SQCL_USER_EDITS", JSON.stringify(edits));
    } catch (e) {}
    updatePendingEditsBadge();
  }

  function updatePendingEditsBadge() {
    const edits = getStoredEdits();
    const pendingCount = Object.values(edits).filter(e => !e.synced).length;
    const badge = document.getElementById("pending-edits-count");
    if (badge) {
      badge.textContent = `${pendingCount} pending`;
      if (pendingCount > 0) {
        badge.className = "px-2 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] animate-pulse";
      } else {
        badge.className = "px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-extrabold text-[10px]";
      }
    }
  }

  function applyLocalEdits(data) {
    if (!data || !data.units) return;
    const edits = getStoredEdits();
    for (const key of Object.keys(edits)) {
      const edit = edits[key];
      if (!edit || !edit.unit || !data.units[edit.unit]) continue;
      const acts = data.units[edit.unit].activities || [];
      const act = acts.find(a => a.id === edit.actId || (edit.row_num && a.row_num === edit.row_num));
      if (act) {
        if (edit.field === "remarks_raw" || edit.field === "remarks" || edit.field === "discipline") {
          act.remarks_raw = edit.value;
          act.discipline = normalizeDisciplineInBrowser(edit.value);
          act._edited_remarks_raw = true;
        } else if (edit.field === "status") {
          act.status = edit.value;
          act.done_unsigned = (edit.value === "Done") && (!act.both_signed);
          act._edited_status = true;
        } else {
          act[edit.field] = edit.value;
          act["_edited_" + edit.field] = true;
        }
      }
    }
  }

  async function initMsal() {
    if (typeof window.msal === "undefined") {
      updateGraphUiStatus("unavailable");
      return;
    }
    const clientId = getAzureClientId();
    if (!clientId) {
      updateGraphUiStatus("not_configured");
      return;
    }

    try {
      const msalConfig = {
        auth: {
          clientId: clientId,
          authority: "https://login.microsoftonline.com/common",
          redirectUri: window.location.origin + window.location.pathname
        },
        cache: {
          cacheLocation: "localStorage",
          storeAuthStateInCookie: false
        }
      };

      msalClient = new msal.PublicClientApplication(msalConfig);
      if (msalClient.initialize) {
        await msalClient.initialize();
      }

      const accounts = msalClient.getAllAccounts();
      if (accounts && accounts.length > 0) {
        msalAccount = accounts[0];
        updateGraphUiStatus("connected", msalAccount);
      } else {
        updateGraphUiStatus("disconnected");
      }
    } catch (e) {
      console.warn("MSAL initialization notice:", e);
      updateGraphUiStatus("error", null, e.message);
    }
  }

  function updateGraphUiStatus(status, account = null, errMsg = "") {
    const dot = document.getElementById("graph-status-dot");
    const label = document.getElementById("graph-status-label");
    const badge = document.getElementById("graph-badge");
    const userNameEl = document.getElementById("graph-user-name");
    const userEmailEl = document.getElementById("graph-user-email");
    const btnLogin = document.getElementById("btn-graph-login");
    const btnLogout = document.getElementById("btn-graph-logout");
    const clientIdInp = document.getElementById("graph-client-id-input");

    if (clientIdInp && !clientIdInp.value) {
      clientIdInp.value = getAzureClientId();
    }
    updatePendingEditsBadge();

    if (status === "connected" && account) {
      if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-400";
      if (label) label.textContent = account.name ? account.name.split(" ")[0] : "Graph Live";
      if (badge) {
        badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800";
        badge.textContent = "Live Connected";
      }
      if (userNameEl) userNameEl.textContent = account.name || "Microsoft Account";
      if (userEmailEl) userEmailEl.textContent = account.username || "";
      if (btnLogin) btnLogin.classList.add("hidden");
      if (btnLogout) btnLogout.classList.remove("hidden");
    } else if (status === "not_configured") {
      if (dot) dot.className = "w-2 h-2 rounded-full bg-amber-400";
      if (label) label.textContent = "Graph Setup";
      if (badge) {
        badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800";
        badge.textContent = "Need Client ID";
      }
      if (userNameEl) userNameEl.textContent = "Setup Azure Client ID";
      if (userEmailEl) userEmailEl.textContent = "Enter your free Azure App Client ID to enable cloud sync";
      if (btnLogin) btnLogin.classList.remove("hidden");
      if (btnLogout) btnLogout.classList.add("hidden");
    } else {
      if (dot) dot.className = "w-2 h-2 rounded-full bg-slate-400";
      if (label) label.textContent = "Graph Sync";
      if (badge) {
        badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600";
        badge.textContent = "Disconnected";
      }
      if (userNameEl) userNameEl.textContent = "Not Connected";
      if (userEmailEl) userEmailEl.textContent = "Sign in with Microsoft to enable 2-way cloud sync";
      if (btnLogin) btnLogin.classList.remove("hidden");
      if (btnLogout) btnLogout.classList.add("hidden");
    }
  }

  window.openGraphModal = function () {
    const modal = document.getElementById("graph-modal");
    if (modal) modal.classList.remove("hidden");
    updateGraphUiStatus(msalAccount ? "connected" : (getAzureClientId() ? "disconnected" : "not_configured"), msalAccount);
  };

  window.closeGraphModal = function () {
    const modal = document.getElementById("graph-modal");
    if (modal) modal.classList.add("hidden");
  };

  window.handleMicrosoftLogin = async function () {
    const clientId = getAzureClientId();
    if (!clientId) {
      showToast("Please enter an Azure Client ID in the box below first.", "warning");
      const inp = document.getElementById("graph-client-id-input");
      if (inp) inp.focus();
      return;
    }
    if (!msalClient) {
      await initMsal();
    }
    if (!msalClient) {
      showToast("Failed to initialize MSAL. Check your Client ID.", "error");
      return;
    }

    try {
      const loginRequest = {
        scopes: ["Files.ReadWrite", "User.Read"]
      };
      const response = await msalClient.loginPopup(loginRequest);
      msalAccount = response.account;
      updateGraphUiStatus("connected", msalAccount);
      showToast(`Signed in as ${msalAccount.name || msalAccount.username}!`, "success");
      await pushAllPendingEditsToGraph();
    } catch (e) {
      console.error("Microsoft Login Error:", e);
      showToast("Sign-in canceled or failed: " + (e.message || e), "error");
    }
  };

  window.handleMicrosoftLogout = async function () {
    if (!msalClient || !msalAccount) return;
    try {
      await msalClient.logoutPopup({ account: msalAccount });
      msalAccount = null;
      updateGraphUiStatus("disconnected");
      showToast("Signed out from Microsoft account.", "info");
    } catch (e) {
      msalAccount = null;
      updateGraphUiStatus("disconnected");
    }
  };

  window.saveClientId = function () {
    const inp = document.getElementById("graph-client-id-input");
    if (!inp) return;
    const val = inp.value.trim();
    if (!val) {
      localStorage.removeItem("SQCL_AZURE_CLIENT_ID");
      showToast("Client ID cleared.", "info");
    } else {
      localStorage.setItem("SQCL_AZURE_CLIENT_ID", val);
      showToast("Azure Client ID saved!", "success");
    }
    initMsal();
  };

  async function getGraphAccessToken() {
    if (!msalClient || !msalAccount) return null;
    try {
      const tokenResp = await msalClient.acquireTokenSilent({
        scopes: ["Files.ReadWrite", "User.Read"],
        account: msalAccount
      });
      return tokenResp.accessToken;
    } catch (e) {
      try {
        const tokenResp = await msalClient.acquireTokenPopup({
          scopes: ["Files.ReadWrite", "User.Read"],
          account: msalAccount
        });
        return tokenResp.accessToken;
      } catch (err2) {
        return null;
      }
    }
  }

  async function syncCellToMicrosoftGraph(unit, rowNum, colLetter, newValue) {
    const token = await getGraphAccessToken();
    if (!token) throw new Error("Please sign in with Microsoft to sync directly to OneDrive.");

    const sheetName = unit === "GTG#1" ? "SQCL Check Sheet GTC#1" : "SQCL Check Sheet GTC#2";
    const cellAddr = `${colLetter}${rowNum}`;
    const endpoint = `https://graph.microsoft.com/v1.0/shares/${ONEDRIVE_SHARE_TOKEN}/driveItem/workbook/worksheets('${encodeURIComponent(sheetName)}')/range(address='${cellAddr}')`;

    const resp = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [[newValue]]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = `HTTP ${resp.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error ? errJson.error.message : errMsg;
      } catch (pe) {}
      throw new Error(`Graph API error: ${errMsg}`);
    }

    return await resp.json();
  }

  window.pushAllPendingEditsToGraph = async function () {
    const edits = getStoredEdits();
    const pendingKeys = Object.keys(edits).filter(k => !edits[k].synced);
    if (pendingKeys.length === 0) {
      showToast("No pending edits to sync.", "info");
      return;
    }

    if (!msalAccount) {
      showToast("Please sign in with Microsoft first to push edits.", "warning");
      openGraphModal();
      return;
    }

    showToast(`Syncing ${pendingKeys.length} pending edit(s) to OneDrive...`, "info");
    let successCount = 0;
    let failCount = 0;

    for (const key of pendingKeys) {
      const edit = edits[key];
      try {
        await syncCellToMicrosoftGraph(edit.unit, edit.row_num, edit.colLetter, edit.value);
        edit.synced = true;
        successCount++;
      } catch (err) {
        console.error(`Failed to sync cell ${edit.colLetter}${edit.row_num}:`, err);
        failCount++;
      }
    }

    saveStoredEdits(edits);
    if (successCount > 0) {
      showToast(`✓ Successfully synced ${successCount} cell(s) to OneDrive!`, "success");
    }
    if (failCount > 0) {
      showToast(`${failCount} edit(s) could not be synced. Check connection.`, "warning");
    }
  };

  /* =========================================================
   * BACKGROUND AUTO-SYNC & EXCEL-LIKE INLINE CELL EDITING
   * ========================================================= */
  async function pushAllPendingEditsSilently() {
    const edits = getStoredEdits();
    const pendingKeys = Object.keys(edits).filter(k => !edits[k].synced);
    if (pendingKeys.length === 0) return;

    for (const key of pendingKeys) {
      const edit = edits[key];
      let syncedThis = false;

      // 1. Try local server
      try {
        const resp = await fetch("/api/update_cell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unit: edit.unit, row_num: edit.row_num, field: edit.field, value: edit.value })
        });
        if (resp.ok) {
          const res = await resp.json();
          if (res && res.status === "ok") {
            edit.synced = true;
            syncedThis = true;
          }
        }
      } catch (e) {}

      // 2. Try Microsoft Graph API if signed in
      if (!syncedThis && msalAccount) {
        try {
          await syncCellToMicrosoftGraph(edit.unit, edit.row_num, edit.colLetter, edit.value);
          edit.synced = true;
          syncedThis = true;
        } catch (e) {}
      }
    }
    saveStoredEdits(edits);
  }

  // Periodic background auto-sync every 30 seconds
  setInterval(() => {
    pushAllPendingEditsSilently().catch(() => {});
  }, 30000);

  function updateActiveTypoHint(el, tdElement) {
    let hintEl = document.getElementById("active-cell-typo-hint");
    if (!window.SQCLSpellcheck || !el || !tdElement) {
      if (hintEl) hintEl.remove();
      return;
    }
    const val = el.value || "";
    const typos = window.SQCLSpellcheck.findMisspelledWords(val);
    if (typos.length === 0) {
      if (hintEl) hintEl.remove();
      return;
    }
    if (!hintEl) {
      hintEl = document.createElement("div");
      hintEl.id = "active-cell-typo-hint";
      hintEl.className = "active-cell-typo-floating";
      document.body.appendChild(hintEl);
    }
    const rect = tdElement.getBoundingClientRect();
    hintEl.style.top = `${rect.bottom + window.scrollY + 2}px`;
    hintEl.style.left = `${rect.left + window.scrollX}px`;
    hintEl.innerHTML = `<i class="fas fa-spell-check mr-1 text-rose-500"></i> Spelling: <span class="font-bold underline text-rose-600">${typos.slice(0, 3).map(esc).join(", ")}</span>`;
  }

  function removeActiveTypoHint() {
    const hintEl = document.getElementById("active-cell-typo-hint");
    if (hintEl) hintEl.remove();
  }

  function formatCellWithSpellcheck(text) {
    if (!text) return '<span class="text-slate-300">-</span>';
    // Ensure typist typo P&I is normalized to P&ID without changing any other content
    const clean = String(text).replace(/\bP&I\b(?![Dd])/g, "P&ID");
    return esc(clean);
  }

  const FIELD_MAP_INFO = {
    bh_signature: { col: 4, letter: "D", name: "BH Signature" },
    cu_signature: { col: 5, letter: "E", name: "CU Signature" },
    note: { col: 13, letter: "M", name: "NOTE" },
    pic_pmc: { col: 14, letter: "N", name: "Person-In-Charge (PMC)" },
    pic_pq: { col: 15, letter: "O", name: "Person-In-Charge (PQ POC & BV)" },
    status: { col: 16, letter: "P", name: "Status" },
    remarks_raw: { col: 17, letter: "Q", name: "Remarks / Discipline" },
    remarks: { col: 17, letter: "Q", name: "Remarks / Discipline" },
    discipline: { col: 17, letter: "Q", name: "Remarks / Discipline" },
    site_markup: { col: 18, letter: "R", name: "Site Markup (Checked PDF)" },
    pdf_sheet: { col: 19, letter: "S", name: "PDF Sheet" },
    status_update: { col: 20, letter: "T", name: "Status Update" }
  };

  let activeInlineEditor = null;

  function findActivity(unit, actId) {
    if (!state.data || !state.data.units || !state.data.units[unit]) return null;
    const acts = state.data.units[unit].activities || [];
    return acts.find((a) => a.id === actId);
  }

  window.finishCurrentInlineEdit = function () {
    if (activeInlineEditor) {
      window.commitInlineEdit(false);
    }
  };

  let activeZoomEditor = null;

  window.startZoomCellEdit = function (tdElement, unit, actId, field) {
    if (!tdElement) return;
    if (activeZoomEditor && activeZoomEditor.tdElement === tdElement) return;
    if (activeZoomEditor) {
      window.commitZoomEdit();
    }

    const act = findActivity(unit, actId);
    if (!act) return;

    const curVal = act[field] || "";
    const colInfo = FIELD_MAP_INFO[field] || { col: 18, letter: "R", name: field };
    const fieldName = colInfo.name;

    tdElement.classList.add("cell-editing");

    // Position & dimension calculations
    const rect = tdElement.getBoundingClientRect();
    const isLongText = (field === "note" || field === "site_markup" || field === "status_update");
    const isSelect = (field === "status");

    let popoverWidth = isLongText ? Math.max(rect.width * 1.5, 420) : (isSelect ? 260 : 360);
    popoverWidth = Math.min(popoverWidth, window.innerWidth - 24);

    let left = rect.left + window.scrollX;
    if (rect.left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(12 + window.scrollX, window.innerWidth - popoverWidth - 16 + window.scrollX);
    }

    let top = rect.top + window.scrollY;
    const estHeight = isLongText ? 210 : (isSelect ? 130 : 140);
    if (rect.top + estHeight > window.innerHeight && rect.top > estHeight) {
      top = Math.max(window.scrollY + 10, rect.bottom + window.scrollY - estHeight);
    }

    const popover = document.createElement("div");
    popover.id = "cell-zoom-popover";
    popover.className = "cell-zoom-popover";
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.width = `${popoverWidth}px`;

    let inputHtml = "";
    if (isSelect) {
      inputHtml = `
        <select class="cell-zoom-select">
          <option value="Done" ${curVal === "Done" ? "selected" : ""}>Done</option>
          <option value="Ongoing" ${curVal === "Ongoing" ? "selected" : ""}>Ongoing</option>
          <option value="Not yet" ${curVal === "Not yet" || !curVal ? "selected" : ""}>Not yet</option>
          <option value="N/A" ${curVal === "N/A" ? "selected" : ""}>N/A</option>
        </select>
      `;
    } else if (field === "pic_pmc" || field === "pic_pq" || field === "remarks_raw") {
      const datalistId = field === "pic_pmc" ? "datalist-pic-pmc" : (field === "pic_pq" ? "datalist-pic-pq" : "datalist-discipline");
      inputHtml = `<input type="text" list="${datalistId}" class="cell-zoom-input" value="${esc(curVal)}" spellcheck="true" lang="en">`;
    } else {
      inputHtml = `<textarea class="cell-zoom-textarea" rows="4" spellcheck="true" lang="en">${esc(curVal)}</textarea>`;
    }

    popover.innerHTML = `
      <div class="cell-zoom-header">
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="cell-zoom-badge">${esc(fieldName)}</span>
          <span class="text-xs text-slate-500 font-mono truncate">${esc(unit)} • Act ${esc(act.activity)}</span>
        </div>
        <button type="button" class="zoom-btn-close" title="Cancel (Esc)">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="cell-zoom-body">
        ${inputHtml}
      </div>
      <div class="cell-zoom-footer">
        <div class="cell-zoom-typo-container flex-1 overflow-hidden"></div>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" class="zoom-btn-cancel">Cancel</button>
          <button type="button" class="zoom-btn-save"><i class="fas fa-check mr-1"></i> Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(popover);

    activeZoomEditor = {
      popover,
      tdElement,
      unit,
      actId,
      field,
      act,
      originalValue: curVal,
      onOutsideClick: null
    };

    const targetEl = popover.querySelector("textarea") || popover.querySelector("input") || popover.querySelector("select");
    const typoContainer = popover.querySelector(".cell-zoom-typo-container");
    const btnSave = popover.querySelector(".zoom-btn-save");
    const btnCancel = popover.querySelector(".zoom-btn-cancel");
    const btnClose = popover.querySelector(".zoom-btn-close");

    // Real-time spellcheck typo detector
    const checkTypos = () => {
      if (!window.SQCLSpellcheck || !targetEl || !typoContainer) return;
      const typos = window.SQCLSpellcheck.findMisspelledWords(targetEl.value || "");
      if (typos.length > 0) {
        typoContainer.innerHTML = `<span class="text-[11px] text-rose-600 font-medium flex items-center gap-1 truncate" title="Spelling typos: ${typos.join(', ')}"><i class="fas fa-spell-check text-rose-500 shrink-0"></i> Typo: <b>${typos.slice(0, 2).map(esc).join(', ')}</b></span>`;
      } else {
        typoContainer.innerHTML = "";
      }
    };

    if (targetEl) {
      targetEl.focus();
      if (targetEl.select) targetEl.select();
      targetEl.addEventListener("input", checkTypos);
      checkTypos();

      targetEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          if (!isLongText || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            window.commitZoomEdit();
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          window.cancelZoomEdit();
        } else if (e.key === "Tab") {
          e.preventDefault();
          window.commitZoomEdit(e.shiftKey ? -1 : 1);
        }
      });
    }

    if (btnSave) {
      btnSave.addEventListener("click", () => window.commitZoomEdit());
    }
    if (btnCancel) {
      btnCancel.addEventListener("click", () => window.cancelZoomEdit());
    }
    if (btnClose) {
      btnClose.addEventListener("click", () => window.cancelZoomEdit());
    }

    // Auto-save on click outside
    const onOutsideClick = (e) => {
      if (!activeZoomEditor) return;
      if (!popover.contains(e.target) && !tdElement.contains(e.target)) {
        window.commitZoomEdit();
      }
    };
    activeZoomEditor.onOutsideClick = onOutsideClick;
    setTimeout(() => {
      document.addEventListener("mousedown", onOutsideClick);
    }, 60);
  };

  window.commitZoomEdit = function (tabDirection) {
    if (!activeZoomEditor) return;
    const { popover, tdElement, unit, actId, field, act, originalValue, onOutsideClick } = activeZoomEditor;
    if (onOutsideClick) {
      document.removeEventListener("mousedown", onOutsideClick);
    }
    activeZoomEditor = null;

    let newValue = originalValue;
    const select = popover.querySelector("select");
    const input = popover.querySelector("input");
    const textarea = popover.querySelector("textarea");

    if (select) newValue = select.value.trim();
    else if (input) newValue = input.value.trim();
    else if (textarea) newValue = textarea.value.trim();

    popover.remove();
    tdElement.classList.remove("cell-editing");

    // 1. Update in-memory data
    act[field] = newValue;
    act["_edited_" + field] = true;
    if (field === "status") {
      act.done_unsigned = (newValue === "Done") && (!act.both_signed);
    }
    if (field === "remarks_raw") {
      act.discipline = normalizeDisciplineInBrowser(newValue);
    }
    if (field === "bh_signature" || field === "cu_signature") {
      const bhVal = (field === "bh_signature" ? newValue : (act.bh_signature || "")).trim();
      const cuVal = (field === "cu_signature" ? newValue : (act.cu_signature || "")).trim();
      act.bh_signed = bhVal !== "" && bhVal !== "-" && bhVal.toLowerCase() !== "not yet" && bhVal.toLowerCase() !== "n/a";
      act.cu_signed = cuVal !== "" && cuVal !== "-" && cuVal.toLowerCase() !== "not yet" && cuVal.toLowerCase() !== "n/a";
      act.both_signed = act.bh_signed && act.cu_signed;
      if (act.both_signed) {
        act.sig_status = "Both Signed";
      } else if (act.bh_signed) {
        act.sig_status = "BH Signed Only";
      } else if (act.cu_signed) {
        act.sig_status = "CU Signed Only";
      } else {
        act.sig_status = "Unsigned";
      }
      act.done_unsigned = (act.status === "Done") && (!act.both_signed);
    }

    ensureDataLedgerConsistency();

    // 2. Save locally into SQCL_USER_EDITS
    const colInfo = FIELD_MAP_INFO[field] || { col: 18, letter: "R", name: field };
    const rowNum = act.row_num || 0;
    const edits = getStoredEdits();
    const editKey = `${unit}_${actId}_${field}`;
    edits[editKey] = {
      unit,
      actId,
      row_num: rowNum,
      field,
      colLetter: colInfo.letter,
      value: newValue,
      timestamp: new Date().toISOString(),
      synced: false
    };
    saveStoredEdits(edits);

    // Save offline snapshot
    try {
      localStorage.setItem("SQCL_OFFLINE_DATA", JSON.stringify(state.data));
    } catch (e) {}

    // 3. Re-render the single cell content cleanly without badges
    renderSingleCellDisplay(tdElement, act, field);

    // 4. Background push to local server
    fetch("/api/update_cell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit, row_num: rowNum, field, value: newValue })
    }).then(r => r.ok && r.json()).then(res => {
      if (res && res.status === "ok") {
        edits[editKey].synced = true;
        saveStoredEdits(edits);
      }
    }).catch(() => {});

    // 5. Cloud Graph push if logged in
    if (msalAccount) {
      syncCellToMicrosoftGraph(unit, rowNum, colInfo.letter, newValue).then(() => {
        edits[editKey].synced = true;
        saveStoredEdits(edits);
      }).catch(() => {});
    }

    // 6. Handle Tab key navigation to next editable cell
    if (tabDirection && typeof tabDirection === "number") {
      const allEditable = Array.from(document.querySelectorAll(".editable-cell"));
      const curIdx = allEditable.indexOf(tdElement);
      if (curIdx !== -1) {
        const nextIdx = curIdx + tabDirection;
        if (nextIdx >= 0 && nextIdx < allEditable.length) {
          const nextTd = allEditable[nextIdx];
          const nUnit = nextTd.getAttribute("data-unit");
          const nActId = nextTd.getAttribute("data-act-id");
          const nField = nextTd.getAttribute("data-field");
          setTimeout(() => {
            window.startZoomCellEdit(nextTd, nUnit, nActId, nField);
          }, 50);
        }
      }
    }
  };

  window.cancelZoomEdit = function () {
    if (!activeZoomEditor) return;
    const { popover, tdElement, onOutsideClick } = activeZoomEditor;
    if (onOutsideClick) {
      document.removeEventListener("mousedown", onOutsideClick);
    }
    activeZoomEditor = null;
    popover.remove();
    tdElement.classList.remove("cell-editing");
  };

  // Backward compatibility aliases
  window.startInlineCellEdit = window.startZoomCellEdit;
  window.commitInlineEdit = window.commitZoomEdit;
  window.cancelInlineEdit = window.cancelZoomEdit;

  function renderSingleCellDisplay(tdElement, a, field) {
    if (field === "status") {
      const statusBadge =
        a.status === "Done"
          ? `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs inline-flex items-center gap-1"><i class="fas fa-check text-[10px]"></i>Done</span>`
          : a.status === "Ongoing"
          ? `<span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-xs inline-flex items-center gap-1"><i class="fas fa-spinner text-[10px]"></i>Ongoing</span>`
          : a.status === "N/A"
          ? `<span class="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs">N/A</span>`
          : `<span class="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-semibold text-xs">Not yet</span>`;
      tdElement.innerHTML = `<div class="inline-flex items-center justify-center">${statusBadge}</div>`;
      return;
    }

    if (field === "remarks_raw") {
      const theme = DISCIPLINE_COLORS[a.discipline] || DISCIPLINE_COLORS["Unassigned"];
      const discLabel = a.discipline === "Unassigned" ? "General" : a.discipline;
      tdElement.innerHTML = `
        <div>
          <span class="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${theme.badge}">${esc(discLabel)}</span>
          ${a.remarks_raw && a.remarks_raw !== discLabel ? `<div class="mt-1 text-[11px] text-slate-600">${formatCellWithSpellcheck(a.remarks_raw)}</div>` : ""}
        </div>
      `;
      return;
    }

    if (field === "pic_pmc") {
      tdElement.innerHTML = `<span class="font-semibold">${esc(a.pic_pmc || "-")}</span>`;
      return;
    }

    if (field === "pic_pq") {
      tdElement.innerHTML = `<span class="font-semibold">${esc(a.pic_pq || "-")}</span>`;
      return;
    }

    if (field === "note") {
      tdElement.innerHTML = `<div class="leading-snug">${formatCellWithSpellcheck(a.note)}</div>`;
      return;
    }

    if (field === "site_markup") {
      tdElement.innerHTML = `<div class="leading-snug">${formatCellWithSpellcheck(a.site_markup)}</div>`;
      return;
    }

    if (field === "status_update") {
      tdElement.innerHTML = a.status_update
        ? `<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-extrabold text-[10px] mr-1 uppercase">Update</span>` + formatCellWithSpellcheck(a.status_update)
        : `<span class="text-slate-300">-</span>`;
      return;
    }
  }

  /* =========================================================
   * MODAL CELL EDITOR (POPUP DIALOG OPTION)
   * ========================================================= */
  window.openCellEditor = function (unit, actId, field) {
    if (!state.data || !state.data.units || !state.data.units[unit]) return;
    const activities = state.data.units[unit].activities || [];
    const act = activities.find(a => a.id === actId);
    if (!act) return;

    activeEditingCell = { unit, actId, field, act };

    const modal = document.getElementById("cell-edit-modal");
    const badge = document.getElementById("edit-field-badge");
    const title = document.getElementById("edit-modal-title");
    const unitEl = document.getElementById("edit-unit-label");
    const actEl = document.getElementById("edit-act-label");
    const descEl = document.getElementById("edit-desc-label");
    const cellEl = document.getElementById("edit-cell-label");
    const sheetEl = document.getElementById("edit-sheet-label");
    const textarea = document.getElementById("cell-edit-textarea");
    const syncMsg = document.getElementById("cell-sync-status-msg");

    const colInfo = FIELD_MAP_INFO[field] || { col: 18, letter: "R", name: field };
    const colLetter = colInfo.letter;
    const fieldName = colInfo.name;
    const sheetName = unit === "GTG#1" ? "SQCL Check Sheet GTC#1" : "SQCL Check Sheet GTC#2";

    if (badge) badge.textContent = `${fieldName} • Col ${colLetter}`;
    if (title) title.textContent = `Edit Activity ${act.activity}`;
    if (unitEl) unitEl.textContent = `${unit} (${act.unit_code || ""})`;
    if (actEl) actEl.textContent = act.activity;
    if (descEl) descEl.textContent = act.description || "-";
    if (cellEl) cellEl.textContent = `${colLetter}${act.row_num || "?"}`;
    if (sheetEl) sheetEl.textContent = sheetName;
    if (textarea) textarea.value = act[field] || "";

    if (syncMsg) {
      if (msalAccount) {
        syncMsg.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Connected: ${esc(msalAccount.name || "Microsoft Account")}`;
      } else {
        syncMsg.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> Saved Locally (Auto-syncs in background)`;
      }
    }

    if (modal) modal.classList.remove("hidden");
    if (textarea) {
      setTimeout(() => textarea.focus(), 80);
    }
  };

  window.closeCellEditModal = function () {
    const modal = document.getElementById("cell-edit-modal");
    if (modal) modal.classList.add("hidden");
    activeEditingCell = null;
  };

  window.commitCellEdit = async function () {
    if (!activeEditingCell) return;
    const { unit, actId, field, act } = activeEditingCell;
    const textarea = document.getElementById("cell-edit-textarea");
    if (!textarea) return;

    const newValue = textarea.value.trim();
    const colInfo = FIELD_MAP_INFO[field] || { col: 18, letter: "R", name: field };
    const colLetter = colInfo.letter;
    const rowNum = act.row_num || 0;

    // 1. Update in-memory state
    act[field] = newValue;
    act["_edited_" + field] = true;
    if (field === "status") {
      act.done_unsigned = (newValue === "Done") && (!act.both_signed);
    }
    if (field === "remarks_raw") {
      act.discipline = normalizeDisciplineInBrowser(newValue);
    }
    if (field === "bh_signature" || field === "cu_signature") {
      const bhVal = (field === "bh_signature" ? newValue : (act.bh_signature || "")).trim();
      const cuVal = (field === "cu_signature" ? newValue : (act.cu_signature || "")).trim();
      act.bh_signed = bhVal !== "" && bhVal !== "-" && bhVal.toLowerCase() !== "not yet" && bhVal.toLowerCase() !== "n/a";
      act.cu_signed = cuVal !== "" && cuVal !== "-" && cuVal.toLowerCase() !== "not yet" && cuVal.toLowerCase() !== "n/a";
      act.both_signed = act.bh_signed && act.cu_signed;
      if (act.both_signed) {
        act.sig_status = "Both Signed";
      } else if (act.bh_signed) {
        act.sig_status = "BH Signed Only";
      } else if (act.cu_signed) {
        act.sig_status = "CU Signed Only";
      } else {
        act.sig_status = "Unsigned";
      }
      act.done_unsigned = (act.status === "Done") && (!act.both_signed);
    }

    ensureDataLedgerConsistency();

    // 2. Save into local persistent edits
    const edits = getStoredEdits();
    const editKey = `${unit}_${actId}_${field}`;
    edits[editKey] = {
      unit,
      actId,
      row_num: rowNum,
      field,
      colLetter,
      value: newValue,
      timestamp: new Date().toISOString(),
      synced: false
    };
    saveStoredEdits(edits);

    // Save offline snapshot
    try {
      localStorage.setItem("SQCL_OFFLINE_DATA", JSON.stringify(state.data));
    } catch (e) {}

    // Close modal & refresh view immediately
    closeCellEditModal();
    if (state.activeTab === "detail" || state.activeTab.startsWith("detail-")) {
      renderDetailTab(state.activeTab);
    }

    // 3. Attempt local Python server update if running
    try {
      fetch("/api/update_cell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit, row_num: rowNum, field, value: newValue })
      }).then(r => r.ok && r.json()).then(res => {
        if (res && res.status === "ok") {
          edits[editKey].synced = true;
          saveStoredEdits(edits);
        }
      }).catch(() => {});
    } catch (e) {}

    // 4. Attempt Microsoft Graph API Cloud Sync
    if (msalAccount) {
      showToast(`Syncing cell ${colLetter}${rowNum} to OneDrive...`, "info");
      try {
        await syncCellToMicrosoftGraph(unit, rowNum, colLetter, newValue);
        edits[editKey].synced = true;
        saveStoredEdits(edits);
        showToast(`✓ Successfully synced cell ${colLetter}${rowNum} to OneDrive via Graph API!`, "success");
      } catch (err) {
        console.error("Cloud Graph Sync error:", err);
      }
    }
  };

  document.addEventListener("keydown", (e) => {
    if (activeEditingCell) {
      if (e.key === "Escape") {
        closeCellEditModal();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commitCellEdit();
      }
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    if (modeParam === "phone" || modeParam === "laptop") {
      state.deviceMode = modeParam;
    } else {
      const savedMode = localStorage.getItem("sqcl_device_mode");
      if (savedMode === "phone" || savedMode === "laptop") {
        state.deviceMode = savedMode;
      }
    }

    if (state.deviceMode === "phone") {
      document.body.classList.add("phone-mode-active");
    }

    // Invalidate stale caches if a new build or bundle data is available
    const SQCL_APP_BUILD_ID = "2026-11-06-v2-synced-status-p";
    try {
      const storedBuild = localStorage.getItem("SQCL_APP_BUILD_ID");
      if (storedBuild !== SQCL_APP_BUILD_ID) {
        localStorage.removeItem("SQCL_OFFLINE_DATA");
        localStorage.removeItem("SQCL_CLOSING_LEDGER");
        localStorage.setItem("SQCL_APP_BUILD_ID", SQCL_APP_BUILD_ID);
      }
    } catch (e) {}

    // Prioritize newest data between bundled script and cached offline data
    const bundleData = window.SQCL_INITIAL_DATA;
    const bundleTimestamp = (bundleData && bundleData.project_info && bundleData.project_info.last_synced) || "";
    let cachedData = null;
    try {
      const cachedStr = localStorage.getItem("SQCL_OFFLINE_DATA");
      if (cachedStr) cachedData = JSON.parse(cachedStr);
    } catch (storageErr) {}

    const cachedTimestamp = (cachedData && cachedData.project_info && cachedData.project_info.last_synced) || "";

    if (bundleData && (!cachedTimestamp || bundleTimestamp >= cachedTimestamp)) {
      state.data = bundleData;
    } else if (cachedData && cachedData.units && cachedData.units["GTG#1"]) {
      state.data = cachedData;
    } else if (bundleData) {
      state.data = bundleData;
    }

    if (!state.data) {
      try {
        const r = await fetch("/api/data");
        if (r.ok) state.data = await r.json();
      } catch (e) {}
    }

    if (state.data && state.data.project_info) {
      const syncEl = document.getElementById("sync-status-text");
      if (syncEl) syncEl.textContent = `Last Synced: ${state.data.project_info.last_synced}`;
    }

    // Apply any local edits saved in browser
    if (state.data) {
      applyLocalEdits(state.data);
    }

    // Guarantee 100% two-way data consistency between state.data and state.closingLedger
    ensureDataLedgerConsistency();
    // Initialize Microsoft MSAL / Graph API
    initMsal();

    if (params.get("view") === "detail") {
      const criteria = {
        unit: params.get("unit") || "ALL",
        section: params.get("section") || "ALL",
        discipline: params.get("discipline") || "ALL",
        status: params.get("status") || "ALL",
        sigFilter: params.get("sigFilter") || "ALL",
        scheduleDate: params.get("scheduleDate") || "ALL",
        scheduledOnly: params.get("scheduledOnly") === "1",
        title: params.get("title") || ""
      };
      openDetailTab(criteria, false);
    } else {
      renderAll();
    }
  });
})();
