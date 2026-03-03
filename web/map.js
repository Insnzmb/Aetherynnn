(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const DEFAULTS = {
    width: 1000,
    height: 640,
    fog: { enabled: true },
    travel: { baseSpeed: 1.0, roadBonus: { local: 1.15, trade: 1.30, imperial: 1.50 }, cityBonus: 1.10 }
  };

  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const KEY_CANON = "aeth_map_canon_v1";
  const KEY_STATE = "aeth_map_state_v1";

  function buildDefaultCanon() {
    const kingdoms = [
      { id: "frostveil", name: "Frostveil Dominion" },
      { id: "eryndor", name: "Eryndor Confederacy" },
      { id: "verdantis", name: "Verdantis Crownlands" },
      { id: "ebonreach", name: "Ebonreach Covenant" },
      { id: "ashmarsh", name: "Ashmarsh Principalities" },
      { id: "emberlands", name: "Emberlands Imperium" }
    ];

    const provinces = [
      { id:"fv_icewatch", name:"Icewatch Reach", kingdom_id:"frostveil", center:[0.50,0.14] },
      { id:"fv_skarhald", name:"Skarhald Vale", kingdom_id:"frostveil", center:[0.38,0.18] },
      { id:"fv_whitebarrow", name:"Whitebarrow Expanse", kingdom_id:"frostveil", center:[0.62,0.18] },
      { id:"fv_northwind", name:"Northwind March", kingdom_id:"frostveil", center:[0.28,0.14] },
      { id:"fv_frostmere", name:"Frostmere Basin", kingdom_id:"frostveil", center:[0.72,0.14] },
      { id:"fv_glacierspine", name:"Glacierspine Hold", kingdom_id:"frostveil", center:[0.50,0.22] },
      { id:"fv_varyn", name:"Varyn Tundra", kingdom_id:"frostveil", center:[0.18,0.18] },
      { id:"fv_ashwindcrown", name:"Ashwind Crown", kingdom_id:"frostveil", center:[0.56,0.26] },

      { id:"er_valemarch", name:"Valemarch", kingdom_id:"eryndor", center:[0.45,0.48] },
      { id:"er_tharwick", name:"Tharwick Fields", kingdom_id:"eryndor", center:[0.58,0.48] },
      { id:"er_goldmere", name:"Goldmere", kingdom_id:"eryndor", center:[0.52,0.56] },
      { id:"er_highfield", name:"Highfield Crown", kingdom_id:"eryndor", center:[0.42,0.56] },
      { id:"er_redbrook", name:"Redbrook Plains", kingdom_id:"eryndor", center:[0.62,0.56] },
      { id:"er_sunfall", name:"Sunfall Vale", kingdom_id:"eryndor", center:[0.50,0.62] },
      { id:"er_oldenmoor", name:"Oldenmoor", kingdom_id:"eryndor", center:[0.40,0.64] },
      { id:"er_greenrise", name:"Greenrise Basin", kingdom_id:"eryndor", center:[0.58,0.64] },
      { id:"er_riverend", name:"Riverend March", kingdom_id:"eryndor", center:[0.50,0.70] },

      { id:"vd_heartwood", name:"Heartwood Spire", kingdom_id:"verdantis", center:[0.84,0.46] },
      { id:"vd_greencoast", name:"Greencoast", kingdom_id:"verdantis", center:[0.88,0.58] },
      { id:"vd_silvergrove", name:"Silvergrove", kingdom_id:"verdantis", center:[0.74,0.48] },
      { id:"vd_glimmerfen", name:"Glimmerfen", kingdom_id:"verdantis", center:[0.78,0.58] },
      { id:"vd_eastfall", name:"Eastfall Reach", kingdom_id:"verdantis", center:[0.86,0.40] },
      { id:"vd_verdantbay", name:"Bay of Verdant", kingdom_id:"verdantis", center:[0.92,0.50] },
      { id:"vd_thornreach", name:"Thornreach", kingdom_id:"verdantis", center:[0.74,0.38] },
      { id:"vd_lowwood", name:"Lowwood Basin", kingdom_id:"verdantis", center:[0.80,0.44] },

      { id:"eb_hollowgrave", name:"Hollowgrave", kingdom_id:"ebonreach", center:[0.18,0.50] },
      { id:"eb_soulmarsh", name:"Soulmarsh", kingdom_id:"ebonreach", center:[0.22,0.58] },
      { id:"eb_blackwater", name:"Blackwater Delta", kingdom_id:"ebonreach", center:[0.26,0.70] },
      { id:"eb_duskfen", name:"Duskfen Coast", kingdom_id:"ebonreach", center:[0.12,0.62] },
      { id:"eb_mirehold", name:"Mirehold", kingdom_id:"ebonreach", center:[0.26,0.46] },
      { id:"eb_wraithwater", name:"Wraithwater Reach", kingdom_id:"ebonreach", center:[0.20,0.72] },
      { id:"eb_murkfield", name:"Murkfield", kingdom_id:"ebonreach", center:[0.30,0.56] },

      { id:"am_cindralith", name:"Cindralith", kingdom_id:"ashmarsh", center:[0.38,0.82] },
      { id:"am_cinderplains", name:"Cinder Plains", kingdom_id:"ashmarsh", center:[0.30,0.86] },
      { id:"am_obsidian", name:"Obsidian Barrens", kingdom_id:"ashmarsh", center:[0.42,0.90] },
      { id:"am_ashgate", name:"Ashgate", kingdom_id:"ashmarsh", center:[0.34,0.76] },
      { id:"am_riftshadow", name:"Riftshadow Vale", kingdom_id:"ashmarsh", center:[0.46,0.78] },
      { id:"am_emberfen", name:"Emberfen", kingdom_id:"ashmarsh", center:[0.26,0.78] },
      { id:"am_dustmere", name:"Dustmere", kingdom_id:"ashmarsh", center:[0.22,0.86] },
      { id:"am_echoes", name:"Ridge of Echoes", kingdom_id:"ashmarsh", center:[0.48,0.88] },

      { id:"em_emberdeep", name:"Emberdeep", kingdom_id:"emberlands", center:[0.62,0.82] },
      { id:"em_furnace", name:"Furnace Peaks", kingdom_id:"emberlands", center:[0.70,0.78] },
      { id:"em_dragoncrater", name:"Dragoncrater", kingdom_id:"emberlands", center:[0.74,0.84] },
      { id:"em_ashflow", name:"Ashflow Basin", kingdom_id:"emberlands", center:[0.66,0.88] },
      { id:"em_redwaste", name:"Redwaste", kingdom_id:"emberlands", center:[0.78,0.90] },
      { id:"em_sulfurgulf", name:"Sulfur Gulf", kingdom_id:"emberlands", center:[0.86,0.86] },
      { id:"em_ironblood", name:"Ironblood Rise", kingdom_id:"emberlands", center:[0.58,0.88] },
      { id:"em_scorchwind", name:"Scorchwind Plateau", kingdom_id:"emberlands", center:[0.62,0.74] }
    ].map(p => ({...p, control: p.kingdom_id, neighbors: []}));

    const settlements = [
      { id:"s_ashgate", name:"Ashgate", type:"town", province_id:"am_ashgate", at:[0.33,0.75] },
      { id:"s_emberfen", name:"Emberfen", type:"town", province_id:"am_emberfen", at:[0.28,0.77] },
      { id:"s_riftshadow", name:"Riftshadow", type:"town", province_id:"am_riftshadow", at:[0.47,0.79] },
      { id:"s_cindralith", name:"Cindralith", type:"town", province_id:"am_cindralith", at:[0.40,0.80] },
      { id:"s_dustmere", name:"Dustmere", type:"town", province_id:"am_dustmere", at:[0.22,0.87] },
      { id:"s_cinderplains", name:"Cinder Plains", type:"town", province_id:"am_cinderplains", at:[0.28,0.85] },
      { id:"s_echoes", name:"Ridge of Echoes", type:"town", province_id:"am_echoes", at:[0.47,0.89] },
      { id:"s_obsidian", name:"Obsidian Hold", type:"town", province_id:"am_obsidian", at:[0.43,0.91] },
      { id:"s_mirehold", name:"Mirehold", type:"town", province_id:"eb_mirehold", at:[0.26,0.45] },
      { id:"s_hollowgrave", name:"Hollowgrave", type:"city", province_id:"eb_hollowgrave", at:[0.18,0.54] },
      { id:"s_murkfield", name:"Murkfield", type:"town", province_id:"eb_murkfield", at:[0.31,0.57] },
      { id:"s_soulmarsh", name:"Soulmarsh", type:"town", province_id:"eb_soulmarsh", at:[0.21,0.58] },
      { id:"s_duskfen", name:"Duskfen", type:"town", province_id:"eb_duskfen", at:[0.11,0.63] },
      { id:"s_blackwater", name:"Blackwater", type:"town", province_id:"eb_blackwater", at:[0.27,0.71] },
      { id:"s_wraithwater", name:"Wraithwater", type:"town", province_id:"eb_wraithwater", at:[0.19,0.72] },
      { id:"s_scorchwind", name:"Scorchwind", type:"town", province_id:"em_scorchwind", at:[0.61,0.73] },
      { id:"s_furnace", name:"Furnacehold", type:"town", province_id:"em_furnace", at:[0.71,0.76] },
      { id:"s_emberdeep", name:"Emberdeep", type:"town", province_id:"em_emberdeep", at:[0.62,0.80] },
      { id:"s_dragoncrater", name:"Dragoncrater", type:"town", province_id:"em_dragoncrater", at:[0.75,0.84] },
      { id:"s_sulfurgulf", name:"Sulfur Harbor", type:"town", province_id:"em_sulfurgulf", at:[0.86,0.87] },
      { id:"s_ironblood", name:"Ironblood", type:"town", province_id:"em_ironblood", at:[0.57,0.88] },
      { id:"s_ashflow", name:"Ashflow", type:"town", province_id:"em_ashflow", at:[0.66,0.88] },
      { id:"s_redwaste", name:"Redwaste", type:"town", province_id:"em_redwaste", at:[0.79,0.90] },
      { id:"s_valemarch", name:"Valemarch", type:"city", province_id:"er_valemarch", at:[0.43,0.52] },
      { id:"s_tharwick", name:"Tharwick", type:"city", province_id:"er_tharwick", at:[0.62,0.52] },
      { id:"s_highfield", name:"Highfield", type:"town", province_id:"er_highfield", at:[0.42,0.56] },
      { id:"s_goldmere", name:"Goldmere", type:"town", province_id:"er_goldmere", at:[0.51,0.56] },
      { id:"s_redbrook", name:"Redbrook", type:"town", province_id:"er_redbrook", at:[0.61,0.56] },
      { id:"s_sunfall", name:"Sunfall Keep", type:"town", province_id:"er_sunfall", at:[0.50,0.64] },
      { id:"s_oldenmoor", name:"Oldenmoor Hamlet", type:"town", province_id:"er_oldenmoor", at:[0.39,0.63] },
      { id:"s_greenrise", name:"Greenrise", type:"town", province_id:"er_greenrise", at:[0.57,0.64] },
      { id:"s_riverend", name:"Riverend", type:"town", province_id:"er_riverend", at:[0.48,0.70] },
      { id:"s_northwind", name:"Northwind Watch", type:"outpost", province_id:"fv_northwind", at:[0.28,0.14] },
      { id:"s_icewatch", name:"Icewatch Hold", type:"fortress", province_id:"fv_icewatch", at:[0.50,0.19] },
      { id:"s_frostmere", name:"Frostmere", type:"outpost", province_id:"fv_frostmere", at:[0.71,0.14] },
      { id:"s_varyn", name:"Varyn", type:"outpost", province_id:"fv_varyn", at:[0.17,0.19] },
      { id:"s_skarhald", name:"Skarhald", type:"outpost", province_id:"fv_skarhald", at:[0.38,0.17] },
      { id:"s_whitebarrow", name:"Whitebarrow", type:"outpost", province_id:"fv_whitebarrow", at:[0.63,0.19] },
      { id:"s_glacierspine", name:"Glacierspine Holdfast", type:"outpost", province_id:"fv_glacierspine", at:[0.52,0.23] },
      { id:"s_ashwind", name:"Ashwind Pass", type:"pass", province_id:"fv_ashwindcrown", at:[0.56,0.32] },
      { id:"s_thornreach", name:"Thornreach", type:"town", province_id:"vd_thornreach", at:[0.73,0.40] },
      { id:"s_eastfall", name:"Eastfall", type:"town", province_id:"vd_eastfall", at:[0.88,0.40] },
      { id:"s_lowwood", name:"Lowwood", type:"town", province_id:"vd_lowwood", at:[0.79,0.43] },
      { id:"s_heartwood", name:"Heartwood Spire", type:"landmark", province_id:"vd_heartwood", at:[0.84,0.48] },
      { id:"s_silvergrove", name:"Silvergrove", type:"town", province_id:"vd_silvergrove", at:[0.75,0.49] },
      { id:"s_verdantbay", name:"Verdantbay Port", type:"port", province_id:"vd_verdantbay", at:[0.92,0.51] },
      { id:"s_glimmerfen", name:"Glimmerfen", type:"town", province_id:"vd_glimmerfen", at:[0.76,0.58] },
      { id:"s_greencoast", name:"Greencoast Port", type:"port", province_id:"vd_greencoast", at:[0.87,0.56] },
    ];

    const roads = [
      { id:"r_varyn_northwind", from:"s_varyn", to:"s_northwind", type:"local", condition:"rough" },
      { id:"r_northwind_skarhald", from:"s_northwind", to:"s_skarhald", type:"trade", condition:"stable" },
      { id:"r_skarhald_icewatch", from:"s_skarhald", to:"s_icewatch", type:"trade", condition:"maintained" },
      { id:"r_icewatch_glacierspine", from:"s_icewatch", to:"s_glacierspine", type:"local", condition:"maintained" },
      { id:"r_glacierspine_ashwind", from:"s_glacierspine", to:"s_ashwind", type:"trade", condition:"stable" },
      { id:"r_ashwind_whitebarrow", from:"s_ashwind", to:"s_whitebarrow", type:"local", condition:"rough" },
      { id:"r_whitebarrow_frostmere", from:"s_whitebarrow", to:"s_frostmere", type:"local", condition:"stable" },
      { id:"r_skarhald_whitebarrow", from:"s_skarhald", to:"s_whitebarrow", type:"local", condition:"maintained" },
      { id:"r_highfield_valemarch", from:"s_highfield", to:"s_valemarch", type:"trade", condition:"stable" },
      { id:"r_valemarch_goldmere", from:"s_valemarch", to:"s_goldmere", type:"trade", condition:"stable" },
      { id:"r_goldmere_tharwick", from:"s_goldmere", to:"s_tharwick", type:"imperial", condition:"maintained" },
      { id:"r_tharwick_redbrook", from:"s_tharwick", to:"s_redbrook", type:"trade", condition:"stable" },
      { id:"r_redbrook_greenrise", from:"s_redbrook", to:"s_greenrise", type:"local", condition:"stable" },
      { id:"r_greenrise_riverend", from:"s_greenrise", to:"s_riverend", type:"trade", condition:"stable" },
      { id:"r_goldmere_sunfall", from:"s_goldmere", to:"s_sunfall", type:"trade", condition:"stable" },
      { id:"r_sunfall_riverend", from:"s_sunfall", to:"s_riverend", type:"trade", condition:"rough" },
      { id:"r_oldenmoor_sunfall", from:"s_oldenmoor", to:"s_sunfall", type:"local", condition:"rough" },
      { id:"r_oldenmoor_highfield", from:"s_oldenmoor", to:"s_highfield", type:"local", condition:"stable" },
      { id:"r_thornreach_silvergrove", from:"s_thornreach", to:"s_silvergrove", type:"trade", condition:"stable" },
      { id:"r_silvergrove_lowwood", from:"s_silvergrove", to:"s_lowwood", type:"local", condition:"stable" },
      { id:"r_lowwood_heartwood", from:"s_lowwood", to:"s_heartwood", type:"trade", condition:"maintained" },
      { id:"r_heartwood_eastfall", from:"s_heartwood", to:"s_eastfall", type:"local", condition:"stable" },
      { id:"r_eastfall_verdantbay", from:"s_eastfall", to:"s_verdantbay", type:"trade", condition:"stable" },
      { id:"r_verdantbay_greencoast", from:"s_verdantbay", to:"s_greencoast", type:"trade", condition:"stable" },
      { id:"r_greencoast_glimmerfen", from:"s_greencoast", to:"s_glimmerfen", type:"local", condition:"stable" },
      { id:"r_glimmerfen_lowwood", from:"s_glimmerfen", to:"s_lowwood", type:"local", condition:"stable" },
      { id:"r_duskfen_hollowgrave", from:"s_duskfen", to:"s_hollowgrave", type:"trade", condition:"rough" },
      { id:"r_hollowgrave_mirehold", from:"s_hollowgrave", to:"s_mirehold", type:"trade", condition:"stable" },
      { id:"r_mirehold_soulmarsh", from:"s_mirehold", to:"s_soulmarsh", type:"local", condition:"rough" },
      { id:"r_soulmarsh_murkfield", from:"s_soulmarsh", to:"s_murkfield", type:"local", condition:"rough" },
      { id:"r_murkfield_blackwater", from:"s_murkfield", to:"s_blackwater", type:"trade", condition:"stable" },
      { id:"r_blackwater_wraithwater", from:"s_blackwater", to:"s_wraithwater", type:"local", condition:"rough" },
      { id:"r_wraithwater_duskfen", from:"s_wraithwater", to:"s_duskfen", type:"local", condition:"rough" },
      { id:"r_emberfen_ashgate", from:"s_emberfen", to:"s_ashgate", type:"trade", condition:"contested" },
      { id:"r_ashgate_cindralith", from:"s_ashgate", to:"s_cindralith", type:"trade", condition:"stable" },
      { id:"r_cindralith_riftshadow", from:"s_cindralith", to:"s_riftshadow", type:"trade", condition:"contested" },
      { id:"r_riftshadow_cinderplains", from:"s_riftshadow", to:"s_cinderplains", type:"trade", condition:"contested", gate:"southern_rift_crossing" },
      { id:"r_cinderplains_obsidian", from:"s_cinderplains", to:"s_obsidian", type:"local", condition:"rough" },
      { id:"r_obsidian_echoes", from:"s_obsidian", to:"s_echoes", type:"local", condition:"rough" },
      { id:"r_echoes_dustmere", from:"s_echoes", to:"s_dustmere", type:"local", condition:"rough" },
      { id:"r_dustmere_emberfen", from:"s_dustmere", to:"s_emberfen", type:"local", condition:"rough" },
      { id:"r_scorchwind_emberdeep", from:"s_scorchwind", to:"s_emberdeep", type:"trade", condition:"stable" },
      { id:"r_emberdeep_furnace", from:"s_emberdeep", to:"s_furnace", type:"trade", condition:"stable" },
      { id:"r_furnace_dragoncrater", from:"s_furnace", to:"s_dragoncrater", type:"local", condition:"rough" },
      { id:"r_dragoncrater_redwaste", from:"s_dragoncrater", to:"s_redwaste", type:"trade", condition:"contested" },
      { id:"r_redwaste_sulfurgulf", from:"s_redwaste", to:"s_sulfurgulf", type:"trade", condition:"stable" },
      { id:"r_redwaste_ashflow", from:"s_redwaste", to:"s_ashflow", type:"local", condition:"rough" },
      { id:"r_ashflow_ironblood", from:"s_ashflow", to:"s_ironblood", type:"trade", condition:"stable" },
      { id:"r_ironblood_emberdeep", from:"s_ironblood", to:"s_emberdeep", type:"trade", condition:"stable" },
      { id:"r_ashwind_valemarch", from:"s_ashwind", to:"s_valemarch", type:"imperial", condition:"maintained" },
      { id:"r_valemarch_mirehold", from:"s_valemarch", to:"s_mirehold", type:"trade", condition:"rough" },
      { id:"r_tharwick_silvergrove", from:"s_tharwick", to:"s_silvergrove", type:"trade", condition:"stable" },
      { id:"r_valemarch_ashgate", from:"s_valemarch", to:"s_ashgate", type:"trade", condition:"stable" },
    ];

    const physical = {
      coast: [
        [0.08,0.62],[0.10,0.48],[0.16,0.32],[0.26,0.22],[0.40,0.16],[0.58,0.14],[0.74,0.18],[0.86,0.30],
        [0.94,0.44],[0.92,0.60],[0.88,0.70],[0.82,0.78],[0.70,0.90],[0.56,0.94],[0.38,0.92],[0.22,0.82],[0.10,0.74]
      ],
      mountains: [
        { id:"m_glacierwall", name:"Glacierwall Range", poly:[[0.18,0.20],[0.32,0.16],[0.50,0.14],[0.66,0.16],[0.82,0.22],[0.78,0.26],[0.62,0.24],[0.46,0.22],[0.30,0.24]] },
        { id:"m_ashenrift", name:"Ashen Rift Mountains", poly:[[0.50,0.74],[0.56,0.76],[0.62,0.80],[0.64,0.86],[0.60,0.92],[0.52,0.92],[0.46,0.88],[0.44,0.82],[0.46,0.76]] }
      ],
      rivers: [
        { id:"rv_silverflow", name:"Silverflow River", line:[[0.58,0.48],[0.66,0.47],[0.74,0.48],[0.82,0.50]] }
      ]
    };

    return { version:"AETH_MAP_CANON_V1", createdAt: new Date().toISOString(), kingdoms, provinces, settlements, roads, physical };
  }

  function loadCanon() {
    const raw = localStorage.getItem(KEY_CANON);
    if (!raw) {
      const canon = buildDefaultCanon();
      localStorage.setItem(KEY_CANON, JSON.stringify(canon));
      return canon;
    }
    try { return JSON.parse(raw); } catch {
      const canon = buildDefaultCanon();
      localStorage.setItem(KEY_CANON, JSON.stringify(canon));
      return canon;
    }
  }

  function defaultStateFromCanon(canon) {
    return {
      version:"AETH_MAP_STATE_V1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seed: 120992,
      control: canon.provinces.reduce((acc,p)=> (acc[p.id]=p.control, acc), {}),
      roads: canon.roads.reduce((acc,r)=> (acc[r.id]={ condition:r.condition, open:true }, acc), {}),
      settlements: canon.settlements.reduce((acc,s)=> (acc[s.id]={ status:"active" }, acc), {}),
      party: (function(){
        const starts = canon.settlements.filter(s=>['city','town','outpost','fortress','port','pass'].includes(s.type));
        const pick = starts[Math.floor(Math.random()*starts.length)] || canon.settlements[0];
        return { at: { x: pick.at[0], y: pick.at[1] }, lastNode: pick.id, discoveredNodes: [pick.id] };
      })(),
      log: []
    };
  }

  function loadState(canon) {
    const raw = localStorage.getItem(KEY_STATE);
    if (!raw) {
      const st = defaultStateFromCanon(canon);
      localStorage.setItem(KEY_STATE, JSON.stringify(st));
      return st;
    }
    try { return JSON.parse(raw); } catch {
      const st = defaultStateFromCanon(canon);
      localStorage.setItem(KEY_STATE, JSON.stringify(st));
      return st;
    }
  }

  function saveState(state) {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY_STATE, JSON.stringify(state));
  }

  function provincePolys(canon, state) {
    const rng = mulberry32(state.seed || 1);
    const polys = {};
    for (const p of canon.provinces) {
      const [cx, cy] = p.center;
      const r = 0.06 + rng()*0.03;
      const pts = [];
      const steps = 18;
      for (let i=0;i<steps;i++){
        const a = (i/steps)*Math.PI*2;
        const jitter = 0.75 + rng()*0.6;
        const x = clamp(cx + Math.cos(a)*r*jitter, 0.02, 0.98);
        const y = clamp(cy + Math.sin(a)*r*jitter, 0.02, 0.98);
        pts.push([x,y]);
      }
      polys[p.id] = pts;
    }
    return polys;
  }

  function pointsToPath(points, w, h) {
    if (!points || !points.length) return "";
    const [sx, sy] = [points[0][0]*w, points[0][1]*h];
    let d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} `;
    for (let i=1;i<points.length;i++){
      const [px, py] = [points[i][0]*w, points[i][1]*h];
      d += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
    }
    return d + "Z";
  }

  function lineToPath(line, w, h) {
    if (!line || !line.length) return "";
    const [sx, sy] = [line[0][0]*w, line[0][1]*h];
    let d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} `;
    for (let i=1;i<line.length;i++){
      const [px, py] = [line[i][0]*w, line[i][1]*h];
      d += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
    }
    return d;
  }

  function parseEvents(text) {
    const lines = (text || "").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const events = [];
    let inBlock = false;
    for (const ln of lines) {
      if (ln === "MAP_EVENT_BLOCK:" || ln === "MAP_EVENT_BLOCK") { inBlock = true; continue; }
      if (ln === "MAP:NO_CHANGE") { events.push({ type:"NO_CHANGE" }); continue; }
      if (!inBlock) continue;
      const m = ln.match(/^([A-Z_]+)\s*(.*)$/);
      if (!m) continue;
      const type = m[1];
      const rest = m[2] || "";
      const args = {};
      rest.split(/\s+/).filter(Boolean).forEach(tok => {
        const eq = tok.indexOf("=");
        if (eq>0) args[tok.slice(0,eq)] = tok.slice(eq+1);
      });
      events.push({ type, args, raw: ln });
    }
    return events;
  }

  function applyEvents(canon, state, events) {
    const stamp = new Date().toISOString();
    for (const ev of events) {
      if (ev.type === "NO_CHANGE") continue;
      const a = ev.args || {};
      switch (ev.type) {
        case "SET_CONTROL": {
          if (a.province && a.controller) state.control[a.province] = a.controller;
          break;
        }
        case "ADD_ROAD": {
          if (!a.id || !a.from || !a.to) break;
          canon.roads.push({ id:a.id, from:a.from, to:a.to, type:a.type||"local", condition:"stable" });
          state.roads[a.id] = { condition:"stable", open:true };
          localStorage.setItem(KEY_CANON, JSON.stringify(canon));
          break;
        }
        case "REMOVE_ROAD":
        case "CLOSE_PASS":
        case "DESTROY_BRIDGE": {
          if (!a.id && !a.road) break;
          const rid = a.id || a.road;
          state.roads[rid] = state.roads[rid] || {};
          state.roads[rid].open = false;
          state.roads[rid].condition = "blocked";
          break;
        }
        case "OPEN_PASS": {
          if (!a.road) break;
          state.roads[a.road] = state.roads[a.road] || {};
          state.roads[a.road].open = true;
          if (state.roads[a.road].condition === "blocked") state.roads[a.road].condition = "rough";
          break;
        }
        case "RAZE_SETTLEMENT": {
          if (!a.id) break;
          state.settlements[a.id] = state.settlements[a.id] || {};
          state.settlements[a.id].status = "ruined";
          break;
        }
        case "FOUND_SETTLEMENT": {
          if (!a.id || !a.name || !a.province || !a.x || !a.y) break;
          canon.settlements.push({ id:a.id, name:a.name.replace(/_/g," "), type:a.type||"hamlet", province_id:a.province, at:[parseFloat(a.x), parseFloat(a.y)] });
          state.settlements[a.id] = { status:"active" };
          localStorage.setItem(KEY_CANON, JSON.stringify(canon));
          break;
        }
        case "RENAME_SETTLEMENT": {
          if (!a.id || !a.name) break;
          const s = canon.settlements.find(s=>s.id===a.id);
          if (s) s.name = a.name.replace(/_/g," ");
          localStorage.setItem(KEY_CANON, JSON.stringify(canon));
          break;
        }
      }
      state.log.push({ at: stamp, event: ev.type, args: ev.args || {}, raw: ev.raw || "" });
    }
    saveState(state);
  }

  function isRoadOpen(state, roadId) {
    const r = state.roads[roadId];
    return !r ? true : (r.open !== false);
  }

  function nearestNode(canon, pt) {
    let best = null, bd = 1e9;
    for (const s of canon.settlements) {
      const dx = s.at[0]-pt.x, dy=s.at[1]-pt.y;
      const d = dx*dx+dy*dy;
      if (d < bd) { bd=d; best=s; }
    }
    return best;
  }

  function findRoadBetween(canon, aId, bId) {
    return canon.roads.find(r => (r.from===aId && r.to===bId) || (r.from===bId && r.to===aId));
  }

  function computeTravel(canon, state, from, to) {
    const dx = (to.x - from.x), dy = (to.y - from.y);
    const dist = Math.sqrt(dx*dx + dy*dy);
    const miles = dist * 3000;
    let milesPerDay = 25 * DEFAULTS.travel.baseSpeed;

    const nodeA = nearestNode(canon, from);
    const nodeB = nearestNode(canon, to);
    let roadType = null;
    if (nodeA && nodeB) {
      const road = findRoadBetween(canon, nodeA.id, nodeB.id);
      if (road && isRoadOpen(state, road.id)) roadType = road.type;
    }
    if (roadType) milesPerDay *= (DEFAULTS.travel.roadBonus[roadType] || 1.15);
    if (nodeA && state.party.discoveredNodes.includes(nodeA.id)) milesPerDay *= DEFAULTS.travel.cityBonus;
    if (nodeB && state.party.discoveredNodes.includes(nodeB.id)) milesPerDay *= DEFAULTS.travel.cityBonus;

    return { miles, days: miles / milesPerDay, milesPerDay, roadType };
  }

  function mount(el, opts = {}) {
    const canon = loadCanon();
    const state = loadState(canon);
    const polys = provincePolys(canon, state);
    const w = (opts.width || DEFAULTS.width), h = (opts.height || DEFAULTS.height);

    el.innerHTML = `
      <div class="aeth-map-shell">
        <div class="aeth-map-toolbar">
          <div class="aeth-map-left">
            <strong>Atlas</strong>
            <span class="aeth-map-chip">Hybrid travel</span>
            <span class="aeth-map-chip">6 kingdoms</span>
            <span class="aeth-map-chip">48 provinces</span>
          </div>
          <div class="aeth-map-right">
            <label class="aeth-toggle"><input type="checkbox" data-layer="political" checked> Political</label>
            <label class="aeth-toggle"><input type="checkbox" data-layer="roads" checked> Roads</label>
            <label class="aeth-toggle"><input type="checkbox" data-layer="settlements" checked> Settlements</label>
            <label class="aeth-toggle"><input type="checkbox" data-layer="labels" checked> Labels</label>
            <button class="aeth-btn" data-action="export">Export JSON</button>
            <button class="aeth-btn" data-action="reset">Reset</button>
          </div>
        </div>

        <div class="aeth-map-body">
          <div class="aeth-map-canvas">
            <svg class="aeth-map-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>
            <div class="aeth-map-hud">
              <div class="aeth-map-hudrow">
                <div class="aeth-hudbox">
                  <div class="aeth-hudtitle">Party</div>
                  <div class="aeth-hudtext" data-hud="party"></div>
                </div>
                <div class="aeth-hudbox">
                  <div class="aeth-hudtitle">Travel</div>
                  <div class="aeth-hudtext" data-hud="travel">Click map to move.</div>
                </div>
              </div>
              <div class="aeth-map-hudrow">
                <div class="aeth-hudbox aeth-hudwide">
                  <div class="aeth-hudtitle">Map Events</div>
                  <textarea class="aeth-events" placeholder="Paste MAP_EVENT_BLOCK here (or MAP:NO_CHANGE)"></textarea>
                  <div class="aeth-hudactions">
                    <button class="aeth-btn" data-action="apply">Apply Events</button>
                    <button class="aeth-btn" data-action="clearlog">Clear Log</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="aeth-map-side">
            <div class="aeth-card">
              <div class="aeth-cardtitle">Legend</div>
              <div class="aeth-legend">
                <div><span class="aeth-leg leg-imp"></span> Imperial Highroad</div>
                <div><span class="aeth-leg leg-trd"></span> Trade Road</div>
                <div><span class="aeth-leg leg-loc"></span> Local Track</div>
                <div><span class="aeth-leg leg-riv"></span> Major River</div>
              </div>
            </div>
            <div class="aeth-card">
              <div class="aeth-cardtitle">Recent Changes</div>
              <div class="aeth-log" data-log></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const svg = el.querySelector(".aeth-map-svg");
    const hudParty = el.querySelector('[data-hud="party"]');
    const hudTravel = el.querySelector('[data-hud="travel"]');
    const logEl = el.querySelector("[data-log]");
    const eventsBox = el.querySelector(".aeth-events");

    const colorByKingdom = {
      frostveil: "rgba(210,230,245,0.35)",
      eryndor: "rgba(180,220,170,0.35)",
      verdantis: "rgba(120,200,150,0.35)",
      ebonreach: "rgba(140,170,160,0.35)",
      ashmarsh: "rgba(220,200,150,0.35)",
      emberlands: "rgba(220,170,150,0.35)"
    };

    const mk = (tag, attrs={}) => {
      const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v);
      return n;
    };

    function render() {
      const showPolitical = el.querySelector('input[data-layer="political"]').checked;
      const showRoads = el.querySelector('input[data-layer="roads"]').checked;
      const showSettlements = el.querySelector('input[data-layer="settlements"]').checked;
      const showLabels = el.querySelector('input[data-layer="labels"]').checked;

      svg.innerHTML = "";
      svg.appendChild(mk("rect", { x:0, y:0, width:w, height:h, fill:"rgba(20,40,70,0.85)" }));

      const coastPath = pointsToPath(canon.physical.coast, w, h);
      svg.appendChild(mk("path", { d: coastPath, fill:"rgba(70,120,90,0.60)", stroke:"rgba(240,235,220,0.22)", "stroke-width":"2" }));

      for (const mtn of canon.physical.mountains) {
        const d = pointsToPath(mtn.poly, w, h);
        svg.appendChild(mk("path", { d, fill:"rgba(60,60,60,0.18)", stroke:"rgba(30,25,20,0.35)", "stroke-width":"2" }));
      }

      for (const rv of canon.physical.rivers) {
        const d = lineToPath(rv.line, w, h);
        svg.appendChild(mk("path", { d, fill:"none", stroke:"rgba(120,195,220,0.95)", "stroke-width":"3", "stroke-linecap":"round" }));
      }

      if (showPolitical) {
        for (const p of canon.provinces) {
          const d = pointsToPath(polys[p.id], w, h);
          const ctrl = state.control[p.id] || p.kingdom_id;
          svg.appendChild(mk("path", { d, fill: colorByKingdom[ctrl] || "rgba(255,255,255,0.08)", stroke:"rgba(250,245,235,0.35)", "stroke-width":"1.2" }));
        }
      }

      if (showRoads) {
        for (const r of canon.roads) {
          const a = canon.settlements.find(s=>s.id===r.from);
          const b = canon.settlements.find(s=>s.id===r.to);
          if (!a || !b) continue;
          const open = isRoadOpen(state, r.id);
          const x1=a.at[0]*w, y1=a.at[1]*h, x2=b.at[0]*w, y2=b.at[1]*h;
          let stroke="rgba(220,210,195,0.55)", width=2.2, dash="";
          if (r.type==="imperial"){ stroke="rgba(235,120,90,0.75)"; width=3.6; }
          if (r.type==="trade"){ stroke="rgba(245,190,110,0.75)"; width=3.0; }
          if (r.type==="local"){ stroke="rgba(210,210,210,0.45)"; width=2.0; }
          if (!open){ dash="6 6"; stroke="rgba(160,160,160,0.35)"; }
          svg.appendChild(mk("line", { x1,y1,x2,y2, stroke, "stroke-width":width, "stroke-linecap":"round", "stroke-dasharray":dash }));
        }
      }

      if (showSettlements) {
        for (const s of canon.settlements) {
          const st = state.settlements[s.id] || { status:"active" };
          const x=s.at[0]*w, y=s.at[1]*h;
          const ruined = st.status==="ruined";
          const discovered = state.party.discoveredNodes.includes(s.id);
          const r = (s.type==="city") ? 6 : (s.type==="town" ? 5 : 4);
          const fill = ruined ? "rgba(80,80,80,0.85)" : (discovered ? "rgba(250,245,235,0.92)" : "rgba(250,245,235,0.55)");
          svg.appendChild(mk("circle", { cx:x, cy:y, r, fill, stroke:"rgba(20,16,14,0.85)", "stroke-width":"1.5" }));
        }
      }

      if (showLabels) {
        for (const k of canon.kingdoms) {
          const ps = canon.provinces.filter(p=>p.kingdom_id===k.id);
          const cx = ps.reduce((a,p)=>a+p.center[0],0)/ps.length;
          const cy = ps.reduce((a,p)=>a+p.center[1],0)/ps.length;
          const t = mk("text", { x:cx*w, y:cy*h, fill:"rgba(255,248,235,0.85)", "font-size":"16", "text-anchor":"middle", "dominant-baseline":"middle", "font-family":"system-ui,Segoe UI,Arial" });
          t.textContent = k.name;
          svg.appendChild(t);
        }
        for (const s of canon.settlements) {
          if (!state.party.discoveredNodes.includes(s.id)) continue;
          const x=s.at[0]*w, y=s.at[1]*h;
          const t = mk("text", { x:x+10, y:y-10, fill:"rgba(255,248,235,0.90)", "font-size":"13", "font-family":"system-ui,Segoe UI,Arial" });
          t.textContent = s.name;
          svg.appendChild(t);
        }
      }

      const px = state.party.at.x*w, py = state.party.at.y*h;
      svg.appendChild(mk("circle", { cx:px, cy:py, r:6, fill:"rgba(235,60,60,0.95)", stroke:"rgba(0,0,0,0.8)", "stroke-width":"2" }));

      const nn = nearestNode(canon, state.party.at);
      hudParty.textContent = `x=${state.party.at.x.toFixed(3)} y=${state.party.at.y.toFixed(3)} • nearest: ${nn?nn.name:"—"}`;

      const last = state.log.slice(-8).reverse();
      logEl.innerHTML = last.length
        ? last.map(e=>`<div class="aeth-logrow"><span class="aeth-logtype">${e.event}</span> <span class="aeth-logargs">${Object.entries(e.args||{}).map(([k,v])=>`${k}=${v}`).join(" ")}</span></div>`).join("")
        : `<div class="aeth-muted">No changes yet.</div>`;
    }

    function exportJson() {
      const blob = new Blob([JSON.stringify({ canon, state }, null, 2)], { type:"application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "aeth_map_export.json";
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
    }

    function resetMap() {
      localStorage.removeItem(KEY_CANON);
      localStorage.removeItem(KEY_STATE);
      location.reload();
    }

    function clearLog() {
      state.log = [];
      saveState(state);
      render();
    }

    function applyFromTextbox() {
      const evs = parseEvents(eventsBox.value || "");
      applyEvents(canon, state, evs);
      eventsBox.value = "";
      render();
    }

    svg.addEventListener("click", (e) => {
      const rect = svg.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      const from = { x: state.party.at.x, y: state.party.at.y };
      const to = { x, y };
      const t = computeTravel(canon, state, from, to);
      hudTravel.textContent = `${t.miles.toFixed(0)} mi • ${t.days.toFixed(1)} days @ ${t.milesPerDay.toFixed(1)} mi/day` + (t.roadType ? ` • via ${t.roadType} road` : ` • off-road`);

      state.party.at = { x, y };
      const n2 = nearestNode(canon, to);
      if (n2 && Math.sqrt((n2.at[0]-x)**2 + (n2.at[1]-y)**2) < 0.03) {
        state.party.lastNode = n2.id;
        if (!state.party.discoveredNodes.includes(n2.id)) state.party.discoveredNodes.push(n2.id);
      }
      saveState(state);
      render();

      if (typeof opts.onTravel === "function") opts.onTravel({ from, to, estimate: t, arrivedNode: state.party.lastNode });
    });

    el.querySelectorAll('input[data-layer]').forEach(inp => inp.addEventListener("change", render));
    el.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const a = btn.getAttribute("data-action");
        if (a==="export") exportJson();
        if (a==="reset") resetMap();
        if (a==="apply") applyFromTextbox();
        if (a==="clearlog") clearLog();
      });
    });

    render();
    return { canon, state, applyEventsText: (t)=>{ const evs=parseEvents(t); applyEvents(canon,state,evs); render(); } };
  }

  window.AethMap = { mount };
})();