@echo off
setlocal EnableExtensions
set "RELEASE_VERSION=0.3.385"
title BreakSuite6 v%RELEASE_VERSION% Board 9 Spiritforged Overlay Update
set "PAYLOAD=%~dp0app"
set "APP_HOME="
if not exist "%PAYLOAD%\package.json" (
  echo This update package is incomplete. Extract the entire ZIP first.
  pause
  exit /b 1
)
set "PAYLOAD_VERSION="
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "try { (Get-Content -Raw '%PAYLOAD%\package.json' | ConvertFrom-Json).version } catch { '' }"`) do set "PAYLOAD_VERSION=%%V"
if /I not "%PAYLOAD_VERSION%"=="%RELEASE_VERSION%" (
  echo Update package version check failed.
  echo Expected v%RELEASE_VERSION% but the payload reports v%PAYLOAD_VERSION%.
  echo Extract a fresh copy of the complete ZIP and try again.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\node_modules\cheerio\package.json" (
  echo Runtime dependency check failed: cheerio is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\renderer\pull-history-buyer-message.js" (
  echo Pull History buyer messaging is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\PullHistoryCorrection.js" (
  echo Pull History missed-card correction is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\LiveCaseTracker.js" (
  echo Live Case Tracker logic is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\renderer\active-case.html" (
  echo Active Case Status OBS overlay is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\renderer\active-case.css" (
  echo Active Case Status OBS styling is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\renderer\active-case.js" (
  echo Active Case Status OBS behavior is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\BuyerPurchaseAudit.js" (
  echo Buyer Purchase Accuracy Check is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\BusinessSnapshot.js" (
  echo Business Profit and Tax Snapshot is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\BusinessExpenseReport.js" (
  echo Business Expense Print Report is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\BusinessExpenseExport.js" (
  echo Direct PDF and Excel export support is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundUnleashedColorBreak.js" (
  echo Legacy Unleashed round compatibility is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundUnleashedTop80.js" (
  echo Legacy Unleashed Top 80 compatibility is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundUnleashedCaseBreak.js" (
  echo Unleashed 19-spot Board 1 mapping is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundUnleashedBoardThree.js" (
  echo Unleashed 23-spot Board 3 mapping is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundUnleashedExpandedBreak.js" (
  echo Unleashed 39-spot Board 7 mapping is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundUnleashedFullCase.js" (
  echo Unleashed 26-spot character-case Board 5 mapping is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\BreakBoardMappingMode.js" (
  echo Per-board Singles Buyer Bag mapping is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\BreakBoardCustomMapping.js" (
  echo Frame Studio Board Mapping Editor is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundVendettaBreak.js" (
  echo Price-balanced Vendetta Board 5 mapping is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundVendettaSplitBreak.js" (
  echo Restored Vendetta 16-spot Board 9 mapping is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundSpiritforgedExpandedBreak.js" (
  echo Spiritforged 50-spot Board 6 mapping is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\RiftboundVendettaChaseSingles.js" (
  echo Vendetta 106-position exact Singles Board 10 mapping is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\PullHistoryPricing.js" (
  echo Buyer Bag market pricing is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\renderer\card-list-search.js" (
  echo Card List Search is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\PlayableMarket.js" (
  echo Playable Market data model is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\renderer\playable-market.js" (
  echo Playable Market page is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\modules\AutomaticBoxTracker.js" (
  echo Automatic Box and Case tracking is missing from the update package.
  pause
  exit /b 1
)
if not exist "%PAYLOAD%\src\renderer\assets\popup-statue-ultimate-board10.png" (
  echo Riftbound Ultimate popup platform is missing from the update package.
  pause
  exit /b 1
)
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Find-BreakSuite6.ps1"`) do if not defined APP_HOME set "APP_HOME=%%I"
if not defined APP_HOME (
  echo Automatic detection did not find BreakSuite6. Select its folder once.
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Select-BreakSuite6Folder.ps1"`) do if not defined APP_HOME set "APP_HOME=%%I"
  if not defined APP_HOME exit /b 1
)
if not exist "%APP_HOME%\BreakSuite6.exe" (
  echo The selected folder does not contain BreakSuite6.exe.
  pause
  exit /b 1
)
set "RES=%APP_HOME%\resources"
set "APP_ASAR=%RES%\app.asar"
set "APP_DIR=%RES%\app"
tasklist /FI "IMAGENAME eq BreakSuite6.exe" /NH | find /I "BreakSuite6.exe" >nul
if not errorlevel 1 taskkill /F /IM BreakSuite6.exe >nul 2>&1

echo Closing any stale BreakSuite overlay server on port 8878...
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$connections = @(Get-NetTCPConnection -LocalPort 8878 -State Listen -ErrorAction SilentlyContinue); foreach ($connection in $connections) { $connection.OwningProcess }"`) do (
  taskkill /F /PID %%P >nul 2>&1
)

echo Installing BreakSuite6 v%RELEASE_VERSION% safely...
if exist "%APP_ASAR%" (
  if not exist "%RES%\app.asar.pre-v0.3.202.backup" copy /Y "%APP_ASAR%" "%RES%\app.asar.pre-v0.3.202.backup" >nul
  copy /Y "%APP_ASAR%" "%RES%\app.asar.pre-v%RELEASE_VERSION%.backup" >nul
  del /F /Q "%APP_ASAR%" >nul 2>&1
)
if exist "%APP_DIR%" rmdir /S /Q "%APP_DIR%"
mkdir "%APP_DIR%"
xcopy "%PAYLOAD%\*" "%APP_DIR%\" /E /I /H /Y >nul
if errorlevel 1 (
  echo App copy failed. Restoring the previous app.asar...
  rmdir /S /Q "%APP_DIR%" 2>nul
  if exist "%RES%\app.asar.pre-v%RELEASE_VERSION%.backup" copy /Y "%RES%\app.asar.pre-v%RELEASE_VERSION%.backup" "%APP_ASAR%" >nul
  if not exist "%APP_ASAR%" if exist "%RES%\app.asar.pre-v0.3.202.backup" copy /Y "%RES%\app.asar.pre-v0.3.202.backup" "%APP_ASAR%" >nul
  pause
  exit /b 1
)
if not exist "%APP_DIR%\node_modules\cheerio\package.json" (
  echo Runtime dependency copy failed. Restoring previous app...
  rmdir /S /Q "%APP_DIR%" 2>nul
  if exist "%RES%\app.asar.pre-v%RELEASE_VERSION%.backup" copy /Y "%RES%\app.asar.pre-v%RELEASE_VERSION%.backup" "%APP_ASAR%" >nul
  if not exist "%APP_ASAR%" if exist "%RES%\app.asar.pre-v0.3.202.backup" copy /Y "%RES%\app.asar.pre-v0.3.202.backup" "%APP_ASAR%" >nul
  pause
  exit /b 1
)
echo.
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "try { (Get-Content -Raw '%APP_DIR%\package.json' | ConvertFrom-Json).version } catch { '' }"`) do set "INSTALLED_VERSION=%%V"
if /I not "%INSTALLED_VERSION%"=="%RELEASE_VERSION%" (
  echo Installed-file verification failed. Restoring the previous app...
  rmdir /S /Q "%APP_DIR%" 2>nul
  if exist "%RES%\app.asar.pre-v%RELEASE_VERSION%.backup" copy /Y "%RES%\app.asar.pre-v%RELEASE_VERSION%.backup" "%APP_ASAR%" >nul
  if not exist "%APP_ASAR%" if exist "%RES%\app.asar.pre-v0.3.202.backup" copy /Y "%RES%\app.asar.pre-v0.3.202.backup" "%APP_ASAR%" >nul
  pause
  exit /b 1
)
echo BreakSuite6 v%RELEASE_VERSION% installed and verified in:
echo %APP_HOME%
echo Saved Board 1 now has the 33-spot Vendetta setup. Load Board 1 in the app to view it.
echo If Board 1 says Update Pending, sync Vendetta cards and reopen the board.
echo OBS Card View and the reveal now reuse card mappings and refresh the buyer and sold status directly.
echo Once enabled, the Static OBS Board stays enabled after BreakSuite restarts.
echo Live sale popups catch up after quick purchases while keeping every spot in order.
echo Reload the unpacked BreakSuite6 Whatnot Connector in Brave or Chrome after this update.
echo Box Tracker now loads saved cases in batches. Edit Case opens the case-name field without rebuilding the page.
echo Live sale popups now survive delayed Whatnot prices, and an older OBS board URL can show the reveal if the dedicated popup source is absent.
echo When popup.html is present in OBS, it alone shows sale reveals.
echo Open Orders and expand a saved box to change its Box Tracker destination.
echo Choose standalone Box, standalone Case, or a named open case and press Update Tracker.
echo Moving an Order keeps its buyer, pull, and accounting history and clears its old tracker position.
echo Saved Board 3 is now forced from the old 19 positions to the approved 23-position Unleashed map.
echo A partial local catalog audit can no longer silently leave the old Board 3 in place.
echo Every Poro owns its AA Rune plus unreserved Rare/Epic color Units, Champion Units, Gear, and Spells.
echo Plundering Poro is Blue/Mind and Veteran Poro is Orange/Body.
echo Vilemaw, Elder Dragon, and Rift Herald each show Alternate Art first and Epic second.
echo Baron Nashor owns all three printings, and exact card ownership is duplicate-free.
echo Other saved boards and all live, pending, and historical Buyer Bags remain unchanged.
echo Live Cases now include Edit Case and Delete Live Case controls.
echo Each archived case box includes Check / Edit Pulls and Remove Box controls.
echo Removing a box or deleting a live case preserves Orders History and Pull History.
echo Capacity edits cannot cut off an archived box, and the Active Case overlay updates automatically.
echo Pull History now includes Add Missed Card inside each buyer's exact-card audit.
echo Corrections update the same saved batch and merge an identical card/spot into its quantity.
echo The archived buyer bag and any existing linked Box Tracker are rebuilt without duplicate totals.
echo The current live board, connector, and OBS state are not changed by a history correction.
echo Riftbound SP-numbered pulls now save to Box Tracker as their own SP category.
echo SP detection follows the printed collector number even before a newer catalog snapshot is installed.
echo Exact SP card, buyer, spot, quantity, and sale amount continue through the normal archive flow.
echo Every Riftbound board now uses a labeled popup platform selected by the first card only.
echo Paired cards remain saved for Buyer Bags and history but never create a second public popup card.
echo Unleashed Ultimate lead cards use their own black-and-gold ULTIMATE plate.
echo Exact Ultimate printings now use the skull symbol and always select the ULTIMATE plate.
echo Normal Overnumbered printings keep the fire symbol and OVERNUMBERED plate.
echo The regular OBS Card View can reveal sales if popup.html is absent; popup.html takes over automatically when active.
echo Each reveal appears once, stays still, and disappears once without a looping hover effect.
echo Buyer Bags, the live ledger, claims, assignments, and saved history remain unchanged.
echo Board 10 Epic and Astral Heron titles now say Epic and use the heart popup symbol.
echo Any standalone Board 10 Rare says Rare and uses the construction popup symbol.
echo Listing titles, pair ownership, and every saved board remain unchanged.
echo Board 10 installation is forced again and can no longer be blocked by a missing local Vendetta card.
echo Saved Board 10 now contains 106 exact Vendetta Singles.
echo It includes 9 SIG, 31 ON, 33 AA, 26 regular Epic, 6 SP, and standalone Astral Heron.
echo Standard Rares are excluded and no Rare family is attached to any position.
echo Board 9 and all live, pending, and historical breaks remain unchanged.
echo Box Tracker is now created automatically when a break is saved to Order History.
echo Choose only Box or Case; BreakSuite detects One Piece or Riftbound and the exact set.
echo Riftbound Box Tracker records Epic, SP, Alternate Art, Overnumbered, and Signature hits.
echo Playable Market now opens as a standalone webpage outside BreakSuite.
echo Future tracker changes happen on the webpage and do not require another BreakSuite update.
echo Board 5 now contains the exact 26 Unleashed character-case listings.
echo Board 5 is ordered Baron first, all 12 champions next, and every remaining spot after them.
echo One buyer owns each selected spot for the complete case; there are no box lanes.
echo Each named champion owns its complete eight-card booster family.
echo Plundering Poro owns the blue/Mind Rares; Veteran Poro owns the orange/Body Rares.
echo Each Poro owns every unreserved regular Rare Unit in its matching domain.
echo Spot 21 owns only unreserved Rare-or-higher Gears and Spells; Commons and Uncommons are excluded.
echo Copy Listing puts the first card's Diamond, Fire, or Bomb once before and after each Riftbound title.
echo Named creature bundles own every matching printing displayed in their title.
echo All six booster Alternate-Art Runes remain together in Spot 20.
echo Board 5 shows one lead card publicly while Buyer Bags retain the complete mapping.
echo Frame Studio now has separate Statue / frame size and Live card size sliders.
echo Each popup layer can be resized from 60 to 130 percent without changing the other.
echo The existing Popup size slider still scales the complete reveal together.
echo The new default proportions use a 92 percent statue and a 90 percent card baseline.
echo The live card remains centered and floats in front of the stationary statue.
echo Board 4's one-card rule is now enforced after every Spiritforged mapping path.
echo Both regular and custom Board 4 mappings are reduced to one public popup card.
echo Board 4 now shows only its first mapped card in the OBS board and purchase popup.
echo The incorrect combined two-card plus layout has been removed from Board 4.
echo The complete Board 4 mapping remains intact in Buyer Bags and ownership checks.
echo The mapped lead card still selects the Diamond, Fire, or Bomb statue effect.
echo The sold card is now smaller, exactly centered, and floats subtly in front of the statue.
echo The sold card now sits inside the free-standing transparent Diamond, Fire, or Bomb statue.
echo The opaque rectangular photo-style popup shell has been removed.
echo The OBS card reveal now uses a restrained entrance, a stable hold, and a smooth exit.
echo The dedicated popup source also applies its saved position, scale, colors, and timing before each reveal.
echo Card List Search is now available inside both card libraries.
echo Choose the game and set, paste collector numbers, and press View Cards.
echo It accepts short numbers, full set numbers, alternate-art suffixes, SP cards, Runes, and starred overnumbers.
echo Show Saved Prices can be toggled, and Price This List uses the selected BreakSuite pricing source.
echo The search is read-only and does not change inventory, boards, mappings, Buyer Bags, or OBS.
echo Pool History Copy + Message now includes only Alternate Art-or-higher top hits.
echo Promo, Showcase, SP, Ultimate, Overnumbered, Signature, and other premium treatments are included.
echo Plain Epic, Rare, Uncommon, and Common cards remain saved in Pull History but are not copied into the buyer message.
echo Live and Pending Review Riftbound Buyer Bags now have a small minus/plus button beside Whole Bag pricing.
echo Minimize hides that buyer's audit cards and controls while keeping the buyer header visible.
echo Copy Results now includes only Alternate Art-or-higher top hits; Epic, Rare, Common, and Uncommon pulls remain recorded but are not copied.
echo Frame Studio now includes a visual Mapping Editor for saved mapped Riftbound boards.
echo Click a saved board to inspect every Buyer Spot and its exact assigned cards.
echo The first card stays locked as the spot anchor; other cards can be removed, moved, or dragged.
echo Add Sequence Card maps an exact card without changing the public title.
echo Add + Title Card maps the card and appends its name once to listings and Buyer Bags.
echo Already-mapped Library cards glow and show their current Buyer Spot.
echo Custom mappings stay separate per saved board and prevent duplicate card ownership.
echo Existing live and Pending Buyer Bags keep their original mapping snapshots.
echo Load the edited saved board and press Save Board only when you want it to become live.
echo Board 7 champion Buyer Bags now use compact Diamond, Fire, and Bomb symbols.
echo The repeated long champion-lane note has been removed from those Buyer Bags.
echo Rengar SIG now receives Thrill of the Hunt Epic 184.
echo Rengar ON now receives Rengar, Trophy Hunter Epic 120.
echo Both Rengar positions remain separate four-card spots with no duplicate owner.
echo Board 10 now uses exact Vendetta Singles; Board 5 remains independent.
echo Price Entire Board now appears beside Riftbound cards remaining.
echo One run covers every Remaining Card plus every distinct card displayed in every current Buyer Bag.
echo Every live and Pending Review Buyer Bag has a Whole Bag button; actual-pull + selections are not required for pricing.
echo Remaining Cards and Buyer Bag cards show the same tiny private dollar badge.
echo Choose JustTCG, ChatGPT Batch Import, eBay Active Estimate, or Manual Price.
echo JustTCG and eBay run automatically after their access details are configured.
echo ChatGPT creates one complete board or bag request and needs only one copy-and-paste round with no separate OpenAI API key.
echo Every price run replaces the complete requested card list with one source so provider values cannot mix.
echo Hide Spending removes every Remaining Card and Buyer Bag price badge completely.
echo API Keys / Help opens provider selection, instructions, and optional credentials.
echo Saved Board 6 now uses the corrected Spiritforged 39-position mapping.
echo Shurelya's Requiem is back with Soraka.
echo Spot 25 is Fizz plus Switcheroo; Spot 26 is Premonition plus Downwell.
echo Spot 27 remains standalone Last Rites.
echo The corrected Board 6 remains installed; this release separately replaces only saved Board 5.
echo Board 10 uses one exact Vendetta card per position and one-card popup.
echo Existing live and pending rounds keep the ownership rules under which they were sold.
echo Live and Pending Review Riftbound Buyer Bags include scoped Whole Bag price controls beside the heading.
echo Each Whole Bag action covers every distinct card displayed for that buyer.
echo The existing paced JustTCG Near Mint English connection remains available and unchanged.
echo Exact-card values are cached on the central Library card and can be reused in every Buyer Bag.
echo Checked prices carry into Pull History when the box is completed and archived.
echo Hide Spending now hides buyer spend, live and pending totals, and every market-price badge together.
echo Price checks never change boards, mappings, assignments, pulls, OBS, or connector behavior.
echo Saved Board Setups now has ten reusable slots.
echo Board 5 retains its existing 26-position preset; Board 3 is the only preset replaced by this update.
echo Board 6 receives the new 39-position Spiritforged mapped setup once.
echo All twelve old champion pairs are split into 24 separate champion spots.
echo Fizz plus Switcheroo share one spot; Premonition plus Downwell share another; Last Rites is standalone.
echo Every Seal has its own spot, separate from the six Showcase Rune and Rare/Epic domain spots.
echo Listings, Buyer Bags, pull validation, Pending Review, popups, and OBS use the same 39-spot map.
echo Loading Board 6 does not change the live ledger until Save Board is pressed.
echo Every business expense source now prints together in one continuous table.
echo Box costs, Whatnot fees, adjustments, supplies, equipment, and inventory entries are sorted by date.
echo The Accounting Treatment column still prevents double counting without separating the records.
echo The report now prints upright in portrait orientation.
echo Business Expenses remains available inside the full BreakSuite application.
echo Choose a tax year and click Download PDF or Download Excel CSV to save a report file directly.
echo The report itemizes completed breaks, sales, fees, box costs, adjustments, and manual expenses.
echo Inventory purchases, duplicate manual fees, and personal use are clearly separated to prevent double counting.
echo Your database, buyers, pulls, expense records, overlays, and connector are preserved; only saved Board 5 is replaced.
echo Unleashed 19-spot Buyer Bags now place every owned card in one horizontal flow.
echo Champion families, Baron and all six AA Runes, and Poro/color cards stay together.
echo Large paired separators and separate vertical group columns are removed from this profile.
echo Live Buyer Bags and Pending Review both use the compact layout.
echo The approved 19-spot ownership map and all saved data remain unchanged.
echo Saved Board 1 now contains the approved 19-position Unleashed case break.
echo Spots 1-12 own their complete champion families.
echo Spot 13 owns every Baron Nashor printing plus all six booster AA Runes.
echo Spots 14-19 own their Poro, named chase, and unreserved Rare/Epic color hits.
echo Promotional b Runes are excluded, and no Rune belongs to a color position.
echo Board 1 uses Mapped groups across listings, Buyer Bags, pulls, history, popups, and OBS.
echo The current live ledger, pending rounds, histories, buyers, purchases, and pulls are untouched.
echo Pull History turns the full buyer tile green when either alert condition is met.
echo Condition 1: the buyer spent strictly over $100. Exactly $100 alone does not qualify.
echo Condition 2: the buyer pulled Alt Art/Showcase, SP, Ultimate, Overnumbered, or Signature.
echo The Copy + Message button is also green on qualifying buyer tiles.
echo Buyer messages are now short and consistent across live breaks, Pending Review, and Pull History.
echo They thank the buyer, list the exact pulls, close with appreciation, and end with five stars only.
echo Saved histories, purchases, buyers, and pulls are not changed or deleted.
echo Vendetta purchase popups now show the complete combined spot name.
echo Signature combinations show every included champion.
echo SP/color combinations now include their Fury, Calm, Mind, Body, Chaos, or Order Rune name.
echo Example: Sona + Riven + Calm Rune.
echo Vendetta Copy Listing now shows every champion combination for all 16 positions.
echo Listing names contain champion and owned Rune names with no card numbers or chase-card details.
echo The copy-ready preview and copied Whatnot listing text now match.
echo Riven now belongs to the Sona bundle.
echo Zed is now Zed + Gangplank.
echo Ambessa is now Ambessa + Morgana.
echo Astral Heron is now Astral Heron + Irelia + Helm of Suppression.
echo All 22 Rival ON champion families still have exactly one owner.
echo Vendetta Buyer Bags now use one clean horizontal card grid like Spiritforged.
echo The large + / PAIRED separators and separate family columns are removed from Vendetta bags.
echo Live and Pending Review Buyer Bags both use the compact responsive layout.
echo The 16-position Vendetta mapping is complete with one owner per mapped card.
echo Saved Board 9 uses the restored 16-position layout; saved Board 5 remains the 26-position Unleashed map.
echo Akali stays alone; every other headline spot receives at least one Rival ON family.
echo Sett receives Kha'Zix so every SP/color lane keeps one Rival ON partner.
echo Kayle 185/166 is mapped to Lux, while Irelia is mapped to Astral Heron.
echo Buyer Bags, copied results, pull validation, listing labels, and OBS use the same ownership map.
echo The live ledger and Pending Review/history records were not changed.
echo Singles Buyer Bags now show five compact exact-position cards across on desktop.
echo The OBS Spot Map now shows five exact Singles positions at once.
echo Champion, Poro, color, pair, and combo boards keep their existing mapped layout.
echo Older Unleashed Top 80 and seven-color live/pending rounds remain readable.
echo The Break Board now saves Singles or Mapped groups separately for every reusable board.
echo Buyer Bags, Pending Review, the Spot Map, and OBS all follow the saved mode for that box.
echo Boards 2, 4, and 5 keep their existing mapped behavior unless you change their Buyer Bag mode.
echo Pull History now includes Hide Buyer Values and Show Buyer Values.
echo The toggle hides Paid, Pull Value, and Value - Paid on every buyer card.
echo Buyer names, spot and card counts, Copy + Message, and pulled-card details stay visible.
echo This privacy control changes display only; saved financial data and calculations remain unchanged.
echo Spiritforged Rune spots now include matching generic Epic cards.
echo Unpaired Spiritforged Rare Champion Units now follow their matching Rune domain.
echo Champions already owned by a Signature-pair spot remain exclusive to that pair and are not duplicated in Rune spots.
echo Profit/Cooked and Who's Winning now use Pull History only.
echo Older Orders-only purchases are excluded from buyer win/loss results.
echo Buyer Case Lookup now uses the same Pull History-only coverage.
echo Check Pull History validates tracked Pull History spend and saved card prices without backfilling older orders.
echo Loyalty and Top 10 buyer spending still use all saved Orders History.
echo Business Profit + Tax still uses Orders History and expenses; accounting verification no longer writes Pull History.
echo Business Expenses now includes a year-based Business Snapshot for sales, fees, sold-box cost, adjustments, operating expenses, and tracked net profit.
echo The snapshot includes a planning-only self-employment tax estimate plus 10%%, 12%%, and 22%% federal income-tax scenarios.
echo 2026 self-employment planning uses the 92.35%% net-earnings factor, 12.4%% Social Security, 2.9%% Medicare, and the 2026 Social Security wage base.
echo Inventory / sealed-product purchases are tracked separately so completed-box cost is not silently deducted twice.
echo A data-health section flags missing box costs, unpriced archived purchases, estimated Whatnot fees, and possible duplicate accounting entries.
echo Buyer Analytics uses Check Pull History for the tracked Profit/Cooked cohort.
echo Profit/Cooked no longer depends on Orders History links; it reads saved Pull History spot/payment snapshots directly.
echo Missing Pull History spot prices or card prices stay Needs Pricing instead of being guessed from older orders.
echo Older Orders-only and legacy pull batches without saved spend snapshots are excluded from Profit/Cooked.
echo Origins Seal Buyer Bags still behave like champion spots: Seal + AA Rune + Rare/Epic cards stay in one responsive box.
echo Narrower Buyer Bag panels wrap Origins Seal cards onto new rows inside the same spot; no sideways scrolling.
echo Origins Board 2 mapping is ready for 18 spots: 12 Champions plus 6 Seal/domain lanes.
echo Origins Seal lanes map the Seal, booster AA Rune, and unreserved Rare/Epic domain hits only.
echo Origins Common/Uncommon cards and promotional Rune B printings are excluded.
echo Runtime dependencies included and verified.
echo The rolling OBS Spot Map shows five exact Singles at once and keeps four columns for mapped-family boards.
echo It advances every 3.5 seconds and does not stretch the final page.
echo Card Sniper now opens an exact Whatnot search beside every result.
echo Whatnot live asking prices are comparison-only; JustTCG still controls the SNIPE signal.
echo Buyer Bag pull selections now preserve your exact page position.
echo Live and Pending Review checkboxes and Riftbound quantity controls no longer jump to the bottom.
echo The camera-front popup now shows active purchases even after its OBS source reloads.
echo The dedicated popup source stays responsive when OBS reports it as hidden.
echo Connector v0.3.45 now advances only after BreakSuite confirms the popup was queued.
echo Live purchase popups now remain active when the Static OBS Board is disabled.
echo The Static OBS Board toggle controls only the steady card board.
echo The steady OBS board now has its own Enable/Disable toggle and copy-link button.
echo It defaults to Idle and builds no card mapping or image URLs until enabled.
echo The static OBS source checks every 2 seconds while idle so it can take over a missing popup source.
echo The steady board and rolling Spot Map toggles are independent.
echo Orders History now shows spot positions and prices without duplicate card pictures.
echo Orders no longer performs catalog image lookup or duplicate Pull History retrieval when opened.
echo Exact pulled cards and images remain available in Pull History; Buyer Case Lookup is text-only.
echo Who's Winning compares Pull History spend with matching saved Pull History market values only.
echo Buyer Profit/Cooked case details are text-only; card pictures were removed from that accounting area.
echo Search a Whatnot username to see the tracked Pull History period, amount paid, recorded hit value, and Profit/Cooked result.
echo The Who's Winning board separates On Profit, Getting Cooked, and Needs Pricing buyers.
echo Each standalone Vendetta ON mapping now also shows that champion's regular Epic card.
echo Hidden Orders/Pull History now stays asleep during live work and older records load 10 at a time.
echo Orders and Pull History now load separately, and Pull History records can be deleted safely.
echo Pull History deletion does not change Orders History, the live board, connector, or OBS.
echo Breaker Center no longer loads the local Spot Map card gallery or preview.
echo Copy OBS Spot Map Link remains available and the OBS source is unchanged.
echo The OBS Spot Map now defaults to Idle and generates no card data until you enable it.
echo Enabled Spot Map pages roll every 3.5 seconds: five across for Singles and four across for mapped-family boards.
echo Card images decode in the background to reduce interface stalls.
echo The unused Recent Hits Overlay tab, preview controls, and OBS route were removed.
echo Pull History and Buyer Analytics remain intact.
echo Copy Dispute Report creates a clean text record and Open Whatnot opens the buyer profile.
echo The lookup is read-only. Missing values remain Needs Pricing; they are never counted as zero-dollar cards.
echo Active board anchors, connector parsing, live ledger, buyer ownership, Pull History, and Order History snapshots are unchanged.
echo Installed Whatnot connector copies were not searched, copied, or changed.
echo Your database, images, Boards 1-2 and 4-10, live ledger, and settings were not deleted.
echo.
start "" "%APP_HOME%\BreakSuite6.exe"
pause
exit /b 0
