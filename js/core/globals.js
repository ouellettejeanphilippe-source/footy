// Global State Object
var S = {
    searchQuery: '',
    log: [],
    raw: '',
    matches: [],
    proxy: '',
    filter: 'live',
    sportFilter: 'all',
    hiddenLg: { 'Autres Flux': true },
    collapsedLg: {},
    collapsedSections: {}
};

// Global caches and configurations
var logoCache = {};
var matchCardCache = new Map();
var favTeams = {};
var customLgOrder = [];

// Tampermonkey install status
var hasSeenScriptModal = false;

// Interval Tracking
var globalStatsInterval = null;
var mvGameModeInterval = null;
var modalStatsInterval = null;
