// SQCL Dashboard Application Logic (100% English, Full-Width, Resizable Columns with Subtle Grid, Device Modes)
(function () {
  "use strict";

  const DEFAULT_COL_WIDTHS = [48, 75, 85, 360, 145, 110, 120, 120, 110, 150, 240, 240, 55];

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
    "Unassigned": { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", bar: "#64748B", badge: "bg-slate-100 text-slate-700 border-slate-200" }
  };

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

    if (criteria.section && criteria.section !== "ALL") {
      list = list.filter((a) => a.section === criteria.section);
    }
    if (criteria.discipline && criteria.discipline !== "ALL") {
      list = list.filter((a) => a.discipline === criteria.discipline);
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
          (a.site_markup && a.site_markup.toLowerCase().includes(q))
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
      criteria.scheduledOnly ? "SCHED" : "ALL"
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
        scheduledOnly: Boolean(criteria.scheduledOnly)
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

  window.syncFromOneDrive = async function (customUrl) {
    const btn = document.getElementById("btn-sync-onedrive");
    const statusText = document.getElementById("sync-status-text");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Syncing...`;
    }
    try {
      const resp = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: customUrl || "" })
      });
      const res = await resp.json();
      if (resp.ok && res.status === "ok" && res.data) {
        state.data = res.data;
        window.SQCL_INITIAL_DATA = res.data;
        if (statusText) {
          statusText.textContent = `Last Synced: ${res.data.project_info.last_synced}`;
        }
        showToast("Synced latest Excel data from OneDrive successfully!", "success");
        renderAll();
      } else {
        throw new Error(res.message || "Failed to sync from OneDrive.");
      }
    } catch (err) {
      showToast("Sync Error: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-sync-alt mr-1"></i> Sync OneDrive`;
      }
    }
  };

  // Local Excel (.xlsx) file upload fallback
  window.handleLocalExcelUpload = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    showToast("Processing uploaded Excel file...", "info");
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        showToast(`Loaded workbook with ${workbook.SheetNames.length} sheets!`, "success");
        closeSourceModal();
      } catch (err) {
        showToast("Error reading Excel: " + err.message, "error");
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
    ws.mergeCells("A1:N1");
    ws.getCell("A1").value = `VIETNAM BLOCK B GAS PROJECT  |  ${payload.title}`;
    ws.getCell("A1").font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    ws.getRow(1).height = 28;

    ws.mergeCells("A2:N2");
    ws.getCell("A2").value = `Doc: SOI0007689 Rev. 0 • Customer: MCDERMOTT PTSC CONSORTIUM (MPC) • Scope: ${payload.filter_desc}`;
    ws.getCell("A2").font = { name: "Calibri", size: 10, color: { argb: "FFE2E8F0" } };
    ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    ws.getRow(2).height = 20;

    // Header row
    const headers = [
      "Unit", "Section", "Activity", "Activity Description", "Discipline",
      "Status", "BH Sig", "CU Sig", "Signature Date", "Role (BH/CU)",
      "PIC (PMC / PQ&BV)", "Ref.Doc / Procedure", "Acceptance / Site Markup", "PDF"
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
        ws.mergeCells(`A${curRow}:N${curRow}`);
        ws.getCell(`A${curRow}`).value = `[${a.unit}] SECTION ${a.section} — ${a.section_title} (PDF Sheet: ${a.pdf_sheet || "-"})`;
        ws.getCell(`A${curRow}`).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E3A8A" } };
        ws.getCell(`A${curRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
        ws.getRow(curRow).height = 22;
        curRow++;
      }

      ws.getRow(curRow).values = [
        a.unit, a.section, a.activity, a.description, a.discipline,
        a.status, a.bh_signed ? "Signed" : "Pending", a.cu_signed ? "Signed" : "Pending",
        a.sig_date || "", `BH:${a.bh_role||"-"}/CU:${a.cu_role||"-"}`,
        [a.pic_pmc, a.pic_pq].filter(Boolean).join(" / "),
        [a.ref_doc ? a.ref_doc.replace(/\n/g, ", ") : "", a.procedure].filter(Boolean).join(" | "),
        [a.acceptance, a.site_markup ? a.site_markup.replace(/\n/g, "; ") : ""].filter(Boolean).join(" | "),
        a.pdf_sheet || ""
      ];
      curRow++;
    });

    const colWidths = [10, 10, 12, 45, 20, 12, 12, 12, 13, 14, 18, 28, 35, 10];
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
                colSpan: 11,
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
            [a.site_markup ? a.site_markup.replace(/\n/g, "; ") : "", a.ref_doc ? a.ref_doc.split("\n")[0] : ""].filter(Boolean).join(" | ") || "-",
            a.pdf_sheet || "-"
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
            ["Unit", "Activity", "Activity Description", "Discipline", "Status", "BH Signature", "CU Signature", "Sig Date", "PIC (PMC/PQ)", "Site Markup / Ref Doc", "PDF"]
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

  // Section 5: Inspection Schedule by Discipline & Date
  function renderInspectionScheduleSection() {
    if (!state.data || !state.data.units) return;
    const unit = state.selectedUnit;
    const schedDiscFilter = state.summaryFilters.scheduleDiscipline || "ALL";

    const filterBarEl = document.getElementById("schedule-discipline-filter");
    if (filterBarEl) {
      const opts = [
        { id: "ALL", label: "All Scheduled Disciplines" },
        { id: "Mechanical", label: "Mechanical" },
        { id: "Electrical & Instruments", label: "Electrical & Instruments" }
      ];
      filterBarEl.innerHTML = opts
        .map((o) => {
          const active = schedDiscFilter === o.id;
          return `
            <button onclick="updateSummaryFilter('scheduleDiscipline', '${o.id}')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }">
              ${esc(o.label)}
            </button>
          `;
        })
        .join("");
    }

    const allTuples = getAllScheduleTuples(unit);
    const activeDatesSet = new Set();
    allTuples.forEach((t) => activeDatesSet.add(t.date));
    const activeDates = Array.from(activeDatesSet).sort();

    const summaryEl = document.getElementById("schedule-by-discipline-summary");
    if (summaryEl) {
      const schedDisciplines = ["Mechanical", "Electrical & Instruments"];
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
          const theme = DISCIPLINE_COLORS[dName] || DISCIPLINE_COLORS["Unassigned"];

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
            const theme = DISCIPLINE_COLORS[dName] || DISCIPLINE_COLORS["Unassigned"];
            const shortD = dName === "Electrical & Instruments" ? "E&I" : dName;
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
                const theme = DISCIPLINE_COLORS[it.discipline] || DISCIPLINE_COLORS["Unassigned"];
                const targetUnit = unit !== "ALL" ? unit : it.units.length === 1 ? it.units[0] : "ALL";
                const unitTag = it.units.length === 2 ? "GTG#1&2" : it.units[0];
                const shortD = it.discipline === "Electrical & Instruments" ? "E&I" : "Mech";
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
            <td colspan="13" class="py-2.5 px-3">
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
                <td class="py-2.5 px-2">
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold border ${theme.badge}">${esc(discLabel)}</span>
                </td>
                <td class="py-2.5 px-2 text-center whitespace-nowrap">${statusBadge}</td>
                <td class="py-2.5 px-2 text-center whitespace-nowrap">
                  ${bhBadge}
                  ${a.bh_role ? `<div class="text-[10px] text-slate-400 mt-0.5">Role: ${esc(a.bh_role)} | Check: ${esc(a.check_type)}</div>` : ""}
                </td>
                <td class="py-2.5 px-2 text-center whitespace-nowrap">
                  ${cuBadge}
                  ${a.cu_role ? `<div class="text-[10px] text-slate-400 mt-0.5">Role: ${esc(a.cu_role)}</div>` : ""}
                </td>
                <td class="py-2.5 px-2 text-center text-xs font-medium text-slate-700 whitespace-nowrap">${esc(a.sig_date || "-")}</td>
                <td class="py-2.5 px-2 text-xs">
                  ${a.pic_pmc ? `<div><span class="text-slate-400">PMC:</span> <strong>${esc(a.pic_pmc)}</strong></div>` : ""}
                  ${a.pic_pq ? `<div><span class="text-slate-400">PQ/BV:</span> <strong>${esc(a.pic_pq)}</strong></div>` : ""}
                  ${!a.pic_pmc && !a.pic_pq ? `<span class="text-slate-300">-</span>` : ""}
                </td>
                <td class="py-2.5 px-3 text-xs text-slate-600">
                  ${a.ref_doc ? `<div class="truncate max-w-[220px]" title="${esc(a.ref_doc)}"><strong>Ref:</strong> ${esc(a.ref_doc.replace(/\n/g, ", "))}</div>` : ""}
                  ${a.procedure ? `<div><strong>Proc:</strong> ${esc(a.procedure)}</div>` : ""}
                  ${a.acceptance ? `<div class="text-[11px] text-slate-500"><strong>Crit:</strong> ${esc(a.acceptance)}</div>` : ""}
                </td>
                <td class="py-2.5 px-3 text-xs text-slate-700 whitespace-pre-line">${esc(a.site_markup || "-")}</td>
                <td class="py-2.5 px-2 text-center font-mono text-xs text-slate-500">${esc(a.pdf_sheet || "-")}</td>
              </tr>
            `;
          })
          .join("");

        return sectionHeaderRow + itemRows;
      })
      .join("");

    const thHeaders = [
      "#", "Unit", "Activity", "Activity Description", "Discipline",
      "Status", "BH Signature", "CU Signature", "Signature Date",
      "PIC (PMC / PQ&BV)", "Ref. Doc / Procedure / Criteria",
      "Site Markup (Checked PDF)", "PDF"
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
  };

  window.closeSourceModal = function () {
    const modal = document.getElementById("source-modal");
    if (modal) modal.classList.add("hidden");
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
