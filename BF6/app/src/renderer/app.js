const DEFAULT_OVERLAY_STYLE = Object.freeze({
  frameStyle: 'color-sync',
  primaryColor: '#55dcff',
  secondaryColor: '#9b7dff',
  glowIntensity: 78,
  frameThickness: 3,
  pulseSpeed: 55,
  particles: true,
  cornerShape: 'rounded',
  boardX: 50,
  boardY: 50,
  boardScale: 100,
  popupX: 50,
  popupY: 50,
  popupScale: 100,
  popupStatueScale: 92,
  popupCardScale: 90,
  popupDuration: 8
});

const CATALOG_PAGE_SIZE = 60;
const HISTORY_PAGE_SIZE = 10;
const state = { view: 'library-onepiece', riftboundSpendingVisible: true, pullHistoryBuyerValuesVisible: true, query: '', game: 'ONEPIECE', setCode: 'All', rarity: 'All', catalogSets: [], savedOnly: false, cards: [], catalogVisibleCount: CATALOG_PAGE_SIZE, cardListOpen: false, cardListGame: 'RIFTBOUND', cardListSetCode: '', cardListCards: [], cardListUnmatched: [], cardListShowPrices: true, cardListStatus: '', cardListPriceStatus: null, boardCards: [], activeBoardCards: [], riftboundChampionAudit: [], riftboundSpotOverview: [], riftboundSpotOverviewOpen: true, riftboundSpotOverviewSelectedPosition: null, riftboundSpotMapEnabled: false, staticOverlayEnabled: false, pendingBreakRounds: [], pendingRoundStatus: new Map(), buyerBagPriceStatus: new Map(), collapsedBuyerBags: new Set(), riftboundBoardPriceStatus: null, pricing: { selectedSource: 'justtcg', selectedLabel: 'JustTCG', justTcgConfigured: false, ebayConfigured: false }, priceInput: null, boardOverview: { count: 0, activeCount: 0, ready: false, gameCode: 'ONEPIECE', mappingMode: 'MAPPED', activeMappingMode: 'MAPPED' }, boardGame: 'ONEPIECE', boardMappingMode: 'MAPPED', boardPresets: [], selectedBoardPresetSlot: null, boardPresetMessage: '', listingDescriptions: { ONEPIECE: '', RIFTBOUND: '' }, buyerMessageStatus: new Map(), riftboundBuyerMessageStatus: new Map(), orderHistory: [], orderHistoryTotalCount: 0, orderHistorySummary: {}, orderHistoryVisibleCount: HISTORY_PAGE_SIZE, orderHistorySaveStatus: '', pullHistory: [], pullHistoryTotalCount: 0, pullHistoryVisibleCount: HISTORY_PAGE_SIZE, pullHistorySaveStatus: '', historyPullStatus: '', pullHistoryPriceStatus: new Map(), pullHistoryExpandedBuyers: new Map(), pullHistorySelectedBatchIds: new Set(), pullHistoryCombinedMessagedBuyers: new Set(), pullHistoryCardEdit: null, focusedPullHistoryBatchId: null, historyTab: 'orders', businessExpenses: [], businessAdjustments: [], businessExpenseTotals: {}, businessSnapshot: null, businessExpenseReport: null, businessExpenseYears: [], businessExpenseYear: new Date().getFullYear(), expenseStatus: '', buyerAnalytics: null, buyerCaseFile: null, buyerCaseStatus: '', buyerOutcomeFilter: 'all', buyerPurchaseAudit: null, buyerPurchaseAuditStatus: '', boxTrackers: [], openBoxCases: [], boxTrackerCaseRecords: [], activeBoxTrackerId: null, activeOpenCaseId: null, boxTrackerTab: 'live', editingBoxTrackerId: null, editingCaseRecordId: null, editingOpenCaseDetails: false, creatingBoxTracker: false, selectedTrackerBoxNumber: null, breakerTrackerDestination: { trackerId: null, boxNumber: null }, boxTrackerStatus: '', connector: null, selectedId: null, importing: false, riftboundImporting: false, breakerFilter: 'MANGA', riftboundBreakerFilter: 'SIGNATURE', mappingEditor: null, mappingSelectedPosition: null, mappingDraftDirty: false, mappingLibraryTargetPosition: null, mappingLibraryAdditionType: 'SEQUENCE', mappingEditorStatus: '', overlayStyle: { ...DEFAULT_OVERLAY_STYLE } };
let riftboundSpotOverviewRenderSignature = '';

const CardListSearch = window.BreakSuiteCardListSearch;

const LIBRARY_VIEWS = new Set(['library-onepiece', 'library-riftbound', 'saved']);
const LIVE_BOARD_VIEWS = new Set(['break', 'breaker', 'riftbound-breaker', 'connector', 'studio']);
function isLibraryView(view = state.view) { return LIBRARY_VIEWS.has(view); }
function isOnePieceLibrary() { return state.game === 'ONEPIECE'; }

const elements = {
  title: document.querySelector('#view-title'),
  kicker: document.querySelector('#view-kicker'),
  grid: document.querySelector('#card-grid'),
  gridTitle: document.querySelector('#grid-title'),
  gridCount: document.querySelector('#grid-count'),
  preview: document.querySelector('#preview-panel'),
  search: document.querySelector('#search-input'),
  set: document.querySelector('#set-select'),
  setBox: document.querySelector('#set-filter-box'),
  quickAddHint: document.querySelector('#quick-add-hint'),
  rarity: document.querySelector('#rarity-select'),
  cardListSearch: document.querySelector('#card-list-search'),
  cardListToggle: document.querySelector('#card-list-search-toggle'),
  cardListBody: document.querySelector('#card-list-search-body'),
  cardListGame: document.querySelector('#card-list-game'),
  cardListSet: document.querySelector('#card-list-set'),
  cardListShowPrices: document.querySelector('#card-list-show-prices'),
  cardListInput: document.querySelector('#card-list-input'),
  cardListView: document.querySelector('#card-list-view'),
  cardListPrice: document.querySelector('#card-list-price'),
  cardListClear: document.querySelector('#card-list-clear'),
  cardListStatus: document.querySelector('#card-list-status'),
  cardListMissing: document.querySelector('#card-list-missing'),
  cardListResults: document.querySelector('#card-list-results'),
  total: document.querySelector('#total-count'),
  saved: document.querySelector('#saved-count'),
  sets: document.querySelector('#set-count'),
  database: document.querySelector('#database-state'),
  importButton: document.querySelector('#import-button'),
  runImport: document.querySelector('#run-import'),
  importStatus: document.querySelector('#import-status'),
  importProgress: document.querySelector('#import-progress'),
  importProgressLabel: document.querySelector('#import-progress-label'),
  importProgressCount: document.querySelector('#import-progress-count'),
  importProgressBar: document.querySelector('#import-progress-bar'),
  runRiftboundImport: document.querySelector('#run-riftbound-import'),
  runOpenRiftImageRefresh: document.querySelector('#run-openrift-image-refresh'),
  runRiftboundJsonImport: document.querySelector('#run-riftbound-json-import'),
  riftboundApiForm: document.querySelector('#riftbound-api-form'),
  riftboundApiKey: document.querySelector('#riftbound-api-key'),
  riftboundApiState: document.querySelector('#riftbound-api-state'),
  riftboundImportStatus: document.querySelector('#riftbound-import-status'),
  riftboundSetList: document.querySelector('#riftbound-set-list'),
  repairLibrary: document.querySelector('#repair-library'),
  repairStatus: document.querySelector('#repair-status'),
  resetLibraryForm: document.querySelector('#reset-library-form'),
  resetConfirmation: document.querySelector('#reset-library-confirmation'),
  resetStatus: document.querySelector('#reset-status'),
  breakBoardGrid: document.querySelector('#break-board-grid'),
  breakBoardCount: document.querySelector('#break-board-count'),
  breakListingPreview: document.querySelector('#break-listing-preview'),
  breakBoardStatus: document.querySelector('#break-board-status'),
  breakBoardGame: document.querySelector('#break-board-game'),
  breakBagMode: document.querySelector('#break-bag-mode'),
  breakReadyChecks: document.querySelector('#break-ready-checks'),
  boardLivePill: document.querySelector('#board-live-pill'),
  breakPresetSlots: document.querySelector('#break-preset-slots'),
  breakPresetName: document.querySelector('#break-preset-name'),
  breakPresetStatus: document.querySelector('#break-preset-status'),
  saveBreakPreset: document.querySelector('#save-break-preset'),
  clearBreakPreset: document.querySelector('#clear-break-preset'),
  copyBreakListing: document.querySelector('#copy-break-listing'),
  editBreakListingNotes: document.querySelector('#edit-break-listing-notes'),
  listingNotesModal: document.querySelector('#listing-notes-modal'),
  listingNotesForm: document.querySelector('#listing-notes-form'),
  listingNotesGame: document.querySelector('#listing-notes-game'),
  listingNotesText: document.querySelector('#listing-notes-text'),
  resetListingNotes: document.querySelector('#reset-listing-notes'),
  cancelListingNotes: document.querySelector('#cancel-listing-notes'),
  clearBreakBoard: document.querySelector('#clear-break-board'),
  addMoreBreakCards: document.querySelector('#add-more-break-cards'),
  saveBreakBoard: document.querySelector('#save-break-board'),
  openBreakOverlay: document.querySelector('#open-break-overlay'),
  studioPreview: document.querySelector('#studio-preview'),
  studioPreviewCards: document.querySelector('#studio-preview-cards'),
  studioPreviewPopup: document.querySelector('#studio-preview-popup'),
  studioStyleList: document.querySelector('#studio-frame-styles'),
  studioPrimary: document.querySelector('#studio-primary-color'),
  studioSecondary: document.querySelector('#studio-secondary-color'),
  studioGlow: document.querySelector('#studio-glow'),
  studioGlowOutput: document.querySelector('#studio-glow-output'),
  studioThickness: document.querySelector('#studio-thickness'),
  studioThicknessOutput: document.querySelector('#studio-thickness-output'),
  studioPulse: document.querySelector('#studio-pulse'),
  studioPulseOutput: document.querySelector('#studio-pulse-output'),
  studioParticles: document.querySelector('#studio-particles'),
  studioCornerShape: document.querySelector('#studio-corner-shape'),
  studioBoardX: document.querySelector('#studio-board-x'),
  studioBoardXOutput: document.querySelector('#studio-board-x-output'),
  studioBoardY: document.querySelector('#studio-board-y'),
  studioBoardYOutput: document.querySelector('#studio-board-y-output'),
  studioBoardScale: document.querySelector('#studio-board-scale'),
  studioBoardScaleOutput: document.querySelector('#studio-board-scale-output'),
  studioPopupX: document.querySelector('#studio-popup-x'),
  studioPopupXOutput: document.querySelector('#studio-popup-x-output'),
  studioPopupY: document.querySelector('#studio-popup-y'),
  studioPopupYOutput: document.querySelector('#studio-popup-y-output'),
  studioPopupScale: document.querySelector('#studio-popup-scale'),
  studioPopupScaleOutput: document.querySelector('#studio-popup-scale-output'),
  studioPopupStatueScale: document.querySelector('#studio-popup-statue-scale'),
  studioPopupStatueScaleOutput: document.querySelector('#studio-popup-statue-scale-output'),
  studioPopupCardScale: document.querySelector('#studio-popup-card-scale'),
  studioPopupCardScaleOutput: document.querySelector('#studio-popup-card-scale-output'),
  studioPopupDuration: document.querySelector('#studio-popup-duration'),
  studioPopupDurationOutput: document.querySelector('#studio-popup-duration-output'),
  studioPreviewPopupCard: document.querySelector('#studio-preview-popup-card'),
  studioSave: document.querySelector('#studio-save'),
  studioReset: document.querySelector('#studio-reset'),
  studioStatus: document.querySelector('#studio-status'),
  mappingBoardSelect: document.querySelector('#mapping-board-select'),
  mappingBoardList: document.querySelector('#mapping-board-list'),
  mappingEditorState: document.querySelector('#mapping-editor-state'),
  mappingSpotCount: document.querySelector('#mapping-spot-count'),
  mappingSpotList: document.querySelector('#mapping-spot-list'),
  mappingSpotWorkspace: document.querySelector('#mapping-spot-workspace'),
  mappingSave: document.querySelector('#mapping-save'),
  mappingReset: document.querySelector('#mapping-reset'),
  mappingEditorStatus: document.querySelector('#mapping-editor-status'),
  mappingLibraryMode: document.querySelector('#mapping-library-mode'),
  mappingLibraryTitle: document.querySelector('#mapping-library-title'),
  mappingLibraryFeedback: document.querySelector('#mapping-library-feedback'),
  mappingLibraryReturn: document.querySelector('#mapping-library-return')
  , connectorStatus: document.querySelector('#connector-status')
  , connectorChecks: document.querySelector('#connector-checks')
  , connectorTestBlock: document.querySelector('#connector-test-block')
  , connectorTestBuyer: document.querySelector('#connector-test-buyer')
  , sendConnectorTest: document.querySelector('#send-connector-test')
  , runConnectorStressTest: document.querySelector('#run-connector-stress-test')
  , resetConnectorTest: document.querySelector('#reset-connector-test')
  , connectorTestResult: document.querySelector('#connector-test-result')
  , breakerSummary: document.querySelector('#breaker-summary')
  , breakerPriorityTabs: document.querySelector('#breaker-priority-tabs')
  , breakerPriorityCards: document.querySelector('#breaker-priority-cards')
  , breakerOddsTotal: document.querySelector('#breaker-odds-total')
  , breakerOdds: document.querySelector('#breaker-odds')
  , breakerBags: document.querySelector('#breaker-bags')
  , breakerRanking: document.querySelector('#breaker-ranking')
  , savePullHistory: document.querySelector('#save-pull-history')
  , pullHistorySaveStatus: document.querySelector('#pull-history-save-status')
  , riftboundBreakerSummary: document.querySelector('#riftbound-breaker-summary')
  , riftboundSpotOverview: document.querySelector('#riftbound-spot-overview')
  , riftboundSpotOverviewSummary: document.querySelector('#riftbound-spot-overview-summary')
  , riftboundSpotOverviewToggle: document.querySelector('#riftbound-spot-overview-toggle')
  , copyRiftboundSpotMapOverlay: document.querySelector('#copy-riftbound-spot-map-overlay')
  , toggleRiftboundSpotMap: document.querySelector('#toggle-riftbound-spot-map')
  , openRiftboundSpotMapOverlay: document.querySelector('#open-riftbound-spot-map-overlay')
  , riftboundSpotMapOverlayStatus: document.querySelector('#riftbound-spot-map-overlay-status')
  , toggleStaticOverlay: document.querySelector('#toggle-static-overlay')
  , copyStaticOverlay: document.querySelector('#copy-static-overlay')
  , staticOverlayStatus: document.querySelector('#static-overlay-status')
  , pendingBreakRounds: document.querySelector('#pending-break-rounds')
  , riftboundBreakerView: document.querySelector('#riftbound-breaker-view')
  , finishLiveRound: document.querySelector('#finish-live-round')
  , riftboundBreakerPriorityTabs: document.querySelector('#riftbound-breaker-priority-tabs')
  , riftboundBreakerPriorityCards: document.querySelector('#riftbound-breaker-priority-cards')
  , riftboundBreakerOddsTotal: document.querySelector('#riftbound-breaker-odds-total')
  , riftboundBreakerOdds: document.querySelector('#riftbound-breaker-odds')
  , riftboundBreakerBags: document.querySelector('#riftbound-breaker-bags')
  , riftboundBreakerRanking: document.querySelector('#riftbound-breaker-ranking')
  , riftboundSpendingPanel: document.querySelector('#riftbound-spending-panel')
  , buyerPriceSource: document.querySelector('#buyer-price-source')
  , refreshRiftboundBoardPrices: document.querySelector('#refresh-riftbound-board-prices')
  , riftboundBoardPriceStatus: document.querySelector('#riftbound-board-price-status')
  , openBuyerPriceFeed: document.querySelector('#open-buyer-price-feed')
  , toggleRiftboundSpending: document.querySelector('#toggle-riftbound-spending')
  , saveRiftboundPullHistory: document.querySelector('#save-riftbound-pull-history')
  , riftboundPullHistorySaveStatus: document.querySelector('#riftbound-pull-history-save-status')
  , riftboundBuyerCardSearch: document.querySelector('#riftbound-buyer-card-search')
  , riftboundBuyerCardSearchResults: document.querySelector('#riftbound-buyer-card-search-results')
  , buyerTrackerCase: document.querySelector('#buyer-tracker-case')
  , buyerTrackerBox: document.querySelector('#buyer-tracker-box')
  , historySummary: document.querySelector('#history-summary')
  , historySaveForm: document.querySelector('#history-save-form')
  , historyBreakName: document.querySelector('#history-break-name')
  , historyBoxCost: document.querySelector('#history-box-cost')
  , historyWhatnotCommission: document.querySelector('#history-whatnot-commission')
  , historyWhatnotProcessing: document.querySelector('#history-whatnot-processing')
  , historyWhatnotTransactionFee: document.querySelector('#history-whatnot-transaction-fee')
  , historyWhatnotTransactionCount: document.querySelector('#history-whatnot-transaction-count')
  , historyWhatnotFeeTax: document.querySelector('#history-whatnot-fee-tax')
  , historyWhatnotAdditionalFees: document.querySelector('#history-whatnot-additional-fees')
  , historyWhatnotActualFees: document.querySelector('#history-whatnot-actual-fees')
  , historyNotes: document.querySelector('#history-notes')
  , historyOpenCaseSelect: document.querySelector('#history-open-case-select')
  , historyOpenCaseHelp: document.querySelector('#history-open-case-help')
  , historyTrackerType: document.querySelector('#history-tracker-type')
  , historySaveStatus: document.querySelector('#history-save-status')
  , historyRecords: document.querySelector('#history-records')
  , historyTabs: document.querySelectorAll('[data-history-tab]')
  , historyOrdersPane: document.querySelector('#history-orders-pane')
  , historyPullsPane: document.querySelector('#history-pulls-pane')
  , historyPullStatus: document.querySelector('#history-pull-status')
  , pullHistoryRecords: document.querySelector('#pull-history-records')
  , pullHistorySelectionState: document.querySelector('#pull-history-selection-state')
  , clearPullHistorySelection: document.querySelector('#clear-pull-history-selection')
  , pullHistoryPriceSource: document.querySelector('#pull-history-price-source')
  , openPullPriceFeed: document.querySelector('#open-pull-price-feed')
  , togglePullHistoryBuyerValues: document.querySelector('#toggle-pull-history-buyer-values')
  , pullHistoryPrivacyState: document.querySelector('#pull-history-privacy-state')
  , pullHistoryCardModal: document.querySelector('#pull-history-card-modal')
  , pullHistoryCardForm: document.querySelector('#pull-history-card-form')
  , pullHistoryCardTitle: document.querySelector('#pull-history-card-title')
  , pullHistoryCardDescription: document.querySelector('#pull-history-card-description')
  , pullHistoryCardSpot: document.querySelector('#pull-history-card-spot')
  , pullHistoryCardQuantity: document.querySelector('#pull-history-card-quantity')
  , pullHistoryCardSearch: document.querySelector('#pull-history-card-search')
  , pullHistoryCardResults: document.querySelector('#pull-history-card-results')
  , pullHistoryCardStatus: document.querySelector('#pull-history-card-status')
  , cancelPullHistoryCard: document.querySelector('#cancel-pull-history-card')
  , savePullHistoryCard: document.querySelector('#save-pull-history-card')
  , priceInputModal: document.querySelector('#price-input-modal')
  , priceInputForm: document.querySelector('#price-input-form')
  , priceInputEyebrow: document.querySelector('#price-input-eyebrow')
  , priceInputTitle: document.querySelector('#price-input-title')
  , priceInputDescription: document.querySelector('#price-input-description')
  , priceInputChatGpt: document.querySelector('#price-input-chatgpt')
  , priceInputJson: document.querySelector('#price-input-json')
  , priceInputManual: document.querySelector('#price-input-manual')
  , priceInputStatus: document.querySelector('#price-input-status')
  , copyChatGptPriceRequest: document.querySelector('#copy-chatgpt-price-request')
  , cancelPriceInput: document.querySelector('#cancel-price-input')
  , savePriceInput: document.querySelector('#save-price-input')
  , expenseSummary: document.querySelector('#expense-summary')
  , businessSnapshot: document.querySelector('#business-snapshot')
  , businessSnapshotHealth: document.querySelector('#business-snapshot-health')
  , businessExpenseYear: document.querySelector('#business-expense-year')
  , businessSnapshotRefresh: document.querySelector('#business-snapshot-refresh')
  , businessExpensePrint: document.querySelector('#business-expense-print')
  , businessExpensePdf: document.querySelector('#business-expense-pdf')
  , businessExpenseExcel: document.querySelector('#business-expense-excel')
  , businessPrintReport: document.querySelector('#business-print-report')
  , expenseSaveForm: document.querySelector('#expense-save-form')
  , expenseName: document.querySelector('#expense-name')
  , expenseAmount: document.querySelector('#expense-amount')
  , expenseCategory: document.querySelector('#expense-category')
  , expenseVendor: document.querySelector('#expense-vendor')
  , expenseDate: document.querySelector('#expense-date')
  , expenseNotes: document.querySelector('#expense-notes')
  , expenseStatus: document.querySelector('#expense-status')
  , expenseRecords: document.querySelector('#expense-records')
  , chaserForm: document.querySelector('#chaser-form'), chaserCard: document.querySelector('#chaser-card'), chaserThreshold: document.querySelector('#chaser-threshold'), chaserSlots: document.querySelector('#chaser-slots'), chaserPreview: document.querySelector('#chaser-preview'), chaserStatus: document.querySelector('#chaser-status'), chaserCopy: document.querySelector('#chaser-copy'), chaserRefresh: document.querySelector('#chaser-refresh'), chaserReset: document.querySelector('#chaser-reset'), chaserCopyNames: document.querySelector('#chaser-copy-names'), chaserRecentBuyersRefresh: document.querySelector('#chaser-recent-buyers-refresh'), chaserRecentBuyersStatus: document.querySelector('#chaser-recent-buyers-status'), chaserRecentBuyersList: document.querySelector('#chaser-recent-buyers-list'), royalForm: document.querySelector('#royal-form'), royalCard: document.querySelector('#royal-card'), royalThreshold: document.querySelector('#royal-threshold'), royalSlots: document.querySelector('#royal-slots'), royalPreview: document.querySelector('#royal-preview'), royalStatus: document.querySelector('#royal-status'), royalCopy: document.querySelector('#royal-copy'), royalRefresh: document.querySelector('#royal-refresh'), royalReset: document.querySelector('#royal-reset'), royalCopyNames: document.querySelector('#royal-copy-names')
  , buyerAnalyticsSummary: document.querySelector('#buyer-analytics-summary')
  , buyerTopTen: document.querySelector('#buyer-top-ten')
  , buyerAnalyticsList: document.querySelector('#buyer-analytics-list')
  , buyerCaseForm: document.querySelector('#buyer-case-form')
  , buyerCaseQuery: document.querySelector('#buyer-case-query')
  , buyerCaseSuggestions: document.querySelector('#buyer-case-suggestions')
  , buyerCaseStatus: document.querySelector('#buyer-case-status')
  , buyerCaseResults: document.querySelector('#buyer-case-results')
  , buyerOutcomeTabs: document.querySelectorAll('[data-buyer-outcome]')
  , buyerOutcomeSummary: document.querySelector('#buyer-outcome-summary')
  , buyerOutcomeList: document.querySelector('#buyer-outcome-list')
  , buyerPurchaseAuditButton: document.querySelector('#buyer-purchase-audit-button')
  , buyerPurchaseAuditStatus: document.querySelector('#buyer-purchase-audit-status')
  , buyerPurchaseAuditSummary: document.querySelector('#buyer-purchase-audit-summary')
  , trackerSelect: document.querySelector('#tracker-select')
  , trackerTabs: document.querySelectorAll('[data-tracker-tab]')
  , trackerListEyebrow: document.querySelector('#tracker-list-eyebrow')
  , trackerListTitle: document.querySelector('#tracker-list-title')
  , trackerListCopy: document.querySelector('#tracker-list-copy')
  , trackerSelectLabel: document.querySelector('#tracker-select-label')
  , liveCaseCreatePanel: document.querySelector('#live-case-create-panel')
  , openCaseForm: document.querySelector('#open-case-form')
  , openCaseName: document.querySelector('#open-case-name')
  , openCaseGame: document.querySelector('#open-case-game')
  , openCaseSet: document.querySelector('#open-case-set')
  , openCaseBoxes: document.querySelector('#open-case-boxes')
  , createOpenCase: document.querySelector('#create-open-case')
  , editOpenCase: document.querySelector('#edit-open-case')
  , finalizeOpenCase: document.querySelector('#finalize-open-case')
  , deleteOpenCase: document.querySelector('#delete-open-case')
  , openCaseEditForm: document.querySelector('#open-case-edit-form')
  , editOpenCaseName: document.querySelector('#edit-open-case-name')
  , editOpenCaseBoxes: document.querySelector('#edit-open-case-boxes')
  , saveOpenCaseEdit: document.querySelector('#save-open-case-edit')
  , cancelOpenCaseEdit: document.querySelector('#cancel-open-case-edit')
  , trackerName: document.querySelector('#tracker-name')
  , trackerOverlayTitle: document.querySelector('#tracker-overlay-title')
  , trackerProduct: document.querySelector('#tracker-product')
  , trackerTotalBoxes: document.querySelector('#tracker-total-boxes')
  , trackerSettingsForm: document.querySelector('#tracker-settings-form')
  , trackerSettingsButton: document.querySelector('#save-tracker-settings')
  , saveTrackerOverlayTitle: document.querySelector('#save-tracker-overlay-title')
  , trackerStatus: document.querySelector('#tracker-status')
  , trackerBoardTitle: document.querySelector('#tracker-board-title')
  , trackerBoardCopy: document.querySelector('#tracker-board-copy')
  , trackerSummary: document.querySelector('#tracker-summary')
  , trackerBoxGrid: document.querySelector('#tracker-box-grid')
  , trackerHitSummary: document.querySelector('#tracker-hit-summary')
  , saveTrackerCaseRecord: document.querySelector('#save-tracker-case-record')
  , trackerCaseRecords: document.querySelector('#tracker-case-records')
  , trackerHitForm: document.querySelector('#tracker-hit-form')
  , trackerHitRecordTitle: document.querySelector('#tracker-hit-record-title')
  , trackerHitRecordCopy: document.querySelector('#tracker-hit-record-copy')
  , saveTrackerHits: document.querySelector('#save-tracker-hits')
  , newTracker: document.querySelector('#new-tracker')
  , deleteTracker: document.querySelector('#delete-tracker')
  , copyTrackerOverlay: document.querySelector('#copy-tracker-overlay')
  , openTrackerOverlay: document.querySelector('#open-tracker-overlay')
  , copyActiveCaseOverlay: document.querySelector('#copy-active-case-overlay')
  , openActiveCaseOverlay: document.querySelector('#open-active-case-overlay')
  , trackerHitWinnerForm: document.querySelector('#tracker-hit-winner-form')
  , saveTrackerHitWinner: document.querySelector('#save-tracker-hit-winner')
  , trackerHitWinnerList: document.querySelector('#tracker-hit-winner-list')
  , salesSignForm: document.querySelector('#sales-sign-form'), salesSignText: document.querySelector('#sales-sign-text'), salesSignBoard: document.querySelector('#sales-sign-board'), salesSignSize: document.querySelector('#sales-sign-size'), salesSignStatus: document.querySelector('#sales-sign-status'), salesSignPreview: document.querySelector('#sales-sign-preview'), copySalesSignOverlay: document.querySelector('#copy-sales-sign-overlay')
  , pinConnectionStatus: document.querySelector('#pin-connection-status')
  , pinMessage: document.querySelector('#pin-message')
  , pinCharCount: document.querySelector('#pin-char-count')
  , pinSendPing: document.querySelector('#pin-send-ping')
  , pinToggleLive: document.querySelector('#pin-toggle-live')
  , pinLiveState: document.querySelector('#pin-live-state')
  , pinResult: document.querySelector('#pin-result')
  , pinSettingsForm: document.querySelector('#pin-settings-form')
  , pinBaseUrl: document.querySelector('#pin-base-url')
  , pinChannelId: document.querySelector('#pin-channel-id')
  , pinApiKey: document.querySelector('#pin-api-key')
  , pinAutoGoLive: document.querySelector('#pin-auto-go-live')
  , pinSettingsStatus: document.querySelector('#pin-settings-status')
};

let pinIsLive = null;

function salesSignMarkup(sign) { const message = escapeHtml(sign.text).replace(/\n/g,'<br>'); const boardClass = sign.board === 'riftbound' ? 'riftbound-board' : (sign.board === 'secondary' ? 'secondary-board' : 'primary-board'); return `<div class="treasure-sales-sign ${boardClass} ${sign.size}"><div class="treasure-sales-message">${message}</div></div>`; }
async function refreshSalesSign() { const sign = await window.breakSuite.getSalesSign(); elements.salesSignText.value = sign.text; elements.salesSignBoard.value = sign.board || 'primary'; elements.salesSignSize.value = sign.size; elements.salesSignPreview.innerHTML = salesSignMarkup(sign); }

function updatePinCharCount() {
  if (!elements.pinMessage || !elements.pinCharCount) return;
  elements.pinCharCount.textContent = `${elements.pinMessage.value.length} / 160`;
}

function renderPinLiveState() {
  if (!elements.pinLiveState || !elements.pinToggleLive) return;
  if (pinIsLive === true) {
    elements.pinLiveState.textContent = 'Channel is LIVE.';
    elements.pinToggleLive.textContent = 'End Live';
  } else if (pinIsLive === false) {
    elements.pinLiveState.textContent = 'Channel is offline.';
    elements.pinToggleLive.textContent = 'Go Live';
  } else {
    elements.pinLiveState.textContent = 'Live status unknown until you toggle.';
    elements.pinToggleLive.textContent = 'Go Live';
  }
}

async function refreshNotifyView() {
  if (!window.breakSuite?.pin) {
    if (elements.pinConnectionStatus) elements.pinConnectionStatus.textContent = 'PIN controls are unavailable in this build.';
    return;
  }
  try {
    const settings = await window.breakSuite.pin.getSettings();
    if (elements.pinBaseUrl) elements.pinBaseUrl.value = settings.baseUrl || '';
    if (elements.pinChannelId) elements.pinChannelId.value = settings.channelId || '';
    if (elements.pinApiKey) elements.pinApiKey.value = '';
    if (elements.pinApiKey) {
      elements.pinApiKey.placeholder = settings.hasKey
        ? 'Saved key kept (enter a new pin_sk_… to replace)'
        : 'pin_sk_…';
    }
    if (elements.pinAutoGoLive) elements.pinAutoGoLive.checked = settings.autoGoLiveOnShowReady === true;
    if (elements.pinSettingsStatus) {
      elements.pinSettingsStatus.textContent = settings.hasKey
        ? (settings.insecureKeyStorage
          ? 'Settings loaded. API key is stored without Windows secure storage on this machine.'
          : 'Settings loaded. API key stays encrypted on this Windows account.')
        : 'Save backend URL, channel id, and API key before sending pings.';
    }
    updatePinCharCount();
    renderPinLiveState();
    if (!settings.hasKey || !settings.baseUrl || !settings.channelId) {
      if (elements.pinConnectionStatus) elements.pinConnectionStatus.textContent = 'PIN is not configured yet.';
      return;
    }
    if (elements.pinConnectionStatus) elements.pinConnectionStatus.textContent = 'Checking PIN connection…';
    const connection = await window.breakSuite.pin.testConnection();
    if (elements.pinConnectionStatus) {
      elements.pinConnectionStatus.textContent = connection?.ok
        ? '✓ Connected to PIN backend.'
        : 'PIN backend did not respond OK.';
    }
  } catch (error) {
    if (elements.pinConnectionStatus) {
      elements.pinConnectionStatus.textContent = error.message || 'PIN connection check failed.';
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function isProductOnlyDon(card) {
  return /DON!!/i.test(card?.card_type || '') && !String(card?.card_number || '').trim();
}

function cardImage(imageUrl, name, productOnly = false) {
  if (!imageUrl && /DON!!/i.test(name)) return '<div class="card-art product-only-art"><b>DON!!</b><span>Supplemental printing</span></div>';
  if (!imageUrl) return '<div class="card-art">♧</div>';
  return `<div class="card-art${productOnly ? ' product-card-art' : ''}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" /></div>`;
}

function boundedStudioNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(number)));
}

function studioHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
}

function normalizeStudioStyle(style = {}) {
  const source = { ...DEFAULT_OVERLAY_STYLE, ...(style || {}) };
  return {
    frameStyle: ['color-sync', 'haki-crack', 'holo-reactor', 'boss-awakening'].includes(source.frameStyle) ? source.frameStyle : DEFAULT_OVERLAY_STYLE.frameStyle,
    primaryColor: studioHex(source.primaryColor, DEFAULT_OVERLAY_STYLE.primaryColor),
    secondaryColor: studioHex(source.secondaryColor, DEFAULT_OVERLAY_STYLE.secondaryColor),
    glowIntensity: boundedStudioNumber(source.glowIntensity, DEFAULT_OVERLAY_STYLE.glowIntensity, 20, 100),
    frameThickness: boundedStudioNumber(source.frameThickness, DEFAULT_OVERLAY_STYLE.frameThickness, 1, 8),
    pulseSpeed: boundedStudioNumber(source.pulseSpeed, DEFAULT_OVERLAY_STYLE.pulseSpeed, 15, 100),
    particles: Boolean(source.particles),
    cornerShape: ['rounded', 'bevel', 'square'].includes(source.cornerShape) ? source.cornerShape : DEFAULT_OVERLAY_STYLE.cornerShape,
    boardX: boundedStudioNumber(source.boardX, DEFAULT_OVERLAY_STYLE.boardX, 8, 92),
    boardY: boundedStudioNumber(source.boardY, DEFAULT_OVERLAY_STYLE.boardY, 8, 92),
    boardScale: boundedStudioNumber(source.boardScale, DEFAULT_OVERLAY_STYLE.boardScale, 68, 122),
    popupX: boundedStudioNumber(source.popupX, DEFAULT_OVERLAY_STYLE.popupX, 8, 92),
    popupY: boundedStudioNumber(source.popupY, DEFAULT_OVERLAY_STYLE.popupY, 8, 92),
    popupScale: boundedStudioNumber(source.popupScale, DEFAULT_OVERLAY_STYLE.popupScale, 65, 135),
    popupStatueScale: boundedStudioNumber(source.popupStatueScale, DEFAULT_OVERLAY_STYLE.popupStatueScale, 60, 130),
    popupCardScale: boundedStudioNumber(source.popupCardScale, DEFAULT_OVERLAY_STYLE.popupCardScale, 60, 130),
    popupDuration: boundedStudioNumber(source.popupDuration, DEFAULT_OVERLAY_STYLE.popupDuration, 2, 15)
  };
}

function studioStyleFromControls() {
  if (!elements.studioPrimary) return normalizeStudioStyle(state.overlayStyle);
  return normalizeStudioStyle({
    ...state.overlayStyle,
    primaryColor: elements.studioPrimary.value,
    secondaryColor: elements.studioSecondary.value,
    glowIntensity: elements.studioGlow.value,
    frameThickness: elements.studioThickness.value,
    pulseSpeed: elements.studioPulse.value,
    particles: elements.studioParticles.checked,
    cornerShape: elements.studioCornerShape.value,
    boardX: elements.studioBoardX.value,
    boardY: elements.studioBoardY.value,
    boardScale: elements.studioBoardScale.value,
    popupX: elements.studioPopupX.value,
    popupY: elements.studioPopupY.value,
    popupScale: elements.studioPopupScale.value,
    popupStatueScale: elements.studioPopupStatueScale.value,
    popupCardScale: elements.studioPopupCardScale.value,
    popupDuration: elements.studioPopupDuration.value
  });
}

function updateStudioOutputs(style) {
  if (!elements.studioGlowOutput) return;
  elements.studioGlowOutput.textContent = `${style.glowIntensity}%`;
  elements.studioThicknessOutput.textContent = `${style.frameThickness} px`;
  elements.studioPulseOutput.textContent = `${style.pulseSpeed}%`;
  elements.studioBoardXOutput.textContent = `${style.boardX}%`;
  elements.studioBoardYOutput.textContent = `${style.boardY}%`;
  elements.studioBoardScaleOutput.textContent = `${style.boardScale}%`;
  elements.studioPopupXOutput.textContent = `${style.popupX}%`;
  elements.studioPopupYOutput.textContent = `${style.popupY}%`;
  elements.studioPopupScaleOutput.textContent = `${style.popupScale}%`;
  elements.studioPopupStatueScaleOutput.textContent = `${style.popupStatueScale}%`;
  elements.studioPopupCardScaleOutput.textContent = `${style.popupCardScale}%`;
  elements.studioPopupDurationOutput.textContent = `${style.popupDuration} sec`;
}

function writeStudioControls(style) {
  if (!elements.studioPrimary) return;
  elements.studioPrimary.value = style.primaryColor;
  elements.studioSecondary.value = style.secondaryColor;
  elements.studioGlow.value = style.glowIntensity;
  elements.studioThickness.value = style.frameThickness;
  elements.studioPulse.value = style.pulseSpeed;
  elements.studioParticles.checked = style.particles;
  elements.studioCornerShape.value = style.cornerShape;
  elements.studioBoardX.value = style.boardX;
  elements.studioBoardY.value = style.boardY;
  elements.studioBoardScale.value = style.boardScale;
  elements.studioPopupX.value = style.popupX;
  elements.studioPopupY.value = style.popupY;
  elements.studioPopupScale.value = style.popupScale;
  elements.studioPopupStatueScale.value = style.popupStatueScale;
  elements.studioPopupCardScale.value = style.popupCardScale;
  elements.studioPopupDuration.value = style.popupDuration;
  updateStudioOutputs(style);
}

function renderStudioCards() {
  if (!elements.studioPreviewCards) return;
  const sourceCards = (state.activeBoardCards.length ? state.activeBoardCards : state.boardCards)
    .filter(card => !card.block_status || card.block_status === 'ready')
    .slice(0, 12);
  elements.studioPreviewCards.innerHTML = sourceCards.length
    ? sourceCards.map(card => `<div class="studio-preview-card">${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="" />` : '<span>♧</span>'}</div>`).join('')
    : Array.from({ length: 6 }, (_, index) => `<div class="studio-preview-card placeholder"><span>${index + 1}</span></div>`).join('');
  if (elements.studioPreviewPopupCard) {
    const popupCard = sourceCards[0];
    elements.studioPreviewPopupCard.innerHTML = popupCard?.image_url
      ? `<img src="${escapeHtml(popupCard.image_url)}" alt="" />`
      : '<span>CARD</span>';
  }
}

function applyStudioPreview(style) {
  if (!elements.studioPreview) return;
  const normalized = normalizeStudioStyle(style);
  const preview = elements.studioPreview;
  preview.dataset.frameStyle = normalized.frameStyle;
  preview.dataset.cornerShape = normalized.cornerShape;
  preview.dataset.particles = String(normalized.particles);
  preview.style.setProperty('--studio-primary', normalized.primaryColor);
  preview.style.setProperty('--studio-secondary', normalized.secondaryColor);
  preview.style.setProperty('--studio-glow', `${Math.max(20, normalized.glowIntensity)}%`);
  preview.style.setProperty('--studio-thickness', `${normalized.frameThickness}px`);
  preview.style.setProperty('--studio-motion', `${Math.max(3.8, 16 - (normalized.pulseSpeed * 0.1)).toFixed(1)}s`);
  preview.style.setProperty('--studio-board-x', `${normalized.boardX}%`);
  preview.style.setProperty('--studio-board-y', `${normalized.boardY}%`);
  preview.style.setProperty('--studio-board-scale', String(normalized.boardScale / 100));
  preview.style.setProperty('--studio-popup-x', `${normalized.popupX}%`);
  preview.style.setProperty('--studio-popup-y', `${normalized.popupY}%`);
  preview.style.setProperty('--studio-popup-scale', String(normalized.popupScale / 100));
  preview.style.setProperty('--studio-popup-statue-scale', String(normalized.popupStatueScale / 100));
  preview.style.setProperty('--studio-popup-card-scale', String(normalized.popupCardScale / 100));
  preview.style.setProperty('--studio-popup-time', `${normalized.popupDuration}s`);
  elements.studioStyleList?.querySelectorAll('[data-frame-style]').forEach(choice => choice.classList.toggle('active', choice.dataset.frameStyle === normalized.frameStyle));
  updateStudioOutputs(normalized);
}

function renderFrameStudio({ syncControls = true } = {}) {
  const style = normalizeStudioStyle(state.overlayStyle);
  state.overlayStyle = style;
  if (syncControls) writeStudioControls(style);
  applyStudioPreview(style);
  renderStudioCards();
}

async function loadOverlayStyle() {
  state.overlayStyle = normalizeStudioStyle(await window.breakSuite.getOverlayStyle());
  renderFrameStudio();
  return state.overlayStyle;
}

function mappingEditorSpot(position = state.mappingSelectedPosition) {
  return state.mappingEditor?.spots?.find(spot => Number(spot.position) === Number(position)) || null;
}

function mappingOwnership() {
  const owners = new Map();
  for (const spot of state.mappingEditor?.spots || []) {
    for (const card of spot.cards || []) {
      owners.set(Number(card.id), {
        position: Number(spot.position),
        anchor: Number(card.id) === Number(spot.anchorCardId),
        additionType: String(card.additionType || 'SEQUENCE').toUpperCase()
      });
    }
  }
  return owners;
}

function mappingUiCard(card = {}) {
  const treatment = String(card.treatment ?? card.collector_treatment ?? '').trim();
  const role = String(card.role || (treatment.toUpperCase() === 'SIGNATURE'
    ? 'signature'
    : String(card.riftbound_art_variant || '').trim().toUpperCase() === 'ULTIMATE'
      ? 'ultimate'
    : treatment.toUpperCase() === 'OVERNUMBERED'
      ? 'overnumbered'
      : treatment.toUpperCase() === 'ALTERNATE ART' ? 'alternate-art' : 'mapped'));
  const badges = { signature: '💎', ultimate: '💀', overnumbered: '🔥', 'alternate-art': '💣' };
  return {
    id: Number(card.id) || 0,
    name: String(card.name || ''),
    cardNumber: String(card.cardNumber ?? card.card_number ?? ''),
    setCode: String(card.setCode ?? card.set_code ?? ''),
    setName: String(card.setName ?? card.set_name ?? ''),
    rarity: String(card.rarity ?? card.break_rarity ?? ''),
    treatment,
    imageUrl: String(card.imageUrl ?? card.image_url ?? ''),
    role,
    badge: String(card.badge || badges[role] || ''),
    badgeLabel: String(card.badgeLabel || treatment || card.rarity || 'Mapped card'),
    additionType: ['ANCHOR', 'SEQUENCE', 'PLUS'].includes(String(card.additionType || '').toUpperCase())
      ? String(card.additionType).toUpperCase()
      : 'SEQUENCE'
  };
}

function mappingSpotDisplayLabel(spot = {}) {
  const base = String(spot.label || spot.anchorCard?.name || `Spot ${spot.position || ''}`).replace(/\s+/g, ' ').trim();
  const plusNames = [];
  const seen = new Set();
  for (const card of spot.cards || []) {
    if (String(card.additionType || '').toUpperCase() !== 'PLUS') continue;
    const name = String(card.name || '').replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key) || base.toLowerCase().includes(key)) continue;
    seen.add(key);
    plusNames.push(name);
  }
  return [base, ...plusNames].filter(Boolean).join(' + ');
}

function mappingCardFacts(card = {}) {
  return [card.setCode, card.cardNumber, card.treatment || card.rarity].filter(Boolean).join(' · ') || 'Riftbound card';
}

function preferredMappingEditorSlot() {
  const current = Number(state.mappingEditor?.slot || 0);
  if (current && state.boardPresets.some(preset => Number(preset.slot) === current)) return current;
  const loaded = state.boardPresets.find(preset => preset.isLoaded && preset.count);
  if (loaded) return Number(loaded.slot);
  const mappedRiftbound = state.boardPresets.find(preset => preset.count && preset.gameCode === 'RIFTBOUND' && preset.mappingMode === 'MAPPED');
  if (mappedRiftbound) return Number(mappedRiftbound.slot);
  return Number(state.boardPresets.find(preset => preset.count)?.slot || 1);
}

function setMappingEditorStatus(message) {
  state.mappingEditorStatus = String(message || '');
  if (elements.mappingEditorStatus) elements.mappingEditorStatus.textContent = state.mappingEditorStatus;
}

function moveCardInMapping(cardValue, targetValue, { fromLibrary = false, additionType = '' } = {}) {
  const editor = state.mappingEditor;
  const cardId = Number(cardValue?.id ?? cardValue);
  const targetPosition = Number(targetValue);
  const target = mappingEditorSpot(targetPosition);
  if (!editor?.editable || !target || !cardId) return { changed: false, message: 'Choose an editable mapped spot first.' };
  const owners = mappingOwnership();
  const previous = owners.get(cardId);
  const requestedType = ['SEQUENCE', 'PLUS'].includes(String(additionType || (fromLibrary ? state.mappingLibraryAdditionType : '')).toUpperCase())
    ? String(additionType || state.mappingLibraryAdditionType).toUpperCase()
    : '';
  if (previous?.anchor && previous.position !== targetPosition) {
    return { changed: false, message: `That card is the locked anchor for Spot ${previous.position}. Change the board position itself from Break Board.` };
  }
  if (previous?.position === targetPosition) {
    const existingCard = target.cards.find(card => Number(card.id) === cardId);
    if (!previous.anchor && requestedType && existingCard?.additionType !== requestedType) {
      existingCard.additionType = requestedType;
      state.mappingDraftDirty = true;
      const typeName = requestedType === 'PLUS' ? '+ Title' : 'Sequence';
      setMappingEditorStatus(`${existingCard.name} is now a ${typeName} card in Spot ${targetPosition}. Save This Mapping when you are finished.`);
      if (!fromLibrary) renderBoardMappingEditor();
      return { changed: true, message: `${existingCard.name} changed to ${typeName} in Spot ${targetPosition}.`, card: existingCard };
    }
    return { changed: false, message: previous.anchor
      ? `That card is already the locked map/anchor for Spot ${targetPosition}.`
      : `That card is already assigned to Spot ${targetPosition} as ${existingCard?.additionType === 'PLUS' ? '+ Title' : 'Sequence'}.` };
  }
  let movedCard = null;
  if (previous) {
    const source = mappingEditorSpot(previous.position);
    const index = source.cards.findIndex(card => Number(card.id) === cardId);
    if (index >= 0) [movedCard] = source.cards.splice(index, 1);
  }
  if (!movedCard) movedCard = mappingUiCard(cardValue);
  const normalizedCard = mappingUiCard(movedCard);
  normalizedCard.additionType = requestedType || normalizedCard.additionType || 'SEQUENCE';
  target.cards.push(normalizedCard);
  state.mappingDraftDirty = true;
  const titleMode = normalizedCard.additionType === 'PLUS' ? ' as + Title' : ' as Sequence';
  const action = previous ? `Moved ${normalizedCard.name} from Spot ${previous.position} to Spot ${targetPosition}${titleMode}.` : `Added ${normalizedCard.name} to Spot ${targetPosition}${titleMode}.`;
  setMappingEditorStatus(`${action} Save This Mapping when you are finished.`);
  if (!fromLibrary) renderBoardMappingEditor();
  return { changed: true, message: action, card: normalizedCard };
}

function removeCardFromMapping(cardId, position) {
  const spot = mappingEditorSpot(position);
  const normalizedId = Number(cardId);
  if (!spot || !state.mappingEditor?.editable) return;
  if (normalizedId === Number(spot.anchorCardId)) {
    setMappingEditorStatus(`Spot ${position}'s displayed anchor is locked. Change that position from Break Board if you need a different anchor.`);
    return;
  }
  const index = spot.cards.findIndex(card => Number(card.id) === normalizedId);
  if (index < 0) return;
  const [removed] = spot.cards.splice(index, 1);
  state.mappingDraftDirty = true;
  setMappingEditorStatus(`Removed ${removed.name} from Spot ${position}. It is now unassigned and can be added from the Riftbound Library.`);
  renderBoardMappingEditor();
}

function renderMappingLibraryMode() {
  if (!elements.mappingLibraryMode) return;
  const target = mappingEditorSpot(state.mappingLibraryTargetPosition);
  const active = Boolean(target && state.mappingEditor?.editable && state.view === 'library-riftbound');
  elements.mappingLibraryMode.classList.toggle('hidden', !active);
  if (!active) return;
  const modeLabel = state.mappingLibraryAdditionType === 'PLUS' ? '+ TITLE CARD' : 'SEQUENCE CARD';
  elements.mappingLibraryTitle.textContent = `${modeLabel} → ${state.mappingEditor.name} · Spot ${target.position}: ${mappingSpotDisplayLabel(target)}`;
  if (!String(elements.mappingLibraryFeedback.textContent || '').trim()) {
    elements.mappingLibraryFeedback.textContent = 'Click a card once to add or move it. Bright cards are already assigned somewhere on this board.';
  }
}

function renderBoardMappingEditor() {
  if (!elements.mappingBoardSelect) return;
  const editor = state.mappingEditor;
  const currentSlot = Number(editor?.slot || preferredMappingEditorSlot());
  elements.mappingBoardSelect.innerHTML = state.boardPresets.map(preset => {
    const details = preset.count
      ? `${preset.name || `Board ${preset.slot}`} · ${preset.count} spot${Number(preset.count) === 1 ? '' : 's'}${preset.customizedMapping ? ' · Custom map' : ''}`
      : `Board ${preset.slot} · Empty`;
    return `<option value="${Number(preset.slot)}">${escapeHtml(details + (preset.installWarning ? ' · UPDATE PENDING' : ''))}</option>`;
  }).join('');
  if (state.boardPresets.length) elements.mappingBoardSelect.value = String(currentSlot);
  if (elements.mappingBoardList) {
    elements.mappingBoardList.innerHTML = state.boardPresets.map(preset => {
      const selected = Number(preset.slot) === currentSlot;
      const stateLabel = !preset.count
        ? 'EMPTY'
        : preset.mappingMode === 'SINGLES'
          ? 'SINGLES · VIEW'
          : preset.gameCode !== 'RIFTBOUND'
            ? 'EXACT · VIEW'
            : preset.customizedMapping ? 'CUSTOM MAP' : 'BUILT-IN MAP';
      const detail = preset.installWarning || (preset.count ? `${Number(preset.count)} saved spot${Number(preset.count) === 1 ? '' : 's'}` : 'No saved positions');
      return `<button class="mapping-board-tile ${selected ? 'active' : ''}" type="button" data-mapping-board="${Number(preset.slot)}"><b>${String(preset.slot).padStart(2, '0')}</b><span><strong>${escapeHtml(preset.name || `Board ${preset.slot}`)}</strong><small>${escapeHtml(detail)}</small></span><i>${preset.installWarning ? 'UPDATE PENDING' : stateLabel}</i></button>`;
    }).join('');
    elements.mappingBoardList.querySelectorAll('[data-mapping-board]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      await chooseMappingEditorBoard(button.dataset.mappingBoard);
      button.disabled = false;
    }));
  }
  if (!editor) {
    elements.mappingEditorState.textContent = 'Loading board…';
    elements.mappingSpotCount.textContent = '0 spots';
    elements.mappingSpotList.innerHTML = '';
    elements.mappingSpotWorkspace.innerHTML = '<div class="mapping-empty"><b>Loading saved mapping</b><span>Please wait a moment.</span></div>';
    elements.mappingSave.disabled = true;
    elements.mappingReset.disabled = true;
    return;
  }
  if (!editor.spots.some(spot => Number(spot.position) === Number(state.mappingSelectedPosition))) {
    state.mappingSelectedPosition = Number(editor.spots[0]?.position || 0) || null;
  }
  const selected = mappingEditorSpot();
  elements.mappingEditorState.textContent = editor.editable
    ? (editor.customized ? 'CUSTOM MAP · EDITABLE' : 'BUILT-IN MAP · EDITABLE')
    : 'VIEW ONLY';
  elements.mappingEditorState.classList.toggle('customized', Boolean(editor.customized));
  elements.mappingSpotCount.textContent = `${editor.spots.length.toLocaleString()} spot${editor.spots.length === 1 ? '' : 's'} · ${editor.spots.reduce((sum, spot) => sum + spot.cards.length, 0).toLocaleString()} mapped cards`;
  elements.mappingSpotList.innerHTML = editor.spots.length
    ? editor.spots.map(spot => `<button class="mapping-spot-button ${Number(spot.position) === Number(state.mappingSelectedPosition) ? 'active' : ''}" type="button" data-mapping-spot="${Number(spot.position)}"><b>${String(spot.position).padStart(2, '0')}</b><span><strong>${escapeHtml(mappingSpotDisplayLabel(spot))}</strong><small>${spot.cards.length} exact card${spot.cards.length === 1 ? '' : 's'}</small></span></button>`).join('')
    : '<div class="mapping-list-empty">No saved positions</div>';
  elements.mappingSpotList.querySelectorAll('[data-mapping-spot]').forEach(button => {
    button.addEventListener('click', () => {
      state.mappingSelectedPosition = Number(button.dataset.mappingSpot);
      renderBoardMappingEditor();
    });
    if (editor.editable) {
      button.addEventListener('dragover', event => { event.preventDefault(); button.classList.add('drag-target'); });
      button.addEventListener('dragleave', () => button.classList.remove('drag-target'));
      button.addEventListener('drop', event => {
        event.preventDefault();
        button.classList.remove('drag-target');
        const cardId = Number(event.dataTransfer?.getData('text/mapping-card-id'));
        if (cardId) moveCardInMapping(cardId, Number(button.dataset.mappingSpot));
      });
    }
  });
  if (!selected) {
    elements.mappingSpotWorkspace.innerHTML = `<div class="mapping-empty"><b>${escapeHtml(editor.name)}</b><span>${escapeHtml(editor.reason || 'This saved board has no positions to edit.')}</span></div>`;
  } else {
    const displayLabel = mappingSpotDisplayLabel(selected);
    const moveOptions = editor.spots.map(spot => `<option value="${spot.position}" ${Number(spot.position) === Number(selected.position) ? 'selected' : ''}>Spot ${String(spot.position).padStart(2, '0')} · ${escapeHtml(mappingSpotDisplayLabel(spot))}</option>`).join('');
    elements.mappingSpotWorkspace.innerHTML = `
      <div class="mapping-workspace-head">
        <div><span>BUYER SPOT ${String(selected.position).padStart(2, '0')}</span><h4>${escapeHtml(displayLabel)}</h4><small>${selected.cards.length} exact mapped card${selected.cards.length === 1 ? '' : 's'} · first card / map: ${escapeHtml(selected.anchorCard?.name || 'Unknown')}</small></div>
        ${editor.editable ? `<div class="mapping-workspace-add"><button class="secondary-button mapping-add-sequence" type="button">＋ Add Sequence Card</button><button class="primary-button mapping-add-plus" type="button">＋ Add + Title Card</button></div>` : ''}
      </div>
      <label class="mapping-label-editor">Base Whatnot / Buyer Bag spot name<input id="mapping-spot-label" maxlength="180" value="${escapeHtml(selected.label)}" ${editor.editable ? '' : 'disabled'} /><small>Sequence cards stay hidden from this title. + Title cards are appended once automatically.</small></label>
      ${editor.reason ? `<p class="mapping-view-note">${escapeHtml(editor.reason)}</p>` : ''}
      <div class="mapping-card-grid">${selected.cards.map(card => {
        const anchor = Number(card.id) === Number(selected.anchorCardId);
        return `<article class="mapping-card ${anchor ? 'anchor' : ''}" data-mapping-card="${Number(card.id)}" draggable="${editor.editable && !anchor ? 'true' : 'false'}">
          <div class="mapping-card-art">${card.imageUrl ? `<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)}" />` : '<span>◈</span>'}${card.badge ? `<i title="${escapeHtml(card.badgeLabel)}">${escapeHtml(card.badge)}</i>` : ''}</div>
          <div class="mapping-card-copy"><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(mappingCardFacts(card))}</span>${anchor ? '<b>🔒 FIRST CARD · MAP / ANCHOR</b>' : card.additionType === 'PLUS' ? '<b>＋ TITLE CARD · NAME SHOWS ON LIST</b>' : '<b>→ SEQUENCE CARD · TITLE STAYS CLEAN</b>'}</div>
          ${editor.editable && !anchor ? `<div class="mapping-card-actions"><label>Addition type<select data-mapping-card-type="${Number(card.id)}"><option value="SEQUENCE" ${card.additionType === 'PLUS' ? '' : 'selected'}>Sequence · mapped only</option><option value="PLUS" ${card.additionType === 'PLUS' ? 'selected' : ''}>+ Title · show card name</option></select></label><label>Move<select data-mapping-move-card="${Number(card.id)}">${moveOptions}</select></label><button class="mapping-remove-card" type="button" data-mapping-remove-card="${Number(card.id)}">Remove</button></div>` : ''}
        </article>`;
      }).join('')}</div>`;
    elements.mappingSpotWorkspace.querySelector('#mapping-spot-label')?.addEventListener('input', event => {
      const value = String(event.target.value || '').replace(/\s+/g, ' ').trimStart().slice(0, 180);
      selected.label = value;
      state.mappingDraftDirty = true;
      setMappingEditorStatus('Spot name changed. Save This Mapping when you are finished.');
      const listLabel = elements.mappingSpotList.querySelector(`[data-mapping-spot="${selected.position}"] strong`);
      if (listLabel) listLabel.textContent = mappingSpotDisplayLabel(selected);
      elements.mappingSpotWorkspace.querySelector('.mapping-workspace-head h4').textContent = mappingSpotDisplayLabel(selected);
    });
    const openMappingLibrary = async additionType => {
      state.mappingLibraryTargetPosition = Number(selected.position);
      state.mappingLibraryAdditionType = additionType;
      if (elements.mappingLibraryFeedback) elements.mappingLibraryFeedback.textContent = additionType === 'PLUS'
        ? 'Click a card once. Its name will be added to the public/listing title and it will be mapped to this spot.'
        : 'Click a card once. It will join this spot’s exact pull sequence without changing the public/listing title.';
      await setView('library-riftbound');
    };
    elements.mappingSpotWorkspace.querySelector('.mapping-add-sequence')?.addEventListener('click', () => openMappingLibrary('SEQUENCE'));
    elements.mappingSpotWorkspace.querySelector('.mapping-add-plus')?.addEventListener('click', () => openMappingLibrary('PLUS'));
    elements.mappingSpotWorkspace.querySelectorAll('[data-mapping-remove-card]').forEach(button => button.addEventListener('click', () => removeCardFromMapping(button.dataset.mappingRemoveCard, selected.position)));
    elements.mappingSpotWorkspace.querySelectorAll('[data-mapping-move-card]').forEach(select => select.addEventListener('change', () => moveCardInMapping(select.dataset.mappingMoveCard, select.value)));
    elements.mappingSpotWorkspace.querySelectorAll('[data-mapping-card-type]').forEach(select => select.addEventListener('change', () => {
      const card = selected.cards.find(item => Number(item.id) === Number(select.dataset.mappingCardType));
      if (!card) return;
      card.additionType = select.value === 'PLUS' ? 'PLUS' : 'SEQUENCE';
      state.mappingDraftDirty = true;
      setMappingEditorStatus(`${card.name} is now a ${card.additionType === 'PLUS' ? '+ Title' : 'Sequence'} card. Save This Mapping when you are finished.`);
      renderBoardMappingEditor();
    }));
    elements.mappingSpotWorkspace.querySelectorAll('[draggable="true"][data-mapping-card]').forEach(card => {
      card.addEventListener('dragstart', event => {
        event.dataTransfer?.setData('text/mapping-card-id', card.dataset.mappingCard);
        event.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
  }
  elements.mappingSave.disabled = !editor.editable || !state.mappingDraftDirty;
  elements.mappingReset.disabled = !editor.editable || !editor.customized;
  if (state.mappingEditorStatus) elements.mappingEditorStatus.textContent = state.mappingEditorStatus;
  else elements.mappingEditorStatus.textContent = editor.reason || (editor.customized
    ? 'This saved board has its own custom exact-card mapping. Changes remain a draft until you save.'
    : 'Showing the current built-in mapping. Make a change, then save it as this board\'s custom map.');
}

async function loadBoardMappingEditor(slot = preferredMappingEditorSlot()) {
  if (!state.boardPresets.length) state.boardPresets = await window.breakSuite.getBreakBoardPresets();
  const normalizedSlot = Number(slot || preferredMappingEditorSlot());
  state.mappingEditor = null;
  state.mappingSelectedPosition = null;
  state.mappingDraftDirty = false;
  state.mappingEditorStatus = '';
  renderBoardMappingEditor();
  state.mappingEditor = await window.breakSuite.getBoardMappingEditor(normalizedSlot);
  state.mappingSelectedPosition = Number(state.mappingEditor.spots?.[0]?.position || 0) || null;
  renderBoardMappingEditor();
  return state.mappingEditor;
}

async function chooseMappingEditorBoard(value) {
  const previousSlot = Number(state.mappingEditor?.slot || 0);
  const nextSlot = Number(value);
  if (!nextSlot || nextSlot === previousSlot) return true;
  if (state.mappingDraftDirty && !window.confirm('Discard the unsaved mapping changes and open another saved board?')) {
    renderBoardMappingEditor();
    return false;
  }
  try {
    await loadBoardMappingEditor(nextSlot);
    return true;
  } catch (error) {
    setMappingEditorStatus(error.message || 'That saved board mapping could not be opened.');
    renderBoardMappingEditor();
    return false;
  }
}

async function loadFrameStudio() {
  await loadOverlayStyle();
  if (!state.mappingEditor || !state.mappingDraftDirty) await loadBoardMappingEditor(state.mappingEditor?.slot || preferredMappingEditorSlot());
  else renderBoardMappingEditor();
}

function emptyPreview() {
  elements.preview.innerHTML = '<div class="empty-preview"><div><b>Choose a card</b><span>Its official catalog details and cached image will appear here.</span></div></div>';
}

async function refreshOverview() {
  const data = await window.breakSuite.getOverview(state.game);
  elements.total.textContent = data.total.toLocaleString();
  elements.saved.textContent = data.saved.toLocaleString();
  elements.sets.textContent = data.sets.toLocaleString();
}

async function refreshCatalogSets() {
  state.catalogSets = await window.breakSuite.getCatalogSets();
  const visibleSets = state.catalogSets.filter(set => set.game_code === state.game);
  elements.set.innerHTML = `<option value="All">All sets</option>${visibleSets.map(set => `<option value="${escapeHtml(set.set_code)}">${escapeHtml(set.set_code)} — ${escapeHtml(set.set_name)} (${Number(set.imported_cards).toLocaleString()})</option>`).join('')}`;
  if (!visibleSets.some(set => set.set_code === state.setCode)) state.setCode = 'All';
  elements.set.value = state.setCode;
  elements.setBox?.classList.toggle('hidden', isOnePieceLibrary());
  const riftbound = state.catalogSets.filter(set => set.game_code === 'RIFTBOUND');
  elements.riftboundSetList.innerHTML = riftbound.map(set => `<div class="riftbound-set-row"><b>${escapeHtml(set.set_code)}</b><strong>${escapeHtml(set.product_name)}</strong><span>${Number(set.imported_cards).toLocaleString()} cards imported</span></div>`).join('');
  refreshCardListSetOptions();
}

async function refreshRarityOptions() {
  const selected = state.rarity;
  const rarities = await window.breakSuite.getRarities(state.game, state.setCode);
  elements.rarity.innerHTML = `<option value="All">All</option>${rarities.map(rarity => `<option value="${escapeHtml(rarity.filter)}">${escapeHtml(rarity.label)} (${rarity.count.toLocaleString()})</option>`).join('')}`;
  const isStillAvailable = selected === 'All' || rarities.some(rarity => rarity.filter === selected);
  state.rarity = isStillAvailable ? selected : 'All';
  elements.rarity.value = state.rarity;
}

function refreshCardListSetOptions() {
  if (!elements.cardListSet) return;
  const game = String(state.cardListGame || state.game || 'RIFTBOUND').toUpperCase();
  const sets = state.catalogSets.filter(set => String(set.game_code || '').toUpperCase() === game);
  const preferred = state.cardListSetCode
    || (state.game === game && state.setCode !== 'All' ? state.setCode : '')
    || sets[0]?.set_code
    || '';
  state.cardListSetCode = sets.some(set => set.set_code === preferred) ? preferred : (sets[0]?.set_code || '');
  elements.cardListGame.value = game;
  elements.cardListSet.innerHTML = sets.length
    ? sets.map(set => `<option value="${escapeHtml(set.set_code)}">${escapeHtml(set.set_code)} — ${escapeHtml(set.set_name || set.product_name || 'Imported set')}</option>`).join('')
    : '<option value="">No imported sets</option>';
  elements.cardListSet.value = state.cardListSetCode;
}

function cardListPriceMarkup(card) {
  if (!state.cardListShowPrices) return '';
  const raw = card.market_price_cents;
  const matched = raw !== null && raw !== undefined && Number.isInteger(Number(raw)) && Number(raw) >= 0;
  if (!matched) return '<div class="card-list-result-price unpriced"><b>Not priced</b><small>Use Price This List</small></div>';
  const source = String(card.market_price_source || 'Saved price').trim();
  const checked = card.market_price_updated_at ? formatHistoryDate(card.market_price_updated_at) : '';
  return `<div class="card-list-result-price"><b>${escapeHtml(formatExactCurrency(Number(raw)))}</b><small>${escapeHtml([source, checked].filter(Boolean).join(' · '))}</small></div>`;
}

function renderCardListResults() {
  if (!elements.cardListBody) return;
  elements.cardListBody.classList.toggle('hidden', !state.cardListOpen);
  elements.cardListToggle.textContent = state.cardListOpen ? 'Close Card List Search' : 'Open Card List Search';
  elements.cardListToggle.setAttribute('aria-expanded', String(state.cardListOpen));
  elements.cardListShowPrices.checked = Boolean(state.cardListShowPrices);
  elements.cardListPrice.disabled = !state.cardListCards.length || state.cardListPriceStatus?.type === 'loading';
  elements.cardListPrice.textContent = state.cardListPriceStatus?.type === 'loading' ? 'Pricing…' : 'Price This List';
  const status = state.cardListPriceStatus?.message || state.cardListStatus || 'Paste card numbers to begin.';
  elements.cardListStatus.textContent = status;
  elements.cardListStatus.className = `card-list-status ${state.cardListPriceStatus?.type === 'error' || /^Error:/i.test(status) ? 'error' : state.cardListCards.length ? 'success' : ''}`;
  if (state.cardListUnmatched.length) {
    elements.cardListMissing.classList.remove('hidden');
    elements.cardListMissing.innerHTML = `<b>Not found in ${escapeHtml(state.cardListSetCode || 'the selected set')}:</b> ${state.cardListUnmatched.map(escapeHtml).join(', ')}`;
  } else {
    elements.cardListMissing.classList.add('hidden');
    elements.cardListMissing.textContent = '';
  }
  elements.cardListResults.innerHTML = state.cardListCards.map(card => {
    const facts = [card.set_code, card.card_number, card.rarity, card.collector_treatment || 'Standard'].filter(Boolean).join(' · ');
    const art = card.image_url
      ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name)}" loading="lazy" decoding="async" />`
      : '<span>◇</span>';
    return `<button class="card-list-result" type="button" data-card-list-id="${Number(card.id)}" title="Open ${escapeHtml(card.name)} in the Library details panel"><span class="card-list-result-number">${escapeHtml(card.card_number || '—')}</span><div class="card-list-result-art">${art}</div><div class="card-list-result-copy"><strong>${escapeHtml(card.name || 'Unnamed card')}</strong><span>${escapeHtml(facts || 'Exact card printing')}</span>${cardListPriceMarkup(card)}</div></button>`;
  }).join('');
  elements.cardListResults.querySelectorAll('[data-card-list-id]').forEach(button => button.addEventListener('click', () => {
    state.selectedId = Number(button.dataset.cardListId);
    renderPreview();
    elements.preview?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

async function runCardListSearch({ preservePriceStatus = false } = {}) {
  const references = CardListSearch?.parseCardReferences(elements.cardListInput.value) || [];
  if (!state.cardListSetCode) {
    state.cardListStatus = 'Error: choose an imported set first.';
    state.cardListCards = [];
    state.cardListUnmatched = [];
    renderCardListResults();
    return;
  }
  if (!references.length) {
    state.cardListStatus = 'Error: paste at least one card number, such as 116 or OGN-039a.';
    state.cardListCards = [];
    state.cardListUnmatched = [];
    renderCardListResults();
    return;
  }
  if (!preservePriceStatus) state.cardListPriceStatus = null;
  state.cardListStatus = `Searching ${state.cardListSetCode} for ${references.length.toLocaleString()} card number${references.length === 1 ? '' : 's'}…`;
  elements.cardListView.disabled = true;
  renderCardListResults();
  try {
    const catalog = await window.breakSuite.getCards({ query: '', game: state.cardListGame, setCode: state.cardListSetCode, rarity: 'All', savedOnly: false });
    const result = CardListSearch.matchCardReferences(references, catalog);
    state.cardListCards = result.matches;
    state.cardListUnmatched = result.unmatched;
    state.cardListStatus = result.matches.length
      ? `✓ Showing ${result.matches.length.toLocaleString()} exact English card${result.matches.length === 1 ? '' : 's'} in the same order you pasted them${result.unmatched.length ? ` · ${result.unmatched.length.toLocaleString()} not found` : ''}.`
      : `Error: none of those card numbers were found in ${state.cardListSetCode}.`;
  } catch (error) {
    state.cardListCards = [];
    state.cardListUnmatched = references.map(reference => reference.raw);
    state.cardListStatus = `Error: ${error.message || 'the card list could not be searched.'}`;
  } finally {
    elements.cardListView.disabled = false;
    renderCardListResults();
  }
}

function clearCardListSearch() {
  elements.cardListInput.value = '';
  state.cardListCards = [];
  state.cardListUnmatched = [];
  state.cardListStatus = 'Paste card numbers to begin.';
  state.cardListPriceStatus = null;
  renderCardListResults();
  elements.cardListInput.focus();
}

function displayDetails(card) {
  if (card.game_code === 'RIFTBOUND') {
    return [
      ['Card number', card.card_number],
      ['Official rarity', card.rarity],
      ['Collector treatment', card.collector_treatment || 'Standard'],
      ['Card type', card.card_type],
      ['Cost', card.cost],
      ['Power', card.power],
      ['Color', card.color],
      ['Set', card.set_name || card.set_code]
    ].filter(([, value]) => value).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  }
  const classification = card.manual_category || (card.variant === 'Alternate Art' ? 'Alternate Art' : '');
  const rarityDetails = classification
    ? [['Rarity', card.break_rarity], ['Official rarity', card.rarity]]
    : [['Rarity', card.break_rarity || card.rarity]];
  return [
    ['Card number', card.card_number],
    ...rarityDetails,
    ['Classification', classification || 'Standard'],
    ['Card type', card.card_type],
    ['Life', card.life],
    ['Cost', card.cost],
    ['Attribute', card.attribute],
    ['Power', card.power],
    ['Counter', card.counter],
    ['Color', card.color],
    ['Block', card.block_icon],
    ['Type', card.card_traits],
    ['Card set', card.set_name || card.set_code]
  ].filter(([, value]) => value).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
}

function riftboundCardFacts(card) {
  const number = String(card.card_number || '').replace(new RegExp(`^${String(card.set_code || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-\\s]?`, 'i'), '');
  return `<div class="riftbound-card-facts">
    <span><small>SET</small><b>${escapeHtml(card.set_code || '—')}</b></span>
    <span><small>CARD NO.</small><b>${escapeHtml(number || '—')}</b></span>
    <span><small>RARITY</small><b>${escapeHtml(card.rarity || '—')}</b></span>
    <span><small>TREATMENT</small><b>${escapeHtml(card.collector_treatment || 'Standard')}</b></span>
  </div>`;
}

async function renderPreview() {
  const mappingTarget = mappingEditorSpot(state.mappingLibraryTargetPosition);
  if (mappingTarget && state.mappingEditor?.editable && state.view === 'library-riftbound') {
    const ownerCount = mappingOwnership().size;
    const additionLabel = state.mappingLibraryAdditionType === 'PLUS' ? '+ TITLE' : 'SEQUENCE';
    elements.preview.innerHTML = `<div class="mapping-library-preview"><p class="eyebrow">ADDING ${additionLabel} CARD</p><b>Spot ${String(mappingTarget.position).padStart(2, '0')}</b><h3>${escapeHtml(mappingSpotDisplayLabel(mappingTarget))}</h3><p>Click any Library card once. An unassigned card is added here; a card mapped somewhere else moves here automatically.</p><div><strong>${mappingTarget.cards.length}</strong><span>cards in this spot</span></div><div><strong>${ownerCount}</strong><span>cards mapped on this board</span></div><small>${state.mappingLibraryAdditionType === 'PLUS' ? 'The selected card name will appear once in the listing title.' : 'The selected card joins the pull sequence without adding another + name to the listing title.'} Bright cards are already selected; gold 🔒 badges are locked map anchors.</small><button class="primary-button" id="mapping-preview-return" type="button">← Return to Mapping Editor</button></div>`;
    document.querySelector('#mapping-preview-return')?.addEventListener('click', () => elements.mappingLibraryReturn?.click());
    return;
  }
  if (!state.selectedId) return emptyPreview();
  const card = await window.breakSuite.getCard(state.selectedId);
  if (!card) { state.selectedId = null; return emptyPreview(); }
  const art = card.image_url
    ? `<img class="${isProductOnlyDon(card) ? 'product-card-image' : ''}" src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name)}" />`
    : (/DON!!/i.test(card.name)
      ? '<div class="fallback-art product-only-preview"><b>DON!!</b><span>Supplemental DON!! printing</span><small>This record is saved locally. Its picture will appear after the local image cache finishes.</small></div>'
      : '<div class="fallback-art">♧</div>');
  const effect = card.effect_text ? `<p class="card-effect"><b>Effect</b>${escapeHtml(card.effect_text)}</p>` : '';
  const isAlternateArt = card.variant === 'Alternate Art';
  const automaticTreatment = card.variant || 'Standard';
  const manualTreatment = card.manual_category || '';
  const currentClassification = card.manual_category || (isAlternateArt ? 'Alternate Art' : '');
  const classificationText = currentClassification
    ? `${card.break_rarity} · ${currentClassification}`
    : 'Standard official printing';
  const boardAction = `<button class="board-button ${card.is_on_board ? 'selected' : ''}" id="toggle-break-board">${card.is_on_board ? '✓ Remove from Break Board' : '＋ Add to Break Board'}</button>`;
  const onePieceActions = isOnePieceLibrary() ? `
    <section class="variant-control">
      <p class="eyebrow">SET BREAK RARITY</p>
      <strong>${escapeHtml(classificationText)}</strong>
      <span>This replaces the card's break rarity in your One Piece library. Its official Bandai rarity is kept for reference.</span>
      <label class="classification-label" for="card-classification">Break rarity
        <select id="card-classification">
          <option value="">Standard — use official rarity</option>
          <option value="Alternate Art">Alternate Art</option>
          <option value="Manga">MANGA</option>
          <option value="Gold DON!!">GOLD DON!!</option>
        </select>
      </label>
      <button class="variant-button" id="save-classification">Save Break Rarity</button>
    </section>
    ${boardAction}
    <button class="secondary-button" id="add-to-live-chasers">＋ Add to Live Chasers</button>
    <button class="secondary-button" id="add-to-royal-chasers">♛ Add to Royal Chasers</button>
    <button class="save-button" id="save-card">${card.is_saved ? '♥ Remove from One Piece Saved Cards' : '♡ Save One Piece Card'}</button>` : `
    <section class="variant-control">
      <p class="eyebrow">RIFTBOUND COLLECTOR TREATMENT</p>
      <strong>${escapeHtml(card.collector_treatment || 'Standard')}</strong>
      <span>Automatically recognized from the official card number. You can correct the treatment manually without changing the official functional rarity.</span>
      <label class="classification-label" for="riftbound-treatment">Collector treatment
        <select id="riftbound-treatment">
          <option value="">Automatic — ${escapeHtml(automaticTreatment)}</option>
          <option value="Standard">Standard</option>
          <option value="Alternate Art">Alternate Art</option>
          <option value="Overnumbered">Overnumbered</option>
          <option value="Signature">Signature</option>
        </select>
      </label>
      <button class="variant-button" id="save-riftbound-treatment">Save Collector Treatment</button>
    </section>
    ${boardAction}`;
  elements.preview.innerHTML = `
    <div class="preview-art">${art}</div>
    <p class="eyebrow">${escapeHtml(card.set_code || card.game_name || 'OFFICIAL CARD')}</p>
    <h3>${escapeHtml(card.name)}</h3>
    <dl class="card-meta">${displayDetails(card)}</dl>
    ${effect}
    ${onePieceActions}
    <button class="official-link" id="official-card-link">Open card source ↗</button>`;
  document.querySelector('#save-card')?.addEventListener('click', async () => {
    await window.breakSuite.setSaved(card.id, !card.is_saved);
    await refreshOverview();
    await refreshCards();
  });
  if (document.querySelector('#card-classification')) document.querySelector('#card-classification').value = currentClassification;
  if (document.querySelector('#riftbound-treatment')) document.querySelector('#riftbound-treatment').value = manualTreatment;
  document.querySelector('#save-classification')?.addEventListener('click', async () => {
    const control = document.querySelector('#save-classification');
    control.disabled = true;
    try {
      await window.breakSuite.setClassification(card.id, document.querySelector('#card-classification').value);
      await refreshRarityOptions();
      await refreshCards();
    } finally {
      control.disabled = false;
    }
  });
  document.querySelector('#save-riftbound-treatment')?.addEventListener('click', async () => {
    const control = document.querySelector('#save-riftbound-treatment');
    control.disabled = true;
    try {
      await window.breakSuite.setRiftboundTreatment(card.id, document.querySelector('#riftbound-treatment').value);
      await refreshRarityOptions();
      await refreshCards();
    } finally {
      control.disabled = false;
    }
  });
  document.querySelector('#toggle-break-board')?.addEventListener('click', async () => {
    const control = document.querySelector('#toggle-break-board');
    control.disabled = true;
    try {
      await window.breakSuite.setBreakBoardCard(card.id, !card.is_on_board);
      await refreshBreakBoard();
      await refreshCards();
    } finally {
      control.disabled = false;
    }
  });
  document.querySelector('#add-to-live-chasers')?.addEventListener('click', async () => {
    await window.breakSuite.setChaserCard(card.id);
    document.querySelector('#add-to-live-chasers').textContent = '✓ Added to Live Chasers';
  });
  document.querySelector('#add-to-royal-chasers')?.addEventListener('click', async () => {
    await window.breakSuite.setRoyalChaserCard(card.id);
    document.querySelector('#add-to-royal-chasers').textContent = '✓ Added to Royal Chasers';
  });
  document.querySelector('#official-card-link').addEventListener('click', () => window.breakSuite.openExternal(card.detail_url));
}

function renderGrid() {
  const cards = state.cards;
  const visibleCards = cards.slice(0, state.catalogVisibleCount);
  const mappingTarget = mappingEditorSpot(state.mappingLibraryTargetPosition);
  const mappingMode = Boolean(mappingTarget && state.mappingEditor?.editable && state.view === 'library-riftbound');
  const mappingOwners = mappingMode ? mappingOwnership() : new Map();
  renderMappingLibraryMode();
  if (mappingMode && elements.quickAddHint) elements.quickAddHint.textContent = 'One click adds or moves a card · bright outline means it is already mapped';
  const hasActiveFilter = Boolean(state.query.trim()) || state.setCode !== 'All' || state.rarity !== 'All';
  const activeFilters = [state.setCode !== 'All' ? state.setCode : '', state.rarity !== 'All' ? state.rarity : ''].filter(Boolean);
  elements.gridTitle.textContent = mappingMode
    ? `Choose Cards for Spot ${String(mappingTarget.position).padStart(2, '0')}`
    : state.savedOnly ? 'Saved Cards' : (state.setCode !== 'All' ? `${state.setCode} Cards` : 'All Cards');
  elements.gridCount.textContent = cards.length
    ? `${visibleCards.length.toLocaleString()} of ${cards.length.toLocaleString()} card${cards.length === 1 ? '' : 's'} shown${activeFilters.length ? ` · Filter: ${activeFilters.join(' · ')}` : ''}`
    : (hasActiveFilter ? `No cards match${activeFilters.length ? ` · Filter: ${activeFilters.join(' · ')}` : ' the current filters'}` : 'Waiting for official import');
  if (!cards.length) {
    const emptyTitle = state.savedOnly ? 'No saved cards yet' : (hasActiveFilter ? 'No cards match those filters' : 'Your catalog is ready for its official import');
    const emptyCopy = state.savedOnly ? 'Save any official card and it will stay easy to find here.' : (hasActiveFilter ? 'Try another rarity or clear the filters to return to the full official catalog.' : 'Use Import Manager to download the official Bandai card list. Every card and image will be saved locally as it downloads.');
    const emptyAction = state.savedOnly ? '<button class="text-button" id="show-library">Browse the library</button>' : (hasActiveFilter ? '<button class="text-button" id="clear-empty-filters">Clear filters</button>' : '<button class="text-button" id="show-import">Open Import Manager</button>');
    elements.grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⇣</div><h3>${emptyTitle}</h3><p>${emptyCopy}</p>${emptyAction}</div>`;
    document.querySelector('#show-import')?.addEventListener('click', () => setView('import'));
    document.querySelector('#show-library')?.addEventListener('click', () => setView('library-onepiece'));
    document.querySelector('#clear-empty-filters')?.addEventListener('click', () => document.querySelector('#clear-filters').click());
    emptyPreview();
    return;
  }
  elements.grid.innerHTML = visibleCards.map(card => {
    const owner = mappingOwners.get(Number(card.id));
    const mappingClasses = owner
      ? `mapping-owned ${owner.position === Number(mappingTarget?.position) ? 'mapping-target-owned' : ''} ${owner.anchor ? 'mapping-anchor-locked' : ''}`
      : '';
    const title = mappingMode
      ? owner?.anchor && owner.position !== Number(mappingTarget.position)
        ? `Locked anchor for Spot ${owner.position}`
        : owner?.position === Number(mappingTarget.position)
          ? `Already assigned to Spot ${owner.position} as ${owner.additionType === 'PLUS' ? '+ Title' : 'Sequence'}`
          : owner
            ? `Click to move from Spot ${owner.position} to Spot ${mappingTarget.position}`
            : `Click to add to Spot ${mappingTarget.position}`
      : `Click for details. Double-click to ${card.is_on_board ? 'remove from' : 'add to'} the ${state.game === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'} Break Board.`;
    const ownerBadge = mappingMode && owner
      ? `<span class="mapping-library-owner ${owner.anchor ? 'locked' : ''}">${owner.anchor ? '🔒' : owner.additionType === 'PLUS' ? '+' : '→'} SPOT ${String(owner.position).padStart(2, '0')}</span>`
      : '';
    return `<button class="card-tile ${card.id === state.selectedId && !mappingMode ? 'active' : ''} ${card.is_on_board ? 'on-break-board' : ''} ${mappingClasses}" data-card-id="${card.id}" aria-label="${escapeHtml(card.name)}" title="${escapeHtml(title)}">${ownerBadge}${cardImage(card.image_url, card.name, isProductOnlyDon(card))}<div class="card-copy">${card.game_code === 'RIFTBOUND' ? `<strong title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</strong>${riftboundCardFacts(card)}` : `<span>${escapeHtml([card.set_code, card.card_number, card.break_rarity || card.rarity].filter(Boolean).join(' · '))}</span>`}</div></button>`;
  }).join('')
    + (visibleCards.length < cards.length ? `<button class="catalog-load-more" id="catalog-load-more">Load ${Math.min(CATALOG_PAGE_SIZE, cards.length - visibleCards.length).toLocaleString()} more cards <span>${(cards.length - visibleCards.length).toLocaleString()} remaining</span></button>` : '');
  elements.grid.querySelectorAll('[data-card-id]').forEach(tile => {
    tile.addEventListener('click', () => {
      if (mappingMode) {
        const card = state.cards.find(candidate => Number(candidate.id) === Number(tile.dataset.cardId));
        const result = moveCardInMapping(card || Number(tile.dataset.cardId), mappingTarget.position, { fromLibrary: true });
        if (elements.mappingLibraryFeedback) elements.mappingLibraryFeedback.textContent = result.message;
        renderGrid();
        renderPreview();
        return;
      }
      state.selectedId = Number(tile.dataset.cardId);
      elements.grid.querySelectorAll('[data-card-id]').forEach(cardTile => cardTile.classList.toggle('active', cardTile === tile));
      renderPreview();
    });
    tile.addEventListener('dblclick', async event => {
      event.preventDefault();
      if (mappingMode) return;
      const cardId = Number(tile.dataset.cardId);
      const card = state.cards.find(candidate => candidate.id === cardId);
      if (!card) return;
      tile.disabled = true;
      try {
        await window.breakSuite.setBreakBoardCard(cardId, !card.is_on_board);
        await refreshBreakBoard();
        await refreshCards();
      } finally {
        tile.disabled = false;
      }
    });
  });
  document.querySelector('#catalog-load-more')?.addEventListener('click', () => {
    state.catalogVisibleCount += CATALOG_PAGE_SIZE;
    renderGrid();
  });
  renderMappingLibraryMode();
}

async function refreshCards() {
  state.cards = await window.breakSuite.getCards({ query: state.query, game: state.game, setCode: state.setCode, rarity: state.rarity, savedOnly: state.savedOnly });
  state.catalogVisibleCount = CATALOG_PAGE_SIZE;
  if (state.selectedId && !state.cards.some(card => card.id === state.selectedId)) state.selectedId = null;
  renderGrid();
  renderPreview();
}

function riftboundListingTitleSymbol(card = {}) {
  const explicit = String(card.break_listing_symbol || '').trim();
  if (['💎', '🔥', '💣', '⭐', '⚡', '🌹', '💀', '💗', '🚧'].includes(explicit)) return explicit;
  const treatment = String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
  if (treatment === 'SIGNATURE') return '💎';
  const artVariant = String(card.riftbound_art_variant || card.art_variant || card.artVariant || '').trim().toUpperCase();
  const rarity = String(card.break_rarity || card.rarity || card.source_rarity || '').trim().toUpperCase();
  if (artVariant === 'ULTIMATE' || treatment === 'ULTIMATE' || (rarity === 'ULTIMATE' && treatment !== 'OVERNUMBERED')) return '💀';
  if (treatment === 'OVERNUMBERED') return '🔥';
  if (['ALTERNATE ART', 'ALT ART', 'SHOWCASE'].includes(treatment)) return '💣';
  if (rarity === 'EPIC') return '⭐';
  if (rarity === 'RARE') return '⚡';
  return rarity === 'SHOWCASE' ? '💣' : '';
}

function decoratedRiftboundListingTitle(card = {}, title = '') {
  const normalizedTitle = String(title || 'Untitled card').replace(/💗/gu, '⭐').replace(/🚧/gu, '⚡').replace(/\s+/g, ' ').trim() || 'Untitled card';
  if (card.custom_break_mapping && /[💎🔥💣⭐⚡🌹💀]/u.test(normalizedTitle)) return normalizedTitle;
  const cleanTitle = normalizedTitle.replace(/[💎🔥💣⭐⚡🌹💀]/gu, ' ').replace(/\s+/g, ' ').trim() || 'Untitled card';
  const symbol = riftboundListingTitleSymbol(card);
  return symbol ? `${symbol} ${cleanTitle} ${symbol}` : cleanTitle;
}

function formatBreakListing(cards) {
  return [...cards].sort((left, right) => left.position - right.position).map((card, index) => {
    const position = Number(card.position) || index + 1;
    const rarity = card.break_rarity || card.rarity;
    const treatment = card.collector_treatment || '';
    const gameCode = String(card.game_code || '').toUpperCase() === 'RIFTBOUND' ? 'RIFTBOUND' : 'ONEPIECE';
    const mappedLabel = String(card.break_spot_label || '').trim();
    const spotName = gameCode === 'RIFTBOUND'
      ? `${position} — ${decoratedRiftboundListingTitle(card, mappedLabel || String(card.name || 'Untitled card').split(',')[0].trim())}`
      : `${position} — ${card.name}${rarity ? ` ${rarity}` : ''}${treatment ? ` ${treatment.toUpperCase()}` : ''}`;
    const description = state.listingDescriptions[gameCode] || '';
    return `${spotName}\t${description}`;
  }).join('\n');
}

function readyCheck(label, complete) {
  return `<div class="ready-check ${complete ? 'done' : ''}"><i>${complete ? '✓' : '○'}</i><span>${escapeHtml(label)}</span></div>`;
}

const BREAKER_PRIORITY_GROUPS = [
  { key: 'MANGA', label: 'Manga', matches: rarity => rarity === 'MANGA' },
  { key: 'SP', label: 'SP', matches: rarity => rarity === 'SP' },
  { key: 'SEC', label: 'Secret Rare', matches: rarity => rarity === 'SEC' },
  { key: 'SEC_AA', label: 'Secret Rare Alternate Art', matches: rarity => rarity === 'SEC AA' },
  { key: 'SR_AA', label: 'SR Alternate Art', matches: rarity => rarity === 'SR AA' },
  { key: 'SR', label: 'Super Rare', matches: rarity => rarity === 'SR' },
  { key: 'R_AA', label: 'Rare Alternate Art', matches: rarity => rarity === 'R AA' },
  { key: 'L_AA', label: 'Leader Alternate Art', matches: rarity => rarity === 'L AA' },
  { key: 'GOLD_DON', label: 'Gold DON!!', matches: rarity => rarity === 'GOLD DON!!' },
  { key: 'TR', label: 'Treasure Rare', matches: rarity => rarity === 'TR' },
  { key: 'LEFTOVERS', label: 'Leftovers', matches: () => false }
];

const BREAKER_TOP_ODDS_GROUPS = [
  { key: 'MANGA', label: 'Manga', accent: 'manga' },
  { key: 'SP', label: 'SP', accent: 'sp' },
  { key: 'SEC', label: 'Secret Rare', accent: 'sec' },
  { key: 'SEC_AA', label: 'Secret Rare Alt Art (SEC AA)', accent: 'sec-aa' },
  { key: 'L_AA', label: 'Leader Alt Art (L AA)', accent: 'l-aa' },
  { key: 'SR_AA', label: 'Super Rare Alt Art (SR AA)', accent: 'sr-aa' }
];

const {
  priorityGroups: RIFTBOUND_BREAKER_PRIORITY_GROUPS,
  topOddsGroups: RIFTBOUND_BREAKER_TOP_ODDS_GROUPS,
  groupKey: riftboundBreakerGroupKey
} = window.RiftboundBreakerGroups;

function breakerRarity(card) {
  return String(card.break_rarity || card.rarity || '').trim().toUpperCase();
}

function breakerGroupKey(card) {
  const rarity = breakerRarity(card);
  return BREAKER_PRIORITY_GROUPS.find(group => group.key !== 'LEFTOVERS' && group.matches(rarity))?.key || 'LEFTOVERS';
}

function riftboundBreakerCardTile(card) {
  const treatment = String(card.collector_treatment || '').trim();
  const rarity = String(card.rarity || card.break_rarity || '').trim();
  const facts = [treatment, rarity, card.set_code, card.card_number].filter(Boolean).join(' · ') || 'Riftbound card';
  return `<article class="breaker-card ${card.block_status === 'ready' ? 'ready' : 'assigned'}">
    ${riftboundCardMarketBadge(card)}
    <div class="breaker-card-art">${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name)}" />` : '<span>◈</span>'}</div>
    <div class="breaker-card-copy"><b>${String(card.position).padStart(2, '0')}</b><div><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(facts)} · ${escapeHtml(breakerAssignmentLabel(card))}</span></div></div>
  </article>`;
}

function riftboundBuyerMessageCardTile(card, roundId = 0) {
  const included = Boolean(Number(card.message_marked));
  const roundAttribute = roundId ? ` data-pending-round="${Number(roundId)}"` : '';
  const pendingRemove = roundId
    ? `<button class="history-delete-button pending-remove-spot" type="button" data-pending-remove-spot="${Number(card.position)}" data-pending-remove-round="${Number(roundId)}" data-pending-remove-buyer="${escapeHtml(card.buyer_name || '')}">Remove False Spot</button>`
    : '';
  return `<div class="buyer-message-card ${included ? 'included' : ''}">
    ${riftboundBreakerCardTile(card)}
    <label class="buyer-message-select" title="Include this Riftbound pull in the congratulations message">
      <input type="checkbox" data-riftbound-buyer-message-position="${Number(card.position)}" data-riftbound-buyer-message-buyer="${escapeHtml(card.buyer_name || '')}"${roundAttribute} ${included ? 'checked' : ''} />
      <span>${included ? 'Selected' : 'Select card'}</span>
    </label>
    ${pendingRemove}
  </div>`;
}

function riftboundChampionFamilyTile(entry, card, role = '', badge = '', badgeLabel = '') {
  const quantity = Number(card.audit_quantity || 0);
  const treatment = String(card.collector_treatment || '').trim();
  const facts = [treatment, card.rarity, card.card_number].filter(Boolean).join(' · ') || 'Riftbound card';
  const roundAttribute = entry.roundId ? ` data-pending-round="${Number(entry.roundId)}"` : '';
  const safeRole = String(role || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const cardBadge = badge
    ? `<span class="unleashed-card-symbol card-symbol-${safeRole || 'mapped'}" title="${escapeHtml(badgeLabel || 'Mapped card type')}" aria-label="${escapeHtml(badgeLabel || 'Mapped card type')}">${escapeHtml(badge)}</span>`
    : '';
  return `<article class="champion-family-card ${safeRole ? `family-role-${safeRole}` : ''} ${quantity ? 'included' : ''}">
    ${cardBadge}
    <div class="champion-family-art">${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name)}" />` : '<span>◈</span>'}</div>
    <div class="champion-family-copy"><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(facts)}</span></div>
    ${riftboundCardMarketBadge(card)}
    <div class="champion-family-quantity" aria-label="Pulled quantity">
      <button data-riftbound-audit-position="${entry.position}" data-riftbound-audit-card="${card.id}" data-riftbound-audit-quantity="${Math.max(0, quantity - 1)}"${roundAttribute} ${quantity ? '' : 'disabled'} aria-label="Remove one ${escapeHtml(card.name)}">−</button>
      <b>${quantity}</b>
      <button data-riftbound-audit-position="${entry.position}" data-riftbound-audit-card="${card.id}" data-riftbound-audit-quantity="${Math.min(99, quantity + 1)}"${roundAttribute} aria-label="Add one ${escapeHtml(card.name)}">+</button>
    </div>
  </article>`;
}

function setAuditQuantityInState(entries, position, cardId, quantity) {
  const entry = (entries || []).find(item => Number(item.position) === Number(position));
  const card = entry?.family?.find(item => Number(item.id) === Number(cardId));
  if (!card) return 0;
  const previous = Number(card.audit_quantity || 0);
  card.audit_quantity = Number(quantity || 0);
  return Number(quantity || 0) - previous;
}

function updateRiftboundAuditQuantityControl(button, quantity) {
  const value = Math.max(0, Math.min(99, Number(quantity || 0)));
  const tile = button.closest('.champion-family-card');
  const quantityControl = tile?.querySelector('.champion-family-quantity');
  const buttons = quantityControl ? [...quantityControl.querySelectorAll('[data-riftbound-audit-card]')] : [];
  const count = quantityControl?.querySelector('b');
  if (count) count.textContent = value.toLocaleString();
  if (tile) tile.classList.toggle('included', value > 0);
  if (buttons[0]) {
    buttons[0].dataset.riftboundAuditQuantity = String(Math.max(0, value - 1));
    buttons[0].disabled = value < 1;
  }
  if (buttons[1]) {
    buttons[1].dataset.riftboundAuditQuantity = String(Math.min(99, value + 1));
    buttons[1].disabled = value >= 99;
  }
}

function updateBuyerBagSelectedCount(button, delta) {
  const bag = button.closest('.buyer-bag');
  const count = bag?.querySelector('[data-buyer-bag-selected]');
  if (!count) return;
  const selected = Math.max(0, Number(count.dataset.buyerBagSelected || 0) + Number(delta || 0));
  count.dataset.buyerBagSelected = String(selected);
  count.textContent = `${selected.toLocaleString()} actual card${selected === 1 ? '' : 's'} recorded`;
  bag.querySelectorAll('[data-clear-riftbound-buyer-message], [data-copy-riftbound-buyer-message], [data-pending-clear], [data-pending-copy]')
    .forEach(action => { action.disabled = selected < 1; });
  const priceCheck = bag.querySelector('[data-buyer-bag-price-check]');
  if (priceCheck && priceCheck.textContent !== 'Checking…') {
    priceCheck.disabled = false;
    priceCheck.dataset.buyerBagPriceSelected = String(selected);
    priceCheck.title = selected
      ? 'Refresh the JustTCG price for every recorded pull in this Buyer Bag'
      : 'Record an actual pulled card with +, then use this button';
  }
}

function updateLiveRiftboundSelectedPullButton() {
  const calledPositions = new Set(state.activeBoardCards
    .filter(card => card.block_status === 'called')
    .map(card => Number(card.position)));
  const direct = state.activeBoardCards
    .filter(card => card.block_status === 'called' && Number(card.message_marked))
    .length;
  const audited = state.riftboundChampionAudit
    .filter(entry => calledPositions.has(Number(entry.position)))
    .reduce((total, entry) => total + entry.family.reduce((sum, card) => sum + Number(card.audit_quantity || 0), 0), 0);
  const selected = direct + audited;
  elements.saveRiftboundPullHistory.disabled = selected < 1;
  elements.saveRiftboundPullHistory.textContent = selected
    ? `▣ Save ${selected.toLocaleString()} Selected Pull${selected === 1 ? '' : 's'}`
    : '▣ Save Selected Pulls';
}

function updatePendingRoundSelectedPulls(round) {
  const container = elements.pendingBreakRounds.querySelector(`[data-pending-round-id="${Number(round.id)}"]`);
  if (!container) return;
  const pulls = Math.max(0, Number(round.selectedPullCount || 0));
  const summary = container.querySelector('[data-pending-round-summary]');
  if (summary) summary.textContent = `${Number(round.assignedCount).toLocaleString()} assigned spot${Number(round.assignedCount) === 1 ? '' : 's'} · ${pulls.toLocaleString()} selected pull${pulls === 1 ? '' : 's'} · ${formatPrivateRiftboundMoney(round.capturedSpendCents)} captured`;
  const complete = container.querySelector('.pending-complete-button');
  if (complete) complete.disabled = pulls < 1;
  const status = container.querySelector('.history-status');
  if (status && !state.pendingRoundStatus.get(Number(round.id))) status.textContent = pulls
    ? 'Ready to archive when your review is finished.'
    : 'Select at least one exact pulled card before completing this box.';
}

function riftboundChampionAuditPanel(entry) {
  const selected = entry.family.reduce((total, card) => total + Number(card.audit_quantity || 0), 0);
  const isPoro = entry.spotType === 'PORO';
  const isVendettaBundle = ['VENDETTA_PAIR', 'VENDETTA_COLOR'].includes(entry.spotType);
  const isSpiritforgedExpanded = entry.spotType === 'SPIRITFORGED_EXPANDED';
  const isSpiritforgedBundle = ['SPIRITFORGED_PAIR', 'SPIRITFORGED_COLOR', 'SPIRITFORGED_EXPANDED'].includes(entry.spotType);
  const isOriginsBundle = entry.spotType === 'ORIGINS_COLOR';
  const isRiftboundSingle = entry.spotType === 'RIFTBOUND_SINGLE';
  const isUnleashedTop80 = entry.spotType === 'UNLEASHED_TOP80';
  const isUnleashedColorBreak = entry.spotType === 'UNLEASHED_COLOR_BREAK';
  const isUnleashedCaseBreak = entry.spotType === 'UNLEASHED_CASE_BREAK';
  const isUnleashedExpanded = entry.spotType === 'UNLEASHED_EXPANDED';
  const isCustomMapping = entry.spotType === 'CUSTOM_MAPPING' || Boolean(entry.customMapping);
  const isUnleashedChampionSplit = isUnleashedExpanded && entry.expandedKind === 'champion-split';
  const unleashedLaneSymbol = entry.laneSymbol || (entry.expandedMode === 'signature' ? '💎' : entry.expandedMode === 'overnumbered' ? '🔥' : '');
  const unleashedLaneLabel = entry.laneLabel || (entry.expandedMode === 'signature' ? 'SIG' : entry.expandedMode === 'overnumbered' ? 'ON' : '');
  const isComboVisual = entry.spotType === 'COMBO_VISUAL' || Boolean(entry.visualOnly);
  const isMappedBundle = isPoro || isVendettaBundle || isSpiritforgedBundle || isOriginsBundle || isRiftboundSingle || isUnleashedTop80 || isUnleashedColorBreak || isUnleashedCaseBreak || isUnleashedExpanded || isComboVisual || isCustomMapping;
  const heading = isRiftboundSingle
    ? entry.spotLabel
    : isCustomMapping
    ? `${entry.laneSymbol ? `${entry.laneSymbol} ` : ''}${entry.spotLabel}`
    : isComboVisual
    ? `${entry.spotLabel} Spot`
    : isUnleashedTop80
      ? entry.spotLabel
    : isUnleashedChampionSplit
      ? `${unleashedLaneSymbol} ${entry.champion} ${unleashedLaneLabel}`
    : isUnleashedExpanded
      ? `${entry.spotLabel} Spot`
    : isUnleashedCaseBreak
      ? `${entry.spotLabel} Spot`
    : isUnleashedColorBreak
      ? `${entry.spotLabel} Spot`
    : isPoro
      ? `${entry.poro} Spot`
      : (isVendettaBundle || isSpiritforgedBundle || isOriginsBundle)
        ? `${entry.spotLabel} Spot`
        : `${entry.champion} Champion Spot`;
  const colorClass = String(entry.color || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const instruction = isRiftboundSingle
    ? 'This buyer owns this exact card position only.'
    : isCustomMapping
      ? entry.instruction
    : isSpiritforgedExpanded
      ? entry.instruction
    : isUnleashedExpanded
      ? (isUnleashedChampionSplit ? '' : entry.instruction)
    : isComboVisual
    ? `Visual combo only — includes every mapped card shown for ${entry.spotLabel}; the connector and ledger stay on the original purchased anchor spot.`
    : isUnleashedTop80
      ? 'This buyer owns this exact collector number and finish only.'
    : isUnleashedCaseBreak
      ? entry.caseKind === 'baron-runes'
        ? 'Includes every Baron Nashor printing plus all six Unleashed booster Alternate-Art Runes.'
        : entry.caseKind === 'color'
          ? `Includes ${entry.poro}, ${entry.mappedCardName}, and unreserved Rare/Epic ${entry.domain} hits. All six AA Runes belong to Spot 13.`
          : `Includes every matching ${entry.champion} card pulled: Rare, Epic, Alternate Art, ON and signed ON.`
    : isUnleashedColorBreak
      ? `Includes both assigned champion families plus the complete ${entry.color} / ${entry.domain} chase bundle shown below.`
    : isPoro
      ? `Includes every ${entry.poro}, ${entry.mappedCardName}, ${entry.runeName}, and regular Rare ${entry.domain} card assigned by rune color.`
      : isOriginsBundle
        ? `Includes ${entry.spotLabel}. Common and Uncommon domain cards are excluded from this mapped spot.`
        : (isVendettaBundle || isSpiritforgedBundle)
          ? `Includes every card pulled for ${entry.spotLabel}.`
        : 'Select every matching card pulled from this box.';
  const poroCards = isPoro ? entry.family.filter(card => String(card.name || '').trim().toLowerCase() === String(entry.poro || '').trim().toLowerCase()) : [];
  const runeCards = isPoro ? entry.family.filter(card => String(card.name || '').trim().toLowerCase() === String(entry.runeName || '').trim().toLowerCase()) : [];
  const mappedCards = isPoro ? entry.family.filter(card => !poroCards.includes(card) && !runeCards.includes(card)) : [];
  const mappedBundleContent = entry.bundleGroups?.length
    ? `<div class="poro-pair-stage vendetta-bundle-stage ${isSpiritforgedBundle ? 'spiritforged-bundle-stage' : ''} groups-${entry.bundleGroups.length}">${entry.bundleGroups.map((group, index) => `${index ? '<div class="poro-pair-connector" aria-hidden="true"><span>+</span><b>PAIRED</b></div>' : ''}<div class="poro-pair-group vendetta-bundle-group family-role-${escapeHtml(group.role)}">
        <div class="poro-pair-label"><span>${String(index + 1).padStart(2, '0')}</span><div><b>${escapeHtml(group.label)}</b><small>${escapeHtml(group.caption)}</small></div></div>
        <div class="poro-card-rail">${group.cards.length
          ? group.cards.map(card => riftboundChampionFamilyTile(entry, card, group.role, group.badge, group.badgeLabel)).join('')
          : `<div class="champion-family-empty">No matching cards were found in the synced ${escapeHtml(entry.setCode || 'Riftbound')} gallery.</div>`}</div>
      </div>`).join('')}</div>`
    : '';
  // These mapped Buyer Bags use one compact left-to-right card flow with no
  // oversized "+ / PAIRED" separators or nested family columns. The new
  // Unleashed case layout applies to champion, Baron/Rune, and Poro/color
  // positions alike, so every owned card stays together in the same grid.
  const useLinearMappedGrid = (isOriginsBundle || isSpiritforgedBundle || isVendettaBundle || isUnleashedCaseBreak || isUnleashedExpanded || isCustomMapping) && entry.bundleGroups?.length;
  const linearMappedGridClass = isVendettaBundle
    ? 'vendetta-linear-family-grid'
    : isSpiritforgedBundle
      ? 'spiritforged-linear-family-grid'
      : isCustomMapping
        ? 'custom-mapping-linear-family-grid'
      : (isUnleashedCaseBreak || isUnleashedExpanded)
        ? 'unleashed-case-linear-family-grid'
        : 'origins-family-grid';
  const linearMappedBundleContent = useLinearMappedGrid
    ? `<div class="champion-family-grid ${linearMappedGridClass}">${entry.bundleGroups.map(group => group.cards.map(card => riftboundChampionFamilyTile(entry, card, group.role, group.badge, group.badgeLabel)).join('')).join('') || `<div class="champion-family-empty">No matching ${escapeHtml(entry.setCode || 'Riftbound')} cards were found in the synced gallery.</div>`}</div>`
    : '';
  const familyContent = useLinearMappedGrid
    ? linearMappedBundleContent
    : entry.bundleGroups?.length
      ? mappedBundleContent
    : isPoro
    ? `<div class="poro-pair-stage">
        <div class="poro-pair-group poro-origin-group">
          <div class="poro-pair-label"><span>01</span><div><b>YOUR PORO</b><small>Every printing pulled</small></div></div>
          <div class="poro-card-rail">${poroCards.length
            ? poroCards.map(card => riftboundChampionFamilyTile(entry, card, 'poro')).join('')
            : '<div class="champion-family-empty">Poro card not found in the synced gallery.</div>'}</div>
        </div>
        <div class="poro-pair-connector" aria-hidden="true"><span>+</span><b>PAIRED</b></div>
        <div class="poro-pair-group poro-mapped-group">
          <div class="poro-pair-label"><span>02</span><div><b>${escapeHtml(entry.mappedCardName)}</b><small>Every rarity and treatment pulled</small></div></div>
          <div class="poro-card-rail">${mappedCards.length
            ? mappedCards.map(card => riftboundChampionFamilyTile(entry, card, 'mapped')).join('')
            : '<div class="champion-family-empty">Mapped cards were not found in the synced gallery.</div>'}</div>
        </div>
        <div class="poro-pair-connector" aria-hidden="true"><span>+</span><b>PAIRED</b></div>
        <div class="poro-pair-group poro-rune-group">
          <div class="poro-pair-label"><span>03</span><div><b>${escapeHtml(entry.runeName)}</b><small>Matching color Rune</small></div></div>
          <div class="poro-card-rail">${runeCards.length
            ? runeCards.map(card => riftboundChampionFamilyTile(entry, card, 'rune')).join('')
            : '<div class="champion-family-empty">Matching Rune was not found in the synced gallery.</div>'}</div>
        </div>
      </div>`
    : (isVendettaBundle || isSpiritforgedBundle || isOriginsBundle)
      ? mappedBundleContent
      : `<div class="champion-family-grid">${entry.family.length
        ? entry.family.map(card => riftboundChampionFamilyTile(entry, card)).join('')
        : '<div class="champion-family-empty">No matching family cards were found. Sync the official Riftbound gallery and reopen this bag.</div>'}</div>`;
  const bundleTheme = isComboVisual ? 'vendetta-pair-theme' : (entry.color ? `poro-theme-${escapeHtml(colorClass)}` : (isSpiritforgedBundle ? 'spiritforged-pair-theme' : 'vendetta-pair-theme'));
  const pendingRemove = entry.roundId
    ? `<button class="history-delete-button pending-remove-spot" type="button" data-pending-remove-spot="${Number(entry.position)}" data-pending-remove-round="${Number(entry.roundId)}" data-pending-remove-buyer="${escapeHtml(entry.buyer || '')}">Remove False Spot</button>`
    : '';
  const auditStatus = selected
    ? `${selected} ${isRiftboundSingle ? 'exact single' : 'actual matching card'}${selected === 1 ? '' : 's'} recorded`
    : instruction;
  return `<section class="champion-audit-panel ${isMappedBundle ? `poro-audit-panel ${isVendettaBundle ? 'vendetta-audit-panel' : ''} ${isSpiritforgedBundle ? 'spiritforged-audit-panel' : ''} ${isOriginsBundle ? 'origins-audit-panel' : ''} ${isRiftboundSingle ? 'riftbound-single-panel' : ''} ${isUnleashedTop80 ? 'unleashed-top80-panel' : ''} ${isUnleashedColorBreak ? 'unleashed-color-break-panel' : ''} ${(isUnleashedCaseBreak || isUnleashedExpanded) ? 'unleashed-case-break-panel' : ''} ${isUnleashedChampionSplit ? 'unleashed-expanded-champion-panel' : ''} ${isCustomMapping ? 'custom-mapping-panel' : ''} ${bundleTheme}` : ''}">
    <header class="champion-audit-head">
      <div class="champion-audit-spot-art">${entry.spotCard.image_url ? `<img src="${escapeHtml(entry.spotCard.image_url)}" alt="${escapeHtml(entry.spotCard.name)}" />` : '<span>◈</span>'}</div>
      <div class="champion-audit-title"><small>${isRiftboundSingle ? 'SINGLE PURCHASE' : isCustomMapping ? 'CUSTOM SAVED MAP' : isSpiritforgedExpanded ? 'SPIRITFORGED 50-SPOT' : isUnleashedExpanded ? 'UNLEASHED 39-SPOT · BOARD 7' : isComboVisual ? 'VISUAL COMBO' : isUnleashedTop80 ? 'UNLEASHED TOP 80' : isUnleashedCaseBreak ? 'UNLEASHED 19-SPOT CASE' : isUnleashedColorBreak ? 'UNLEASHED COLOR BREAK' : isPoro ? `${escapeHtml(entry.color)} PAIR` : (isVendettaBundle || isSpiritforgedBundle || isOriginsBundle) ? `${entry.color ? `${escapeHtml(entry.color)} COLOR` : isVendettaBundle ? 'CHAMPION' : 'CHAMPION PAIR'} BUNDLE` : 'PURCHASED POSITION'} · SPOT ${entry.position}</small><h4>${escapeHtml(heading)}</h4>${auditStatus ? `<p>${escapeHtml(auditStatus)}</p>` : ''}</div>
      ${(isUnleashedChampionSplit || isCustomMapping) ? '' : isRiftboundSingle ? `<div class="poro-pair-reward"><span>EXACT SINGLE · PURCHASED POSITION</span><strong>${escapeHtml(entry.spotLabel)}</strong><small>ONE POSITION · ONE CARD · NO CHAMPION FAMILY</small></div>` : (isSpiritforgedExpanded || isUnleashedExpanded) ? `<div class="poro-pair-reward"><span>${escapeHtml(entry.rewardTitle)}</span><strong>${escapeHtml(entry.spotLabel)}</strong><small>${escapeHtml(entry.rewardCaption)}</small></div>` : isComboVisual ? `<div class="poro-pair-reward"><span>VISUAL COMBO SPOT</span><strong>${escapeHtml(entry.spotLabel)}</strong><small>DISPLAY ONLY · ORIGINAL LEDGER / CONNECTOR MAPPING UNCHANGED</small></div>` : isUnleashedTop80 ? `<div class="poro-pair-reward"><span>EXACT-CARD PRICE SPOT · COLLECTR RANK ${Number(entry.spotCard.collectr_rank || entry.position)}</span><strong>${escapeHtml(entry.spotLabel)}</strong><small>NO CHAMPION FAMILY OR COLOR BUNDLE · EXACT PRINTING ONLY</small></div>` : isUnleashedCaseBreak ? `<div class="poro-pair-reward"><span>${entry.caseKind === 'baron-runes' ? 'BARON + ALL SIX AA RUNES' : entry.caseKind === 'color' ? `FULL ${escapeHtml(entry.color)} / ${escapeHtml(entry.domain)} COLOR SPOT` : 'COMPLETE CHAMPION FAMILY'}</span><strong>${escapeHtml(entry.spotLabel)}</strong><small>${entry.caseKind === 'baron-runes' ? 'EVERY BARON PRINTING + FURY, CALM, MIND, BODY, CHAOS &amp; ORDER AA RUNES' : entry.caseKind === 'color' ? 'PORO + NAMED CHASE + UNRESERVED RARE / EPIC COLOR HITS · AA RUNES GO TO SPOT 13' : 'RARE + EPIC + ALTERNATE ART + ON + SIGNED ON'}</small></div>` : isUnleashedColorBreak ? `<div class="poro-pair-reward"><span>${entry.baron ? 'BARON + COLORLESS SPOT' : `TWO CHAMPION SIGNATURE FAMILIES · ${escapeHtml(entry.color)} / ${escapeHtml(entry.domain)}`}</span><strong>${escapeHtml(entry.spotLabel)}</strong><small>${entry.baron ? 'EVERY BARON PRINTING + EXPLICIT COLORLESS CARDS' : 'PORO + NAMED CHASE + RUNE + UNRESERVED RARE / EPIC COLOR HITS'}</small></div>` : isPoro ? `<div class="poro-pair-reward"><span>FULL ${escapeHtml(entry.color)} RUNE-COLOR BUNDLE</span><strong>${escapeHtml(entry.poro)} <i>+</i> ${escapeHtml(entry.mappedCardName)} <i>+</i> ${escapeHtml(entry.runeName)}</strong><small>PLUS RARE ${escapeHtml(entry.domain)} UNITS, SPELLS, GEAR &amp; UNASSIGNED CHAMPIONS</small></div>` : isOriginsBundle ? `<div class="poro-pair-reward"><span>SEAL + AA RUNE DOMAIN SPOT</span><strong>${escapeHtml(entry.spotLabel)}</strong><small>RARE / EPIC DOMAIN HITS · COMMON / UNCOMMON EXCLUDED</small></div>` : isSpiritforgedBundle ? `<div class="poro-pair-reward"><span>${entry.color ? 'SEAL + RUNE DOMAIN SPOT' : 'SIGNATURE + CHAMPION'}</span><strong>${escapeHtml(entry.spotLabel)}</strong><small>${entry.color ? 'RARE / EPIC DOMAIN HITS + UNPAIRED RARE CHAMPIONS' : 'ALL MATCHING CARDS PULLED ARE YOURS'}</small></div>` : isVendettaBundle ? `<div class="poro-pair-reward"><span>${entry.color ? 'COLOR CHASE SPOT' : 'SIGNATURE + CHAMPION'}</span><strong>${escapeHtml(entry.spotLabel)}</strong><small>ALL MATCHING CARDS PULLED ARE YOURS</small></div>` : ''}
      ${pendingRemove}
    </header>
    ${familyContent}
  </section>`;
}

function riftboundSinglesAuditGrid(entries = []) {
  const singles = (Array.isArray(entries) ? entries : []).filter(entry => entry?.spotType === 'RIFTBOUND_SINGLE');
  if (!singles.length) return '';
  return `<section class="riftbound-singles-section">
    <header class="riftbound-singles-heading"><div><strong>EXACT SINGLE PURCHASES</strong><span>One purchased position · one exact card</span></div><b>${singles.length} POSITION${singles.length === 1 ? '' : 'S'}</b></header>
    <div class="riftbound-singles-grid">${singles.map(entry => {
      const card = entry.family?.[0] || entry.spotCard;
      const pendingRemove = entry.roundId
        ? `<button class="history-delete-button pending-remove-spot riftbound-single-remove" type="button" data-pending-remove-spot="${Number(entry.position)}" data-pending-remove-round="${Number(entry.roundId)}" data-pending-remove-buyer="${escapeHtml(entry.buyer || '')}" title="Remove false Spot ${Number(entry.position)} assignment">Remove</button>`
        : '';
      return `<div class="riftbound-single-compact"><div class="riftbound-single-position"><span>SINGLE · SPOT ${String(entry.position).padStart(2, '0')}</span>${pendingRemove}</div>${riftboundChampionFamilyTile(entry, card, 'direct')}</div>`;
    }).join('')}</div>
  </section>`;
}

function breakerAssignmentLabel(card) {
  if (card.block_status === 'ready') return 'Available';
  const buyer = String(card.buyer_name || '').trim();
  const test = card.block_status === 'test-called' ? ' · TEST' : '';
  return buyer ? `@${buyer}${test}` : `Assigned${test}`;
}

function breakerCardTile(card, compact = false) {
  const rarity = breakerRarity(card) || '—';
  return `<article class="breaker-card ${card.block_status === 'ready' ? 'ready' : 'assigned'}">
    <div class="breaker-card-art">${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name)}" />` : '<span>♧</span>'}</div>
    <div class="breaker-card-copy"><b>${String(card.position).padStart(2, '0')}</b><div><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(rarity)} · ${escapeHtml(breakerAssignmentLabel(card))}</span></div></div>
  </article>`;
}

function buyerHandle(value) {
  const handle = String(value || '').trim().replace(/^@+/, '');
  return handle ? `@${handle}` : '@buyer';
}

function comparableBuyerHandle(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function formatBuyerSpend(cents) {
  const amount = Math.max(0, Number(cents || 0));
  if (!amount) return '—';
  return formatExactCurrency(amount);
}

function formatPrivateRiftboundMoney(cents) {
  return state.riftboundSpendingVisible ? formatBuyerSpend(cents) : 'Hidden';
}

function buyerBagPriceStatusKey(buyer, roundId = 0) {
  return `${Math.max(0, Number(roundId) || 0)}:${comparableBuyerHandle(buyer)}`;
}

function buyerBagCollapseKey(buyer, roundId = 0) {
  return buyerBagPriceStatusKey(buyer, roundId);
}

function buyerBagIsCollapsed(buyer, roundId = 0) {
  return state.collapsedBuyerBags.has(buyerBagCollapseKey(buyer, roundId));
}

function buyerBagCollapseControl(buyer, roundId = 0) {
  const key = buyerBagCollapseKey(buyer, roundId);
  const collapsed = state.collapsedBuyerBags.has(key);
  const label = collapsed ? 'Open Buyer Bag' : 'Minimize Buyer Bag';
  return `<button class="buyer-bag-collapse" type="button" data-buyer-bag-collapse="${escapeHtml(key)}" aria-expanded="${collapsed ? 'false' : 'true'}" title="${label}">${collapsed ? '+' : '−'}</button>`;
}

function wireBuyerBagCollapseControls(container) {
  if (!container) return;
  container.querySelectorAll('[data-buyer-bag-collapse]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.buyerBagCollapse || '';
    const bag = button.closest('.buyer-bag');
    if (!key || !bag) return;
    const collapsed = !bag.classList.contains('is-collapsed');
    bag.classList.toggle('is-collapsed', collapsed);
    if (collapsed) state.collapsedBuyerBags.add(key);
    else state.collapsedBuyerBags.delete(key);
    button.textContent = collapsed ? '+' : '−';
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    button.title = collapsed ? 'Open Buyer Bag' : 'Minimize Buyer Bag';
  }));
}

const PRICE_SOURCE_UI = Object.freeze({
  justtcg: Object.freeze({ label: 'JustTCG', button: '↻ JustTCG Whole Bag', boardButton: '↻ Price Entire Board', action: 'automatic', detail: 'Near Mint English market price' }),
  chatgpt: Object.freeze({ label: 'ChatGPT Batch Import', button: '✦ ChatGPT Whole Bag', boardButton: '✦ ChatGPT Entire Board', action: 'input', detail: 'price researched with ChatGPT' }),
  ebay: Object.freeze({ label: 'eBay Active Estimate', button: '↻ eBay Whole Bag', boardButton: '↻ eBay Entire Board', action: 'automatic', detail: 'active listing median with lowest shipping' }),
  manual: Object.freeze({ label: 'Manual', button: '$ Manual Whole Bag', boardButton: '$ Manual Entire Board', action: 'input', detail: 'manually entered unit price' })
});

function activePriceSource() {
  const id = String(state.pricing?.selectedSource || 'justtcg').toLowerCase();
  return PRICE_SOURCE_UI[id] ? id : 'justtcg';
}

function activePriceSourceUi() {
  return PRICE_SOURCE_UI[activePriceSource()];
}

function syncBuyerPriceSourceControl() {
  if (elements.buyerPriceSource) elements.buyerPriceSource.value = activePriceSource();
  if (elements.pullHistoryPriceSource) elements.pullHistoryPriceSource.value = activePriceSource();
  if (elements.refreshRiftboundBoardPrices && state.riftboundBoardPriceStatus?.type !== 'loading') {
    elements.refreshRiftboundBoardPrices.textContent = activePriceSourceUi().boardButton;
  }
}

async function refreshPricingSettings() {
  state.pricing = await window.breakSuite.getPricingSettings();
  syncBuyerPriceSourceControl();
  return state.pricing;
}

async function saveSelectedPriceSource(source) {
  state.pricing = await window.breakSuite.savePricingSettings({ selectedSource: source });
  syncBuyerPriceSourceControl();
  state.buyerBagPriceStatus.clear();
  state.riftboundBoardPriceStatus = null;
  state.cardListPriceStatus = null;
  state.pullHistoryPriceStatus.clear();
  if (state.view === 'riftbound-breaker') renderRiftboundBreakerCenter();
  if (state.view === 'history' && state.historyTab === 'pulls') renderPullHistory();
  if (isLibraryView()) renderCardListResults();
  return state.pricing;
}

function riftboundCardMarketBadge(card = {}) {
  const priceCents = Number(card.market_price_cents);
  const matched = Number.isInteger(priceCents) && priceCents >= 0;
  if (!state.riftboundSpendingVisible || !matched) return '';
  const source = String(card.market_price_source || 'Saved price').trim();
  const refreshed = card.market_price_updated_at ? formatHistoryDate(card.market_price_updated_at) : 'recently';
  const sourceId = source.toLowerCase().includes('ebay') ? 'ebay' : source.toLowerCase().includes('chatgpt') ? 'chatgpt' : source.toLowerCase().includes('manual') ? 'manual' : 'justtcg';
  const title = `${source} ${PRICE_SOURCE_UI[sourceId].detail} · checked ${refreshed}`;
  return `<div class="riftbound-card-market" title="${escapeHtml(title)}"><b>${escapeHtml(formatBuyerSpend(priceCents))}</b></div>`;
}

function buyerBagPriceControl(buyer, _selectedCards, roundId = 0) {
  const key = buyerBagPriceStatusKey(buyer, roundId);
  const status = state.buyerBagPriceStatus.get(key);
  const loading = status?.type === 'loading';
  const source = activePriceSourceUi();
  return `<button class="buyer-bag-price-check" type="button" data-buyer-bag-price-check="${escapeHtml(buyer)}" data-buyer-bag-price-round="${Math.max(0, Number(roundId) || 0)}" ${loading ? 'disabled' : ''} title="Price every distinct card displayed in this entire Buyer Bag with ${source.label}">${loading ? 'Preparing…' : escapeHtml(source.button)}</button>`;
}

function buyerBagPriceStatusMarkup(buyer, roundId = 0) {
  const status = state.buyerBagPriceStatus.get(buyerBagPriceStatusKey(buyer, roundId));
  if (!status) return '';
  const className = status.type === 'error' ? 'error' : status.type;
  return `<p class="buyer-bag-price-status ${escapeHtml(className || '')}" aria-live="polite">${escapeHtml(status.message || '')}</p>`;
}

function priceInputRows() {
  return Array.isArray(state.priceInput?.data?.rows) ? state.priceInput.data.rows : [];
}

function chatGptPriceRequest() {
  const input = state.priceInput;
  const cards = priceInputRows().map(row => ({
    id: Number(row.id),
    game: row.gameCode || input?.data?.gameCode || 'RIFTBOUND',
    set: [row.setCode, row.setName].filter(Boolean).join(' · '),
    cardName: row.cardName,
    cardNumber: row.cardNumber,
    rarity: row.rarity,
    treatment: row.treatment || 'Standard',
    quantity: Math.max(1, Number(row.quantity || 1))
  }));
  return `Research a current fair unit price for every exact trading-card printing below. This is for a commercial card-break bookkeeping tool. Use current public market evidence and price one raw Near Mint English copy; do not use graded, sealed, lot, playset, or unrelated-printing prices. If evidence is weak, use null instead of guessing. Return JSON only in exactly this shape: {"prices":[{"id":123,"priceUsd":12.34,"sourceUrl":"https://supporting-page","note":"short basis"}]}. Keep every id exactly as supplied and return one row for every card.\n\nCards:\n${JSON.stringify(cards, null, 2)}`;
}

function chatGptCopyButtonLabel() {
  if (state.priceInput?.kind === 'card-list') return 'Copy Card List Request';
  if (state.priceInput?.kind === 'riftbound-board') return 'Copy Entire Board Request';
  if (state.priceInput?.kind === 'buyer-bag') return 'Copy Entire Bag Request';
  return 'Copy Pull History Request';
}

function renderPriceInputModal() {
  const input = state.priceInput;
  if (!input || !elements.priceInputModal) return;
  const source = activePriceSource();
  const rows = priceInputRows();
  const isChatGpt = source === 'chatgpt';
  const isCardList = input.kind === 'card-list';
  const isBoard = input.kind === 'riftbound-board';
  const isBag = input.kind === 'buyer-bag';
  elements.priceInputEyebrow.textContent = isCardList ? 'CARD LIST SEARCH PRICING' : isBoard ? 'ENTIRE RIFTBOUND BOARD PRICING' : isBag ? 'ENTIRE BUYER BAG PRICING' : 'SAVED PULL HISTORY PRICING';
  elements.priceInputTitle.textContent = isChatGpt
    ? isCardList ? 'Import this searched card list from ChatGPT' : isBoard ? 'Import all displayed board prices from ChatGPT' : isBag ? 'Import the entire Buyer Bag from ChatGPT' : 'Import prices from ChatGPT'
    : 'Enter manual unit prices';
  const scope = isCardList ? 'in this Card List Search' : isBoard ? 'across Remaining Cards and Buyer Bags' : isBag ? 'displayed in this entire Buyer Bag' : 'in this saved Pull History';
  elements.priceInputDescription.textContent = `${rows.length.toLocaleString()} distinct exact printing${rows.length === 1 ? '' : 's'} ${scope} · all are handled together in one batch.`;
  elements.priceInputChatGpt.classList.toggle('hidden', !isChatGpt);
  elements.priceInputManual.classList.toggle('hidden', isChatGpt);
  elements.copyChatGptPriceRequest.textContent = chatGptCopyButtonLabel();
  elements.priceInputJson.value = '';
  elements.priceInputStatus.textContent = isChatGpt
    ? 'One batch only: copy this complete request, paste it into ChatGPT, then paste the single JSON answer here and save.'
    : 'Blank prices will be saved as unpriced. Dollar amounts are unit prices; quantity is applied automatically.';
  elements.priceInputManual.innerHTML = isChatGpt ? '' : rows.map(row => {
    const current = Number.isInteger(row.currentPriceCents) ? (Number(row.currentPriceCents) / 100).toFixed(2) : '';
    const facts = [row.setCode, row.cardNumber, row.rarity, row.treatment].filter(Boolean).join(' · ');
    return `<div class="price-input-row"><div><strong>${escapeHtml(row.cardName || 'Unnamed card')}</strong><span>${escapeHtml(facts || 'Exact printing')}</span></div><em>×${Math.max(1, Number(row.quantity || 1))}${row.currentSource ? ` · was ${escapeHtml(row.currentSource)}` : ''}</em><label>Unit USD<input data-manual-price-id="${Number(row.id)}" inputmode="decimal" value="${escapeHtml(current)}" placeholder="0.00" /></label></div>`;
  }).join('');
  elements.priceInputModal.classList.remove('hidden');
  window.setTimeout(() => (isChatGpt ? elements.copyChatGptPriceRequest : elements.priceInputManual.querySelector('input'))?.focus(), 0);
}

function closePriceInputModal() {
  elements.priceInputModal?.classList.add('hidden');
  state.priceInput = null;
  if (elements.priceInputStatus) elements.priceInputStatus.textContent = '';
}

async function openBuyerBagPriceInput(buyer, roundId) {
  const data = await window.breakSuite.prepareBuyerBagPriceInput({ buyer, roundId });
  state.pricing = data.pricing || state.pricing;
  if (!['chatgpt', 'manual'].includes(activePriceSource())) throw new Error('The selected source changed. Press Price Check again.');
  state.priceInput = { kind: 'buyer-bag', buyer, roundId, data };
  renderPriceInputModal();
}

async function openRiftboundBoardPriceInput() {
  const data = await window.breakSuite.prepareRiftboundBoardPriceInput();
  state.pricing = data.pricing || state.pricing;
  if (!['chatgpt', 'manual'].includes(activePriceSource())) throw new Error('The selected source changed. Press Entire Board Pricing again.');
  state.priceInput = { kind: 'riftbound-board', data };
  renderPriceInputModal();
}

async function openLibraryListPriceInput() {
  const cardIds = state.cardListCards.map(card => Number(card.id)).filter(Boolean);
  const data = await window.breakSuite.prepareLibraryListPriceInput(cardIds);
  state.pricing = data.pricing || state.pricing;
  if (!['chatgpt', 'manual'].includes(activePriceSource())) throw new Error('The selected source changed. Press Price This List again.');
  state.priceInput = { kind: 'card-list', cardIds, data };
  renderPriceInputModal();
}

async function openPullHistoryPriceInput(batchId) {
  const data = await window.breakSuite.preparePullHistoryPriceInput(batchId);
  state.pricing = data.pricing || state.pricing;
  if (!['chatgpt', 'manual'].includes(activePriceSource())) throw new Error('The selected source changed. Press the price button again.');
  state.priceInput = { kind: 'pull-history', batchId: Number(batchId), data };
  renderPriceInputModal();
}

function parsedChatGptPriceEntries() {
  let raw = String(elements.priceInputJson?.value || '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (!raw) throw new Error('Paste the JSON price response from ChatGPT first.');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('That response is not valid JSON yet. Ask ChatGPT for JSON only, then paste it again.'); }
  const entries = Array.isArray(parsed) ? parsed : parsed?.prices;
  if (!Array.isArray(entries)) throw new Error('The JSON needs a prices array. Copy the request again so ChatGPT uses the exact format.');
  return entries;
}

function manualPriceEntries() {
  return priceInputRows().map(row => ({
    id: Number(row.id),
    priceUsd: elements.priceInputManual.querySelector(`[data-manual-price-id="${Number(row.id)}"]`)?.value || null
  }));
}

async function saveOpenPriceInput() {
  const input = state.priceInput;
  if (!input) return;
  const source = activePriceSource();
  const entries = source === 'chatgpt' ? parsedChatGptPriceEntries() : manualPriceEntries();
  const result = input.kind === 'card-list'
    ? await window.breakSuite.applyLibraryListPriceInput({ cardIds: input.cardIds, source, entries })
    : input.kind === 'riftbound-board'
      ? await window.breakSuite.applyRiftboundBoardPriceInput({ source, entries })
    : input.kind === 'buyer-bag'
      ? await window.breakSuite.applyBuyerBagPriceInput({ buyer: input.buyer, roundId: input.roundId, source, entries })
      : await window.breakSuite.applyPullHistoryPriceInput({ batchId: input.batchId, source, entries });
  const missing = Number(result.unmatchedCards || 0);
  const priced = Number(result.matchedCards || 0);
  const message = input.kind === 'pull-history'
    ? `✓ Saved ${priced.toLocaleString()} ${result.source} card price${priced === 1 ? '' : 's'}${missing ? ` · ${missing.toLocaleString()} left unpriced` : ''} · ${formatExactCurrency(result.marketValueCents || 0)} total value.`
    : input.kind === 'card-list'
      ? `✓ Saved ${priced.toLocaleString()} ${result.source} card price${priced === 1 ? '' : 's'} for this list${missing ? ` · ${missing.toLocaleString()} left unpriced` : ''} · ${formatExactCurrency(result.marketValueCents || 0)} total.`
    : `✓ Saved ${priced.toLocaleString()} displayed ${result.source} card price${priced === 1 ? '' : 's'} together${missing ? ` · ${missing.toLocaleString()} left unpriced` : ''}.`;
  closePriceInputModal();
  if (input.kind === 'card-list') {
    state.cardListPriceStatus = { type: missing ? 'pending' : 'success', message };
    state.cardListShowPrices = true;
    await runCardListSearch({ preservePriceStatus: true });
  } else if (input.kind === 'riftbound-board') {
    state.riftboundBoardPriceStatus = { type: missing ? 'pending' : 'success', message };
    await refreshBreakBoard(undefined, { preserveScroll: true });
  } else if (input.kind === 'buyer-bag') {
    state.buyerBagPriceStatus.set(buyerBagPriceStatusKey(input.buyer, input.roundId), { type: missing ? 'pending' : 'success', message });
    await refreshBreakBoard(undefined, { preserveScroll: true });
  } else {
    state.pullHistoryPriceStatus.set(Number(input.batchId), { type: missing ? 'pending' : 'success', message });
    await Promise.all([refreshOrderHistory(), refreshOpenBoxCases()]);
  }
}

function wireBuyerBagPriceChecks(container) {
  if (!container) return;
  container.querySelectorAll('[data-buyer-bag-price-check]').forEach(button => button.addEventListener('click', async () => {
    const buyer = button.dataset.buyerBagPriceCheck || '';
    const roundId = Math.max(0, Number(button.dataset.buyerBagPriceRound) || 0);
    const key = buyerBagPriceStatusKey(buyer, roundId);
    state.buyerBagPriceStatus.set(key, { type: 'loading', message: `Preparing ${activePriceSourceUi().label} for every card displayed in this entire Buyer Bag…` });
    renderRiftboundBreakerCenter();
    try {
      if (activePriceSourceUi().action === 'input') {
        await openBuyerBagPriceInput(buyer, roundId);
        state.buyerBagPriceStatus.set(key, { type: 'pending', message: `${activePriceSourceUi().label} is open with the entire displayed bag in one batch.` });
        renderRiftboundBreakerCenter();
        return;
      }
      const result = await window.breakSuite.refreshBuyerBagPrices({ buyer, roundId });
      const priced = Number(result.matchedCards || 0);
      const missing = Number(result.unmatchedCards || 0);
      state.buyerBagPriceStatus.set(key, {
        type: 'success',
        message: `✓ Updated ${priced} displayed ${result.source} card price${priced === 1 ? '' : 's'} for the entire bag${missing ? ` · ${missing} card${missing === 1 ? '' : 's'} had no exact match` : ''}.`
      });
      await refreshBreakBoard(undefined, { preserveScroll: true });
    } catch (error) {
      state.buyerBagPriceStatus.set(key, { type: 'error', message: error.message || 'Buyer Bag prices could not be refreshed.' });
      renderRiftboundBreakerCenter();
    }
  }));
}

async function runRiftboundBoardPriceRefresh() {
  if (state.riftboundBoardPriceStatus?.type === 'loading') return;
  state.riftboundBoardPriceStatus = { type: 'loading', message: `Preparing ${activePriceSourceUi().label} for every displayed Remaining Card and Buyer Bag card…` };
  renderRiftboundBreakerCenter();
  try {
    if (activePriceSourceUi().action === 'input') {
      await openRiftboundBoardPriceInput();
      state.riftboundBoardPriceStatus = { type: 'pending', message: `${activePriceSourceUi().label} opened every displayed board card together in one batch.` };
      renderRiftboundBreakerCenter();
      return;
    }
    const result = await window.breakSuite.refreshRiftboundBoardPrices();
    const priced = Number(result.matchedCards || 0);
    const missing = Number(result.unmatchedCards || 0);
    state.riftboundBoardPriceStatus = {
      type: missing ? 'pending' : 'success',
      message: `✓ Updated ${priced.toLocaleString()} displayed ${result.source} card price${priced === 1 ? '' : 's'} across Remaining Cards and Buyer Bags${missing ? ` · ${missing.toLocaleString()} exact match${missing === 1 ? '' : 'es'} missing` : ''}.`
    };
    await refreshBreakBoard(undefined, { preserveScroll: true });
  } catch (error) {
    state.riftboundBoardPriceStatus = { type: 'error', message: error.message || 'The displayed Riftbound board prices could not be refreshed.' };
    renderRiftboundBreakerCenter();
  }
}

async function runCardListPriceRefresh() {
  if (!state.cardListCards.length || state.cardListPriceStatus?.type === 'loading') return;
  const cardIds = state.cardListCards.map(card => Number(card.id)).filter(Boolean);
  state.cardListPriceStatus = { type: 'loading', message: `Preparing ${activePriceSourceUi().label} for ${cardIds.length.toLocaleString()} searched card${cardIds.length === 1 ? '' : 's'}…` };
  renderCardListResults();
  try {
    if (activePriceSourceUi().action === 'input') {
      await openLibraryListPriceInput();
      state.cardListPriceStatus = { type: 'pending', message: `${activePriceSourceUi().label} is open with this complete searched list.` };
      renderCardListResults();
      return;
    }
    const result = await window.breakSuite.refreshLibraryListPrices(cardIds);
    const priced = Number(result.matchedCards || 0);
    const missing = Number(result.unmatchedCards || 0);
    state.cardListPriceStatus = {
      type: missing ? 'pending' : 'success',
      message: `✓ Updated ${priced.toLocaleString()} ${result.source} card price${priced === 1 ? '' : 's'}${missing ? ` · ${missing.toLocaleString()} exact match${missing === 1 ? '' : 'es'} missing` : ''} · ${formatExactCurrency(result.marketValueCents || 0)} total.`
    };
    state.cardListShowPrices = true;
    await runCardListSearch({ preservePriceStatus: true });
  } catch (error) {
    state.cardListPriceStatus = { type: 'error', message: error.message || 'The searched card prices could not be refreshed.' };
    renderCardListResults();
  }
}

function formatExactCurrency(cents) {
  const amount = Math.max(0, Number(cents || 0));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
}

function formatSignedCurrency(cents) {
  const amount = Number(cents || 0);
  return `${amount >= 0 ? '+' : '−'}${formatExactCurrency(Math.abs(amount))}`;
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved record';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(date);
}

function historyBoxResult(record) {
  const cost = Math.max(0, Number(record.box_cost_cents || 0));
  const missing = Math.max(0, Number(record.unpriced_order_count || 0));
  if (missing) return { label: `${missing} sale price${missing === 1 ? '' : 's'} not captured`, className: 'pending' };
  if (!cost) return { label: 'Box cost not entered', className: 'pending' };
  const fees = record.whatnot_fees || {};
  const difference = Number(fees.netProfitCents || 0);
  return {
    label: `${fees.usesActualFee ? 'Actual' : 'Est.'} net ${difference >= 0 ? '+' : '−'}${formatExactCurrency(Math.abs(difference))}`,
    className: difference >= 0 ? 'positive' : 'negative'
  };
}

function percentageInputValue(basisPoints) {
  return (Math.max(0, Number(basisPoints || 0)) / 100).toFixed(2);
}

function historyTransactionCountInput(record) {
  return Number(record.whatnot_transaction_count) >= 0 ? String(Math.floor(Number(record.whatnot_transaction_count))) : '';
}

function historyFeeBreakdown(record) {
  const fees = record.whatnot_fees || {};
  const processingRate = Number(fees.processingPercentageFeeCents || 0);
  const transactionFees = Number(fees.transactionFeesCents || 0);
  const feeMode = fees.usesActualFee ? 'ACTUAL STATEMENT OVERRIDE' : 'AUTOMATIC ESTIMATE';
  return `<section class="history-fee-breakdown">
    <header><div><small>WHATNOT DEDUCTIONS</small><strong>${feeMode}</strong></div><b>${escapeHtml(formatExactCurrency(fees.totalWhatnotFeeCents || 0))}</b></header>
    <div>
      <span><b>${escapeHtml(formatExactCurrency(fees.commissionFeeCents || 0))}</b> ${escapeHtml(percentageInputValue(fees.commissionBasisPoints))}% commission</span>
      <span><b>${escapeHtml(formatExactCurrency(processingRate))}</b> ${escapeHtml(percentageInputValue(fees.processingBasisPoints))}% processing estimate</span>
      <span><b>${escapeHtml(formatExactCurrency(transactionFees))}</b> ${Number(fees.transactionCount || 0).toLocaleString()} × ${escapeHtml(formatExactCurrency(fees.transactionFeeCents || 0))}</span>
      <span><b>${escapeHtml(formatExactCurrency(fees.feeTaxCents || 0))}</b> ${escapeHtml(percentageInputValue(fees.feeTaxBasisPoints))}% processing-fee tax</span>
      ${Number(fees.additionalFeeCents || 0) ? `<span><b>${escapeHtml(formatExactCurrency(fees.additionalFeeCents))}</b> additional charges</span>` : ''}
      ${fees.usesActualFee ? `<span><b>${escapeHtml(formatExactCurrency(fees.estimatedFeeCents || 0))}</b> automatic estimate replaced</span>` : ''}
    </div>
  </section>`;
}

function historyItemCard(item) {
  const price = Number(item.sale_amount_cents || 0);
  const cardNumber = String(item.card_number || '').trim();
  const setCode = String(item.set_code || '').trim();
  const cardReference = [setCode, cardNumber].filter(Boolean).join(' · ');
  return `<li class="history-order-item">
    <b>${String(Number(item.position)).padStart(2, '0')}</b>
    <div><strong>${escapeHtml(item.card_name || 'Unnamed card')}</strong><span>${escapeHtml([item.rarity, cardReference].filter(Boolean).join(' · ') || 'Official card')}</span></div>
    <em>${escapeHtml(buyerHandle(item.buyer_name))}</em>
    <i>${escapeHtml(price ? formatExactCurrency(price) : 'Price not captured')}</i>
  </li>`;
}

function savedBuyerBagCard(buyerName, items) {
  const priced = items.filter(item => Number(item.sale_amount_cents || 0) > 0);
  const spend = priced.reduce((total, item) => total + Math.max(0, Number(item.sale_amount_cents || 0)), 0);
  const cards = items.map(item => {
    const reference = [item.set_code, item.card_number, item.rarity].filter(Boolean).join(' · ');
    return `<li><b>${String(Number(item.position)).padStart(2, '0')}</b><span>${escapeHtml(item.card_name || 'Unnamed spot')}<small>${escapeHtml(reference || 'Saved spot position')}</small></span><em>${escapeHtml(Number(item.sale_amount_cents || 0) ? formatExactCurrency(item.sale_amount_cents) : 'Price not captured')}</em></li>`;
  }).join('');
  return `<article class="saved-buyer-bag"><header><div><small>ARCHIVED BUYER BAG</small><strong>${escapeHtml(buyerHandle(buyerName))}</strong><span>${items.length} purchased spot${items.length === 1 ? '' : 's'}</span></div><b>${escapeHtml(priced.length ? formatExactCurrency(spend) : 'Price not captured')}</b></header><ol>${cards}</ol></article>`;
}

function savedBuyerBags(record) {
  const grouped = new Map();
  for (const item of record.items || []) {
    const name = String(item.buyer_name || '').trim() || 'Unknown buyer';
    const key = name.replace(/^@+/, '').toLowerCase();
    if (!grouped.has(key)) grouped.set(key, { name, items: [] });
    grouped.get(key).items.push(item);
  }
  return [...grouped.values()]
    .sort((a, b) => b.items.reduce((t, i) => t + Number(i.sale_amount_cents || 0), 0) - a.items.reduce((t, i) => t + Number(i.sale_amount_cents || 0), 0) || a.name.localeCompare(b.name))
    .map(group => savedBuyerBagCard(group.name, group.items)).join('');
}

function historyCostInputValue(cents) {
  const amount = Math.max(0, Number(cents || 0));
  return amount ? (amount / 100).toFixed(2) : '';
}

function historyFeeInputValue(cents) {
  return (Math.max(0, Number(cents || 0)) / 100).toFixed(2);
}

function historyTrackerDestinationForm(record) {
  const link = record.tracker_case_link;
  const destination = link ? 'OPEN_CASE' : (record.tracker_record_type === 'CASE' ? 'CASE' : 'BOX');
  const currentCase = (state.openBoxCases || []).find(item => Number(item.id) === Number(link?.tracker_id));
  const cases = compatibleOpenCases(record.tracker_game_code, record.tracker_set_code);
  if (currentCase && !cases.some(item => Number(item.id) === Number(currentCase.id))) cases.unshift(currentCase);
  const selectedCaseId = currentCase ? Number(currentCase.id) : 0;
  const unavailableCase = link && !currentCase
    ? `<option value="" selected>${escapeHtml(link.tracker_name)} is no longer open — choose another case</option>`
    : '';
  const current = link
    ? `${link.tracker_name} · Box ${String(Number(link.box_number)).padStart(2, '0')}`
    : `Standalone ${destination === 'CASE' ? 'Case' : 'Box'}`;
  return `<form class="history-tracker-edit-form" data-history-tracker-form="${Number(record.id)}">
    <div><small>BOX TRACKER DESTINATION</small><strong>Currently: ${escapeHtml(current)}</strong><span>Move this saved Order and its selected pulls without changing the buyers, sales, or original Pull History.</span></div>
    <label>Save as<select name="trackerDestination" aria-label="Tracker destination for ${escapeHtml(record.break_name || 'saved Order')}">
      <option value="BOX" ${destination === 'BOX' ? 'selected' : ''}>Standalone Box</option>
      <option value="CASE" ${destination === 'CASE' ? 'selected' : ''}>Standalone Case</option>
      <option value="OPEN_CASE" ${destination === 'OPEN_CASE' ? 'selected' : ''}>Box in an open case</option>
    </select></label>
    <label>Open case by name<select name="openCaseId" ${destination === 'OPEN_CASE' ? 'required' : 'disabled'}>
      ${unavailableCase || openCaseOptionMarkup(cases, selectedCaseId)}${unavailableCase ? openCaseOptionMarkup(cases) : ''}
    </select></label>
    <button class="secondary-button" type="submit">Update Tracker</button>
    <p data-tracker-destination-help>${destination === 'OPEN_CASE' ? 'Choose an open case with space for this box.' : 'This will update the linked Box Tracker record.'}</p>
  </form>`;
}

function renderOrderHistory() {
  const records = Array.isArray(state.orderHistory) ? state.orderHistory : [];
  const totalRecords = Math.max(records.length, Number(state.orderHistoryTotalCount || 0));
  const summary = state.orderHistorySummary || {};
  const totalGross = Number(summary.totalGrossCents || 0);
  const totalCosts = Number(summary.totalCostsCents || 0);
  const totalWhatnotFees = Number(summary.totalWhatnotFeesCents || 0);
  const incomplete = Number(summary.incompletePriceCount || 0);
  const completeRecordCount = Number(summary.completeRecordCount || 0);
  const completeNet = Number(summary.completeNetCents || 0);
  elements.historySummary.innerHTML = totalRecords
    ? `<span><b>${totalRecords.toLocaleString()}</b> saved break${totalRecords === 1 ? '' : 's'}</span><span><b>${escapeHtml(formatExactCurrency(totalGross))}</b> gross sales</span><span><b>${escapeHtml(formatExactCurrency(totalWhatnotFees))}</b> Whatnot fees</span><span><b>${escapeHtml(formatExactCurrency(totalCosts))}</b> product cost</span>${completeRecordCount ? `<span><b>${escapeHtml(formatSignedCurrency(completeNet))}</b> net on ${completeRecordCount} complete break${completeRecordCount === 1 ? '' : 's'}</span>` : ''}${incomplete ? `<span><b>${incomplete.toLocaleString()}</b> price${incomplete === 1 ? '' : 's'} missing</span>` : ''}`
    : '<span><b>0</b> saved breaks</span><span>Nothing has been archived yet.</span>';
  elements.historySaveStatus.textContent = state.orderHistorySaveStatus || 'Save Selected Pulls first. This box save will copy that Pull History snapshot without changing the live board.';
  elements.historyRecords.innerHTML = records.length
    ? `${records.map((record, index) => {
      const result = historyBoxResult(record);
      const itemCount = Number(record.confirmed_order_count || record.items?.length || 0);
      const pullCount = Math.max(0, Number(record.selected_pull_count || 0));
      const missing = Math.max(0, Number(record.unpriced_order_count || 0));
      const dispositionLabel = ({ PROMOTIONAL_GIVEAWAY: 'Promotional Giveaway', CUSTOMER_COMPENSATION: 'Customer Compensation / Make-Good', DAMAGED_INVENTORY: 'Damaged Inventory', LOST_INVENTORY: 'Lost Inventory', OWNER_PERSONAL_USE: 'Owner / Personal Use' })[String(record.disposition || 'NORMAL_BREAK')] || 'Normal Break / Sale';
      const trackerIdentity = [record.tracker_case_link ? 'CASE BOX' : (record.tracker_record_type === 'CASE' ? 'CASE' : (record.tracker_record_type === 'BOX' ? 'BOX' : '')), record.tracker_game_code === 'RIFTBOUND' ? 'RIFTBOUND' : (record.tracker_game_code ? 'ONE PIECE' : ''), record.tracker_set_name || record.tracker_set_code].filter(Boolean).join(' · ');
      return `<details class="history-record" ${index === 0 ? 'open' : ''}>
        <summary><div><span>SAVED ${escapeHtml(formatHistoryDate(record.recorded_at))} · ${escapeHtml(dispositionLabel.toUpperCase())}${trackerIdentity ? ` · ${escapeHtml(trackerIdentity)}` : ''}</span><strong>${escapeHtml(record.break_name || 'Saved character break')}</strong><small>${itemCount.toLocaleString()} confirmed spot${itemCount === 1 ? '' : 's'} · ${pullCount.toLocaleString()} selected pull${pullCount === 1 ? '' : 's'}${missing ? ` · ${missing.toLocaleString()} price${missing === 1 ? '' : 's'} missing` : ''}</small></div><div class="history-record-total"><b>${escapeHtml(formatExactCurrency(record.gross_sales_cents || 0))}</b><em class="${escapeHtml(result.className)}">${escapeHtml(result.label)}</em></div></summary>
        <div class="history-record-details">
          <div class="history-financials"><span><b>${escapeHtml(formatExactCurrency(record.gross_sales_cents || 0))}</b> gross sales</span><span><b>−${escapeHtml(formatExactCurrency(record.whatnot_fees?.totalWhatnotFeeCents || 0))}</b> Whatnot fees</span><span><b>${escapeHtml(formatSignedCurrency(record.whatnot_fees?.netPayoutCents || 0))}</b> payout after fees</span><span><b>−${escapeHtml(formatExactCurrency(record.box_cost_cents || 0))}</b> box cost</span><span class="${escapeHtml(result.className)}"><b>${escapeHtml(result.label)}</b> real box result</span></div>
          ${historyFeeBreakdown(record)}
          ${record.notes ? `<p class="history-notes">${escapeHtml(record.notes)}</p>` : ''}
          <form class="history-edit-form" data-history-edit-form="${Number(record.id)}">
            <label>Box name<input name="breakName" maxlength="140" value="${escapeHtml(record.break_name || '')}" required /></label>
            <label>Final sales total<input name="finalSales" inputmode="decimal" value="${escapeHtml(historyCostInputValue(record.gross_sales_cents))}" placeholder="0.00" required /></label>
            <label>Box cost<input name="boxCost" inputmode="decimal" value="${escapeHtml(historyCostInputValue(record.box_cost_cents))}" placeholder="0.00" /></label>
            <section class="history-edit-fees"><header><div><small>EDITABLE WHATNOT FEES</small><strong>Use the automatic estimate before a show or enter the statement total afterward.</strong></div></header><div>
              <label>Commission %<input name="whatnotCommissionRate" inputmode="decimal" value="${escapeHtml(percentageInputValue(record.whatnot_commission_bps))}" /></label>
              <label>Processing %<input name="whatnotProcessingRate" inputmode="decimal" value="${escapeHtml(percentageInputValue(record.whatnot_processing_bps))}" /></label>
              <label>Fee per transaction<input name="whatnotTransactionFee" inputmode="decimal" value="${escapeHtml(historyFeeInputValue(record.whatnot_transaction_fee_cents))}" /></label>
              <label>Transactions <span>(blank = ${Number(record.whatnot_fees?.transactionCount || 0)} priced spots)</span><input name="whatnotTransactionCount" inputmode="numeric" value="${escapeHtml(historyTransactionCountInput(record))}" placeholder="Automatic" /></label>
              <label>Tax on processing fee % <span>(Texas default)</span><input name="whatnotFeeTaxRate" inputmode="decimal" value="${escapeHtml(percentageInputValue(record.whatnot_fee_tax_bps))}" /></label>
              <label>Additional Whatnot fees<input name="whatnotAdditionalFees" inputmode="decimal" value="${escapeHtml(historyFeeInputValue(record.whatnot_additional_fee_cents))}" placeholder="0.00" /></label>
              <label class="history-actual-fee-field">Actual total Whatnot fees <span>(optional override)</span><input name="whatnotActualFees" inputmode="decimal" value="${record.whatnot_actual_fee_cents == null ? '' : escapeHtml(historyFeeInputValue(record.whatnot_actual_fee_cents))}" placeholder="Exact amount from Whatnot" /></label>
            </div></section>
            <label class="history-edit-notes">Notes<textarea name="notes" maxlength="1200" rows="2" placeholder="Optional notes">${escapeHtml(record.notes || '')}</textarea></label>
            <div class="history-edit-actions"><button class="secondary-button" type="submit">Recalculate &amp; Save</button><button class="history-delete-button" type="button" data-history-delete="${Number(record.id)}">Delete Saved Box</button></div>
          </form>
          ${historyTrackerDestinationForm(record)}
          <section class="saved-buyer-bags"><div class="history-buyer-bags-heading"><div><small>ARCHIVED SPOT POSITIONS</small><h3>Saved Buyer Spots</h3><p>Orders History shows only each buyer's purchased spot positions and prices. Exact pulled cards and their images remain available in Pull History.</p></div></div><div class="saved-buyer-bag-grid">${savedBuyerBags(record)}</div></section>
        </div>
      </details>`;
    }).join('')}${records.length < totalRecords ? `<div class="history-load-more"><button class="secondary-button" type="button" data-history-load-more="orders">Load ${Math.min(HISTORY_PAGE_SIZE, totalRecords - records.length)} older box${totalRecords - records.length === 1 ? '' : 'es'}</button><span>Showing ${records.length.toLocaleString()} of ${totalRecords.toLocaleString()}</span></div>` : ''}`
    : '<div class="history-empty"><b>No saved breaks yet</b><span>Select the exact cards pulled in Buyer Bags, then archive the completed Box or Case above. Order History and Box Tracker save together.</span></div>';
}

function setHistoryTab(tab) {
  state.historyTab = ['orders', 'pulls'].includes(tab) ? tab : 'orders';
  elements.historyTabs.forEach(button => {
    const active = button.dataset.historyTab === state.historyTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  elements.historyOrdersPane.classList.toggle('hidden', state.historyTab !== 'orders');
  elements.historyPullsPane.classList.toggle('hidden', state.historyTab !== 'pulls');
  if (state.view === 'history') refreshOrderHistory().catch(error => {
    if (state.historyTab === 'orders') {
      state.orderHistorySaveStatus = error.message || 'The saved order history could not be loaded.';
      renderOrderHistory();
    } else {
      state.historyPullStatus = error.message || 'The saved Pull History could not be loaded.';
      renderPullHistory();
    }
  });
}

function pullHistoryBuyerKey(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase() || 'unknown-buyer';
}

function showHistoryCardPreview(imageUrl, name) {
  if (!imageUrl) return;
  const existing = document.querySelector('.history-card-preview-backdrop');
  if (existing) existing.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'history-card-preview-backdrop';
  const cardName = name || 'Saved card';
  backdrop.innerHTML = `<div class="history-card-preview" role="dialog" aria-label="${escapeHtml(cardName)}"><button type="button" aria-label="Close preview">×</button><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(cardName)}"></div>`;
  backdrop.addEventListener('click', event => { if (event.target === backdrop || event.target.closest('button')) backdrop.remove(); });
  document.body.append(backdrop);
}

function bindHistoryCardPreviewButtons(container) {
  container?.querySelectorAll('[data-history-card-preview]').forEach(button => {
    button.addEventListener('click', () => showHistoryCardPreview(button.dataset.historyCardPreview, button.dataset.historyCardName));
  });
}

let pullHistoryCardSearchTimer = null;
let pullHistoryCardSearchSequence = 0;

function pullHistoryCardSearchFacts(card = {}) {
  const rarity = card.break_rarity || card.rarity || '';
  const treatment = card.collector_treatment || card.variant || card.manual_category || '';
  return [card.set_code, card.card_number, rarity, treatment && treatment !== 'Standard' ? treatment : '']
    .filter(Boolean)
    .join(' · ');
}

function renderPullHistoryCardResults() {
  if (!elements.pullHistoryCardResults) return;
  const edit = state.pullHistoryCardEdit;
  if (!edit) {
    elements.pullHistoryCardResults.innerHTML = '';
    return;
  }
  const cards = Array.isArray(edit.cards) ? edit.cards : [];
  if (!cards.length) {
    const message = edit.searched
      ? 'No exact cards matched this saved game and set. Try the card name or collector number.'
      : 'Type at least two characters from the card name or card number. Only cards that belong to this saved box will appear.';
    elements.pullHistoryCardResults.innerHTML = `<div class="pull-history-card-results-empty">${escapeHtml(message)}</div>`;
    return;
  }
  elements.pullHistoryCardResults.innerHTML = cards.map(card => {
    const selected = Number(card.id) === Number(edit.selectedCardId);
    const art = card.image_url
      ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name || 'Card')}" loading="lazy">`
      : '<i>♧</i>';
    return `<button class="pull-history-card-result ${selected ? 'selected' : ''}" type="button" data-pull-history-card-id="${Number(card.id)}" aria-pressed="${selected}"><span class="pull-history-card-result-art">${art}</span><span class="pull-history-card-result-copy"><strong>${escapeHtml(card.name || 'Unnamed card')}</strong><span>${escapeHtml(pullHistoryCardSearchFacts(card) || 'Exact printing')}</span></span></button>`;
  }).join('');
}

function closePullHistoryCardEditor() {
  clearTimeout(pullHistoryCardSearchTimer);
  pullHistoryCardSearchSequence += 1;
  elements.pullHistoryCardModal?.classList.add('hidden');
  state.pullHistoryCardEdit = null;
  if (elements.pullHistoryCardStatus) {
    elements.pullHistoryCardStatus.textContent = '';
    elements.pullHistoryCardStatus.className = 'maintenance-status';
  }
}

function openPullHistoryCardEditor(button) {
  const batchId = Number(button?.dataset.pullHistoryAddCardBatch);
  const buyerKey = String(button?.dataset.pullHistoryAddCardBuyer || '');
  const batch = state.pullHistory.find(value => Number(value.id) === batchId);
  const buyer = (batch?.buyer_summaries || []).find(value => pullHistoryBuyerKey(value.buyer_name) === buyerKey);
  const spots = (batch?.spots || []).filter(spot => pullHistoryBuyerKey(spot.buyer_name) === buyerKey);
  if (!batch || !buyer || !spots.length) throw new Error('The saved buyer spots for this Pull History record could not be found.');
  state.pullHistoryCardEdit = { batchId, buyerKey, selectedCardId: null, cards: [], searched: false };
  const gameName = batch.game_code === 'RIFTBOUND' ? 'Riftbound' : 'One Piece';
  const setName = [batch.set_code, batch.set_name].filter(Boolean).join(' · ') || 'saved set';
  elements.pullHistoryCardTitle.textContent = `Add a missed card to ${buyerHandle(buyer.buyer_name)}`;
  elements.pullHistoryCardDescription.textContent = `${gameName} · ${setName}. The saved Pull History, archived buyer bag, and existing linked Box Tracker will be corrected together; the live board will not change.`;
  elements.pullHistoryCardSpot.innerHTML = spots.map(spot => `<option value="${Number(spot.position)}">Spot ${String(Number(spot.position)).padStart(2, '0')} · ${escapeHtml(buyerHandle(spot.buyer_name))}</option>`).join('');
  elements.pullHistoryCardQuantity.value = '1';
  elements.pullHistoryCardSearch.value = '';
  elements.pullHistoryCardStatus.textContent = 'Search for the exact printing that was missed.';
  elements.pullHistoryCardStatus.className = 'maintenance-status';
  elements.savePullHistoryCard.disabled = true;
  elements.savePullHistoryCard.textContent = 'Add Card to History';
  renderPullHistoryCardResults();
  elements.pullHistoryCardModal.classList.remove('hidden');
  window.setTimeout(() => elements.pullHistoryCardSearch?.focus(), 0);
}

async function searchPullHistoryCards() {
  const edit = state.pullHistoryCardEdit;
  if (!edit) return;
  const batch = state.pullHistory.find(value => Number(value.id) === Number(edit.batchId));
  const query = String(elements.pullHistoryCardSearch?.value || '').trim();
  const sequence = ++pullHistoryCardSearchSequence;
  edit.selectedCardId = null;
  elements.savePullHistoryCard.disabled = true;
  if (query.length < 2) {
    edit.cards = [];
    edit.searched = false;
    elements.pullHistoryCardStatus.textContent = 'Type at least two characters to search this saved game and set.';
    elements.pullHistoryCardStatus.className = 'maintenance-status';
    renderPullHistoryCardResults();
    return;
  }
  elements.pullHistoryCardStatus.textContent = 'Searching exact printings…';
  elements.pullHistoryCardStatus.className = 'maintenance-status';
  try {
    const cards = await window.breakSuite.getCards({
      query,
      game: batch?.game_code || 'ONEPIECE',
      setCode: batch?.set_code && batch.set_code !== 'MULTI' ? batch.set_code : 'All',
      rarity: 'All',
      savedOnly: false
    });
    if (sequence !== pullHistoryCardSearchSequence || state.pullHistoryCardEdit !== edit) return;
    const expectedGame = String(batch?.game_code || 'ONEPIECE').trim().toUpperCase();
    const expectedSet = String(batch?.set_code || '').trim().toUpperCase();
    edit.cards = (Array.isArray(cards) ? cards : []).filter(card => {
      const game = String(card.game_code || 'ONEPIECE').trim().toUpperCase();
      const setCode = String(card.set_code || '').trim().toUpperCase();
      return game === expectedGame && (!expectedSet || expectedSet === 'MULTI' || setCode === expectedSet);
    }).slice(0, 80);
    edit.searched = true;
    elements.pullHistoryCardStatus.textContent = edit.cards.length
      ? `${edit.cards.length.toLocaleString()} exact match${edit.cards.length === 1 ? '' : 'es'} · select the missed card.`
      : 'No matching card was found in this saved game and set.';
    renderPullHistoryCardResults();
  } catch (error) {
    if (sequence !== pullHistoryCardSearchSequence || state.pullHistoryCardEdit !== edit) return;
    edit.cards = [];
    edit.searched = true;
    elements.pullHistoryCardStatus.textContent = error.message || 'The Library search could not be loaded.';
    elements.pullHistoryCardStatus.className = 'maintenance-status error';
    renderPullHistoryCardResults();
  }
}

function bindPullHistoryAddCardButtons(container) {
  container?.querySelectorAll('[data-pull-history-add-card-batch]').forEach(button => {
    if (button.dataset.pullHistoryAddCardBound === 'true') return;
    button.dataset.pullHistoryAddCardBound = 'true';
    button.addEventListener('click', () => {
      try {
        openPullHistoryCardEditor(button);
      } catch (error) {
        state.historyPullStatus = error.message || 'This saved buyer bag could not be edited.';
        if (elements.historyPullStatus) elements.historyPullStatus.textContent = state.historyPullStatus;
      }
    });
  });
}

function pullHistoryAuditCard(item) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const hasPrice = item.market_price_cents !== null && item.market_price_cents !== undefined && Number.isFinite(Number(item.market_price_cents));
  const unitPrice = hasPrice ? formatExactCurrency(item.market_price_cents) : (item.market_match_status === 'unmatched' ? 'No exact match' : 'Not priced');
  const cardTotal = hasPrice ? formatExactCurrency(item.market_total_cents) : 'Not priced';
  const imageUrl = String(item.image_url || '');
  const image = imageUrl
    ? `<button class="pull-history-audit-art" type="button" data-history-card-preview="${escapeHtml(imageUrl)}" data-history-card-name="${escapeHtml(item.card_name || 'Card')}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.card_name || 'Pulled card')}" loading="lazy"></button>`
    : '<div class="pull-history-audit-art missing"><span>Image unavailable</span></div>';
  return `<article class="pull-history-audit-card">
    ${image}
    <div class="pull-history-audit-copy">
      <span class="pull-history-audit-kicker">SPOT ${String(Number(item.position || 0)).padStart(2, '0')} · SAVED ×${quantity}</span>
      <strong>${escapeHtml(item.card_name || 'Unnamed card')}</strong>
      <div class="pull-history-audit-facts">
        <span><small>CARD NO.</small><b>${escapeHtml(item.card_number || '—')}</b></span>
        <span><small>RARITY</small><b>${escapeHtml(item.rarity || '—')}</b></span>
        <span><small>TREATMENT</small><b>${escapeHtml(item.collector_treatment || 'Standard')}</b></span>
        <span><small>UNIT PRICE</small><b>${escapeHtml(unitPrice)}</b></span>
        <span><small>QUANTITY</small><b>×${quantity}</b></span>
        <span><small>CARD TOTAL</small><b>${escapeHtml(cardTotal)}</b></span>
      </div>
      <footer><span>${escapeHtml(item.market_variant || (hasPrice ? item.market_source || 'Saved unit price' : 'Use the selected price source for this exact card'))}</span><b>${escapeHtml(cardTotal)}</b></footer>
    </div>
  </article>`;
}

function pullHistoryBuyerAuditPanel(batchId, buyer, items) {
  const quantity = items.reduce((total, item) => total + Math.max(1, Number(item.quantity || 1)), 0);
  const buyerKey = pullHistoryBuyerKey(buyer.buyer_name);
  return `<section class="pull-history-buyer-audit">
    <header><div><small>EXACT PULLED-CARD AUDIT</small><h4>${escapeHtml(buyerHandle(buyer.buyer_name))}</h4><p>Only cards saved with Save Selected Pulls. Click an image to inspect the exact printing.</p></div><div><button class="pull-history-add-card-button" type="button" data-pull-history-add-card-batch="${Number(batchId)}" data-pull-history-add-card-buyer="${escapeHtml(buyerKey)}">＋ Add Missed Card</button><b>${escapeHtml(formatExactCurrency(buyer.pull_value_cents || 0))}</b><span>${quantity.toLocaleString()} saved card${quantity === 1 ? '' : 's'}</span></div></header>
    <div class="pull-history-audit-grid">${items.map(pullHistoryAuditCard).join('')}</div>
  </section>`;
}

function syncPullHistoryBuyerValuesToggle() {
  const visible = state.pullHistoryBuyerValuesVisible;
  if (elements.togglePullHistoryBuyerValues) {
    elements.togglePullHistoryBuyerValues.textContent = visible ? 'Hide Buyer Values' : 'Show Buyer Values';
    elements.togglePullHistoryBuyerValues.setAttribute('aria-pressed', String(!visible));
    elements.togglePullHistoryBuyerValues.classList.toggle('active', !visible);
  }
  if (elements.pullHistoryPrivacyState) {
    elements.pullHistoryPrivacyState.textContent = visible ? 'BUYER VALUES VISIBLE' : 'BUYER VALUES HIDDEN';
    elements.pullHistoryPrivacyState.classList.toggle('privacy-active', !visible);
  }
}

function pullHistoryMessageScope(clickedBatchId) {
  const selectedIds = state.pullHistorySelectedBatchIds instanceof Set ? state.pullHistorySelectedBatchIds : new Set();
  const useCombined = selectedIds.size >= 2 && selectedIds.has(Number(clickedBatchId));
  const ids = useCombined ? selectedIds : new Set([Number(clickedBatchId)]);
  return {
    combined: useCombined,
    batches: state.pullHistory.filter(batch => ids.has(Number(batch.id)))
  };
}

function pullHistoryBuyerMessageData(clickedBatchId, buyerKey) {
  const scope = pullHistoryMessageScope(clickedBatchId);
  const items = [];
  let buyerName = '';
  let paidCents = 0;
  let spotCount = 0;
  for (const batch of scope.batches) {
    const summary = (batch.buyer_summaries || []).find(value => pullHistoryBuyerKey(value.buyer_name) === buyerKey);
    if (summary) {
      buyerName = buyerName || summary.buyer_name;
      paidCents += Number(summary.paid_cents || 0);
      spotCount += Number(summary.spot_count || 0);
    }
    for (const item of (batch.items || [])) {
      if (pullHistoryBuyerKey(item.buyer_name) !== buyerKey) continue;
      items.push({
        ...item,
        message_batch: batch,
        message_box_name: batch.saved_box_name || 'Saved box',
        message_set_name: batch.set_name || batch.set_code || ''
      });
      buyerName = buyerName || item.buyer_name;
    }
  }
  return {
    scope,
    buyer: { buyer_name: buyerName, paid_cents: paidCents, spot_count: spotCount },
    items
  };
}

function updatePullHistorySelectionState() {
  const count = state.pullHistorySelectedBatchIds?.size || 0;
  if (elements.pullHistorySelectionState) {
    elements.pullHistorySelectionState.textContent = count >= 2
      ? `${count} boxes selected - combined buyer messages are ON`
      : count === 1
        ? '1 box selected - messages still use one box only'
        : 'Select 2 or more boxes to combine the same buyer across those boxes';
    elements.pullHistorySelectionState.classList.toggle('active', count >= 2);
  }
  if (elements.clearPullHistorySelection) elements.clearPullHistorySelection.disabled = count === 0;
}

function markPullHistoryCombinedBuyerMessaged(buyerKey, scope) {
  if (!scope?.combined || !buyerKey) return;
  if (!(state.pullHistoryCombinedMessagedBuyers instanceof Set)) state.pullHistoryCombinedMessagedBuyers = new Set();
  state.pullHistoryCombinedMessagedBuyers.add(buyerKey);
  const selectedIds = state.pullHistorySelectedBatchIds instanceof Set ? state.pullHistorySelectedBatchIds : new Set();
  elements.pullHistoryRecords?.querySelectorAll(`[data-pull-history-message-buyer="${CSS.escape(buyerKey)}"]`).forEach(messageButton => {
    const batchId = Number(messageButton.dataset.pullHistoryMessageBatch);
    if (!selectedIds.has(batchId)) return;
    const card = messageButton.closest('.pull-history-buyer-card');
    card?.classList.add('combined-message-complete');
    const name = card?.querySelector('.pull-history-buyer strong');
    if (name) name.title = 'Already messaged in this combined group';
    messageButton.textContent = 'Messaged ✓';
    messageButton.title = 'Already messaged in this combined group. Click again only if you want to resend the combined message.';
  });
}

async function copyAndOpenPullHistoryBuyerMessage(button) {
  if (!button || button.disabled) return;
  const batchId = Number(button.dataset.pullHistoryMessageBatch);
  const buyerKey = String(button.dataset.pullHistoryMessageBuyer || '');
  const messageData = pullHistoryBuyerMessageData(batchId, buyerKey);
  const { scope, buyer, items } = messageData;
  const originalLabel = scope.combined ? 'Copy Combined ↗' : 'Copy + Message ↗';
  let copied = false;
  button.disabled = true;
  button.textContent = 'Copying…';
  try {
    if (!buyer?.buyer_name || !items.length) throw new Error('No saved pulls were found for this buyer.');
    const topHits = window.PullHistoryBuyerMessage.topHitsOnly(items);
    if (!topHits.length) throw new Error('No Alternate Art-or-higher hits were found. Epics and lower stay saved but are not copied.');
    const message = window.PullHistoryBuyerMessage.build({ batch: scope.batches[0] || {}, buyer, items: topHits });
    await navigator.clipboard.writeText(message);
    copied = true;
    markPullHistoryCombinedBuyerMessaged(buyerKey, scope);
    const profileUrl = window.WhatnotBuyerLink.profileUrl(buyer.buyer_name);
    if (!profileUrl) {
      button.textContent = scope.combined ? 'Combined copied ✓' : 'Message copied ✓';
      button.title = 'The pull message was copied, but this saved buyer name is not a valid Whatnot username.';
    } else {
      const opened = await window.breakSuite.openExternal(profileUrl);
      if (opened === false) throw new Error('Whatnot rejected the profile link.');
      button.textContent = scope.combined ? 'Combined ✓ Opened ↗' : 'Copied ✓ Opened ↗';
      button.title = `Copied ${window.PullHistoryBuyerMessage.hitCount(topHits)} top hit${window.PullHistoryBuyerMessage.hitCount(topHits) === 1 ? '' : 's'} for ${buyerHandle(buyer.buyer_name)}${scope.combined ? ` across ${scope.batches.length} selected boxes` : ''} and opened their Whatnot profile.`;
    }
  } catch (error) {
    button.textContent = copied ? 'Copied ✓ · Open failed' : 'Try again';
    button.title = error.message || 'The saved pull message could not be copied.';
  } finally {
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.disabled = false;
      const alreadyMessaged = scope.combined && state.pullHistoryCombinedMessagedBuyers?.has(buyerKey);
      button.textContent = alreadyMessaged ? 'Messaged ✓' : originalLabel;
      button.title = alreadyMessaged
        ? 'Already messaged in this combined group. Click again only if you want to resend the combined message.'
        : scope.combined
          ? 'Copy this buyer’s Alternate Art-or-higher hits from every selected box and open their Whatnot profile.'
          : 'Copy only Alternate Art-or-higher top hits for this buyer and open their Whatnot profile.';
    }, 2400);
  }
}

function renderPullHistory() {
  const batches = Array.isArray(state.pullHistory) ? state.pullHistory : [];
  const totalBatches = Math.max(batches.length, Number(state.pullHistoryTotalCount || 0));
  syncPullHistoryBuyerValuesToggle();
  if (elements.historyPullStatus) elements.historyPullStatus.textContent = state.historyPullStatus || 'Only the 10 newest pull records load initially. Older records remain saved until you request them.';
  elements.pullHistoryRecords.innerHTML = batches.length
    ? `${batches.map((batch, index) => {
      const items = Array.isArray(batch.items) ? batch.items : [];
      const buyers = Array.isArray(batch.buyer_summaries) ? batch.buyer_summaries : [];
      const valuation = batch.valuation || {};
      const setLabel = batch.set_code === 'MULTI'
        ? 'Multiple sets'
        : [batch.set_code, batch.set_name].filter(Boolean).join(' · ');
      const refreshing = state.pullHistoryPriceStatus.get(Number(batch.id))?.type === 'loading';
      const priceSource = activePriceSourceUi();
      const priceSourceDescription = activePriceSource() === 'ebay'
        ? 'Median of matching active eBay item + shipping prices; not sold comps.'
        : activePriceSource() === 'chatgpt'
          ? 'Copy exact printings to ChatGPT, then import one JSON answer.'
          : activePriceSource() === 'manual'
            ? 'Enter one unit value per exact printing; quantity is applied automatically.'
            : 'Near Mint English market values. Quantity ×2 counts as two copies.';
      const refreshMessage = state.pullHistoryPriceStatus.get(Number(batch.id))?.message || (batch.price_refreshed_at
        ? `Market prices last refreshed ${formatHistoryDate(batch.price_refreshed_at)}.`
        : 'Market prices have not been loaded for this pull record.');
      const complete = Boolean(valuation.complete);
      const resultClass = complete ? (Number(valuation.value_difference_cents || 0) >= 0 ? 'positive' : 'negative') : 'pending';
      const resultLabel = complete
        ? `Pull value − paid ${formatSignedCurrency(valuation.value_difference_cents)}`
        : !Number(valuation.spot_count || 0)
          ? 'Spot payments not captured for this older pull record'
          : `${Number(valuation.unpriced_cards || 0)} card${Number(valuation.unpriced_cards || 0) === 1 ? '' : 's'} or ${Number(valuation.missing_spot_prices || 0)} spot price${Number(valuation.missing_spot_prices || 0) === 1 ? '' : 's'} missing`;
      const focused = Number(state.focusedPullHistoryBatchId || 0) === Number(batch.id);
      const selectedForMessage = state.pullHistorySelectedBatchIds.has(Number(batch.id));
      const savedBoxLabel = String(batch.saved_box_name || '').trim();
      return `<details class="history-record ${focused ? 'focused-history-record' : ''} ${selectedForMessage ? 'pull-history-message-selected' : ''}" data-pull-history-batch-record="${Number(batch.id)}" ${index === 0 || focused || selectedForMessage ? 'open' : ''}>
        <summary><label class="pull-history-select-box" title="Select this saved box for a combined buyer message"><input type="checkbox" data-pull-history-select="${Number(batch.id)}" ${selectedForMessage ? 'checked' : ''}><span>Combine</span></label><div><span>SAVED ${escapeHtml(formatHistoryDate(batch.recorded_at))}</span><strong>${escapeHtml(savedBoxLabel || [batch.game_code === 'RIFTBOUND' ? 'Riftbound' : 'One Piece', setLabel].filter(Boolean).join(' · '))}</strong><small>${savedBoxLabel ? `${escapeHtml([batch.game_code === 'RIFTBOUND' ? 'Riftbound' : 'One Piece', setLabel].filter(Boolean).join(' · '))} - ` : ''}${Number(batch.total_cards || 0).toLocaleString()} exact selected card${Number(batch.total_cards || 0) === 1 ? '' : 's'} · ${Number(valuation.spot_count || 0).toLocaleString()} purchased spot${Number(valuation.spot_count || 0) === 1 ? '' : 's'}</small></div><div class="history-record-total"><b>${batch.price_refreshed_at ? escapeHtml(formatExactCurrency(valuation.pull_value_cents || 0)) : '—'}</b><em class="${escapeHtml(resultClass)}">${batch.price_refreshed_at ? 'PULL MARKET VALUE' : 'NOT PRICED'}</em></div></summary>
        <div class="history-record-details">
          <div class="pull-history-price-actions"><div><b>${escapeHtml(priceSource.label)}</b><span>${escapeHtml(priceSourceDescription)} Only this source replaces the batch valuation.</span></div><div class="pull-history-record-actions"><button class="secondary-button" type="button" data-pull-price-refresh="${Number(batch.id)}" ${refreshing ? 'disabled' : ''}>${refreshing ? 'Preparing…' : escapeHtml(priceSource.button)}</button><button class="history-delete-button" type="button" data-pull-history-delete="${Number(batch.id)}">Delete Pull Record</button></div><p class="${escapeHtml(state.pullHistoryPriceStatus.get(Number(batch.id))?.type || '')}">${escapeHtml(refreshMessage)}</p></div>
          <div class="history-financials pull-history-financials"><span><b>${escapeHtml(formatExactCurrency(valuation.paid_cents || 0))}</b> paid for spots</span><span><b>${escapeHtml(formatExactCurrency(valuation.pull_value_cents || 0))}</b> pull market value</span><span class="${escapeHtml(resultClass)}"><b>${escapeHtml(resultLabel)}</b>${complete ? ' positive means the buyer pulled more value' : ' refresh prices and capture every spot amount'}</span></div>
          <section class="pull-history-buyers"><div class="history-buyer-bags-heading"><div><small>VALUE BY BUYER</small><h3>Paid compared with pulled value</h3><p>Buyers glow green when they spent over $100 or pulled Promo, Alt Art/Showcase, SP, Ultimate, Overnumbered, or Signature. Copy + Message includes only those top hits; Epic and lower stay saved but are not copied.</p></div></div><div class="pull-history-buyer-grid">${buyers.map(buyer => {
            const buyerComplete = Boolean(buyer.complete);
            const buyerClass = buyerComplete ? (Number(buyer.value_difference_cents || 0) >= 0 ? 'positive' : 'negative') : 'pending';
            const buyerKey = pullHistoryBuyerKey(buyer.buyer_name);
            const expanded = state.pullHistoryExpandedBuyers.get(Number(batch.id)) === buyerKey;
            const buyerItems = items.filter(item => pullHistoryBuyerKey(item.buyer_name) === buyerKey);
            const hasPulls = buyerItems.length > 0;
            const scope = pullHistoryMessageScope(batch.id);
            const combinedData = scope.combined ? pullHistoryBuyerMessageData(batch.id, buyerKey) : null;
            const messageItems = combinedData ? combinedData.items : buyerItems;
            const topHitCount = window.PullHistoryBuyerMessage.hitCount(messageItems);
            const hasTopHits = topHitCount > 0;
            const priorityBuyer = window.PullHistoryBuyerMessage.isPriorityBuyer(buyer, buyerItems);
            const combinedBuyer = scope.combined && hasTopHits;
            const combinedMessageComplete = combinedBuyer && state.pullHistoryCombinedMessagedBuyers?.has(buyerKey);
            return `<article class="pull-history-buyer-card ${priorityBuyer ? 'priority-spender' : ''} ${combinedBuyer ? 'combined-message-buyer' : ''} ${combinedMessageComplete ? 'combined-message-complete' : ''}">
              <button class="pull-history-buyer-message" type="button" data-pull-history-message-batch="${Number(batch.id)}" data-pull-history-message-buyer="${escapeHtml(buyerKey)}" title="${combinedMessageComplete ? 'Already messaged in this combined group. Click again only if you want to resend the combined message.' : (hasTopHits ? `Copy ${topHitCount} top hit${topHitCount === 1 ? '' : 's'}${combinedBuyer ? ` from ${scope.batches.length} selected boxes` : ''} and open this buyer's Whatnot profile.` : (hasPulls ? 'Epic and lower cards stay saved but are not included in buyer messages.' : 'No saved pulls are available for this buyer.'))}" ${hasTopHits ? '' : 'disabled'}>${combinedMessageComplete ? 'Messaged ✓' : (hasTopHits ? (combinedBuyer ? 'Copy Combined ↗' : 'Copy + Message ↗') : (hasPulls ? 'No top hits' : 'No pulls saved'))}</button>
              <button class="pull-history-buyer ${expanded ? 'expanded' : ''} ${state.pullHistoryBuyerValuesVisible ? '' : 'buyer-values-hidden'}" type="button" data-pull-history-buyer="${escapeHtml(buyerKey)}" data-pull-history-batch="${Number(batch.id)}" aria-expanded="${expanded}"><strong>${escapeHtml(buyerHandle(buyer.buyer_name))}</strong><span>${Number(buyer.spot_count || 0)} spot${Number(buyer.spot_count || 0) === 1 ? '' : 's'} · ${Number(buyer.pulled_cards || 0)} card${Number(buyer.pulled_cards || 0) === 1 ? '' : 's'}</span>${state.pullHistoryBuyerValuesVisible ? `<div><small>PAID<b>${escapeHtml(formatExactCurrency(buyer.paid_cents || 0))}</b></small><small>PULL VALUE<b>${escapeHtml(formatExactCurrency(buyer.pull_value_cents || 0))}</b></small><small class="${escapeHtml(buyerClass)}">VALUE − PAID<b>${buyerComplete ? escapeHtml(formatSignedCurrency(buyer.value_difference_cents)) : 'Incomplete'}</b></small></div>` : ''}<i>${expanded ? 'Hide pulled cards ▲' : 'View pulled cards ▼'}</i></button>
            </article>${expanded ? pullHistoryBuyerAuditPanel(batch.id, buyer, buyerItems) : ''}`;
          }).join('')}</div></section>
        </div>
      </details>`;
    }).join('')}${batches.length < totalBatches ? `<div class="history-load-more"><button class="secondary-button" type="button" data-history-load-more="pulls">Load ${Math.min(HISTORY_PAGE_SIZE, totalBatches - batches.length)} older pull record${totalBatches - batches.length === 1 ? '' : 's'}</button><span>Showing ${batches.length.toLocaleString()} of ${totalBatches.toLocaleString()}</span></div>` : ''}`
    : '<div class="history-empty"><b>No saved pulls yet</b><span>Select the exact cards actually pulled in Buyer Bags, then press Save Selected Pulls. Orders History spots are never copied automatically.</span></div>';
  elements.pullHistoryRecords.querySelectorAll('[data-pull-history-select]').forEach(input => {
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('change', event => {
      const batchId = Number(event.currentTarget.dataset.pullHistorySelect);
      if (event.currentTarget.checked) state.pullHistorySelectedBatchIds.add(batchId);
      else state.pullHistorySelectedBatchIds.delete(batchId);
      state.pullHistoryCombinedMessagedBuyers.clear();
      renderPullHistory();
    });
  });
  updatePullHistorySelectionState();
  elements.pullHistoryRecords.querySelectorAll('[data-pull-price-refresh]').forEach(button => {
    button.addEventListener('click', () => refreshPullHistoryPrices(Number(button.dataset.pullPriceRefresh)));
  });
  elements.pullHistoryRecords.querySelectorAll('[data-pull-history-delete]').forEach(button => {
    button.addEventListener('click', () => deletePullHistoryRecord(button));
  });
  elements.pullHistoryRecords.querySelectorAll('[data-pull-history-message-batch]').forEach(button => {
    button.addEventListener('click', () => copyAndOpenPullHistoryBuyerMessage(button));
  });
  elements.pullHistoryRecords.querySelectorAll('[data-pull-history-buyer]').forEach(button => {
    button.addEventListener('click', () => {
      const batchId = Number(button.dataset.pullHistoryBatch);
      const buyerKey = button.dataset.pullHistoryBuyer;
      const grid = button.closest('.pull-history-buyer-grid');
      const wasExpanded = state.pullHistoryExpandedBuyers.get(batchId) === buyerKey;
      grid?.querySelector('.pull-history-buyer-audit')?.remove();
      grid?.querySelectorAll('.pull-history-buyer.expanded').forEach(active => {
        active.classList.remove('expanded');
        active.setAttribute('aria-expanded', 'false');
        const label = active.querySelector('i');
        if (label) label.textContent = 'View pulled cards ▼';
      });
      if (wasExpanded) {
        state.pullHistoryExpandedBuyers.delete(batchId);
        return;
      }
      const batch = state.pullHistory.find(value => Number(value.id) === batchId);
      const buyer = (batch?.buyer_summaries || []).find(value => pullHistoryBuyerKey(value.buyer_name) === buyerKey);
      if (!batch || !buyer) return;
      const buyerItems = (batch.items || []).filter(item => pullHistoryBuyerKey(item.buyer_name) === buyerKey);
      state.pullHistoryExpandedBuyers.set(batchId, buyerKey);
      button.classList.add('expanded');
      button.setAttribute('aria-expanded', 'true');
      const label = button.querySelector('i');
      if (label) label.textContent = 'Hide pulled cards ▲';
      const card = button.closest('.pull-history-buyer-card');
      card?.insertAdjacentHTML('afterend', pullHistoryBuyerAuditPanel(batch.id, buyer, buyerItems));
      bindHistoryCardPreviewButtons(card?.nextElementSibling);
      bindPullHistoryAddCardButtons(card?.nextElementSibling);
    });
  });
  elements.pullHistoryRecords.querySelector('[data-history-load-more="pulls"]')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    state.pullHistoryVisibleCount += HISTORY_PAGE_SIZE;
    await refreshOrderHistory().catch(error => {
      state.historyPullStatus = error.message || 'Older Pull History records could not be loaded.';
      renderPullHistory();
    });
  });
  bindHistoryCardPreviewButtons(elements.pullHistoryRecords);
  bindPullHistoryAddCardButtons(elements.pullHistoryRecords);
}

if (elements.clearPullHistorySelection) {
  elements.clearPullHistorySelection.addEventListener('click', () => {
    state.pullHistorySelectedBatchIds.clear();
    state.pullHistoryCombinedMessagedBuyers.clear();
    renderPullHistory();
  });
}

if (elements.togglePullHistoryBuyerValues) {
  elements.togglePullHistoryBuyerValues.addEventListener('click', () => {
    state.pullHistoryBuyerValuesVisible = !state.pullHistoryBuyerValuesVisible;
    renderPullHistory();
  });
}

elements.cancelPullHistoryCard?.addEventListener('click', closePullHistoryCardEditor);
elements.pullHistoryCardModal?.addEventListener('click', event => {
  if (event.target === elements.pullHistoryCardModal) closePullHistoryCardEditor();
});
elements.pullHistoryCardSearch?.addEventListener('input', () => {
  clearTimeout(pullHistoryCardSearchTimer);
  pullHistoryCardSearchTimer = window.setTimeout(() => searchPullHistoryCards(), 180);
});
elements.pullHistoryCardResults?.addEventListener('click', event => {
  const button = event.target.closest('[data-pull-history-card-id]');
  const edit = state.pullHistoryCardEdit;
  if (!button || !edit) return;
  const cardId = Number(button.dataset.pullHistoryCardId);
  if (!edit.cards.some(card => Number(card.id) === cardId)) return;
  edit.selectedCardId = cardId;
  elements.savePullHistoryCard.disabled = false;
  elements.pullHistoryCardStatus.textContent = 'Exact card selected. Confirm the buyer spot and quantity, then add it.';
  elements.pullHistoryCardStatus.className = 'maintenance-status success';
  renderPullHistoryCardResults();
});
elements.pullHistoryCardForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const edit = state.pullHistoryCardEdit;
  const selected = edit?.cards?.find(card => Number(card.id) === Number(edit.selectedCardId));
  if (!edit || !selected || elements.savePullHistoryCard.disabled) return;
  const position = Number(elements.pullHistoryCardSpot.value);
  const quantity = Number(elements.pullHistoryCardQuantity.value);
  elements.savePullHistoryCard.disabled = true;
  elements.savePullHistoryCard.textContent = 'Correcting History…';
  elements.pullHistoryCardStatus.textContent = 'Updating the saved buyer bag and linked tracker…';
  elements.pullHistoryCardStatus.className = 'maintenance-status';
  try {
    const result = await window.breakSuite.addPullHistoryCard({
      batchId: edit.batchId,
      position,
      cardId: selected.id,
      quantity
    });
    const action = result.merged
      ? `increased ${selected.name || 'the exact card'} to ×${Number(result.quantity || 1)}`
      : `added ${selected.name || 'the missed card'} ×${Number(result.addedQuantity || quantity || 1)}`;
    const trackerNote = Number(result.rebuiltTrackerCount || 0) > 0 ? ' and rebuilt its linked Box Tracker' : '';
    closePullHistoryCardEditor();
    state.historyPullStatus = `✓ Corrected Pull History: ${action}${trackerNote}. The live board was not changed.`;
    await Promise.all([refreshOrderHistory(), refreshOpenBoxCases()]);
  } catch (error) {
    elements.pullHistoryCardStatus.textContent = error.message || 'The missed card could not be added to Pull History.';
    elements.pullHistoryCardStatus.className = 'maintenance-status error';
    elements.savePullHistoryCard.disabled = false;
  } finally {
    elements.savePullHistoryCard.textContent = 'Add Card to History';
  }
});

async function deletePullHistoryRecord(button) {
  const id = Number(button?.dataset.pullHistoryDelete);
  const batch = state.pullHistory.find(value => Number(value.id) === id);
  if (!id || !batch) return;
  const label = [batch.game_code === 'RIFTBOUND' ? 'Riftbound' : 'One Piece', batch.set_code, formatHistoryDate(batch.recorded_at)].filter(Boolean).join(' · ');
  if (!window.confirm(`Delete this Pull History record (${label})? This removes only this saved Pull History batch and its market-value calculations. It will not change Orders History, archived buyer bags, the live Break Board, Breaker Center, Connector, or OBS.`)) return;
  button.disabled = true;
  state.historyPullStatus = 'Deleting the mistaken Pull History record…';
  if (elements.historyPullStatus) elements.historyPullStatus.textContent = state.historyPullStatus;
  try {
    await window.breakSuite.deletePullHistory(id);
    state.pullHistoryExpandedBuyers.delete(id);
    state.pullHistoryPriceStatus.delete(id);
    state.historyPullStatus = `✓ Deleted the Pull History record from ${formatHistoryDate(batch.recorded_at)}. Live break and archived order records were unchanged.`;
    await refreshOrderHistory();
  } catch (error) {
    state.historyPullStatus = error.message || 'The Pull History record could not be deleted.';
    renderPullHistory();
  }
}

async function refreshPullHistoryPrices(batchId) {
  const id = Number(batchId);
  if (!id || state.pullHistoryPriceStatus.get(id)?.type === 'loading') return;
  state.pullHistoryPriceStatus.set(id, { type: 'loading', message: `Preparing ${activePriceSourceUi().label} for every exact card in this saved pull record…` });
  renderPullHistory();
  try {
    if (activePriceSourceUi().action === 'input') {
      await openPullHistoryPriceInput(id);
      state.pullHistoryPriceStatus.set(id, { type: 'pending', message: `${activePriceSourceUi().label} is open. Save the whole list to replace this batch’s valuation.` });
      renderPullHistory();
      return;
    }
    const result = await window.breakSuite.refreshPullHistoryPrices(id);
    const missing = Number(result.unmatchedCards || 0);
    state.pullHistoryPriceStatus.set(id, {
      type: missing ? 'pending' : 'success',
      message: `✓ Priced ${Number(result.matchedCards || 0).toLocaleString()} card${Number(result.matchedCards || 0) === 1 ? '' : 's'} with ${result.source}${missing ? ` · ${missing.toLocaleString()} exact match${missing === 1 ? '' : 'es'} missing` : ''} · ${formatExactCurrency(result.marketValueCents || 0)} total value.`
    });
    await refreshOrderHistory();
  } catch (error) {
    state.pullHistoryPriceStatus.set(id, { type: 'error', message: error.message || 'Pull prices could not be refreshed.' });
    renderPullHistory();
  }
}

async function refreshOrderHistory() {
  // History grows forever, so never query and rebuild it behind the live
  // Breaker/Connector screens. It is loaded fresh when Orders History opens.
  if (state.view !== 'history') return;
  if (state.historyTab === 'pulls') {
    const page = await window.breakSuite.getPullHistory({ limit: state.pullHistoryVisibleCount });
    state.pullHistory = Array.isArray(page) ? page : (page.records || []);
    state.pullHistoryTotalCount = Array.isArray(page) ? page.length : Number(page.totalCount || 0);
    renderPullHistory();
    return;
  }
  const page = await window.breakSuite.getOrderHistory({ limit: state.orderHistoryVisibleCount });
  state.orderHistory = Array.isArray(page) ? page : (page.records || []);
  state.orderHistoryTotalCount = Array.isArray(page) ? page.length : Number(page.totalCount || 0);
  state.orderHistorySummary = Array.isArray(page) ? {} : (page.summary || {});
  renderOrderHistory();
}

async function saveSelectedPullsToHistory(button, renderCurrentCenter) {
  if (!button || button.disabled) return;
  button.disabled = true;
  state.pullHistorySaveStatus = 'Saving the exact selected cards to Pull History…';
  renderCurrentCenter();
  try {
    const result = await window.breakSuite.saveCurrentPullHistory();
    state.pullHistorySaveStatus = `✓ ${result.updated ? 'Updated' : 'Saved'} this live board with ${Number(result.savedCards).toLocaleString()} actual pull${Number(result.savedCards) === 1 ? '' : 's'}. Selections were not cleared.`;
    await refreshOrderHistory();
  } catch (error) {
    state.pullHistorySaveStatus = error.message || 'The selected pulls could not be saved.';
  }
  renderCurrentCenter();
}

function renderBusinessSnapshot() {
  if (!elements.businessSnapshot || !elements.businessSnapshotHealth) return;
  const snapshot = state.businessSnapshot;
  const years = Array.isArray(state.businessExpenseYears) ? state.businessExpenseYears : [];
  if (elements.businessExpenseYear) {
    const desired = Number(snapshot?.taxYear || state.businessExpenseYear || new Date().getFullYear());
    const options = years.length ? years : [desired];
    elements.businessExpenseYear.innerHTML = options.map(year => `<option value="${Number(year)}"${Number(year) === desired ? ' selected' : ''}>${Number(year)}</option>`).join('');
  }
  if (!snapshot) {
    elements.businessSnapshot.innerHTML = '<div class="history-empty"><b>No business snapshot yet</b><span>Save completed boxes and expenses, then recalculate.</span></div>';
    elements.businessSnapshotHealth.innerHTML = '';
    return;
  }
  const profit = Number(snapshot.trackedProfitCents || 0);
  const sales = Number(snapshot.grossSalesCents || 0);
  const margin = Number(snapshot.profitMarginPercent || 0);
  const tax = snapshot.tax || {};
  const scenarios = Array.isArray(tax.federalScenarios) ? tax.federalScenarios : [];
  const low = scenarios[0] || {};
  const middle = scenarios[1] || low;
  const high = scenarios[scenarios.length - 1] || middle;
  const reserve25 = Math.round(Math.max(0, profit) * .25);
  const taxRange = scenarios.length
    ? `${formatExactCurrency(low.combinedFederalTaxCents || 0)} – ${formatExactCurrency(high.combinedFederalTaxCents || 0)}`
    : formatExactCurrency(tax.selfEmploymentTaxCents || 0);
  const profitClass = profit > 0 ? 'positive' : (profit < 0 ? 'negative' : 'neutral');
  elements.businessSnapshot.innerHTML = `
    <div class="business-profit-hero ${profitClass}">
      <div><span>${Number(snapshot.taxYear)} TRACKED NET PROFIT</span><strong>${profit < 0 ? '−' : ''}${escapeHtml(formatExactCurrency(Math.abs(profit)))}</strong><small>${sales > 0 ? `${margin.toFixed(1)}% margin from ${formatExactCurrency(sales)} sales` : 'No recorded sales for this year yet'}</small></div>
      <div class="business-tax-range"><span>POTENTIAL FEDERAL TAX RANGE</span><strong>${escapeHtml(taxRange)}</strong><small>SE tax + 10% to 22% income-tax planning scenarios</small></div>
    </div>
    <div class="business-metric-grid">
      <article><span>Gross sales</span><b>${escapeHtml(formatExactCurrency(snapshot.grossSalesCents || 0))}</b><small>${Number(snapshot.normalBoxCount || 0)} completed sale box${Number(snapshot.normalBoxCount || 0) === 1 ? '' : 'es'}</small></article>
      <article><span>Whatnot fees</span><b>−${escapeHtml(formatExactCurrency(snapshot.whatnotFeeCents || 0))}</b><small>${Number(snapshot.health?.actualFeeBoxCount || 0)} actual · ${Number(snapshot.health?.estimatedFeeBoxCount || 0)} estimated</small></article>
      <article><span>Sold-box cost</span><b>−${escapeHtml(formatExactCurrency(snapshot.soldBoxCostCents || 0))}</b><small>Cost recorded on completed sales</small></article>
      <article><span>Business adjustments</span><b>−${escapeHtml(formatExactCurrency(snapshot.adjustmentCostCents || 0))}</b><small>Giveaways, make-goods, damaged/lost inventory</small></article>
      <article><span>Operating expenses</span><b>−${escapeHtml(formatExactCurrency(snapshot.operatingExpenseCents || 0))}</b><small>Supplies, equipment, and other recorded expenses</small></article>
      <article class="inventory"><span>Inventory purchases tracked</span><b>${escapeHtml(formatExactCurrency(snapshot.inventoryPurchaseCents || 0))}</b><small>Shown separately so sold-box cost is not deducted twice</small></article>
    </div>
    <div class="business-tax-panel">
      <div class="business-tax-copy"><span>FEDERAL TAX PLANNER</span><strong>Estimated self-employment tax: ${escapeHtml(formatExactCurrency(tax.selfEmploymentTaxCents || 0))}</strong><small>Uses 92.35% of positive tracked business profit, then Social Security + Medicare. The Social Security cap assumes no other wages already used the annual wage base; the half-SE-tax deduction shown below is used only in the rough income-tax scenarios.</small></div>
      <div class="business-tax-mini"><span>SE net earnings<b>${escapeHtml(formatExactCurrency(tax.seNetEarningsCents || 0))}</b></span><span>½ SE-tax deduction<b>${escapeHtml(formatExactCurrency(tax.halfSelfEmploymentTaxDeductionCents || 0))}</b></span><span>25% cash reserve<b>${escapeHtml(formatExactCurrency(reserve25))}</b></span></div>
      <div class="business-tax-scenarios">${scenarios.map(item => `<article><span>IF IN ${Number(item.ratePercent)}% FEDERAL BRACKET</span><b>${escapeHtml(formatExactCurrency(item.combinedFederalTaxCents || 0))}</b><small>${formatExactCurrency(tax.selfEmploymentTaxCents || 0)} SE tax + ${formatExactCurrency(item.federalIncomeTaxCents || 0)} rough income tax</small></article>`).join('')}</div>
    </div>`;
  const health = snapshot.health || {};
  const issues = Array.isArray(health.issues) ? health.issues : [];
  elements.businessSnapshotHealth.innerHTML = `<div class="business-health-title ${health.verified ? 'verified' : 'review'}"><b>${health.verified ? '✓ DATA LOOKS COMPLETE' : `${Number(health.issueCount || issues.length)} ITEM${Number(health.issueCount || issues.length) === 1 ? '' : 'S'} TO REVIEW`}</b><span>${health.verified ? 'The recorded boxes, costs, purchase prices, and fee records needed for this estimate are present.' : 'The dashboard keeps calculating from saved data, but these items can change the final number.'}</span></div>${issues.length ? `<div class="business-health-issues">${issues.map(issue => `<span>• ${escapeHtml(issue)}</span>`).join('')}</div>` : ''}${Number(snapshot.personalUseCents || 0) ? `<div class="business-health-note"><b>${escapeHtml(formatExactCurrency(snapshot.personalUseCents || 0))}</b> owner/personal use is tracked but excluded from business-profit and tax estimates.</div>` : ''}${Number(snapshot.manualWhatnotFeeCents || 0) ? `<div class="business-health-note"><b>${escapeHtml(formatExactCurrency(snapshot.manualWhatnotFeeCents || 0))}</b> manual Whatnot fee entries are visible but excluded because the saved box fee calculation already accounts for fees.</div>` : ''}`;
}

function formatExpenseReportDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }
  return formatHistoryDate(text);
}

function formatReportResult(cents) {
  const amount = Number(cents || 0);
  return `${amount < 0 ? '−' : ''}${formatExactCurrency(Math.abs(amount))}`;
}

function printEmptyRow(message, columns) {
  return `<tr class="print-empty-row"><td colspan="${Number(columns)}">${escapeHtml(message)}</td></tr>`;
}

function renderBusinessExpensePrintReport() {
  if (!elements.businessPrintReport) return;
  const report = state.businessExpenseReport;
  if (!report) {
    elements.businessPrintReport.innerHTML = '';
    return;
  }
  const totals = report.totals || {};
  const allExpenseRows = Array.isArray(report.allExpenseRows) ? report.allExpenseRows : [];
  const healthIssues = Array.isArray(state.businessSnapshot?.health?.issues) ? state.businessSnapshot.health.issues : [];
  const generatedAt = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date());
  const allExpenseHtml = allExpenseRows.length ? allExpenseRows.map(row => {
    const detailLines = [
      row.source || '',
      row.vendor ? `Vendor: ${row.vendor}` : '',
      row.grossSalesCents != null ? `Gross sales ${formatExactCurrency(row.grossSalesCents)} · Break net ${formatReportResult(row.netResultCents)}` : '',
      row.notes || ''
    ].filter(Boolean);
    return `
    <tr>
      <td>${escapeHtml(formatExpenseReportDate(row.occurredOn))}</td>
      <td>${escapeHtml(row.category)}</td>
      <td><strong>${escapeHtml(row.description)}</strong>${detailLines.map(line => `<small>${escapeHtml(line)}</small>`).join('')}</td>
      <td><span class="print-treatment ${escapeHtml(String(row.treatment?.code || '').toLowerCase())}">${escapeHtml(row.treatment?.label || '')}</span></td>
      <td class="print-money"><strong>${escapeHtml(formatExactCurrency(row.amountCents))}</strong></td>
    </tr>`;
  }).join('') : printEmptyRow('No business expense records were saved for this year.', 5);
  const reviewNotes = [
    ...healthIssues,
    Number(totals.inventoryPurchaseCents || 0) ? `${formatExactCurrency(totals.inventoryPurchaseCents)} of sealed inventory purchases is tracked separately so sold-box cost is not deducted twice.` : '',
    Number(totals.duplicateManualFeeCents || 0) ? `${formatExactCurrency(totals.duplicateManualFeeCents)} of manual Whatnot fee entries is excluded because the saved break rows already include fees.` : '',
    Number(totals.personalUseCents || 0) ? `${formatExactCurrency(totals.personalUseCents)} of owner/personal use is recorded but not deducted.` : ''
  ].filter(Boolean);
  elements.businessPrintReport.innerHTML = `
    <header class="print-report-header">
      <div><span>BREAKSUITE6 PRIVATE BUSINESS ACCOUNTING</span><h1>${Number(report.taxYear)} Business Expense &amp; Break Report</h1><p>Generated ${escapeHtml(generatedAt)} from the records saved in BreakSuite.</p></div>
      <div class="print-report-year"><span>Tax year</span><strong>${Number(report.taxYear)}</strong></div>
    </header>
    <section class="print-report-summary">
      <article><span>Gross break sales</span><strong>${escapeHtml(formatExactCurrency(totals.grossSalesCents))}</strong></article>
      <article><span>Whatnot fees</span><strong>${escapeHtml(formatExactCurrency(totals.whatnotFeeCents))}</strong></article>
      <article><span>Sold-break inventory</span><strong>${escapeHtml(formatExactCurrency(totals.soldInventoryCostCents))}</strong></article>
      <article><span>Giveaways / adjustments</span><strong>${escapeHtml(formatExactCurrency(totals.adjustmentCostCents))}</strong></article>
      <article><span>Other operating expenses</span><strong>${escapeHtml(formatExactCurrency(totals.operatingExpenseCents))}</strong></article>
      <article class="print-summary-total"><span>Total tracked deductible costs</span><strong>${escapeHtml(formatExactCurrency(totals.trackedDeductibleCostCents))}</strong></article>
      <article class="print-summary-result"><span>Tracked business result</span><strong>${escapeHtml(formatReportResult(totals.trackedProfitCents))}</strong></article>
      <article><span>Inventory purchases tracked separately</span><strong>${escapeHtml(formatExactCurrency(totals.inventoryPurchaseCents))}</strong></article>
    </section>
    <section class="print-report-section">
      <div class="print-section-heading"><div><span>EVERY SOURCE · ONE LIST</span><h2>All business expense records together</h2></div><p>${allExpenseRows.length} total line item${allExpenseRows.length === 1 ? '' : 's'} · newest first</p></div>
      <table><thead><tr><th>Date</th><th>Category</th><th>Purchase / break / notes</th><th>Accounting treatment</th><th>Amount paid</th></tr></thead><tbody>${allExpenseHtml}</tbody></table>
    </section>
    <section class="print-report-review">
      <h2>Review notes</h2>
      ${reviewNotes.length ? `<ul>${reviewNotes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : '<p>No record-completeness warnings are currently showing for this year.</p>'}
      <p>Amounts reflect the totals entered in BreakSuite. Keep receipts and statements with this report. This is a planning and recordkeeping summary, not a filed tax return; final tax treatment should be confirmed with your tax professional.</p>
    </section>`;
}

function renderBusinessExpenses() {
  const expenses = Array.isArray(state.businessExpenses) ? state.businessExpenses : [];
  const totals = state.businessExpenseTotals || {};
  const sales = Number(totals.savedBoxSalesCents || 0);
  const boxCosts = Number(totals.savedBoxCostCents || 0);
  const normalBoxCosts = Number(totals.normalBreakBoxCostCents ?? boxCosts);
  const adjustmentCosts = Number(totals.inventoryAdjustmentCents || 0);
  const whatnotFees = Number(totals.savedBoxWhatnotFeeCents || 0);
  const expensesTotal = Number(totals.otherExpenseCents ?? totals.totalExpenseCents ?? 0);
  const manualFeeEntries = Number(totals.manualWhatnotFeeExpenseCents || 0);
  const manualInventory = Number(totals.manualInventoryPurchaseCents || 0);
  const personalUse = Number(totals.nonDeductibleManualCents || 0) + Number(totals.nonDeductibleHistoryCents || 0);
  const profit = Number(totals.recordedProfitCents || 0);
  const adjustments = Array.isArray(state.businessAdjustments) ? state.businessAdjustments : [];
  renderBusinessSnapshot();
  renderBusinessExpensePrintReport();
  elements.expenseSummary.innerHTML = `<span><b>${escapeHtml(formatExactCurrency(sales))}</b> saved box sales</span><span><b>${escapeHtml(formatExactCurrency(whatnotFees))}</b> Whatnot fees</span><span><b>${escapeHtml(formatExactCurrency(normalBoxCosts))}</b> normal break inventory</span><span><b>${escapeHtml(formatExactCurrency(adjustmentCosts))}</b> giveaways / inventory adjustments</span><span><b>${escapeHtml(formatExactCurrency(expensesTotal))}</b> other deductible expenses</span><span><b>${escapeHtml(`${profit < 0 ? '−' : ''}${formatExactCurrency(Math.abs(profit))}`)}</b> tracked business result</span>${personalUse ? `<span><b>${escapeHtml(formatExactCurrency(personalUse))}</b> owner/personal use tracked · not deducted</span>` : ''}${manualInventory ? `<span><b>${escapeHtml(formatExactCurrency(manualInventory))}</b> inventory purchases tracked separately</span>` : ''}${manualFeeEntries ? `<span><b>${escapeHtml(formatExactCurrency(manualFeeEntries))}</b> manual fee entries excluded to prevent double counting</span>` : ''}`;
  elements.expenseStatus.textContent = state.expenseStatus || 'Giveaways and inventory adjustments are included once. Owner / Personal Use stays visible but is excluded from deductible totals.';
  const adjustmentHtml = adjustments.length ? `<div class="expense-auto-heading"><b>AUTO FROM FINAL ACCOUNTING</b><span>These box costs are already included once and are not duplicated as manual expenses.</span></div>${adjustments.map((entry) => `<article class="expense-record expense-auto-record"><div><span>${escapeHtml(String(entry.dispositionLabel || 'Inventory adjustment').toUpperCase())} · ${escapeHtml(formatHistoryDate(entry.recordedAt))}</span><strong>${escapeHtml(entry.breakName || 'Box adjustment')}</strong><small>${entry.notes ? escapeHtml(entry.notes) : 'Created automatically from Final Accounting'}</small></div><div><b>${escapeHtml(formatExactCurrency(entry.amountCents || 0))}</b><em>Auto</em></div></article>`).join('')}` : '';
  const manualHtml = expenses.length ? expenses.map((expense) => `<article class="expense-record"><div><span>${escapeHtml(String(expense.category || 'Other').toUpperCase())} · ${escapeHtml(expense.purchased_on || '')}</span><strong>${escapeHtml(expense.expense_name || 'Expense')}</strong><small>${escapeHtml(expense.vendor ? `From ${expense.vendor}` : 'No vendor entered')}${expense.notes ? ` · ${escapeHtml(expense.notes)}` : ''}</small></div><div><b>${escapeHtml(formatExactCurrency(expense.amount_cents || 0))}</b><button class="history-delete-button" type="button" data-expense-delete="${Number(expense.id)}">Delete</button></div></article>`).join('') : '';
  elements.expenseRecords.innerHTML = adjustmentHtml + manualHtml || '<div class="history-empty"><b>No expenses yet</b><span>Add a manual expense above or archive a giveaway/inventory adjustment from Final Accounting.</span></div>';
}
async function refreshChaser(){const d=await window.breakSuite.getChaserTracker();elements.chaserCard.value=d.card?`${d.card.name} · ${d.card.card_number||'No number'}`:'';elements.chaserThreshold.value=((d.settings.thresholdCents||0)/100).toFixed(2);elements.chaserSlots.value=d.settings.slotCount||15;elements.chaserPreview.innerHTML=`<b>${escapeHtml(d.card?.name||'Live Chasers')}</b><p>${(d.settings.qualifiers||[]).map((q,i)=>`${i+1}. ${escapeHtml(buyerHandle(q.buyer))} · ${formatExactCurrency(q.amountCents)} · ${formatHistoryDate(q.qualifiedAt)}`).join('<br>')||'No one has qualified yet.'}</p>`;}
async function refreshRecentBuyerMentions() {
  if (!elements.chaserRecentBuyersList) return;
  const data = await window.breakSuite.getRecentBuyerMentions();
  const chunks = Array.isArray(data.chunks) ? data.chunks : [];
  elements.chaserRecentBuyersStatus.textContent = `${data.names.length} unique recent buyer${data.names.length === 1 ? '' : 's'} · ${chunks.length} copy group${chunks.length === 1 ? '' : 's'}`;
  elements.chaserRecentBuyersList.innerHTML = chunks.length ? chunks.map((chunk, index) => `<article class="recent-buyer-copy-row"><div><b>Group ${index + 1}</b><span>${chunk.length}/150 characters</span><p>${escapeHtml(chunk)}</p></div><button class="primary-button" type="button" data-copy-recent-buyers="${index}">Copy Group ${index + 1}</button></article>`).join('') : '<div class="history-empty"><b>No saved buyers yet</b><span>Save completed buyers in Orders History, then refresh this list.</span></div>';
  elements.chaserRecentBuyersList.querySelectorAll('[data-copy-recent-buyers]').forEach(button => button.addEventListener('click', async () => {
    const result = await window.breakSuite.copyRecentBuyerMentionChunk(Number(button.dataset.copyRecentBuyers));
    elements.chaserRecentBuyersStatus.textContent = `✓ Group ${result.index + 1} copied · ${result.characters}/150 characters.`;
  }));
}
function royalBuyerMessageButton(buyer) {
  const url = window.WhatnotBuyerLink.profileUrl(buyer);
  if (!url) return `<b>${escapeHtml(buyerHandle(buyer))}</b>`;
  return `<button class="whatnot-buyer-link royal-buyer-message" type="button" data-royal-message-buyer="${escapeHtml(buyer)}" title="Open ${escapeHtml(buyerHandle(buyer))} on Whatnot, then press Message"><b>${escapeHtml(buyerHandle(buyer))}</b><i>Message ↗</i></button>`;
}

async function openRoyalBuyerMessage(button) {
  const buyer = button.dataset.royalMessageBuyer || '';
  const url = window.WhatnotBuyerLink.profileUrl(buyer);
  if (!url) {
    elements.royalStatus.textContent = 'That Royal Chasers entry does not contain a valid Whatnot username.';
    return;
  }
  button.disabled = true;
  try {
    const opened = await window.breakSuite.openExternal(url);
    if (opened === false) throw new Error('The Whatnot profile link was rejected.');
    elements.royalStatus.textContent = `Opened ${buyerHandle(buyer)} on Whatnot. Press Message to send the DM.`;
  } catch (error) {
    elements.royalStatus.textContent = error.message || `Could not open ${buyerHandle(buyer)} on Whatnot.`;
  } finally {
    button.disabled = false;
  }
}

async function refreshRoyal() {
  const d = await window.breakSuite.getRoyalChaserTracker();
  elements.royalCard.value = d.card ? `${d.card.name} · ${d.card.card_number || 'No number'}` : '';
  elements.royalThreshold.value = ((d.settings.thresholdCents || 0) / 100).toFixed(2);
  elements.royalSlots.value = d.settings.slotCount || 15;
  const locked = (d.settings.qualifiers || []).map((q, i) => `<div class="buyer-spend-row royal-buyer-row"><span>${i + 1}. ${royalBuyerMessageButton(q.buyer)}</span><span>${formatExactCurrency(q.amountCents)} <button class="secondary-button royal-unlock" data-buyer="${escapeHtml(q.buyer)}">Unlock</button></span></div>`).join('') || 'No one has qualified yet.';
  const standings = (d.standings || []).map((s, i) => `<div class="buyer-spend-row royal-buyer-row"><span>${i + 1}. ${royalBuyerMessageButton(s.buyer)}${s.locked ? ' · <b>LOCKED</b>' : ''}</span><span>${formatExactCurrency(s.totalCents)}${s.remainingCents ? ` · ${formatExactCurrency(s.remainingCents)} to go` : ' · Qualified'}</span></div>`).join('') || 'No saved buyer purchases yet.';
  elements.royalPreview.innerHTML = `<b>${escapeHtml(d.card?.name || 'Royal Chasers')}</b><p><b>Locked qualifiers</b></p>${locked}<p><b>Royal standings</b> — top ${d.settings.slotCount} by saved spend</p>${standings}`;
  elements.royalPreview.querySelectorAll('[data-royal-message-buyer]').forEach(button => button.addEventListener('click', () => openRoyalBuyerMessage(button)));
  elements.royalPreview.querySelectorAll('.royal-unlock').forEach(button => button.addEventListener('click', async () => {
    if (window.confirm(`Unlock ${button.dataset.buyer}? They will be removed from this Royal Chasers run.`)) {
      await window.breakSuite.unlockRoyalChaserBuyer(button.dataset.buyer);
      await refreshRoyal();
    }
  }));
}

async function refreshBusinessExpenses() {
  const result = await window.breakSuite.getBusinessExpenses({ year: state.businessExpenseYear });
  state.businessExpenses = result.expenses || [];
  state.businessAdjustments = result.adjustments || [];
  state.businessExpenseTotals = result.totals || {};
  state.businessSnapshot = result.snapshot || null;
  state.businessExpenseReport = result.report || null;
  state.businessExpenseYears = result.availableYears || [];
  if (state.businessSnapshot?.taxYear) state.businessExpenseYear = Number(state.businessSnapshot.taxYear);
  renderBusinessExpenses();
}

function buyerWeekLabel(weeks) {
  const latest = Array.isArray(weeks) && weeks[0];
  return latest ? `Week of ${latest.week} · ${formatExactCurrency(latest.totalSpendCents)}` : 'No dated purchase';
}

function buyerOutcomeMeta(source = {}) {
  const status = String(source.resultStatus || 'incomplete');
  const difference = Number(source.valueDifferenceCents || 0);
  if (status === 'profit') return { status, className: 'profit', label: 'ON PROFIT', value: formatSignedCurrency(difference) };
  if (status === 'cooked') return { status, className: 'cooked', label: 'GETTING COOKED', value: formatSignedCurrency(difference) };
  return { status: 'incomplete', className: 'incomplete', label: 'NEEDS PRICING', value: 'Incomplete' };
}

function renderBuyerPurchaseAudit() {
  if (!elements.buyerPurchaseAuditSummary || !elements.buyerPurchaseAuditStatus) return;
  const audit = state.buyerPurchaseAudit;
  if (!audit) {
    elements.buyerPurchaseAuditSummary.innerHTML = '';
    elements.buyerPurchaseAuditStatus.textContent = state.buyerPurchaseAuditStatus || 'Checks only saved Pull History spot payments and saved pull prices. Older Orders History is intentionally excluded from Profit/Cooked.';
    return;
  }
  const coverage = audit.firstRecordedAt
    ? `${formatHistoryDate(audit.firstRecordedAt)}${audit.lastRecordedAt && audit.lastRecordedAt !== audit.firstRecordedAt ? ` → ${formatHistoryDate(audit.lastRecordedAt)}` : ''}`
    : 'No tracked Pull History yet';
  elements.buyerPurchaseAuditSummary.innerHTML = `<span class="${audit.verified ? 'verified' : 'review'}"><b>${audit.verified ? '✓ VERIFIED' : `${Number(audit.issueCount || 0)} NEED REVIEW`}</b></span><span><b>${Number(audit.purchaseCount || 0).toLocaleString()}</b> Pull History purchases checked</span><span><b>${Number(audit.historyCount || 0).toLocaleString()}</b> tracked Pull History breaks</span><span><b>${escapeHtml(formatExactCurrency(audit.totalSpendCents || 0))}</b> tracked spend</span><span><b>${escapeHtml(formatExactCurrency(audit.totalMarketValueCents || 0))}</b> recorded hit value</span><span><b>${escapeHtml(coverage)}</b> coverage</span>${Number(audit.zeroRecordedHitSpots || 0) ? `<span><b>${Number(audit.zeroRecordedHitSpots).toLocaleString()}</b> spot${Number(audit.zeroRecordedHitSpots) === 1 ? '' : 's'} with no recorded hit · $0 hit value</span>` : ''}${Number(audit.unpricedPurchaseCount || 0) ? `<span class="review"><b>${Number(audit.unpricedPurchaseCount).toLocaleString()}</b> Pull History spot price${Number(audit.unpricedPurchaseCount) === 1 ? '' : 's'} missing</span>` : ''}${Number(audit.unpricedMarketCards || 0) ? `<span class="review"><b>${Number(audit.unpricedMarketCards).toLocaleString()}</b> saved pull price${Number(audit.unpricedMarketCards) === 1 ? '' : 's'} missing</span>` : ''}${Number(audit.orphanPullItemCount || 0) ? `<span class="review"><b>${Number(audit.orphanPullItemCount).toLocaleString()}</b> pull row${Number(audit.orphanPullItemCount) === 1 ? '' : 's'} not matched to its saved spot</span>` : ''}${Number(audit.legacyPullBatchCount || 0) ? `<span><b>${Number(audit.legacyPullBatchCount).toLocaleString()}</b> older pull batch${Number(audit.legacyPullBatchCount) === 1 ? '' : 'es'} excluded · no saved spend snapshot</span>` : ''}`;
  elements.buyerPurchaseAuditStatus.textContent = state.buyerPurchaseAuditStatus || (audit.verified
    ? `✓ Pull History-only check passed. Profit/Cooked uses only the ${Number(audit.historyCount || 0).toLocaleString()} tracked Pull History break${Number(audit.historyCount || 0) === 1 ? '' : 's'} above; older Orders History does not affect the result.`
    : `Pull History check completed, but ${Number(audit.issueCount || 0).toLocaleString()} saved item${Number(audit.issueCount || 0) === 1 ? '' : 's'} still need pricing/review. Older Orders History remains excluded.`);
}

function renderBuyerOutcomes() {
  if (!elements.buyerOutcomeList) return;
  const outcomeAnalytics = state.buyerAnalytics?.outcomes || { buyers: [], totals: {} };
  const buyers = Array.isArray(outcomeAnalytics.buyers) ? outcomeAnalytics.buyers : [];
  const totals = outcomeAnalytics.totals || {};
  const coverage = state.buyerAnalytics?.pullHistoryCoverage || {};
  const filter = state.buyerOutcomeFilter || 'all';
  const filtered = buyers.filter(buyer => filter === 'all' || buyer.resultStatus === filter).sort((left, right) => {
    if (filter === 'profit') return Number(right.valueDifferenceCents) - Number(left.valueDifferenceCents);
    if (filter === 'cooked') return Number(left.valueDifferenceCents) - Number(right.valueDifferenceCents);
    if (filter === 'incomplete') return Number(right.totalSpendCents) - Number(left.totalSpendCents);
    const order = { profit: 0, cooked: 1, incomplete: 2 };
    return order[left.resultStatus] - order[right.resultStatus]
      || Math.abs(Number(right.valueDifferenceCents)) - Math.abs(Number(left.valueDifferenceCents));
  });
  elements.buyerOutcomeTabs.forEach(button => button.classList.toggle('active', button.dataset.buyerOutcome === filter));
  const coverageLabel = coverage.firstRecordedAt
    ? `${Number(coverage.batchCount || 0).toLocaleString()} Pull History break${Number(coverage.batchCount || 0) === 1 ? '' : 's'} · since ${formatHistoryDate(coverage.firstRecordedAt)}`
    : 'Pull History tracking has not started yet';
  elements.buyerOutcomeSummary.innerHTML = `<span class="profit"><b>${Number(totals.profitBuyerCount || 0)}</b> on profit</span><span class="cooked"><b>${Number(totals.cookedBuyerCount || 0)}</b> getting cooked</span><span class="incomplete"><b>${Number(totals.incompleteBuyerCount || 0)}</b> need pricing</span><span><b>${escapeHtml(coverageLabel)}</b> · older Orders excluded</span>`;
  elements.buyerOutcomeList.innerHTML = filtered.length ? filtered.map((buyer, index) => {
    const result = buyerOutcomeMeta(buyer);
    const missing = Number(buyer.unpricedMarketCards || 0) + Math.max(0, Number(buyer.purchaseCount || 0) - Number(buyer.pricedPurchaseCount || 0));
    return `<article class="buyer-outcome-card ${escapeHtml(result.className)}"><div class="buyer-outcome-rank">#${index + 1}</div><div class="buyer-outcome-person"><strong>${escapeHtml(buyerHandle(buyer.buyerName))}</strong><span>${Number(buyer.boxCount || 0)} Pull History break${Number(buyer.boxCount || 0) === 1 ? '' : 's'} · ${Number(buyer.purchaseCount || 0)} tracked purchase${Number(buyer.purchaseCount || 0) === 1 ? '' : 's'}${missing ? ` · ${missing} item${missing === 1 ? '' : 's'} need review` : ''}</span></div><div class="buyer-outcome-money"><small>PAID<b>${escapeHtml(formatExactCurrency(buyer.totalSpendCents || 0))}</b></small><small>RECORDED HIT VALUE<b>${escapeHtml(formatExactCurrency(buyer.totalMarketValueCents || 0))}${buyer.resultStatus === 'incomplete' ? ' partial' : ''}</b></small><small class="${escapeHtml(result.className)}">${escapeHtml(result.label)}<b>${escapeHtml(result.value)}</b></small></div><button type="button" class="secondary-button" data-buyer-outcome-open="${escapeHtml(buyer.buyerName)}">View Buyer</button></article>`;
  }).join('') : '<div class="history-empty"><b>No buyers in this Pull History result group</b><span>Only purchases captured inside Pull History can appear in Profit/Cooked. Older Orders History is intentionally ignored.</span></div>';
  elements.buyerOutcomeList.querySelectorAll('[data-buyer-outcome-open]').forEach(button => button.addEventListener('click', () => {
    elements.buyerCaseQuery.value = buyerHandle(button.dataset.buyerOutcomeOpen);
    elements.buyerCaseForm.requestSubmit();
    elements.buyerCaseForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function renderBuyerAnalytics() {
  const analytics = state.buyerAnalytics || { buyers: [], totals: { buyerCount: 0, purchaseCount: 0, totalSpendCents: 0 } };
  const buyers = Array.isArray(analytics.buyers) ? analytics.buyers : [];
  const totals = analytics.totals || {};
  const outcomeBuyers = Array.isArray(analytics.outcomes?.buyers) ? analytics.outcomes.buyers : [];
  elements.buyerAnalyticsSummary.innerHTML = buyers.length
    ? `<span><b>${Number(totals.buyerCount || 0).toLocaleString()}</b> unique buyers</span><span><b>${Number(totals.purchaseCount || 0).toLocaleString()}</b> confirmed purchases</span><span><b>${escapeHtml(formatExactCurrency(totals.totalSpendCents || 0))}</b> all saved Orders spend</span>`
    : '<span><b>0</b> saved buyers</span><span>Save a completed box in Orders History to begin loyalty tracking.</span>';
  elements.buyerTopTen.innerHTML = buyers.length
    ? buyers.slice(0, 10).map((buyer, index) => `<li><b>#${index + 1}</b><div><strong>${escapeHtml(buyerHandle(buyer.buyerName))}</strong><span>${Number(buyer.purchaseCount).toLocaleString()} purchase${Number(buyer.purchaseCount) === 1 ? '' : 's'} · ${Number(buyer.boxCount).toLocaleString()} saved box${Number(buyer.boxCount) === 1 ? '' : 'es'}</span></div><em>${escapeHtml(formatExactCurrency(buyer.totalSpendCents || 0))}</em></li>`).join('')
    : '<li class="buyer-analytics-empty">No saved buyer orders yet.</li>';
  elements.buyerAnalyticsList.innerHTML = buyers.length
    ? buyers.map((buyer, index) => `<article class="buyer-analysis-card"><div class="buyer-analysis-rank">#${index + 1}</div><div class="buyer-analysis-main"><h3>${escapeHtml(buyerHandle(buyer.buyerName))}</h3><p>First saved order: ${escapeHtml(formatHistoryDate(buyer.firstPurchaseAt))} · Last saved order: ${escapeHtml(formatHistoryDate(buyer.lastPurchaseAt))}</p><div class="buyer-analysis-metrics"><span><b>${escapeHtml(formatExactCurrency(buyer.totalSpendCents || 0))}</b> all saved Orders spend</span><span><b>${Number(buyer.purchaseCount).toLocaleString()}</b> purchases</span><span><b>${Number(buyer.boxCount).toLocaleString()}</b> saved breaks</span><span><b>${Number(buyer.activeWeekCount).toLocaleString()}</b> active weeks</span><span><b>${escapeHtml(buyerWeekLabel(buyer.weeklySpend))}</b> latest weekly spend</span>${Number(buyer.pricedPurchaseCount) !== Number(buyer.purchaseCount) ? `<span class="pending"><b>${Number(buyer.purchaseCount) - Number(buyer.pricedPurchaseCount)}</b> price${Number(buyer.purchaseCount) - Number(buyer.pricedPurchaseCount) === 1 ? '' : 's'} not captured</span>` : ''}</div></div></article>`).join('')
    : '<div class="history-empty"><b>Your buyer scoreboard will appear here</b><span>Loyalty and spending can use saved Orders History. Profit/Cooked is calculated separately from Pull History only.</span></div>';
  if (elements.buyerCaseSuggestions) {
    elements.buyerCaseSuggestions.innerHTML = outcomeBuyers.map(buyer => `<option value="${escapeHtml(buyerHandle(buyer.buyerName))}"></option>`).join('');
  }
  renderBuyerPurchaseAudit();
  renderBuyerOutcomes();
}

function buyerCaseCardIdentity(item) {
  return [item.cardName, item.cardNumber, item.rarity, item.collectorTreatment, item.variantHint]
    .map(value => String(value || '').trim()).filter(Boolean).join(' · ') || 'Saved card';
}

function buyerMarketHitCard(item) {
  const price = item.marketTotalCents == null ? 'Needs pricing' : formatExactCurrency(item.marketTotalCents);
  return `<article class="buyer-market-hit ${item.marketTotalCents == null ? 'unpriced' : ''}"><div class="buyer-market-hit-copy"><small>SPOT ${Number(item.position || 0)}${Number(item.quantity || 1) > 1 ? ` · ×${Number(item.quantity)}` : ''}</small><strong>${escapeHtml(item.cardName || 'Saved hit')}</strong><span>${escapeHtml([item.cardNumber, item.rarity, item.collectorTreatment].filter(Boolean).join(' · '))}</span><em>${escapeHtml(price)}</em></div></article>`;
}

function renderBuyerCaseFile() {
  if (!elements.buyerCaseResults) return;
  elements.buyerCaseStatus.textContent = state.buyerCaseStatus || 'Searches Pull History only for Profit/Cooked. Older Orders History is not included in this result.';
  const file = state.buyerCaseFile;
  if (!file) {
    elements.buyerCaseResults.innerHTML = '';
    return;
  }
  if (!file.found) {
    elements.buyerCaseResults.innerHTML = `<div class="history-empty"><b>No Pull History purchases found for ${escapeHtml(buyerHandle(file.buyerName))}</b><span>Check the username spelling. Only purchases captured inside Pull History appear in this Profit/Cooked view.</span></div>`;
    return;
  }
  const totals = file.totals || {};
  const result = buyerOutcomeMeta(totals);
  const marketBatches = Array.isArray(file.valuedBreaks) ? file.valuedBreaks : [];
  elements.buyerCaseResults.innerHTML = `<article class="buyer-case-file">
    <header class="buyer-case-head"><div><span>BUYER PULL HISTORY</span><h3>${escapeHtml(buyerHandle(file.buyerName))}</h3><p>First tracked Pull History break: ${escapeHtml(formatHistoryDate(totals.firstPurchaseAt))} · Latest: ${escapeHtml(formatHistoryDate(totals.lastPurchaseAt))}</p></div><div class="buyer-case-actions"><button class="secondary-button" type="button" data-buyer-case-open="${escapeHtml(file.buyerName)}">Open Whatnot ↗</button><button class="primary-button" type="button" data-buyer-case-copy="${escapeHtml(file.buyerName)}">Copy Dispute Report</button></div></header>
    <div class="buyer-case-totals"><span><b>${Number(totals.breakCount || 0).toLocaleString()}</b> Pull History breaks</span><span><b>${Number(totals.purchaseCount || 0).toLocaleString()}</b> tracked purchases</span><span><b>${escapeHtml(formatExactCurrency(totals.totalSpendCents || 0))}</b> total paid</span><span><b>${escapeHtml(formatExactCurrency(totals.totalMarketValueCents || 0))}</b> recorded hit value${totals.valuationComplete ? '' : ' · partial'}</span><span><b>${Number(totals.marketPulledCards || 0).toLocaleString()}</b> saved pull cards</span>${Number(totals.unpricedPurchaseCount || 0) ? `<span class="pending"><b>${Number(totals.unpricedPurchaseCount).toLocaleString()}</b> spot prices missing</span>` : ''}${Number(totals.unpricedMarketCards || 0) ? `<span class="pending"><b>${Number(totals.unpricedMarketCards).toLocaleString()}</b> card prices missing</span>` : ''}${Number(totals.missingMarketBreaks || 0) ? `<span class="pending"><b>${Number(totals.missingMarketBreaks).toLocaleString()}</b> break pull snapshots missing</span>` : ''}${Number(totals.dataIssueCount || 0) ? `<span class="pending"><b>${Number(totals.dataIssueCount).toLocaleString()}</b> buyer/spot pull mismatch${Number(totals.dataIssueCount) === 1 ? '' : 'es'}</span>` : ''}</div>
    <section class="buyer-case-result ${escapeHtml(result.className)}"><div><span>PULL HISTORY RESULT · RECORDED HIT VALUE − PAID</span><strong>${escapeHtml(result.label)}</strong><small>${totals.valuationComplete ? `${escapeHtml(formatExactCurrency(totals.totalMarketValueCents || 0))} recorded hit value minus ${escapeHtml(formatExactCurrency(totals.totalSpendCents || 0))} paid` : 'Price any missing Pull History cards/spots before judging this tracked period.'}</small></div><b>${escapeHtml(result.value)}</b></section>
    <div class="buyer-case-records">${file.records.map((record, index) => `<details class="buyer-case-record" ${index === 0 ? 'open' : ''}><summary><div><span>PULL HISTORY ${escapeHtml(formatHistoryDate(record.recordedAt))}</span><strong>${escapeHtml(record.breakName)}</strong><small>${record.purchases.length} purchased spot${record.purchases.length === 1 ? '' : 's'} · ${record.totalPulledCards} saved pull card${record.totalPulledCards === 1 ? '' : 's'}</small></div><b>${escapeHtml(formatExactCurrency(record.totalSpendCents || 0))}</b></summary><div class="buyer-case-record-body">
      <section><h4>Recorded spot spend</h4><div class="buyer-case-lines">${record.purchases.map(item => `<div><b>Spot ${Number(item.position)}</b><span>${escapeHtml(buyerCaseCardIdentity(item))}</span><em>${item.paidCents ? escapeHtml(formatExactCurrency(item.paidCents)) : 'Price not captured'} · ${escapeHtml(formatHistoryDate(item.assignedAt))}</em></div>`).join('') || '<p>No purchased spots were stored.</p>'}</div></section>
      <section><h4>Exact saved pulls</h4><div class="buyer-case-lines">${record.pulls.map(item => `<div><b>Spot ${Number(item.position)}</b><span>${escapeHtml(buyerCaseCardIdentity(item))}${Number(item.quantity || 1) > 1 ? ` ×${Number(item.quantity)}` : ''}</span><em>Saved with archived break</em></div>`).join('') || '<p>No recorded hit cards were saved for this buyer in this Pull History break.</p>'}</div></section>
      ${record.notes ? `<p class="buyer-case-notes"><b>Break notes:</b> ${escapeHtml(record.notes)}</p>` : ''}
    </div></details>`).join('')}</div>
    <section class="buyer-market-history"><header><div><span>TRACKED HITS &amp; MARKET VALUE</span><h3>Saved Pull History</h3><p>Only exact cards saved in Pull History are shown. Older Orders-only breaks are intentionally excluded from this value comparison.</p></div><b>${escapeHtml(formatExactCurrency(totals.totalMarketValueCents || 0))}${totals.valuationComplete ? '' : ' partial'}</b></header><div class="buyer-market-batches">${marketBatches.length ? marketBatches.map((batch, index) => `<details class="buyer-market-batch" ${index === 0 ? 'open' : ''}><summary><div><span>${escapeHtml(formatHistoryDate(batch.recordedAt))}</span><strong>${escapeHtml(batch.breakLabel || 'Saved break')}</strong><small>${Number(batch.totalCards || 0)} saved card${Number(batch.totalCards || 0) === 1 ? '' : 's'}${Number(batch.unpricedCards || 0) ? ` · ${Number(batch.unpricedCards)} need pricing` : ''}</small></div><b>${Number(batch.unpricedCards || 0) ? `${escapeHtml(formatExactCurrency(batch.totalMarketValueCents || 0))} partial` : escapeHtml(formatExactCurrency(batch.totalMarketValueCents || 0))}</b></summary><div class="buyer-market-hit-grid">${batch.hits.map(buyerMarketHitCard).join('')}</div></details>`).join('') : '<div class="history-empty"><b>No recorded hits in these Pull History breaks</b><span>The tracked spot spend still counts; recorded hit value is $0 unless a saved pull card exists.</span></div>'}</div></section>
  </article>`;

  elements.buyerCaseResults.querySelector('[data-buyer-case-copy]')?.addEventListener('click', async buttonEvent => {
    const button = buttonEvent.currentTarget;
    button.disabled = true;
    try {
      await window.breakSuite.copyBuyerCaseReport(button.dataset.buyerCaseCopy);
      state.buyerCaseStatus = `✓ Full dispute report copied for ${buyerHandle(file.buyerName)}.`;
    } catch (error) {
      state.buyerCaseStatus = error.message || 'The dispute report could not be copied.';
    }
    button.disabled = false;
    elements.buyerCaseStatus.textContent = state.buyerCaseStatus;
  });
  elements.buyerCaseResults.querySelector('[data-buyer-case-open]')?.addEventListener('click', async buttonEvent => {
    const buyer = buttonEvent.currentTarget.dataset.buyerCaseOpen;
    const url = window.WhatnotBuyerLink.profileUrl(buyer);
    if (!url) return;
    try {
      await window.breakSuite.openExternal(url);
      state.buyerCaseStatus = `Opened ${buyerHandle(buyer)} on Whatnot.`;
    } catch (error) {
      state.buyerCaseStatus = error.message || `Could not open ${buyerHandle(buyer)} on Whatnot.`;
    }
    elements.buyerCaseStatus.textContent = state.buyerCaseStatus;
  });
}

async function refreshBuyerAnalytics() {
  state.buyerAnalytics = await window.breakSuite.getBuyerAnalytics();
  renderBuyerAnalytics();
  renderBuyerCaseFile();
}

elements.buyerCaseForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const query = elements.buyerCaseQuery.value.trim();
  state.buyerCaseStatus = 'Searching tracked Pull History…';
  elements.buyerCaseStatus.textContent = state.buyerCaseStatus;
  try {
    state.buyerCaseFile = await window.breakSuite.getBuyerCaseFile(query);
    state.buyerCaseStatus = state.buyerCaseFile.found
      ? `✓ Found ${Number(state.buyerCaseFile.totals.purchaseCount || 0).toLocaleString()} Pull History purchase${Number(state.buyerCaseFile.totals.purchaseCount || 0) === 1 ? '' : 's'} for ${buyerHandle(state.buyerCaseFile.buyerName)}.`
      : `No Pull History purchases were found for ${buyerHandle(state.buyerCaseFile.buyerName)}.`;
  } catch (error) {
    state.buyerCaseFile = null;
    state.buyerCaseStatus = error.message || 'The buyer search could not be completed.';
  }
  renderBuyerCaseFile();
});

elements.buyerPurchaseAuditButton?.addEventListener('click', async () => {
  const button = elements.buyerPurchaseAuditButton;
  button.disabled = true;
  state.buyerPurchaseAuditStatus = 'Checking saved Pull History spot spend and card prices only…';
  if (elements.buyerPurchaseAuditStatus) elements.buyerPurchaseAuditStatus.textContent = state.buyerPurchaseAuditStatus;
  try {
    const result = await window.breakSuite.auditBuyerPurchases();
    state.buyerPurchaseAudit = result.audit || null;
    state.buyerAnalytics = result.analytics || await window.breakSuite.getBuyerAnalytics();
    const audit = state.buyerPurchaseAudit || {};
    state.buyerPurchaseAuditStatus = audit.verified
      ? `✓ Verified ${Number(audit.purchaseCount || 0).toLocaleString()} Pull History purchase${Number(audit.purchaseCount || 0) === 1 ? '' : 's'}. Profit/Cooked now ignores all older Orders-only history.`
      : `Pull History check finished: ${Number(audit.issueCount || 0).toLocaleString()} item${Number(audit.issueCount || 0) === 1 ? '' : 's'} still need pricing/review. Older Orders-only history remains excluded.`;
    if (state.buyerCaseFile?.buyerName) {
      state.buyerCaseFile = await window.breakSuite.getBuyerCaseFile(state.buyerCaseFile.buyerName);
    }
    renderBuyerAnalytics();
    renderBuyerCaseFile();
  } catch (error) {
    state.buyerPurchaseAuditStatus = error.message || 'The purchase accuracy check could not be completed.';
    renderBuyerPurchaseAudit();
  } finally {
    button.disabled = false;
  }
});

elements.buyerOutcomeTabs.forEach(button => button.addEventListener('click', () => {
  state.buyerOutcomeFilter = button.dataset.buyerOutcome || 'all';
  renderBuyerOutcomes();
}));

function activeBoxTracker() {
  if (state.creatingBoxTracker) return null;
  const selectedId = Number(state.editingBoxTrackerId || state.activeBoxTrackerId || 0);
  return state.boxTrackers.find(tracker => Number(tracker.id) === selectedId) || null;
}

function canonicalTrackerSetCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function trackerIsOpenCase(tracker) {
  return String(tracker?.lifecycle_status || '').toUpperCase() === 'OPEN'
    && String(tracker?.source_mode || '').toUpperCase() === 'OPEN_CASE';
}

function nextOpenCaseBoxNumber(tracker) {
  return Number((tracker?.boxes || []).find(box => !box.history_link)?.box_number || 0);
}

function trackerListForCurrentTab() {
  const trackers = Array.isArray(state.boxTrackers) ? state.boxTrackers : [];
  return state.boxTrackerTab === 'live'
    ? trackers.filter(trackerIsOpenCase)
    : trackers.filter(tracker => !trackerIsOpenCase(tracker));
}

function compatibleOpenCases(gameCode = '', setCode = '') {
  const game = String(gameCode || '').trim().toUpperCase();
  const set = canonicalTrackerSetCode(setCode);
  return (state.openBoxCases || []).filter(tracker => {
    if (!nextOpenCaseBoxNumber(tracker)) return false;
    if (game && String(tracker.game_code || '').trim().toUpperCase() !== game) return false;
    const caseSet = canonicalTrackerSetCode(tracker.set_code);
    return !set || !caseSet || caseSet === 'MULTI' || caseSet === set;
  });
}

function openCaseOptionMarkup(cases, selectedId = null) {
  if (!cases.length) return '<option value="">No compatible open cases</option>';
  return `<option value="">Choose current open case</option>${cases.map(tracker => {
    const progress = `${Number(tracker.opened_count || 0)}/${Number(tracker.total_boxes || 0)} boxes`;
    const identity = [tracker.set_code, progress].filter(Boolean).join(' · ');
    return `<option value="${Number(tracker.id)}" ${Number(tracker.id) === Number(selectedId) ? 'selected' : ''}>${escapeHtml(tracker.tracker_name)}${identity ? ` — ${escapeHtml(identity)}` : ''}</option>`;
  }).join('')}`;
}

function syncHistoryTrackerDestination() {
  if (!elements.historyOpenCaseSelect) return;
  const cases = compatibleOpenCases();
  const openRadio = document.querySelector('input[name="history-tracker-destination-mode"][value="OPEN_CASE"]');
  const autoRadio = document.querySelector('input[name="history-tracker-destination-mode"][value="AUTO"]');
  if (openRadio) openRadio.disabled = !cases.length;
  if (!cases.length && openRadio?.checked && autoRadio) autoRadio.checked = true;
  const mode = document.querySelector('input[name="history-tracker-destination-mode"]:checked')?.value || 'AUTO';
  const previous = Number(elements.historyOpenCaseSelect.value || state.activeOpenCaseId || 0);
  elements.historyOpenCaseSelect.innerHTML = openCaseOptionMarkup(cases, previous);
  if (!cases.some(tracker => Number(tracker.id) === previous)) elements.historyOpenCaseSelect.value = '';
  elements.historyOpenCaseSelect.disabled = mode !== 'OPEN_CASE' || !cases.length;
  elements.historyTrackerType?.classList.toggle('is-disabled', mode === 'OPEN_CASE');
  elements.historyTrackerType?.querySelectorAll('input').forEach(input => { input.disabled = mode === 'OPEN_CASE'; });
  if (elements.historyOpenCaseHelp) {
    elements.historyOpenCaseHelp.textContent = mode === 'OPEN_CASE'
      ? (cases.length ? 'This completed break will occupy the next free box in the selected case.' : 'Create an open case in Box Tracker first.')
      : 'Auto keeps the existing standalone Box or Case record behavior.';
  }
}

function syncPendingTrackerDestination(form) {
  const roundId = Number(form?.dataset?.pendingComplete || 0);
  const round = (state.pendingBreakRounds || []).find(item => Number(item.id) === roundId);
  const cases = compatibleOpenCases(round?.gameCode, round?.setCode);
  const mode = form.querySelector('input[name="trackerDestinationMode"]:checked')?.value || 'AUTO';
  const select = form.querySelector('[name="openCaseId"]');
  const type = form.querySelector('[data-pending-tracker-type]');
  if (select) {
    const previous = Number(select.value || state.activeOpenCaseId || 0);
    select.innerHTML = openCaseOptionMarkup(cases, previous);
    if (!cases.some(tracker => Number(tracker.id) === previous)) select.value = '';
    select.disabled = mode !== 'OPEN_CASE' || !cases.length;
  }
  type?.classList.toggle('is-disabled', mode === 'OPEN_CASE');
  type?.querySelectorAll('input').forEach(input => { input.disabled = mode === 'OPEN_CASE'; });
  const help = form.querySelector('[data-open-case-help]');
  if (help) help.textContent = mode === 'OPEN_CASE'
    ? (cases.length ? 'This Buyer Bag becomes the next box in the selected case.' : 'No matching open case exists for this game and set yet.')
    : 'Auto creates the same standalone Box Tracker record used today.';
}

function renderOpenCaseSetOptions({ resetBoxes = false } = {}) {
  if (!elements.openCaseGame || !elements.openCaseSet) return;
  const game = String(elements.openCaseGame.value || 'RIFTBOUND').toUpperCase();
  const sets = (state.catalogSets || []).filter(set => String(set.game_code || '').toUpperCase() === game);
  const previous = elements.openCaseSet.value;
  elements.openCaseSet.innerHTML = sets.length
    ? sets.map(set => `<option value="${escapeHtml(set.set_code)}">${escapeHtml(set.set_code)} — ${escapeHtml(set.set_name || set.product_name || 'Imported set')}</option>`).join('')
    : '<option value="">No imported sets</option>';
  if (sets.some(set => set.set_code === previous)) elements.openCaseSet.value = previous;
  const selected = sets.find(set => set.set_code === elements.openCaseSet.value) || sets[0];
  if (resetBoxes && selected && elements.openCaseBoxes) elements.openCaseBoxes.value = String(Number(selected.box_count || (game === 'RIFTBOUND' ? 6 : 12)));
}

function boxStatusLabel(status) {
  return ({ sealed: 'Sealed', live: 'Live now', opened: 'Opened' })[String(status || '').toLowerCase()] || 'Sealed';
}

const ONE_PIECE_TRACKER_HIT_FIELDS = [
  ['manga_count', 'mangaCount', 'Manga'],
  ['sp_count', 'spCount', 'SP'],
  ['sec_count', 'secCount', 'SEC'],
  ['sec_aa_count', 'secAaCount', 'SEC AA'],
  ['leader_aa_count', 'leaderAaCount', 'L AA'],
  ['sr_aa_count', 'srAaCount', 'SR AA'],
  ['r_aa_count', 'rAaCount', 'R AA'],
  ['tr_count', 'trCount', 'TR'],
  ['gold_don_count', 'goldDonCount', 'Gold DON!!']
];
const RIFTBOUND_TRACKER_HIT_FIELDS = [
  ['epic_count', 'epicCount', 'Epic'],
  ['sp_count', 'spCount', 'SP'],
  ['alt_art_count', 'altArtCount', 'Alternate Art'],
  ['overnumbered_count', 'overnumberedCount', 'Overnumbered'],
  ['signature_count', 'signatureCount', 'Signature']
];
const TRACKER_HIT_FIELDS = [...new Map(
  [...ONE_PIECE_TRACKER_HIT_FIELDS, ...RIFTBOUND_TRACKER_HIT_FIELDS].map(field => [field[0], field])
).values()];

function trackerHitFields(tracker = {}) {
  tracker = tracker || {};
  if (Array.isArray(tracker.hit_fields) && tracker.hit_fields.length) {
    return tracker.hit_fields.map(field => [field.key, field.payloadKey, field.label]);
  }
  return String(tracker.game_code || '').toUpperCase() === 'RIFTBOUND'
    ? RIFTBOUND_TRACKER_HIT_FIELDS
    : ONE_PIECE_TRACKER_HIT_FIELDS;
}

function trackerBoxHitTotal(box, tracker = {}) {
  return trackerHitFields(tracker).reduce((total, [key]) => total + Number(box?.[key] || 0), 0);
}

function trackerCaseRecordSummary(record) {
  const totals = TRACKER_HIT_FIELDS
    .map(([key, , label]) => ({ label, count: Number(record?.[key] || 0) }))
    .filter(item => item.count > 0)
    .map(item => `${item.count} ${item.label}`);
  return totals.length ? totals.join(' · ') : 'No hits recorded';
}

function trackerCaseRecordCard(record) {
  const title = record.case_title || 'Saved case record';
  const meta = [record.product_name, record.overlay_title && record.overlay_title !== title ? `Overlay: ${record.overlay_title}` : '', formatHistoryDate(record.recorded_at)].filter(Boolean).join(' · ');
  const editing = Number(state.editingCaseRecordId) === Number(record.id);
  if (editing) return `<article class="tracker-case-record editing"><form data-tracker-case-record-form="${Number(record.id)}"><label>Case name<input name="caseTitle" value="${escapeHtml(title)}"></label><label>Product / set<input name="productName" value="${escapeHtml(record.product_name || '')}"></label><label>Overlay title<input name="overlayTitle" value="${escapeHtml(record.overlay_title || '')}"></label><div class="tracker-case-record-counts">${TRACKER_HIT_FIELDS.map(([key,,label])=>`<label>${escapeHtml(label)}<input name="${key}" type="number" min="0" step="1" value="${Number(record[key] || 0)}"></label>`).join('')}</div><div class="tracker-case-record-actions"><button class="secondary-button" type="submit">Save Edits</button><button class="secondary-button" type="button" data-tracker-case-record-cancel>Cancel</button></div></form></article>`;
  return `<article class="tracker-case-record"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(trackerCaseRecordSummary(record))}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}<div class="tracker-case-record-actions"><button class="secondary-button" type="button" data-tracker-case-record-edit="${Number(record.id)}">Edit</button><button class="history-delete-button" type="button" data-tracker-case-record-delete="${Number(record.id)}">Delete</button></div></article>`;
}

function trackerHitWinnerCard(hit, tracker, box) {
  const details = [hit.rarity, hit.card_number, buyerHandle(hit.buyer_name), Number(hit.spot_number || 0) ? `Spot ${Number(hit.spot_number)}` : '', Number(hit.quantity || 1) > 1 ? `×${Number(hit.quantity)}` : '', Number(hit.sale_amount_cents || 0) ? formatExactCurrency(hit.sale_amount_cents) : 'Price not captured', hit.note].filter(Boolean).join(' · ');
  const deleteButton = Number(hit.source_history_id || 0)
    ? ''
    : `<button class="history-delete-button" type="button" data-tracker-hit-winner-delete="${Number(hit.id)}" data-tracker-id="${Number(tracker.id)}" data-box-number="${Number(box.box_number)}">Delete</button>`;
  return `<article class="tracker-hit-winner-card"><div><strong>${escapeHtml(hit.card_name || 'Unnamed card')}</strong><span>${escapeHtml(details)}</span></div>${deleteButton}</article>`;
}

function selectedTrackerBox(tracker) {
  const number = Number(state.selectedTrackerBoxNumber || 0);
  return (tracker?.boxes || []).find(box => Number(box.box_number) === number) || null;
}

function trackerBoxCard(tracker, box) {
  const status = String(box.status || 'sealed').toLowerCase();
  const id = Number(tracker.id);
  const boxNumber = Number(box.box_number);
  const selected = Number(state.selectedTrackerBoxNumber) === boxNumber;
  const hitTotal = trackerBoxHitTotal(box, tracker);
  const sourceMode = String(tracker.source_mode || '').toUpperCase();
  if (sourceMode === 'ORDER_HISTORY') {
    const label = tracker.record_type_label || (String(tracker.record_type || '').toUpperCase() === 'CASE' ? 'Case' : 'Box');
    return `<article class="tracker-box-card tracker-auto-record ${selected ? 'selected' : ''}">
      <div class="tracker-auto-record-icon">${String(tracker.game_code || '').toUpperCase() === 'RIFTBOUND' ? 'R' : 'OP'}</div>
      <div><span>${escapeHtml(label.toUpperCase())} · ${escapeHtml(tracker.set_code || tracker.game_name || '')}</span><b>${hitTotal.toLocaleString()} qualifying hit${hitTotal === 1 ? '' : 's'}</b><i>Transferred automatically from Order History</i></div>
      <em>${escapeHtml(formatHistoryDate(tracker.created_at))}</em>
    </article>`;
  }
  if (sourceMode === 'OPEN_CASE' || sourceMode === 'FINALIZED_CASE') {
    const link = box.history_link || null;
    const boxState = link ? 'opened' : 'sealed';
    const detail = link
      ? `${hitTotal.toLocaleString()} qualifying hit${hitTotal === 1 ? '' : 's'} · ${link.break_name || `Order History #${Number(link.history_id)}`}`
      : (sourceMode === 'OPEN_CASE' ? 'Waiting for an archived Buyer Bag' : 'Not opened in this case');
    const liveActions = sourceMode === 'OPEN_CASE' && link
      ? `<div class="tracker-live-box-actions"><button class="secondary-button" type="button" data-open-case-box-pulls="${boxNumber}" data-tracker-id="${id}">Check / Edit Pulls</button><button class="history-delete-button" type="button" data-remove-open-case-box="${boxNumber}" data-tracker-id="${id}">Remove Box</button></div>`
      : '';
    return `<article class="tracker-box-card tracker-case-box status-${boxState} ${selected ? 'selected' : ''}">
      <button class="tracker-box-record" type="button" data-box-hit-record="true" data-tracker-id="${id}" data-box-number="${boxNumber}"><span>BOX ${String(boxNumber).padStart(2, '0')}</span><b>${link ? 'Opened' : 'Available'}</b><i>${escapeHtml(detail)}</i>${link?.recorded_at ? `<em>${escapeHtml(formatHistoryDate(link.recorded_at))}</em>` : ''}</button>${liveActions}
    </article>`;
  }
  return `<article class="tracker-box-card status-${escapeHtml(status)} ${selected ? 'selected' : ''}">
    <button class="tracker-box-record" type="button" data-box-hit-record="true" data-tracker-id="${id}" data-box-number="${boxNumber}"><span>BOX ${String(boxNumber).padStart(2, '0')}</span><b>${escapeHtml(boxStatusLabel(status))}</b><i>${hitTotal ? `${hitTotal} hit${hitTotal === 1 ? '' : 's'} logged` : 'Record hits'}</i></button>
    <div class="tracker-box-actions">
      <button class="${status === 'sealed' ? 'active' : ''}" data-tracker-id="${id}" data-box-number="${boxNumber}" data-box-status="sealed">Sealed</button>
      <button class="${status === 'live' ? 'active' : ''}" data-tracker-id="${id}" data-box-number="${boxNumber}" data-box-status="live">Live</button>
      <button class="${status === 'opened' ? 'active' : ''}" data-tracker-id="${id}" data-box-number="${boxNumber}" data-box-status="opened">Opened</button>
    </div>
  </article>`;
}

function renderBoxTrackers() {
  const trackers = trackerListForCurrentTab();
  let tracker = activeBoxTracker();
  if (!trackers.some(item => Number(item.id) === Number(tracker?.id))) {
    const preferredId = state.boxTrackerTab === 'live' ? state.activeOpenCaseId : state.activeBoxTrackerId;
    tracker = trackers.find(item => Number(item.id) === Number(preferredId)) || trackers[0] || null;
    state.editingBoxTrackerId = tracker ? Number(tracker.id) : null;
  }
  if (tracker && !(tracker.boxes || []).some(box => Number(box.box_number) === Number(state.selectedTrackerBoxNumber))) {
    const preferredBox = [...(tracker.boxes || [])].reverse().find(box => box.history_link)
      || tracker.boxes?.[0]
      || null;
    state.selectedTrackerBoxNumber = Number(preferredBox?.box_number || 0) || null;
  }
  const selectedBox = selectedTrackerBox(tracker);
  elements.trackerTabs.forEach(button => {
    const active = button.dataset.trackerTab === state.boxTrackerTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  elements.liveCaseCreatePanel?.classList.toggle('hidden', state.boxTrackerTab !== 'live');
  renderOpenCaseSetOptions();
  if (elements.trackerListEyebrow) elements.trackerListEyebrow.textContent = state.boxTrackerTab === 'live' ? 'CURRENT OPEN CASES' : 'COMPLETED + AUTOMATIC RECORDS';
  if (elements.trackerListTitle) elements.trackerListTitle.textContent = state.boxTrackerTab === 'live' ? 'Choose the case you are opening' : 'Saved Box Tracker records';
  if (elements.trackerListCopy) elements.trackerListCopy.textContent = state.boxTrackerTab === 'live'
    ? 'Selecting an open case also makes it the source used by the Active Case Status OBS overlay.'
    : 'Auto records and finalized live cases remain permanent here for review and the totals overlay.';
  if (elements.trackerSelectLabel) elements.trackerSelectLabel.textContent = state.boxTrackerTab === 'live' ? 'View open case' : 'View saved record';
  if (elements.finalizeOpenCase) {
    elements.finalizeOpenCase.classList.toggle('hidden', state.boxTrackerTab !== 'live');
    elements.finalizeOpenCase.disabled = !tracker || Number(tracker.opened_count || 0) < 1;
  }
  if (elements.editOpenCase) {
    elements.editOpenCase.classList.toggle('hidden', state.boxTrackerTab !== 'live');
    elements.editOpenCase.disabled = !tracker;
  }
  if (elements.deleteOpenCase) {
    elements.deleteOpenCase.classList.toggle('hidden', state.boxTrackerTab !== 'live');
    elements.deleteOpenCase.disabled = !tracker;
  }
  elements.trackerSelect.disabled = !trackers.length;
  elements.trackerSelect.innerHTML = trackers.length
    ? trackers.map(item => {
      const recordType = item.record_type_label || (String(item.record_type || '').toUpperCase() === 'CASE' ? 'Case' : 'Box');
      const progress = trackerIsOpenCase(item) ? `${Number(item.opened_count || 0)}/${Number(item.total_boxes || 0)} boxes` : recordType;
      const identity = [item.game_name, item.set_name || item.set_code, progress].filter(Boolean).join(' · ');
      return `<option value="${Number(item.id)}" ${Number(item.id) === Number(tracker?.id) ? 'selected' : ''}>${escapeHtml(item.tracker_name)}${identity ? ` — ${escapeHtml(identity)}` : ''}</option>`;
    }).join('')
    : `<option value="">${state.boxTrackerTab === 'live' ? 'No open cases yet' : 'No saved Box Tracker records yet'}</option>`;
  const showOpenCaseEditor = state.boxTrackerTab === 'live' && Boolean(tracker) && state.editingOpenCaseDetails;
  elements.openCaseEditForm?.classList.toggle('hidden', !showOpenCaseEditor);
  if (showOpenCaseEditor && elements.openCaseEditForm?.dataset.trackerId !== String(tracker.id)) {
    elements.openCaseEditForm.dataset.trackerId = String(tracker.id);
    elements.editOpenCaseName.value = tracker.tracker_name || '';
    elements.editOpenCaseBoxes.value = String(Number(tracker.total_boxes || 1));
  }
  elements.trackerName.value = tracker?.tracker_name || '';
  elements.trackerOverlayTitle.value = tracker?.overlay_title || tracker?.tracker_name || '';
  elements.trackerProduct.value = tracker?.product_name || '';
  elements.trackerTotalBoxes.value = String(Number(tracker?.total_boxes || 1));
  elements.trackerSettingsButton.textContent = 'Legacy save';
  elements.deleteTracker.classList.add('hidden');
  const sourceMode = String(tracker?.source_mode || '').toUpperCase();
  const isAutomatic = ['ORDER_HISTORY', 'OPEN_CASE', 'FINALIZED_CASE'].includes(sourceMode);
  elements.trackerStatus.textContent = state.boxTrackerStatus || (tracker
    ? (sourceMode === 'OPEN_CASE'
      ? `Live · ${Number(tracker.opened_count || 0)} of ${Number(tracker.total_boxes || 0)} boxes archived. ${nextOpenCaseBoxNumber(tracker) ? `The next Buyer Bag will fill Box ${String(nextOpenCaseBoxNumber(tracker)).padStart(2, '0')}.` : 'Every box position is filled and this case is ready to finalize.'}`
      : (sourceMode === 'FINALIZED_CASE'
        ? `✓ Finalized ${formatHistoryDate(tracker.completed_at || tracker.updated_at)} with ${Number(tracker.opened_count || 0)} archived box${Number(tracker.opened_count || 0) === 1 ? '' : 'es'}.`
        : (isAutomatic
          ? `✓ Automatically linked to Order History #${Number(tracker.order_history_id)}. No separate tracker save is needed.`
          : 'This older tracker remains readable. New records are created automatically from Order History.')))
    : (state.boxTrackerTab === 'live'
      ? 'Create an open case above, then choose Current Open Case when archiving each Buyer Bag.'
      : 'Auto records and finalized live cases will appear here.'));
  elements.trackerBoardTitle.textContent = tracker ? tracker.tracker_name : (state.boxTrackerTab === 'live' ? 'No open cases yet' : 'No saved tracker records yet');
  const fieldLabels = trackerHitFields(tracker).map(([, , label]) => label);
  elements.trackerBoardCopy.textContent = tracker
    ? `${[tracker.game_name, tracker.set_name || tracker.set_code, tracker.record_type_label].filter(Boolean).join(' · ')}. This view counts ${fieldLabels.join(', ')} only.`
    : (state.boxTrackerTab === 'live' ? 'A live case keeps its boxes together until you finalize it.' : 'The game, set, and selected hits are detected automatically from each saved break.');
  const totalHits = trackerHitFields(tracker).reduce((total, [key]) => total + Number(tracker?.hit_counts?.[key] || 0), 0);
  elements.trackerSummary.innerHTML = tracker
    ? (sourceMode === 'OPEN_CASE' || sourceMode === 'FINALIZED_CASE'
      ? `<span><b>${Number(tracker.opened_count || 0)}/${Number(tracker.total_boxes || 0)}</b> boxes archived</span><span><b>${Math.max(0, Number(tracker.total_boxes || 0) - Number(tracker.opened_count || 0))}</b> remaining</span><span><b>${escapeHtml(tracker.set_name || tracker.set_code || 'Detected')}</b> set</span><span><b>${totalHits.toLocaleString()}</b> tracked hits</span>`
      : `<span><b>${escapeHtml(tracker.record_type_label || 'Box')}</b> saved as</span><span><b>${escapeHtml(tracker.game_name || 'Card game')}</b> game</span><span><b>${escapeHtml(tracker.set_name || tracker.set_code || 'Detected')}</b> set</span><span><b>${totalHits.toLocaleString()}</b> tracked hits</span>`)
    : `<span><b>0</b> ${state.boxTrackerTab === 'live' ? 'open cases' : 'saved records'}</span>`;
  elements.trackerBoxGrid.innerHTML = tracker
    ? (tracker.boxes || []).map(box => trackerBoxCard(tracker, box)).join('')
    : `<div class="tracker-empty"><b>${state.boxTrackerTab === 'live' ? 'No case is open' : 'No saved records yet'}</b><span>${state.boxTrackerTab === 'live' ? 'Create one above; it will stay open while you archive its boxes over time.' : 'Finish a break with Auto selected, or finalize a live case.'}</span></div>`;
  const hitCounts = tracker?.hit_counts || {};
  elements.trackerHitSummary.innerHTML = tracker
    ? trackerHitFields(tracker).map(([key, , label]) => `<span><b>${Number(hitCounts[key] || 0).toLocaleString()}</b>${escapeHtml(label)}</span>`).join('')
    : '<span><b>—</b>No saved break selected</span>';
  if (elements.saveTrackerOverlayTitle) elements.saveTrackerOverlayTitle.disabled = !tracker;
  if (elements.saveTrackerCaseRecord) elements.saveTrackerCaseRecord.disabled = !tracker;
  elements.trackerCaseRecords.innerHTML = state.boxTrackerCaseRecords.length
    ? state.boxTrackerCaseRecords.map(trackerCaseRecordCard).join('')
    : '<div class="tracker-empty"><b>No completed case records yet</b><span>When a case is finished, click Save Current Case Record to keep its totals here.</span></div>';
  elements.trackerHitRecordTitle.textContent = selectedBox ? `${sourceMode === 'OPEN_CASE' || sourceMode === 'FINALIZED_CASE' ? `Box ${String(Number(selectedBox.box_number)).padStart(2, '0')}` : (tracker?.record_type_label || 'Box')} hit details` : 'No tracked hits yet';
  elements.trackerHitRecordCopy.textContent = selectedBox
    ? (selectedBox.history_link ? `Archived from “${selectedBox.history_link.break_name || `Order History #${Number(selectedBox.history_link.history_id)}`}”. Exact cards, buyers, spots, quantities, and captured sale amounts remain linked.` : 'This box has not been archived into the case yet.')
    : 'Archive a break to build this list automatically.';
  for (const [key, inputName] of TRACKER_HIT_FIELDS) {
    const input = elements.trackerHitForm?.elements?.namedItem(inputName);
    if (input) {
      input.value = String(Number(selectedBox?.[key] || 0));
      input.disabled = !selectedBox;
    }
  }
  if (elements.saveTrackerHits) elements.saveTrackerHits.disabled = !selectedBox;
  if (elements.saveTrackerHitWinner) elements.saveTrackerHitWinner.disabled = !selectedBox;
  if (elements.trackerHitWinnerForm) {
    for (const field of elements.trackerHitWinnerForm.elements) if (field.tagName !== 'BUTTON') field.disabled = !selectedBox;
  }
  elements.trackerHitWinnerList.innerHTML = selectedBox
    ? ((selectedBox.hit_winners || []).length
      ? selectedBox.hit_winners.map(hit => trackerHitWinnerCard(hit, tracker, selectedBox)).join('')
      : `<div class="tracker-hit-winner-empty">${selectedBox.history_link ? `No ${escapeHtml(fieldLabels.join(', '))} hits were selected for this box. Other pulls remain safely stored in Pull History.` : 'This case position is waiting for an archived Buyer Bag.'}</div>`)
    : '<div class="tracker-hit-winner-empty">Save a completed break to see its automatically transferred hit cards and buyers.</div>';
}

async function refreshBoxTrackers({ keepNewDraft = false } = {}) {
  const [result, caseRecords] = await Promise.all([
    window.breakSuite.getBoxTrackers(),
    window.breakSuite.getBoxTrackerCaseRecords()
  ]);
  state.boxTrackers = Array.isArray(result?.trackers) ? result.trackers : [];
  state.openBoxCases = state.boxTrackers.filter(trackerIsOpenCase);
  state.boxTrackerCaseRecords = Array.isArray(caseRecords) ? caseRecords : [];
  state.activeBoxTrackerId = result?.activeTrackerId ? Number(result.activeTrackerId) : null;
  state.activeOpenCaseId = result?.activeOpenCaseId ? Number(result.activeOpenCaseId) : null;
  const editableStillExists = state.boxTrackers.some(tracker => Number(tracker.id) === Number(state.editingBoxTrackerId));
  if (!keepNewDraft) state.creatingBoxTracker = false;
  if (!keepNewDraft && (!editableStillExists || !state.editingBoxTrackerId)) state.editingBoxTrackerId = state.activeBoxTrackerId;
  renderBoxTrackers();
  syncHistoryTrackerDestination();
}

async function refreshOpenBoxCases() {
  const result = await window.breakSuite.getOpenBoxCases();
  state.openBoxCases = Array.isArray(result?.cases) ? result.cases : [];
  state.activeOpenCaseId = result?.activeOpenCaseId ? Number(result.activeOpenCaseId) : null;
  syncHistoryTrackerDestination();
  if (state.view === 'history') renderOrderHistory();
  return state.openBoxCases;
}

function buyerSpendDescription(bag) {
  if (!bag.pricedCards) return 'price not captured';
  return bag.pricedCards === bag.cards.length
    ? 'confirmed spend'
    : `${bag.pricedCards}/${bag.cards.length} prices captured`;
}

function selectedBuyerTrackerDestination() {
  const destination = state.breakerTrackerDestination || {};
  const tracker = state.boxTrackers.find(item => Number(item.id) === Number(destination.trackerId));
  const box = tracker?.boxes?.find(item => Number(item.box_number) === Number(destination.boxNumber));
  return tracker && box ? { tracker, box } : null;
}

function renderBuyerTrackerDestination() {
  if (!elements.buyerTrackerCase || !elements.buyerTrackerBox) return;
  const trackers = Array.isArray(state.boxTrackers) ? state.boxTrackers : [];
  const destination = state.breakerTrackerDestination || {};
  const tracker = trackers.find(item => Number(item.id) === Number(destination.trackerId));
  elements.buyerTrackerCase.innerHTML = trackers.length
    ? `<option value="">Choose case</option>${trackers.map(item => `<option value="${Number(item.id)}" ${Number(item.id) === Number(tracker?.id) ? 'selected' : ''}>${escapeHtml(item.tracker_name)}</option>`).join('')}`
    : '<option value="">Create a Box Tracker first</option>';
  elements.buyerTrackerCase.disabled = !trackers.length;
  elements.buyerTrackerBox.innerHTML = tracker
    ? `<option value="">Choose box</option>${(tracker.boxes || []).map(box => `<option value="${Number(box.box_number)}" ${Number(box.box_number) === Number(destination.boxNumber) ? 'selected' : ''}>Box ${String(Number(box.box_number)).padStart(2, '0')} · ${boxStatusLabel(box.status)}</option>`).join('')}`
    : '<option value="">Choose case first</option>';
  elements.buyerTrackerBox.disabled = !tracker;
}

async function refreshBuyerTrackerDestination() {
  const result = await window.breakSuite.getBoxTrackers();
  state.boxTrackers = Array.isArray(result?.trackers) ? result.trackers : [];
  state.activeBoxTrackerId = result?.activeTrackerId ? Number(result.activeTrackerId) : null;
  const destination = state.breakerTrackerDestination || {};
  if (!state.boxTrackers.some(tracker => Number(tracker.id) === Number(destination.trackerId))) {
    destination.trackerId = Number(state.activeBoxTrackerId || 0) || null;
    destination.boxNumber = null;
  }
  if (!destination.boxNumber && Number(state.selectedTrackerBoxNumber || 0) > 0 && Number(destination.trackerId) === Number(state.activeBoxTrackerId)) destination.boxNumber = Number(state.selectedTrackerBoxNumber);
  state.breakerTrackerDestination = destination;
  renderBuyerTrackerDestination();
}

function buyerMessageCardTile(card) {
  const included = Boolean(Number(card.message_marked));
  return `<div class="buyer-message-card ${included ? 'included' : ''}">
    ${breakerCardTile(card, true)}
    <label class="buyer-message-select" title="Include this pull in the congratulations message">
      <input type="checkbox" data-buyer-message-position="${Number(card.position)}" data-buyer-message-buyer="${escapeHtml(card.buyer_name || '')}" ${included ? 'checked' : ''} />
      <span>${included ? 'Selected' : 'Select card'}</span>
    </label>
  </div>`;
}

function formatSpotOdds(count, total) {
  if (!total || !count) return { percentage: '0.0%', oneIn: '—' };
  const chance = (count / total) * 100;
  const oneIn = total / count;
  return {
    percentage: `${chance.toFixed(1)}%`,
    oneIn: `1 in ${oneIn >= 10 ? oneIn.toFixed(1) : oneIn.toFixed(2)}`
  };
}

function riftboundRarityIcon(groupKey, size = 'normal') {
  const definitions = {
    TOP: ['top', '★', 'Any top-hit position'],
    SIGNATURE: ['showcase', '', 'Signature treatment — original gold Showcase hexagon; confirm the artist signature and * card number'],
    OVERNUMBERED: ['showcase', '', 'Overnumbered treatment — original gold Showcase hexagon; card number exceeds the set total'],
    ALT_ART: ['showcase', '', 'Showcase / Alternate Art — original gold hexagon'],
    ULTIMATE: ['showcase', '', 'Ultimate rarity — original gold hexagon'],
    EPIC: ['epic', '', 'Epic rarity — original orange pentagon gem'],
    RARE: ['rare', '', 'Rare rarity — original pink square gem; Champion Legends are Rare'],
    UNCOMMON: ['uncommon', '', 'Uncommon rarity — original teal triangular gem'],
    COMMON: ['common', '', 'Common rarity — original white circular gem'],
    LEFTOVERS: ['other', '•', 'Other Riftbound cards']
  };
  const [kind, text, title] = definitions[String(groupKey || '').toUpperCase()] || definitions.LEFTOVERS;
  return `<i class="riftbound-rarity-symbol ${escapeHtml(kind)} ${escapeHtml(size)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><b>${escapeHtml(text)}</b></i>`;
}

function breakerOddsCard({ label, count, total, accent, combined = false, riftboundGroup = '' }) {
  const odds = formatSpotOdds(count, total);
  return `<article class="breaker-odds-card ${escapeHtml(accent || '')}${combined ? ' combined' : ''}">
    <div>${riftboundGroup ? `<div class="riftbound-odds-label">${riftboundRarityIcon(riftboundGroup, 'large')}<span>${escapeHtml(label)}</span></div>` : `<span>${escapeHtml(label)}</span>`}<strong>${Number(count).toLocaleString()}</strong><em>spots left</em></div>
    <div class="breaker-odds-numbers"><b>${escapeHtml(odds.percentage)}</b><span>${Number(count).toLocaleString()} of ${Number(total).toLocaleString()}</span><small>${escapeHtml(odds.oneIn)}</small></div>
  </article>`;
}

function renderBreakerCenter() {
  renderBuyerTrackerDestination();
  // The original Breaker Center remains One Piece-only. A Riftbound live
  // ledger is rendered exclusively in the separate Riftbound center below.
  const cards = state.activeBoardCards
    .filter(card => String(card.game_code || 'ONEPIECE').toUpperCase() === 'ONEPIECE')
    .sort((left, right) => Number(left.position) - Number(right.position));
  const remaining = cards.filter(card => card.block_status === 'ready');
  const remainingPriority = remaining.filter(card => breakerGroupKey(card) !== 'LEFTOVERS');
  const assigned = cards.filter(card => card.block_status !== 'ready');
  const assignedWithBuyer = assigned.filter(card => String(card.buyer_name || '').trim());
  const buyerMap = new Map();
  assignedWithBuyer.forEach(card => {
    const buyer = String(card.buyer_name || '').trim();
    if (!buyerMap.has(buyer)) buyerMap.set(buyer, []);
    buyerMap.get(buyer).push(card);
  });
  const bags = [...buyerMap.entries()].map(([buyer, buyerCards]) => ({
    buyer,
    cards: buyerCards.sort((left, right) => {
      const groupDifference = BREAKER_PRIORITY_GROUPS.findIndex(group => group.key === breakerGroupKey(left)) - BREAKER_PRIORITY_GROUPS.findIndex(group => group.key === breakerGroupKey(right));
      return groupDifference || Number(left.position) - Number(right.position);
    }),
    spendCents: buyerCards.reduce((total, card) => total + Math.max(0, Number(card.sale_amount_cents || 0)), 0),
    pricedCards: buyerCards.filter(card => Number(card.sale_amount_cents || 0) > 0).length
  })).sort((left, right) => right.spendCents - left.spendCents || right.cards.length - left.cards.length || left.buyer.localeCompare(right.buyer));
  const capturedSpendCents = bags.reduce((total, bag) => total + bag.spendCents, 0);
  const selectedPullCount = assigned.filter(card => card.block_status === 'called' && Number(card.message_marked)).length;
  elements.savePullHistory.disabled = selectedPullCount < 1;
  elements.savePullHistory.textContent = selectedPullCount
    ? `▣ Save ${selectedPullCount.toLocaleString()} Selected Pull${selectedPullCount === 1 ? '' : 's'}`
    : '▣ Save Selected Pulls';
  elements.pullHistorySaveStatus.textContent = state.pullHistorySaveStatus;

  elements.breakerSummary.innerHTML = [
    ['Cards remaining', remaining.length],
    ['Priority cards left', remainingPriority.length],
    ['Assigned', assigned.length],
    ['Buyer bags', bags.length],
    ['Live sales', capturedSpendCents ? formatBuyerSpend(capturedSpendCents) : '—']
  ].map(([label, value]) => `<span><b>${typeof value === 'number' ? Number(value).toLocaleString() : escapeHtml(value)}</b>${escapeHtml(label)}</span>`).join('');

  // This board is intentionally a remaining-cards tracker. Once a card is
  // assigned, it leaves its rarity group and appears only in that buyer's bag.
  const groupCounts = Object.fromEntries(BREAKER_PRIORITY_GROUPS.map(group => [group.key, remaining.filter(card => breakerGroupKey(card) === group.key).length]));
  const remainingCount = remaining.length;
  const hasLiveLedger = cards.length > 0;
  const topHitCount = BREAKER_TOP_ODDS_GROUPS.reduce((total, group) => total + Number(groupCounts[group.key] || 0), 0);
  const leftoverCount = remainingCount - topHitCount;
  const topHitOdds = formatSpotOdds(topHitCount, remainingCount);
  elements.breakerOddsTotal.innerHTML = !hasLiveLedger
    ? '<strong>—</strong><span>save a live board</span><b>No active spot odds yet</b>'
    : remainingCount
    ? `<strong>${Number(remainingCount).toLocaleString()}</strong><span>spots remaining</span><b>${escapeHtml(topHitOdds.percentage)} top-hit chance</b>`
    : '<strong>0</strong><span>spots remaining</span><b>Board is complete</b>';
  elements.breakerOdds.innerHTML = [
    breakerOddsCard({ label: 'Any top-hit spot', count: topHitCount, total: remainingCount, accent: 'top-hit', combined: true }),
    ...BREAKER_TOP_ODDS_GROUPS.map(group => breakerOddsCard({ label: group.label, count: Number(groupCounts[group.key] || 0), total: remainingCount, accent: group.accent })),
    breakerOddsCard({ label: 'All other spots', count: leftoverCount, total: remainingCount, accent: 'leftovers' })
  ].join('');
  if (!BREAKER_PRIORITY_GROUPS.some(group => group.key === state.breakerFilter)) state.breakerFilter = 'MANGA';
  elements.breakerPriorityTabs.innerHTML = BREAKER_PRIORITY_GROUPS.map(group => `<button class="breaker-priority-tab ${group.key === state.breakerFilter ? 'active' : ''}" data-breaker-group="${group.key}"><span>${escapeHtml(group.label)}</span><b>${Number(groupCounts[group.key] || 0).toLocaleString()}</b></button>`).join('');
  elements.breakerPriorityTabs.querySelectorAll('[data-breaker-group]').forEach(button => button.addEventListener('click', () => {
    state.breakerFilter = button.dataset.breakerGroup;
    renderBreakerCenter();
  }));

  const shownCards = remaining.filter(card => breakerGroupKey(card) === state.breakerFilter);
  const currentGroup = BREAKER_PRIORITY_GROUPS.find(group => group.key === state.breakerFilter);
  elements.breakerPriorityCards.innerHTML = shownCards.length
    ? shownCards.map(card => breakerCardTile(card)).join('')
    : `<div class="breaker-empty">No ${escapeHtml(currentGroup?.label || 'matching')} cards are left. Any assigned cards are now in their buyer bags below.</div>`;

  elements.breakerBags.innerHTML = bags.length
    ? bags.map(bag => {
      const selected = bag.cards.filter(card => Number(card.message_marked)).length;
      const status = state.buyerMessageStatus.get(comparableBuyerHandle(bag.buyer)) || '';
      return `<article class="buyer-bag"><div class="buyer-bag-head"><div><span>BUYER BAG</span><h3>${escapeHtml(buyerHandle(bag.buyer))}</h3></div><div class="buyer-bag-totals"><b>${escapeHtml(formatBuyerSpend(bag.spendCents))}</b><span>${escapeHtml(buyerSpendDescription(bag))}</span><em>${bag.cards.length.toLocaleString()} card${bag.cards.length === 1 ? '' : 's'}</em></div></div><div class="buyer-bag-message"><div><strong>${selected.toLocaleString()} selected</strong><span>saved to Pull History; Box Tracker transfers at archive</span></div><div class="buyer-message-actions"><button class="buyer-clear-selection" data-clear-buyer-message="${escapeHtml(bag.buyer)}" ${selected ? '' : 'disabled'}>Clear</button><button class="buyer-copy-message" data-copy-buyer-message="${escapeHtml(bag.buyer)}" ${selected ? '' : 'disabled'}>Copy Congrats</button></div></div>${status ? `<p class="buyer-message-status">${escapeHtml(status)}</p>` : ''}<div class="buyer-card-grid">${bag.cards.map(buyerMessageCardTile).join('')}</div></article>`;
    }).join('')
    : '<div class="breaker-empty">No assigned buyers yet. Buyer bags appear automatically when the connector receives a buyer and spot number.</div>';

  elements.breakerBags.querySelectorAll('[data-buyer-message-position]').forEach(input => input.addEventListener('change', async () => {
    const buyer = input.dataset.buyerMessageBuyer || '';
    input.disabled = true;
    state.buyerMessageStatus.delete(comparableBuyerHandle(buyer));
    try {
      await window.breakSuite.setBuyerMessageCardMarked(Number(input.dataset.buyerMessagePosition), input.checked);
      await refreshBreakBoard(undefined, { preserveScroll: true });
    } catch (error) {
      state.buyerMessageStatus.set(comparableBuyerHandle(buyer), error.message || 'The message selection could not be updated.');
      await refreshBreakBoard(undefined, { preserveScroll: true });
    }
  }));
  elements.breakerBags.querySelectorAll('[data-copy-buyer-message]').forEach(button => button.addEventListener('click', async () => {
    const buyer = button.dataset.copyBuyerMessage || '';
    button.disabled = true;
    try {
      const result = await window.breakSuite.copyBuyerCongratulations(buyer);
      state.buyerMessageStatus.set(comparableBuyerHandle(buyer), `✓ Copied congratulations for ${result.copiedCards} pull${result.copiedCards === 1 ? '' : 's'}.`);
    } catch (error) {
      state.buyerMessageStatus.set(comparableBuyerHandle(buyer), error.message || 'The congratulations message could not be copied.');
    }
    renderBreakerCenter();
  }));
  elements.breakerBags.querySelectorAll('[data-clear-buyer-message]').forEach(button => button.addEventListener('click', async () => {
    const buyer = button.dataset.clearBuyerMessage || '';
    button.disabled = true;
    try {
      const result = await window.breakSuite.clearBuyerMessageSelections(buyer);
      state.buyerMessageStatus.set(comparableBuyerHandle(buyer), result.clearedCards
        ? `✓ Cleared ${result.clearedCards} selected pull${result.clearedCards === 1 ? '' : 's'}. Choose only the cards you want in the message.`
        : 'No pulls were selected for congratulations.');
    } catch (error) {
      state.buyerMessageStatus.set(comparableBuyerHandle(buyer), error.message || 'The message selections could not be cleared.');
    }
    await refreshBreakBoard(undefined, { preserveScroll: true });
  }));
  elements.breakerRanking.innerHTML = bags.length
    ? bags.map((bag, index) => `<li><b>${index + 1}</b><span>${escapeHtml(buyerHandle(bag.buyer))}</span><div class="buyer-ranking-spend"><strong>${escapeHtml(formatBuyerSpend(bag.spendCents))}</strong><small>${bag.cards.length.toLocaleString()} card${bag.cards.length === 1 ? '' : 's'} · ${escapeHtml(buyerSpendDescription(bag))}</small></div></li>`).join('')
    : '<li class="ranking-empty">Buyer ranking will appear as assignments arrive.</li>';
}

function pendingRoundBuyerBags(round) {
  const assigned = (round.cards || []).filter(card => card.block_status === 'called' && String(card.buyer_name || '').trim());
  const auditByPosition = new Map((round.audit || []).map(entry => [Number(entry.position), entry]));
  const buyers = new Map();
  assigned.forEach(card => {
    const buyer = String(card.buyer_name || '').trim();
    if (!buyers.has(buyer)) buyers.set(buyer, []);
    buyers.get(buyer).push(card);
  });
  return [...buyers.entries()].map(([buyer, cards]) => {
    const championEntries = cards.map(card => auditByPosition.get(Number(card.position))).filter(Boolean);
    const singleEntries = championEntries.filter(entry => entry.spotType === 'RIFTBOUND_SINGLE');
    const mappedEntries = championEntries.filter(entry => entry.spotType !== 'RIFTBOUND_SINGLE');
    const directCards = cards.filter(card => !auditByPosition.has(Number(card.position)));
    const selected = directCards.filter(card => Number(card.message_marked)).length
      + championEntries.reduce((total, entry) => total + entry.family.reduce((sum, card) => sum + Number(card.audit_quantity || 0), 0), 0);
    const singlesOnly = championEntries.length > 0 && championEntries.every(entry => entry.spotType === 'RIFTBOUND_SINGLE');
    const spend = cards.reduce((total, card) => total + Math.max(0, Number(card.sale_amount_cents || 0)), 0);
    const whatnotUrl = window.WhatnotBuyerLink.profileUrl(buyer);
    const buyerHeading = whatnotUrl
      ? `<button class="whatnot-buyer-link" type="button" data-pending-open-whatnot="${Number(round.id)}" data-whatnot-buyer="${escapeHtml(buyer)}" title="Open ${escapeHtml(buyerHandle(buyer))} on Whatnot, then press Message"><b>${escapeHtml(buyerHandle(buyer))}</b><i>Message ↗</i></button>`
      : escapeHtml(buyerHandle(buyer));
    const collapsed = buyerBagIsCollapsed(buyer, round.id);
    return `<article class="buyer-bag riftbound-audit-bag pending-buyer-bag${collapsed ? ' is-collapsed' : ''}">
      <div class="buyer-bag-head"><div><div class="buyer-bag-title-row"><span>${singlesOnly ? 'PENDING SINGLES BAG' : 'PENDING BUYER BAG'}</span>${buyerBagPriceControl(buyer, selected, round.id)}${buyerBagCollapseControl(buyer, round.id)}</div><h3>${buyerHeading}</h3></div><div class="buyer-bag-totals"><b>${escapeHtml(formatPrivateRiftboundMoney(spend))}</b><span>${state.riftboundSpendingVisible ? (cards.filter(card => Number(card.sale_amount_cents || 0) > 0).length === cards.length ? 'confirmed spend captured' : 'some prices not captured') : 'financial values hidden'}</span><em>${cards.length} purchased spot${cards.length === 1 ? '' : 's'}</em></div></div>
      <div class="buyer-bag-collapsible">
      ${buyerBagPriceStatusMarkup(buyer, round.id)}
      <div class="buyer-bag-message"><div><strong data-buyer-bag-selected="${selected}">${selected} actual card${selected === 1 ? '' : 's'} recorded</strong><span>${singlesOnly ? 'Each purchased position stays tied to its exact single card' : 'This bag stays here until the whole box is completed and archived'}</span></div><div class="buyer-message-actions"><button class="buyer-clear-selection" type="button" data-pending-clear="${Number(round.id)}" data-pending-buyer="${escapeHtml(buyer)}" ${selected ? '' : 'disabled'}>Clear Audit</button><button class="buyer-copy-message" type="button" data-pending-copy="${Number(round.id)}" data-pending-buyer="${escapeHtml(buyer)}" ${selected ? '' : 'disabled'}>Copy Results</button></div></div>
      <div class="riftbound-audit-content">${riftboundSinglesAuditGrid(singleEntries)}${mappedEntries.map(riftboundChampionAuditPanel).join('')}${directCards.length ? `<section class="direct-chase-audit"><h4>Named Chase / Other Positions</h4><p>Select the displayed card only when that exact chase was pulled.</p><div class="buyer-card-grid">${directCards.map(card => riftboundBuyerMessageCardTile(card, round.id)).join('')}</div></section>` : ''}</div>
      </div>
    </article>`;
  }).join('');
}

function renderPendingBreakRounds() {
  if (!elements.pendingBreakRounds) return;
  const rounds = Array.isArray(state.pendingBreakRounds) ? state.pendingBreakRounds : [];
  if (elements.finishLiveRound) {
    const activeAssignments = Number(state.connector?.activeAssignments || 0);
    elements.finishLiveRound.disabled = activeAssignments < 1;
    elements.finishLiveRound.textContent = activeAssignments
      ? `Finish Live Box for Review (${activeAssignments})`
      : 'Finish Live Box for Review';
  }
  elements.pendingBreakRounds.innerHTML = rounds.length ? rounds.map((round, index) => {
    const status = state.pendingRoundStatus.get(Number(round.id)) || '';
    const pulls = Number(round.selectedPullCount || 0);
    const openCases = compatibleOpenCases(round.gameCode, round.setCode);
    const selectedOpenCaseId = openCases.some(tracker => Number(tracker.id) === Number(state.activeOpenCaseId)) ? state.activeOpenCaseId : null;
    return `<details class="pending-round" data-pending-round-id="${Number(round.id)}" ${index === 0 ? 'open' : ''}>
      <summary><div><span>BOX ${Number(round.sequence)} · ${escapeHtml(round.setCode || round.gameCode || 'BREAK')}</span><strong>${escapeHtml(round.displayName)}</strong><small data-pending-round-summary>${Number(round.assignedCount).toLocaleString()} assigned spot${Number(round.assignedCount) === 1 ? '' : 's'} · ${pulls.toLocaleString()} selected pull${pulls === 1 ? '' : 's'} · ${escapeHtml(formatPrivateRiftboundMoney(round.capturedSpendCents))} captured</small></div><b>PENDING REVIEW</b></summary>
      <div class="pending-round-body">
        <div class="pending-round-safety"><div><strong>Safe to review while the next box is live</strong><span>This tab is a frozen ledger snapshot. Editing these pulls cannot change the connector's live board.</span></div><button class="history-delete-button" type="button" data-pending-discard="${Number(round.id)}" data-pending-discard-name="${escapeHtml(round.displayName)}">Discard False Snapshot</button></div>
        <div class="buyer-bags riftbound-audit-bags">${pendingRoundBuyerBags(round) || '<div class="breaker-empty">No confirmed Buyer Bags were stored for this round.</div>'}</div>
        <form class="pending-complete-form" data-pending-complete="${Number(round.id)}">
          <div><p class="eyebrow">FINAL ACCOUNTING</p><h3>Complete &amp; Archive ${escapeHtml(round.displayName)}</h3><p>One transaction saves Orders History, Pull History, archived Buyer Bags, and Buyer Analytics. If any write fails, this pending tab stays unchanged.</p></div>
          <label>Break / box name<input name="breakName" maxlength="140" value="${escapeHtml(round.displayName)}" /></label>
          <label>Your box cost<input name="boxCost" inputmode="decimal" placeholder="120.00" /></label>
          <fieldset class="history-tracker-type history-tracker-destination pending-tracker-type"><legend>Box Tracker destination</legend><label><input type="radio" name="trackerDestinationMode" value="AUTO" checked /><span><b>Auto record</b><small>Save by itself as today</small></span></label><label><input type="radio" name="trackerDestinationMode" value="OPEN_CASE" ${openCases.length ? '' : 'disabled'} /><span><b>Current open case</b><small>Fill its next box</small></span></label><label class="history-open-case-picker">Open case<select name="openCaseId" disabled>${openCaseOptionMarkup(openCases, selectedOpenCaseId)}</select></label><p data-open-case-help>Auto creates the same standalone Box Tracker record used today.</p></fieldset>
          <fieldset class="history-tracker-type pending-tracker-type" data-pending-tracker-type><legend>Auto record type</legend><label><input type="radio" name="trackerRecordType" value="BOX" checked /><span><b>Box</b><small>One booster box</small></span></label><label><input type="radio" name="trackerRecordType" value="CASE" /><span><b>Case</b><small>A complete sealed case</small></span></label><p>Used only for Auto. BreakSuite detects ${escapeHtml(round.setName || round.setCode || round.gameCode || 'the game and set')} and transfers the selected hits automatically.</p></fieldset>
          <label>Disposition / outcome<select name="disposition" class="pending-disposition-select"><option value="NORMAL_BREAK">Normal Break / Sale</option><option value="PROMOTIONAL_GIVEAWAY">Promotional Giveaway</option><option value="CUSTOMER_COMPENSATION">Customer Compensation / Make-Good</option><option value="DAMAGED_INVENTORY">Damaged Inventory</option><option value="LOST_INVENTORY">Lost Inventory</option><option value="OWNER_PERSONAL_USE">Owner / Personal Use — non-deductible</option><option value="TEST_VOID">Test / Void — remove from accounting</option></select><small class="pending-disposition-help">Giveaways, make-goods, damaged, and lost inventory use $0 revenue and no Whatnot fees. Test / Void deletes only this frozen review snapshot.</small></label>
          <details class="pending-fee-settings"><summary>Whatnot fees</summary><div>
            <label>Commission %<input name="whatnotCommissionRate" inputmode="decimal" value="8.00" /></label>
            <label>Processing %<input name="whatnotProcessingRate" inputmode="decimal" value="2.90" /></label>
            <label>Per transaction<input name="whatnotTransactionFee" inputmode="decimal" value="0.30" /></label>
            <label>Transactions<input name="whatnotTransactionCount" inputmode="numeric" placeholder="Automatic" /></label>
            <label>Fee tax %<input name="whatnotFeeTaxRate" inputmode="decimal" value="6.60" /></label>
            <label>Additional fees<input name="whatnotAdditionalFees" inputmode="decimal" placeholder="0.00" /></label>
            <label>Actual total fees<input name="whatnotActualFees" inputmode="decimal" placeholder="Optional override" /></label>
          </div></details>
          <label class="pending-notes">Notes<textarea name="notes" maxlength="1200" rows="2"></textarea></label>
          <button class="primary-button pending-complete-button" type="submit" ${pulls ? '' : 'disabled'}>✓ Complete &amp; Archive</button>
          <p class="history-status" aria-live="polite">${escapeHtml(status || (pulls ? 'Ready to archive when your review is finished.' : 'Select at least one exact pulled card before completing this box.'))}</p>
        </form>
      </div>
    </details>`;
  }).join('') : '<div class="pending-rounds-empty"><b>No boxes are waiting for review</b><span>When you save the next board after confirmed sales, the current Buyer Bags will move here automatically.</span></div>';

  wireBuyerBagPriceChecks(elements.pendingBreakRounds);
  wireBuyerBagCollapseControls(elements.pendingBreakRounds);
  elements.pendingBreakRounds.querySelectorAll('[data-pending-complete]').forEach(form => {
    syncPendingTrackerDestination(form);
    form.querySelectorAll('input[name="trackerDestinationMode"]').forEach(input => input.addEventListener('change', () => syncPendingTrackerDestination(form)));
  });

  elements.pendingBreakRounds.querySelectorAll('[data-pending-open-whatnot]').forEach(button => button.addEventListener('click', async () => {
    const roundId = Number(button.dataset.pendingOpenWhatnot);
    const buyer = button.dataset.whatnotBuyer || '';
    const url = window.WhatnotBuyerLink.profileUrl(buyer);
    if (!url) {
      state.pendingRoundStatus.set(roundId, 'That Buyer Bag does not contain a valid Whatnot username.');
      return renderPendingBreakRounds();
    }
    try {
      const opened = await window.breakSuite.openExternal(url);
      if (opened === false) throw new Error('The Whatnot profile link was rejected.');
      state.pendingRoundStatus.set(roundId, `Opened ${buyerHandle(buyer)} on Whatnot. Press Message, then paste the copied results.`);
    } catch (error) {
      state.pendingRoundStatus.set(roundId, error.message || `Could not open ${buyerHandle(buyer)} on Whatnot.`);
    }
    renderPendingBreakRounds();
  }));

  elements.pendingBreakRounds.querySelectorAll('[data-pending-remove-spot]').forEach(button => button.addEventListener('click', async () => {
    const roundId = Number(button.dataset.pendingRemoveRound);
    const position = Number(button.dataset.pendingRemoveSpot);
    const buyer = button.dataset.pendingRemoveBuyer || '';
    if (!window.confirm(`Remove Spot ${position} from ${buyerHandle(buyer)} in this frozen Pending Review? This is for a false connector assignment. It will not change the current live board, connector, Orders History, Pull History, or accounting.`)) return;
    button.disabled = true;
    try {
      const result = await window.breakSuite.removePendingRoundAssignment({ roundId, position });
      state.pendingRoundStatus.delete(roundId);
      if (!result.roundDeleted) state.pendingRoundStatus.set(roundId, `✓ Removed false Spot ${position} from ${buyerHandle(result.buyer)}. ${result.remainingAssignments} assigned spot${result.remainingAssignments === 1 ? '' : 's'} remain in this review.`);
    } catch (error) {
      state.pendingRoundStatus.set(roundId, error.message || 'The false pending spot could not be removed.');
    }
    await refreshBreakBoard();
  }));
  elements.pendingBreakRounds.querySelectorAll('[data-pending-discard]').forEach(button => button.addEventListener('click', async () => {
    const roundId = Number(button.dataset.pendingDiscard);
    const name = button.dataset.pendingDiscardName || 'this pending review';
    if (!window.confirm(`Discard the entire frozen review “${name}”? Use this only when the snapshot is false. This does not change the current live board or connector and creates no Orders History, Pull History, expense, or accounting records.`)) return;
    button.disabled = true;
    try {
      await window.breakSuite.discardPendingBreakRound({ roundId });
      state.pendingRoundStatus.delete(roundId);
    } catch (error) {
      state.pendingRoundStatus.set(roundId, error.message || 'The pending snapshot could not be discarded.');
    }
    await refreshBreakBoard();
  }));

  elements.pendingBreakRounds.querySelectorAll('[data-pending-round][data-riftbound-buyer-message-position]').forEach(input => input.addEventListener('change', async () => {
    input.disabled = true;
    const roundId = Number(input.dataset.pendingRound);
    try {
      await window.breakSuite.setPendingRoundMessageCardMarked({ roundId, position: Number(input.dataset.riftboundBuyerMessagePosition), marked: input.checked });
      state.pendingRoundStatus.delete(roundId);
    } catch (error) {
      state.pendingRoundStatus.set(roundId, error.message || 'The pending pull selection could not be updated.');
    }
    await refreshBreakBoard(undefined, { preserveScroll: true });
  }));
  elements.pendingBreakRounds.querySelectorAll('[data-pending-round][data-riftbound-audit-card]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    const roundId = Number(button.dataset.pendingRound);
    try {
      const result = await window.breakSuite.setPendingRoundPullQuantity({
        roundId,
        position: Number(button.dataset.riftboundAuditPosition),
        cardId: Number(button.dataset.riftboundAuditCard),
        quantity: Number(button.dataset.riftboundAuditQuantity)
      });
      const round = state.pendingBreakRounds.find(item => Number(item.id) === roundId);
      const delta = setAuditQuantityInState(round?.audit, result.position, result.cardId, result.quantity);
      if (round) round.selectedPullCount = Math.max(0, Number(round.selectedPullCount || 0) + delta);
      state.pendingRoundStatus.delete(roundId);
      updateRiftboundAuditQuantityControl(button, result.quantity);
      updateBuyerBagSelectedCount(button, delta);
      if (round) updatePendingRoundSelectedPulls(round);
    } catch (error) {
      state.pendingRoundStatus.set(roundId, error.message || 'The pending pull quantity could not be updated.');
      button.disabled = false;
    }
  }));
  elements.pendingBreakRounds.querySelectorAll('[data-pending-copy]').forEach(button => button.addEventListener('click', async () => {
    const roundId = Number(button.dataset.pendingCopy);
    try {
      const result = await window.breakSuite.copyPendingRoundBuyerPulls({ roundId, buyer: button.dataset.pendingBuyer });
      state.pendingRoundStatus.set(roundId, `✓ Copied ${result.copiedCards} top hit${result.copiedCards === 1 ? '' : 's'} for ${buyerHandle(result.buyer)}.`);
    } catch (error) {
      state.pendingRoundStatus.set(roundId, error.message || 'The pending buyer message could not be copied.');
    }
    renderPendingBreakRounds();
  }));
  elements.pendingBreakRounds.querySelectorAll('[data-pending-clear]').forEach(button => button.addEventListener('click', async () => {
    const roundId = Number(button.dataset.pendingClear);
    try {
      const result = await window.breakSuite.clearPendingRoundBuyerPulls({ roundId, buyer: button.dataset.pendingBuyer });
      state.pendingRoundStatus.set(roundId, `✓ Cleared ${result.clearedCards} pull selection${result.clearedCards === 1 ? '' : 's'}.`);
    } catch (error) {
      state.pendingRoundStatus.set(roundId, error.message || 'The pending selections could not be cleared.');
    }
    await refreshBreakBoard(undefined, { preserveScroll: true });
  }));
  elements.pendingBreakRounds.querySelectorAll('[data-pending-complete]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const roundId = Number(form.dataset.pendingComplete);
    const values = new FormData(form);
    const disposition = String(values.get('disposition') || 'NORMAL_BREAK');
    const isVoid = disposition === 'TEST_VOID';
    const destinationMode = String(values.get('trackerDestinationMode') || 'AUTO');
    const openCaseId = Number(values.get('openCaseId') || 0);
    const openCase = state.openBoxCases.find(tracker => Number(tracker.id) === openCaseId);
    if (!isVoid && destinationMode === 'OPEN_CASE' && !openCase) {
      state.pendingRoundStatus.set(roundId, 'Choose the current open case before archiving this Buyer Bag.');
      renderPendingBreakRounds();
      return;
    }
    const confirmation = isVoid
      ? 'Discard this TEST / VOID pending review? This removes only the frozen review snapshot and does not create Orders History, Pull History, Business Expense, or Buyer Analytics records.'
      : (destinationMode === 'OPEN_CASE'
        ? `Complete and archive this box into “${openCase.tracker_name}” as Box ${String(nextOpenCaseBoxNumber(openCase)).padStart(2, '0')}? Orders History, Pull History, and Buyer Analytics will still save normally.`
        : 'Complete and archive this box? Final Accounting will save the selected disposition and update Business Expenses without double-counting the box cost.');
    if (!window.confirm(confirmation)) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    state.pendingRoundStatus.set(roundId, 'Saving this box to every history destination…');
    renderPendingBreakRounds();
    try {
      const result = await window.breakSuite.completeAndArchiveBreakRound({ roundId, ...Object.fromEntries(values.entries()) });
      state.pendingRoundStatus.delete(roundId);
      await Promise.all([refreshBreakBoard(), refreshOrderHistory(), refreshBoxTrackers()]);
      state.orderHistorySaveStatus = result.voided
        ? `✓ Removed test/void snapshot “${result.breakName}”. No accounting or history records were created.`
        : (result.tracker?.routeMode === 'OPEN_CASE'
          ? `✓ Archived “${result.breakName}” into ${result.tracker.caseName} · Box ${String(Number(result.tracker.boxNumber || 0)).padStart(2, '0')}. The case remains open with ${Number(result.tracker.remainingBoxes || 0)} box${Number(result.tracker.remainingBoxes || 0) === 1 ? '' : 'es'} remaining.`
          : `✓ Completed “${result.breakName}” as a ${result.tracker?.recordType === 'CASE' ? 'Case' : 'Box'}. ${Number(result.tracker?.trackedHitCount || 0).toLocaleString()} qualifying hit${Number(result.tracker?.trackedHitCount || 0) === 1 ? '' : 's'} transferred automatically to ${result.tracker?.setName || 'Box Tracker'}.`);
    } catch (error) {
      state.pendingRoundStatus.set(roundId, error.message || 'Nothing was archived; this box remains pending review.');
      await refreshBreakBoard();
    }
  }));
}

function riftboundSpotOverviewName(entry = {}) {
  if (entry.spotType === 'DIRECT') return entry.spotLabel || entry.spotCard?.name || 'Named Chase';
  if (entry.spotType === 'RIFTBOUND_SINGLE' && entry.spotLabel) return entry.spotLabel;
  if (entry.spotType === 'UNLEASHED_TOP80' && entry.spotLabel) return entry.spotLabel;
  if (entry.spotType === 'UNLEASHED_EXPANDED' && entry.spotLabel) return entry.spotLabel;
  if (entry.spotType === 'UNLEASHED_CASE_BREAK' && entry.spotLabel) return entry.spotLabel;
  if (entry.spotType === 'UNLEASHED_COLOR_BREAK' && entry.spotLabel) return entry.spotLabel;
  if (entry.poro) return `${entry.poro} + ${entry.color} Rune Bundle`;
  if (entry.baron) return 'Baron Nashor';
  if (entry.spotLabel) return entry.spotLabel;
  if (entry.champion) return `${entry.champion} Champion Spot`;
  return entry.spotCard?.name || 'Riftbound Spot';
}

function riftboundSpotOverviewImage(card = {}, alt = '') {
  if (!card.image_url) return '<span>◈</span>';
  const fallback = String(card.image_fallback_url || '').trim();
  return `<img src="${escapeHtml(card.image_url)}"${fallback ? ` data-image-fallback="${escapeHtml(fallback)}"` : ''} alt="${escapeHtml(alt || card.name || 'Riftbound card')}" loading="lazy" decoding="async" />`;
}

function activateRiftboundSpotOverviewImageFallbacks(root) {
  root?.querySelectorAll?.('img[data-image-fallback]').forEach(image => {
    const forcePaint = () => {
      const card = image.closest('.spot-overview-card, .riftbound-spot-map-hero-art');
      if (card) card.classList.add('image-ready');
      // Chromium was sometimes decoding champion artwork but not painting it
      // until the BreakSuite window was resized. Force a single repaint as soon
      // as each image completes so the gallery and OBS do not depend on resize.
      image.style.transform = 'translateZ(0)';
      void image.offsetWidth;
      window.requestAnimationFrame(() => { image.style.transform = ''; });
    };
    const useFallback = () => {
      if (image.dataset.fallbackUsed === '1') return;
      const fallback = String(image.dataset.imageFallback || '').trim();
      if (!fallback || fallback === image.src) return;
      image.dataset.fallbackUsed = '1';
      image.src = fallback;
    };
    image.addEventListener('load', forcePaint, { once: false });
    image.addEventListener('error', useFallback, { once: false });
    // Handle images that completed before listeners were installed.
    if (image.complete && image.naturalWidth > 0) forcePaint();
    else if (image.complete && image.naturalWidth === 0) useFallback();
  });
}

function riftboundSpotOverviewCard(card = {}, role = '') {
  const treatment = String(card.collector_treatment || card.variant || '').trim();
  const facts = [treatment, card.rarity, card.card_number].filter(Boolean).join(' · ') || 'Riftbound card';
  return `<article class="spot-overview-card ${role ? `family-role-${escapeHtml(role)}` : ''}">
    <div class="spot-overview-card-art">${riftboundSpotOverviewImage(card, card.name)}</div>
    <div class="spot-overview-card-copy"><strong>${escapeHtml(card.name || 'Riftbound card')}</strong><span>${escapeHtml(facts)}</span></div>
  </article>`;
}

function riftboundSpotOverviewGroups(entry = {}) {
  if (Array.isArray(entry.bundleGroups) && entry.bundleGroups.length) return entry.bundleGroups;
  return [{
    key: 'champion-family',
    label: entry.champion ? `${entry.champion} Card Family` : riftboundSpotOverviewName(entry),
    caption: entry.champion ? 'Every matching rarity and collector treatment pulled' : 'Every mapped printing pulled',
    role: entry.champion ? 'champion' : 'direct',
    cards: Array.isArray(entry.family) ? entry.family : []
  }];
}

function renderRiftboundSpotOverview() {
  if (!elements.riftboundSpotOverview || !elements.riftboundSpotOverviewToggle || !elements.riftboundSpotOverviewSummary) return;
  const entries = [...(state.riftboundSpotOverview || [])].sort((left, right) => Number(left.position) - Number(right.position));
  const mappedCardCount = entries.reduce((total, entry) => total + Number(entry.family?.length || 0), 0);
  const singlesOnly = entries.length > 0 && entries.every(entry => entry.spotType === 'RIFTBOUND_SINGLE');
  const setCodes = [...new Set(entries.map(entry => String(entry.setCode || '').trim()).filter(Boolean))];
  elements.riftboundSpotOverviewSummary.textContent = entries.length
    ? `${setCodes.join(' + ') || 'Riftbound'} · ${entries.length} spots · ${mappedCardCount} ${singlesOnly ? 'exact singles' : 'mapped card printings'}`
    : 'Save a Riftbound board to build the map.';
  elements.riftboundSpotOverviewToggle.disabled = !entries.length;
  elements.riftboundSpotOverviewToggle.textContent = state.riftboundSpotOverviewOpen ? 'Hide Overview' : 'Show Overview';
  elements.riftboundSpotOverviewToggle.setAttribute('aria-expanded', state.riftboundSpotOverviewOpen ? 'true' : 'false');
  elements.riftboundSpotOverviewToggle.onclick = () => {
    state.riftboundSpotOverviewOpen = !state.riftboundSpotOverviewOpen;
    renderRiftboundSpotOverview();
  };
  elements.riftboundSpotOverview.classList.toggle('hidden', !state.riftboundSpotOverviewOpen);
  if (!entries.length) {
    elements.riftboundSpotOverview.classList.remove('hidden');
    riftboundSpotOverviewRenderSignature = '';
    elements.riftboundSpotOverview.innerHTML = '<div class="breaker-empty"><b>No live Riftbound spot map yet</b><span>Load the board you want to sell and press Save Board. This overview will then use those exact positions and mappings.</span></div>';
    return;
  }
  if (!state.riftboundSpotOverviewOpen) {
    // Do not keep a hidden gallery of card images in memory. Only the selected
    // visible spot is rendered so this overview stays light during a live show.
    riftboundSpotOverviewRenderSignature = '';
    elements.riftboundSpotOverview.innerHTML = '';
    return;
  }
  if (!entries.some(entry => Number(entry.position) === Number(state.riftboundSpotOverviewSelectedPosition))) {
    state.riftboundSpotOverviewSelectedPosition = Number(entries[0].position);
  }
  const selectedIndex = Math.max(0, entries.findIndex(entry => Number(entry.position) === Number(state.riftboundSpotOverviewSelectedPosition)));
  const entry = entries[selectedIndex];
  const groups = riftboundSpotOverviewGroups(entry);
  const spotName = riftboundSpotOverviewName(entry);
  const selectedCardCount = Number(entry.family?.length || 0);
  const renderSignature = [
    Number(entry.position),
    String(entry.spotLabel || ''),
    // Image hydration must never rebuild a spot that is already visible. Keep
    // the DOM alive based on card identity only; the stable loopback image URL
    // handles caching behind the scenes.
    ...groups.flatMap(group => (group.cards || []).map(card => `${Number(card.id) || 0}:${String(card.card_number || '')}`))
  ].join('|');
  // Connector assignments can refresh Breaker Center data without changing the
  // visual map. Keep the existing DOM/images alive instead of rebuilding the
  // whole selected spot and forcing Chromium/OBS to decode them again.
  if (renderSignature === riftboundSpotOverviewRenderSignature
      && elements.riftboundSpotOverview.querySelector('.riftbound-spot-map-detail')) return;
  const selectors = entries.map(item => {
    const count = Number(item.family?.length || 0);
    const active = Number(item.position) === Number(entry.position);
    return `<button type="button" class="riftbound-spot-map-button ${active ? 'active' : ''}" data-riftbound-spot-overview-position="${Number(item.position)}" aria-pressed="${active ? 'true' : 'false'}"><b>${String(item.position).padStart(2, '0')}</b><span>${escapeHtml(riftboundSpotOverviewName(item))}</span><em>${count} card${count === 1 ? '' : 's'}</em></button>`;
  }).join('');
  const groupMarkup = groups.map((group, index) => `<section class="riftbound-spot-map-group family-role-${escapeHtml(group.role || '')}">
    <header><span>${String(index + 1).padStart(2, '0')}</span><div><h4>${escapeHtml(group.label || 'Mapped Cards')}</h4><p>${escapeHtml(group.caption || 'Included with this spot')}</p></div><b>${Number(group.cards?.length || 0)} CARD${Number(group.cards?.length || 0) === 1 ? '' : 'S'}</b></header>
    <div class="riftbound-spot-map-cards">${group.cards?.length
      ? group.cards.map(card => riftboundSpotOverviewCard(card, group.role)).join('')
      : '<div class="champion-family-empty">No matching cards were found in the synced Riftbound gallery.</div>'}</div>
  </section>`).join('');
  elements.riftboundSpotOverview.innerHTML = `<nav class="riftbound-spot-map-selector" aria-label="Choose a Riftbound spot">${selectors}</nav>
    <article class="riftbound-spot-map-detail">
      <header class="riftbound-spot-map-hero">
        <div class="riftbound-spot-map-hero-art">${riftboundSpotOverviewImage(entry.spotCard || {}, entry.spotCard?.name || spotName)}</div>
        <div><small>SPOT ${String(entry.position).padStart(2, '0')} OF ${entries.length} · ${escapeHtml(entry.setCode || 'RIFTBOUND')}</small><h3>${escapeHtml(spotName)}</h3><p>The buyer receives every matching card shown below when it is pulled from this break.</p></div>
        <div class="riftbound-spot-map-total"><strong>${selectedCardCount}</strong><span>MAPPED CARD${selectedCardCount === 1 ? '' : 'S'}</span><em>${groups.length} GROUP${groups.length === 1 ? '' : 'S'}</em></div>
      </header>
      <div class="riftbound-spot-map-groups">${groupMarkup}</div>
    </article>`;
  riftboundSpotOverviewRenderSignature = renderSignature;
  activateRiftboundSpotOverviewImageFallbacks(elements.riftboundSpotOverview);
  elements.riftboundSpotOverview.querySelectorAll('[data-riftbound-spot-overview-position]').forEach(button => button.addEventListener('click', () => {
    state.riftboundSpotOverviewSelectedPosition = Number(button.dataset.riftboundSpotOverviewPosition);
    renderRiftboundSpotOverview();
  }));
}

function riftboundBuyerBagDomKey(buyer) {
  return encodeURIComponent(comparableBuyerHandle(buyer));
}

function jumpToRiftboundBuyerBag(buyer) {
  const key = riftboundBuyerBagDomKey(buyer);
  const bag = [...(elements.riftboundBreakerBags?.querySelectorAll('[data-riftbound-buyer-bag]') || [])]
    .find(item => item.dataset.riftboundBuyerBag === key);
  if (!bag) return false;
  if (bag.classList.contains('is-collapsed')) {
    const collapse = bag.querySelector('[data-buyer-bag-collapse]');
    if (collapse) collapse.click();
  }
  elements.riftboundBreakerBags?.querySelectorAll('.buyer-bag.search-jump-highlight').forEach(item => item.classList.remove('search-jump-highlight'));
  bag.classList.add('search-jump-highlight');
  bag.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => bag.classList.remove('search-jump-highlight'), 2200);
  return true;
}

function riftboundBuyerCardSearchRows() {
  const assigned = state.activeBoardCards.filter(card => String(card.game_code || '').toUpperCase() === 'RIFTBOUND' && card.block_status !== 'ready' && String(card.buyer_name || '').trim());
  const auditByPosition = new Map(state.riftboundChampionAudit.map(entry => [Number(entry.position), entry]));
  const rows = [];
  assigned.forEach(spot => {
    const buyer = String(spot.buyer_name || '').trim();
    const entry = auditByPosition.get(Number(spot.position));
    const cards = entry?.family?.length ? entry.family : [spot];
    cards.forEach(card => rows.push({
      buyer,
      position: Number(spot.position || entry?.position || 0),
      spotLabel: String(entry?.spotLabel || spot.break_spot_label || spot.name || '').trim(),
      name: String(card.name || spot.name || '').trim(),
      cardNumber: String(card.card_number || '').trim(),
      setCode: String(card.set_code || spot.set_code || '').trim(),
      treatment: String(card.collector_treatment || card.rarity || '').trim()
    }));
  });
  return rows;
}

function renderRiftboundBuyerCardSearch() {
  const input = elements.riftboundBuyerCardSearch;
  const results = elements.riftboundBuyerCardSearchResults;
  if (!input || !results) return;
  const query = String(input.value || '').trim().toLowerCase();
  if (!query) {
    results.innerHTML = '';
    results.classList.add('hidden');
    return;
  }
  const compact = query.replace(/[^a-z0-9]/g, '');
  const matches = riftboundBuyerCardSearchRows().filter(row => {
    const fields = [row.cardNumber, row.name, row.setCode, row.spotLabel, row.position].map(value => String(value || '').toLowerCase());
    const joined = fields.join(' ');
    const joinedCompact = joined.replace(/[^a-z0-9]/g, '');
    return joined.includes(query) || (compact && joinedCompact.includes(compact));
  }).sort((a, b) => {
    const aExact = String(a.cardNumber || '').toLowerCase() === query ? 0 : 1;
    const bExact = String(b.cardNumber || '').toLowerCase() === query ? 0 : 1;
    return aExact - bExact || a.position - b.position || a.name.localeCompare(b.name);
  }).slice(0, 12);
  results.innerHTML = matches.length ? matches.map(row => `<button type="button" class="riftbound-buyer-search-result" data-riftbound-search-buyer="${escapeHtml(row.buyer)}" role="option"><span><b>${escapeHtml(row.cardNumber || row.setCode || `Spot ${row.position}`)}</b><strong>${escapeHtml(row.name || row.spotLabel || 'Riftbound card')}</strong></span><span><em>${escapeHtml(buyerHandle(row.buyer))}</em><small>Spot ${Number(row.position)}${row.treatment ? ` · ${escapeHtml(row.treatment)}` : ''}</small></span></button>`).join('') : `<div class="riftbound-buyer-search-empty">No assigned Buyer Bag card matches “${escapeHtml(input.value.trim())}”.</div>`;
  results.classList.remove('hidden');
  results.querySelectorAll('[data-riftbound-search-buyer]').forEach(button => button.addEventListener('click', () => {
    const buyer = button.dataset.riftboundSearchBuyer || '';
    if (jumpToRiftboundBuyerBag(buyer)) {
      input.value = '';
      results.innerHTML = '';
      results.classList.add('hidden');
    }
  }));
}

function renderRiftboundBreakerCenter() {
  renderPendingBreakRounds();
  const cards = state.activeBoardCards
    .filter(card => String(card.game_code || '').toUpperCase() === 'RIFTBOUND')
    .sort((left, right) => Number(left.position) - Number(right.position));
  const remaining = cards.filter(card => card.block_status === 'ready');
  const assigned = cards.filter(card => card.block_status !== 'ready');
  const remainingPriority = remaining.filter(card => riftboundBreakerGroupKey(card) !== 'LEFTOVERS');
  const buyerMap = new Map();
  assigned.filter(card => String(card.buyer_name || '').trim()).forEach(card => {
    const buyer = String(card.buyer_name || '').trim();
    if (!buyerMap.has(buyer)) buyerMap.set(buyer, []);
    buyerMap.get(buyer).push(card);
  });
  const bags = [...buyerMap.entries()].map(([buyer, buyerCards]) => ({
    buyer,
    cards: buyerCards.sort((left, right) => {
      const leftRank = RIFTBOUND_BREAKER_PRIORITY_GROUPS.findIndex(group => group.key === riftboundBreakerGroupKey(left));
      const rightRank = RIFTBOUND_BREAKER_PRIORITY_GROUPS.findIndex(group => group.key === riftboundBreakerGroupKey(right));
      return leftRank - rightRank || Number(left.position) - Number(right.position);
    }),
    spendCents: buyerCards.reduce((total, card) => total + Math.max(0, Number(card.sale_amount_cents || 0)), 0),
    pricedCards: buyerCards.filter(card => Number(card.sale_amount_cents || 0) > 0).length
  })).sort((left, right) => right.spendCents - left.spendCents || right.cards.length - left.cards.length || left.buyer.localeCompare(right.buyer));
  const capturedSpendCents = bags.reduce((total, bag) => total + bag.spendCents, 0);
  const calledPositions = new Set(assigned.filter(card => card.block_status === 'called').map(card => Number(card.position)));
  const selectedDirectPullCount = assigned.filter(card => card.block_status === 'called' && Number(card.message_marked)).length;
  const selectedAuditPullCount = state.riftboundChampionAudit
    .filter(entry => calledPositions.has(Number(entry.position)))
    .reduce((total, entry) => total + entry.family.reduce((familyTotal, card) => familyTotal + Number(card.audit_quantity || 0), 0), 0);
  const selectedPullCount = selectedDirectPullCount + selectedAuditPullCount;
  elements.saveRiftboundPullHistory.disabled = selectedPullCount < 1;
  elements.saveRiftboundPullHistory.textContent = selectedPullCount
    ? `▣ Save ${selectedPullCount.toLocaleString()} Selected Pull${selectedPullCount === 1 ? '' : 's'}`
    : '▣ Save Selected Pulls';
  elements.riftboundPullHistorySaveStatus.textContent = state.pullHistorySaveStatus;
  const boardPriceStatus = state.riftboundBoardPriceStatus;
  if (elements.refreshRiftboundBoardPrices) {
    elements.refreshRiftboundBoardPrices.disabled = !cards.length || boardPriceStatus?.type === 'loading';
    elements.refreshRiftboundBoardPrices.textContent = boardPriceStatus?.type === 'loading' ? 'Preparing Entire Board…' : activePriceSourceUi().boardButton;
  }
  if (elements.riftboundBoardPriceStatus) {
    elements.riftboundBoardPriceStatus.textContent = boardPriceStatus?.message
      || 'Price every Remaining Card and every card displayed inside Buyer Bags together. Price badges stay private and Hide Spending hides them.';
    elements.riftboundBoardPriceStatus.classList.toggle('error', boardPriceStatus?.type === 'error');
    elements.riftboundBoardPriceStatus.classList.toggle('loading', boardPriceStatus?.type === 'loading');
  }

  elements.riftboundBreakerSummary.innerHTML = [
    ['Cards remaining', remaining.length],
    ['Tracked rarities left', remainingPriority.length],
    ['Assigned', assigned.length],
    ['Buyer bags', bags.length],
    ['Live sales', capturedSpendCents ? formatPrivateRiftboundMoney(capturedSpendCents) : '—']
  ].map(([label, value]) => `<span><b>${typeof value === 'number' ? Number(value).toLocaleString() : escapeHtml(value)}</b>${escapeHtml(label)}</span>`).join('');

  const groupCounts = Object.fromEntries(RIFTBOUND_BREAKER_PRIORITY_GROUPS.map(group => [group.key, remaining.filter(card => riftboundBreakerGroupKey(card) === group.key).length]));
  const remainingCount = remaining.length;
  const topHitCount = RIFTBOUND_BREAKER_TOP_ODDS_GROUPS.reduce((total, group) => total + Number(groupCounts[group.key] || 0), 0);
  const otherCount = Math.max(0, remainingCount - topHitCount);
  const topHitOdds = formatSpotOdds(topHitCount, remainingCount);
  elements.riftboundBreakerOddsTotal.innerHTML = !cards.length
    ? '<strong>—</strong><span>save a Riftbound board</span><b>No Riftbound spot odds yet</b>'
    : remainingCount
      ? `<strong>${Number(remainingCount).toLocaleString()}</strong><span>spots remaining</span><b>${escapeHtml(topHitOdds.percentage)} top-hit chance</b>`
      : '<strong>0</strong><span>spots remaining</span><b>Riftbound board is complete</b>';
  elements.riftboundBreakerOdds.innerHTML = [
    breakerOddsCard({ label: 'Any Riftbound top-hit spot', count: topHitCount, total: remainingCount, accent: 'top-hit', combined: true, riftboundGroup: 'TOP' }),
    ...RIFTBOUND_BREAKER_TOP_ODDS_GROUPS.map(group => breakerOddsCard({ label: group.label, count: Number(groupCounts[group.key] || 0), total: remainingCount, accent: group.accent, riftboundGroup: group.key })),
    breakerOddsCard({ label: 'All other Riftbound spots', count: otherCount, total: remainingCount, accent: 'leftovers', riftboundGroup: 'LEFTOVERS' })
  ].join('');

  if (!RIFTBOUND_BREAKER_PRIORITY_GROUPS.some(group => group.key === state.riftboundBreakerFilter)) state.riftboundBreakerFilter = 'SIGNATURE';
  elements.riftboundBreakerPriorityTabs.innerHTML = RIFTBOUND_BREAKER_PRIORITY_GROUPS.map(group => `<button class="breaker-priority-tab riftbound-symbol-tab ${group.key === state.riftboundBreakerFilter ? 'active' : ''}" data-riftbound-breaker-group="${group.key}"><span class="riftbound-tab-label">${riftboundRarityIcon(group.key)}<em>${escapeHtml(group.label)}</em></span><b>${Number(groupCounts[group.key] || 0).toLocaleString()}</b></button>`).join('');
  elements.riftboundBreakerPriorityTabs.querySelectorAll('[data-riftbound-breaker-group]').forEach(button => button.addEventListener('click', () => {
    state.riftboundBreakerFilter = button.dataset.riftboundBreakerGroup;
    renderRiftboundBreakerCenter();
  }));

  const shownCards = remaining.filter(card => riftboundBreakerGroupKey(card) === state.riftboundBreakerFilter);
  const currentGroup = RIFTBOUND_BREAKER_PRIORITY_GROUPS.find(group => group.key === state.riftboundBreakerFilter);
  elements.riftboundBreakerPriorityCards.innerHTML = shownCards.length
    ? shownCards.map(riftboundBreakerCardTile).join('')
    : `<div class="breaker-empty">${cards.length
      ? `No ${escapeHtml(currentGroup?.label || 'matching')} Riftbound cards are left. Assigned cards appear in the Riftbound Buyer Bags below.`
      : 'No Riftbound live ledger is active. Load a saved Riftbound board and press Save Board; the shared connector and OBS overlay will then feed this center automatically.'}</div>`;

  const championAuditByPosition = new Map(state.riftboundChampionAudit.map(entry => [Number(entry.position), entry]));
  elements.riftboundBreakerBags.classList.toggle('riftbound-audit-bags', Boolean(bags.length));
  elements.riftboundBreakerBags.innerHTML = bags.length
    ? bags.map(bag => {
      const championEntries = bag.cards.map(card => championAuditByPosition.get(Number(card.position))).filter(Boolean);
      const singleEntries = championEntries.filter(entry => entry.spotType === 'RIFTBOUND_SINGLE');
      const mappedEntries = championEntries.filter(entry => entry.spotType !== 'RIFTBOUND_SINGLE');
      const directCards = bag.cards.filter(card => !championAuditByPosition.has(Number(card.position)));
      const selected = directCards.filter(card => Number(card.message_marked)).length
        + championEntries.reduce((total, entry) => total + entry.family.reduce((familyTotal, card) => familyTotal + Number(card.audit_quantity || 0), 0), 0);
      const singlesOnly = championEntries.length > 0 && championEntries.every(entry => entry.spotType === 'RIFTBOUND_SINGLE');
      const status = state.riftboundBuyerMessageStatus.get(comparableBuyerHandle(bag.buyer)) || '';
      const collapsed = buyerBagIsCollapsed(bag.buyer);
      return `<article class="buyer-bag riftbound-audit-bag${collapsed ? ' is-collapsed' : ''}" data-riftbound-buyer-bag="${escapeHtml(riftboundBuyerBagDomKey(bag.buyer))}"><div class="buyer-bag-head"><div><div class="buyer-bag-title-row"><span>${singlesOnly ? 'RIFTBOUND SINGLES BAG' : 'RIFTBOUND BUYER BAG'}</span>${buyerBagPriceControl(bag.buyer, selected)}${buyerBagCollapseControl(bag.buyer)}</div><h3>${escapeHtml(buyerHandle(bag.buyer))}</h3></div><div class="buyer-bag-totals buyer-bag-count-only"><em>${bag.cards.length.toLocaleString()} purchased spot${bag.cards.length === 1 ? '' : 's'}</em></div></div><div class="buyer-bag-collapsible">${buyerBagPriceStatusMarkup(bag.buyer)}<div class="buyer-bag-message"><div><strong data-buyer-bag-selected="${selected}">${selected.toLocaleString()} actual card${selected === 1 ? '' : 's'} recorded</strong><span>${singlesOnly ? 'Each purchased position shows only its exact single card' : 'Champion and mapped bundle pulls stay private until you copy the message'}</span></div><div class="buyer-message-actions"><button class="buyer-clear-selection" data-clear-riftbound-buyer-message="${escapeHtml(bag.buyer)}" ${selected ? '' : 'disabled'}>Clear Audit</button><button class="buyer-copy-message" data-copy-riftbound-buyer-message="${escapeHtml(bag.buyer)}" ${selected ? '' : 'disabled'}>Copy Results</button></div></div>${status ? `<p class="buyer-message-status">${escapeHtml(status)}</p>` : ''}<div class="riftbound-audit-content">${riftboundSinglesAuditGrid(singleEntries)}${mappedEntries.map(riftboundChampionAuditPanel).join('')}${directCards.length ? `<section class="direct-chase-audit"><h4>Named Chase / Other Positions</h4><p>Select the displayed card only when that exact chase was pulled.</p><div class="buyer-card-grid">${directCards.map(riftboundBuyerMessageCardTile).join('')}</div></section>` : ''}</div></div></article>`;
    }).join('')
    : '<div class="breaker-empty">No Riftbound buyers are assigned yet. Buyer Bags appear automatically when the shared connector receives a buyer and spot number from a saved Riftbound ledger.</div>';

  wireBuyerBagPriceChecks(elements.riftboundBreakerBags);
  wireBuyerBagCollapseControls(elements.riftboundBreakerBags);

  elements.riftboundBreakerBags.querySelectorAll('[data-riftbound-buyer-message-position]').forEach(input => input.addEventListener('change', async () => {
    const buyer = input.dataset.riftboundBuyerMessageBuyer || '';
    input.disabled = true;
    state.riftboundBuyerMessageStatus.delete(comparableBuyerHandle(buyer));
    try {
      await window.breakSuite.setBuyerMessageCardMarked(Number(input.dataset.riftboundBuyerMessagePosition), input.checked);
    } catch (error) {
      state.riftboundBuyerMessageStatus.set(comparableBuyerHandle(buyer), error.message || 'The Riftbound message selection could not be updated.');
    }
    await refreshBreakBoard(undefined, { preserveScroll: true });
  }));
  elements.riftboundBreakerBags.querySelectorAll('[data-riftbound-audit-card]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await window.breakSuite.setRiftboundChampionPullQuantity({
        position: Number(button.dataset.riftboundAuditPosition),
        cardId: Number(button.dataset.riftboundAuditCard),
        quantity: Number(button.dataset.riftboundAuditQuantity)
      });
      const delta = setAuditQuantityInState(state.riftboundChampionAudit, result.position, result.cardId, result.quantity);
      updateRiftboundAuditQuantityControl(button, result.quantity);
      updateBuyerBagSelectedCount(button, delta);
      updateLiveRiftboundSelectedPullButton();
    } catch (error) {
      const entry = state.riftboundChampionAudit.find(item => Number(item.position) === Number(button.dataset.riftboundAuditPosition));
      if (entry) state.riftboundBuyerMessageStatus.set(comparableBuyerHandle(entry.buyer), error.message || 'The champion pull could not be recorded.');
      button.disabled = false;
    }
  }));
  elements.riftboundBreakerBags.querySelectorAll('[data-copy-riftbound-buyer-message]').forEach(button => button.addEventListener('click', async () => {
    const buyer = button.dataset.copyRiftboundBuyerMessage || '';
    button.disabled = true;
    try {
      const result = await window.breakSuite.copyRiftboundBuyerPulls(buyer);
      state.riftboundBuyerMessageStatus.set(comparableBuyerHandle(buyer), `✓ Copied ${result.copiedCards} Riftbound top hit${result.copiedCards === 1 ? '' : 's'}.`);
    } catch (error) {
      state.riftboundBuyerMessageStatus.set(comparableBuyerHandle(buyer), error.message || 'The Riftbound congratulations message could not be copied.');
    }
    renderRiftboundBreakerCenter();
  }));
  elements.riftboundBreakerBags.querySelectorAll('[data-clear-riftbound-buyer-message]').forEach(button => button.addEventListener('click', async () => {
    const buyer = button.dataset.clearRiftboundBuyerMessage || '';
    button.disabled = true;
    try {
      const result = await window.breakSuite.clearRiftboundBuyerPullSelections(buyer);
      state.riftboundBuyerMessageStatus.set(comparableBuyerHandle(buyer), result.clearedCards
        ? `✓ Cleared ${result.clearedCards} selected Riftbound pull${result.clearedCards === 1 ? '' : 's'}.`
        : 'No Riftbound pulls were selected.');
    } catch (error) {
      state.riftboundBuyerMessageStatus.set(comparableBuyerHandle(buyer), error.message || 'The Riftbound selections could not be cleared.');
    }
    await refreshBreakBoard(undefined, { preserveScroll: true });
  }));

  elements.riftboundBreakerRanking.innerHTML = bags.length
    ? bags.map((bag, index) => `<li><b>${index + 1}</b><button type="button" class="buyer-ranking-jump" data-riftbound-buyer-jump="${escapeHtml(bag.buyer)}" title="Jump to ${escapeHtml(buyerHandle(bag.buyer))}'s Buyer Bag">${escapeHtml(buyerHandle(bag.buyer))}</button><div class="buyer-ranking-spend"><strong>${escapeHtml(formatPrivateRiftboundMoney(bag.spendCents))}</strong><small>${bag.cards.length.toLocaleString()} Riftbound card${bag.cards.length === 1 ? '' : 's'} · ${state.riftboundSpendingVisible ? escapeHtml(buyerSpendDescription(bag)) : 'financial values hidden'}</small></div></li>`).join('')
    : '<li class="ranking-empty">Riftbound buyer ranking will appear as assignments arrive.</li>';
  elements.riftboundBreakerRanking.querySelectorAll('[data-riftbound-buyer-jump]').forEach(button => button.addEventListener('click', () => jumpToRiftboundBuyerBag(button.dataset.riftboundBuyerJump || '')));
  renderRiftboundBuyerCardSearch();
  if (elements.riftboundBreakerView) elements.riftboundBreakerView.classList.toggle('riftbound-financial-hidden', !state.riftboundSpendingVisible);
  if (elements.riftboundSpendingPanel) elements.riftboundSpendingPanel.classList.toggle('hidden', !state.riftboundSpendingVisible);
  if (elements.toggleRiftboundSpending) {
    elements.toggleRiftboundSpending.textContent = state.riftboundSpendingVisible ? 'Hide Spending' : 'Show Spending';
    elements.toggleRiftboundSpending.setAttribute('aria-pressed', state.riftboundSpendingVisible ? 'false' : 'true');
  }
}

if (elements.riftboundBuyerCardSearch) {
  elements.riftboundBuyerCardSearch.addEventListener('input', renderRiftboundBuyerCardSearch);
  elements.riftboundBuyerCardSearch.addEventListener('focus', renderRiftboundBuyerCardSearch);
  elements.riftboundBuyerCardSearch.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      elements.riftboundBuyerCardSearch.value = '';
      renderRiftboundBuyerCardSearch();
      elements.riftboundBuyerCardSearch.blur();
    }
    if (event.key === 'Enter') {
      const first = elements.riftboundBuyerCardSearchResults?.querySelector('[data-riftbound-search-buyer]');
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  });
}

document.addEventListener('click', event => {
  if (!elements.riftboundBuyerCardSearchResults || !elements.riftboundBuyerCardSearch) return;
  if (event.target === elements.riftboundBuyerCardSearch || elements.riftboundBuyerCardSearchResults.contains(event.target)) return;
  elements.riftboundBuyerCardSearchResults.classList.add('hidden');
});

if (elements.toggleRiftboundSpending) {
  elements.toggleRiftboundSpending.addEventListener('click', () => {
    state.riftboundSpendingVisible = !state.riftboundSpendingVisible;
    renderRiftboundBreakerCenter();
  });
}

elements.refreshRiftboundBoardPrices?.addEventListener('click', runRiftboundBoardPriceRefresh);

elements.buyerPriceSource?.addEventListener('change', async () => {
  const requested = elements.buyerPriceSource.value;
  elements.buyerPriceSource.disabled = true;
  try {
    await saveSelectedPriceSource(requested);
  } catch (error) {
    syncBuyerPriceSourceControl();
    state.buyerBagPriceStatus.set('0:price-source', { type: 'error', message: error.message || 'The price source could not be saved.' });
  } finally {
    elements.buyerPriceSource.disabled = false;
  }
});

elements.pullHistoryPriceSource?.addEventListener('change', async () => {
  const requested = elements.pullHistoryPriceSource.value;
  elements.pullHistoryPriceSource.disabled = true;
  try {
    await saveSelectedPriceSource(requested);
  } catch {
    syncBuyerPriceSourceControl();
  } finally {
    elements.pullHistoryPriceSource.disabled = false;
  }
});

window.addEventListener('breaksuite:pricing-settings-changed', event => {
  if (!event.detail) return;
  state.pricing = event.detail;
  syncBuyerPriceSourceControl();
  if (state.view === 'riftbound-breaker') renderRiftboundBreakerCenter();
  if (state.view === 'history' && state.historyTab === 'pulls') renderPullHistory();
});

elements.copyChatGptPriceRequest?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(chatGptPriceRequest());
    elements.priceInputStatus.textContent = '✓ Exact-card request copied. Paste it into ChatGPT, then paste the JSON answer back here.';
    elements.copyChatGptPriceRequest.textContent = 'Copied ✓';
    window.setTimeout(() => {
      if (elements.copyChatGptPriceRequest && state.priceInput) elements.copyChatGptPriceRequest.textContent = chatGptCopyButtonLabel();
    }, 1800);
  } catch (error) {
    elements.priceInputStatus.textContent = error.message || 'The ChatGPT request could not be copied.';
  }
});

elements.cancelPriceInput?.addEventListener('click', closePriceInputModal);
elements.priceInputForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.priceInput || elements.savePriceInput?.disabled) return;
  elements.savePriceInput.disabled = true;
  elements.savePriceInput.textContent = 'Saving…';
  try {
    await saveOpenPriceInput();
  } catch (error) {
    elements.priceInputStatus.textContent = error.message || 'These prices could not be saved.';
  } finally {
    if (elements.savePriceInput) {
      elements.savePriceInput.disabled = false;
      elements.savePriceInput.textContent = 'Save Prices';
    }
  }
});
elements.priceInputModal?.addEventListener('click', event => {
  if (event.target === elements.priceInputModal) closePriceInputModal();
});

async function openPriceSourceSetup() {
  await setView('sniper');
  try { await window.refreshCardSniper?.(); } catch {}
  const setup = document.querySelector('.sniper-api');
  if (setup) setup.open = true;
  const game = document.querySelector('#sniper-game');
  if (game && game.value !== 'RIFTBOUND') {
    game.value = 'RIFTBOUND';
    game.dispatchEvent(new Event('change'));
  }
  window.setTimeout(() => document.querySelector('#sniper-buyer-price-source')?.focus(), 0);
}

elements.openBuyerPriceFeed?.addEventListener('click', openPriceSourceSetup);
elements.openPullPriceFeed?.addEventListener('click', openPriceSourceSetup);

function renderReadyChecks() {
  const connector = state.connector || {};
  const ready = Boolean(state.boardOverview?.ready);
  const hasCards = state.boardCards.length > 0;
  const connectorRunning = Boolean(connector.running);
  const overlayOpen = Boolean(connector.overlayOpen);
  const checks = [
    ['Cards selected for this break', hasCards],
    [`Saved live ledger (${Number(state.boardOverview?.activeCount || 0).toLocaleString()} blocks)`, ready],
    ['Local connector is running', connectorRunning],
    ['Overlay display is open', overlayOpen]
  ];
  elements.breakReadyChecks.innerHTML = checks.map(([label, complete]) => readyCheck(label, complete)).join('');
  elements.boardLivePill.textContent = ready ? '✓ LIVE LEDGER SAVED' : 'SAVE TO GO LIVE';
  elements.boardLivePill.classList.toggle('ready', ready);
}

function renderConnector() {
  const connector = state.connector || {};
  const ready = Boolean(state.boardOverview?.ready);
  const isRunning = Boolean(connector.running);
  const lastBlock = connector.lastBlock;
  elements.connectorStatus.className = `connector-status ${connector.error ? 'error' : (isRunning ? 'ready' : '')}`;
  elements.connectorStatus.textContent = connector.error
    ? `Connector unavailable: ${connector.error}`
    : (isRunning ? `Listening locally on port ${connector.port}${connector.liveRoundName ? ` for ${connector.liveRoundName}` : ''}.` : 'Starting local connector…');
  elements.connectorChecks.innerHTML = [
    ['Saved live ledger is ready', ready],
    ['Local connector is listening', isRunning],
    ['Overlay display is open', Boolean(connector.overlayOpen)],
    [lastBlock ? `Last signal: block ${lastBlock.position} → ${lastBlock.cardName}` : 'No connector signal received yet', Boolean(lastBlock)]
  ].map(([label, complete]) => readyCheck(label, complete)).join('');
  const activeCards = ready ? state.activeBoardCards.filter(card => card.block_status === 'ready').sort((left, right) => left.position - right.position) : [];
  elements.connectorTestBlock.innerHTML = activeCards.length
    ? activeCards.map(card => `<option value="${card.position}">Block ${String(card.position).padStart(2, '0')}</option>`).join('')
    : '<option value="">Save a board first</option>';
  elements.connectorTestBlock.disabled = !activeCards.length;
  elements.sendConnectorTest.disabled = !activeCards.length || !isRunning;
  elements.connectorTestBuyer.disabled = !activeCards.length || !isRunning;
  elements.runConnectorStressTest.disabled = !isRunning || (!activeCards.length && !Number(connector.testAssignments || 0));
  elements.resetConnectorTest.disabled = !Number(connector.testAssignments || 0);
}

function selectedBoardPreset() {
  return state.boardPresets.find(preset => Number(preset.slot) === Number(state.selectedBoardPresetSlot)) || null;
}

function renderBoardPresets() {
  if (!elements.breakPresetSlots) return;
  const loadedPreset = state.boardPresets.find(preset => preset.isLoaded);
  if (!state.boardPresets.some(preset => Number(preset.slot) === Number(state.selectedBoardPresetSlot))) {
    state.selectedBoardPresetSlot = Number(loadedPreset?.slot || 1);
  }
  const selected = selectedBoardPreset();
  elements.breakPresetSlots.innerHTML = state.boardPresets.map(preset => {
    const isSelected = Number(preset.slot) === Number(state.selectedBoardPresetSlot);
    const name = preset.name || 'Empty setup';
    const gameName = preset.gameCode === 'RIFTBOUND' ? 'Riftbound' : 'One Piece';
    const modeName = preset.gameCode === 'RIFTBOUND' && preset.mappingMode === 'SINGLES'
      ? ' · Singles'
      : preset.customizedMapping ? ' · Custom map' : '';
    const countText = preset.installWarning || (preset.count ? `${Number(preset.count).toLocaleString()} ${gameName} cards${modeName}` : 'Save a board here');
    const stateText = preset.installWarning ? 'UPDATE PENDING' : preset.isLoaded ? 'WORKING BOARD' : (preset.count ? 'READY TO LOAD' : 'EMPTY');
    const title = preset.installWarning || (preset.count ? `Load ${name}` : `Select setup ${preset.slot}`);
    return `<button class="break-preset-slot ${isSelected ? 'selected' : ''} ${preset.isLoaded ? 'loaded' : ''}" data-preset-slot="${preset.slot}" title="${escapeHtml(title)}" aria-pressed="${isSelected ? 'true' : 'false'}"><b>${String(preset.slot).padStart(2, '0')}</b><strong>${escapeHtml(name)}</strong><span>${escapeHtml(countText)}</span><i>${stateText}</i></button>`;
  }).join('');
  elements.breakPresetSlots.querySelectorAll('[data-preset-slot]').forEach(button => button.addEventListener('click', async () => {
    const slot = Number(button.dataset.presetSlot);
    const preset = state.boardPresets.find(item => Number(item.slot) === slot);
    if (preset?.isLoaded) {
      state.selectedBoardPresetSlot = slot;
      state.boardPresetMessage = `Setup ${String(slot).padStart(2, '0')} is already the working board. Save Board only when you want it to become the live ledger.`;
      renderBoardPresets();
      return;
    }
    const prompt = preset?.count
      ? `Load “${preset.name || `Setup ${slot}`}” with ${preset.count} cards? This replaces the working board only. The live ledger and OBS display will not change until you press Save Board.`
      : `Open empty Setup ${String(slot).padStart(2, '0')}? This clears only the current working board so you can build a new one. Your saved setups, live ledger, and OBS display will stay safe.`;
    if (!window.confirm(prompt)) {
      renderBoardPresets();
      return;
    }
    state.selectedBoardPresetSlot = slot;
    button.disabled = true;
    try {
      const result = await window.breakSuite.loadBreakBoardPreset(slot);
      if (result.empty) {
        state.boardPresetMessage = `✓ Setup ${String(slot).padStart(2, '0')} is now the only working board. It is empty and ready for a new ${result.gameCode === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'} setup. Your other saved boards and live ledger were not changed.`;
        elements.breakBoardStatus.textContent = state.boardPresetMessage;
        await refreshBreakBoard();
        if (isLibraryView()) await refreshCards();
        return;
      }
      const numberingNote = result.renumbered
        ? ` Its block numbers were re-counted from 1 to ${result.loadedCards.toLocaleString()}.`
        : '';
      state.boardPresetMessage = `✓ Loaded ${result.name || `Setup ${String(slot).padStart(2, '0')}`} with ${result.loadedCards.toLocaleString()} cards.${numberingNote} It is still a working board—press Save Board when this is the break you want live.`;
      elements.breakBoardStatus.textContent = state.boardPresetMessage;
      await refreshBreakBoard();
      if (isLibraryView()) await refreshCards();
    } catch (error) {
      state.boardPresetMessage = error.message || 'That saved setup could not be loaded.';
      renderBoardPresets();
    }
  }));
  if (elements.breakPresetName && document.activeElement !== elements.breakPresetName) {
    elements.breakPresetName.value = selected?.name || '';
  }
  if (elements.breakBoardGame && document.activeElement !== elements.breakBoardGame) elements.breakBoardGame.value = state.boardGame;
  if (elements.breakBagMode && document.activeElement !== elements.breakBagMode) elements.breakBagMode.value = state.boardMappingMode;
  if (elements.breakBagMode) {
    elements.breakBagMode.disabled = state.boardGame !== 'RIFTBOUND';
    elements.breakBagMode.title = state.boardGame === 'RIFTBOUND'
      ? 'Singles shows only the exact purchased card at each position. Mapped groups use champion and bundle families.'
      : 'One Piece Buyer Bags already use exact board positions.';
  }
  if (elements.breakPresetStatus) {
    elements.breakPresetStatus.textContent = state.boardPresetMessage || (selected?.count
      ? `Setup ${String(selected.slot).padStart(2, '0')} stores ${Number(selected.count).toLocaleString()} cards. Click its square any time to load it without changing the live ledger.`
      : `Setup ${String(state.selectedBoardPresetSlot).padStart(2, '0')} is ready for a new board.`);
  }
  elements.clearBreakPreset.disabled = !selected?.count;
}

function renderBreakBoard() {
  const cards = state.boardCards;
  const willStartNextRound = Number(state.connector?.activeAssignments || 0) > 0;
  elements.saveBreakBoard.textContent = willStartNextRound ? 'Save Board & Start Next Box' : 'Save Board ✓';
  elements.saveBreakBoard.title = willStartNextRound
    ? 'Moves the current Buyer Bags to Pending Review, then makes this working board the connector\'s new live box.'
    : 'Save this working board as the connector\'s live ledger.';
  if (elements.breakBoardGame) {
    elements.breakBoardGame.value = state.boardGame;
    elements.breakBoardGame.disabled = cards.length > 0;
    elements.breakBoardGame.title = cards.length ? 'Clear the working board before changing its library.' : 'Choose which card library this working board uses.';
  }
  elements.breakBoardCount.textContent = `${cards.length.toLocaleString()} card${cards.length === 1 ? '' : 's'} selected`;
  elements.breakListingPreview.textContent = cards.length ? formatBreakListing(cards) : 'No cards selected yet.';
  renderBoardPresets();
  renderReadyChecks();
  renderConnector();
  if (!cards.length) {
    elements.breakBoardGrid.innerHTML = `<div class="empty-state board-empty"><div class="empty-icon">▤</div><h3>Your break board is empty</h3><p>Open the Library, select a card, then choose Add to Break Board. Only selected cards will appear in the overlay display.</p><button class="text-button" id="choose-break-cards">Choose cards from Library</button></div>`;
    document.querySelector('#choose-break-cards').addEventListener('click', () => setView(state.boardGame === 'RIFTBOUND' ? 'library-riftbound' : 'library-onepiece'));
    return;
  }
  elements.breakBoardGrid.innerHTML = cards.map(card => `
    <article class="break-card">
      <div class="break-card-art">${cardImage(card.image_url, card.name, isProductOnlyDon(card))}</div>
      <div class="break-card-copy"><b>${String(card.position).padStart(2, '0')}</b><div class="break-card-details"><strong>${escapeHtml(card.break_spot_label || card.name)}</strong>${card.game_code === 'RIFTBOUND' ? riftboundCardFacts(card) : `<span>${escapeHtml([card.set_code, card.card_number, card.break_rarity || card.rarity].filter(Boolean).join(' · '))}</span>`}</div></div>
      <button class="break-remove" data-break-card-id="${card.id}">Remove</button>
    </article>`).join('');
  elements.breakBoardGrid.querySelectorAll('[data-break-card-id]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    await window.breakSuite.setBreakBoardCard(Number(button.dataset.breakCardId), false);
    await refreshBreakBoard();
    if (isLibraryView()) await refreshCards();
  }));
}

function restoreBreakBoardScroll(position) {
  if (!position) return;
  const restore = () => window.scrollTo(position.x, position.y);
  // Chromium can apply focus/scroll anchoring once more after replacement DOM
  // has been laid out. Restore on two frames so Buyer Bag pull controls stay
  // exactly where the seller clicked them.
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
}

async function refreshBreakBoard(cards, { preserveScroll = false } = {}) {
  const scrollPosition = preserveScroll ? { x: window.scrollX, y: window.scrollY } : null;
  state.boardCards = cards || await window.breakSuite.getBreakBoard();
  const needsRiftboundAudit = state.view === 'riftbound-breaker';
  const needsPendingRounds = state.view === 'riftbound-breaker';
  const [boardOverview, connector, activeBoardCards, boardPresets, riftboundChampionAudit, pendingBreakRounds, openCases] = await Promise.all([
    window.breakSuite.getBreakBoardOverview(),
    window.breakSuite.getConnectorStatus(),
    window.breakSuite.getActiveBreakBoard(),
    window.breakSuite.getBreakBoardPresets(),
    needsRiftboundAudit ? window.breakSuite.getRiftboundChampionAudit() : Promise.resolve(state.riftboundChampionAudit),
    needsPendingRounds ? window.breakSuite.getPendingBreakRounds() : Promise.resolve(state.pendingBreakRounds),
    needsPendingRounds ? window.breakSuite.getOpenBoxCases() : Promise.resolve({ cases: state.openBoxCases, activeOpenCaseId: state.activeOpenCaseId })
  ]);
  state.boardOverview = boardOverview;
  state.boardGame = boardOverview.gameCode || 'ONEPIECE';
  state.boardMappingMode = boardOverview.mappingMode || 'MAPPED';
  state.connector = connector;
  state.activeBoardCards = activeBoardCards;
  state.boardPresets = boardPresets;
  state.riftboundChampionAudit = riftboundChampionAudit;
  state.pendingBreakRounds = pendingBreakRounds;
  state.openBoxCases = Array.isArray(openCases?.cases) ? openCases.cases : state.openBoxCases;
  state.activeOpenCaseId = openCases?.activeOpenCaseId ? Number(openCases.activeOpenCaseId) : null;

  // Performance rule: update data globally, but only render the page the user
  // can actually see. Hidden Breaker/Studio galleries can contain many card
  // images and were previously rebuilt on every connector assignment.
  if (state.view === 'break') renderBreakBoard();
  if (state.view === 'breaker') renderBreakerCenter();
  if (state.view === 'riftbound-breaker') renderRiftboundBreakerCenter();
  if (state.view === 'studio') renderStudioCards();
  if (state.view === 'connector') { renderReadyChecks(); renderConnector(); }
  restoreBreakBoardScroll(scrollPosition);
}

function setImportStatus({ phase, message, importedCards = 0, cachedImages = 0, currentSet = 0, totalSets = 0 }) {
  const importing = !['complete', 'failed'].includes(phase);
  state.importing = importing;
  elements.runImport.disabled = importing;
  elements.runImport.innerHTML = importing ? '<span>◌</span> Downloading Official Cards…' : '<span>⇣</span> Download Official Cards';
  elements.importStatus.innerHTML = `<strong>${escapeHtml(message)}</strong><span>${cachedImages.toLocaleString()} official image${cachedImages === 1 ? '' : 's'} cached on this computer.</span>`;
  elements.importProgress.classList.toggle('hidden', !importing && !['complete', 'failed'].includes(phase));
  elements.importProgressLabel.textContent = message;
  elements.importProgressCount.textContent = `${importedCards.toLocaleString()} cards saved`;
  const percent = totalSets ? Math.max(4, Math.min(100, Math.round((currentSet / totalSets) * 100))) : 4;
  elements.importProgressBar.style.width = `${phase === 'complete' ? 100 : percent}%`;
  if (phase === 'complete') {
    refreshOverview();
    refreshRarityOptions();
    refreshCards();
  }
}

async function startOfficialImport() {
  if (state.importing) return;
  setImportStatus({ phase: 'discovering', message: 'Contacting the official Bandai card list…' });
  try {
    await window.breakSuite.importOfficialCards();
  } catch (error) {
    setImportStatus({ phase: 'failed', message: error.message || 'The official import could not be completed.' });
  }
}

function setRiftboundImportStatus({ phase, message, importedCards = 0, cachedImages = 0, ignoredCards = 0, missingImages = 0 }) {
  state.riftboundImporting = !['complete', 'failed', 'canceled'].includes(phase);
  elements.runRiftboundImport.disabled = state.riftboundImporting;
  elements.runOpenRiftImageRefresh.disabled = state.riftboundImporting;
  elements.runRiftboundJsonImport.disabled = state.riftboundImporting;
  elements.runRiftboundImport.innerHTML = state.riftboundImporting ? '<span>◌</span> Syncing Riftbound…' : '<span>⇣</span> Sync Cards + Images';
  elements.runOpenRiftImageRefresh.textContent = state.riftboundImporting ? 'Refreshing OpenRift Images…' : 'Refresh OpenRift Images Only';
  const ignored = ignoredCards ? ` ${ignoredCards.toLocaleString()} unsupported record${ignoredCards === 1 ? '' : 's'} ignored.` : '';
  const missing = missingImages ? ` ${missingImages.toLocaleString()} unmatched image${missingImages === 1 ? '' : 's'} use a clean placeholder.` : '';
  elements.riftboundImportStatus.innerHTML = `<strong>${escapeHtml(message)}</strong><span>${importedCards.toLocaleString()} cards checked · ${cachedImages.toLocaleString()} exact OpenRift images cached.${escapeHtml(ignored + missing)}</span>`;
  if (phase === 'complete') {
    refreshCatalogSets();
    refreshOverview();
    refreshRarityOptions();
    refreshCards();
  }
}

async function startRiftboundImport() {
  if (state.riftboundImporting || state.importing) return;
  setRiftboundImportStatus({ phase: 'downloading', message: 'Contacting the official Riftbound Card Gallery…' });
  try {
    await window.breakSuite.importOfficialRiftboundCards();
  } catch (error) {
    setRiftboundImportStatus({ phase: 'failed', message: error.message || 'The Riftbound import could not be completed.' });
  }
}

async function startOpenRiftImageRefresh() {
  if (state.riftboundImporting || state.importing) return;
  setRiftboundImportStatus({ phase: 'openrift-catalog', message: 'Reading exact English card images from OpenRift…' });
  try {
    await window.breakSuite.refreshOpenRiftImages();
  } catch (error) {
    setRiftboundImportStatus({ phase: 'failed', message: error.message || 'The OpenRift image refresh could not be completed.' });
  }
}

async function startRiftboundJsonImport() {
  if (state.riftboundImporting || state.importing) return;
  setRiftboundImportStatus({ phase: 'selecting', message: 'Choose an official Riot Riftbound JSON backup…' });
  try {
    const result = await window.breakSuite.importRiftboundJson();
    if (result?.canceled) setRiftboundImportStatus({ phase: 'canceled', message: 'Riftbound JSON import canceled.' });
  } catch (error) {
    setRiftboundImportStatus({ phase: 'failed', message: error.message || 'The Riftbound JSON import could not be completed.' });
  }
}

async function refreshRiftboundApiStatus() {
  const status = await window.breakSuite.getRiftboundApiStatus();
  elements.riftboundApiState.textContent = status.configured
    ? '✓ Approved Riot API key saved securely as an optional backup'
    : 'No API key needed for Official Gallery Sync';
  return status;
}

async function repairLibrary() {
  if (state.importing) return;
  elements.repairLibrary.disabled = true;
  elements.repairStatus.textContent = 'Checking the local library and syncing missing DON!! printings…';
  try {
    const result = await window.breakSuite.repairLibrary();
    const additions = Number(result.addedOfficialCards) || 0;
    const duplicates = result.removedDuplicates
      ? ` Removed ${result.removedDuplicates.toLocaleString()} duplicate card record${result.removedDuplicates === 1 ? '' : 's'}.`
      : ' No duplicate card records found.';
    const supplements = additions
      ? ` Added ${additions.toLocaleString()} missing official product-only DON!! card${additions === 1 ? '' : 's'}.`
      : (Number(result.refreshedOfficialCards) ? ` Updated artwork for ${Number(result.refreshedOfficialCards).toLocaleString()} official product-only DON!! card${Number(result.refreshedOfficialCards) === 1 ? '' : 's'}.` : '');
    const donCards = Number(result.addedDonCards) || 0;
    const donArtwork = Number(result.cachedDonImages) || 0;
    const donSync = donCards
      ? ` Added ${donCards.toLocaleString()} missing DON!! printing${donCards === 1 ? '' : 's'} across the catalog.`
      : (Number(result.refreshedDonCards) ? ` Updated ${Number(result.refreshedDonCards).toLocaleString()} DON!! record${Number(result.refreshedDonCards) === 1 ? '' : 's'}.` : ' All available DON!! printings were already represented.');
    const artSync = donArtwork ? ` Cached ${donArtwork.toLocaleString()} DON!! image${donArtwork === 1 ? '' : 's'} locally.` : '';
    elements.repairStatus.textContent = `Repair complete.${supplements}${donSync}${artSync}${duplicates} ${result.totalCards.toLocaleString()} cards remain.`;
    await refreshRarityOptions();
    await refreshOverview();
    await refreshCards();
  } catch (error) {
    elements.repairStatus.textContent = error.message || 'The library repair could not be completed.';
  } finally {
    elements.repairLibrary.disabled = false;
  }
}

window.breakSuite.onDonCatalogSyncComplete(async result => {
  const added = Number(result.addedDonCards) || 0;
  const cached = Number(result.cachedDonImages) || 0;
  if (elements.repairStatus) {
    elements.repairStatus.textContent = added || cached
      ? `Background DON!! sync complete. Added ${added.toLocaleString()} printing${added === 1 ? '' : 's'} and cached ${cached.toLocaleString()} image${cached === 1 ? '' : 's'} locally.`
      : 'Background DON!! sync complete. All available printings were already represented.';
  }
  await refreshRarityOptions();
  await refreshOverview();
  await refreshCards();
});

async function resetLibrary(event) {
  event.preventDefault();
  if (state.importing) return;
  const confirmation = elements.resetConfirmation.value.trim();
  if (confirmation !== 'DELETE') {
    elements.resetStatus.textContent = 'Type DELETE exactly before clearing the local library.';
    elements.resetConfirmation.focus();
    return;
  }
  const button = elements.resetLibraryForm.querySelector('button');
  button.disabled = true;
  elements.resetStatus.textContent = 'Clearing the local card catalog…';
  try {
    const result = await window.breakSuite.resetLibrary(confirmation);
    elements.resetConfirmation.value = '';
    elements.search.value = '';
    elements.rarity.value = 'All';
    state.query = '';
    state.rarity = 'All';
    state.selectedId = null;
    elements.resetStatus.textContent = `${result.deletedCards.toLocaleString()} local card record${result.deletedCards === 1 ? '' : 's'} cleared. Official images were kept safely.`;
    setImportStatus({ phase: 'complete', message: 'Library cleared. Download the official catalog again when you are ready.', importedCards: 0, cachedImages: 0 });
    setView('import');
  } catch (error) {
    elements.resetStatus.textContent = error.message || 'The local library could not be cleared.';
  } finally {
    button.disabled = false;
  }
}

function renderRiftboundSpotMapControl() {
  const button = elements.toggleRiftboundSpotMap;
  if (!button) return;
  const enabled = Boolean(state.riftboundSpotMapEnabled);
  button.textContent = enabled ? 'Disable OBS Spot Map' : 'Enable OBS Spot Map';
  button.classList.toggle('active', enabled);
  button.setAttribute('aria-pressed', String(enabled));
  elements.riftboundSpotMapOverlayStatus.textContent = enabled
    ? 'Active — OBS is receiving mapped cards and the rolling display is running.'
    : 'Idle — no mapped-card data or images are being generated.';
}

async function refreshRiftboundSpotMapControl() {
  const result = await window.breakSuite.getRiftboundSpotMapStatus();
  state.riftboundSpotMapEnabled = Boolean(result.enabled);
  renderRiftboundSpotMapControl();
}

function renderStaticOverlayControl() {
  const button = elements.toggleStaticOverlay;
  if (!button) return;
  const enabled = Boolean(state.staticOverlayEnabled);
  button.textContent = enabled ? 'Disable Static OBS Board' : 'Enable Static OBS Board';
  button.classList.toggle('active', enabled);
  button.setAttribute('aria-pressed', String(enabled));
  elements.staticOverlayStatus.textContent = enabled
    ? 'Active — the steady OBS board is receiving the current unclaimed cards.'
    : 'Static board idle — no card data or images are being generated.';
}

async function refreshStaticOverlayControl() {
  const result = await window.breakSuite.getStaticOverlayStatus();
  state.staticOverlayEnabled = Boolean(result.enabled);
  renderStaticOverlayControl();
}

async function setView(view) {
  if (view !== 'library-riftbound') state.mappingLibraryTargetPosition = null;
  state.view = view;
  state.savedOnly = view === 'saved';
  if (view === 'library-onepiece' || view === 'saved') state.game = 'ONEPIECE';
  if (view === 'library-riftbound') state.game = 'RIFTBOUND';
  if (isLibraryView(view) && state.cardListGame !== state.game) {
    state.cardListGame = state.game;
    state.cardListSetCode = '';
    state.cardListCards = [];
    state.cardListUnmatched = [];
    state.cardListPriceStatus = null;
    state.cardListStatus = '';
  }
  const contentView = isLibraryView(view) ? 'library' : view;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.add('hidden'));
  document.querySelector(`#${contentView}-view`).classList.remove('hidden');
  const copy = { 'library-onepiece': ['ONE PIECE CARD CATALOG', 'Your One Piece Card Library'], 'library-riftbound': ['RIFTBOUND CARD CATALOG', 'Your Riftbound Card Library'], 'playable-market': ['RIFTBOUND PLAYABLE INTELLIGENCE', 'Playable Market'], break: ['BREAK SETUP', 'Break Board'], studio: ['VIEWER OVERLAY CUSTOMIZATION', 'Frame Studio'], breaker: ['ONE PIECE INTERNAL BREAK CONTROL', 'Breaker Center'], 'riftbound-breaker': ['RIFTBOUND INTERNAL BREAK CONTROL', 'Riftbound Breaker Center'], history: ['PRIVATE BREAK ACCOUNTING', 'Orders History'], expenses: ['PRIVATE BUSINESS ACCOUNTING', 'Business Expenses'], buyers: ['LOYALTY & GIVEAWAY PLANNING', 'Buyer Analytics'], chaser: ['PRIVATE LOYALTY TRACKER', 'Chaser Tracker'], royal: ['SAVED BUYER LOYALTY', 'Royal Chasers'], tracker: ['CASE & BOX CONTROL', 'Box Tracker'], sniper: ['ONE PIECE MARKET HUNTER', 'Card Sniper'], sales: ['LIVE PROMOTION SIGN', 'Sold Singles'], connector: ['LIVE HANDOFF', 'Connector'], notify: ['AUDIENCE ALERTS', 'Notify'], saved: ['ONE PIECE SHORTCUTS', 'One Piece Saved Cards'], import: ['OFFICIAL DATA', 'Import Manager'], settings: ['APPLICATION', 'Settings'] }[view];
  elements.kicker.textContent = copy[0];
  elements.title.textContent = copy[1];
  elements.importButton.style.visibility = (view === 'import' || view === 'sniper' || view === 'playable-market') ? 'hidden' : 'visible';
  if (isLibraryView(view)) {
    state.setCode = 'All';
    state.rarity = 'All';
    state.selectedId = null;
    elements.quickAddHint.textContent = isOnePieceLibrary()
      ? 'Double-click a One Piece card to add it to Break Board'
      : 'Double-click a Riftbound card to add it to a Riftbound Break Board';
    await refreshCatalogSets();
    await refreshRarityOptions();
    await refreshOverview();
    await refreshCards();
    renderCardListResults();
  }
  if (view === 'break' || view === 'breaker' || view === 'riftbound-breaker' || view === 'connector') refreshBreakBoard();
  if (view === 'riftbound-breaker') {
    refreshRiftboundSpotMapControl().catch(error => {
      elements.riftboundSpotMapOverlayStatus.textContent = error.message || 'OBS Spot Map status is unavailable.';
    });
    refreshStaticOverlayControl().catch(error => {
      elements.staticOverlayStatus.textContent = error.message || 'Static OBS Board status is unavailable.';
    });
  }
  if (view === 'history') refreshOrderHistory().catch(error => {
    state.orderHistorySaveStatus = error.message || 'The saved order history could not be loaded.';
    renderOrderHistory();
  });
  if (view === 'history') refreshOpenBoxCases().catch(error => {
    if (elements.historyOpenCaseHelp) elements.historyOpenCaseHelp.textContent = error.message || 'Open cases could not be loaded.';
  });
  if (view === 'expenses') refreshBusinessExpenses().catch(error => {
    state.expenseStatus = error.message || 'The expense records could not be loaded.';
    renderBusinessExpenses();
  });
  if (view === 'buyers') refreshBuyerAnalytics().catch(() => { state.buyerAnalytics = null; renderBuyerAnalytics(); });
  if (view === 'chaser') { refreshChaser().catch(e=>elements.chaserStatus.textContent=e.message); refreshRecentBuyerMentions().catch(e=>elements.chaserRecentBuyersStatus.textContent=e.message); }
  if (view === 'royal') refreshRoyal().catch(e=>elements.royalStatus.textContent=e.message);
  if (view === 'tracker') refreshBoxTrackers().catch(error => {
    state.boxTrackerStatus = error.message || 'The saved Box Tracker records could not be loaded.';
    renderBoxTrackers();
  });
  if (view === 'sales') refreshSalesSign().catch(error => { elements.salesSignStatus.textContent = error.message; });
  if (view === 'notify') refreshNotifyView().catch(error => {
    if (elements.pinConnectionStatus) {
      elements.pinConnectionStatus.textContent = error.message || 'PIN Notify could not be loaded.';
    }
  });
  if (view === 'studio') loadFrameStudio().catch(error => {
    elements.studioStatus.textContent = error.message || 'The saved overlay style could not be loaded.';
    setMappingEditorStatus(error.message || 'The saved board mapping could not be loaded.');
  });
}

let searchTimer;
elements.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = elements.search.value; refreshCards(); }, 180);
});
elements.cardListToggle?.addEventListener('click', () => {
  state.cardListOpen = !state.cardListOpen;
  state.cardListGame = state.game;
  refreshCardListSetOptions();
  renderCardListResults();
  if (state.cardListOpen) window.setTimeout(() => elements.cardListInput?.focus(), 0);
});
elements.cardListGame?.addEventListener('change', async () => {
  state.cardListGame = elements.cardListGame.value;
  state.cardListSetCode = '';
  state.cardListCards = [];
  state.cardListUnmatched = [];
  state.cardListPriceStatus = null;
  state.cardListStatus = '';
  state.cardListOpen = true;
  await setView(state.cardListGame === 'RIFTBOUND' ? 'library-riftbound' : 'library-onepiece');
  refreshCardListSetOptions();
  renderCardListResults();
});
elements.cardListSet?.addEventListener('change', () => {
  state.cardListSetCode = elements.cardListSet.value;
  state.cardListCards = [];
  state.cardListUnmatched = [];
  state.cardListPriceStatus = null;
  state.cardListStatus = '';
  renderCardListResults();
});
elements.cardListShowPrices?.addEventListener('change', () => {
  state.cardListShowPrices = elements.cardListShowPrices.checked;
  renderCardListResults();
});
elements.cardListView?.addEventListener('click', () => runCardListSearch());
elements.cardListPrice?.addEventListener('click', () => runCardListPriceRefresh());
elements.cardListClear?.addEventListener('click', clearCardListSearch);
elements.cardListInput?.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    runCardListSearch();
  }
});
elements.salesSignForm?.addEventListener('submit', async event => { event.preventDefault(); const sign = await window.breakSuite.saveSalesSign({ text: elements.salesSignText.value, board: elements.salesSignBoard.value, size: elements.salesSignSize.value }); const boardLabel = sign.board === 'riftbound' ? 'Riftbound recall board' : (sign.board === 'secondary' ? 'Secondary pirate board' : 'Primary pirate board'); elements.salesSignStatus.textContent = `✓ ${boardLabel} saved.`; elements.salesSignPreview.innerHTML = salesSignMarkup(sign); });
elements.copySalesSignOverlay?.addEventListener('click', async () => { const result = await window.breakSuite.copySalesSignOverlay(); elements.salesSignStatus.textContent = `✓ OBS link copied: ${result.url}`; });
elements.pinMessage?.addEventListener('input', updatePinCharCount);
elements.pinSettingsForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!window.breakSuite?.pin) return;
  elements.pinSettingsStatus.textContent = 'Saving PIN settings…';
  try {
    await window.breakSuite.pin.saveSettings({
      baseUrl: elements.pinBaseUrl.value,
      channelId: elements.pinChannelId.value,
      apiKey: elements.pinApiKey.value,
      autoGoLiveOnShowReady: elements.pinAutoGoLive.checked
    });
    elements.pinApiKey.value = '';
    elements.pinSettingsStatus.textContent = '✓ PIN settings saved.';
    await refreshNotifyView();
  } catch (error) {
    elements.pinSettingsStatus.textContent = error.message || 'PIN settings could not be saved.';
  }
});
elements.pinSendPing?.addEventListener('click', async () => {
  if (!window.breakSuite?.pin) return;
  const message = elements.pinMessage.value.trim();
  if (!message) {
    elements.pinResult.textContent = 'Enter a ping message first.';
    return;
  }
  elements.pinSendPing.disabled = true;
  elements.pinResult.textContent = 'Sending ping…';
  try {
    const result = await window.breakSuite.pin.sendPing(message);
    elements.pinResult.textContent = `✓ Ping ${result.status || 'queued'} · ${result.total_recipients ?? 0} recipient${Number(result.total_recipients) === 1 ? '' : 's'}.`;
  } catch (error) {
    elements.pinResult.textContent = error.message || 'Ping could not be sent.';
  } finally {
    elements.pinSendPing.disabled = false;
  }
});
elements.pinToggleLive?.addEventListener('click', async () => {
  if (!window.breakSuite?.pin) return;
  const nextLive = pinIsLive !== true;
  elements.pinToggleLive.disabled = true;
  elements.pinResult.textContent = nextLive ? 'Going live…' : 'Ending live…';
  try {
    const result = await window.breakSuite.pin.setLive(nextLive);
    pinIsLive = result?.is_live === true;
    renderPinLiveState();
    elements.pinResult.textContent = pinIsLive ? '✓ Channel marked live.' : '✓ Channel marked offline.';
  } catch (error) {
    elements.pinResult.textContent = error.message || 'Live status could not be updated.';
  } finally {
    elements.pinToggleLive.disabled = false;
  }
});
elements.rarity.addEventListener('change', async () => {
  state.rarity = elements.rarity.value;
  await refreshCards();
});
elements.set.addEventListener('change', async () => {
  state.setCode = elements.set.value;
  await refreshRarityOptions();
  await refreshCards();
});
document.querySelector('#clear-filters').addEventListener('click', async () => { elements.search.value = ''; elements.rarity.value = 'All'; state.query = ''; state.setCode = 'All'; state.rarity = 'All'; await refreshCatalogSets(); await refreshRarityOptions(); refreshCards(); });
const PLAYABLE_MARKET_URL = 'https://riftbound-playable-market.kodrockgames.chatgpt.site';
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.view === 'playable-market') {
    window.breakSuite.openExternal(PLAYABLE_MARKET_URL).catch(error => {
      console.error('Could not open the standalone Playable Market.', error);
    });
    return;
  }
  setView(button.dataset.view);
}));
elements.historyTabs.forEach(button => button.addEventListener('click', () => setHistoryTab(button.dataset.historyTab)));
elements.savePullHistory?.addEventListener('click', () => saveSelectedPullsToHistory(elements.savePullHistory, renderBreakerCenter));
elements.saveRiftboundPullHistory?.addEventListener('click', () => saveSelectedPullsToHistory(elements.saveRiftboundPullHistory, renderRiftboundBreakerCenter));
elements.finishLiveRound?.addEventListener('click', async () => {
  const count = Number(state.connector?.activeAssignments || 0);
  if (!count) return;
  if (!window.confirm(`Finish this live box and move its ${count} confirmed assignment${count === 1 ? '' : 's'} to Pending Review? The connector will have no live board until you save another board.`)) return;
  elements.finishLiveRound.disabled = true;
  try {
    const result = await window.breakSuite.finishLiveBreakRoundForReview();
    state.pendingRoundStatus.set(Number(result.id), `✓ ${result.displayName} is safely held for final review.`);
    await refreshBreakBoard();
  } catch (error) {
    elements.riftboundPullHistorySaveStatus.textContent = error.message || 'The live box could not be moved to review.';
    await refreshBreakBoard();
  }
});
elements.copyRiftboundSpotMapOverlay?.addEventListener('click', async () => {
  try {
    const result = await window.breakSuite.copyRiftboundSpotMapOverlay();
    elements.riftboundSpotMapOverlayStatus.textContent = `✓ Separate OBS link copied: ${result.url}`;
  } catch (error) {
    elements.riftboundSpotMapOverlayStatus.textContent = error.message || 'The separate OBS link could not be copied.';
  }
});
elements.toggleRiftboundSpotMap?.addEventListener('click', async () => {
  const button = elements.toggleRiftboundSpotMap;
  button.disabled = true;
  try {
    const result = await window.breakSuite.setRiftboundSpotMapEnabled(!state.riftboundSpotMapEnabled);
    state.riftboundSpotMapEnabled = Boolean(result.enabled);
    renderRiftboundSpotMapControl();
  } catch (error) {
    elements.riftboundSpotMapOverlayStatus.textContent = error.message || 'The OBS Spot Map state could not be changed.';
  } finally {
    button.disabled = false;
  }
});
elements.copyStaticOverlay?.addEventListener('click', async () => {
  try {
    const result = await window.breakSuite.copyStaticOverlay();
    elements.staticOverlayStatus.textContent = `✓ Static OBS link copied: ${result.url}`;
  } catch (error) {
    elements.staticOverlayStatus.textContent = error.message || 'The static OBS link could not be copied.';
  }
});
elements.toggleStaticOverlay?.addEventListener('click', async () => {
  const button = elements.toggleStaticOverlay;
  button.disabled = true;
  try {
    const result = await window.breakSuite.setStaticOverlayEnabled(!state.staticOverlayEnabled);
    state.staticOverlayEnabled = Boolean(result.enabled);
    renderStaticOverlayControl();
  } catch (error) {
    elements.staticOverlayStatus.textContent = error.message || 'The Static OBS Board state could not be changed.';
  } finally {
    button.disabled = false;
  }
});
elements.importButton.addEventListener('click', () => setView('import'));
elements.buyerTrackerCase?.addEventListener('change', () => {
  state.breakerTrackerDestination = { trackerId: Number(elements.buyerTrackerCase.value) || null, boxNumber: null };
  renderBreakerCenter();
});
elements.buyerTrackerBox?.addEventListener('change', () => {
  state.breakerTrackerDestination = { ...(state.breakerTrackerDestination || {}), boxNumber: Number(elements.buyerTrackerBox.value) || null };
  renderBreakerCenter();
});
document.querySelectorAll('input[name="history-tracker-destination-mode"]').forEach(input => input.addEventListener('change', syncHistoryTrackerDestination));
elements.historySaveForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const trackerDestinationMode = document.querySelector('input[name="history-tracker-destination-mode"]:checked')?.value || 'AUTO';
  const openCaseId = Number(elements.historyOpenCaseSelect?.value || 0);
  if (trackerDestinationMode === 'OPEN_CASE' && !state.openBoxCases.some(tracker => Number(tracker.id) === openCaseId)) {
    state.orderHistorySaveStatus = 'Choose the current open case before saving this break.';
    renderOrderHistory();
    syncHistoryTrackerDestination();
    return;
  }
  const button = elements.historySaveForm.querySelector('button[type="submit"]');
  button.disabled = true;
  state.orderHistorySaveStatus = 'Saving the confirmed spots, saved Pull History cards, and Whatnot fee calculation…';
  renderOrderHistory();
  try {
    const result = await window.breakSuite.saveCurrentBreakToHistory({
      breakName: elements.historyBreakName.value,
      boxCost: elements.historyBoxCost.value,
      whatnotCommissionRate: elements.historyWhatnotCommission.value,
      whatnotProcessingRate: elements.historyWhatnotProcessing.value,
      whatnotTransactionFee: elements.historyWhatnotTransactionFee.value,
      whatnotTransactionCount: elements.historyWhatnotTransactionCount.value,
      whatnotFeeTaxRate: elements.historyWhatnotFeeTax.value,
      whatnotAdditionalFees: elements.historyWhatnotAdditionalFees.value,
      whatnotActualFees: elements.historyWhatnotActualFees.value,
      notes: elements.historyNotes.value,
      trackerDestinationMode,
      openCaseId,
      trackerRecordType: document.querySelector('input[name="history-tracker-record-type"]:checked')?.value || ''
    });
    elements.historyBreakName.value = '';
    elements.historyBoxCost.value = '';
    elements.historyWhatnotTransactionCount.value = '';
    elements.historyWhatnotAdditionalFees.value = '';
    elements.historyWhatnotActualFees.value = '';
    elements.historyNotes.value = '';
    state.orderHistorySaveStatus = result.tracker?.routeMode === 'OPEN_CASE'
      ? `✓ Saved “${result.breakName}” into ${result.tracker.caseName} · Box ${String(Number(result.tracker.boxNumber || 0)).padStart(2, '0')}. ${Number(result.tracker.remainingBoxes || 0)} box${Number(result.tracker.remainingBoxes || 0) === 1 ? '' : 'es'} remain open. Estimated net: ${formatSignedCurrency(result.whatnotFees?.netProfitCents || 0)}.`
      : `✓ Saved “${result.breakName}” as a ${result.tracker?.recordType === 'CASE' ? 'Case' : 'Box'}. ${Number(result.tracker?.trackedHitCount || 0).toLocaleString()} qualifying hit${Number(result.tracker?.trackedHitCount || 0) === 1 ? '' : 's'} transferred automatically to ${result.tracker?.setName || 'Box Tracker'}. Estimated net: ${formatSignedCurrency(result.whatnotFees?.netProfitCents || 0)}.`;
    await Promise.all([refreshOrderHistory(), refreshBoxTrackers()]);
  } catch (error) {
    state.orderHistorySaveStatus = error.message || 'This sold box could not be saved.';
    renderOrderHistory();
  } finally {
    button.disabled = false;
  }
});
elements.historyRecords?.addEventListener('submit', async event => {
  const form = event.target.closest('[data-history-edit-form]');
  if (!form) return;
  event.preventDefault();
  const id = Number(form.dataset.historyEditForm);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  state.orderHistorySaveStatus = 'Saving the corrections to this saved box…';
  renderOrderHistory();
  try {
    const values = new FormData(form);
    const result = await window.breakSuite.updateOrderHistory({
      id,
      breakName: values.get('breakName'),
      finalSales: values.get('finalSales'),
      boxCost: values.get('boxCost'),
      whatnotCommissionRate: values.get('whatnotCommissionRate'),
      whatnotProcessingRate: values.get('whatnotProcessingRate'),
      whatnotTransactionFee: values.get('whatnotTransactionFee'),
      whatnotTransactionCount: values.get('whatnotTransactionCount'),
      whatnotFeeTaxRate: values.get('whatnotFeeTaxRate'),
      whatnotAdditionalFees: values.get('whatnotAdditionalFees'),
      whatnotActualFees: values.get('whatnotActualFees'),
      notes: values.get('notes')
    });
    state.orderHistorySaveStatus = `✓ Recalculated “${result.breakName}”. Final sales: ${formatExactCurrency(result.grossSalesCents)} · Whatnot fees: ${formatExactCurrency(result.whatnotFees?.totalWhatnotFeeCents || 0)} · Net profit: ${formatSignedCurrency(result.whatnotFees?.netProfitCents || 0)}. Its buyer, spot, and pull snapshots were kept exactly as saved.`;
    await refreshOrderHistory();
  } catch (error) {
    state.orderHistorySaveStatus = error.message || 'The saved box could not be updated.';
    renderOrderHistory();
  } finally {
    const refreshedButton = elements.historyRecords.querySelector(`[data-history-edit-form="${id}"] button[type="submit"]`);
    if (refreshedButton) refreshedButton.disabled = false;
  }
});
elements.historyRecords?.addEventListener('change', event => {
  if (event.target.name !== 'trackerDestination') return;
  const form = event.target.closest('[data-history-tracker-form]');
  if (!form) return;
  const picker = form.querySelector('[name="openCaseId"]');
  picker.disabled = event.target.value !== 'OPEN_CASE';
  picker.required = event.target.value === 'OPEN_CASE';
  form.querySelector('[data-tracker-destination-help]').textContent = picker.disabled
    ? 'This will update the linked Box Tracker record.'
    : 'Choose the named open case that should receive this box.';
});
elements.historyRecords?.addEventListener('submit', async event => {
  const form = event.target.closest('[data-history-tracker-form]');
  if (!form) return;
  event.preventDefault();
  const id = Number(form.dataset.historyTrackerForm);
  const values = new FormData(form);
  const destination = String(values.get('trackerDestination') || '');
  const openCaseId = Number(values.get('openCaseId') || 0);
  if (destination === 'OPEN_CASE' && !openCaseId) {
    state.orderHistorySaveStatus = 'Choose the name of an open case before updating this Order.';
    elements.historySaveStatus.textContent = state.orderHistorySaveStatus;
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  state.orderHistorySaveStatus = 'Updating this saved Order’s Box Tracker destination…';
  elements.historySaveStatus.textContent = state.orderHistorySaveStatus;
  try {
    const result = await window.breakSuite.changeOrderTrackerDestination({ id, destination, openCaseId });
    const record = state.orderHistory.find(item => Number(item.id) === id);
    state.orderHistorySaveStatus = result.unchanged
      ? `✓ “${record?.break_name || 'This Order'}” is already saved in that tracker destination.`
      : result.destination === 'OPEN_CASE'
        ? `✓ Moved “${record?.break_name || 'This Order'}” into “${result.caseName}” as Box ${String(Number(result.boxNumber)).padStart(2, '0')}. Saved buyers, sales, and pulls were kept.`
        : `✓ Updated “${record?.break_name || 'This Order'}” as a standalone ${result.destination === 'CASE' ? 'Case' : 'Box'}. Saved buyers, sales, and pulls were kept.`;
    await refreshOpenBoxCases();
    await refreshOrderHistory();
    await refreshBoxTrackers();
  } catch (error) {
    state.orderHistorySaveStatus = error.message || 'The Box Tracker destination could not be updated.';
    elements.historySaveStatus.textContent = state.orderHistorySaveStatus;
    button.disabled = false;
  }
});
elements.historyRecords?.addEventListener('click', async event => {
  const loadMore = event.target.closest('[data-history-load-more="orders"]');
  if (loadMore) {
    loadMore.disabled = true;
    state.orderHistoryVisibleCount += HISTORY_PAGE_SIZE;
    await refreshOrderHistory().catch(error => {
      state.orderHistorySaveStatus = error.message || 'Older Orders History records could not be loaded.';
      renderOrderHistory();
    });
    return;
  }
  const preview = event.target.closest('[data-history-card-preview]');
  if (preview) {
    showHistoryCardPreview(preview.dataset.historyCardPreview, preview.dataset.historyCardName);
    return;
  }
  const button = event.target.closest('[data-history-delete]');
  if (!button) return;
  const id = Number(button.dataset.historyDelete);
  const record = state.orderHistory.find(item => Number(item.id) === id);
  const name = record?.break_name || 'this saved box';
  if (!window.confirm(`Delete “${name}” from Orders History? This deletes the stored snapshot and clears only its linked Box Tracker position. It will not change the live board, connector, assignments, or other case boxes.`)) return;
  button.disabled = true;
  state.orderHistorySaveStatus = 'Deleting the saved box record…';
  renderOrderHistory();
  try {
    await window.breakSuite.deleteOrderHistory(id);
    state.orderHistorySaveStatus = `✓ Deleted “${name}” and cleared only its linked tracker position. The live break stayed unchanged.`;
    await Promise.all([refreshOrderHistory(), refreshOpenBoxCases()]);
  } catch (error) {
    state.orderHistorySaveStatus = error.message || 'The saved box could not be deleted.';
    renderOrderHistory();
  }
});
elements.expenseSaveForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = elements.expenseSaveForm.querySelector('button[type="submit"]');
  button.disabled = true;
  state.expenseStatus = 'Saving this business expense…';
  renderBusinessExpenses();
  try {
    const result = await window.breakSuite.saveBusinessExpense({ expenseName: elements.expenseName.value, amount: elements.expenseAmount.value, category: elements.expenseCategory.value, vendor: elements.expenseVendor.value, purchasedOn: elements.expenseDate.value, notes: elements.expenseNotes.value });
    elements.expenseName.value = ''; elements.expenseAmount.value = ''; elements.expenseVendor.value = ''; elements.expenseNotes.value = '';
    state.expenseStatus = `✓ Saved “${result.expenseName}” as a private business expense.`;
    await refreshBusinessExpenses();
  } catch (error) { state.expenseStatus = error.message || 'The expense could not be saved.'; renderBusinessExpenses(); }
  finally { button.disabled = false; }
});
elements.expenseRecords?.addEventListener('click', async event => {
  const button = event.target.closest('[data-expense-delete]');
  if (!button) return;
  const id = Number(button.dataset.expenseDelete);
  const expense = state.businessExpenses.find(item => Number(item.id) === id);
  if (!window.confirm(`Delete “${expense?.expense_name || 'this expense'}”? This will not change Orders History, the live board, or the connector.`)) return;
  button.disabled = true;
  try { const result = await window.breakSuite.deleteBusinessExpense(id); state.expenseStatus = `✓ Deleted “${result.expenseName}”.`; await refreshBusinessExpenses(); }
  catch (error) { state.expenseStatus = error.message || 'The expense could not be deleted.'; renderBusinessExpenses(); }
});
elements.businessExpenseYear?.addEventListener('change', async () => {
  const year = Number(elements.businessExpenseYear.value);
  if (!year) return;
  state.businessExpenseYear = year;
  state.expenseStatus = `Loading ${year} business snapshot…`;
  renderBusinessExpenses();
  try { await refreshBusinessExpenses(); }
  catch (error) { state.expenseStatus = error.message || 'The business snapshot could not be recalculated.'; renderBusinessExpenses(); }
});
elements.businessSnapshotRefresh?.addEventListener('click', async () => {
  elements.businessSnapshotRefresh.disabled = true;
  state.expenseStatus = `Reconciling Orders accounting totals, then recalculating ${state.businessExpenseYear}…`;
  renderBusinessExpenses();
  try {
    const businessAudit = await window.breakSuite.reconcileBusinessPurchases();
    await refreshBusinessExpenses();
    const issueCount = Number(businessAudit?.issueCount || 0);
    state.expenseStatus = issueCount
      ? `✓ Accounting purchases reconciled and ${state.businessExpenseYear} recalculated. ${issueCount} accounting item${issueCount === 1 ? '' : 's'} still need review.`
      : `✓ All archived accounting purchases reconciled and ${state.businessExpenseYear} snapshot recalculated.`;
    renderBusinessExpenses();
  } catch (error) { state.expenseStatus = error.message || 'The business snapshot could not be verified and recalculated.'; renderBusinessExpenses(); }
  finally { elements.businessSnapshotRefresh.disabled = false; }
});
elements.businessExpensePrint?.addEventListener('click', async () => {
  elements.businessExpensePrint.disabled = true;
  state.expenseStatus = `Preparing the complete ${state.businessExpenseYear} expense and break report…`;
  renderBusinessExpenses();
  try {
    await refreshBusinessExpenses();
    if (!state.businessExpenseReport || !elements.businessPrintReport?.innerHTML) {
      throw new Error('The printable business report could not be prepared.');
    }
    document.body.classList.add('printing-business-report');
    elements.businessPrintReport.setAttribute('aria-hidden', 'false');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.print();
    state.expenseStatus = `✓ Opened the ${state.businessExpenseYear} report in the printer window.`;
  } catch (error) {
    state.expenseStatus = error.message || 'The business report could not be printed.';
  } finally {
    document.body.classList.remove('printing-business-report');
    elements.businessPrintReport?.setAttribute('aria-hidden', 'true');
    elements.businessExpensePrint.disabled = false;
    renderBusinessExpenses();
  }
});

async function prepareBusinessReportForExport() {
  await refreshBusinessExpenses();
  if (!state.businessExpenseReport || !elements.businessPrintReport?.innerHTML) {
    throw new Error('The business report could not be prepared.');
  }
  document.body.classList.add('printing-business-report');
  elements.businessPrintReport.setAttribute('aria-hidden', 'false');
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function finishBusinessReportExport() {
  document.body.classList.remove('printing-business-report');
  elements.businessPrintReport?.setAttribute('aria-hidden', 'true');
}

elements.businessExpensePdf?.addEventListener('click', async () => {
  elements.businessExpensePdf.disabled = true;
  state.expenseStatus = `Creating the ${state.businessExpenseYear} PDF file…`;
  renderBusinessExpenses();
  try {
    await prepareBusinessReportForExport();
    const result = await window.breakSuite.downloadBusinessExpensePdf(state.businessExpenseYear);
    state.expenseStatus = result.canceled
      ? 'PDF download canceled. Nothing was printed or changed.'
      : `✓ PDF saved to ${result.filePath}`;
  } catch (error) {
    state.expenseStatus = error.message || 'The PDF file could not be saved.';
  } finally {
    finishBusinessReportExport();
    elements.businessExpensePdf.disabled = false;
    renderBusinessExpenses();
  }
});

elements.businessExpenseExcel?.addEventListener('click', async () => {
  elements.businessExpenseExcel.disabled = true;
  state.expenseStatus = `Creating the ${state.businessExpenseYear} Excel CSV file…`;
  renderBusinessExpenses();
  try {
    await refreshBusinessExpenses();
    const result = await window.breakSuite.downloadBusinessExpenseCsv(state.businessExpenseYear);
    state.expenseStatus = result.canceled
      ? 'Excel CSV download canceled. Nothing was changed.'
      : `✓ Excel CSV saved to ${result.filePath}`;
  } catch (error) {
    state.expenseStatus = error.message || 'The Excel CSV file could not be saved.';
  } finally {
    elements.businessExpenseExcel.disabled = false;
    renderBusinessExpenses();
  }
});

elements.chaserForm?.addEventListener('submit',async e=>{e.preventDefault();try{await window.breakSuite.saveChaserTracker({threshold:elements.chaserThreshold.value,slotCount:elements.chaserSlots.value});elements.chaserStatus.textContent='✓ Live Chasers updated.';await refreshChaser();}catch(error){elements.chaserStatus.textContent=error.message;}});
elements.chaserRefresh?.addEventListener('click',async()=>{await window.breakSuite.refreshChaserTracker();await refreshChaser();});
elements.chaserCopy?.addEventListener('click',async()=>{const r=await window.breakSuite.copyChaserOverlay();elements.chaserStatus.textContent=`✓ OBS link copied: ${r.url}`;});
elements.chaserReset?.addEventListener('click',async()=>{if(window.confirm('Reset every Live Chasers spot?')){await window.breakSuite.resetChaserTracker();await refreshChaser();}});
elements.chaserCopyNames?.addEventListener('click',async()=>{const r=await window.breakSuite.copyChaserNames();elements.chaserStatus.textContent=`✓ Copied ${r.copied} Live Chaser name${r.copied===1?'':'s'}.`;});
elements.chaserRecentBuyersRefresh?.addEventListener('click',()=>refreshRecentBuyerMentions().catch(e=>elements.chaserRecentBuyersStatus.textContent=e.message));
elements.royalForm?.addEventListener('submit',async e=>{e.preventDefault();try{await window.breakSuite.saveRoyalChaserTracker({threshold:elements.royalThreshold.value,slotCount:elements.royalSlots.value});elements.royalStatus.textContent='✓ Royal Chasers saved.';await refreshRoyal();}catch(error){elements.royalStatus.textContent=error.message;}});
elements.royalRefresh?.addEventListener('click',async()=>{await refreshRoyal();});
elements.royalCopy?.addEventListener('click',async()=>{const r=await window.breakSuite.copyRoyalChaserOverlay();elements.royalStatus.textContent=`✓ OBS link copied: ${r.url}`;});
elements.royalReset?.addEventListener('click',async()=>{if(window.confirm('Reset every Royal Chasers spot?')){await window.breakSuite.resetRoyalChaserTracker();await refreshRoyal();}});
elements.royalCopyNames?.addEventListener('click',async()=>{const r=await window.breakSuite.copyRoyalChaserNames();elements.royalStatus.textContent=`✓ Copied ${r.copied} Royal Chaser name${r.copied===1?'':'s'}.`;});
elements.trackerTabs.forEach(button => button.addEventListener('click', () => {
  state.boxTrackerTab = button.dataset.trackerTab === 'saved' ? 'saved' : 'live';
  state.selectedTrackerBoxNumber = null;
  state.editingBoxTrackerId = null;
  state.editingOpenCaseDetails = false;
  state.boxTrackerStatus = '';
  renderBoxTrackers();
}));
elements.openCaseGame?.addEventListener('change', () => renderOpenCaseSetOptions({ resetBoxes: true }));
elements.openCaseSet?.addEventListener('change', () => {
  const selected = (state.catalogSets || []).find(set => String(set.game_code || '').toUpperCase() === String(elements.openCaseGame.value || '').toUpperCase() && set.set_code === elements.openCaseSet.value);
  if (selected && elements.openCaseBoxes) elements.openCaseBoxes.value = String(Number(selected.box_count || 12));
});
elements.openCaseForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = elements.createOpenCase;
  const selectedSet = (state.catalogSets || []).find(set => String(set.game_code || '').toUpperCase() === String(elements.openCaseGame.value || '').toUpperCase() && set.set_code === elements.openCaseSet.value);
  button.disabled = true;
  state.boxTrackerStatus = 'Creating the open case and its empty box positions…';
  renderBoxTrackers();
  try {
    const result = await window.breakSuite.createOpenBoxCase({
      caseName: elements.openCaseName.value,
      gameCode: elements.openCaseGame.value,
      setCode: elements.openCaseSet.value,
      setName: selectedSet?.set_name || '',
      productName: selectedSet?.product_name || '',
      totalBoxes: elements.openCaseBoxes.value
    });
    state.boxTrackerTab = 'live';
    state.editingBoxTrackerId = Number(result.id);
    state.selectedTrackerBoxNumber = Number(result.boxes?.[0]?.box_number || 1);
    state.boxTrackerStatus = `✓ “${result.tracker_name}” is open with ${Number(result.total_boxes || 0)} box positions. Choose Current Open Case when you archive each Buyer Bag.`;
    elements.openCaseName.value = '';
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The open case could not be created.';
    renderBoxTrackers();
  } finally {
    const refreshed = document.querySelector('#create-open-case');
    if (refreshed) refreshed.disabled = false;
  }
});
elements.editOpenCase?.addEventListener('click', () => {
  const tracker = activeBoxTracker();
  if (!tracker || !trackerIsOpenCase(tracker)) return;
  state.editingOpenCaseDetails = true;
  elements.openCaseEditForm.dataset.trackerId = String(tracker.id);
  elements.editOpenCaseName.value = tracker.tracker_name || '';
  elements.editOpenCaseBoxes.value = String(Number(tracker.total_boxes || 1));
  state.boxTrackerStatus = 'Edit the live case name or its number of box positions. Its game and set remain protected.';
  elements.openCaseEditForm.classList.remove('hidden');
  elements.trackerStatus.textContent = state.boxTrackerStatus;
  elements.editOpenCaseName.focus();
});
elements.cancelOpenCaseEdit?.addEventListener('click', () => {
  state.editingOpenCaseDetails = false;
  elements.openCaseEditForm.classList.add('hidden');
  state.boxTrackerStatus = 'Case changes canceled.';
  elements.trackerStatus.textContent = state.boxTrackerStatus;
});
elements.openCaseEditForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const tracker = activeBoxTracker();
  if (!tracker || !trackerIsOpenCase(tracker)) return;
  const requestedTotal = Number(elements.editOpenCaseBoxes.value || 0);
  if (requestedTotal < Number(tracker.total_boxes || 0)
    && !window.confirm(`Reduce “${tracker.tracker_name}” from ${Number(tracker.total_boxes || 0)} to ${requestedTotal} box positions? Only unused boxes at the end can be removed.`)) return;
  elements.saveOpenCaseEdit.disabled = true;
  state.boxTrackerStatus = 'Saving the live case changes…';
  elements.trackerStatus.textContent = state.boxTrackerStatus;
  try {
    const result = await window.breakSuite.updateOpenBoxCase({
      openCaseId: tracker.id,
      caseName: elements.editOpenCaseName.value,
      totalBoxes: elements.editOpenCaseBoxes.value
    });
    state.editingOpenCaseDetails = false;
    state.editingBoxTrackerId = Number(result.id);
    state.boxTrackerStatus = `✓ Saved “${result.tracker_name}” with ${Number(result.total_boxes || 0)} box positions. The active-case overlay updated.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The live case changes could not be saved.';
    elements.trackerStatus.textContent = state.boxTrackerStatus;
  } finally {
    if (elements.saveOpenCaseEdit) elements.saveOpenCaseEdit.disabled = false;
  }
});
elements.deleteOpenCase?.addEventListener('click', async () => {
  const tracker = activeBoxTracker();
  if (!tracker || !trackerIsOpenCase(tracker)) return;
  const opened = Number(tracker.opened_count || 0);
  const boxWarning = opened
    ? ` It will remove ${opened} archived box${opened === 1 ? '' : 'es'} from this case view.`
    : '';
  if (!window.confirm(`Delete the entire live case “${tracker.tracker_name}”?${boxWarning} Orders History, Pull History, buyer data, and cards will remain saved, but this Box Tracker case cannot be restored.`)) return;
  elements.deleteOpenCase.disabled = true;
  state.boxTrackerStatus = 'Deleting the live case while preserving its source history…';
  renderBoxTrackers();
  try {
    const result = await window.breakSuite.deleteOpenBoxCase({ openCaseId: tracker.id });
    state.editingOpenCaseDetails = false;
    state.editingBoxTrackerId = result.activeOpenCaseId || result.activeTrackerId || null;
    state.selectedTrackerBoxNumber = null;
    state.boxTrackerStatus = `✓ Deleted “${result.caseName}”. Orders History and Pull History were kept${result.activeOpenCaseId ? ', and the Active Case overlay moved to the next open case' : '; the Active Case overlay is now blank until another case is opened'}.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The live case could not be deleted.';
    renderBoxTrackers();
  } finally {
    if (elements.deleteOpenCase) elements.deleteOpenCase.disabled = false;
  }
});
elements.finalizeOpenCase?.addEventListener('click', async () => {
  const tracker = activeBoxTracker();
  if (!tracker || !trackerIsOpenCase(tracker)) return;
  const opened = Number(tracker.opened_count || 0);
  const total = Number(tracker.total_boxes || 0);
  const remaining = Math.max(0, total - opened);
  const warning = remaining ? ` ${remaining} box position${remaining === 1 ? ' is' : 's are'} still unused.` : '';
  if (!window.confirm(`Finalize “${tracker.tracker_name}” with ${opened} of ${total} boxes archived?${warning} It will move to Saved Records and stop accepting new boxes.`)) return;
  elements.finalizeOpenCase.disabled = true;
  state.boxTrackerStatus = 'Finalizing this case…';
  renderBoxTrackers();
  elements.finalizeOpenCase.disabled = true;
  try {
    const result = await window.breakSuite.finalizeOpenBoxCase({ openCaseId: tracker.id });
    state.boxTrackerTab = 'saved';
    state.editingBoxTrackerId = Number(result.trackerId);
    state.selectedTrackerBoxNumber = null;
    state.boxTrackerStatus = `✓ Finalized “${result.caseName}” with ${Number(result.openedBoxes || 0)} archived box${Number(result.openedBoxes || 0) === 1 ? '' : 'es'}. It is now in Saved Records.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The case could not be finalized.';
    renderBoxTrackers();
  }
});
elements.trackerSelect?.addEventListener('change', async () => {
  const id = Number(elements.trackerSelect.value);
  if (!id) return;
  elements.trackerSelect.disabled = true;
  state.boxTrackerStatus = 'Switching the viewer tracker record…';
  renderBoxTrackers();
  try {
    await window.breakSuite.setActiveBoxTracker(id);
    state.editingBoxTrackerId = id;
    state.editingOpenCaseDetails = false;
    state.creatingBoxTracker = false;
    state.selectedTrackerBoxNumber = null;
    state.boxTrackerStatus = state.boxTrackerTab === 'live'
      ? '✓ This is now the active live case for its status overlay and cumulative totals.'
      : '✓ This saved record is now shown in the totals OBS overlay.';
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The selected tracker record could not be loaded.';
    renderBoxTrackers();
  } finally {
    elements.trackerSelect.disabled = !trackerListForCurrentTab().length;
  }
});
elements.newTracker?.addEventListener('click', () => {
  state.creatingBoxTracker = true;
  state.selectedTrackerBoxNumber = null;
  state.boxTrackerStatus = 'Enter the new case details, then create the tracker. Your existing trackers stay saved.';
  renderBoxTrackers();
  elements.trackerName.focus();
});
elements.trackerSettingsForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const tracker = activeBoxTracker();
  const payload = {
    trackerName: elements.trackerName.value,
    overlayTitle: elements.trackerOverlayTitle.value,
    productName: elements.trackerProduct.value,
    totalBoxes: elements.trackerTotalBoxes.value
  };
  const requestedTotal = Number(payload.totalBoxes || 12);
  if (tracker && requestedTotal < Number(tracker.total_boxes) && !window.confirm(`Reduce this case from ${tracker.total_boxes} boxes to ${requestedTotal}? Any removed box numbers and their statuses will be removed from this tracker.`)) return;
  const button = elements.trackerSettingsButton;
  button.disabled = true;
  state.boxTrackerStatus = tracker ? 'Saving case details…' : 'Creating the case tracker…';
  renderBoxTrackers();
  try {
    const result = tracker
      ? await window.breakSuite.updateBoxTracker({ trackerId: tracker.id, ...payload })
      : await window.breakSuite.createBoxTracker(payload);
    state.editingBoxTrackerId = Number(result.id);
    state.creatingBoxTracker = false;
    state.selectedTrackerBoxNumber = null;
    state.boxTrackerStatus = `✓ ${tracker ? 'Saved' : 'Created'} “${result.tracker_name}”. The viewer overlay is ready to follow it.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The case tracker could not be saved.';
    renderBoxTrackers();
  } finally {
    elements.trackerSettingsButton.disabled = false;
  }
});
elements.saveTrackerOverlayTitle?.addEventListener('click', async () => {
  const tracker = activeBoxTracker();
  if (!tracker) return;
  const button = elements.saveTrackerOverlayTitle;
  button.disabled = true;
  state.boxTrackerStatus = 'Saving the overlay title…';
  renderBoxTrackers();
  try {
    const result = await window.breakSuite.updateBoxTracker({ trackerId: tracker.id, overlayTitle: elements.trackerOverlayTitle.value });
    state.boxTrackerStatus = `✓ Overlay title saved as “${result.overlay_title}”.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The overlay title could not be saved.';
    renderBoxTrackers();
  } finally {
    const refreshedButton = document.querySelector('#save-tracker-overlay-title');
    if (refreshedButton) refreshedButton.disabled = false;
  }
});
elements.saveTrackerCaseRecord?.addEventListener('click', async () => {
  const tracker = activeBoxTracker();
  if (!tracker) return;
  if (!window.confirm(`Save the current totals for “${tracker.tracker_name}” as a completed case record? This does not reset or change the live case.`)) return;
  const button = elements.saveTrackerCaseRecord;
  button.disabled = true;
  state.boxTrackerStatus = 'Saving the completed case record…';
  renderBoxTrackers();
  try {
    const result = await window.breakSuite.saveBoxTrackerCaseRecord({ trackerId: tracker.id });
    state.boxTrackerStatus = `✓ Saved “${result.caseTitle}” in Case Hit Records.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The completed case record could not be saved.';
    renderBoxTrackers();
  } finally {
    const refreshedButton = document.querySelector('#save-tracker-case-record');
    if (refreshedButton) refreshedButton.disabled = false;
  }
});
elements.deleteTracker?.addEventListener('click', async () => {
  const tracker = activeBoxTracker();
  if (!tracker) return;
  if (!window.confirm(`Delete the case tracker “${tracker.tracker_name}”? This removes its box statuses and notes only. It will not change any saved box history, buyers, cards, or live board.`)) return;
  elements.deleteTracker.disabled = true;
  state.boxTrackerStatus = 'Deleting the case tracker…';
  renderBoxTrackers();
  try {
    await window.breakSuite.deleteBoxTracker(tracker.id);
    state.editingBoxTrackerId = null;
    state.creatingBoxTracker = false;
    state.boxTrackerStatus = `✓ Deleted “${tracker.tracker_name}”.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The case tracker could not be deleted.';
    renderBoxTrackers();
  }
});
elements.trackerBoxGrid?.addEventListener('click', async event => {
  const pullHistoryButton = event.target.closest('[data-open-case-box-pulls]');
  if (pullHistoryButton) {
    const trackerId = Number(pullHistoryButton.dataset.trackerId);
    const boxNumber = Number(pullHistoryButton.dataset.openCaseBoxPulls);
    const tracker = state.boxTrackers.find(item => Number(item.id) === trackerId);
    const box = (tracker?.boxes || []).find(item => Number(item.box_number) === boxNumber);
    const batchId = Number(box?.history_link?.pull_history_batch_id || 0);
    if (!batchId) {
      state.boxTrackerStatus = `Box ${String(boxNumber).padStart(2, '0')} does not have a linked Pull History record to edit.`;
      renderBoxTrackers();
      return;
    }
    pullHistoryButton.disabled = true;
    state.focusedPullHistoryBatchId = batchId;
    state.pullHistoryVisibleCount = Math.max(state.pullHistoryVisibleCount, 250);
    setHistoryTab('pulls');
    await setView('history');
    await refreshOrderHistory();
    const target = document.querySelector(`[data-pull-history-batch-record="${batchId}"]`);
    if (target) {
      target.open = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      state.historyPullStatus = 'The linked Pull History record could not be displayed. The box remains safely stored in the live case.';
      renderPullHistory();
    }
    return;
  }
  const removeBoxButton = event.target.closest('[data-remove-open-case-box]');
  if (removeBoxButton) {
    const trackerId = Number(removeBoxButton.dataset.trackerId);
    const boxNumber = Number(removeBoxButton.dataset.removeOpenCaseBox);
    const tracker = state.boxTrackers.find(item => Number(item.id) === trackerId);
    const box = (tracker?.boxes || []).find(item => Number(item.box_number) === boxNumber);
    if (!tracker || !box?.history_link) return;
    const breakName = box.history_link.break_name || `Order History #${Number(box.history_link.history_id)}`;
    if (!window.confirm(`Remove Box ${String(boxNumber).padStart(2, '0')} (“${breakName}”) from “${tracker.tracker_name}”? The Orders History and Pull History records will stay saved. This box position will become available again.`)) return;
    removeBoxButton.disabled = true;
    state.boxTrackerStatus = `Removing Box ${String(boxNumber).padStart(2, '0')} from this live case…`;
    renderBoxTrackers();
    try {
      const result = await window.breakSuite.removeOpenBoxCaseBox({ openCaseId: trackerId, boxNumber });
      state.editingBoxTrackerId = trackerId;
      state.selectedTrackerBoxNumber = boxNumber;
      state.boxTrackerStatus = `✓ Removed Box ${String(boxNumber).padStart(2, '0')} from “${result.caseName}”. Its Orders History and Pull History records were kept, and this position is available again.`;
      await refreshBoxTrackers();
    } catch (error) {
      state.boxTrackerStatus = error.message || 'The box could not be removed from this live case.';
      renderBoxTrackers();
    }
    return;
  }
  const recordButton = event.target.closest('[data-box-hit-record]');
  if (recordButton) {
    state.selectedTrackerBoxNumber = Number(recordButton.dataset.boxNumber);
    state.editingBoxTrackerId = Number(recordButton.dataset.trackerId);
    state.creatingBoxTracker = false;
    const tracker = activeBoxTracker();
    state.boxTrackerStatus = ['OPEN_CASE', 'FINALIZED_CASE', 'ORDER_HISTORY'].includes(String(tracker?.source_mode || '').toUpperCase())
      ? `Viewing the exact archived cards for Box ${String(state.selectedTrackerBoxNumber).padStart(2, '0')}.`
      : `Box ${String(state.selectedTrackerBoxNumber).padStart(2, '0')} is ready for hit entry.`;
    renderBoxTrackers();
    document.querySelector('.tracker-auto-hits')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  const button = event.target.closest('[data-box-status]');
  if (!button) return;
  const trackerId = Number(button.dataset.trackerId);
  const boxNumber = Number(button.dataset.boxNumber);
  const status = button.dataset.boxStatus;
  if (!trackerId || !boxNumber || !status) return;
  button.disabled = true;
  state.boxTrackerStatus = `Updating Box ${String(boxNumber).padStart(2, '0')}…`;
  renderBoxTrackers();
  try {
    await window.breakSuite.updateBoxTrackerBox({ trackerId, boxNumber, status });
    state.editingBoxTrackerId = trackerId;
    state.creatingBoxTracker = false;
    state.boxTrackerStatus = `✓ Box ${String(boxNumber).padStart(2, '0')} is marked ${boxStatusLabel(status)}. The viewer overlay updated.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The box status could not be updated.';
    renderBoxTrackers();
  }
});
elements.trackerHitForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const tracker = activeBoxTracker();
  const selectedBox = selectedTrackerBox(tracker);
  if (!tracker || !selectedBox) return;
  const form = new FormData(elements.trackerHitForm);
  const payload = Object.fromEntries(TRACKER_HIT_FIELDS.map(([, inputName]) => [inputName, form.get(inputName)]));
  const button = elements.saveTrackerHits;
  button.disabled = true;
  state.boxTrackerStatus = `Saving Box ${String(selectedBox.box_number).padStart(2, '0')} hits…`;
  renderBoxTrackers();
  try {
    await window.breakSuite.updateBoxTrackerBox({ trackerId: tracker.id, boxNumber: selectedBox.box_number, ...payload });
    state.boxTrackerStatus = `✓ Saved Box ${String(selectedBox.box_number).padStart(2, '0')} hits. The case totals and OBS tracker updated.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The Box hit record could not be saved.';
    renderBoxTrackers();
  } finally {
    const refreshedButton = document.querySelector('#save-tracker-hits');
    if (refreshedButton) refreshedButton.disabled = false;
  }
});
elements.trackerHitWinnerForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const tracker = activeBoxTracker();
  const selectedBox = selectedTrackerBox(tracker);
  if (!tracker || !selectedBox) return;
  const values = new FormData(elements.trackerHitWinnerForm);
  const button = elements.saveTrackerHitWinner;
  button.disabled = true;
  state.boxTrackerStatus = `Saving the card and buyer for Box ${String(selectedBox.box_number).padStart(2, '0')}…`;
  renderBoxTrackers();
  try {
    const result = await window.breakSuite.addBoxTrackerHitWinner({
      trackerId: tracker.id, boxNumber: selectedBox.box_number,
      cardName: values.get('cardName'), rarity: values.get('rarity'), buyerName: values.get('buyerName'), note: values.get('note')
    });
    elements.trackerHitWinnerForm.reset();
    state.boxTrackerStatus = `✓ Saved ${result.cardName} for @${result.buyerName} in Box ${String(selectedBox.box_number).padStart(2, '0')}. This stays private.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The card-and-buyer record could not be saved.';
    renderBoxTrackers();
  } finally {
    const refreshedButton = document.querySelector('#save-tracker-hit-winner');
    if (refreshedButton) refreshedButton.disabled = false;
  }
});
elements.trackerHitWinnerList?.addEventListener('click', async event => {
  const button = event.target.closest('[data-tracker-hit-winner-delete]');
  if (!button) return;
  const tracker = activeBoxTracker();
  const selectedBox = selectedTrackerBox(tracker);
  if (!tracker || !selectedBox || !window.confirm('Delete this private card-and-buyer record? The case hit counts will not change.')) return;
  button.disabled = true;
  try {
    const result = await window.breakSuite.deleteBoxTrackerHitWinner({ trackerId: tracker.id, boxNumber: selectedBox.box_number, id: Number(button.dataset.trackerHitWinnerDelete) });
    state.boxTrackerStatus = `✓ Deleted ${result.cardName} from Box ${String(selectedBox.box_number).padStart(2, '0')}.`;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The saved hit record could not be deleted.';
    renderBoxTrackers();
  }
});
elements.trackerCaseRecords?.addEventListener('click', async event => {
  const edit = event.target.closest('[data-tracker-case-record-edit]');
  if (edit) {
    state.editingCaseRecordId = Number(edit.dataset.trackerCaseRecordEdit);
    renderBoxTrackers();
    return;
  }
  if (event.target.closest('[data-tracker-case-record-cancel]')) {
    state.editingCaseRecordId = null;
    renderBoxTrackers();
    return;
  }
  const remove = event.target.closest('[data-tracker-case-record-delete]');
  if (!remove) return;
  const id = Number(remove.dataset.trackerCaseRecordDelete);
  const record = state.boxTrackerCaseRecords.find(item => Number(item.id) === id);
  if (!record || !window.confirm(`Delete saved case record “${record.case_title}”? This only removes the archived snapshot. Your active case, live totals, and overlay will stay exactly as they are.`)) return;
  remove.disabled = true;
  try {
    const result = await window.breakSuite.deleteBoxTrackerCaseRecord(id);
    state.boxTrackerStatus = `✓ Deleted saved record “${result.caseTitle}”. The active case was not changed.`;
    state.editingCaseRecordId = null;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The saved case record could not be deleted.';
    renderBoxTrackers();
  }
});
elements.trackerCaseRecords?.addEventListener('submit', async event => {
  const form = event.target.closest('[data-tracker-case-record-form]');
  if (!form) return;
  event.preventDefault();
  const id = Number(form.dataset.trackerCaseRecordForm);
  const values = new FormData(form);
  const payload = { id, caseTitle: values.get('caseTitle'), productName: values.get('productName'), overlayTitle: values.get('overlayTitle') };
  for (const [key] of TRACKER_HIT_FIELDS) payload[key] = values.get(key);
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const result = await window.breakSuite.updateBoxTrackerCaseRecord(payload);
    state.boxTrackerStatus = `✓ Updated saved record “${result.caseTitle}”. The active case was not changed.`;
    state.editingCaseRecordId = null;
    await refreshBoxTrackers();
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The saved case record could not be updated.';
    renderBoxTrackers();
  }
});
elements.copyTrackerOverlay?.addEventListener('click', async () => {
  try {
    const result = await window.breakSuite.copyBoxTrackerOverlayLink();
    state.boxTrackerStatus = `✓ OBS link copied: ${result.url}`;
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The OBS link could not be copied.';
  }
  renderBoxTrackers();
});
elements.openTrackerOverlay?.addEventListener('click', async () => {
  try {
    await window.breakSuite.openBoxTrackerOverlay();
    state.boxTrackerStatus = '✓ Box Tracker overlay opened in your browser. Use the same link in an OBS Browser Source.';
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The Box Tracker overlay could not be opened.';
  }
  renderBoxTrackers();
});
elements.copyActiveCaseOverlay?.addEventListener('click', async () => {
  try {
    const result = await window.breakSuite.copyActiveCaseOverlayLink();
    state.boxTrackerStatus = `✓ Active Case Status OBS link copied: ${result.url}`;
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The Active Case Status OBS link could not be copied.';
  }
  renderBoxTrackers();
});
elements.openActiveCaseOverlay?.addEventListener('click', async () => {
  try {
    await window.breakSuite.openActiveCaseOverlay();
    state.boxTrackerStatus = '✓ Active Case Status opened in your browser. It follows only the current open case.';
  } catch (error) {
    state.boxTrackerStatus = error.message || 'The Active Case Status overlay could not be opened.';
  }
  renderBoxTrackers();
});
elements.mappingBoardSelect?.addEventListener('change', async () => {
  const nextSlot = Number(elements.mappingBoardSelect.value);
  elements.mappingBoardSelect.disabled = true;
  await chooseMappingEditorBoard(nextSlot);
  elements.mappingBoardSelect.disabled = false;
});
elements.mappingSave?.addEventListener('click', async () => {
  if (!state.mappingEditor?.editable || !state.mappingDraftDirty) return;
  const button = elements.mappingSave;
  button.disabled = true;
  setMappingEditorStatus('Saving this board\'s exact card ownership…');
  try {
    const result = await window.breakSuite.saveBoardMapping({
      slot: state.mappingEditor.slot,
      spots: state.mappingEditor.spots.map(spot => ({
        position: Number(spot.position),
        label: String(spot.label || spot.anchorCard?.name || `Spot ${spot.position}`),
        cards: spot.cards.map(card => ({
          cardId: Number(card.id),
          additionType: Number(card.id) === Number(spot.anchorCardId) ? 'ANCHOR' : (card.additionType === 'PLUS' ? 'PLUS' : 'SEQUENCE')
        }))
      }))
    });
    state.mappingEditor = result.editor;
    state.mappingDraftDirty = false;
    state.boardPresets = await window.breakSuite.getBreakBoardPresets();
    setMappingEditorStatus(`✓ Saved ${result.mappedCards.toLocaleString()} exact cards across ${result.spots.toLocaleString()} spots in ${result.name}. Live and Pending rounds were not changed; load this board and press Save Board when you want the mapping live.`);
    renderBoardMappingEditor();
  } catch (error) {
    setMappingEditorStatus(error.message || 'The mapping could not be saved.');
    renderBoardMappingEditor();
  } finally {
    button.disabled = !state.mappingDraftDirty;
  }
});
elements.mappingReset?.addEventListener('click', async () => {
  if (!state.mappingEditor?.editable || !state.mappingEditor?.customized) return;
  if (!window.confirm(`Restore ${state.mappingEditor.name}'s original built-in mapping? Its saved custom assignment will be removed. Live and Pending Buyer Bags will stay unchanged.`)) return;
  const button = elements.mappingReset;
  button.disabled = true;
  setMappingEditorStatus('Restoring the built-in mapping…');
  try {
    const result = await window.breakSuite.resetBoardMapping(state.mappingEditor.slot);
    state.mappingEditor = result.editor;
    state.mappingDraftDirty = false;
    state.boardPresets = await window.breakSuite.getBreakBoardPresets();
    setMappingEditorStatus(`✓ Restored the built-in map for ${state.mappingEditor.name}. Live and Pending Buyer Bags were not changed.`);
    renderBoardMappingEditor();
  } catch (error) {
    setMappingEditorStatus(error.message || 'The built-in mapping could not be restored.');
    renderBoardMappingEditor();
  } finally {
    button.disabled = !state.mappingEditor?.customized;
  }
});
elements.mappingLibraryReturn?.addEventListener('click', async () => {
  state.mappingLibraryTargetPosition = null;
  await setView('studio');
});
elements.studioStyleList?.querySelectorAll('[data-frame-style]').forEach(choice => choice.addEventListener('click', () => {
  state.overlayStyle = { ...studioStyleFromControls(), frameStyle: choice.dataset.frameStyle };
  applyStudioPreview(state.overlayStyle);
  elements.studioStatus.textContent = `Previewing ${choice.querySelector('b')?.textContent || 'the selected'} frame. Save & Apply when it looks right.`;
}));
document.querySelectorAll('[data-studio-control]').forEach(control => control.addEventListener('input', () => {
  state.overlayStyle = studioStyleFromControls();
  applyStudioPreview(state.overlayStyle);
  elements.studioStatus.textContent = 'Preview updated. Save & Apply sends this exact style to the public overlay.';
}));
elements.studioSave?.addEventListener('click', async () => {
  const button = elements.studioSave;
  button.disabled = true;
  elements.studioStatus.textContent = 'Saving the public overlay style…';
  try {
    state.overlayStyle = normalizeStudioStyle(await window.breakSuite.saveOverlayStyle(studioStyleFromControls()));
    renderFrameStudio();
    elements.studioStatus.textContent = '✓ Frame style saved. The OBS Browser Source updates automatically within a second.';
  } catch (error) {
    elements.studioStatus.textContent = error.message || 'The frame style could not be saved.';
  } finally {
    button.disabled = false;
  }
});
document.querySelector('#copy-card-reveal-link')?.addEventListener('click', async () => {
  const url = 'http://127.0.0.1:8878/popup.html?v=368';
  await navigator.clipboard.writeText(url);
  elements.studioStatus.textContent = `✓ Camera-front Card Reveal link copied: ${url}`;
});
elements.studioReset?.addEventListener('click', async () => {
  const button = elements.studioReset;
  button.disabled = true;
  elements.studioStatus.textContent = 'Restoring the default viewer style…';
  try {
    state.overlayStyle = normalizeStudioStyle(await window.breakSuite.resetOverlayStyle());
    renderFrameStudio();
    elements.studioStatus.textContent = '✓ Restored the default frame, position, and claim-popup timing.';
  } catch (error) {
    elements.studioStatus.textContent = error.message || 'The default style could not be restored.';
  } finally {
    button.disabled = false;
  }
});
function closeListingNotesEditor() {
  elements.listingNotesModal.classList.add('hidden');
}

elements.editBreakListingNotes?.addEventListener('click', () => {
  const gameName = state.boardGame === 'RIFTBOUND' ? 'Riftbound' : 'One Piece';
  elements.listingNotesGame.textContent = `Saved separately for ${gameName} and applied to every row copied from a ${gameName} board.`;
  elements.listingNotesText.value = state.listingDescriptions[state.boardGame] || '';
  elements.listingNotesModal.classList.remove('hidden');
  window.setTimeout(() => elements.listingNotesText.focus(), 0);
});

elements.cancelListingNotes?.addEventListener('click', closeListingNotesEditor);
elements.listingNotesModal?.addEventListener('click', event => {
  if (event.target === elements.listingNotesModal) closeListingNotesEditor();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !elements.listingNotesModal?.classList.contains('hidden')) closeListingNotesEditor();
  if (event.key === 'Escape' && !elements.pullHistoryCardModal?.classList.contains('hidden')) closePullHistoryCardEditor();
  if (event.key === 'Escape' && !elements.priceInputModal?.classList.contains('hidden')) closePriceInputModal();
});
elements.listingNotesForm?.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const result = await window.breakSuite.saveBreakBoardListingDescription({
      gameCode: state.boardGame,
      description: elements.listingNotesText.value
    });
    state.listingDescriptions[result.gameCode] = result.description;
    closeListingNotesEditor();
    renderBreakBoard();
    elements.breakBoardStatus.textContent = `✓ ${result.gameCode === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'} listing notes saved and applied to every copied row.`;
  } catch (error) {
    elements.breakBoardStatus.textContent = error.message || 'The listing notes could not be saved.';
  }
});
elements.resetListingNotes?.addEventListener('click', async () => {
  const result = await window.breakSuite.resetBreakBoardListingDescription(state.boardGame);
  state.listingDescriptions[result.gameCode] = result.description;
  elements.listingNotesText.value = result.description;
  renderBreakBoard();
  elements.breakBoardStatus.textContent = `Default ${result.gameCode === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'} listing notes restored.`;
});

elements.copyBreakListing.addEventListener('click', async () => {
  if (!state.boardCards.length) {
    elements.breakBoardStatus.textContent = 'Add at least one library card before copying the listing.';
    return;
  }
  const result = await window.breakSuite.copyBreakBoardListing();
  const numberingNote = result.renumbered ? ' Old slot numbers were re-counted first.' : '';
  const bundleNote = result.removedRunes ? ` ${result.removedRunes} standalone Rune row${result.removedRunes === 1 ? '' : 's'} merged into the matching Poro bundles.` : '';
  elements.breakBoardStatus.textContent = `${result.copiedCards.toLocaleString()} numbered Whatnot row${result.copiedCards === 1 ? '' : 's'} copied.${bundleNote}${numberingNote} Paste into the first Available Spot Name cell to fill both columns.`;
  await refreshBreakBoard();
});
elements.addMoreBreakCards?.addEventListener('click', () => {
  const libraryView = state.boardGame === 'RIFTBOUND' ? 'library-riftbound' : 'library-onepiece';
  state.boardPresetMessage = `Editing the current ${state.boardGame === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'} working board. Add cards from the Library, then return to Break Board and save the selected setup again.`;
  setView(libraryView);
});
elements.saveBreakBoard.addEventListener('click', async () => {
  if (!state.boardCards.length) {
    elements.breakBoardStatus.textContent = 'Add cards before saving the live ledger.';
    return;
  }
  const activeAssignments = Number(state.connector?.activeAssignments || 0);
  if (activeAssignments && !window.confirm(`Start the next box now? The current ${activeAssignments} confirmed assignment${activeAssignments === 1 ? '' : 's'} and every Buyer Bag selection will move to Pending Review before this board becomes live.`)) return;
  elements.saveBreakBoard.disabled = true;
  try {
    const result = await window.breakSuite.saveBreakBoard({ mappingMode: state.boardMappingMode });
    const numberingNote = result.renumbered ? ' Block numbers were re-counted first.' : '';
    const bundleNote = result.removedRunes ? ` ${result.removedRunes} standalone Rune row${result.removedRunes === 1 ? '' : 's'} merged into the matching Poro bundles.` : '';
    const pendingNote = result.pendingRound
      ? ` ✓ ${result.pendingRound.displayName} is safely held in Pending Review with ${result.pendingRound.confirmedAssignments} assignment${result.pendingRound.confirmedAssignments === 1 ? '' : 's'}.`
      : '';
    const modeNote = result.mappingMode === 'SINGLES' ? ' Buyer Bags now show one exact single per purchased position.' : ' Buyer Bags use this board\'s mapped groups.';
    elements.breakBoardStatus.textContent = `✓ Saved ${result.savedCards.toLocaleString()} block${result.savedCards === 1 ? '' : 's'} to the new live ledger.${modeNote}${pendingNote}${bundleNote}${numberingNote} Open the Connector and press Prepare Show before selling the first spot in this box.`;
    await refreshBreakBoard();
  } catch (error) {
    elements.breakBoardStatus.textContent = error.message || 'The live ledger could not be saved.';
  } finally {
    elements.saveBreakBoard.disabled = false;
  }
});
elements.clearBreakBoard.addEventListener('click', async () => {
  if (!state.boardCards.length) return;
  if (!window.confirm('Clear every card from the working Break Board? Your saved live ledger and library will not be changed until you save again.')) return;
  const result = await window.breakSuite.clearBreakBoard();
  elements.breakBoardStatus.textContent = `${result.removedCards.toLocaleString()} card${result.removedCards === 1 ? '' : 's'} removed from the working board. The previously saved overlay stays active until you save a new board.`;
  await refreshBreakBoard();
  if (isLibraryView()) await refreshCards();
});
elements.breakBoardGame?.addEventListener('change', async () => {
  const requestedGame = elements.breakBoardGame.value;
  try {
    const result = await window.breakSuite.setBreakBoardGame(requestedGame);
    state.boardGame = result.gameCode;
    if (result.gameCode !== 'RIFTBOUND') state.boardMappingMode = 'MAPPED';
    state.boardPresetMessage = `${result.gameCode === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'} Library selected for this working board.`;
    renderBreakBoard();
  } catch (error) {
    elements.breakBoardGame.value = state.boardGame;
    state.boardPresetMessage = error.message || 'The board library could not be changed.';
    renderBoardPresets();
  }
});
elements.breakBagMode?.addEventListener('change', async () => {
  const previousMode = state.boardMappingMode;
  const requestedMode = elements.breakBagMode.value;
  elements.breakBagMode.disabled = true;
  try {
    const result = await window.breakSuite.setBreakBoardMappingMode(requestedMode);
    state.boardMappingMode = result.mappingMode;
    state.boardPresetMessage = result.mappingMode === 'SINGLES'
      ? 'Singles selected: each Buyer Bag will show only the exact card at the purchased position. Save this setup to keep the choice.'
      : 'Mapped groups selected: Buyer Bags will use this board\'s champion and bundle mapping. Save this setup to keep the choice.';
    await refreshBreakBoard();
  } catch (error) {
    state.boardMappingMode = previousMode;
    elements.breakBagMode.value = previousMode;
    state.boardPresetMessage = error.message || 'The Buyer Bag mode could not be changed.';
    renderBoardPresets();
  } finally {
    elements.breakBagMode.disabled = state.boardGame !== 'RIFTBOUND';
  }
});
elements.saveBreakPreset?.addEventListener('click', async () => {
  const selected = selectedBoardPreset();
  if (!state.boardCards.length) {
    state.boardPresetMessage = 'Add at least one card before saving a reusable board setup.';
    renderBoardPresets();
    return;
  }
  if (selected?.count && !selected.isLoaded && !window.confirm(`Replace “${selected.name || `Setup ${selected.slot}`}” with the current ${state.boardCards.length}-card working board?`)) return;
  const button = elements.saveBreakPreset;
  button.disabled = true;
  try {
    const result = await window.breakSuite.saveBreakBoardPreset({
      slot: state.selectedBoardPresetSlot,
      name: elements.breakPresetName.value,
      mappingMode: state.boardMappingMode
    });
    const modeName = result.mappingMode === 'SINGLES' ? 'Singles · exact positions' : 'Mapped groups';
    state.boardPresetMessage = `✓ Saved ${result.savedCards.toLocaleString()} cards in ${result.name} with ${modeName}. This does not change the live ledger or OBS display.`;
    await refreshBreakBoard();
  } catch (error) {
    state.boardPresetMessage = error.message || 'The board setup could not be saved.';
    renderBoardPresets();
  } finally {
    button.disabled = false;
  }
});
elements.clearBreakPreset?.addEventListener('click', async () => {
  const selected = selectedBoardPreset();
  if (!selected?.count) return;
  const workingBoardNote = selected.isLoaded
    ? ' Because this is the board currently shown, its working cards will also be emptied.'
    : ' The board currently shown will stay unchanged.';
  if (!window.confirm(`Empty saved setup “${selected.name || `Setup ${selected.slot}`}”?${workingBoardNote} Your other saved setups and live OBS board will stay unchanged.`)) return;
  const button = elements.clearBreakPreset;
  button.disabled = true;
  try {
    const result = await window.breakSuite.clearBreakBoardPreset(state.selectedBoardPresetSlot);
    state.boardPresetMessage = result.clearedWorkingBoard
      ? `✓ Emptied Setup ${String(result.slot).padStart(2, '0')} and cleared its working cards. Your other saved setups and live OBS board were not changed.`
      : `✓ Emptied Setup ${String(result.slot).padStart(2, '0')}. Your current working board, other saved setups, and live OBS board were not changed.`;
    await refreshBreakBoard();
  } catch (error) {
    state.boardPresetMessage = error.message || 'The saved setup could not be cleared.';
    renderBoardPresets();
  } finally {
    button.disabled = false;
  }
});
elements.openBreakOverlay.addEventListener('click', async () => {
  await window.breakSuite.openBreakOverlay();
  elements.breakBoardStatus.textContent = 'Break Board Display opened. It shows the last saved live ledger.';
  await refreshBreakBoard();
});
elements.sendConnectorTest.addEventListener('click', async () => {
  const position = elements.connectorTestBlock.value;
  if (!position) return;
  elements.sendConnectorTest.disabled = true;
  try {
    const buyer = elements.connectorTestBuyer.value.trim() || 'Test Buyer';
    const card = await window.breakSuite.testConnectorAssignment({ number: position, buyer });
    elements.connectorTestResult.textContent = `✓ ${buyer} was assigned block ${String(card.position).padStart(2, '0')} (${card.name}). That card was removed from the overlay.`;
    await refreshBreakBoard();
  } catch (error) {
    elements.connectorTestResult.textContent = error.message || 'The test signal could not be processed.';
  } finally {
    renderConnector();
  }
});
elements.runConnectorStressTest.addEventListener('click', async () => {
  if (!window.confirm('Run the full local stress test? Every ready saved block will be shared across up to 15 Test Buyers, removed from the overlay, and shown in Buyer Bags. Real Whatnot assignments will not be changed.')) return;
  elements.runConnectorStressTest.disabled = true;
  try {
    const result = await window.breakSuite.runConnectorStressTest();
    elements.connectorTestResult.textContent = `✓ Stress test assigned ${result.assignedCards.toLocaleString()} ready block${result.assignedCards === 1 ? '' : 's'} across ${result.buyerCount.toLocaleString()} random Test Buyer${result.buyerCount === 1 ? '' : 's'}. The overlay and Breaker Center now show the full simulated result.`;
    await refreshBreakBoard();
  } catch (error) {
    elements.connectorTestResult.textContent = error.message || 'The automated stress test could not be started.';
  } finally {
    renderConnector();
  }
});
elements.resetConnectorTest.addEventListener('click', async () => {
  elements.resetConnectorTest.disabled = true;
  try {
    const result = await window.breakSuite.resetConnectorTestAssignments();
    elements.connectorTestResult.textContent = result.resetBlocks
      ? `✓ Restored ${result.resetBlocks.toLocaleString()} simulated card${result.resetBlocks === 1 ? '' : 's'} to the overlay.`
      : 'There are no simulated assignments to reset.';
    await refreshBreakBoard();
  } catch (error) {
    elements.connectorTestResult.textContent = error.message || 'The simulated assignments could not be reset.';
  } finally {
    renderConnector();
  }
});
elements.runImport.addEventListener('click', startOfficialImport);
elements.runRiftboundImport.addEventListener('click', startRiftboundImport);
elements.runOpenRiftImageRefresh.addEventListener('click', startOpenRiftImageRefresh);
elements.runRiftboundJsonImport.addEventListener('click', startRiftboundJsonImport);
elements.riftboundApiForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const status = await window.breakSuite.saveRiftboundApiKey(elements.riftboundApiKey.value);
    elements.riftboundApiKey.value = '';
    elements.riftboundApiState.textContent = status.configured
      ? '✓ Approved Riot API key saved securely as an optional backup'
      : 'No API key needed for Official Gallery Sync';
  } catch (error) {
    elements.riftboundApiState.textContent = error.message || 'The Riot API key could not be saved.';
  }
});
document.querySelector('#open-riot-developer-portal').addEventListener('click', () => window.breakSuite.openExternal('https://developer.riotgames.com/'));
elements.repairLibrary.addEventListener('click', repairLibrary);
elements.resetLibraryForm.addEventListener('submit', resetLibrary);
window.breakSuite.onImportProgress(setImportStatus);
window.breakSuite.onRiftboundImportProgress(setRiftboundImportStatus);
let pendingBoardChangeCards = null;
let boardChangeRefreshRunning = false;
async function flushBoardChangeRefresh() {
  if (boardChangeRefreshRunning) return;
  boardChangeRefreshRunning = true;
  try {
    while (pendingBoardChangeCards) {
      const cards = pendingBoardChangeCards;
      pendingBoardChangeCards = null;
      await refreshBreakBoard(cards);
    }
  } finally {
    boardChangeRefreshRunning = false;
  }
}
window.breakSuite.onBreakBoardChanged(cards => {
  // Hidden pages stay asleep. The OBS/browser feeds are separate and remain
  // live; when the user opens a live-control page, setView() requests a fresh
  // snapshot. This keeps buyer assignments from rebuilding Library/History UI.
  state.boardCards = Array.isArray(cards) ? cards : state.boardCards;
  if (!LIVE_BOARD_VIEWS.has(state.view)) return;

  // Coalesce bursts from connector/ledger updates. If two assignments arrive
  // while one refresh is still rendering, only the newest snapshot is needed.
  pendingBoardChangeCards = cards;
  flushBoardChangeRefresh().catch(() => {});
});
window.breakSuite.onConnectorStatusChanged(status => {
  state.connector = status;
  // OBS heartbeat/status events should not repaint hidden controls.
  if (state.view === 'break' || state.view === 'connector') {
    renderReadyChecks();
    renderConnector();
  }
});

async function initialize() {
  const status = await window.breakSuite.getDatabaseStatus();
  elements.database.textContent = status.ready ? 'Ready — local SQLite database connected' : 'Database not ready';
  const lastImport = await window.breakSuite.getLastImport();
  if (lastImport?.status === 'completed') {
    setImportStatus({ phase: 'complete', message: `Last official import saved ${lastImport.cards_imported.toLocaleString()} cards.`, importedCards: lastImport.cards_imported });
  }
  state.cardListGame = state.game;
  await refreshRarityOptions();
  await refreshCatalogSets();
  renderOpenCaseSetOptions({ resetBoxes: true });
  syncHistoryTrackerDestination();
  renderCardListResults();
  await refreshOverview();
  await refreshRiftboundApiStatus();
  await refreshPricingSettings();
  state.listingDescriptions = await window.breakSuite.getBreakBoardListingDescriptions();
  // Start only the page that is visible. Heavy history, tracker and studio
  // views load on demand in setView() instead of during every app launch.
  await refreshBreakBoard();
  if (isLibraryView()) await refreshCards();
}

initialize();
