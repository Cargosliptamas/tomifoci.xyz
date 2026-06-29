import { bigint, boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  leagues: jsonb('leagues').notNull(),
  privateLeagues: jsonb('private_leagues').notNull().default([]),
  players: jsonb('players').notNull(),
  enPlayers: jsonb('en_players'),
  adminTotp: text('admin_totp'),
  ls2Key: text('ls2_key'),
  ls2Secret: text('ls2_secret'),
  lsAutoSync: boolean('ls_auto_sync'),
  dailyStats: jsonb('daily_stats'),
  landingSkin: text('landing_skin').notNull().default('matchday'),
  newsBoard: jsonb('news_board').notNull().default([])
})

export const predictions = pgTable(
  'predictions',
  {
    id: serial('id').primaryKey(),
    player: text('player').notNull(),
    matchId: integer('match_id').notNull(),
    h: integer('h').notNull(),
    a: integer('a').notNull(),
    community: text('community').notNull().default('hu')
  },
  (table) => [uniqueIndex('predictions_player_match_community_uq').on(table.player, table.matchId, table.community)]
)

export const results = pgTable(
  'results',
  {
    id: serial('id').primaryKey(),
    matchId: integer('match_id').notNull(),
    h: integer('h').notNull(),
    a: integer('a').notNull(),
    penH: integer('pen_h'),
    penA: integer('pen_a')
  },
  (table) => [uniqueIndex('results_match_uq').on(table.matchId)]
)

export const keyValueJsonTables = {
  koTeams: 'ko_teams',
  bonuses: 'bonuses',
  favorites: 'favorites',
  txnlog: 'txnlog',
  apiCache: 'api_cache',
  pushSubscriptions: 'push_subscriptions',
  apiMatchMap: 'api_match_map',
  playerScores: 'player_scores',
  rankings: 'rankings',
  wizardPicks: 'wizard_picks',
  wizardScores: 'wizard_scores',
  wizardRankings: 'wizard_rankings',
  wizardProfiles: 'wizard_profiles',
  swissProfiles: 'swiss_profiles',
  swissPairings: 'swiss_pairings',
  swissStandings: 'swiss_standings',
  swissLog: 'swiss_log',
  pinHashes: 'pin_hashes',
  adminAuth: 'admin_auth',
  authAttempts: 'auth_attempts',
  deletedPlayers: 'deleted_players',
  interestLeads: 'interest_leads'
} as const

export const importedRows = pgTable(
  'imported_rows',
  {
    id: serial('id').primaryKey(),
    tableName: text('table_name').notNull(),
    convexId: text('convex_id'),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    convexCreationTime: bigint('convex_creation_time', { mode: 'number' })
  },
  (table) => [
    index('imported_rows_table_idx').on(table.tableName),
    uniqueIndex('imported_rows_table_convex_id_uq').on(table.tableName, table.convexId)
  ]
)
