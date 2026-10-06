const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { ensureBreakOrderHistorySchema } = require('./BreakOrderHistory');
const { ensurePullHistorySchema } = require('./PullHistory');
const { auditBuyerPurchases, auditBusinessOrderTotals, auditPullHistoryBuyerData } = require('./BuyerPurchaseAudit');

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  ensureBreakOrderHistorySchema(db);
  ensurePullHistorySchema(db);
  db.exec(`
    CREATE TABLE break_rounds (
      id INTEGER PRIMARY KEY,
      order_history_id INTEGER,
      pull_history_batch_id INTEGER,
      status TEXT
    );
    CREATE TABLE active_break_board_cards (status TEXT, buyer_name TEXT);
    CREATE TABLE break_round_cards (
      round_id INTEGER,
      position INTEGER,
      status TEXT,
      buyer_name TEXT,
      sale_amount_cents INTEGER NOT NULL DEFAULT 0
    );
  `);
  return db;
}

{
  const db = makeDb();
  const batch = db.prepare(`INSERT INTO pull_history_batches (ledger_saved_at,game_code,set_code,set_name,recorded_at) VALUES (?,?,?,?,?)`)
    .run('ledger-1','RIFTBOUND','OGN','Origins','2026-08-28T10:00:00.000Z');
  const batchId = Number(batch.lastInsertRowid);
  // Both archived sources missed the price, but the completed round still has
  // the exact same buyer + spot + batch relationship. The audit may safely
  // recover that price because all three identities agree.
  db.prepare(`INSERT INTO pull_history_spots (batch_id,buyer_name,position,paid_cents) VALUES (?,?,?,?)`).run(batchId,'@Buyer',1,0);
  db.prepare(`INSERT INTO pull_history_items (batch_id,buyer_name,position,card_name,card_number,set_code,rarity,collector_treatment,variant_hint,quantity,source_kind,market_price_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(batchId,'Buyer',1,'Hit','OGN-001','OGN','EPIC','','',1,'selected',4000);
  const history = db.prepare(`INSERT INTO break_order_history (break_name,box_cost_cents,gross_sales_cents,priced_order_count,unpriced_order_count,confirmed_order_count,notes,disposition,recorded_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('Origins Box',10000,0,0,1,1,'','NORMAL_BREAK','2026-08-28T10:01:00.000Z');
  const historyId = Number(history.lastInsertRowid);
  db.prepare(`INSERT INTO break_order_history_items (history_id,position,buyer_name,card_name,card_number,set_code,rarity,sale_amount_cents,assigned_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(historyId,1,'Buyer','KaiSa','299/298','OGN','SHOWCASE',0,'2026-08-28T09:55:00.000Z');
  db.prepare(`INSERT INTO break_order_history_pulls (history_id,buyer_name,position,card_name,card_number,set_code,rarity,collector_treatment,variant_hint,quantity,source_kind) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(historyId,'Buyer',1,'Hit','OGN-001','OGN','EPIC','','',1,'selected');
  db.prepare(`INSERT INTO break_rounds (id,order_history_id,pull_history_batch_id,status) VALUES (?,?,?,?)`).run(1,historyId,batchId,'COMPLETED');
  db.prepare(`INSERT INTO break_round_cards (round_id,position,status,buyer_name,sale_amount_cents) VALUES (?,?,?,?,?)`).run(1,1,'called','@Buyer',2500);

  const result = auditBuyerPurchases(db,{repair:true});
  assert.equal(result.linkedHistoryCount,1);
  assert.equal(result.recoveredRoundPrices,1);
  assert.equal(result.totalSpendCents,2500);
  assert.equal(result.totalMarketValueCents,4000);
  assert.equal(result.verified,true);
  assert.equal(db.prepare('SELECT pull_history_batch_id FROM break_order_history WHERE id=?').get(historyId).pull_history_batch_id,batchId);
  assert.equal(db.prepare('SELECT sale_amount_cents FROM break_order_history_items WHERE history_id=?').get(historyId).sale_amount_cents,2500);
  assert.equal(db.prepare('SELECT paid_cents FROM pull_history_spots WHERE batch_id=? AND position=1').get(batchId).paid_cents,2500);
  assert.equal(db.prepare('SELECT gross_sales_cents FROM break_order_history WHERE id=?').get(historyId).gross_sales_cents,2500);
  db.close();
}

{
  const db = makeDb();
  const batch = db.prepare(`INSERT INTO pull_history_batches (ledger_saved_at,game_code,set_code,set_name,recorded_at) VALUES (?,?,?,?,?)`)
    .run('ledger-bad','RIFTBOUND','OGN','Origins','2026-08-28T11:00:00.000Z');
  const batchId = Number(batch.lastInsertRowid);
  db.prepare(`INSERT INTO pull_history_spots (batch_id,buyer_name,position,paid_cents) VALUES (?,?,?,?)`).run(batchId,'Buyer',1,2500);
  db.prepare(`INSERT INTO pull_history_items (batch_id,buyer_name,position,card_name,card_number,set_code,rarity,collector_treatment,variant_hint,quantity,source_kind,market_price_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(batchId,'Buyer',1,'Wrong Hit','OGN-002','OGN','EPIC','','',1,'selected',9000);
  const history = db.prepare(`INSERT INTO break_order_history (break_name,box_cost_cents,gross_sales_cents,priced_order_count,unpriced_order_count,confirmed_order_count,notes,disposition,recorded_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('Mismatch Box',10000,2500,1,0,1,'','NORMAL_BREAK','2026-08-28T11:01:00.000Z');
  const historyId = Number(history.lastInsertRowid);
  db.prepare(`INSERT INTO break_order_history_items (history_id,position,buyer_name,card_name,card_number,set_code,rarity,sale_amount_cents,assigned_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(historyId,1,'Buyer','Spot','299/298','OGN','SHOWCASE',2500,'2026-08-28T10:55:00.000Z');
  db.prepare(`INSERT INTO break_order_history_pulls (history_id,buyer_name,position,card_name,card_number,set_code,rarity,collector_treatment,variant_hint,quantity,source_kind) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(historyId,'Buyer',1,'Real Hit','OGN-003','OGN','EPIC','','',1,'selected');
  db.prepare(`INSERT INTO break_rounds (id,order_history_id,pull_history_batch_id,status) VALUES (?,?,?,?)`).run(2,historyId,batchId,'COMPLETED');
  db.prepare(`INSERT INTO break_round_cards (round_id,position,status,buyer_name,sale_amount_cents) VALUES (?,?,?,?,?)`).run(2,1,'called','Buyer',2500);

  const result = auditBuyerPurchases(db,{repair:true});
  assert.equal(result.roundLinkConflicts,1);
  assert.equal(result.linkedHistoryCount,0);
  assert.equal(result.missingPullLinks,1);
  assert.equal(result.totalMarketValueCents,0);
  assert.equal(result.verified,false);
  assert.equal(db.prepare('SELECT pull_history_batch_id FROM break_order_history WHERE id=?').get(historyId).pull_history_batch_id,null);
  db.close();
}



{
  const db = makeDb();
  const tracked = db.prepare(`INSERT INTO pull_history_batches (ledger_saved_at,game_code,set_code,set_name,recorded_at) VALUES (?,?,?,?,?)`)
    .run('ledger-pull-only','RIFTBOUND','OGN','Origins','2026-08-28T12:00:00.000Z');
  const trackedId = Number(tracked.lastInsertRowid);
  db.prepare(`INSERT INTO pull_history_spots (batch_id,buyer_name,position,paid_cents) VALUES (?,?,?,?)`).run(trackedId,'Buyer',1,2500);
  db.prepare(`INSERT INTO pull_history_items (batch_id,buyer_name,position,card_name,card_number,set_code,rarity,collector_treatment,variant_hint,quantity,source_kind,market_price_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(trackedId,'Buyer',1,'Tracked Hit','OGN-100','OGN','EPIC','','',1,'selected',1000);

  // Legacy Pull History without the saved spend snapshot is excluded from the
  // Profit/Cooked cohort, even if it has a market-valued card.
  const legacy = db.prepare(`INSERT INTO pull_history_batches (ledger_saved_at,game_code,set_code,set_name,recorded_at) VALUES (?,?,?,?,?)`)
    .run('ledger-legacy','RIFTBOUND','OGN','Origins','2026-08-20T12:00:00.000Z');
  const legacyId = Number(legacy.lastInsertRowid);
  db.prepare(`INSERT INTO pull_history_items (batch_id,buyer_name,position,card_name,card_number,set_code,rarity,collector_treatment,variant_hint,quantity,source_kind,market_price_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(legacyId,'Buyer',9,'Legacy Hit','OGN-999','OGN','EPIC','','',1,'selected',50000);

  // Old Orders History is also irrelevant to this audit.
  const history = db.prepare(`INSERT INTO break_order_history (break_name,box_cost_cents,gross_sales_cents,priced_order_count,unpriced_order_count,confirmed_order_count,notes,disposition,recorded_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('Old Box',10000,10000,1,0,1,'','NORMAL_BREAK','2026-08-10T12:00:00.000Z');
  db.prepare(`INSERT INTO break_order_history_items (history_id,position,buyer_name,card_name,card_number,set_code,rarity,sale_amount_cents,assigned_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(Number(history.lastInsertRowid),1,'Buyer','Old Spot','1','OGN','Spot',10000,'2026-08-10T11:00:00.000Z');

  const result = auditPullHistoryBuyerData(db);
  assert.equal(result.source,'PULL_HISTORY_ONLY');
  assert.equal(result.purchaseCount,1);
  assert.equal(result.totalSpendCents,2500);
  assert.equal(result.totalMarketValueCents,1000);
  assert.equal(result.historyCount,1);
  assert.equal(result.legacyPullBatchCount,1);
  assert.equal(result.verified,true);
  db.close();
}


{
  const db = makeDb();
  const batch = db.prepare(`INSERT INTO pull_history_batches (ledger_saved_at,game_code,set_code,set_name,recorded_at) VALUES (?,?,?,?,?)`)
    .run('ledger-accounting-safe','RIFTBOUND','OGN','Origins','2026-08-28T13:00:00.000Z');
  const batchId = Number(batch.lastInsertRowid);
  db.prepare(`INSERT INTO pull_history_items (batch_id,buyer_name,position,card_name,card_number,set_code,rarity,collector_treatment,variant_hint,quantity,source_kind,market_price_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(batchId,'Buyer',1,'Legacy Pull','OGN-200','OGN','EPIC','','',1,'selected',5000);
  const history = db.prepare(`INSERT INTO break_order_history (break_name,box_cost_cents,gross_sales_cents,priced_order_count,unpriced_order_count,confirmed_order_count,notes,disposition,recorded_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('Accounting Box',10000,0,0,0,0,'','NORMAL_BREAK','2026-08-28T13:01:00.000Z');
  const historyId = Number(history.lastInsertRowid);
  db.prepare(`INSERT INTO break_order_history_items (history_id,position,buyer_name,card_name,card_number,set_code,rarity,sale_amount_cents,assigned_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(historyId,1,'Buyer','Spot','1','OGN','Spot',2500,'2026-08-28T12:55:00.000Z');

  const beforeSpots = db.prepare('SELECT COUNT(*) AS count FROM pull_history_spots').get().count;
  const result = auditBusinessOrderTotals(db,{repair:true});
  const afterSpots = db.prepare('SELECT COUNT(*) AS count FROM pull_history_spots').get().count;
  assert.equal(result.source,'ORDERS_ACCOUNTING_ONLY');
  assert.equal(result.totalSpendCents,2500);
  assert.equal(result.repairedSummaryRows,1);
  assert.equal(beforeSpots,afterSpots,'business accounting reconciliation must not create Pull History spots');
  assert.equal(db.prepare('SELECT gross_sales_cents FROM break_order_history WHERE id=?').get(historyId).gross_sales_cents,2500);
  db.close();
}

console.log('Buyer purchase audit checks passed.');
