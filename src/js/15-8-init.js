/* ===================== INIT: restore, render, restore the tab; the test hook ===================== */
/* ---- init: restore saved state, apply tuning, render, restore tab ---- */
const hadState = loadState();
if(!hadState){
  // First visit: Ukrainian if the browser asks for it, English otherwise; the EN/UK
  // toggle takes over from the next visit on.
  try{ const nav=(navigator.languages&&navigator.languages[0])||navigator.language||''; lang = /^uk\b/i.test(nav) ? 'uk' : 'en'; }catch(_){ /* keep the 'uk' default */ }
}
ntRoot=gRootLbl;   // Notes follows the shared root from the first paint
applyTuning();
applyLang();
selectTab(currentTab);
setMode(currentMode);   // apply the restored mode axis after the reference shell is up
markScrollables();
// re-measure swipe-group overflow on resize and once the webfont has loaded (button
// widths change on the font swap)
window.addEventListener('resize', markScrollables);
try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(markScrollables); }catch(_){}
applyAudioAvailability();
applyA11y();   // apply restored accessibility prefs (palette / shapes) on load
/* the drill header's one key picker: every drill sets the same root, and the running
   drill only says what to re-derive (onKey) */
{ const dk=document.getElementById('drill-ctx-key');
  if(dk) buildRootBtns(dk, gRoot, (pc,r)=>{ setKey(pc,r); drillKeyChanged(); });
  const dq=document.getElementById('drill-ctx-quit');
  if(dq) dq.onclick=quitDrill; }
/* Every drill starts inside #practice-home — a card or the progress card's Review —
   through one listener: each carries data-track, and startTrack() opens it. */
{ const ph=document.getElementById('practice-home');
  if(ph) ph.addEventListener('click', e=>{
    const card=e.target.closest('[data-track]');
    if(card) startTrack(card.dataset.track);
    applyDrillCtx();
  }); }
/* the drill header's own controls. The mic goes to the running drill: each scored
   drill has its own tier semantics. */
{ const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('drill-ctx-setup', drillSetupToggle);
  wire('drill-ctx-help',  drillHintToggle);
  wire('drill-ctx-mic',   drillMicToggle);
  // end the block early, keep the session
  wire('drill-ctx-skip',  ()=>sessionAdvance()); }
/* the session's length chips and the report's Done are painted by the session
   module, so both are delegated */
{ const m=document.getElementById('sess-mins');
  if(m) m.addEventListener('click', e=>{
    const b=e.target.closest('[data-mins]'); if(!b) return;
    sessMins=+b.dataset.mins; renderSessionCard(); saveState();
  });
  const s=document.getElementById('sess-start'); if(s) s.onclick=()=>sessionStart(sessMins);
  const r=document.getElementById('session-report');
  if(r) r.addEventListener('click', e=>{ if(e.target.closest('#sess-close')) sessionDismiss(); }); }
clearOldShareHash();
document.getElementById('app-ver').textContent = 'v' + APP_VERSION;
// only a genuinely first visit leaves welcomeSeen false (see loadState)
if(!welcomeSeen) showWelcome();

/* ---- test introspection hook ----
   Built ONLY when a harness sets window.__GS_ALLOW_TEST__ before load, so production
   carries none of it. Never set this flag in the shipped app. */
if (typeof window!=='undefined' && window.__GS_ALLOW_TEST__) {
  window.__GS_TEST__ = {
    APP_VERSION, I18N, QUALITIES, TRIADS, SCALES, COF, FRET_RANGES, SEQ_PRESETS,
    fifthInterval, spellNote, rootParts, simpleName,
    diatonicTriads, isMajorFamily, ctxCofSel, ctxCofMinor, setKey, noteTxt,
    scalesOverChord, triadQi, currentHarmonyChord,
    chordVoicings, voicingMidi, currentChordVoicing, currentTriadVoicing, STD_LOW6_MIDI, TRI_TO_QUAL,
    cellW, boardWidth, leftFixed, FRET_LO, FRET_HI,
    schedAdvance, clocks, beat,
    // custom tuning
    TUNINGS, applyTuning, tuningMidi, TUNE_LO, TUNE_HI,
    getOpenMidi:()=>OPEN_MIDI.slice(), getCustomTuning:()=>customTuning.slice(),
    setCustomTuning:(arr)=>{ customTuning=arr.slice(); }, setTuningIdx:(i)=>{ tuningIdx=i; applyTuning(); },
    // learner review + activity
    learnerReview, learnerActivity, startReview,
    clearOldShareHash,
    // drill registry
    DRILLS, activeDrill, showDrillHome, exitAllDrills, refreshDrillsLang, drillKeyChanged, applyDrillCtx,
    // one drill shell
    drillSetupToggle, drillHintToggle, drillMicToggle, drillRunStarted, setCurTrack, quitDrill,
    getCurTrack:()=>curTrack, getDrillSeen:()=>drillSeen, setDrillSeen:(o)=>{ drillSeen=o||{}; },
    // the practice model
    drillTracks, trackById, trackBySess, trackByItems, sessNs, startTrack, learnerTrend, learnerBest, scoredErr,
    /* the timed session + the seams; every step takes `now`, so no timers are needed */
    SESSION_MINS, sessionPlan, sessionQueue, sessionStart, sessionAdvance, sessionTick,
    sessionEnd, sessionActive, sessionDismiss, sessionClock, renderSessionCard,
    getSession:()=>psess, getSessReport:()=>sessLast,
    getSessMins:()=>sessMins, setSessMins:(m)=>{ sessMins=m; },
    SEAM_TRACKS, jamToggle, jamActive, renderJamBtn,
    // progress narrative + card badges
    trackBadge, paintDrillBadges, renderProgressInto, renderPractice, trendScore,
    selectTab, setMode, setHView, setScView, isBoardMode, loopToggle, seqPlay, seqAddCurrent, applyPreset, setChord,
    // shell
    setTempo, getTempo:()=>tempo, stopReferenceTransport, transportActive, applyContextBar, updateGlobalPlay,
    renderAllBoards,
    // learner model
    recordAttempt, dueItems, recordSession, learnerStats, srsInterval, normalizeLearner,
    getLearner:()=>learner, resetLearner:()=>{ learner=newLearner(); }, LEARNER_V,
    setLearner:(l)=>{ learner=l; }, SESS_PER_ID, SESS_MAX, PERF_STALE_DAYS,
    // progress backup
    saveState, loadState, snapshotState, migrateSave, progressPayload, progressParse, progressApply, progressFileName, saveFailed,
    BACKUP_FORMAT, getSaveBlocked:()=>saveBlocked, setSaveBlocked:(v)=>{ saveBlocked=!!v; },
    resetSaveFailShown:()=>{ saveFailShown=false; },
    // note-naming drill
    startDrill, drillAnswer, drillTargetsFor, exitDrill, DRILL_LEN, getDrill:()=>drill,
    // ear-training drills
    startEar, earAnswer, earNext, earReplay, exitEar, getEar:()=>ear,
    earChoices:()=>(ear?ear.cfg.choices():[]), INTERVALS, EAR_QUAL_IDX,
    // chord-change fluency drill
    startChanges, cmBegin, cmTap, cmUntap, finishChanges, exitChanges, getCm:()=>cmDrill,
    CM_PAIRS, CM_DURS, cmPairId, cmPairBest,
    setCmPair:(i)=>{ cmPairIdx=i; if(cmDrill) cmDrill.pairIdx=i; }, setCmDur:(i)=>{ cmDurIdx=i; if(cmDrill) cmDrill.dur=CM_DURS[i]; },
    // strumming & feel lab
    startStrum, spPlay, spStop, spToggle, exitStrum, getSp:()=>spDrill,
    STRUM_PATTERNS, setSpPattern:(i)=>{ spIdx=i; if(spDrill) spDrill.patIdx=i; },
    SP_SWINGS, setSpSwing:(i)=>{ spSwing=i; }, setSpAccent:(v)=>{ spAccent=!!v; },
    setSpMute:(v)=>{ spMute=!!v; }, setSpBand:(v)=>{ spBand=!!v; },
    // comp-the-progression drill
    startComp, targetPlay, targetStop, targetToggle, exitTarget, getTg:()=>tgDrill,
    tgBuildBars, setTargetProg:(i)=>{ tgIdx=i; if(tgDrill){ tgDrill.presetIdx=i; tgDrill.bars=tgBuildBars(SEQ_PRESETS[i]); } },
    // subdivision & timing drill
    startTiming, sdToggle, exitTiming, getSd:()=>sd, SUBDIVS, SD_BEATS, sdPath,
    setSdSub:(i)=>{ sdSub=i; }, setSdPos:(i)=>{ sdPos=i; }, setSdNotes:(v)=>{ sdNotes=!!v; },
    sdTickNow:(t,c)=>sdTick(t,c),
    CAGED_BY_POS, isCAGEDScale,
    setFret:(i)=>{ fretRangeIdx=i; },
    setCapo:(i)=>{ capo=i; }, getCapo:()=>capo,
    // time signature / meter
    METERS, setMeter, curMeter, barBeats, pulseSec, barSec, midPulseSec,
    meterGroupStarts:()=>[...meterGroupStarts()], getMeterIdx:()=>meterIdx,
    // mic tuner: the pitch maths is pure; capture needs a browser (tools/mic-check.js)
    micSupported, micMidiFromHz, micCentsOff, micNearestString,
    micOpen, micClose, micStatus, micPaint, micPaintIdle, getMic:()=>mt, buildTuner, tunerEarShow, tunerEarOpen,
    MT_FFT, MT_CLARITY, MT_IN_TUNE, MT_HZ_LO, MT_HZ_HI,
    // shared mic layer + onset detection; capture needs a browser (tools/onset-check.js)
    micAcquire, micRelease, micReleaseAll, micLive, micErrKey,
    onsetSupported, onsetMatch, onsetScore, onsetVerdict, onsetFeel, onsetSelfHeard,
    onOnset, onsetActive, onsetRecent, onsetClear, onsetProcessorSrc,
    ON_REFRACTORY, ON_RATIO, ON_FLOOR, ON_HUMAN_MS, ON_SELF_HITRATE, ON_SELF_MIN_N,
    // latency calibration
    calOffsetSec, calSetMs, calCancel, calMedian, getCalMs:()=>calMs, CAL_MAX_MS, CAL_MIN_HITS,
    calMeasured, setCalKnown:(v)=>{ calKnown=!!v; },
    // the shared scored-run layer and its consumers; _set() injects a run, so scoring
    // is driven end to end with no microphone
    scoredRun, SC_TOL_MAX,
    sdScore, spScore, tgScore,
    // accessibility + onboarding
    applyA11y, showWelcome, dismissWelcome,
    setCbPalette:(v)=>{ cbPalette=!!v; }, setFnShapes:(v)=>{ fnShapes=!!v; }, setWelcomeSeen:(v)=>{ welcomeSeen=!!v; },
    getA11y:()=>({ cbPalette, fnShapes, welcomeSeen }),
    setChQual:(i)=>{ chQual=i; chVoicing=0; }, setChVoicing:(i)=>{ chVoicing=i; },
    setTriad:(set,inv)=>{ trSet=set; trInv=inv; }, setChTriads:(v)=>{ chTriads=!!v; },
    chTriadIdx, triadsOn,
    initAudio:()=>audio(),
    setCtxNow:(t)=>{ if(actx) actx.currentTime=t; },
    setGMode, revealFrets,
    state:()=>({ gRoot, gRootLbl, scIdx, scView, chQual, chVoicing, chTriads, currentTab, currentMode, hView, gMode, ntRoot,
                 loop:!!loopClock, loopMode, seq:!!seqClock, fretRangeIdx, lang, tempo,
                 cbPalette, fnShapes, welcomeSeen })
  };
}
